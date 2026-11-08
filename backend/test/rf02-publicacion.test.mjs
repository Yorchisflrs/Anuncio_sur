import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { createIsolatedApp, jsonRequest } from './support.mjs';
import { DEMO_USER } from '../src/seed.mjs';

// RF-02: publicación autenticada con fotos, validación en el servidor y baja del propietario.
describe('RF-02 · Publicación de anuncios', () => {
  let app, seller, png, jpeg;
  before(async () => {
    app = await createIsolatedApp();
    seller = await app.register('vendedor-rf02');
    png = { buffer: await sharp({ create: { width: 1024, height: 768, channels: 3, background: '#0db6b2' } }).png().toBuffer(), name: 'principal.png', type: 'image/png' };
    jpeg = { buffer: await sharp({ create: { width: 800, height: 600, channels: 3, background: '#1465b8' } }).jpeg().toBuffer(), name: 'segunda.jpg', type: 'image/jpeg' };
  });
  after(() => app?.close());
  const count = async table => (await app.db.get(`SELECT COUNT(*) AS n FROM ${table}`)).n;
  const uploaded = async () => (await fs.readdir(app.settings.uploadDir).catch(() => [])).sort();

  it('Un anuncio por S/ 1 con tres fotos se guarda en menos de cinco segundos como solicitud privada', async () => {
    const started = performance.now();
    const { response, body } = await app.listingWith(seller.cookie, { titulo: 'Producto de prueba a un sol', precio: '1' }, [png, jpeg, png]);
    const elapsed = performance.now() - started;
    assert.equal(response.status, 201, JSON.stringify(body));
    assert.equal(body.precio, 1); assert.equal(body.moderacion, 'pendiente');
    assert.deepEqual(body.fotos.map(photo => photo.orden), [0, 1, 2]);
    assert(body.fotos.every(photo => photo.archivo.endsWith('.webp')));
    assert(elapsed < 5000, 'La publicación tardó ' + Math.round(elapsed) + ' ms');
    assert.equal((await app.request('/anuncios/' + body.id)).response.status, 404);
    assert.equal((await app.request('/anuncios?q=' + encodeURIComponent('Producto de prueba a un sol'))).body.total, 0);
  });

  it('Al aprobarse, el anuncio aparece en el catálogo y su foto se sirve como WebP', async () => {
    const ad = await app.publish(seller.cookie, { titulo: 'Anuncio aprobado con foto WebP' });
    const catalog = await app.request('/anuncios?q=' + encodeURIComponent(ad.titulo));
    assert(catalog.body.anuncios.some(item => item.id === ad.id));
    const image = await fetch(app.base + ad.fotos[0].archivo);
    assert.equal(image.status, 200); assert.match(image.headers.get('content-type'), /image\/webp/);
  });

  it('Precio S/ 0 y categoría vacía devuelven 422 sin guardar el anuncio ni sus fotos', async () => {
    const [ads, files] = [await count('anuncios'), await uploaded()];
    const { response, body } = await app.listingWith(seller.cookie, { categoriaId: '', precio: '0' }, [png]);
    assert.equal(response.status, 422); assert(body.fields.precio); assert(body.fields.categoriaId);
    assert.equal(await count('anuncios'), ads); assert.deepEqual(await uploaded(), files);
  });

  it('La foto, la descripción y la zona son obligatorias', async () => {
    const { response, body } = await app.listingWith(seller.cookie, { descripcion: '', zona: '' }, []);
    assert.equal(response.status, 422); assert(body.fields.descripcion); assert(body.fields.zona); assert(body.fields.fotos);
  });

  it('Un archivo que no es una imagen real se rechaza aunque diga ser PNG', async () => {
    const { response, body } = await app.listingWith(seller.cookie, {}, [{ buffer: Buffer.from('no es una imagen'), name: 'falsa.png', type: 'image/png' }]);
    assert.equal(response.status, 422); assert(body.fields.fotos);
  });

  it('Ocho fotos se rechazan sin dejar anuncios ni archivos huérfanos', async () => {
    const [ads, files] = [await count('anuncios'), await uploaded()];
    const { response, body } = await app.listing(seller.cookie, { titulo: 'No debe guardarse con ocho fotos' }, 8);
    assert.equal(response.status, 422); assert(body.fields.fotos);
    assert.equal(await count('anuncios'), ads); assert.deepEqual(await uploaded(), files);
  });

  it('Una foto de más de 2 MB se rechaza con un mensaje sobre el tamaño', async () => {
    const { response, body } = await app.listingWith(seller.cookie, {}, [{ buffer: Buffer.alloc(2 * 1024 * 1024 + 1), name: 'grande.png', type: 'image/png' }]);
    assert.equal(response.status, 422); assert.match(body.fields.fotos, /2 MB/);
  });

  it('Solo el propietario da de baja su anuncio; el registro se conserva y deja de ser público', async () => {
    const ad = await app.publish(seller.cookie, { titulo: 'Anuncio que se dará de baja' });
    const other = await app.register('otro-vendedor-rf02');
    assert.equal((await app.request('/anuncios/' + ad.id + '/baja', { method: 'PATCH', headers: { Cookie: other.cookie } })).response.status, 403);
    assert.equal((await app.request('/anuncios/' + ad.id + '/baja', { method: 'PATCH', headers: { Cookie: seller.cookie } })).response.status, 200);
    assert.equal((await app.request('/anuncios?q=' + encodeURIComponent(ad.titulo))).body.total, 0);
    assert.equal((await app.request('/anuncios/' + ad.id)).response.status, 404);
    const own = await app.request('/anuncios/' + ad.id, { headers: { Cookie: seller.cookie } });
    assert.equal(own.response.status, 200); assert.equal(own.body.estado, 'dado_de_baja');
    const profile = await app.request('/perfil/anuncios', { headers: { Cookie: seller.cookie } });
    assert(profile.body.some(item => item.id === ad.id && item.estado === 'dado_de_baja'));
  });

  it('El aviso indica si es venta o alquiler; sin el campo se guarda como venta', async () => {
    const rent = await app.listing(seller.cookie, { titulo: 'Cuarto amoblado cerca de la UNA', categoriaId: '2', subcategoria: 'Habitaciones', precio: '300', tipoOperacion: 'alquiler' });
    assert.equal(rent.response.status, 201, JSON.stringify(rent.body)); assert.equal(rent.body.tipoOperacion, 'alquiler');
    const sale = await app.listing(seller.cookie, { titulo: 'Moto sin tipo de operación' });
    assert.equal(sale.response.status, 201); assert.equal(sale.body.tipoOperacion, 'venta');
    const invalid = await app.listing(seller.cookie, { titulo: 'Tipo de operación inválido', tipoOperacion: 'permuta' });
    assert.equal(invalid.response.status, 422); assert(invalid.body.fields.tipoOperacion);
  });

  it('El aviso muestra el nombre elegido por el vendedor, nunca una parte de su correo', async () => {
    const named = await app.register('correo-privado-rf02', { nombre: 'Rosa Quispe' });
    const ad = await app.publish(named.cookie, { titulo: 'Aviso con nombre para mostrar' });
    const detail = await app.request('/anuncios/' + ad.id);
    assert.equal(detail.body.vendedor.nombre, 'Rosa Quispe');
    assert(!JSON.stringify(detail.body).includes('correo-privado-rf02'), 'El correo no aparece en el detalle público.');
    await app.db.run("UPDATE usuarios SET nombre = '' WHERE id = ?", named.id); // Cuenta creada antes de pedir el nombre.
    assert.equal((await app.request('/anuncios/' + ad.id)).body.vendedor.nombre, 'Vendedor de AvisoSur');
  });

  it('La cuenta demo publica con la marca DEMO aunque el formulario intente quitarla', async () => {
    const cookie = await app.login(DEMO_USER.correo, DEMO_USER.password);
    const { response, body } = await app.listing(cookie, { titulo: 'Anuncio ficticio desde la cuenta demo', demo: 'false', es_demo: '0' });
    assert.equal(response.status, 201, JSON.stringify(body));
    assert.equal(body.demo, true); assert.equal(body.vendedor.demo, true); assert.equal(body.moderacion, 'pendiente');
    assert.equal((await app.request('/anuncios/' + body.id)).response.status, 404);
  });

  it('Los campos de moderación enviados por el vendedor se ignoran', async () => {
    const { response, body } = await app.listing(seller.cookie, { titulo: 'Intento de autoaprobación', moderacion: 'aprobado', estadoPago: 'confirmado', fechaVencimiento: '2099-01-01T00:00:00.000Z' });
    assert.equal(response.status, 201);
    assert.equal(body.moderacion, 'pendiente'); assert.equal(body.estadoPago, 'pendiente'); assert.equal(body.fechaVencimiento, null);
    assert.equal((await app.request('/admin/anuncios/' + body.id + '/aprobar', jsonRequest({ confirmarPago: true, referenciaPago: 'Intento propio' }, seller.cookie))).response.status, 403);
  });
});
