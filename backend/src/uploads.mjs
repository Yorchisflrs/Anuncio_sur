import multer from 'multer';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ApiError } from './validation.mjs';

// Las fotos de celular suelen pasar de 2 MB: se aceptan hasta 10 MB y el servidor
// las reduce a 1600 px en WebP. El contenido real se comprueba con sharp, no con el nombre.
export const MAX_IMAGE_MB = 10;
const MAX_IMAGE_BYTES = MAX_IMAGE_MB * 1024 * 1024;
const MAX_PIXELS = 50_000_000;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/avif'];
const IMAGE_EXTENSION = /\.(jpe?g|png|webp|heic|heif|avif)$/i;
const READABLE_FORMATS = new Set(['jpeg', 'png', 'webp', 'heif']);
// Algunos sistemas envían las fotos HEIC sin tipo MIME; la extensión y el contenido deciden.
const acceptsImage = file => (IMAGE_TYPES.includes(file.mimetype) || file.mimetype === 'application/octet-stream') && IMAGE_EXTENSION.test(file.originalname);

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 7, fileSize: MAX_IMAGE_BYTES, fields: 20, fieldSize: 10000, parts: 28 },
  fileFilter(_req, file, callback) {
    if (!acceptsImage(file)) return callback(new ApiError(422, 'Selecciona fotografías JPG, PNG, WebP o HEIC.', { fotos: 'Usa fotos JPG, PNG, WebP o HEIC.' }));
    callback(null, true);
  },
}).array('fotos', 7);

export function singleImage(field) {
  return multer({ storage: multer.memoryStorage(), limits: { files: 1, fileSize: MAX_IMAGE_BYTES, fields: 2, parts: 3 },
    fileFilter(_req, file, callback) {
      if (!acceptsImage(file)) return callback(new ApiError(422, 'Selecciona una imagen JPG, PNG, WebP o HEIC.', { [field]: `Usa una imagen JPG, PNG, WebP o HEIC de hasta ${MAX_IMAGE_MB} MB.` }));
      callback(null, true);
    },
  }).single(field);
}

export async function preparePhotos(files = [], { lossless = false, field = 'fotos' } = {}) {
  const prepared = [];
  // Una foto a la vez: decodificar varias fotos de celular en paralelo ocupa mucha memoria.
  for (const file of files) {
    let metadata;
    try { metadata = await sharp(file.buffer).metadata(); } catch { metadata = null; }
    if (!metadata || !READABLE_FORMATS.has(metadata.format)) throw new ApiError(422, 'Una fotografía no es una imagen válida.', { [field]: 'Revisa el formato real de la imagen: JPG, PNG, WebP o HEIC.' });
    try {
      const buffer = await sharp(file.buffer, { limitInputPixels: MAX_PIXELS }).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp(lossless ? { lossless: true } : { quality: 82 }).toBuffer();
      prepared.push({ filename: randomUUID() + '.webp', buffer });
    } catch {
      const heic = metadata.format === 'heif' && metadata.compression === 'hevc';
      throw new ApiError(422, 'No se pudo leer una fotografía.', { [field]: heic ? 'Esta foto HEIC del iPhone no se pudo convertir. Envíala como JPG: en el iPhone elige «Más compatible» en Ajustes > Cámara > Formatos.' : 'Usa una imagen válida de hasta 50 megapíxeles.' });
    }
  }
  return prepared;
}

export async function persistPhotos(photos, directory) {
  await fs.mkdir(directory, { recursive: true });
  const saved = [];
  try {
    for (const photo of photos) {
      const filePath = path.join(directory, photo.filename);
      await fs.writeFile(filePath, photo.buffer, { flag: 'wx' });
      saved.push(filePath);
    }
    return saved;
  } catch (error) {
    await Promise.allSettled(saved.map(file => fs.unlink(file)));
    throw error;
  }
}
