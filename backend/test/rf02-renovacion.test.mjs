import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createIsolatedApp, jsonRequest } from './support.mjs';
import { registerRenewRoutes } from '../src/renovacion.mjs';

const DAY = 86400000;

describe('RF-02 · Volver a publicar un aviso vencido', () => {
  let app;
  before(async () => { app = await createIsolatedApp(); });
  after(() => app?.close());

  // Una sola aplicación aislada; cada caso registra su propio vendedor y sus propios avisos.
  let caso = 0;
  const account = name => app.register(name + '-' + (++caso));
  const renew = (id, cookie, body = {}) => app.request('/anuncios/' + id + '/renovar', jsonRequest(body, cookie));
  const row = async id => ({ ...await app.db.get('SELECT * FROM anuncios WHERE id = ?', id) });
  const photoRows = async id => (await app.db.all('SELECT * FROM fotos WHERE anuncio_id = ? ORDER BY orden', id)).map(photo => ({ ...photo }));
  const photoOrder = photos => photos.map(({ archivo, orden }) => ({ archivo, orden }));
  const totalListings = async () => Number((await app.db.get('SELECT COUNT(*) AS n FROM anuncios')).n);
  const expire = id => app.db.run('UPDATE anuncios SET fecha_vencimiento = ? WHERE id = ?', new Date(Date.now() - 86400000).toISOString(), id);
  const catalogIds = async q => (await app.request('/anuncios?q=' + encodeURIComponent(q))).body.anuncios.map(item => item.id);

  /** Un vendedor con un aviso que se aprobó y ya venció. */
  async function expiredListing(overrides = {}) {
    const seller = await account('vendedor-renovacion');
    const ad = await app.publish(seller.cookie, { titulo: 'Moto para volver a publicar ' + caso, ...overrides });
    await expire(ad.id);
    return { seller, ad };
  }

  it('Sin sesión devuelve 401 y no crea ningún aviso', async () => {
    const { ad } = await expiredListing();
    const count = await totalListings();
    assert.equal((await renew(ad.id, '')).response.status, 401);
    assert.equal(await totalListings(), count);
  });

  it('Otra cuenta recibe 403 y no crea ningún aviso', async () => {
    const { ad } = await expiredListing();
    const other = await account('otra-cuenta-renovacion');
    const count = await totalListings();
    const result = await renew(ad.id, other.cookie);
    assert.equal(result.response.status, 403);
    assert.equal(result.body.message, 'Solo puedes volver a publicar tus propios avisos.');
    assert.equal(await totalListings(), count);
  });

  it('Administración tampoco puede volver a publicar un aviso ajeno', async () => {
    const { ad } = await expiredListing();
    const count = await totalListings();
    assert.equal((await renew(ad.id, (await app.admin()).cookie)).response.status, 403);
    assert.equal(await totalListings(), count);
  });

  it('Sin celular verificado devuelve 403 aunque el aviso sea propio', async () => {
    const { seller, ad } = await expiredListing();
    await app.db.run('UPDATE usuarios SET celular_verificado = 0 WHERE id = ?', seller.id);
    const count = await totalListings();
    const result = await renew(ad.id, seller.cookie);
    assert.equal(result.response.status, 403);
    assert(result.body.fields.verificacion);
    assert.equal(await totalListings(), count);
  });

  it('Un identificador que no es un entero positivo, o que no existe, devuelve 404', async () => {
    const seller = await account('vendedor-renovacion');
    const count = await totalListings();
    for (const id of ['0', '-1', '1.5', 'abc', '9007199254740992', '99999999']) assert.equal((await renew(id, seller.cookie)).response.status, 404, id);
    assert.equal(await totalListings(), count);
  });

  it('Un aviso todavía vigente devuelve 409 y queda igual', async () => {
    const seller = await account('vendedor-renovacion');
    const ad = await app.publish(seller.cookie, { titulo: 'Moto todavía vigente ' + caso });
    const before = await row(ad.id), count = await totalListings();
    const result = await renew(ad.id, seller.cookie);
    assert.equal(result.response.status, 409);
    assert.match(result.body.message, /sigue vigente/);
    assert.deepEqual(await row(ad.id), before);
    assert.equal(await totalListings(), count);
  });

  it('Un aviso pendiente que nunca se aprobó devuelve 409 aunque su fecha ya haya pasado', async () => {
    const seller = await account('vendedor-renovacion');
    const created = await app.listing(seller.cookie, { titulo: 'Moto nunca aprobada ' + caso });
    assert.equal(created.response.status, 201, JSON.stringify(created.body));
    await expire(created.body.id);
    const count = await totalListings();
    const result = await renew(created.body.id, seller.cookie);
    assert.equal(result.response.status, 409);
    assert.match(result.body.message, /todavía no fue aprobado/);
    assert.equal(await totalListings(), count);
  });

  it('Un aviso vencido y dado de baja devuelve 409', async () => {
    const { seller, ad } = await expiredListing();
    assert.equal((await app.request('/anuncios/' + ad.id + '/baja', { method: 'PATCH', headers: { Cookie: seller.cookie } })).response.status, 200);
    const count = await totalListings();
    const result = await renew(ad.id, seller.cookie);
    assert.equal(result.response.status, 409);
    assert.match(result.body.message, /dado de baja/);
    assert.equal(await totalListings(), count);
  });

  it('Un aviso vencido y oculto por reportes devuelve 409', async () => {
    const { seller, ad } = await expiredListing();
    await app.db.run('UPDATE anuncios SET revision_reportes = 1, fecha_revision_reportes = ? WHERE id = ?', new Date().toISOString(), ad.id);
    const count = await totalListings();
    const result = await renew(ad.id, seller.cookie);
    assert.equal(result.response.status, 409);
    assert.match(result.body.message, /reportes/);
    assert.equal(await totalListings(), count);
  });

  it('Un aviso vencido crea una solicitud nueva con los mismos datos, pendiente de pago y revisión', async () => {
    const { seller, ad } = await expiredListing({ precio: '1250.50', tipoOperacion: 'alquiler', zona: 'Juliaca', direccion: 'Jr. Lima 456', referencia: 'Cerca del mercado', contacto: '987654321' });
    const result = await renew(ad.id, seller.cookie);
    assert.equal(result.response.status, 201, JSON.stringify(result.body));
    const nuevo = result.body;
    assert.notEqual(nuevo.id, ad.id);
    assert.equal(nuevo.titulo, ad.titulo);
    assert.equal(nuevo.precio, 1250.5);
    assert.equal(nuevo.moderacion, 'pendiente');
    assert.equal(nuevo.estadoPago, 'pendiente');
    assert.equal(nuevo.fechaAprobacion, null);
    assert.equal(nuevo.fechaVencimiento, null);
    for (const field of ['usuarioId', 'descripcion', 'zona', 'categoriaId', 'subcategoria', 'tipoOperacion', 'direccion', 'referencia', 'contacto', 'demo', 'estado']) assert.deepEqual(nuevo[field], ad[field], field);
    const copy = await row(nuevo.id), original = await row(ad.id);
    for (const column of ['usuario_id', 'titulo', 'descripcion', 'precio_centimos', 'zona', 'categoria_id', 'subcategoria', 'tipo_operacion', 'es_demo', 'direccion', 'referencia', 'contacto']) assert.equal(copy[column], original[column], column);
    assert.equal(copy.precio_centimos, 125050);
    assert.equal(copy.comprobante_archivo, null);
    assert.equal(copy.revision_reportes, 0);
    const plan = await app.db.get('SELECT * FROM planes_publicacion WHERE id = 1');
    assert.deepEqual([copy.plan_id, copy.dias_vigencia, copy.monto_publicacion_centimos], [plan.id, plan.dias, plan.precio_centimos]);
  });

  it('Las fotos se copian con el mismo archivo y en el mismo orden, sin archivos nuevos en el disco', async () => {
    const seller = await account('vendedor-renovacion');
    const link = 'https://imagenes.example.com/moto-de-perfil.jpg';
    const created = await app.listing(seller.cookie, { titulo: 'Moto con fotos y enlace ' + caso, fotosUrl: link, ordenFotos: JSON.stringify(['f:1', 'u:0', 'f:0']) }, 2);
    assert.equal(created.response.status, 201, JSON.stringify(created.body));
    assert.equal((await app.approve((await app.admin()).cookie, created.body.id)).response.status, 200);
    await expire(created.body.id);
    const original = photoOrder(await photoRows(created.body.id));
    assert.equal(original.length, 3);
    assert.equal(new Set(original.map(photo => photo.archivo)).size, 3);
    assert.equal(original[1].archivo, link);
    const files = (await fs.readdir(app.settings.uploadDir)).sort();
    const result = await renew(created.body.id, seller.cookie);
    assert.equal(result.response.status, 201, JSON.stringify(result.body));
    assert.deepEqual(photoOrder(result.body.fotos), original);
    assert.deepEqual(photoOrder(await photoRows(result.body.id)), original);
    assert.equal(result.body.imagen, original[0].archivo);
    assert.deepEqual((await fs.readdir(app.settings.uploadDir)).sort(), files);
  });

  it('El aviso anterior no cambia y el nuevo no aparece en el catálogo antes de su aprobación', async () => {
    const { seller, ad } = await expiredListing();
    const before = await row(ad.id), photosBefore = await photoRows(ad.id);
    const result = await renew(ad.id, seller.cookie);
    assert.equal(result.response.status, 201, JSON.stringify(result.body));
    assert.deepEqual(await row(ad.id), before);
    assert.deepEqual(await photoRows(ad.id), photosBefore);
    const listed = await catalogIds(ad.titulo);
    assert(!listed.includes(result.body.id));
    assert(!listed.includes(ad.id));
    assert.equal((await app.request('/anuncios/' + result.body.id)).response.status, 404);
    const own = (await app.request('/perfil/anuncios', { headers: { Cookie: seller.cookie } })).body;
    assert(own.some(item => item.id === ad.id && item.moderacion === 'aprobado'));
    assert(own.some(item => item.id === result.body.id && item.moderacion === 'pendiente'));
  });

  it('Con comprobante y aprobación, el aviso nuevo aparece en el catálogo con una vigencia nueva', async () => {
    const { seller, ad } = await expiredListing();
    const renewed = await renew(ad.id, seller.cookie);
    assert.equal(renewed.response.status, 201, JSON.stringify(renewed.body));
    const paid = await app.proof(seller.cookie, renewed.body.id);
    assert.equal(paid.response.status, 200, JSON.stringify(paid.body));
    assert.equal(paid.body.estadoPago, 'en_revision');
    const approved = await app.approve((await app.admin()).cookie, renewed.body.id);
    assert.equal(approved.response.status, 200, JSON.stringify(approved.body));
    const listed = await catalogIds(ad.titulo);
    assert(listed.includes(renewed.body.id));
    assert(!listed.includes(ad.id));
    const { fechaAprobacion, fechaVencimiento, diasVigencia, diasPromocion } = approved.body;
    assert(Date.parse(fechaVencimiento) > Date.now());
    assert(Date.parse(fechaVencimiento) > Date.parse((await row(ad.id)).fecha_vencimiento));
    assert.equal(Date.parse(fechaVencimiento) - Date.parse(fechaAprobacion), (diasVigencia + diasPromocion) * DAY);
  });

  it('El plan se elige con planId: uno inactivo devuelve 422 y uno activo fija el monto y los días', async () => {
    const { seller, ad } = await expiredListing();
    const count = await totalListings();
    const inactive = await renew(ad.id, seller.cookie, { planId: 2 });
    assert.equal(inactive.response.status, 422);
    assert(inactive.body.fields.planId);
    assert.equal(await totalListings(), count);
    const plan = await app.request('/admin/planes', jsonRequest({ nombre: 'Quincenal de prueba ' + caso, precio: 3, dias: 15, bonoPrimerAnuncio: 0, destacado: false, activo: true }, (await app.admin()).cookie));
    assert.equal(plan.response.status, 201, JSON.stringify(plan.body));
    const result = await renew(ad.id, seller.cookie, { planId: plan.body.id });
    assert.equal(result.response.status, 201, JSON.stringify(result.body));
    assert.deepEqual([result.body.planId, result.body.diasVigencia, result.body.montoPublicacion], [plan.body.id, 15, 3]);
  });

  it('En MySQL bloquea el aviso, copia el precio en soles y las filas de sus fotos', async () => {
    // Contrato del adaptador: no abre una conexión ni usa las credenciales de MySQL.
    const ad = { id: 7, usuario_id: 3, titulo: 'Moto vencida en MySQL', descripcion: 'Descripción de la moto.', precio: '1250.50', zona: 'Puno', categoria_id: 1, subcategoria: 'Motos', tipo_operacion: 'venta', es_demo: 0, direccion: '', referencia: '', contacto: '900000003', estado: 'activo', moderacion: 'aprobado', estado_pago: 'confirmado', revision_reportes: 0, fecha_aprobacion: new Date(Date.now() - 8 * DAY).toISOString(), fecha_vencimiento: new Date(Date.now() - DAY).toISOString() };
    const photos = [{ archivo: 'https://imagenes.example.com/portada.jpg', orden: 0, fecha_subida: ad.fecha_aprobacion }, { archivo: '/uploads/segunda.webp', orden: 1, fecha_subida: ad.fecha_aprobacion }];
    let handler, transactionActive = false, selectedWithLock = false;
    const writes = [];
    const db = {
      kind: 'mysql',
      async transaction(work) { transactionActive = true; try { return await work(db); } finally { transactionActive = false; } },
      async get(sql) {
        if (sql.startsWith('SELECT * FROM anuncios')) {
          selectedWithLock = transactionActive && sql.endsWith(' FOR UPDATE');
          return ad;
        }
        if (sql.includes('FROM planes_publicacion')) return { id: 1, dias: 7, precio_centimos: 500, bono_primer_anuncio: 0, destacado: 0 };
        if (sql.startsWith('SELECT id, nombre, celular')) return { id: 3, nombre: 'Vendedor de prueba', celular: '900000003' };
        if (sql.startsWith('SELECT SUM')) return { publicados: 1, bajas: 0 };
        if (sql.includes('FROM contactos_anuncio')) return { n: 0 };
        return { ...ad, id: 8 };
      },
      async all(sql) { return transactionActive && sql.includes('FROM fotos') ? photos : []; },
      async run(sql, ...values) { assert(transactionActive); writes.push({ sql, values }); return { lastInsertRowid: 8 }; },
    };
    registerRenewRoutes({ post(_path, ...handlers) { handler = handlers.at(-1); } }, db, { requireUser() {} });
    const response = {};
    await handler({ params: { id: '7' }, user: { id: 3 }, body: {} }, { status(code) { response.status = code; return this; }, json(value) { response.body = value; } });
    assert(selectedWithLock);
    assert.equal(response.status, 201);
    const [listingInsert, ...photoInserts] = writes;
    assert.match(listingInsert.sql, /^INSERT INTO anuncios \(usuario_id, titulo, descripcion, precio, /);
    assert.doesNotMatch(listingInsert.sql, /precio_centimos/);
    assert.equal(listingInsert.values[3], '1250.50');
    assert(photoInserts.every(write => write.sql.startsWith('INSERT INTO fotos ')));
    assert.deepEqual(photoInserts.map(write => write.values), photos.map(photo => [8, photo.archivo, photo.orden, photo.fecha_subida]));
  });
});
