import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { createHash } from 'node:crypto';

// Archivos de texto de la compilación que vale la pena comprimir. Las fotos WebP, las fuentes WOFF2 y los PNG
// ya vienen comprimidos y los sirve express.static tal cual.
const COMPRESSIBLE = /\.(?:js|css|html|svg|txt|json|webmanifest)$/i;
// Vite pone un hash en el nombre de cada archivo de /assets: si cambia el contenido, cambia el nombre.
export const IMMUTABLE = 'public, max-age=31536000, immutable';

const encode = {
  br: buffer => zlib.brotliCompressSync(buffer, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: buffer.length } }),
  gzip: buffer => zlib.gzipSync(buffer, { level: 9 }),
};

// El HTML con etiquetas propias de cada pedido pesa ~1 KB: se comprime al vuelo con un nivel rápido.
function withHead(raw, head, encoding) {
  // Con una función, los «$&» o «$'» que traiga el texto de un aviso no se interpretan como patrones.
  const html = raw.toString('utf8').replace('</head>', () => head + '</head>');
  const buffer = Buffer.from(html);
  if (encoding === 'br') return zlib.brotliCompressSync(buffer, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } });
  return encoding === 'gzip' ? zlib.gzipSync(buffer, { level: 6 }) : buffer;
}

/** Escapa un valor para ponerlo dentro de un atributo HTML entre comillas dobles. */
export const escapeAttribute = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

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

  function send(req, res, file, urlPath, head = '') {
    const entry = load(file);
    if (!entry) return false;
    const encoding = preferredEncoding(req.get('accept-encoding'));
    res.vary('Accept-Encoding');
    res.type(path.extname(file));
    res.set('Cache-Control', cacheControl(urlPath));
    // Con etiquetas extra en <head>, el contenido cambia: el ETag también.
    res.set('ETag', head ? entry.etag.slice(0, -1) + '-' + createHash('sha1').update(head).digest('hex').slice(0, 12) + '"' : entry.etag);
    if (req.fresh) { res.status(304).end(); return true; }
    const body = head ? withHead(entry.raw, head, encoding) : encoding ? (entry.encoded[encoding] ||= encode[encoding](entry.raw)) : entry.raw;
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

  /** Envía un archivo concreto de la carpeta (por ejemplo, index.html para las rutas de React), con etiquetas extra en <head>. */
  middleware.sendFile = (req, res, name, head = '') => send(req, res, path.join(base, name), '/' + name, head);
  return middleware;
}
