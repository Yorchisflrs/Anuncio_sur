import { isIP } from 'node:net';

export const ZONES = ['Puno', 'Juliaca', 'Otras localidades del sur del Perú'];
export const OPERATIONS = ['venta', 'alquiler'];

export class ApiError extends Error {
  constructor(status, message, fields = {}) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

const NAME_RULE = 'Escribe un nombre de 2 a 60 caracteres, sin correo ni número de teléfono.';
/** Nombre público del vendedor: nunca un correo, un enlace ni un teléfono. Devuelve null si no es válido. */
export function displayName(value) {
  const nombre = String(value ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
  const valid = nombre.length >= 2 && nombre.length <= 60 && /\p{L}/u.test(nombre) && /^[\p{L}\p{M}\d .,'&()-]+$/u.test(nombre)
    && !/www\./i.test(nombre) && (nombre.match(/\d/g) || []).length < 6;
  return valid ? nombre : null;
}
export function validateDisplayName(value) {
  const nombre = displayName(value);
  if (!nombre) throw new ApiError(422, 'Revisa tu nombre para mostrar.', { nombre: NAME_RULE });
  return nombre;
}

export function validateRegistration(body) {
  const nombre = displayName(body.nombre);
  const correo = String(body.correo || '').trim().toLowerCase();
  const celular = String(body.celular || '').trim();
  const password = String(body.password || '');
  const fields = {};
  if (!nombre) fields.nombre = NAME_RULE;
  if (correo.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) fields.correo = 'Escribe un correo electrónico válido.';
  if (!/^9\d{8}$/.test(celular)) fields.celular = 'Escribe un celular peruano de 9 dígitos que comience con 9.';
  if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) fields.password = 'Usa al menos 8 caracteres y un máximo de 72 bytes.';
  if (password !== body.confirmacion) fields.confirmacion = 'Las contraseñas deben coincidir.';
  if (Object.keys(fields).length) throw new ApiError(422, 'Revisa los datos del formulario.', fields);
  return { nombre, correo, celular, password };
}

function isPrivatePhotoHost(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true;
  const version = isIP(host);
  if (version === 4) {
    const [a, b] = host.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168);
  }
  if (version === 6) return host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:') || host.startsWith('::ffff:');
  return false;
}

function validatePhotoLinks(raw) {
  const entries = raw === undefined ? [] : Array.isArray(raw) ? raw : [raw];
  if (entries.length > 7) throw new ApiError(422, 'Puedes añadir hasta siete fotografías.', { fotos: 'Puedes añadir hasta siete fotografías.' });
  return entries.map(value => {
    if (typeof value !== 'string' || value.trim().length > 2048) throw new ApiError(422, 'Revisa los enlaces de las fotos.', { fotos: 'Cada enlace debe tener como máximo 2048 caracteres.' });
    let url;
    try { url = new URL(value.trim()); } catch { throw new ApiError(422, 'Revisa los enlaces de las fotos.', { fotos: 'Pega un enlace válido que abra una imagen pública.' }); }
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.port || isPrivatePhotoHost(url.hostname)) {
      throw new ApiError(422, 'Revisa los enlaces de las fotos.', { fotos: 'Usa una dirección HTTPS pública, sin datos de acceso ni direcciones privadas.' });
    }
    return url.href;
  });
}

function validatePhotoOrder(raw, fileCount, links) {
  const fallback = [
    ...Array.from({ length: fileCount }, (_, index) => `f:${index}`),
    ...links.map((_, index) => `u:${index}`),
  ];
  if (raw === undefined || raw === '') return fallback;
  let order;
  try { order = JSON.parse(String(raw)); } catch { return null; }
  if (!Array.isArray(order) || order.length !== fileCount + links.length) return null;
  const fileIndexes = new Set();
  const urlIndexes = new Set();
  for (const token of order) {
    if (typeof token !== 'string') return null;
    const match = /^(f|u):(0|[1-6])$/.exec(token);
    if (!match) return null;
    const [kind, rawIndex] = [match[1], match[2]];
    const index = Number(rawIndex);
    const set = kind === 'f' ? fileIndexes : urlIndexes;
    const limit = kind === 'f' ? fileCount : links.length;
    if (index >= limit || set.has(index)) return null;
    set.add(index);
  }
  return fileIndexes.size === fileCount && urlIndexes.size === links.length ? order : null;
}

