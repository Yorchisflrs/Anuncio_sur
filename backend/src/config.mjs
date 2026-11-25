import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export const backendRoot = fileURLToPath(new URL('../', import.meta.url));
export const projectRoot = path.resolve(backendRoot, '..');
const envFile = path.join(projectRoot, '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
const production = process.env.NODE_ENV === 'production';
const appOrigin = process.env.APP_ORIGIN ||
  (process.env.RAILWAY_PUBLIC_DOMAIN ? 'https://' + process.env.RAILWAY_PUBLIC_DOMAIN : 'http://127.0.0.1:5173');
const trustProxy = process.env.TRUST_PROXY || '0';
if (!/^\d+$/.test(trustProxy)) throw new Error('TRUST_PROXY debe ser un número entero de saltos de proxy.');
if (production) {
  const required = process.env.DB_CLIENT === 'mysql' ? ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'] : [];
  const missing = required.filter(name => !process.env[name]?.trim());
  if (missing.length) throw new Error('Faltan variables de producción: ' + missing.join(', '));
  const origin = new URL(appOrigin);
  if (origin.protocol !== 'https:' || origin.username || origin.password ||
      origin.pathname !== '/' || origin.search || origin.hash) {
    throw new Error('APP_ORIGIN debe ser el origen HTTPS público de AvisoSur.');
  }
}
export const defaultConfig = {
  databaseClient: process.env.DB_CLIENT || 'sqlite',
  databasePath: process.env.DB_PATH || path.join(backendRoot, 'data', 'avisosur.sqlite'),
  dbHost: process.env.DB_HOST || '127.0.0.1',
  dbPort: Number(process.env.DB_PORT) || 3306,
  dbName: process.env.DB_NAME || 'avisosur_db',
  dbUser: process.env.DB_USER || 'root',
  dbPassword: process.env.DB_PASSWORD ?? '',
  uploadDir: process.env.UPLOAD_DIR || path.join(backendRoot, 'uploads'),
  privateUploadDir: process.env.PRIVATE_UPLOAD_DIR || null,
  frontendDist: path.join(projectRoot, 'frontend', 'dist'),
  allowedOrigins: production ? [new URL(appOrigin).origin] : [appOrigin, 'http://localhost:5173', 'http://127.0.0.1:3001', 'http://localhost:3001'],
  secureCookie: process.env.COOKIE_SECURE === 'true' || production,
  trustProxy: Number(trustProxy),
  demoPassword: process.env.DEMO_PASSWORD || '',
};
