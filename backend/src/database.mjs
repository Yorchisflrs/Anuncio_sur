import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { seedDatabase } from './seed.mjs';
import { openMysqlDatabase } from './mysql.mjs';

export async function openDatabase(config) {
  if (config.databaseClient === 'mysql') return openMysqlDatabase(config);
  const databasePath = config.databasePath;
  if (databasePath !== ':memory:') fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath);
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY,
      correo TEXT NOT NULL UNIQUE COLLATE NOCASE,
      celular TEXT NOT NULL UNIQUE CHECK(length(celular) = 9),
      password_hash TEXT NOT NULL,
      es_demo INTEGER NOT NULL DEFAULT 0,
      fecha_registro TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS categorias (
      id INTEGER PRIMARY KEY,
      nombre TEXT NOT NULL UNIQUE,
      subcategorias TEXT NOT NULL DEFAULT '[]',
      activa INTEGER NOT NULL DEFAULT 1 CHECK(activa IN (0, 1))
    );
    CREATE TABLE IF NOT EXISTS anuncios (
      id INTEGER PRIMARY KEY,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
      titulo TEXT NOT NULL,
      descripcion TEXT NOT NULL,
      precio_centimos INTEGER NOT NULL CHECK(precio_centimos > 0),
      zona TEXT NOT NULL,
      categoria_id INTEGER NOT NULL REFERENCES categorias(id),
      subcategoria TEXT NOT NULL DEFAULT '',
      estado TEXT NOT NULL DEFAULT 'activo' CHECK(estado IN ('activo', 'dado_de_baja')),
      es_demo INTEGER NOT NULL DEFAULT 0,
      fecha_publicacion TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS fotos (
      id INTEGER PRIMARY KEY,
      anuncio_id INTEGER NOT NULL REFERENCES anuncios(id),
      archivo TEXT NOT NULL,
      orden INTEGER NOT NULL CHECK(orden >= 0 AND orden < 3),
      fecha_subida TEXT NOT NULL,
      UNIQUE(anuncio_id, orden)
    );
    CREATE TABLE IF NOT EXISTS reportes (
      id INTEGER PRIMARY KEY,
      anuncio_id INTEGER NOT NULL REFERENCES anuncios(id),
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
      motivo TEXT NOT NULL,
      fecha TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente', 'revisado'))
    );
    CREATE TABLE IF NOT EXISTS sesiones (
      token_hash TEXT PRIMARY KEY,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
      expira TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS metadata (clave TEXT PRIMARY KEY, valor TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_catalogo ON anuncios(estado, categoria_id, precio_centimos);
    CREATE INDEX IF NOT EXISTS idx_zona_fecha ON anuncios(estado, zona, fecha_publicacion DESC);
    CREATE INDEX IF NOT EXISTS idx_usuario ON anuncios(usuario_id, fecha_publicacion DESC);
    CREATE INDEX IF NOT EXISTS idx_sesiones_expira ON sesiones(expira);
  `);
  db.function('normalizar', { deterministic: true }, value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase());
  db.prepare('DELETE FROM sesiones WHERE expira <= ?').run(new Date().toISOString());
  if (config.seed !== false) await seedDatabase(db);
  return {
    kind: 'sqlite',
    prepare: sql => db.prepare(sql), // Disponible para las pruebas existentes.
    get: async (sql, ...values) => db.prepare(sql).get(...values),
    all: async (sql, ...values) => db.prepare(sql).all(...values),
    run: async (sql, ...values) => db.prepare(sql).run(...values),
    async transaction(work) {
      db.exec('BEGIN');
      try {
        const result = await work(this);
        db.exec('COMMIT');
        return result;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    close: () => db.close(),
  };
}
