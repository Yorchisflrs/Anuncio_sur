import { DatabaseSync } from 'node:sqlite';
import { defaultConfig } from '../backend/src/config.mjs';
import { openMysqlDatabase } from '../backend/src/mysql.mjs';

if (defaultConfig.databaseClient !== 'mysql') {
  throw new Error('Configura DB_CLIENT=mysql en .env antes de importar los datos.');
}

const sqlite = new DatabaseSync(defaultConfig.databasePath, { readOnly: true });
const mysql = await openMysqlDatabase(defaultConfig);
const counts = {};
const read = table => sqlite.prepare(`SELECT * FROM ${table} ORDER BY id`).all();

// Mantiene los ID originales cuando estén libres; si ya hay datos en MySQL,
// reasigna el ID y traduce todas las relaciones dependientes.
async function availableId(tx, table, id) {
  return await tx.get(`SELECT id FROM ${table} WHERE id = ?`, id) ? null : id;
}

async function insert(tx, table, values, oldId) {
  const id = await availableId(tx, table, oldId);
  const fields = [...(id === null ? [] : ['id']), ...Object.keys(values)];
  const parameters = [...(id === null ? [] : [id]), ...Object.values(values)];
  const result = await tx.run(`INSERT INTO ${table} (${fields.join(', ')}) VALUES (${fields.map(() => '?').join(', ')})`, ...parameters);
  return id ?? Number(result.lastInsertRowid);
}

try {
  await mysql.transaction(async tx => {
    const categories = new Map();
    counts.categorias = 0;
    for (const row of read('categorias')) {
      const existing = await tx.get('SELECT id FROM categorias WHERE nombre = ?', row.nombre);
      const id = existing?.id ?? await insert(tx, 'categorias', { nombre: row.nombre, subcategorias: row.subcategorias, activa: row.activa }, row.id);
      if (!existing) counts.categorias++;
      categories.set(row.id, id);
    }

    const users = new Map();
    counts.usuarios = 0;
    for (const row of read('usuarios')) {
      if (!/^\$2[aby]\$\d\d\$/.test(row.password_hash)) throw new Error(`El usuario ${row.id} no tiene un hash bcrypt compatible.`);
      const existing = await tx.get('SELECT id, correo FROM usuarios WHERE correo = ? OR celular = ?', row.correo, row.celular);
      if (existing && existing.correo !== row.correo) throw new Error(`El celular del usuario ${row.id} ya pertenece a otro correo en MySQL.`);
      const id = existing?.id ?? await insert(tx, 'usuarios', { correo: row.correo, celular: row.celular, password_hash: row.password_hash, es_demo: row.es_demo, fecha_registro: row.fecha_registro }, row.id);
      if (!existing) counts.usuarios++;
      users.set(row.id, id);
    }

    const listings = new Map();
    counts.anuncios = 0;
    for (const row of read('anuncios')) {
      const userId = users.get(row.usuario_id);
      const existing = row.es_demo
        ? await tx.get('SELECT id FROM anuncios WHERE usuario_id = ? AND titulo = ? AND es_demo = 1', userId, row.titulo)
        : await tx.get('SELECT id FROM anuncios WHERE usuario_id = ? AND titulo = ? AND fecha_publicacion = ?', userId, row.titulo, row.fecha_publicacion);
      const id = existing?.id ?? await insert(tx, 'anuncios', {
        usuario_id: userId, categoria_id: categories.get(row.categoria_id), titulo: row.titulo,
        descripcion: row.descripcion, precio: (row.precio_centimos / 100).toFixed(2), zona: row.zona,
        subcategoria: row.subcategoria, estado: row.estado, es_demo: row.es_demo,
        fecha_publicacion: row.fecha_publicacion,
      }, row.id);
      if (!existing) counts.anuncios++;
      listings.set(row.id, id);
    }

    counts.fotos = 0;
    for (const row of read('fotos')) {
      const anuncioId = listings.get(row.anuncio_id);
      const existing = await tx.get('SELECT id, archivo FROM fotos WHERE anuncio_id = ? AND orden = ?', anuncioId, row.orden);
      if (existing && existing.archivo !== row.archivo) throw new Error(`La foto ${row.id} entra en conflicto con una foto MySQL de otro archivo.`);
      if (!existing) {
        await insert(tx, 'fotos', { anuncio_id: anuncioId, archivo: row.archivo, orden: row.orden, fecha_subida: row.fecha_subida }, row.id);
        counts.fotos++;
      }
    }

    counts.reportes = 0;
    for (const row of read('reportes')) {
      const anuncioId = listings.get(row.anuncio_id);
      const usuarioId = users.get(row.usuario_id);
      const existing = await tx.get('SELECT id FROM reportes WHERE anuncio_id = ? AND usuario_id = ? AND motivo = ? AND fecha = ?', anuncioId, usuarioId, row.motivo, row.fecha);
      if (!existing) {
        await insert(tx, 'reportes', { anuncio_id: anuncioId, usuario_id: usuarioId, motivo: row.motivo, fecha: row.fecha, estado: row.estado }, row.id);
        counts.reportes++;
      }
    }

    counts.sesiones = 0;
    for (const row of sqlite.prepare('SELECT * FROM sesiones').all()) {
      if (await tx.get('SELECT token_hash FROM sesiones WHERE token_hash = ?', row.token_hash)) continue;
      await tx.run('INSERT INTO sesiones (token_hash, usuario_id, expira) VALUES (?, ?, ?)', row.token_hash, users.get(row.usuario_id), row.expira);
      counts.sesiones++;
    }
    counts.metadata = 0;
    for (const row of sqlite.prepare('SELECT * FROM metadata').all()) {
      if (await tx.get('SELECT clave FROM metadata WHERE clave = ?', row.clave)) continue;
      await tx.run('INSERT INTO metadata (clave, valor) VALUES (?, ?)', row.clave, row.valor);
      counts.metadata++;
    }
  });
  console.log('Importación completada sin duplicados:', counts);
} finally {
  sqlite.close();
  await mysql.close();
}
