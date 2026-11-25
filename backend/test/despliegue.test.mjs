import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isolatedApp, jsonRequest } from './support.mjs';

test('PD-01 · Salud comprueba la base y conserva la ruta de salud anterior', async t => {
  const server = await isolatedApp(t);
  for (const route of ['/salud', '/api/health']) {
    const response = await fetch(server.base + route);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { status: 'ok', nombre: 'AvisoSur' });
  }
  const get = server.db.get;
  server.db.get = async () => { throw new Error('Credencial privada que no debe salir en salud'); };
  try {
    const response = await fetch(server.base + '/salud');
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { status: 'error', nombre: 'AvisoSur' });
    assert.equal(response.headers.get('cache-control'), 'no-store');
  } finally {
    server.db.get = get;
  }
});

test('PD-02 · Detrás del proxy cada visitante tiene su propio límite de acceso', async t => {
  const server = await isolatedApp(t, { trustProxy: 1, authAttemptLimit: 1 });
  const login = ip => {
    const options = jsonRequest({ identificador: 'inexistente@avisosur-test.local', password: 'IncorrectaDePrueba!' });
    options.headers['X-Forwarded-For'] = ip;
    return server.request('/auth/login', options);
  };
  assert.equal((await login('192.0.2.10')).response.status, 401);
  assert.equal((await login('192.0.2.10')).response.status, 429);
  assert.equal((await login('192.0.2.11')).response.status, 401);
});

test('PD-03 · La cookie HTTPS y el origen permitido mantienen el acceso protegido', async t => {
  const server = await isolatedApp(t, {
    secureCookie: true, trustProxy: 1, allowedOrigins: ['https://avisosur.example'],
  });
  const account = await server.register('despliegue-cookie');
  const options = jsonRequest({ identificador: account.correo, password: 'PruebaAislada2026!' });
  options.headers.Origin = 'https://avisosur.example';
  options.headers['X-Forwarded-Proto'] = 'https';
  const result = await server.request('/auth/login', options);
  assert.equal(result.response.status, 200);
  const cookie = result.response.headers.get('set-cookie');
  assert.match(cookie, /; Secure/i);
  assert.match(cookie, /; HttpOnly/i);
  assert.match(cookie, /; SameSite=Strict/i);
  options.headers.Origin = 'https://sitio-ajeno.example';
  assert.equal((await server.request('/auth/login', options)).response.status, 403);
});

test('PD-04 · Producción exige configuración y reconoce el dominio de Railway', () => {
  const configUrl = new URL('../src/config.mjs', import.meta.url).href;
  const command = 'const {defaultConfig:c}=await import(' + JSON.stringify(configUrl) +
    ');console.log(JSON.stringify({origin:c.allowedOrigins,secure:c.secureCookie,proxy:c.trustProxy}))';
  const cwd = fileURLToPath(new URL('../../..', import.meta.url));
  const env = {
    ...process.env, NODE_ENV: 'production', DB_CLIENT: 'mysql',
    DB_HOST: 'mysql.railway.internal', DB_NAME: 'practica_aislada', DB_USER: 'prueba',
    DB_PASSWORD: 'SoloEsUnaVariableDePrueba', TRUST_PROXY: '1',
    RAILWAY_PUBLIC_DOMAIN: 'avisosur.example', APP_ORIGIN: '',
  };
  const run = values => spawnSync(process.execPath, ['--input-type=module', '-e', command], {
    cwd, env: { ...env, ...values }, encoding: 'utf8',
  });
  const good = run({});
  assert.equal(good.status, 0, good.stderr);
  assert.deepEqual(JSON.parse(good.stdout), { origin: ['https://avisosur.example'], secure: true, proxy: 1 });
  const missing = run({ DB_PASSWORD: '' });
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /Faltan variables de producción: DB_PASSWORD/);
  const insecure = run({ APP_ORIGIN: 'http://avisosur.example' });
  assert.notEqual(insecure.status, 0);
  assert.match(insecure.stderr, /APP_ORIGIN debe ser el origen HTTPS/);
  assert.doesNotMatch(missing.stderr + insecure.stderr, /SoloEsUnaVariableDePrueba/);
  assert.equal(run({ DB_CLIENT: 'sqlite', DB_PASSWORD: '' }).status, 0, 'Se conserva la alternativa SQLite.');
});
