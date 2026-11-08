import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { openDatabase } from '../src/database.mjs';
import { getCatalog, getListing } from '../src/listings.mjs';
import { TEST_PASSWORD } from './support.mjs';

// Esquema exacto anterior a moderación: estado activo/baja y como máximo tres fotos.
const legacySchema = `
  PRAGMA foreign_keys = ON;
  CREATE TABLE usuarios (id INTEGER PRIMARY KEY, correo TEXT NOT NULL UNIQUE COLLATE NOCASE, celular TEXT NOT NULL UNIQUE CHECK(length(celular) = 9), password_hash TEXT NOT NULL, es_demo INTEGER NOT NULL DEFAULT 0, fecha_registro TEXT NOT NULL);
  CREATE TABLE categorias (id INTEGER PRIMARY KEY, nombre TEXT NOT NULL UNIQUE, subcategorias TEXT NOT NULL DEFAULT '[]', activa INTEGER NOT NULL DEFAULT 1 CHECK(activa IN (0, 1)));
  CREATE TABLE anuncios (id INTEGER PRIMARY KEY, usuario_id INTEGER NOT NULL REFERENCES usuarios(id), titulo TEXT NOT NULL, descripcion TEXT NOT NULL, precio_centimos INTEGER NOT NULL CHECK(precio_centimos > 0), zona TEXT NOT NULL, categoria_id INTEGER NOT NULL REFERENCES categorias(id), subcategoria TEXT NOT NULL DEFAULT '', estado TEXT NOT NULL DEFAULT 'activo' CHECK(estado IN ('activo', 'dado_de_baja')), es_demo INTEGER NOT NULL DEFAULT 0, fecha_publicacion TEXT NOT NULL);
  CREATE TABLE fotos (id INTEGER PRIMARY KEY, anuncio_id INTEGER NOT NULL REFERENCES anuncios(id), archivo TEXT NOT NULL, orden INTEGER NOT NULL CHECK(orden >= 0 AND orden < 3), fecha_subida TEXT NOT NULL, UNIQUE(anuncio_id, orden));
  CREATE TABLE reportes (id INTEGER PRIMARY KEY, anuncio_id INTEGER NOT NULL REFERENCES anuncios(id), usuario_id INTEGER NOT NULL REFERENCES usuarios(id), motivo TEXT NOT NULL, fecha TEXT NOT NULL, estado TEXT NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente', 'revisado')));
  CREATE TABLE sesiones (token_hash TEXT PRIMARY KEY, usuario_id INTEGER NOT NULL REFERENCES usuarios(id), expira TEXT NOT NULL);
  CREATE TABLE metadata (clave TEXT PRIMARY KEY, valor TEXT NOT NULL);
  CREATE INDEX idx_catalogo ON anuncios(estado, categoria_id, precio_centimos);
  CREATE INDEX idx_zona_fecha ON anuncios(estado, zona, fecha_publicacion DESC);
  CREATE INDEX idx_usuario ON anuncios(usuario_id, fecha_publicacion DESC);
  CREATE INDEX idx_sesiones_expira ON sesiones(expira);
`;

