import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export const backendRoot = fileURLToPath(new URL('../', import.meta.url));
export const projectRoot = path.resolve(backendRoot, '..');
const envFile = path.join(projectRoot, '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
export const defaultConfig = {
  databaseClient: process.env.DB_CLIENT || 'sqlite',
  databasePath: process.env.DB_PATH || path.join(backendRoot, 'data', 'avisosur.sqlite'),
  dbHost: process.env.DB_HOST || '127.0.0.1',
  dbPort: Number(process.env.DB_PORT) || 3306,
  dbName: process.env.DB_NAME || 'avisosur_db',
  dbUser: process.env.DB_USER || 'root',
  dbPassword: process.env.DB_PASSWORD ?? '',
  uploadDir: process.env.UPLOAD_DIR || path.join(backendRoot, 'uploads'),
  frontendDist: path.join(projectRoot, 'frontend', 'dist'),
  allowedOrigins: [process.env.APP_ORIGIN || 'http://127.0.0.1:5173', 'http://localhost:5173', 'http://127.0.0.1:3001', 'http://localhost:3001'],
  secureCookie: process.env.COOKIE_SECURE === 'true',
};
