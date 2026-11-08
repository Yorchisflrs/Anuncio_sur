/** Mismas reglas que el servidor: nombre público sin correo, enlace ni teléfono. */
export function displayNameError(value: string) {
  const nombre = value.normalize('NFC').replace(/\s+/g, ' ').trim();
  const valid = nombre.length >= 2 && nombre.length <= 60 && /\p{L}/u.test(nombre) && /^[\p{L}\p{M}\d .,'&()-]+$/u.test(nombre) && !/www\./i.test(nombre) && (nombre.match(/\d/g) || []).length < 6;
  return valid ? '' : 'Escribe un nombre de 2 a 60 caracteres, sin correo ni número de teléfono.';
}
export function validateRegistration(data: Record<string, string>) {
  const fields: Record<string, string> = {};
  const nameError = displayNameError(data.nombre || '');
  if (nameError) fields.nombre = nameError;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.correo.trim()) || data.correo.length > 254) fields.correo = 'Escribe un correo electrónico válido.';
  if (!/^9\d{8}$/.test(data.celular)) fields.celular = 'Escribe 9 dígitos, comenzando con 9.';
  if (data.password.length < 8 || new TextEncoder().encode(data.password).length > 72) fields.password = 'Usa al menos 8 caracteres y un máximo de 72 bytes.';
  if (data.password !== data.confirmacion) fields.confirmacion = 'Las contraseñas no coinciden.';
  return fields;
}
export function validatePublication(data: Record<string, string>, photoCount: number) {
  const fields: Record<string, string> = {};
  if (data.titulo.trim().length < 5 || data.titulo.trim().length > 100) fields.titulo = 'Escribe un título de 5 a 100 caracteres.';
  if (!data.descripcion.trim() || data.descripcion.length > 3000) fields.descripcion = 'Añade una descripción de hasta 3000 caracteres.';
  if (!data.categoriaId) fields.categoriaId = 'Selecciona una categoría.';
  if (!/^\d+(\.\d{1,2})?$/.test(data.precio) || Number(data.precio) <= 0 || Number(data.precio) > 99999999.99) fields.precio = 'Escribe un precio mayor que S/ 0, con hasta dos decimales.';
  if (!data.zona) fields.zona = 'Selecciona una zona.';
  if (!photoCount) fields.fotos = 'Añade al menos una fotografía principal.';
  if (photoCount > 7) fields.fotos = 'Puedes añadir hasta siete fotografías.';
  if (!data.planId) fields.planId = 'Elige un plan de publicación.';
  if (!/^9\d{8}$/.test(data.contacto || '')) fields.contacto = 'Escribe un celular de 9 dígitos que comience con 9.';
  if ((data.direccion || '').length > 200) fields.direccion = 'La dirección admite hasta 200 caracteres.';
  if ((data.referencia || '').length > 200) fields.referencia = 'La referencia admite hasta 200 caracteres.';
  return fields;
}
