import { createHash, randomBytes } from 'node:crypto';
import { ApiError } from './validation.mjs';

const SESSION_DAYS = 7;
const digest = token => createHash('sha256').update(token).digest('hex');
export const publicUser = user => ({ id: user.id, correo: user.correo, celular: user.celular, fechaRegistro: user.fecha_registro, demo: Boolean(user.es_demo) });

export function authServices(db, config) {
  const cookieOptions = { httpOnly: true, sameSite: 'strict', secure: config.secureCookie, path: '/', maxAge: SESSION_DAYS * 86400000 };
  return {
    async loadUser(req, _res, next) {
      const token = req.cookies.avisosur_session;
      if (token && typeof token === 'string' && /^[a-f0-9]{64}$/.test(token)) {
        req.user = await db.get('SELECT u.* FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id WHERE s.token_hash = ? AND s.expira > ?', digest(token), new Date().toISOString());
      }
      next();
    },
    requireUser(req, _res, next) {
      if (!req.user) return next(new ApiError(401, 'Inicia sesión para continuar.'));
      next();
    },
    async createSession(userId, res, previousToken) {
      if (previousToken) await db.run('DELETE FROM sesiones WHERE token_hash = ?', digest(previousToken));
      const token = randomBytes(32).toString('hex');
      await db.run('INSERT INTO sesiones (token_hash, usuario_id, expira) VALUES (?, ?, ?)', digest(token), userId, new Date(Date.now() + cookieOptions.maxAge).toISOString());
      res.cookie('avisosur_session', token, cookieOptions);
    },
    async destroySession(req, res) {
      if (req.cookies.avisosur_session) await db.run('DELETE FROM sesiones WHERE token_hash = ?', digest(req.cookies.avisosur_session));
      res.clearCookie('avisosur_session', { ...cookieOptions, maxAge: undefined });
    },
  };
}
