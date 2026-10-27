import { ApiError, parseFilters } from './validation.mjs';

const listingSelect = `SELECT a.*, c.nombre AS categoria,
  (SELECT archivo FROM fotos WHERE anuncio_id = a.id ORDER BY orden LIMIT 1) AS imagen
  FROM anuncios a JOIN categorias c ON c.id = a.categoria_id`;

export function serializeListing(row) {
  return { id: row.id, usuarioId: row.usuario_id, titulo: row.titulo, descripcion: row.descripcion, precio: row.precio === undefined ? row.precio_centimos / 100 : Number(row.precio), zona: row.zona, categoriaId: row.categoria_id, categoria: row.categoria, subcategoria: row.subcategoria, estado: row.estado, fechaPublicacion: row.fecha_publicacion, imagen: row.imagen, demo: Boolean(row.es_demo) };
}

export async function getCatalog(db, query) {
  const filters = parseFilters(query);
  const conditions = ["a.estado = 'activo'", 'c.activa = 1'];
  const values = [];
  if (filters.q) {
    if (db.kind === 'mysql') {
      conditions.push("LOCATE(?, CONCAT(a.titulo, ' ', a.descripcion)) > 0");
      values.push(filters.q);
    } else {
      conditions.push("normalizar(a.titulo || ' ' || a.descripcion) LIKE ? ESCAPE '\\'");
      values.push('%' + filters.q.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[\\%_]/g, '\\$&') + '%');
    }
  }
  if (filters.categoriaId) { conditions.push('a.categoria_id = ?'); values.push(filters.categoriaId); }
  if (filters.subcategoria) { conditions.push('a.subcategoria = ?'); values.push(filters.subcategoria); }
  if (filters.zona) { conditions.push('a.zona = ?'); values.push(filters.zona); }
  const priceColumn = db.kind === 'mysql' ? 'a.precio' : 'a.precio_centimos';
  if (filters.min !== undefined) { conditions.push(priceColumn + ' >= ?'); values.push(db.kind === 'mysql' ? (filters.min / 100).toFixed(2) : filters.min); }
  if (filters.max !== undefined) { conditions.push(priceColumn + ' <= ?'); values.push(db.kind === 'mysql' ? (filters.max / 100).toFixed(2) : filters.max); }
  const where = ' WHERE ' + conditions.join(' AND ');
  const order = { recent: 'a.fecha_publicacion DESC, a.id DESC', price_asc: priceColumn + ' ASC, a.id DESC', price_desc: priceColumn + ' DESC, a.id DESC' }[filters.sort];
  const total = (await db.get('SELECT COUNT(*) AS total FROM anuncios a JOIN categorias c ON c.id = a.categoria_id' + where, ...values)).total;
  const rows = await db.all(listingSelect + where + ' ORDER BY ' + order + ' LIMIT ? OFFSET ?', ...values, filters.limit, (filters.page - 1) * filters.limit);
  return { anuncios: rows.map(serializeListing), total, page: filters.page, totalPages: Math.ceil(total / filters.limit) };
}

export async function getListing(db, id, user) {
  const row = await db.get(listingSelect + ' WHERE a.id = ?', id);
  if (!row || (row.estado !== 'activo' && row.usuario_id !== user?.id)) throw new ApiError(404, 'Este anuncio no está disponible.');
  const seller = await db.get('SELECT id, correo, celular, fecha_registro, es_demo FROM usuarios WHERE id = ?', row.usuario_id);
  const vendedor = { id: seller.id, nombre: seller.es_demo ? 'Vendedor de demostración' : seller.correo.split('@')[0], celular: seller.celular, fechaRegistro: seller.fecha_registro, demo: Boolean(seller.es_demo) };
  const mensaje = 'Hola, vi tu anuncio de ' + row.titulo + ' en AvisoSur y quisiera saber si todavía está disponible';
  return { ...serializeListing(row), fotos: await db.all('SELECT id, archivo, orden FROM fotos WHERE anuncio_id = ? ORDER BY orden', row.id), vendedor, whatsappUrl: 'https://wa.me/51' + vendedor.celular + '?text=' + encodeURIComponent(mensaje) };
}

export async function getOwnListings(db, userId) {
  return (await db.all(listingSelect + ' WHERE a.usuario_id = ? ORDER BY a.fecha_publicacion DESC, a.id DESC', userId)).map(serializeListing);
}