test('La migración SQLite conserva datos, relaciones y sesiones; aplica revisión y permite siete fotos', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'avisosur-legacy-migration-'));
  const databasePath = path.join(directory, 'legacy.sqlite');
  const config = { databaseClient: 'sqlite', databasePath, seed: false };
  let database;
  t.after(async () => {
    await database?.close();
    const resolved = path.resolve(directory);
    assert(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep + 'avisosur-legacy-migration-'));
    await fs.rm(resolved, { recursive: true, force: true });
  });
  const original = new DatabaseSync(databasePath);
  original.exec(legacySchema);
  const hash = await bcrypt.hash(TEST_PASSWORD, 4);
  const instant = '2026-10-01T12:30:00.000Z';
  original.prepare('INSERT INTO usuarios VALUES (?, ?, ?, ?, ?, ?)').run(7, 'demo-legado@avisosur-test.local', '900000007', hash, 1, instant);
  original.prepare('INSERT INTO usuarios VALUES (?, ?, ?, ?, ?, ?)').run(8, 'usuario-legado@avisosur-test.local', '900000008', hash, 0, instant);
  original.prepare('INSERT INTO categorias VALUES (?, ?, ?, ?)').run(1, 'Vehículos', '["Motos"]', 1);
  const insert = original.prepare('INSERT INTO anuncios VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  insert.run(41, 7, 'Moto del sistema anterior', 'Conserva descripción, precio e identificación DEMO.', 500000, 'Puno', 1, 'Motos', 'activo', 1, instant);
  insert.run(42, 8, 'Anuncio anterior dado de baja', 'No debe reactivarse durante la migración.', 100, 'Juliaca', 1, 'Motos', 'dado_de_baja', 0, instant);
  // Un aviso DEMO del seed que es alquiler y un aviso real con el mismo título que no debe cambiar.
  insert.run(43, 7, 'Habitación cerca de la UNA Puno', 'Alquiler mensual de ejemplo.', 28000, 'Puno', 1, 'Motos', 'activo', 1, instant);
  insert.run(44, 8, 'Habitación cerca de la UNA Puno', 'Aviso real con el mismo título.', 30000, 'Puno', 1, 'Motos', 'activo', 0, instant);
  original.prepare('INSERT INTO fotos VALUES (?, ?, ?, ?, ?)').run(51, 41, '/uploads/foto-anterior.webp', 0, instant);
  original.prepare('INSERT INTO fotos VALUES (?, ?, ?, ?, ?)').run(52, 42, '/uploads/foto-baja-anterior.webp', 0, instant);
  original.prepare('INSERT INTO reportes VALUES (?, ?, ?, ?, ?, ?)').run(61, 41, 8, 'Reporte conservado de la versión anterior', instant, 'pendiente');
  const tokenHash = createHash('sha256').update('token-exclusivo-de-la-prueba').digest('hex');
  const expiration = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  original.prepare('INSERT INTO sesiones VALUES (?, ?, ?)').run(tokenHash, 7, expiration);
  original.prepare('INSERT INTO metadata VALUES (?, ?)').run('seed_v1', '1');
  original.prepare('INSERT INTO metadata VALUES (?, ?)').run('dato_preexistente', 'conservar exactamente');
  original.close();

  database = await openDatabase(config);
  const migrated = await database.get('SELECT * FROM anuncios WHERE id = ?', 41);
  assert.equal((await database.get('SELECT COUNT(*) AS n FROM anuncios')).n, 4);
  assert.equal(migrated.tipo_operacion, 'venta', 'Los avisos anteriores quedan como venta.');
  assert.equal((await database.get('SELECT tipo_operacion FROM anuncios WHERE id = 43')).tipo_operacion, 'alquiler');
  assert.equal((await database.get('SELECT tipo_operacion FROM anuncios WHERE id = 44')).tipo_operacion, 'venta', 'La corrección solo toca avisos DEMO.');
  assert.equal((await database.get('SELECT COUNT(*) AS n FROM usuarios')).n, 2);
  assert.equal(migrated.usuario_id, 7); assert.equal(migrated.titulo, 'Moto del sistema anterior');
  assert.equal(migrated.precio_centimos, 500000); assert.equal(migrated.es_demo, 1); assert.equal(migrated.fecha_publicacion, instant);
  assert.equal(migrated.estado, 'activo'); assert.equal(migrated.moderacion, 'pendiente'); assert.equal(migrated.plan_id, 1);
  assert.equal(migrated.fecha_aprobacion, null); assert.equal(migrated.fecha_vencimiento, null);
  assert.equal((await database.get('SELECT estado FROM anuncios WHERE id = ?', 42)).estado, 'dado_de_baja');
  assert.equal((await database.get('SELECT rol FROM usuarios WHERE id = ?', 7)).rol, 'usuario');
  assert.equal((await database.get('SELECT rol FROM usuarios WHERE id = ?', 8)).rol, 'usuario');
  assert.equal((await database.get('SELECT nombre FROM usuarios WHERE id = ?', 8)).nombre, '', 'Las cuentas anteriores reciben un nombre vacío, no su correo.');
  assert.equal((await database.get('SELECT celular_verificado FROM usuarios WHERE id = ?', 8)).celular_verificado, 0, 'Las cuentas anteriores empiezan sin verificar.');
  assert.equal((await database.get('SELECT COUNT(*) AS n FROM verificaciones_celular')).n, 0, 'La migración no inventa solicitudes de verificación.');
  assert.equal((await database.get('SELECT password_hash FROM usuarios WHERE id = ?', 7)).password_hash, hash);
  assert.deepEqual((await database.all('SELECT id, anuncio_id, archivo, orden, fecha_subida FROM fotos ORDER BY id')).map(row => ({ ...row })), [
    { id: 51, anuncio_id: 41, archivo: '/uploads/foto-anterior.webp', orden: 0, fecha_subida: instant },
    { id: 52, anuncio_id: 42, archivo: '/uploads/foto-baja-anterior.webp', orden: 0, fecha_subida: instant },
  ]);
  assert.equal((await database.get('SELECT anuncio_id, usuario_id FROM reportes WHERE id = ?', 61)).anuncio_id, 41);
  assert.equal((await database.get('SELECT usuario_id, expira FROM sesiones WHERE token_hash = ?', tokenHash)).expira, expiration);
  assert.equal((await database.get('SELECT valor FROM metadata WHERE clave = ?', 'dato_preexistente')).valor, 'conservar exactamente');
  assert.deepEqual(await database.all('PRAGMA foreign_key_check'), []);
  assert.equal((await getCatalog(database, {})).total, 0);
  await assert.rejects(getListing(database, 41), error => error.status === 404);
  const owner = await getListing(database, 41, { id: 7, rol: 'usuario' });
  assert.equal(owner.demo, true); assert.equal(owner.fotos[0].archivo, '/uploads/foto-anterior.webp');

  for (let order = 1; order < 7; order += 1) {
    await database.run('INSERT INTO fotos (anuncio_id, archivo, orden, fecha_subida) VALUES (?, ?, ?, ?)', 41, '/uploads/nueva-' + order + '.webp', order, instant);
  }
  assert.equal((await database.get('SELECT COUNT(*) AS n FROM fotos WHERE anuncio_id = ?', 41)).n, 7);
  await assert.rejects(database.run('INSERT INTO fotos (anuncio_id, archivo, orden, fecha_subida) VALUES (?, ?, ?, ?)', 41, '/uploads/octava.webp', 7, instant), /CHECK|constraint/i);

  const snapshot = await database.all('SELECT * FROM anuncios ORDER BY id');
  const roles = await database.all('SELECT id, rol FROM usuarios ORDER BY id');
  const photos = await database.all('SELECT * FROM fotos ORDER BY id');
  await database.close(); database = null;
  database = await openDatabase(config);
  assert.deepEqual(await database.all('SELECT * FROM anuncios ORDER BY id'), snapshot, 'Reabrir la aplicación no reinicia estados, planes ni fechas.');
  assert.deepEqual(await database.all('SELECT id, rol FROM usuarios ORDER BY id'), roles);
  assert.deepEqual(await database.all('SELECT * FROM fotos ORDER BY id'), photos);
  assert.equal((await database.get('SELECT COUNT(*) AS n FROM sesiones WHERE token_hash = ?', tokenHash)).n, 1);
  assert.deepEqual(await database.all('PRAGMA foreign_key_check'), []);
});
