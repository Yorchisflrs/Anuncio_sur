// Fotos tomadas con el celular: se aceptan formatos comunes y se reducen en el navegador
// antes de subirlas, para que una foto de 8 MB no bloquee al vendedor ni gaste sus datos.
export const MAX_UPLOAD_MB = 10;
export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif,.jpg,.jpeg,.png,.webp,.heic,.heif,.avif';
const IMAGE_NAME = /\.(jpe?g|png|webp|heic|heif|avif)$/i;
const SERVER_READABLE = /\.(jpe?g|png|webp|avif)$/i;
const MAX_SIDE = 1600;

export function isImageFile(file: File) {
  return file.type.startsWith('image/') ? IMAGE_NAME.test(file.name) || /^image\/(jpeg|png|webp|heic|heif|avif)$/.test(file.type) : IMAGE_NAME.test(file.name);
}

/** Devuelve una versión liviana de la foto (JPEG de hasta 1600 px) o la original si ya es pequeña. */
export async function prepareImage(file: File): Promise<File> {
  if (!isImageFile(file)) throw new Error('Elige fotos JPG, PNG, WebP o HEIC.');
  if (file.size <= 1.5 * 1024 * 1024 && /^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch {
    // El navegador no sabe abrirla (por ejemplo, HEIC fuera de Safari): el servidor la reducirá si puede leerla.
    if (file.size <= MAX_UPLOAD_MB * 1024 * 1024 && SERVER_READABLE.test(file.name)) return file;
    throw new Error(/\.(heic|heif)$/i.test(file.name)
      ? 'Este navegador no puede abrir fotos HEIC. En el iPhone elige «Más compatible» en Ajustes > Cámara > Formatos, o comparte la foto como JPG.'
      : 'No pudimos abrir esta foto. Prueba con otra en JPG o PNG.');
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  if (!context) { bitmap.close(); return file; }
  context.fillStyle = '#FFFFFF'; context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.86));
  if (!blob) throw new Error('No pudimos preparar esta foto. Prueba con otra.');
  if (blob.size > MAX_UPLOAD_MB * 1024 * 1024) throw new Error(`La foto sigue pesando más de ${MAX_UPLOAD_MB} MB. Elige otra.`);
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg', lastModified: Date.now() });
}

export function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('No se pudo preparar la vista previa.'));
    reader.onerror = () => reject(new Error('No se pudo leer la fotografía. Inténtalo de nuevo.'));
    reader.readAsDataURL(file);
  });
}
