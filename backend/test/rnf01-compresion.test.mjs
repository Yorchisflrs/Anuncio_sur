import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { createIsolatedApp } from './support.mjs';
import { preferredEncoding } from '../src/static.mjs';

// RNF-01 (Práctica 10, Lighthouse): el JS y el CSS de la compilación viajan comprimidos y lo que tiene hash
// se guarda en el navegador. Se usa una compilación falsa en una carpeta temporal.
describe('RNF-01 · Archivos de la aplicación comprimidos y en caché', () => {
  let app, dist;
  const script = 'console.log("AvisoSur");\n'.repeat(400);

  before(async () => {
    dist = await fs.mkdtemp(path.join(os.tmpdir(), 'avisosur-test-dist-'));
    await fs.mkdir(path.join(dist, 'assets'));
    await fs.writeFile(path.join(dist, 'index.html'), '<!doctype html><title>AvisoSur</title><div id="root"></div>');
    await fs.writeFile(path.join(dist, 'assets', 'index-abc123.js'), script);
    await fs.writeFile(path.join(dist, 'robots.txt'), 'User-agent: *\nAllow: /\n');
    app = await createIsolatedApp({ frontendDist: dist });
  });
  after(async () => {
    await app?.close();
    if (dist) await fs.rm(dist, { recursive: true, force: true });
  });

  // Pedido HTTP sin descomprimir, para ver los bytes que viajan de verdad.
  const raw = (route, headers = {}) => new Promise((resolve, reject) => {
    http.get(app.base + route, { headers }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks) }));
    }).on('error', reject);
  });

  it('Con Brotli aceptado, el JS viaja comprimido, más liviano y con el mismo contenido', async () => {
    const { status, headers, body } = await raw('/assets/index-abc123.js', { 'Accept-Encoding': 'gzip, deflate, br' });
    assert.equal(status, 200);
    assert.equal(headers['content-encoding'], 'br');
    assert.match(headers['content-type'], /javascript/);
    assert.match(headers.vary, /Accept-Encoding/);
    assert(body.length < Buffer.byteLength(script) / 5, 'Pesa ' + body.length + ' bytes de ' + Buffer.byteLength(script));
    assert.equal(zlib.brotliDecompressSync(body).toString(), script);
  });

  it('Un navegador que solo acepta gzip lo recibe en gzip, y uno sin compresión lo recibe tal cual', async () => {
    const gzip = await raw('/assets/index-abc123.js', { 'Accept-Encoding': 'gzip' });
    assert.equal(gzip.headers['content-encoding'], 'gzip');
    assert.equal(zlib.gunzipSync(gzip.body).toString(), script);
    const plain = await raw('/assets/index-abc123.js', { 'Accept-Encoding': 'identity' });
    assert.equal(plain.headers['content-encoding'], undefined);
    assert.equal(plain.body.toString(), script);
  });

  it('Lo que tiene hash en /assets se guarda un año; el HTML se vuelve a validar siempre', async () => {
    assert.equal((await raw('/assets/index-abc123.js')).headers['cache-control'], 'public, max-age=31536000, immutable');
    const page = await raw('/anuncios/17', { 'Accept-Encoding': 'br' });
    assert.equal(page.status, 200, 'Las rutas de React reciben index.html.');
    assert.equal(page.headers['cache-control'], 'no-cache');
    assert.match(zlib.brotliDecompressSync(page.body).toString(), /<div id="root">/);
  });

  it('Con el ETag vigente responde 304 sin volver a mandar el archivo', async () => {
    const first = await raw('/assets/index-abc123.js', { 'Accept-Encoding': 'br' });
    const again = await raw('/assets/index-abc123.js', { 'Accept-Encoding': 'br', 'If-None-Match': first.headers.etag });
    assert.equal(again.status, 304);
    assert.equal(again.body.length, 0);
  });

  it('robots.txt se sirve como texto, no como la página de la aplicación', async () => {
    const robots = await raw('/robots.txt');
    assert.equal(robots.status, 200);
    assert.match(robots.headers['content-type'], /^text\/plain/);
    assert.match(robots.body.toString(), /User-agent: \*/);
  });

  it('No se puede salir de la carpeta de la compilación', async () => {
    for (const route of ['/assets/..%2f..%2fpackage.json', '/%2e%2e/%2e%2e/backend/src/config.mjs']) {
      const { body } = await raw(route);
      assert(!body.toString().includes('"dependencies"') && !body.toString().includes('loadEnvFile'), 'Se filtró un archivo de fuera con ' + route);
    }
  });

  it('La preferencia respeta lo que acepta el navegador', () => {
    assert.equal(preferredEncoding('gzip, deflate, br'), 'br');
    assert.equal(preferredEncoding('br;q=0, gzip'), 'gzip');
    assert.equal(preferredEncoding('identity'), null);
    assert.equal(preferredEncoding(''), null);
  });
});
