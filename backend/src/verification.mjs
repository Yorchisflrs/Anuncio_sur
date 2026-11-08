import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { ApiError } from './validation.mjs';
import { publicUser } from './auth.mjs';

// Celular verificado: el servidor genera un código de 6 dígitos y administración lo envía por
// WhatsApp al número de la cuenta (no hay un proveedor de SMS). Quien escribe el código demuestra
// que controla ese número. Sin verificar se puede mirar, pero no publicar.
const CODE_HOURS = 24;
export const MAX_CODE_ATTEMPTS = 5;
const codeHash = (userId, code) => createHash('sha256').update(`avisosur-verificacion:${userId}:${code}`).digest('hex');
const sameHash = (one, two) => typeof one === 'string' && typeof two === 'string' && one.length === two.length && timingSafeEqual(Buffer.from(one), Buffer.from(two));
const validUserId = value => { const id = Number(value); if (!Number.isSafeInteger(id) || id < 1) throw new ApiError(404, 'No encontramos esta cuenta.'); return id; };
export const isVerified = user => Boolean(Number(user?.celular_verificado));

/** Deja pendiente la verificación de una cuenta para que administración le envíe un código. */
export async function requestVerification(db, userId) {
  const clause = db.kind === 'mysql' ? 'ON DUPLICATE KEY UPDATE solicitado = VALUES(solicitado)' : 'ON CONFLICT(usuario_id) DO UPDATE SET solicitado = excluded.solicitado';
  await db.run(`INSERT INTO verificaciones_celular (usuario_id, solicitado) VALUES (?, ?) ${clause}`, userId, new Date().toISOString());
}

export async function verificationStatus(db, user) {
  const row = await db.get('SELECT * FROM verificaciones_celular WHERE usuario_id = ?', user.id);
  const active = Boolean(row?.codigo_hash && Date.parse(row.expira) > Date.now() && Number(row.intentos) < MAX_CODE_ATTEMPTS);
  return { verificado: isVerified(user), fechaVerificacion: user.fecha_verificacion || null, metodo: user.metodo_verificacion || '', solicitado: row?.solicitado || null, codigoVigente: active, expira: active ? row.expira : null, intentosRestantes: active ? MAX_CODE_ATTEMPTS - Number(row.intentos) : 0 };
}

export function requireVerified(req, _res, next) {
  if (!req.user) return next(new ApiError(401, 'Inicia sesión para continuar.'));
  if (!isVerified(req.user)) return next(new ApiError(403, 'Verifica tu celular antes de publicar. Puedes hacerlo desde Mi cuenta.', { verificacion: 'Tu celular todavía no está verificado.' }));
  next();
}

async function markVerified(db, userId, method) {
  await db.transaction(async tx => {
    await tx.run('UPDATE usuarios SET celular_verificado = 1, fecha_verificacion = ?, metodo_verificacion = ? WHERE id = ?', new Date().toISOString(), method, userId);
    await tx.run('DELETE FROM verificaciones_celular WHERE usuario_id = ?', userId);
  });
}

async function unverifiedAccount(db, id) {
  const user = await db.get('SELECT * FROM usuarios WHERE id = ?', validUserId(id));
  if (!user) throw new ApiError(404, 'No encontramos esta cuenta.');
  if (user.es_demo) throw new ApiError(403, 'La cuenta de demostración usa un número ficticio y no se puede verificar.');
  if (isVerified(user)) throw new ApiError(409, 'Este celular ya está verificado.');
  return user;
}

