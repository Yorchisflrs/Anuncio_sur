import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createIsolatedApp, jsonRequest, DEMO_TEST_PASSWORD } from './support.mjs';
import { DEMO_USER } from '../src/seed.mjs';

// Novedad propuesta en la Práctica 9 (1 de 2): celular verificado con un código.
// Administración envía el código por WhatsApp; quien lo escribe demuestra que controla el número.
describe('Novedad · Celular verificado', () => {
  let app, admin;
  before(async () => { app = await createIsolatedApp(); admin = await app.admin(); });
  after(() => app?.close());
  const codeFor = async userId => {
    const result = await app.request('/admin/verificaciones/' + userId + '/codigo', jsonRequest({}, admin.cookie));
    assert.equal(result.response.status, 201, JSON.stringify(result.body));
    return result.body;
  };
  const confirm = (cookie, codigo) => app.request('/perfil/verificacion/confirmar', jsonRequest({ codigo }, cookie));
  const wrongCode = codigo => codigo === '000000' ? '111111' : '000000';

  it('Un usuario sin verificar puede mirar avisos, pero si intenta publicar recibe 403', async () => {
    const user = await app.register('sin-verificar', {}, { verificado: false });
    assert.equal(user.celularVerificado, false);
    assert.equal((await app.request('/anuncios', { headers: { Cookie: user.cookie } })).response.status, 200);
    const before = (await app.db.get('SELECT COUNT(*) AS n FROM anuncios')).n;
    const files = await fs.readdir(app.settings.uploadDir).catch(() => []);
    const { response, body } = await app.listing(user.cookie, { titulo: 'No debe publicarse sin verificar' });
    assert.equal(response.status, 403); assert(body.fields.verificacion);
    assert.equal((await app.db.get('SELECT COUNT(*) AS n FROM anuncios')).n, before);
    assert.deepEqual(await fs.readdir(app.settings.uploadDir).catch(() => []), files, 'Las fotos no se guardan si la cuenta no está verificada.');
  });

  it('Al registrarse, la cuenta queda pendiente en la lista de administración', async () => {
    const user = await app.register('pendiente-en-lista', {}, { verificado: false });
    const status = await app.request('/perfil/verificacion', { headers: { Cookie: user.cookie } });
    assert.equal(status.body.verificado, false); assert(status.body.solicitado); assert.equal(status.body.codigoVigente, false);
    const list = await app.request('/admin/verificaciones', { headers: { Cookie: admin.cookie } });
    const row = list.body.find(item => item.usuarioId === user.id);
    assert(row); assert.equal(row.celular, user.celular); assert(row.solicitado); assert.equal(row.codigoVigente, false);
    assert(!list.body.some(item => item.usuarioId === 1), 'La cuenta demo no aparece para verificar.');
  });

  it('Un código equivocado devuelve 422 y descuenta un intento', async () => {
    const user = await app.register('codigo-equivocado', {}, { verificado: false });
    const { codigo } = await codeFor(user.id);
    const { response, body } = await confirm(user.cookie, wrongCode(codigo));
    assert.equal(response.status, 422); assert.match(body.message, /Te quedan 4 intentos/); assert(body.fields.codigo);
    assert.equal((await app.request('/perfil/verificacion', { headers: { Cookie: user.cookie } })).body.intentosRestantes, 4);
    assert.equal((await app.db.get('SELECT celular_verificado FROM usuarios WHERE id = ?', user.id)).celular_verificado, 0);
  });

  it('Después de cinco intentos fallidos el código deja de servir', async () => {
    const user = await app.register('cinco-intentos', {}, { verificado: false });
    const { codigo } = await codeFor(user.id);
    for (let attempt = 1; attempt <= 5; attempt += 1) assert.equal((await confirm(user.cookie, wrongCode(codigo))).response.status, 422);
    const blocked = await confirm(user.cookie, codigo);
    assert.equal(blocked.response.status, 429, 'Ni siquiera el código correcto sirve tras agotar los intentos.');
    const fresh = await codeFor(user.id); // Administración envía uno nuevo y los intentos vuelven a empezar.
    assert.equal((await confirm(user.cookie, fresh.codigo)).response.status, 200);
  });

  it('Un código vencido no sirve', async () => {
    const user = await app.register('codigo-vencido', {}, { verificado: false });
    const { codigo } = await codeFor(user.id);
    await app.db.run('UPDATE verificaciones_celular SET expira = ? WHERE usuario_id = ?', new Date(Date.now() - 1000).toISOString(), user.id);
    const { response } = await confirm(user.cookie, codigo);
    assert.equal(response.status, 409);
  });

  it('Con el código correcto el celular queda verificado y ya puede publicar', async () => {
    const user = await app.register('codigo-correcto', {}, { verificado: false });
    const sent = await codeFor(user.id);
    assert.match(sent.codigo, /^\d{6}$/);
    const url = new URL(sent.whatsappUrl);
    assert.equal(url.pathname, '/51' + user.celular); assert(url.searchParams.get('text').includes(sent.codigo));
    const { response, body } = await confirm(user.cookie, sent.codigo);
    assert.equal(response.status, 200, JSON.stringify(body));
    assert.equal(body.usuario.celularVerificado, true); assert.equal(body.verificacion.metodo, 'codigo');
    assert.equal((await app.listing(user.cookie, { titulo: 'Publicado después de verificar' })).response.status, 201);
    const list = await app.request('/admin/verificaciones', { headers: { Cookie: admin.cookie } });
    assert(!list.body.some(item => item.usuarioId === user.id), 'Ya no aparece como pendiente.');
    assert.equal((await confirm(user.cookie, sent.codigo)).response.status, 409, 'Un celular verificado no se confirma dos veces.');
  });

  it('El código no se guarda en texto plano', async () => {
    const user = await app.register('codigo-con-hash', {}, { verificado: false });
    const { codigo } = await codeFor(user.id);
    const row = await app.db.get('SELECT codigo_hash FROM verificaciones_celular WHERE usuario_id = ?', user.id);
    assert.match(row.codigo_hash, /^[a-f0-9]{64}$/); assert(!row.codigo_hash.includes(codigo));
  });

  it('Administración puede verificar en persona, con una confirmación explícita', async () => {
    const user = await app.register('verificado-en-persona', {}, { verificado: false });
    const missing = await app.request('/admin/verificaciones/' + user.id + '/presencial', jsonRequest({}, admin.cookie));
    assert.equal(missing.response.status, 422); assert(missing.body.fields.confirmado);
    const done = await app.request('/admin/verificaciones/' + user.id + '/presencial', jsonRequest({ confirmado: true }, admin.cookie));
    assert.equal(done.response.status, 200);
    const row = await app.db.get('SELECT celular_verificado, metodo_verificacion FROM usuarios WHERE id = ?', user.id);
    assert.equal(row.celular_verificado, 1); assert.equal(row.metodo_verificacion, 'presencial');
  });

  it('Solo administración ve la lista, genera códigos o verifica en persona', async () => {
    const user = await app.register('sin-permisos', {}, { verificado: false });
    const other = await app.register('otro-sin-verificar', {}, { verificado: false });
    assert.equal((await app.request('/admin/verificaciones', { headers: { Cookie: user.cookie } })).response.status, 403);
    assert.equal((await app.request('/admin/verificaciones/' + other.id + '/codigo', jsonRequest({}, user.cookie))).response.status, 403);
    assert.equal((await app.request('/admin/verificaciones/' + user.id + '/presencial', jsonRequest({ confirmado: true }, user.cookie))).response.status, 403);
    assert.equal((await app.request('/admin/verificaciones/' + other.id + '/codigo', jsonRequest({}))).response.status, 401);
  });

  it('La insignia aparece en el catálogo y el detalle muestra avisos publicados y dados de baja', async () => {
    const seller = await app.register('vendedor-con-insignia');
    const first = await app.publish(seller.cookie, { titulo: 'Primer aviso con insignia' });
    const second = await app.publish(seller.cookie, { titulo: 'Segundo aviso que se dará de baja' });
    assert.equal((await app.request('/anuncios/' + second.id + '/baja', { method: 'PATCH', headers: { Cookie: seller.cookie } })).response.status, 200);
    const catalog = await app.request('/anuncios?q=' + encodeURIComponent(first.titulo));
    assert.equal(catalog.body.anuncios[0].vendedorVerificado, true);
    const { body } = await app.request('/anuncios/' + first.id);
    assert.equal(body.vendedor.verificado, true); assert.equal(body.vendedor.avisosPublicados, 2); assert.equal(body.vendedor.avisosDadosDeBaja, 1);
    assert.equal((await app.approve(admin.cookie, 1)).response.status, 200);
    const demo = await app.request('/anuncios/1');
    assert.equal(demo.body.vendedorVerificado, false); assert.equal(demo.body.vendedor.verificado, false, 'Un número ficticio nunca se muestra como verificado.');
  });

  it('La cuenta demo, con un número ficticio, no se puede verificar', async () => {
    const cookie = await app.login(DEMO_USER.correo, DEMO_TEST_PASSWORD);
    assert.equal((await app.request('/perfil/verificacion', jsonRequest({}, cookie))).response.status, 403);
    assert.equal((await app.request('/admin/verificaciones/1/codigo', jsonRequest({}, admin.cookie))).response.status, 403);
  });
});
