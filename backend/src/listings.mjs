import { ApiError, parseFilters } from './validation.mjs';

export const listingSelect = `SELECT a.*, c.nombre AS categoria, c.activa AS categoria_activa,
  (SELECT archivo FROM fotos WHERE anuncio_id = a.id ORDER BY orden LIMIT 1) AS imagen,
  (SELECT celular_verificado FROM usuarios WHERE id = a.usuario_id) AS vendedor_verificado
  FROM anuncios a JOIN categorias c ON c.id = a.categoria_id`;

/** El celular de contacto solo viaja en vistas privadas (propietario y administración). */
export function serializeListing(row, { privado = false } = {}) {
  return { id: row.id, usuarioId: row.usuario_id, titulo: row.titulo, descripcion: row.descripcion, precio: row.precio === undefined ? row.precio_centimos / 100 : Number(row.precio), zona: row.zona, categoriaId: row.categoria_id, categoria: row.categoria, subcategoria: row.subcategoria, tipoOperacion: row.tipo_operacion === 'alquiler' ? 'alquiler' : 'venta', estado: row.estado, fechaPublicacion: row.fecha_publicacion, imagen: row.imagen, demo: Boolean(row.es_demo),
    moderacion: row.moderacion, estadoPago: row.estado_pago, fechaAprobacion: row.fecha_aprobacion || null, fechaVencimiento: row.fecha_vencimiento || null,
    diasVigencia: Number(row.dias_vigencia), diasPromocion: Number(row.dias_promocion), montoPublicacion: row.monto_publicacion_centimos / 100,
    planId: row.plan_id, destacado: Boolean(row.destacado), motivoRevision: row.motivo_revision || '', direccion: row.direccion || '', referencia: row.referencia || '',
    vendedorVerificado: Boolean(Number(row.vendedor_verificado)), revisionReportes: Boolean(Number(row.revision_reportes)),
    ...(privado ? { contacto: row.contacto || '' } : {}),
  };
}

// Un aviso con tres reportes de cuentas verificadas queda oculto (revision_reportes = 1) hasta que lo revise administración.
export const publicCondition = (alias = 'a') => `${alias}.estado = 'activo' AND ${alias}.moderacion = 'aprobado' AND ${alias}.estado_pago = 'confirmado' AND ${alias}.fecha_aprobacion IS NOT NULL AND ${alias}.fecha_vencimiento > ? AND ${alias}.revision_reportes = 0`;
/** La misma regla que publicCondition, aplicada a una fila ya leída. */
export const isPublicRow = row => Boolean(row && row.estado === 'activo' && row.moderacion === 'aprobado' && row.estado_pago === 'confirmado' && row.fecha_aprobacion && Date.parse(row.fecha_vencimiento) > Date.now() && row.categoria_activa && !Number(row.revision_reportes));

export async function getCatalog(db, query) {
  const filters = parseFilters(query);
  const conditions = [publicCondition(), 'c.activa = 1'];
  const values = [new Date().toISOString()];
  if (filters.q) {
    if (db.kind === 'mysql') {
      conditions.push("LOCATE(?, CONCAT(a.titulo, ' ', a.descripcion)) > 0");
      values.push(filters.q);
    } else {
      conditions.push("normalizar(a.titulo || ' ' || a.descripcion) LIKE ? ESCAPE '\\'");
      values.push('%' + filters.q.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[\\%_]/g, '\\$&') + '%');
    }
  }
  if (filters.categoriaId) { conditions.push('a.categoria_id = ?'); values.push(filters.categoriaId); }
  if (filters.subcategoria) { conditions.push('a.subcategoria = ?'); values.push(filters.subcategoria); }
  if (filters.zona) { conditions.push('a.zona = ?'); values.push(filters.zona); }
  if (filters.tipo) { conditions.push('a.tipo_operacion = ?'); values.push(filters.tipo); }
  const priceColumn = db.kind === 'mysql' ? 'a.precio' : 'a.precio_centimos';
  if (filters.min !== undefined) { conditions.push(priceColumn + ' >= ?'); values.push(db.kind === 'mysql' ? (filters.min / 100).toFixed(2) : filters.min); }
  if (filters.max !== undefined) { conditions.push(priceColumn + ' <= ?'); values.push(db.kind === 'mysql' ? (filters.max / 100).toFixed(2) : filters.max); }
  const where = ' WHERE ' + conditions.join(' AND ');
  const order = { recent: 'a.fecha_publicacion DESC, a.id DESC', price_asc: priceColumn + ' ASC, a.id DESC', price_desc: priceColumn + ' DESC, a.id DESC' }[filters.sort];
  const total = (await db.get('SELECT COUNT(*) AS total FROM anuncios a JOIN categorias c ON c.id = a.categoria_id' + where, ...values)).total;
  const rows = await db.all(listingSelect + where + ' ORDER BY ' + order + ' LIMIT ? OFFSET ?', ...values, filters.limit, (filters.page - 1) * filters.limit);
  return { anuncios: rows.map(row => serializeListing(row)), total, page: filters.page, totalPages: Math.ceil(total / filters.limit) };
}

