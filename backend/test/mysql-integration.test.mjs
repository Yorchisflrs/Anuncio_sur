import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID, createHash } from 'node:crypto';
import { once } from 'node:events';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.mjs';
import { defaultConfig } from '../src/config.mjs';
import { TEST_PASSWORD, jsonRequest, testPicture } from './support.mjs';

const enabled = process.env.AVISOSUR_TEST_MYSQL === '1';
const safeTestDatabase = /^avisosur_test_[a-f0-9]{32}$/;

test('MySQL/MariaDB temporal: migración legado, moderación, siete fotos y vigencia', {
  skip: enabled ? false : 'Activar expresamente con AVISOSUR_TEST_MYSQL=1; no se conecta a MySQL por defecto.',
}, async t => {
  // El nombre de la aplicación real nunca se utiliza: no se lee DB_NAME aquí.
  const databaseName = 'avisosur_test_' + randomUUID().replaceAll('-', '');
  assert(safeTestDatabase.test(databaseName));
  assert.notEqual(databaseName, 'avisosur_db');
  const serverConfig = {
    host: defaultConfig.dbHost, port: defaultConfig.dbPort,
    user: defaultConfig.dbUser, password: defaultConfig.dbPassword,
    charset: 'utf8mb4',
  };
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'avisosur-mysql-test-'));
  const settings = {
    databaseClient: 'mysql', dbHost: serverConfig.host, dbPort: serverConfig.port,
    dbUser: serverConfig.user, dbPassword: serverConfig.password, dbName: databaseName,
    uploadDir: path.join(temporary, 'uploads'), privateUploadDir: path.join(temporary, 'private'),
    frontendDist: path.join(temporary, 'no-frontend'), secureCookie: false, seed: false,
  };
  let created = false;
  let fixtureConnection;
  let context;
  let server;
  let base;
  t.after(async () => {
    if (server?.listening) await new Promise(resolve => server.close(resolve));
    await context?.db.close();
    await fixtureConnection?.end();
    // Sólo se elimina la base aleatoria que esta misma prueba consiguió crear.
    if (created) {
      assert(safeTestDatabase.test(databaseName));
      assert.equal(settings.dbName, databaseName);
      assert.notEqual(databaseName, 'avisosur_db');
      const cleanup = await mysql.createConnection(serverConfig); // Sin base predeterminada.
      try { await cleanup.query('DROP DATABASE `' + databaseName + '`'); }
      finally { await cleanup.end(); }
    }
    const resolved = path.resolve(temporary);
    assert(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep + 'avisosur-mysql-test-'));
    await fs.rm(resolved, { recursive: true, force: true });
  });
  const creator = await mysql.createConnection(serverConfig); // No selecciona el esquema real.
  try {
    await creator.query('CREATE DATABASE `' + databaseName + '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    created = true;
  } finally { await creator.end(); }
  const legacySql = await fs.readFile(new URL('./fixtures/legacy-mysql.sql', import.meta.url), 'utf8');
  const executableSql = legacySql.replace(/^\s*--.*$/gm, '');
  assert(!/\b(?:USE|CREATE\s+DATABASE|DROP\s+DATABASE)\b/i.test(executableSql));
  fixtureConnection = await mysql.createConnection({ ...serverConfig, database: databaseName, multipleStatements: true });
  await fixtureConnection.query(executableSql);
  const hash = await bcrypt.hash(TEST_PASSWORD, 4);
  const date = '2026-10-01 12:30:00.000';
  await fixtureConnection.execute('INSERT INTO usuarios (id,correo,celular,password_hash,es_demo,fecha_registro) VALUES (7,?,?,?,?,?),(8,?,?,?,?,?)', ['demo-legado@avisosur-test.local', '900000007', hash, 1, date, 'admin-legado@avisosur-test.local', '900000008', hash, 0, date]);
  await fixtureConnection.execute('INSERT INTO categorias (id,nombre,subcategorias) VALUES (1,?,?)', ['Vehículos', '["Motos"]']);
  await fixtureConnection.execute('INSERT INTO anuncios (id,usuario_id,categoria_id,titulo,descripcion,precio,zona,subcategoria,estado,es_demo,fecha_publicacion) VALUES (41,7,1,?,?,5000,?,?,?,1,?),(42,8,1,?,?,1,?,?,?,0,?)', ['Moto del sistema anterior', 'Descripción conservada después de migrar.', 'Puno', 'Motos', 'activo', date, 'Anuncio anterior dado de baja', 'Conserva su baja y precio.', 'Juliaca', 'Motos', 'dado_de_baja', date]);
  await fixtureConnection.execute('INSERT INTO fotos (id,anuncio_id,archivo,orden,fecha_subida) VALUES (51,41,?,0,?),(52,42,?,0,?)', ['/uploads/foto-anterior.webp', date, '/uploads/foto-baja-anterior.webp', date]);
  await fixtureConnection.execute('INSERT INTO reportes (id,anuncio_id,usuario_id,motivo,fecha) VALUES (61,41,8,?,?)', ['Reporte conservado', date]);
  const tokenHash = createHash('sha256').update('token-mysql-exclusivo-de-prueba').digest('hex');
  await fixtureConnection.execute('INSERT INTO sesiones (token_hash,usuario_id,expira) VALUES (?,7,?)', [tokenHash, new Date(Date.now() + 86400000).toISOString().slice(0, -1).replace('T', ' ')]);
  await fixtureConnection.execute('INSERT INTO metadata (clave,valor) VALUES (?,?)', ['dato_preexistente', 'conservar exactamente']);
  await fixtureConnection.end(); fixtureConnection = null;

  context = await createApp(settings);
  const legacy = await context.db.get('SELECT * FROM anuncios WHERE id = ?', 41);
  assert.equal(Number(legacy.precio), 5000); assert.equal(legacy.estado, 'activo'); assert.equal(legacy.moderacion, 'pendiente');
  assert.equal(legacy.es_demo, 1); assert.equal(legacy.plan_id, 1); assert.equal(legacy.fecha_aprobacion, null);
  assert.equal((await context.db.get('SELECT estado FROM anuncios WHERE id = ?', 42)).estado, 'dado_de_baja');
  assert.equal((await context.db.get('SELECT rol FROM usuarios WHERE id = ?', 7)).rol, 'usuario');
  assert.equal((await context.db.get('SELECT COUNT(*) AS n FROM sesiones WHERE token_hash = ?', tokenHash)).n, 1);
  assert.equal((await context.db.get('SELECT anuncio_id FROM reportes WHERE id = ?', 61)).anuncio_id, 41);
  assert.equal((await context.db.get('SELECT valor FROM metadata WHERE clave = ?', 'dato_preexistente')).valor, 'conservar exactamente');
  await context.db.run("UPDATE usuarios SET rol = 'admin' WHERE id = ?", 8);
  server = context.app.listen(0, '127.0.0.1'); await once(server, 'listening');
  base = 'http://127.0.0.1:' + server.address().port;
  const request = async (endpoint, options = {}) => { const response = await fetch(base + '/api' + endpoint, options); return { response, body: await response.json() }; };
  assert.equal((await request('/anuncios')).body.total, 0);
  const login = async correo => {
    const result = await request('/auth/login', jsonRequest({ identificador: correo, password: TEST_PASSWORD }));
    assert.equal(result.response.status, 200, JSON.stringify(result.body));
    return result.response.headers.get('set-cookie').split(';')[0];
  };
  const ownerCookie = await login('demo-legado@avisosur-test.local');
  const adminCookie = await login('admin-legado@avisosur-test.local');
  assert.equal((await request('/anuncios/41')).response.status, 404);
  const approve = id => request('/admin/anuncios/' + id + '/aprobar', jsonRequest({ confirmarPago: true, referenciaPago: 'Pago ficticio en base MySQL temporal' }, adminCookie));
  const initialApproval = await approve(41);
  assert.equal(initialApproval.response.status, 200, JSON.stringify(initialApproval.body));
  assert.equal(initialApproval.body.moderacion, 'aprobado'); assert(initialApproval.body.fechaAprobacion.endsWith('Z'));
  assert.equal(Date.parse(initialApproval.body.fechaVencimiento) - Date.parse(initialApproval.body.fechaAprobacion), 7 * 86400000);
  assert.equal((await request('/anuncios')).body.total, 1);

  const form = new FormData();
  for (const [key, value] of Object.entries({ titulo: 'Siete fotos en MySQL temporal', descripcion: 'Prueba aislada de migración del límite de fotografías.', categoriaId: '1', subcategoria: 'Motos', precio: '150.25', zona: 'Puno', planId: '1' })) form.append(key, value);
  for (let index = 0; index < 7; index += 1) form.append('fotos', new Blob([await testPicture()], { type: 'image/png' }), 'foto-' + index + '.png');
  const publication = await request('/anuncios', { method: 'POST', headers: { Cookie: ownerCookie }, body: form });
  assert.equal(publication.response.status, 201, JSON.stringify(publication.body));
  assert.equal(publication.body.fotos.length, 7); assert.equal(publication.body.precio, 150.25); assert.equal(publication.body.moderacion, 'pendiente');
  assert.equal((await request('/anuncios/' + publication.body.id)).response.status, 404);
  await assert.rejects(context.db.run('INSERT INTO fotos (anuncio_id,archivo,orden,fecha_subida) VALUES (?,?,?,?)', publication.body.id, '/uploads/octava.webp', 7, new Date().toISOString()), /constraint|check/i);
  const proof = new FormData(); proof.append('comprobante', new Blob([await testPicture()], { type: 'image/png' }), 'pago.png');
  assert.equal((await request('/anuncios/' + publication.body.id + '/comprobante', { method: 'POST', headers: { Cookie: ownerCookie }, body: proof })).response.status, 200);
  const privateImage = await fetch(base + '/api/anuncios/' + publication.body.id + '/comprobante', { headers: { Cookie: adminCookie } });
  assert.equal(privateImage.status, 200); assert.match(privateImage.headers.get('content-type'), /^image\//);
  assert.equal((await fetch(base + '/api/anuncios/' + publication.body.id + '/comprobante')).status, 401);
  const approvals = await Promise.all([approve(publication.body.id), approve(publication.body.id)]);
  approvals.forEach(result => assert.equal(result.response.status, 200, JSON.stringify(result.body)));
  assert.equal(approvals[0].body.fechaAprobacion, approvals[1].body.fechaAprobacion);
  assert.equal(approvals[0].body.fechaVencimiento, approvals[1].body.fechaVencimiento);
  assert.equal((await request('/anuncios')).body.total, 2);
  await context.db.run('UPDATE anuncios SET fecha_vencimiento = ? WHERE id = ?', new Date(Date.now() - 86400000).toISOString(), publication.body.id);
  assert.equal((await request('/anuncios')).body.total, 1);
  assert.equal((await request('/anuncios/' + publication.body.id)).response.status, 404);
  assert.equal((await request('/anuncios/' + publication.body.id, { headers: { Cookie: ownerCookie } })).response.status, 200);

  const before = await context.db.all('SELECT * FROM anuncios ORDER BY id');
  await new Promise(resolve => server.close(resolve)); server = null;
  await context.db.close(); context = null;
  context = await createApp(settings);
  assert.deepEqual(await context.db.all('SELECT * FROM anuncios ORDER BY id'), before);
  assert.equal((await context.db.get('SELECT rol FROM usuarios WHERE id = ?', 8)).rol, 'admin');
  assert.equal((await context.db.get('SELECT COUNT(*) AS n FROM fotos WHERE anuncio_id = ?', publication.body.id)).n, 7);
});
