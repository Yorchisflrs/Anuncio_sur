import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import { rateLimit } from 'express-rate-limit';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { defaultConfig, projectRoot } from './config.mjs';
import { openDatabase } from './database.mjs';
import { authServices, publicUser } from './auth.mjs';
import { ApiError, validateRegistration, validateListing } from './validation.mjs';
import { getCatalog, getListing, getOwnListings } from './listings.mjs';
import { upload, preparePhotos, persistPhotos } from './uploads.mjs';

export async function createApp(overrides = {}) {
  const config = { ...defaultConfig, ...overrides };
  const db = await openDatabase(config);
  const app = express();
  const auth = authServices(db, config);
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: { directives: { upgradeInsecureRequests: null, frameSrc: ["'self'", 'https://www.openstreetmap.org'] } } }));
  app.use(express.json({ limit: '16kb' }));
  app.use(cookieParser());
  app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.use('/api', (req, _res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('origin') && !config.allowedOrigins.includes(req.get('origin'))) return next(new ApiError(403, 'La solicitud debe realizarse desde AvisoSur.'));
    next();
  });
  app.use('/api', auth.loadUser);
  app.use('/uploads', express.static(config.uploadDir, { dotfiles: 'deny', index: false, maxAge: '7d' }));
  app.use('/demo', express.static(path.join(projectRoot, 'frontend', 'public', 'demo'), { maxAge: '7d' }));

  const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false, message: { message: 'Has realizado varios intentos. Espera unos minutos y vuelve a intentarlo.' } });
  app.get('/api/health', (_req, res) => res.json({ status: 'ok', nombre: 'AvisoSur' }));
  app.get('/api/categorias', async (_req, res) => {
    const rows = await db.all("SELECT c.*, (SELECT COUNT(*) FROM anuncios a WHERE a.categoria_id = c.id AND a.estado = 'activo') AS total FROM categorias c WHERE c.activa = 1 ORDER BY c.id");
    res.json(rows.map(row => ({ id: row.id, nombre: row.nombre, subcategorias: typeof row.subcategorias === 'string' ? JSON.parse(row.subcategorias) : row.subcategorias, total: row.total })));
  });
  app.get('/api/auth/me', (req, res) => res.json({ usuario: req.user ? publicUser(req.user) : null }));
  app.post('/api/auth/registro', loginLimit, async (req, res) => {
    const data = validateRegistration(req.body || {});
    const hash = await bcrypt.hash(data.password, 12);
    const fields = {};
    if (await db.get('SELECT id FROM usuarios WHERE correo = ?', data.correo)) fields.correo = 'Ya existe una cuenta con este correo.';
    if (await db.get('SELECT id FROM usuarios WHERE celular = ?', data.celular)) fields.celular = 'Ya existe una cuenta con este celular.';
    if (Object.keys(fields).length) throw new ApiError(409, 'Ya existe una cuenta con estos datos.', fields);
    let result;
    try {
      result = await db.run('INSERT INTO usuarios (correo, celular, password_hash, fecha_registro) VALUES (?, ?, ?, ?)', data.correo, data.celular, hash, new Date().toISOString());
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY' || error.code === 'SQLITE_CONSTRAINT_UNIQUE') throw new ApiError(409, 'Ya existe una cuenta con estos datos.');
      throw error;
    }
    const user = await db.get('SELECT * FROM usuarios WHERE id = ?', result.lastInsertRowid);
    await auth.createSession(user.id, res, req.cookies.avisosur_session);
    res.status(201).json({ usuario: publicUser(user) });
  });
  app.post('/api/auth/login', loginLimit, async (req, res) => {
    const identificador = String(req.body?.identificador || '').trim().toLowerCase().slice(0, 254);
    const password = String(req.body?.password || '');
    const user = await db.get('SELECT * FROM usuarios WHERE correo = ? OR celular = ?', identificador, identificador);
    // Una comparación también cuando no existe la cuenta reduce diferencias de tiempo.
    const dummyHash = '$2b$12$C6UzMDM.H6dfI/f/IKcEe.OyfxCJHQVQcSIZfsCscshxRzpwPBT5q';
    const valid = Buffer.byteLength(password, 'utf8') <= 72 && await bcrypt.compare(password, user?.password_hash || dummyHash);
    if (!user || !valid) throw new ApiError(401, 'El correo, celular o contraseña no es correcto.');
    await auth.createSession(user.id, res, req.cookies.avisosur_session);
    res.json({ usuario: publicUser(user) });
  });
  app.post('/api/auth/logout', async (req, res) => { await auth.destroySession(req, res); res.json({ message: 'Sesión cerrada.' }); });
  app.get('/api/anuncios', async (req, res) => res.json(await getCatalog(db, req.query)));
  app.get('/api/perfil/anuncios', auth.requireUser, async (req, res) => res.json(await getOwnListings(db, req.user.id)));
  app.get('/api/anuncios/:id', async (req, res) => res.json(await getListing(db, Number(req.params.id), req.user)));
  app.post('/api/anuncios', auth.requireUser, upload, async (req, res) => {
    const data = await validateListing(req.body || {}, db, req.files?.length || 0);
    const photos = await preparePhotos(req.files);
    const saved = await persistPhotos(photos, config.uploadDir);
    let listingId;
    try {
      listingId = await db.transaction(async tx => {
        const date = new Date().toISOString();
        const priceColumn = tx.kind === 'mysql' ? 'precio' : 'precio_centimos';
        const price = tx.kind === 'mysql' ? (data.precioCentimos / 100).toFixed(2) : data.precioCentimos;
        const result = await tx.run(`INSERT INTO anuncios (usuario_id, titulo, descripcion, ${priceColumn}, zona, categoria_id, subcategoria, es_demo, fecha_publicacion) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, req.user.id, data.titulo, data.descripcion, price, data.zona, data.categoriaId, data.subcategoria, Number(req.user.es_demo), date);
        const id = Number(result.lastInsertRowid);
        for (const [index, photo] of photos.entries()) await tx.run('INSERT INTO fotos (anuncio_id, archivo, orden, fecha_subida) VALUES (?, ?, ?, ?)', id, '/uploads/' + photo.filename, index, date);
        return id;
      });
    } catch (error) {
      await Promise.allSettled(saved.map(file => fsp.unlink(file)));
      throw error;
    }
    res.status(201).json(await getListing(db, listingId, req.user));
  });
  app.patch('/api/anuncios/:id/baja', auth.requireUser, async (req, res) => {
    const row = await db.get('SELECT usuario_id FROM anuncios WHERE id = ?', Number(req.params.id));
    if (!row) throw new ApiError(404, 'No encontramos este anuncio.');
    if (row.usuario_id !== req.user.id) throw new ApiError(403, 'Solo puedes dar de baja tus propios anuncios.');
    await db.run("UPDATE anuncios SET estado = 'dado_de_baja' WHERE id = ?", Number(req.params.id));
    res.json({ message: 'Anuncio dado de baja. El registro se conserva.' });
  });
  app.use('/api', (_req, _res, next) => next(new ApiError(404, 'No encontramos este recurso.')));
  if (fs.existsSync(path.join(config.frontendDist, 'index.html'))) {
    app.use(express.static(config.frontendDist));
    app.get('/{*path}', (_req, res) => res.sendFile(path.join(config.frontendDist, 'index.html')));
  }
  app.use((error, _req, res, _next) => {
    if (error.name === 'MulterError') {
      const message = error.code === 'LIMIT_FILE_SIZE' ? 'Cada fotografía debe pesar como máximo 2 MB.' : 'Puedes subir hasta 3 fotografías JPG o PNG.';
      return res.status(422).json({ message, fields: { fotos: message } });
    }
    if (error.type === 'entity.parse.failed') return res.status(400).json({ message: 'La solicitud no tiene un formato válido.' });
    if (error.type === 'entity.too.large') return res.status(413).json({ message: 'La solicitud es demasiado grande.' });
    const status = error.status || 500;
    if (status >= 500) console.error('[AvisoSur] Error del servidor:', error.message);
    res.status(status).json({ message: status >= 500 ? 'Ocurrió un problema. Inténtalo de nuevo.' : error.message, fields: error.fields || {} });
  });
  return { app, db, config };
}
