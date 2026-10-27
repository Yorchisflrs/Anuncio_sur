export const ZONES = ['Puno', 'Juliaca', 'Otras localidades del sur del Perú'];

export class ApiError extends Error {
  constructor(status, message, fields = {}) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

export function validateRegistration(body) {
  const correo = String(body.correo || '').trim().toLowerCase();
  const celular = String(body.celular || '').trim();
  const password = String(body.password || '');
  const fields = {};
  if (correo.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) fields.correo = 'Escribe un correo electrónico válido.';
  if (!/^9\d{8}$/.test(celular)) fields.celular = 'Escribe un celular peruano de 9 dígitos que comience con 9.';
  if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) fields.password = 'Usa al menos 8 caracteres y un máximo de 72 bytes.';
  if (password !== body.confirmacion) fields.confirmacion = 'Las contraseñas deben coincidir.';
  if (Object.keys(fields).length) throw new ApiError(422, 'Revisa los datos del formulario.', fields);
  return { correo, celular, password };
}

export async function validateListing(body, db, photoCount) {
  const titulo = String(body.titulo || '').trim();
  const descripcion = String(body.descripcion || '').trim();
  const categoriaId = Number(body.categoriaId);
  const subcategoria = String(body.subcategoria || '').trim();
  const zona = String(body.zona || '').trim();
  const precio = Number(body.precio);
  const fields = {};
  if (titulo.length < 5 || titulo.length > 100) fields.titulo = 'El título debe tener entre 5 y 100 caracteres.';
  if (!descripcion || descripcion.length > 3000) fields.descripcion = 'Escribe una descripción de hasta 3000 caracteres.';
  const category = Number.isInteger(categoriaId) && await db.get('SELECT * FROM categorias WHERE id = ? AND activa = 1', categoriaId);
  if (!category) fields.categoriaId = 'Selecciona una categoría.';
  if (category && subcategoria && !(typeof category.subcategorias === 'string' ? JSON.parse(category.subcategorias) : category.subcategorias).includes(subcategoria)) fields.subcategoria = 'Selecciona una subcategoría válida.';
  if (!Number.isFinite(precio) || precio <= 0 || precio > 99999999.99 || !/^\d+(\.\d{1,2})?$/.test(String(body.precio || ''))) fields.precio = 'El precio debe ser mayor que S/ 0 y tener como máximo dos decimales.';
  if (!ZONES.includes(zona)) fields.zona = 'Selecciona una zona.';
  if (!photoCount) fields.fotos = 'Añade al menos una fotografía principal.';
  if (Object.keys(fields).length) throw new ApiError(422, 'Revisa los datos antes de publicar.', fields);
  return { titulo, descripcion, categoriaId, subcategoria, zona, precioCentimos: Math.round(precio * 100) };
}

export function parseFilters(query) {
  const fields = {};
  const result = { q: String(query.q || '').trim().slice(0, 100), zona: String(query.zona || ''), subcategoria: String(query.subcategoria || '') };
  for (const key of ['min', 'max']) {
    if (query[key] !== undefined && query[key] !== '') {
      const value = Number(query[key]);
      if (!Number.isFinite(value) || value < 0 || value > 99999999.99) fields[key] = 'Usa un precio válido mayor o igual a cero.';
      else result[key] = Math.round(value * 100);
    }
  }
  if (result.min !== undefined && result.max !== undefined && result.min > result.max) fields.max = 'El máximo debe ser mayor o igual al mínimo.';
  if (result.zona && !ZONES.includes(result.zona)) fields.zona = 'Selecciona una zona válida.';
  if (query.categoriaId) {
    result.categoriaId = Number(query.categoriaId);
    if (!Number.isInteger(result.categoriaId) || result.categoriaId < 1) fields.categoriaId = 'Selecciona una categoría válida.';
  }
  result.page = Math.max(1, Math.min(10000, Number.parseInt(query.page, 10) || 1));
  result.limit = Math.max(1, Math.min(48, Number.parseInt(query.limit, 10) || 24));
  result.sort = ['recent', 'price_asc', 'price_desc'].includes(query.sort) ? query.sort : 'recent';
  if (Object.keys(fields).length) throw new ApiError(422, 'Revisa los filtros de búsqueda.', fields);
  return result;
}