export async function getListing(db, id, user) {
  if (!Number.isSafeInteger(id) || id < 1) throw new ApiError(404,'Este anuncio no está disponible.');
  const row = await db.get(listingSelect + ' WHERE a.id = ?', id);
  const privileged = row && (row.usuario_id === user?.id || user?.rol === 'admin');
  if (!row || (!isPublicRow(row) && !privileged)) throw new ApiError(404, 'Este anuncio no está disponible.');
  const seller = await db.get('SELECT id, nombre, celular, fecha_registro, es_demo, celular_verificado FROM usuarios WHERE id = ?', row.usuario_id);
  // Insignia de confianza: celular verificado y su historial de avisos publicados y dados de baja.
  const history = await db.get("SELECT SUM(CASE WHEN fecha_aprobacion IS NOT NULL THEN 1 ELSE 0 END) AS publicados, SUM(CASE WHEN estado = 'dado_de_baja' THEN 1 ELSE 0 END) AS bajas FROM anuncios WHERE usuario_id = ?", seller.id);
  // El nombre público es el que eligió el vendedor; nunca se deriva de su correo.
  const vendedor = { id: seller.id, nombre: seller.es_demo ? 'Vendedor de demostración' : seller.nombre || 'Vendedor de AvisoSur', fechaRegistro: seller.fecha_registro, demo: Boolean(seller.es_demo),
    verificado: Boolean(Number(seller.celular_verificado)), avisosPublicados: Number(history.publicados || 0), avisosDadosDeBaja: Number(history.bajas || 0) };
  const fotos = await db.all('SELECT id, archivo, orden FROM fotos WHERE anuncio_id = ? ORDER BY orden', row.id);
  if (!privileged) return { ...serializeListing(row), fotos, vendedor };
  // El celular público se pide aparte (GET /api/anuncios/:id/contacto); aquí solo lo ven propietario y administración.
  const contactos = Number((await db.get('SELECT COUNT(*) AS n FROM contactos_anuncio WHERE anuncio_id = ?', row.id)).n);
  return { ...serializeListing(row, { privado: true }), fotos, vendedor: { ...vendedor, celular: row.contacto || seller.celular }, contactos,
    pago: { comprobanteUrl: row.comprobante_archivo ? `/api/anuncios/${row.id}/comprobante` : null, referenciaPago: row.referencia_pago || '', fechaComprobante: row.fecha_comprobante || null, fechaConfirmacion: row.fecha_confirmacion || null },
  };
}

export async function getOwnListings(db, userId) {
  const rows = await db.all(listingSelect + ' WHERE a.usuario_id = ? ORDER BY a.fecha_publicacion DESC, a.id DESC', userId);
  const counts = new Map((await db.all('SELECT k.anuncio_id, COUNT(*) AS n FROM contactos_anuncio k JOIN anuncios a ON a.id = k.anuncio_id WHERE a.usuario_id = ? GROUP BY k.anuncio_id', userId)).map(item => [Number(item.anuncio_id), Number(item.n)]));
  return rows.map(row => ({ ...serializeListing(row, { privado: true }), contactos: counts.get(Number(row.id)) || 0 }));
}
