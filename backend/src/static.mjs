import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

// Archivos de texto de la compilación que vale la pena comprimir. Las fotos WebP, las fuentes WOFF2 y los PNG
// ya vienen comprimidos y los sirve express.static tal cual.
const COMPRESSIBLE = /\.(?:js|css|html|svg|txt|json|webmanifest)$/i;
// Vite pone un hash en el nombre de cada archivo de /assets: si cambia el contenido, cambia el nombre.
export const IMMUTABLE = 'public, max-age=31536000, immutable';

const encode = {
  br: buffer => zlib.brotliCompressSync(buffer, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: buffer.length } }),
  gzip: buffer => zlib.gzipSync(buffer, { level: 9 }),
};

/** Elige la codificación que acepta el navegador: Brotli primero, luego gzip, o ninguna. */
export function preferredEncoding(header = '') {
  const accepted = new Map(String(header).toLowerCase().split(',').map(part => {
    const [name, ...params] = part.trim().split(';');
    const q = params.map(item => item.trim()).find(item => item.startsWith('q='));
    return [name.trim(), q ? Number(q.slice(2)) : 1];
  }));
  const ok = name => (accepted.get(name) ?? accepted.get('*') ?? 0) > 0;
  return ok('br') ? 'br' : ok('gzip') ? 'gzip' : null;
}

/**
 * Sirve los archivos de texto de `root` comprimidos con Brotli o gzip. Cada archivo se comprime una sola vez
 * y queda en memoria hasta que cambia en el disco. Lo demás pasa a express.static.
 */
export function compressedStatic(root, { cacheControl = () => 'no-cache' } = {}) {
  const base = path.resolve(root);
  const memory = new Map();

  function load(file) {
    let stat;
    try { stat = fs.statSync(file); } catch { return null; }
    if (!stat.isFile()) return null;
    const key = stat.size + '-' + stat.mtimeMs;
    const cached = memory.get(file);
    if (cached?.key === key) return cached;
    const entry = { key, raw: fs.readFileSync(file), etag: 'W/"' + stat.size.toString(16) + '-' + Math.floor(stat.mtimeMs).toString(16) + '"', encoded: {} };
    memory.set(file, entry);
    return entry;
  }

  function send(req, res, file, urlPath) {
    const entry = load(file);
    if (!entry) return false;
    const encoding = preferredEncoding(req.get('accept-encoding'));
    res.vary('Accept-Encoding');
    res.type(path.extname(file));
    res.set('Cache-Control', cacheControl(urlPath));
    res.set('ETag', entry.etag);
    if (req.fresh) { res.status(304).end(); return true; }
    const body = encoding ? (entry.encoded[encoding] ||= encode[encoding](entry.raw)) : entry.raw;
    if (encoding) res.set('Content-Encoding', encoding);
    res.set('Content-Length', String(body.length));
    res.end(req.method === 'HEAD' ? undefined : body);
    return true;
  }

  function middleware(req, res, next) {
    if ((req.method !== 'GET' && req.method !== 'HEAD') || !COMPRESSIBLE.test(req.path)) return next();
    let urlPath;
    try { urlPath = decodeURIComponent(req.path); } catch { return next(); }
    const file = path.resolve(base, '.' + path.posix.normalize('/' + urlPath));
    // Nada fuera de la carpeta servida, ni archivos o carpetas que empiecen con punto.
    if (!file.startsWith(base + path.sep) || urlPath.split('/').some(part => part.startsWith('.'))) return next();
    if (!send(req, res, file, urlPath)) next();
  }

  /** Envía un archivo concreto de la carpeta (por ejemplo, index.html para las rutas de React). */
  middleware.sendFile = (req, res, name) => send(req, res, path.join(base, name), '/' + name);
  return middleware;
}
