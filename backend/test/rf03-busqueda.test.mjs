import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createIsolatedApp, isolatedApp } from './support.mjs';

// RF-03: catálogo público, filtros combinados, búsqueda, orden, paginación y persistencia.
describe('RF-03 · Consulta y búsqueda', () => {
  let app, boundary;
  before(async () => {
    app = await createIsolatedApp();
    // Las pruebas aprueban sus propios datos con el mismo endpoint administrativo.
    const admin = await app.admin();
    for (const row of await app.db.all('SELECT id FROM anuncios ORDER BY id')) {
      const approved = await app.approve(admin.cookie, row.id);
      assert.equal(approved.response.status, 200, JSON.stringify(approved.body));
    }
    boundary = await app.publish((await app.register('vendedor-rf03')).cookie, { titulo: 'Moto de prueba en el límite', precio: '5000' });
  });
  after(() => app?.close());
  const search = async query => { const result = await app.request('/anuncios?' + query); assert.equal(result.response.status, 200, JSON.stringify(result.body)); return result.body; };

  it('Una instalación nueva deja los 16 anuncios DEMO pendientes y el catálogo público vacío', async t => {
    const fresh = await isolatedApp(t);
    assert.equal((await fresh.request('/anuncios')).body.total, 0);
    assert.equal((await fresh.db.get("SELECT COUNT(*) AS n FROM anuncios WHERE moderacion = 'pendiente' AND es_demo = 1")).n, 16);
  });

  it('Los anuncios aprobados cubren las tres categorías, Puno y Juliaca', async () => {
    const body = await search('limit=48');
    assert.equal(body.total, 17);
    assert.equal(new Set(body.anuncios.map(ad => ad.categoria)).size, 3);
    assert(body.anuncios.some(ad => ad.zona === 'Puno')); assert(body.anuncios.some(ad => ad.zona === 'Juliaca'));
    assert.equal(body.anuncios.filter(ad => ad.demo).length, 16);
  });

  it('El rango de precios incluye ambos extremos: Vehículos entre S/ 0 y S/ 5000', async () => {
    const body = await search('categoriaId=1&min=0&max=5000');
    assert(body.anuncios.every(ad => ad.categoriaId === 1 && ad.precio >= 0 && ad.precio <= 5000));
    assert(body.anuncios.some(ad => ad.id === 1 && ad.precio === 5000)); assert(body.anuncios.some(ad => ad.id === boundary.id));
    const exact = await search('min=5000&max=5000');
    assert(exact.anuncios.length >= 2); assert(exact.anuncios.every(ad => ad.precio === 5000));
  });

  it('Los filtros se combinan: categoría, subcategoría, zona, precio y texto', async () => {
    const body = await search('categoriaId=1&subcategoria=Motos&zona=Puno&min=0&max=5000&q=moto');
    assert(body.total >= 2);
    assert(body.anuncios.every(ad => ad.categoriaId === 1 && ad.subcategoria === 'Motos' && ad.zona === 'Puno' && ad.precio <= 5000));
  });

  it('La búsqueda ignora tildes y mayúsculas', async () => {
    const body = await search('q=HABITACION');
    assert(body.anuncios.some(ad => ad.titulo.includes('Habitación')));
  });

  it('Un rango con mínimo mayor que el máximo devuelve 422', async () => {
    const { response, body } = await app.request('/anuncios?min=6000&max=5000');
    assert.equal(response.status, 422); assert(body.fields.max);
  });

  it('Una búsqueda sin coincidencias devuelve una lista vacía', async () => {
    const body = await search('categoriaId=3&q=sincoincidencia-xyz');
    assert.equal(body.total, 0); assert.deepEqual(body.anuncios, []);
  });

  it('Un texto con SQL se busca como dato, sin alterar la consulta', async () => {
    const body = await search('q=' + encodeURIComponent("' OR 1=1 --"));
    assert.equal(body.total, 0);
    assert.equal((await app.db.get('SELECT COUNT(*) AS n FROM anuncios')).n, 17);
  });

  it('El orden por precio es ascendente o descendente según se pida', async () => {
    const ascending = (await search('sort=price_asc&limit=48')).anuncios.map(ad => ad.precio);
    const descending = (await search('sort=price_desc&limit=48')).anuncios.map(ad => ad.precio);
    assert.deepEqual(ascending, [...ascending].sort((a, b) => a - b));
    assert.deepEqual(descending, [...descending].sort((a, b) => b - a));
  });

  it('La paginación respeta el límite pedido y calcula el total de páginas', async () => {
    const first = await search('limit=5&page=1'); const second = await search('limit=5&page=2');
    assert.equal(first.anuncios.length, 5); assert.equal(first.totalPages, Math.ceil(first.total / 5));
    assert.equal(second.page, 2);
    assert(!second.anuncios.some(ad => first.anuncios.some(other => other.id === ad.id)), 'Las páginas no repiten anuncios.');
  });
});

describe('RF-03 · Persistencia', () => {
  it('Los anuncios, fotos y sesiones persisten al reiniciar, y el seed no se duplica', async t => {
    const app = await isolatedApp(t);
    const seller = await app.register('persistencia');
    const ad = await app.publish(seller.cookie, { titulo: 'Anuncio que sobrevive al reinicio', precio: '5000' });
    await app.restart();
    assert.equal((await app.db.get('SELECT COUNT(*) AS n FROM anuncios')).n, 17);
    const persisted = await app.request('/anuncios/' + ad.id);
    assert.equal(persisted.body.precio, 5000);
    assert.equal((await fetch(app.base + persisted.body.imagen)).status, 200);
    const profile = await app.request('/perfil/anuncios', { headers: { Cookie: seller.cookie } });
    assert.deepEqual(profile.body.map(item => item.id), [ad.id]);
  });
});