export async function validateListing(body, db, photoCount) {
  const titulo = String(body.titulo || '').trim();
  const descripcion = String(body.descripcion || '').trim();
  const categoriaId = Number(body.categoriaId);
  const subcategoria = String(body.subcategoria || '').trim();
  const zona = String(body.zona || '').trim();
  const precio = Number(body.precio);
  const direccion = String(body.direccion || '').trim();
  const referencia = String(body.referencia || '').trim();
  const contacto = String(body.contacto || '').trim();
  // Sin el campo se asume venta, como en los avisos anteriores a esta opción.
  const tipoOperacion = body.tipoOperacion === undefined || body.tipoOperacion === '' ? 'venta' : String(body.tipoOperacion);
  const fields = {};
  const photoUrls = validatePhotoLinks(body.fotosUrl);
  if (!OPERATIONS.includes(tipoOperacion)) fields.tipoOperacion = 'Indica si vendes o alquilas.';
  const photoOrder = validatePhotoOrder(body.ordenFotos, photoCount, photoUrls);
  if (titulo.length < 5 || titulo.length > 100) fields.titulo = 'El título debe tener entre 5 y 100 caracteres.';
  if (!descripcion || descripcion.length > 3000) fields.descripcion = 'Escribe una descripción de hasta 3000 caracteres.';
  const category = Number.isInteger(categoriaId) && await db.get('SELECT * FROM categorias WHERE id = ? AND activa = 1', categoriaId);
  if (!category) fields.categoriaId = 'Selecciona una categoría.';
  if (category && subcategoria && !(typeof category.subcategorias === 'string' ? JSON.parse(category.subcategorias) : category.subcategorias).includes(subcategoria)) fields.subcategoria = 'Selecciona una subcategoría válida.';
  if (!Number.isFinite(precio) || precio <= 0 || precio > 99999999.99 || !/^\d+(\.\d{1,2})?$/.test(String(body.precio || ''))) fields.precio = 'El precio debe ser mayor que S/ 0 y tener como máximo dos decimales.';
  if (!ZONES.includes(zona)) fields.zona = 'Selecciona una zona.';
  if (!photoCount && !photoUrls.length) fields.fotos = 'Añade al menos una fotografía principal.';
  if (photoCount + photoUrls.length > 7) fields.fotos = 'Puedes añadir hasta siete fotografías entre archivos y enlaces.';
  if (!photoOrder) fields.fotos = 'El orden de las fotografías no es válido. Vuelve a seleccionarlas.';
  if (direccion.length > 200) fields.direccion = 'Usa hasta 200 caracteres.';
  if (referencia.length > 300) fields.referencia = 'Usa hasta 300 caracteres.';
  if (contacto && !/^9\d{8}$/.test(contacto)) fields.contacto = 'Escribe un celular peruano de nueve dígitos que comience con 9.';
  if (Object.keys(fields).length) throw new ApiError(422, 'Revisa los datos antes de publicar.', fields);
  return { titulo, descripcion, categoriaId, subcategoria, zona, direccion, referencia, contacto, tipoOperacion, precioCentimos: Math.round(precio * 100), photoUrls, photoOrder };
}

export function parseFilters(query) {
  const fields = {};
  const result = { q: String(query.q || '').trim().slice(0, 100), zona: String(query.zona || ''), subcategoria: String(query.subcategoria || ''), tipo: String(query.tipo || '') };
  if (result.tipo && !OPERATIONS.includes(result.tipo)) fields.tipo = 'Elige venta o alquiler.';
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
