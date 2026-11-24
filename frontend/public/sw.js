const CACHE_PREFIX = 'avisosur-public-';
const CACHE_NAME = CACHE_PREFIX + 'v1';
const OFFLINE_PATH = '/sin-conexion.html';
const PUBLIC_HELP = new Set([
  '/ayuda/seguridad',
  '/ayuda/terminos',
  '/ayuda/privacidad',
  '/ayuda/soporte',
]);
const INSTALL_FILES = [
  OFFLINE_PATH,
  '/pwa-192.png',
  '/pwa-512.png',
  '/pwa-maskable-512.png',
];
const PUBLIC_FILES = new Set([
  ...INSTALL_FILES,
  '/favicon-48.png',
  '/apple-touch-icon.png',
  '/logo-avisosur.webp',
  '/logo-avisosur-blanco.webp',
  '/images/avisosur-titicaca-hero.webp',
  '/images/avisosur-titicaca-hero-800.webp',
]);
const BUILD_ASSET = /^\/assets\/[\w-]+-[\w-]{8,}\.(?:js|css|woff2?)$/;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(INSTALL_FILES)));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

function maySave(response, expectedType) {
  const type = response.headers.get('Content-Type') || '';
  const cacheControl = response.headers.get('Cache-Control') || '';
  return response.ok && !response.redirected && expectedType.test(type) &&
    !/(?:^|,|\s)(?:no-store|private)(?:$|[=,\s])/i.test(cacheControl);
}

async function save(cache, request, response, type) {
  if (!cache || !maySave(response, type)) return;
  // Si falta espacio para guardar, el contenido en línea sigue funcionando.
  await cache.put(request, response.clone()).catch(() => {});
}

async function publicAsset(request) {
  const cache = await caches.open(CACHE_NAME).catch(() => null);
  const saved = await cache?.match(request);
  if (saved) return saved;
  const response = await fetch(request, { credentials: 'omit' });
  await save(cache, request, response, /^(?:image\/|font\/|(?:text|application)\/(?:css|javascript|font-woff))/i);
  return response;
}

async function offlinePage(cache) {
  const saved = await cache?.match(OFFLINE_PATH);
  return new Response(saved?.body ?? 'Sin conexión. Vuelve a intentarlo cuando tengas red.', {
    status: 503,
    headers: {
      'Content-Type': saved ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

async function navigation(request, publicHelp) {
  const cache = await caches.open(CACHE_NAME).catch(() => null);
  try {
    if (!publicHelp) return await fetch(request, { cache: 'no-store' });
    const response = await fetch(request, { credentials: 'omit' });
    await save(cache, request, response, /^text\/html/i);
    return response;
  } catch {
    if (publicHelp) {
      const saved = await cache?.match(request);
      if (saved) return saved;
    }
    return offlinePage(cache);
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // La API y los archivos de usuarios usan la red, incluso al abrir su URL directamente.
  if (/^\/(?:api|uploads)(?:\/|$)/i.test(url.pathname)) return;

  if (!url.search && (PUBLIC_FILES.has(url.pathname) || BUILD_ASSET.test(url.pathname))) {
    event.respondWith(publicAsset(request));
  } else if (request.mode === 'navigate') {
    event.respondWith(navigation(request, !url.search && PUBLIC_HELP.has(url.pathname)));
  }
});
