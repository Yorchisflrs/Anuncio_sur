import multer from 'multer';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ApiError } from './validation.mjs';

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 3, fileSize: 2 * 1024 * 1024, fields: 10, fieldSize: 10000, parts: 14 },
  fileFilter(_req, file, callback) {
    if (!['image/jpeg', 'image/png'].includes(file.mimetype) || !/\.(jpe?g|png)$/i.test(file.originalname)) return callback(new ApiError(422, 'Selecciona fotografías JPG o PNG.', { fotos: 'Solo se permiten archivos JPG y PNG.' }));
    callback(null, true);
  },
}).array('fotos', 3);

export async function preparePhotos(files) {
  return Promise.all(files.map(async file => {
    const jpeg = file.buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
    const png = file.buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    if ((!jpeg && !png) || (jpeg && file.mimetype !== 'image/jpeg') || (png && file.mimetype !== 'image/png')) throw new ApiError(422, 'Una fotografía no es un JPG o PNG válido.', { fotos: 'Revisa el formato real de las fotografías.' });
    try {
      const buffer = await sharp(file.buffer, { limitInputPixels: 20000000 }).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
      return { filename: randomUUID() + '.webp', buffer };
    } catch {
      throw new ApiError(422, 'No se pudo leer una fotografía.', { fotos: 'Usa una imagen válida de hasta 20 megapíxeles.' });
    }
  }));
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