export function registerVerificationRoutes(app, db, auth) {
  app.get('/api/perfil/verificacion', auth.requireUser, async (req, res) => res.json(await verificationStatus(db, req.user)));

  app.post('/api/perfil/verificacion', auth.requireUser, async (req, res) => {
    if (isVerified(req.user)) throw new ApiError(409, 'Tu celular ya está verificado.');
    if (req.user.es_demo) throw new ApiError(403, 'La cuenta de demostración usa un número ficticio y no se puede verificar.');
    await requestVerification(db, req.user.id);
    res.json(await verificationStatus(db, req.user));
  });

  app.post('/api/perfil/verificacion/confirmar', auth.requireUser, async (req, res) => {
    if (isVerified(req.user)) throw new ApiError(409, 'Tu celular ya está verificado.');
    const codigo = String(req.body?.codigo ?? '').trim();
    const row = await db.get('SELECT * FROM verificaciones_celular WHERE usuario_id = ?', req.user.id);
    if (!row?.codigo_hash || Date.parse(row.expira) <= Date.now()) throw new ApiError(409, 'No tienes un código vigente. Pide uno nuevo desde Mi cuenta.', { codigo: 'El código venció o todavía no se envió.' });
    if (Number(row.intentos) >= MAX_CODE_ATTEMPTS) throw new ApiError(429, 'Superaste los intentos para este código. Pide uno nuevo.', { codigo: 'Pide un código nuevo.' });
    if (!/^\d{6}$/.test(codigo) || !sameHash(codeHash(req.user.id, codigo), row.codigo_hash)) {
      await db.run('UPDATE verificaciones_celular SET intentos = intentos + 1 WHERE usuario_id = ?', req.user.id);
      const left = MAX_CODE_ATTEMPTS - Number(row.intentos) - 1;
      throw new ApiError(422, left > 0 ? `El código no es correcto. Te quedan ${left} ${left === 1 ? 'intento' : 'intentos'}.` : 'El código no es correcto y ya no quedan intentos. Pide uno nuevo.', { codigo: 'Revisa el código de 6 dígitos que recibiste por WhatsApp.' });
    }
    await markVerified(db, req.user.id, 'codigo');
    const user = await db.get('SELECT * FROM usuarios WHERE id = ?', req.user.id);
    res.json({ usuario: publicUser(user), verificacion: await verificationStatus(db, user) });
  });

  // Administración: cuentas sin verificar, primero las que lo pidieron.
  app.get('/api/admin/verificaciones', auth.requireAdmin, async (_req, res) => {
    const rows = await db.all(`SELECT u.id, u.nombre, u.celular, u.fecha_registro, v.solicitado, v.codigo_hash, v.expira, v.enviado, v.intentos
      FROM usuarios u LEFT JOIN verificaciones_celular v ON v.usuario_id = u.id
      WHERE u.celular_verificado = 0 AND u.es_demo = 0 ORDER BY (v.solicitado IS NULL), v.solicitado DESC, u.fecha_registro DESC LIMIT 200`);
    res.json(rows.map(row => ({ usuarioId: Number(row.id), nombre: row.nombre || 'Sin nombre para mostrar', celular: row.celular, fechaRegistro: row.fecha_registro, solicitado: row.solicitado || null, codigoEnviado: row.enviado || null, codigoVigente: Boolean(row.codigo_hash && Date.parse(row.expira) > Date.now() && Number(row.intentos) < MAX_CODE_ATTEMPTS), expira: row.expira || null })));
  });

  app.post('/api/admin/verificaciones/:usuarioId/codigo', auth.requireAdmin, async (req, res) => {
    const user = await unverifiedAccount(db, req.params.usuarioId);
    const codigo = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const now = new Date(); const expira = new Date(now.getTime() + CODE_HOURS * 3600000).toISOString();
    const clause = db.kind === 'mysql'
      ? 'ON DUPLICATE KEY UPDATE codigo_hash = VALUES(codigo_hash), expira = VALUES(expira), intentos = 0, enviado = VALUES(enviado)'
      : 'ON CONFLICT(usuario_id) DO UPDATE SET codigo_hash = excluded.codigo_hash, expira = excluded.expira, intentos = 0, enviado = excluded.enviado';
    // Solo se guarda el hash: el código en claro se devuelve una vez, para enviarlo por WhatsApp.
    await db.run(`INSERT INTO verificaciones_celular (usuario_id, solicitado, codigo_hash, expira, intentos, enviado) VALUES (?, ?, ?, ?, 0, ?) ${clause}`, user.id, now.toISOString(), codeHash(user.id, codigo), expira, now.toISOString());
    const mensaje = `AvisoSur: tu código para verificar tu celular es ${codigo}. Escríbelo en Mi cuenta antes de 24 horas. No lo compartas con nadie.`;
    res.status(201).json({ codigo, celular: user.celular, expira, whatsappUrl: 'https://wa.me/51' + user.celular + '?text=' + encodeURIComponent(mensaje) });
  });

  app.post('/api/admin/verificaciones/:usuarioId/presencial', auth.requireAdmin, async (req, res) => {
    if (req.body?.confirmado !== true) throw new ApiError(422, 'Confirma que comprobaste el celular en persona o por llamada.', { confirmado: 'La confirmación es obligatoria.' });
    const user = await unverifiedAccount(db, req.params.usuarioId);
    await markVerified(db, user.id, 'presencial');
    res.json({ message: 'Celular verificado en persona.' });
  });
}
