import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import bcrypt from 'bcryptjs';
import sharp from 'sharp';
import { createApp } from '../src/app.mjs';
import { DEMO_USER } from '../src/seed.mjs';

const project = fileURLToPath(new URL('../../', import.meta.url));
test('Escenarios de aceptación de AvisoSur y controles de seguridad', async t => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'avisosur-test-'));
  const settings = { databaseClient: 'sqlite', databasePath: path.join(temporary, 'test.sqlite'), uploadDir: path.join(temporary, 'uploads') };
  let context = await createApp(settings);
  let server = context.app.listen(0, '127.0.0.1'); await once(server, 'listening');
  let base = 'http://127.0.0.1:' + server.address().port;
  const records = []; const measurements = {};
  const password = 'PruebaSegura2026!'; let cookie = ''; let created; let boundary;
  const png = await sharp({ create: { width: 1024, height: 768, channels: 3, background: '#0db6b2' } }).png().toBuffer();
  const jpeg = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#1465b8' } }).jpeg().toBuffer();
  async function request(endpoint, options = {}) {
    const response = await fetch(base + '/api' + endpoint, options);
    return { response, body: await response.json() };
  }
  const json = (body, auth = '') => ({ method: 'POST', headers: { 'Content-Type': 'application/json', ...(auth ? { Cookie: auth } : {}) }, body: JSON.stringify(body) });
  const multipart = (overrides = {}, files = [{ buffer: png, name: 'principal.png', type: 'image/png' }]) => {
    const form = new FormData();
    Object.entries({ titulo: 'Producto de prueba a un sol', descripcion: 'Producto ficticio usado para verificar el flujo de publicación.', categoriaId: '1', subcategoria: 'Motos', precio: '1', zona: 'Puno', ...overrides }).forEach(([key, value]) => form.append(key, value));
    files.forEach(file => form.append('fotos', new Blob([file.buffer], { type: file.type }), file.name));
    return { method: 'POST', headers: { Cookie: cookie }, body: form };
  };
  async function check(name, action) {
    await t.test(name, async () => {
      const start = performance.now();
      try { await action(); records.push({ escenario: name, resultado: 'correcto', duracionMs: Math.round(performance.now() - start) }); }
      catch (error) { records.push({ escenario: name, resultado: 'falló', error: error.message }); throw error; }
    });
  }
  t.after(async () => {
    if (server.listening) await new Promise(resolve => server.close(resolve));
    context.db.close();
    // Solo borrar el directorio temporal creado por esta prueba, verificado dentro de tmp.
    const resolved = path.resolve(temporary);
    if (resolved.startsWith(path.resolve(os.tmpdir()) + path.sep + 'avisosur-test-')) await fs.rm(resolved, { recursive: true, force: true });
    await fs.mkdir(path.join(project, 'docs'), { recursive: true });
    await fs.writeFile(path.join(project, 'docs', 'acceptance-results.json'), JSON.stringify({ fecha: new Date().toISOString(), node: process.version, entorno: 'HTTP local, base de datos y archivos temporales aislados', escenarios: records, mediciones: measurements }, null, 2) + '\n');
  });

  await check('Datos iniciales: 16 anuncios y tres categorías', async () => {
    const { response, body } = await request('/anuncios'); assert.equal(response.status, 200); assert.equal(body.total, 16);
    assert.equal(new Set(body.anuncios.map(ad => ad.categoria)).size, 3); assert(body.anuncios.every(ad => ad.demo));
    assert(body.anuncios.some(ad => ad.zona === 'Puno')); assert(body.anuncios.some(ad => ad.zona === 'Juliaca'));
  });
  await check('Registro, hash bcrypt y cookie HttpOnly', async () => {
    const { response, body } = await request('/auth/registro', json({ correo: 'aceptacion@avisosur.local', celular: '900000001', password, confirmacion: password }));
    assert.equal(response.status, 201); assert.equal(body.usuario.correo, 'aceptacion@avisosur.local');
    const header = response.headers.get('set-cookie'); assert.match(header, /HttpOnly/); assert.match(header, /SameSite=Strict/); cookie = header.split(';')[0];
    const row = context.db.prepare('SELECT * FROM usuarios WHERE id = ?').get(body.usuario.id);
    assert.notEqual(row.password_hash, password); assert.match(row.password_hash, /^\$2[aby]\$12\$/); assert(await bcrypt.compare(password, row.password_hash));
    assert(!JSON.stringify(body).includes('password')); assert(!JSON.stringify(body).includes(row.password_hash));
    assert.notEqual(context.db.prepare('SELECT token_hash FROM sesiones WHERE usuario_id = ?').get(row.id).token_hash, cookie.split('=')[1]);
  });
  await check('Registro inválido y datos duplicados', async () => {
    const invalid = await request('/auth/registro', json({ correo: 'incorrecto', celular: '123', password: 'corta', confirmacion: 'otra' }));
    assert.equal(invalid.response.status, 422); assert.equal(Object.keys(invalid.body.fields).length, 4);
    const duplicate = await request('/auth/registro', json({ correo: 'ACEPTACION@avisosur.local', celular: '900000001', password, confirmacion: password }));
    assert.equal(duplicate.response.status, 409); assert(duplicate.body.fields.correo); assert(duplicate.body.fields.celular);
  });
  await check('Inicio de sesión por correo y celular; errores comprensibles', async () => {
    const invalid = await request('/auth/login', json({ identificador: '900000001', password: 'incorrecta' })); assert.equal(invalid.response.status, 401); assert.match(invalid.body.message, /no es correcto/);
    for (const identificador of ['aceptacion@avisosur.local', '900000001']) {
      const valid = await request('/auth/login', json({ identificador, password })); assert.equal(valid.response.status, 200); cookie = valid.response.headers.get('set-cookie').split(';')[0];
    }
    const me = await request('/auth/me', { headers: { Cookie: cookie } }); assert.equal(me.body.usuario.celular, '900000001');
  });
  await check('Publicación y perfil protegidos; rechazo de origen ajeno', async () => {
    const post = await request('/anuncios', { method: 'POST' }); assert.equal(post.response.status, 401);
    const profile = await request('/perfil/anuncios'); assert.equal(profile.response.status, 401);
    const csrf = await request('/auth/logout', { method: 'POST', headers: { Origin: 'https://sitio-ajeno.invalid', Cookie: cookie } }); assert.equal(csrf.response.status, 403);
  });
  await check('Publicación por S/ 1, tres fotografías y objetivo de cinco segundos', async () => {
    const started = performance.now();
    const result = await request('/anuncios', multipart({}, [{ buffer: png, name: 'uno.png', type: 'image/png' }, { buffer: jpeg, name: 'dos.jpg', type: 'image/jpeg' }, { buffer: png, name: 'tres.png', type: 'image/png' }]));
    measurements.publicacionMs = Math.round((performance.now() - started) * 100) / 100;
    assert.equal(result.response.status, 201); created = result.body; assert.equal(created.precio, 1); assert.equal(created.fotos.length, 3);
    assert.deepEqual(created.fotos.map(photo => photo.orden), [0, 1, 2]); assert(created.fotos.every(photo => photo.archivo.endsWith('.webp')));
    const image = await fetch(base + created.fotos[0].archivo); assert.equal(image.status, 200); assert.match(image.headers.get('content-type'), /image\/webp/);
    const catalog = await request('/anuncios?q=Producto%20de%20prueba'); assert(catalog.body.anuncios.some(ad => ad.id === created.id));
    assert(measurements.publicacionMs < 5000, 'Publicación tardó ' + measurements.publicacionMs + ' ms');
  });
  await check('Precio S/ 0 y categoría vacía no guardan anuncios ni fotos', async () => {
    const before = context.db.prepare('SELECT COUNT(*) AS n FROM anuncios').get().n; const filesBefore = await fs.readdir(settings.uploadDir);
    const result = await request('/anuncios', multipart({ categoriaId: '', precio: '0' })); assert.equal(result.response.status, 422); assert(result.body.fields.precio); assert(result.body.fields.categoriaId);
    assert.equal(context.db.prepare('SELECT COUNT(*) AS n FROM anuncios').get().n, before); assert.deepEqual(await fs.readdir(settings.uploadDir), filesBefore);
  });
  await check('Fotografía, descripción y zona obligatorias', async () => {
    const result = await request('/anuncios', multipart({ descripcion: '', zona: '' }, [])); assert.equal(result.response.status, 422); assert(result.body.fields.descripcion); assert(result.body.fields.zona); assert(result.body.fields.fotos);
  });
  await check('Rechazo de archivos falsos, cuatro fotos y más de dos MB', async () => {
    const fake = await request('/anuncios', multipart({}, [{ buffer: Buffer.from('no es una imagen'), name: 'falsa.png', type: 'image/png' }])); assert.equal(fake.response.status, 422);
    const four = await request('/anuncios', multipart({}, Array.from({ length: 4 }, (_, index) => ({ buffer: png, name: index + '.png', type: 'image/png' })))); assert.equal(four.response.status, 422);
    const large = await request('/anuncios', multipart({}, [{ buffer: Buffer.alloc(2 * 1024 * 1024 + 1), name: 'grande.png', type: 'image/png' }])); assert.equal(large.response.status, 422); assert.match(large.body.fields.fotos, /2 MB/);
  });
  await check('Rango inclusivo: Vehículos entre S/ 0 y S/ 5000', async () => {
    const result = await request('/anuncios', multipart({ titulo: 'Moto de prueba en el límite', precio: '5000' })); assert.equal(result.response.status, 201); boundary = result.body;
    const filtered = await request('/anuncios?categoriaId=1&min=0&max=5000'); assert.equal(filtered.response.status, 200);
    assert(filtered.body.anuncios.every(ad => ad.categoriaId === 1 && ad.precio >= 0 && ad.precio <= 5000));
    assert(filtered.body.anuncios.some(ad => ad.id === 1 && ad.precio === 5000)); assert(filtered.body.anuncios.some(ad => ad.id === boundary.id));
    const exact = await request('/anuncios?min=5000&max=5000'); assert(exact.body.anuncios.length >= 2); assert(exact.body.anuncios.every(ad => ad.precio === 5000));
  });
  await check('Filtros combinados, subcategoría y búsqueda sin tildes', async () => {
    const filtered = await request('/anuncios?categoriaId=1&subcategoria=Motos&zona=Puno&min=0&max=5000&q=moto');
    assert(filtered.body.total >= 2); assert(filtered.body.anuncios.every(ad => ad.categoriaId === 1 && ad.subcategoria === 'Motos' && ad.zona === 'Puno' && ad.precio <= 5000));
    const normalized = await request('/anuncios?q=HABITACION'); assert(normalized.body.anuncios.some(ad => ad.titulo.includes('Habitación')));
    const invalidRange = await request('/anuncios?min=6000&max=5000'); assert.equal(invalidRange.response.status, 422);
  });
  await check('Sin coincidencias y texto SQL tratado como dato', async () => {
    const empty = await request('/anuncios?categoriaId=3&q=sincoincidencia-xyz'); assert.equal(empty.body.total, 0); assert.deepEqual(empty.body.anuncios, []);
    const sql = await request('/anuncios?q=' + encodeURIComponent("' OR 1=1 --")); assert.equal(sql.response.status, 200); assert.equal(sql.body.total, 0);
  });
  await check('WhatsApp: prefijo 51 y mensaje exacto, sin enviar mensajes', async () => {
    const result = await request('/anuncios/1'); const url = new URL(result.body.whatsappUrl);
    assert.equal(url.origin, 'https://wa.me'); assert.equal(url.pathname, '/51' + DEMO_USER.celular);
    assert.equal(url.searchParams.get('text'), 'Hola, vi tu anuncio de ' + result.body.titulo + ' en AvisoSur y quisiera saber si todavía está disponible');
    assert(!JSON.stringify(result.body).includes('password_hash')); assert(!JSON.stringify(result.body).includes('passwordHash'));
  });
  await check('Baja exclusiva del propietario y conservación del registro', async () => {
    const other = await request('/auth/login', json({ identificador: DEMO_USER.correo, password: DEMO_USER.password })); const otherCookie = other.response.headers.get('set-cookie').split(';')[0];
    const forbidden = await request('/anuncios/' + created.id + '/baja', { method: 'PATCH', headers: { Cookie: otherCookie } }); assert.equal(forbidden.response.status, 403);
    const own = await request('/anuncios/' + created.id + '/baja', { method: 'PATCH', headers: { Cookie: cookie } }); assert.equal(own.response.status, 200);
    const catalog = await request('/anuncios?q=Producto%20de%20prueba'); assert.equal(catalog.body.total, 0);
    const profile = await request('/perfil/anuncios', { headers: { Cookie: cookie } }); assert(profile.body.some(ad => ad.id === created.id && ad.estado === 'dado_de_baja'));
    assert.equal((await request('/anuncios/' + created.id)).response.status, 404); assert.equal((await request('/anuncios/' + created.id, { headers: { Cookie: cookie } })).response.status, 200);
  });
  await check('Persistencia al reiniciar y seed idempotente', async () => {
    await new Promise(resolve => server.close(resolve)); context.db.close(); context = await createApp(settings);
    server = context.app.listen(0, '127.0.0.1'); await once(server, 'listening'); base = 'http://127.0.0.1:' + server.address().port;
    const profile = await request('/perfil/anuncios', { headers: { Cookie: cookie } }); assert.equal(profile.body.length, 2);
    assert.equal(context.db.prepare('SELECT COUNT(*) AS n FROM anuncios').get().n, 18);
    const persisted = await request('/anuncios/' + boundary.id); assert.equal(persisted.body.precio, 5000);
    assert.equal((await fetch(base + persisted.body.imagen)).status, 200);
  });
  await check('Cerrar sesión revoca el token y protege el perfil', async () => {
    const result = await request('/auth/logout', { method: 'POST', headers: { Cookie: cookie } }); assert.equal(result.response.status, 200);
    assert.equal((await request('/auth/me', { headers: { Cookie: cookie } })).body.usuario, null);
    assert.equal((await request('/perfil/anuncios', { headers: { Cookie: cookie } })).response.status, 401);
  });
  await check('Las publicaciones de la cuenta demo mantienen su identificación ficticia', async () => {
    const login = await request('/auth/login', json({ identificador: DEMO_USER.correo, password: DEMO_USER.password }));
    const demoCookie = login.response.headers.get('set-cookie').split(';')[0];
    const publication = await request('/anuncios', { ...multipart({ titulo: 'Anuncio ficticio desde la cuenta demo' }), headers: { Cookie: demoCookie } });
    assert.equal(publication.response.status, 201); assert.equal(publication.body.demo, true); assert.equal(publication.body.vendedor.demo, true);
    assert.equal(publication.body.fotos.length, 1);
  });
});
