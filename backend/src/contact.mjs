import { createHash, randomBytes } from 'node:crypto';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { ApiError } from './validation.mjs';
import { isPublicRow, listingSelect } from './listings.mjs';

// El celular ya no viaja en el detalle ni en el catálogo: se entrega solo cuando una persona
// pulsa «Ver contacto», con un límite de pedidos para que nadie pueda reunir números en masa.
const SALT_KEY = 'contacto_sal_v1';
export const whatsappMessage = titulo => 'Hola, vi tu anuncio de ' + titulo + ' en AvisoSur y quisiera saber si todavía está disponible';
const insertIgnore = db => db.kind === 'mysql' ? 'INSERT IGNORE' : 'INSERT OR IGNORE';

/** Sal propia de cada instalación: el IP de quien pide el contacto se guarda solo como hash. */
async function visitorSalt(db) {
  let row = await db.get('SELECT valor FROM metadata WHERE clave = ?', SALT_KEY);
  if (!row) {
    await db.run(`${insertIgnore(db)} INTO metadata (clave, valor) VALUES (?, ?)`, SALT_KEY, randomBytes(32).toString('hex'));
    row = await db.get('SELECT valor FROM metadata WHERE clave = ?', SALT_KEY);
  }
  return row.valor;
}

export function registerContactRoutes(app, db, config) {
  const contactLimit = rateLimit({
    windowMs: 15 * 60 * 1000, limit: config.contactLimit ?? 20, standardHeaders: 'draft-8', legacyHeaders: false,
    // Por persona: la cuenta si inició sesión; si no, su dirección IP.
    keyGenerator: req => req.user ? 'usuario:' + req.user.id : ipKeyGenerator(req.ip),
    message: { message: 'Pediste muchos contactos seguidos. Espera unos minutos y vuelve a intentarlo.' },
  });
  let salt;
  app.get('/api/anuncios/:id/contacto', contactLimit, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) throw new ApiError(404, 'Este anuncio no está disponible.');
    const row = await db.get(listingSelect + ' WHERE a.id = ?', id);
    if (!isPublicRow(row)) throw new ApiError(404, 'Este anuncio no está disponible.');
    const seller = await db.get('SELECT celular FROM usuarios WHERE id = ?', row.usuario_id);
    const celular = row.contacto || seller.celular;
    if (req.user?.id !== row.usuario_id) {
      salt ||= await visitorSalt(db);
      const visitante = createHash('sha256').update(salt + (req.user ? 'usuario:' + req.user.id : 'ip:' + req.ip)).digest('hex');
      await db.run(`${insertIgnore(db)} INTO contactos_anuncio (anuncio_id, visitante, fecha) VALUES (?, ?, ?)`, id, visitante, new Date().toISOString());
    }
    res.json({ celular, whatsappUrl: 'https://wa.me/51' + celular + '?text=' + encodeURIComponent(whatsappMessage(row.titulo)) });
  });
}
