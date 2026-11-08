import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createIsolatedApp, jsonRequest } from './support.mjs';

const day = 24 * 60 * 60 * 1000;

// Novedad propuesta en la Práctica 9 (2 de 2): reporte de estafa con revisión automática.
// Tres reportes de cuentas verificadas distintas ocultan el aviso hasta que lo revise el moderador.
describe('Novedad · Reporte de estafa y revisión automática', () => {
  let app, admin, seller, verified, unverified;
  before(async () => {
    app = await createIsolatedApp();
    admin = await app.admin();
    seller = await app.register('vendedor-reportado');
    verified = [await app.register('comprador-verificado-1'), await app.register('comprador-verificado-2'), await app.register('comprador-verificado-3')];
    unverified = [await app.register('comprador-sin-verificar-1', {}, { verificado: false }), await app.register('comprador-sin-verificar-2', {}, { verificado: false }), await app.register('comprador-sin-verificar-3', {}, { verificado: false })];
  });
  after(() => app?.close());
  const report = (cookie, id, body = { motivo: 'pide_adelanto' }) => app.request('/anuncios/' + id + '/reportes', jsonRequest(body, cookie));
  const inCatalog = async ad => (await app.request('/anuncios?q=' + encodeURIComponent(ad.titulo))).body.anuncios.some(item => item.id === ad.id);
  const resolve = (id, accion, cookie = admin.cookie) => app.request('/admin/anuncios/' + id + '/reportes/resolver', jsonRequest({ accion }, cookie));
  async function hiddenListing(titulo) {
    const ad = await app.publish(seller.cookie, { titulo });
    for (const buyer of verified) assert.equal((await report(buyer.cookie, ad.id)).response.status, 201);
    assert.equal(await inCatalog(ad), false);
    return ad;
  }

  it('Reportar un aviso exige iniciar sesión', async () => {
    const ad = await app.publish(seller.cookie, { titulo: 'Aviso que se intenta reportar sin cuenta' });
    assert.equal((await report('', ad.id)).response.status, 401);
  });

  it('Solo se aceptan los motivos de la lista y un detalle de hasta 500 caracteres', async () => {
    const ad = await app.publish(seller.cookie, { titulo: 'Aviso con motivos inválidos' });
    const invalid = await report(verified[0].cookie, ad.id, { motivo: 'no_me_gusta' });
    assert.equal(invalid.response.status, 422); assert(invalid.body.fields.motivo);
    const long = await report(verified[0].cookie, ad.id, { motivo: 'precio_sospechoso', detalle: 'x'.repeat(501) });
    assert.equal(long.response.status, 422); assert(long.body.fields.detalle);
    assert.equal((await app.db.get('SELECT COUNT(*) AS n FROM reportes WHERE anuncio_id = ?', ad.id)).n, 0);
  });

  it('El vendedor no puede reportar su propio aviso', async () => {
    const ad = await app.publish(seller.cookie, { titulo: 'Aviso que su dueño intenta reportar' });
    assert.equal((await report(seller.cookie, ad.id)).response.status, 403);
  });

  it('La misma persona reporta dos veces el mismo aviso → 409', async () => {
    const ad = await app.publish(seller.cookie, { titulo: 'Aviso reportado dos veces por la misma persona' });
    assert.equal((await report(verified[0].cookie, ad.id)).response.status, 201);
    const again = await report(verified[0].cookie, ad.id, { motivo: 'no_existe' });
    assert.equal(again.response.status, 409); assert.match(again.body.message, /Ya reportaste/);
    assert.equal((await app.db.get('SELECT COUNT(*) AS n FROM reportes WHERE anuncio_id = ?', ad.id)).n, 1);
  });

  it('Dos reportes de cuentas verificadas → el aviso sigue en el catálogo', async () => {
    const ad = await app.publish(seller.cookie, { titulo: 'Aviso con solo dos reportes' });
    for (const buyer of verified.slice(0, 2)) {
      const result = await report(buyer.cookie, ad.id);
      assert.equal(result.response.status, 201); assert.equal(result.body.enRevision, false);
    }
    assert.equal(await inCatalog(ad), true);
    assert.equal((await app.request('/anuncios/' + ad.id)).response.status, 200);
  });

  it('El tercero de otra cuenta verificada → ya no aparece en /api/anuncios ni en el detalle público', async () => {
    const ad = await app.publish(seller.cookie, { titulo: 'Aviso oculto por tres reportes' });
    const results = [];
    for (const buyer of verified) results.push(await report(buyer.cookie, ad.id, { motivo: 'no_existe', detalle: 'Pidió un adelanto por Yape antes de mostrar el cuarto.' }));
    assert.equal(results[2].response.status, 201); assert.equal(results[2].body.enRevision, true);
    assert.equal(await inCatalog(ad), false);
    assert.equal((await app.request('/anuncios/' + ad.id)).response.status, 404);
    assert.equal((await app.request('/anuncios/' + ad.id + '/contacto')).response.status, 404);
    const own = await app.request('/perfil/anuncios', { headers: { Cookie: seller.cookie } });
    assert.equal(own.body.find(item => item.id === ad.id).revisionReportes, true, 'El vendedor lo ve en su perfil como en revisión.');
    assert.equal((await app.request('/anuncios/' + ad.id, { headers: { Cookie: seller.cookie } })).response.status, 200);
  });

  it('Los reportes de cuentas sin verificar se guardan, pero no ocultan el aviso', async () => {
    const ad = await app.publish(seller.cookie, { titulo: 'Aviso reportado por cuentas sin verificar' });
    for (const buyer of unverified) assert.equal((await report(buyer.cookie, ad.id)).response.status, 201);
    assert.equal(await inCatalog(ad), true);
    assert.equal((await app.db.get('SELECT COUNT(*) AS n FROM reportes WHERE anuncio_id = ?', ad.id)).n, 3);
  });

  it('Solo administración ve y resuelve los reportes', async () => {
    const ad = await hiddenListing('Aviso oculto que un usuario intenta restaurar');
    assert.equal((await app.request('/admin/reportes', { headers: { Cookie: verified[0].cookie } })).response.status, 403);
    assert.equal((await resolve(ad.id, 'restaurar', seller.cookie)).response.status, 403);
    assert.equal(await inCatalog(ad), false);
  });

  it('La página del moderador agrupa los reportes pendientes por aviso, primero los ocultos', async () => {
    const ad = await hiddenListing('Aviso oculto en la página del moderador');
    const { response, body } = await app.request('/admin/reportes', { headers: { Cookie: admin.cookie } });
    assert.equal(response.status, 200);
    assert.equal(body[0].anuncio.revisionReportes, true);
    const group = body.find(item => item.anuncio.id === ad.id);
    assert.equal(group.reportes.length, 3); assert.equal(group.reportantesVerificados, 3);
    assert.equal(group.reportes[0].motivoTexto, 'Pide un adelanto antes de mostrar el producto');
    const summary = await app.request('/admin/resumen', { headers: { Cookie: admin.cookie } });
    assert(summary.body.reportesPendientes >= 3); assert(summary.body.ocultosPorReportes >= 1);
  });

  it('El moderador restaura el aviso: vuelve al catálogo, recupera sus días y los reportes pasan a revisados', async () => {
    const ad = await hiddenListing('Aviso restaurado por el moderador');
    const before = await app.db.get('SELECT fecha_vencimiento FROM anuncios WHERE id = ?', ad.id);
    await app.db.run('UPDATE anuncios SET fecha_revision_reportes = ? WHERE id = ?', new Date(Date.now() - 2 * day).toISOString(), ad.id); // Estuvo oculto dos días.
    const { response, body } = await resolve(ad.id, 'restaurar');
    assert.equal(response.status, 200, JSON.stringify(body)); assert.equal(body.revisionReportes, false);
    assert.equal(await inCatalog(ad), true);
    const extra = Date.parse(body.fechaVencimiento) - Date.parse(before.fecha_vencimiento);
    assert(Math.abs(extra - 2 * day) < 60000, 'Se devuelven los días que estuvo oculto: ' + extra);
    const reports = await app.db.all('SELECT estado, resolucion, revisado_por FROM reportes WHERE anuncio_id = ?', ad.id);
    assert(reports.every(item => item.estado === 'revisado' && item.resolucion === 'restaurado' && item.revisado_por === admin.id));
    assert.equal((await resolve(ad.id, 'restaurar')).response.status, 409, 'Sin reportes pendientes no hay nada que resolver.');
  });

  it('El moderador da de baja el aviso: no vuelve al catálogo y los reportes pasan a revisados', async () => {
    const ad = await hiddenListing('Aviso dado de baja por el moderador');
    assert.equal((await resolve(ad.id, 'borrar')).response.status, 422);
    const { response, body } = await resolve(ad.id, 'dar_de_baja');
    assert.equal(response.status, 200); assert.equal(body.estado, 'dado_de_baja');
    assert.equal(await inCatalog(ad), false);
    const reports = await app.db.all('SELECT estado, resolucion FROM reportes WHERE anuncio_id = ?', ad.id);
    assert(reports.every(item => item.estado === 'revisado' && item.resolucion === 'dado_de_baja'));
  });
});
