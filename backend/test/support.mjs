import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { once } from 'node:events';
import sharp from 'sharp';
import { createApp } from '../src/app.mjs';

export const TEST_PASSWORD = 'PruebaAislada2026!';
const TEMPORARY_PREFIX = 'avisosur-test-';
let picture;
export async function testPicture() {
  picture ||= await sharp({ create: { width: 160, height: 120, channels: 3, background: '#167c95' } }).png().toBuffer();
  return picture;
}

export const jsonRequest = (body, cookie = '', method = 'POST') => ({
  method,
  headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
  body: JSON.stringify(body),
});
export const cookieFrom = response => response.headers.get('set-cookie')?.split(';')[0] || '';

/**
 * Aplicación real escuchando por HTTP en un puerto libre, con SQLite y archivos
 * en un directorio temporal propio. Nunca se conecta a MySQL ni a los datos reales.
 */
export async function createIsolatedApp(overrides = {}) {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), TEMPORARY_PREFIX));
  const settings = {
    databaseClient: 'sqlite',
    databasePath: path.join(temporary, 'test.sqlite'),
    uploadDir: path.join(temporary, 'uploads'),
    privateUploadDir: path.join(temporary, 'private'),
    frontendDist: path.join(temporary, 'no-frontend'),
    secureCookie: false,
    ...overrides,
  };
  assert.equal(settings.databaseClient, 'sqlite', 'Esta fábrica nunca debe conectarse a MySQL.');
  let context = await createApp(settings);
  let server;
  let base;
  let userNumber = 100;
  let sharedAdmin;
  async function listen() {
    server = context.app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    base = 'http://127.0.0.1:' + server.address().port;
  }
  await listen();
  async function close() {
    if (server?.listening) await new Promise(resolve => server.close(resolve));
    await context.db.close();
    const resolved = path.resolve(temporary);
    assert(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep + TEMPORARY_PREFIX), 'Se conserva cualquier directorio fuera del temporal creado por esta prueba.');
    await fs.rm(resolved, { recursive: true, force: true });
  }
  async function request(endpoint, options = {}) {
    const response = await fetch(base + '/api' + endpoint, options);
    const body = response.headers.get('content-type')?.includes('application/json') ? await response.json() : await response.text();
    return { response, body };
  }
  async function register(label, overrides = {}) {
    userNumber += 1;
    const result = await request('/auth/registro', jsonRequest({ correo: label + '@avisosur-test.local', celular: '91' + String(userNumber).padStart(7, '0'), password: TEST_PASSWORD, confirmacion: TEST_PASSWORD, ...overrides }));
    assert.equal(result.response.status, 201, JSON.stringify(result.body));
    const cookie = cookieFrom(result.response);
    assert(cookie, 'El registro debe iniciar sesión con una cookie.');
    return { ...result.body.usuario, cookie };
  }
  async function login(identificador, password = TEST_PASSWORD) {
    const result = await request('/auth/login', jsonRequest({ identificador, password }));
    assert.equal(result.response.status, 200, JSON.stringify(result.body));
    return cookieFrom(result.response);
  }
  async function administrator(label = 'administrador') {
    const account = await register(label);
    await context.db.run("UPDATE usuarios SET rol = 'admin' WHERE id = ?", account.id);
    return { ...account, rol: 'admin' };
  }
  async function admin() {
    sharedAdmin ||= await administrator('admin-compartido');
    return sharedAdmin;
  }
  async function listingWith(cookie, overrides = {}, files = []) {
    const form = new FormData();
    for (const [key, value] of Object.entries({ titulo: 'Producto de prueba moderado', descripcion: 'Descripción completa de un producto ficticio de las pruebas aisladas.', categoriaId: '1', subcategoria: 'Motos', precio: '150', zona: 'Puno', direccion: 'Calle de ejemplo 123', referencia: 'Frente al parque de ejemplo', contacto: '900000003', planId: '1', ...overrides })) {
      form.append(key, String(value));
    }
    for (const file of files) form.append('fotos', new Blob([file.buffer], { type: file.type }), file.name);
    return request('/anuncios', { method: 'POST', headers: { Cookie: cookie }, body: form });
  }
  async function listing(cookie, overrides = {}, count = 1) {
    const image = await testPicture();
    return listingWith(cookie, overrides, Array.from({ length: count }, (_, index) => ({ buffer: image, name: 'foto-' + index + '.png', type: 'image/png' })));
  }
  async function proof(cookie, listingId, image = null, fields = {}) {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) form.append(key, String(value));
    form.append('comprobante', new Blob([image || await testPicture()], { type: 'image/png' }), 'comprobante.png');
    return request('/anuncios/' + listingId + '/comprobante', { method: 'POST', headers: { Cookie: cookie }, body: form });
  }
  const approve = (cookie, listingId, overrides = {}) => request('/admin/anuncios/' + listingId + '/aprobar', jsonRequest({ confirmarPago: true, referenciaPago: 'Referencia de pago de la prueba aislada', ...overrides }, cookie));
  /** Crea un anuncio y lo aprueba con la cuenta administradora compartida: queda en el catálogo público. */
  async function publish(cookie, overrides = {}) {
    const created = await listing(cookie, overrides);
    assert.equal(created.response.status, 201, JSON.stringify(created.body));
    const approved = await approve((await admin()).cookie, created.body.id);
    assert.equal(approved.response.status, 200, JSON.stringify(approved.body));
    return approved.body;
  }
  return {
    temporary, settings, get db() { return context.db; }, get base() { return base; },
    request, register, login, administrator, admin, listing, listingWith, publish, proof, approve, close,
    async restart() {
      if (server.listening) await new Promise(resolve => server.close(resolve));
      await context.db.close();
      context = await createApp(settings);
      await listen();
    },
  };
}

/** Igual que createIsolatedApp, pero se cierra y se borra al terminar la prueba `t`. */
export async function isolatedApp(t, overrides = {}) {
  const app = await createIsolatedApp(overrides);
  t.after(() => app.close());
  return app;
}
