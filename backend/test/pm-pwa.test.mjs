import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import { createIsolatedApp } from './support.mjs';

const frontend = new URL('../../frontend/', import.meta.url);
const fromPublic = name => new URL('public/' + name, frontend);
const files = ['manifest.webmanifest', 'sw.js', 'sin-conexion.html', 'pwa-192.png', 'pwa-512.png', 'pwa-maskable-512.png'];
let server;
let dist;

before(async () => {
  dist = await fs.mkdtemp(path.join(os.tmpdir(), 'avisosur-pwa-'));
  await fs.copyFile(new URL('index.html', frontend), path.join(dist, 'index.html'));
  for (const name of files) {
    await fs.copyFile(fromPublic(name), path.join(dist, name)).catch(error => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
  server = await createIsolatedApp({ frontendDist: dist });
});
after(async () => {
  await server?.close();
  if (dist) await fs.rm(dist, { recursive: true, force: true });
});

async function manifest() {
  const response = await fetch(server.base + '/manifest.webmanifest');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /manifest\+json/);
  return response.json();
}

async function workerHarness() {
  const handlers = new Map();
  const entries = new Map();
  const calls = [];
  let online = true;
  const origin = server.base;
  const href = input => new URL(typeof input === 'string' ? input : input.url, origin).href;
  const cache = {
    addAll: async inputs => { for (const input of inputs) entries.set(href(input), new Response('Sin conexión', { headers: { 'Content-Type':'text/html' } })); },
    put: async (input, response) => entries.set(href(input), response.clone()),
    match: async input => entries.get(href(input))?.clone(),
  };
  const self = {
    location: { origin }, clients: { claim: async () => {} },
    addEventListener: (type, handler) => handlers.set(type, handler),
  };
  const worker = await fs.readFile(fromPublic('sw.js'), 'utf8');
  vm.runInNewContext(worker, {
    self, URL, Request, Response, Headers, console,
    caches: { open: async () => cache, keys: async () => [], delete: async () => true },
    fetch: async (input, options) => {
      calls.push({ url:href(input), options });
      if (!online) throw new TypeError('Offline');
      const pathname = new URL(href(input)).pathname;
      return new Response(pathname, { headers: { 'Content-Type': pathname.endsWith('.js') ? 'text/javascript' : 'text/html' } });
    },
  });
  const lifecycle = type => {
    let job;
    handlers.get(type)({ waitUntil: value => { job = value; } });
    return job;
  };
  await lifecycle('install');
  await lifecycle('activate');
  return {
    entries, calls, goOffline: () => { online = false; },
    dispatch(pathname, { method = 'GET', mode = 'navigate' } = {}) {
      let response;
      handlers.get('fetch')({
        request: { url:href(pathname), method, mode },
        respondWith: promise => { response=promise; },
      });
      return response;
    },
  };
}

test('PM-01 · El manifiesto se sirve como JSON y define identidad e inicio', async () => {
  const app = await manifest();
  assert.equal(app.name, 'AvisoSur');
  assert(app.short_name.length > 0 && app.short_name.length <= 12);
  assert.equal(app.start_url, '/');
  assert.equal(app.scope, '/');
  assert.equal(app.display, 'standalone');
});

test('PM-02 · Los PNG de 192 y 512 coinciden con las medidas declaradas', async () => {
  const app = await manifest();
  for (const size of [192,512]) {
    const declared = app.icons.find(icon => icon.sizes === size + 'x' + size && icon.purpose === 'any');
    assert(declared);
    const res = await fetch(server.base + declared.src);
    assert.match(res.headers.get('content-type'), /^image\/png/);
    const image = Buffer.from(await res.arrayBuffer());
    assert.equal(image.subarray(1,4).toString(),'PNG');
    assert.equal(image.readUInt32BE(16), size);
    assert.equal(image.readUInt32BE(20), size);
  }
});

test('PM-03 · El icono maskable tiene su propio PNG cuadrado', async () => {
  const app = await manifest();
  const icon = app.icons.find(icon => icon.purpose === 'maskable');
  assert(icon && icon.sizes === '512x512');
  assert(!app.icons.find(other => other.purpose === 'any' && other.src === icon.src));
  const response = await fetch(server.base + icon.src);
  assert.match(response.headers.get('content-type'), /^image\/png/);
  const image = Buffer.from(await response.arrayBuffer());
  assert.equal(image.readUInt32BE(16),512);
  assert.equal(image.readUInt32BE(20),512);
});

test('PM-04 · El HTML de cada pantalla enlaza el manifiesto', async () => {
  for (const route of ['/', '/categorias', '/anuncios', '/anuncios/17', '/registro', '/login', '/perfil', '/publicar', '/mis-anuncios/18/pago', '/mis-anuncios/18/editar', '/admin']) {
    const html = await (await fetch(server.base + route)).text();
    assert.match(html, /<link\s+rel="manifest"\s+href="\/manifest.webmanifest"/, route);
  }
});

test('PM-05 · El worker se sirve en la raíz y prepara el aviso sin conexión', async () => {
  const response = await fetch(server.base + '/sw.js');
  assert.match(response.headers.get('content-type'), /javascript/);
  assert.match(response.headers.get('cache-control'), /no-cache/);
  const worker = await workerHarness();
  assert(worker.entries.has(server.base + '/sin-conexion.html'));
  const html = await fetch(server.base + '/sin-conexion.html');
  assert.match(await html.text(), /Sin conexión/);
});

test('PM-06 · API, comprobantes, fotos subidas y escrituras pasan solo por red', async () => {
  const worker = await workerHarness();
  for (const route of ['/api/anuncios','/api/auth/me','/api/perfil/anuncios','/api/anuncios/18/comprobante','/api/admin/resumen','/uploads/avisosur.webp']) {
    assert.equal(worker.dispatch(route),undefined, route);
  }
  assert.equal(worker.dispatch('/ayuda/seguridad', {method:'POST'}),undefined);
  assert.equal(worker.dispatch('https://example.invalid/foto.jpg'),undefined);
  const user = await server.register('pwa-foto');
  const ad = await server.listing(user.cookie);
  assert.equal(ad.response.status,201);
  const photo = await fetch(server.base + ad.body.imagen);
  assert.equal(photo.status,200);
  assert.equal(photo.headers.get('cache-control'),'no-store');
});

test('PM-07 · Una ayuda visitada abre sin red y una inédita muestra el aviso', async () => {
  const worker = await workerHarness();
  await worker.dispatch('/ayuda/seguridad');
  worker.goOffline();
  const saved = await worker.dispatch('/ayuda/seguridad');
  assert.equal(saved.status,200);
  assert.equal(await saved.text(), '/ayuda/seguridad');
  const unseen = await worker.dispatch('/ayuda/terminos');
  assert.equal(unseen.status,503);
  assert.match(await unseen.text(), /Sin conexión/);
});

test('PM-08 · Perfil, pago y detalle nunca se guardan, incluso tras visitarlos', async () => {
  const worker = await workerHarness();
  const paths = ['/perfil','/publicar','/mis-anuncios/18/pago','/mis-anuncios/18/editar','/admin','/login','/anuncios/18'];
  for (const route of paths) {
    assert.equal((await worker.dispatch(route)).status,200);
    assert.equal(worker.calls.at(-1).options.cache,'no-store');
    assert(!worker.entries.has(server.base + route), route);
  }
  worker.goOffline();
  for (const route of paths) {
    const response = await worker.dispatch(route);
    assert.equal(response.status,503);
    assert.equal(response.headers.get('cache-control'),'no-store');
    assert(!worker.entries.has(server.base + route), route);
  }
});

