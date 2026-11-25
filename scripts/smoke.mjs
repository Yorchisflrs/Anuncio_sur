import assert from 'node:assert/strict';

const input = process.argv[2];
if (!input) {
  console.error('Uso: npm run smoke -- https://dominio-publico.up.railway.app');
  process.exit(1);
}

try {
  const base = new URL(input);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
  assert(base.protocol === 'https:' || (local && base.protocol === 'http:'), 'Utiliza HTTPS para comprobar un servidor público.');
  assert(!base.username && !base.password && !base.search && !base.hash && base.pathname === '/', 'Indica solo el origen, sin claves, parámetros ni rutas.');
  const request = async (route, expectedType) => {
    const response = await fetch(new URL(route, base), {
      signal: AbortSignal.timeout(15000),
      redirect: 'error',
      headers: { 'Cache-Control': 'no-cache' },
    });
    assert.equal(response.status, 200, route + ' debe responder 200.');
    assert.match(response.headers.get('content-type') || '', expectedType, route + ' tiene un tipo inesperado.');
    console.log('OK ' + route + ' HTTP 200');
    return response;
  };

  const health = await request('/salud', /application\/json/);
  assert.deepEqual(await health.json(), { status: 'ok', nombre: 'AvisoSur' });
  assert.match(health.headers.get('cache-control'), /no-store/);
  const home = await (await request('/', /text\/html/)).text();
  assert.match(home, /id="root"/);
  const script = home.match(/src="([^"]*\/assets\/[^"]+\.js)"/)?.[1];
  assert(script, 'El inicio debe enlazar el JavaScript compilado.');
  await request(script, /javascript/);
  for (const route of ['/anuncios', '/categorias', '/registro', '/login']) {
    assert.match(await (await request(route, /text\/html/)).text(), /id="root"/);
  }
  const categories = await (await request('/api/categorias', /application\/json/)).json();
  assert(Array.isArray(categories) && categories.length > 0, 'Deben existir categorías en la base.');
  const catalog = await (await request('/api/anuncios?limit=1', /application\/json/)).json();
  assert(Array.isArray(catalog.anuncios), 'El catálogo debe responder desde la base.');
  const listing = catalog.anuncios[0];
  if (listing) {
    assert.match(await (await request('/anuncios/' + listing.id, /text\/html/)).text(), /id="root"/);
    const detail = await (await request('/api/anuncios/' + listing.id, /application\/json/)).json();
    assert.equal(detail.id, listing.id);
    if (listing.imagen && new URL(listing.imagen, base).origin === base.origin) {
      await request(listing.imagen, /image\//);
    }
  }
  const privateArea = await fetch(new URL('/api/admin/resumen', base), { signal: AbortSignal.timeout(15000), redirect: 'error' });
  assert.equal(privateArea.status, 401, 'Administración debe exigir una sesión.');
  console.log('OK administración exige sesión HTTP 401');
  const manifest = await (await request('/manifest.webmanifest', /manifest\+json/)).json();
  assert.equal(manifest.name, 'AvisoSur');
  await request('/sw.js', /javascript/);
  console.log('Prueba de humo aprobada. Avisos públicos: ' + catalog.total);
} catch (error) {
  console.error('FALLO: ' + error.message);
  process.exitCode = 1;
}
