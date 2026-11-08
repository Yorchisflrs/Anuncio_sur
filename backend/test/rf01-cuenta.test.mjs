import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { createIsolatedApp, isolatedApp, jsonRequest, cookieFrom, TEST_PASSWORD } from './support.mjs';

// RF-01: registro, acceso con correo o celular, sesión persistente y cierre de sesión.
describe('RF-01 · Cuenta y acceso', () => {
  let app;
  before(async () => { app = await createIsolatedApp(); });
  after(() => app?.close());
  const account = (correo, celular, extra = {}) => jsonRequest({ nombre: 'Persona de prueba', correo, celular, password: TEST_PASSWORD, confirmacion: TEST_PASSWORD, ...extra });

  it('El registro guarda un hash bcrypt de costo 12 y abre sesión con cookie HttpOnly y SameSite=Strict', async () => {
    const { response, body } = await app.request('/auth/registro', account('registro-valido@avisosur-test.local', '900000101'));
    assert.equal(response.status, 201);
    assert.equal(body.usuario.correo, 'registro-valido@avisosur-test.local');
    const header = response.headers.get('set-cookie');
    assert.match(header, /HttpOnly/); assert.match(header, /SameSite=Strict/);
    const row = await app.db.get('SELECT * FROM usuarios WHERE id = ?', body.usuario.id);
    assert.notEqual(row.password_hash, TEST_PASSWORD); assert.match(row.password_hash, /^\$2[aby]\$12\$/);
    assert(await bcrypt.compare(TEST_PASSWORD, row.password_hash));
  });

  it('La API no expone la contraseña, su hash ni el token; la base guarda solo el SHA-256 del token', async () => {
    const { response, body } = await app.request('/auth/registro', account('sin-secretos@avisosur-test.local', '900000102'));
    assert.equal(response.status, 201);
    const row = await app.db.get('SELECT * FROM usuarios WHERE id = ?', body.usuario.id);
    const token = cookieFrom(response).split('=')[1];
    assert(!JSON.stringify(body).includes('password')); assert(!JSON.stringify(body).includes(row.password_hash)); assert(!JSON.stringify(body).includes(token));
    const session = await app.db.get('SELECT token_hash FROM sesiones WHERE usuario_id = ?', row.id);
    assert.match(session.token_hash, /^[a-f0-9]{64}$/); assert.notEqual(session.token_hash, token);
  });

  it('Datos inválidos devuelven 422 con un mensaje por cada campo', async () => {
    const { response, body } = await app.request('/auth/registro', jsonRequest({ correo: 'incorrecto', celular: '123', password: 'corta', confirmacion: 'otra' }));
    assert.equal(response.status, 422);
    assert.deepEqual(Object.keys(body.fields).sort(), ['celular', 'confirmacion', 'correo', 'nombre', 'password']);
  });

  it('El nombre para mostrar no acepta un correo, un enlace ni un número de teléfono', async () => {
    for (const nombre of ['', 'A', 'rosa@correo.com', 'www.mitienda.com', 'Llama al 987654321', 'x'.repeat(61)]) {
      const { response, body } = await app.request('/auth/registro', account('nombre-invalido@avisosur-test.local', '900000104', { nombre }));
      assert.equal(response.status, 422, nombre); assert(body.fields.nombre, nombre);
    }
    assert.equal((await app.db.get('SELECT COUNT(*) AS n FROM usuarios WHERE celular = ?', '900000104')).n, 0);
  });

  it('Una cuenta puede cambiar su nombre para mostrar desde su perfil', async () => {
    const user = await app.register('cambia-nombre', { nombre: '  Rosa   Quispe  ' });
    assert.equal(user.nombre, 'Rosa Quispe');
    const changed = await app.request('/perfil', jsonRequest({ nombre: 'Cuartos Rosa · UNA' }, user.cookie, 'PATCH'));
    assert.equal(changed.response.status, 422, 'El punto medio no es un carácter permitido.');
    const valid = await app.request('/perfil', jsonRequest({ nombre: 'Cuartos Rosa (UNA)' }, user.cookie, 'PATCH'));
    assert.equal(valid.response.status, 200); assert.equal(valid.body.usuario.nombre, 'Cuartos Rosa (UNA)');
    assert.equal((await app.request('/perfil', jsonRequest({ nombre: 'Sin sesión' }, '', 'PATCH'))).response.status, 401);
  });

  it('Un correo o celular ya registrado devuelve 409 sin crear otra cuenta', async () => {
    assert.equal((await app.request('/auth/registro', account('duplicado@avisosur-test.local', '900000103'))).response.status, 201);
    const before = (await app.db.get('SELECT COUNT(*) AS n FROM usuarios')).n;
    const { response, body } = await app.request('/auth/registro', account('DUPLICADO@avisosur-test.local', '900000103'));
    assert.equal(response.status, 409); assert(body.fields.correo); assert(body.fields.celular);
    assert.equal((await app.db.get('SELECT COUNT(*) AS n FROM usuarios')).n, before);
  });

  it('Se puede iniciar sesión con el correo o con el celular', async () => {
    const user = await app.register('acceso-doble');
    for (const identificador of [user.correo, user.celular]) {
      const cookie = await app.login(identificador);
      const me = await app.request('/auth/me', { headers: { Cookie: cookie } });
      assert.equal(me.body.usuario.id, user.id);
    }
  });

  it('Una contraseña incorrecta devuelve 401 con un mensaje comprensible', async () => {
    const user = await app.register('clave-incorrecta');
    const { response, body } = await app.request('/auth/login', jsonRequest({ identificador: user.celular, password: 'incorrecta' }));
    assert.equal(response.status, 401); assert.match(body.message, /no es correcto/);
    assert.equal(cookieFrom(response), '');
  });

  it('Las rutas privadas exigen sesión', async () => {
    assert.equal((await app.request('/anuncios', { method: 'POST' })).response.status, 401);
    assert.equal((await app.request('/perfil/anuncios')).response.status, 401);
    assert.equal((await app.request('/auth/me')).body.usuario, null);
  });

  it('Una escritura enviada desde otro sitio se rechaza con 403', async () => {
    const user = await app.register('origen-ajeno');
    const { response } = await app.request('/auth/logout', { method: 'POST', headers: { Origin: 'https://sitio-ajeno.invalid', Cookie: user.cookie } });
    assert.equal(response.status, 403);
    assert.equal((await app.request('/auth/me', { headers: { Cookie: user.cookie } })).body.usuario.id, user.id, 'La sesión sigue activa.');
  });

  it('Cerrar sesión revoca el token: el perfil vuelve a pedir sesión', async () => {
    const user = await app.register('cierre-sesion');
    assert.equal((await app.request('/auth/logout', { method: 'POST', headers: { Cookie: user.cookie } })).response.status, 200);
    assert.equal((await app.request('/auth/me', { headers: { Cookie: user.cookie } })).body.usuario, null);
    assert.equal((await app.request('/perfil/anuncios', { headers: { Cookie: user.cookie } })).response.status, 401);
  });
});

describe('RNF-03 · Protección del acceso', () => {
  it('Superar el límite de intentos devuelve 429 con un mensaje claro', async t => {
    const app = await isolatedApp(t, { authAttemptLimit: 3 });
    for (let attempt = 0; attempt < 3; attempt += 1) {
      assert.equal((await app.request('/auth/login', jsonRequest({ identificador: '900000199', password: 'incorrecta' }))).response.status, 401);
    }
    const blocked = await app.request('/auth/login', jsonRequest({ identificador: '900000199', password: 'incorrecta' }));
    assert.equal(blocked.response.status, 429); assert.match(blocked.body.message, /varios intentos/);
  });
});
