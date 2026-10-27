export function validateRegistration(data: Record<string, string>) {
  const fields: Record<string, string> = {};
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
  return fields;
}
