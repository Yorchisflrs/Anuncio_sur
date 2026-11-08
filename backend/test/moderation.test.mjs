import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createIsolatedApp, isolatedApp, jsonRequest, testPicture } from './support.mjs';
import { DEMO_USER } from '../src/seed.mjs';

const day = 24 * 60 * 60 * 1000;
const denied = status => assert([403, 404].includes(status), 'Un tercero no debe acceder al recurso privado: ' + status);
const listingOk = result => { assert.equal(result.response.status, 201, JSON.stringify(result.body)); return result.body; };
const approvedOk = result => { assert.equal(result.response.status, 200, JSON.stringify(result.body)); return result.body; };

// Publicación pagada: revisión administrativa, comprobante privado, planes y vigencia.
describe('Moderación, pagos manuales y planes', () => {
  let app, admin, owner, stranger;
  before(async () => {
    app = await createIsolatedApp();
    admin = await app.administrator();
    owner = await app.register('propietario');
    stranger = await app.register('tercero');
  });
  after(() => app?.close());
  const publicTotal = async () => (await app.request('/categorias')).body.reduce((sum, category) => sum + category.total, 0);

  it('La instalación inicia con anuncios pendientes y sin simular un QR o un pago', async t => {
    const fresh = await isolatedApp(t);
    const freshAdmin = await fresh.administrator();
    const catalog = await fresh.request('/anuncios');
    assert.equal(catalog.response.status, 200); assert.equal(catalog.body.total, 0);
    const categories = await fresh.request('/categorias');
    assert.equal(categories.body.length, 3); assert(categories.body.every(item => item.total === 0));
    const publication = await fresh.request('/publicacion');
    assert.equal(publication.response.status, 200);
    const week = publication.body.planes.find(item => item.id === 1);
    assert(week); assert.equal(week.precio, 5); assert.equal(week.dias, 7); assert.equal(week.bonoPrimerAnuncio, 0);
    assert(publication.body.planes.every(plan => plan.activo));
    assert.equal(publication.body.pago.configurado, false); assert.equal(publication.body.pago.qrUrl, null);
    const privateCatalog = await fresh.request('/admin/anuncios', { headers: { Cookie: freshAdmin.cookie } });
    assert.equal(privateCatalog.response.status, 200); assert.equal(privateCatalog.body.length, 16);
    assert(privateCatalog.body.every(ad => ad.moderacion === 'pendiente' && ad.demo));
    assert.equal((await fresh.request('/anuncios/1')).response.status, 404);
    const plans = await fresh.request('/admin/planes', { headers: { Cookie: freshAdmin.cookie } });
    assert.equal(plans.response.status, 200); assert.equal(plans.body.length, 3);
    assert(plans.body.filter(plan => plan.id !== 1).every(plan => !plan.activo));
  });

  it('El registro ignora el rol enviado y las operaciones administrativas exigen admin', async () => {
    const attemptedAdmin = await app.register('rol-manipulado', { rol: 'admin', role: 'admin', es_admin: true });
    assert.equal(attemptedAdmin.rol, 'usuario');
    assert.equal((await app.db.get('SELECT rol FROM usuarios WHERE id = ?', attemptedAdmin.id)).rol, 'usuario');
    assert.equal((await app.request('/admin/resumen')).response.status, 401);
    for (const endpoint of ['/admin/resumen', '/admin/anuncios', '/admin/planes']) {
      assert.equal((await app.request(endpoint, { headers: { Cookie: attemptedAdmin.cookie } })).response.status, 403);
    }
    const config = await app.request('/admin/configuracion', jsonRequest({ metodo: 'Yape', titular: 'No autorizado', numero: '900000001', instrucciones: 'No permitido' }, attemptedAdmin.cookie, 'PUT'));
    assert.equal(config.response.status, 403);
    const plan = await app.request('/admin/planes/1', jsonRequest({ precio: 0 }, attemptedAdmin.cookie, 'PATCH'));
    assert.equal(plan.response.status, 403);
  });

  it('Siete fotos se guardan en orden; el anuncio pendiente sólo lo ven propietario y admin', async () => {
    const ad = listingOk(await app.listing(owner.cookie, { titulo: 'Siete fotos privadas en revisión' }, 7));
    assert.equal(ad.moderacion, 'pendiente'); assert.equal(ad.fotos.length, 7);
    assert.deepEqual(ad.fotos.map(photo => photo.orden), [0, 1, 2, 3, 4, 5, 6]);
    assert(ad.fotos.every(photo => photo.archivo.endsWith('.webp')));
    assert.equal(ad.planId, 1); assert.equal(ad.montoPublicacion, 5); assert.equal(ad.diasVigencia, 7);
    assert.equal(ad.fechaAprobacion, null); assert.equal(ad.fechaVencimiento, null);
    assert.equal((await app.request('/anuncios/' + ad.id)).response.status, 404);
    assert.equal((await app.request('/anuncios/' + ad.id, { headers: { Cookie: stranger.cookie } })).response.status, 404);
    assert.equal((await app.request('/anuncios/' + ad.id, { headers: { Cookie: owner.cookie } })).response.status, 200);
    assert.equal((await app.request('/anuncios/' + ad.id, { headers: { Cookie: admin.cookie } })).response.status, 200);
    assert.equal((await app.request('/anuncios?q=' + encodeURIComponent(ad.titulo))).body.total, 0);
  });

  it('El comprobante es privado, válido como imagen y no publica automáticamente', async () => {
    const ad = listingOk(await app.listing(owner.cookie, { titulo: 'Pago adjunto sigue en revisión' }));
    assert.equal((await app.proof(owner.cookie, ad.id, Buffer.from('imagen falsa'))).response.status, 422);
    const uploaded = await app.proof(owner.cookie, ad.id, null, { referenciaPago: '  OPERACION-FICTICIA-123  ' });
    assert.equal(uploaded.response.status, 200, JSON.stringify(uploaded.body));
    assert.equal(uploaded.body.pago.referenciaPago, 'OPERACION-FICTICIA-123');
    const filesBeforeInvalidReference = (await fs.readdir(app.settings.privateUploadDir)).sort();
    const longReference = await app.proof(owner.cookie, ad.id, null, { referenciaPago: 'R'.repeat(161) });
    assert.equal(longReference.response.status, 422); assert(longReference.body.fields.referenciaPago);
    assert.deepEqual((await fs.readdir(app.settings.privateUploadDir)).sort(), filesBeforeInvalidReference, 'La referencia inválida se rechaza antes de guardar un archivo.');
    const replacementWithoutReference = await app.proof(owner.cookie, ad.id);
    assert.equal(replacementWithoutReference.response.status, 200);
    assert.equal(replacementWithoutReference.body.pago.referenciaPago, 'OPERACION-FICTICIA-123', 'Omitir el campo conserva la referencia existente.');
    const detail = await app.request('/anuncios/' + ad.id, { headers: { Cookie: owner.cookie } });
    assert.equal(detail.body.moderacion, 'pendiente'); assert.equal(detail.body.fechaAprobacion, null);
    assert.equal(detail.body.pago.comprobanteUrl, '/api/anuncios/' + ad.id + '/comprobante');
    assert.equal((await app.request('/anuncios?q=' + encodeURIComponent(ad.titulo))).body.total, 0);
    const anonymous = await fetch(app.base + detail.body.pago.comprobanteUrl);
    assert.equal(anonymous.status, 401);
    const thirdParty = await fetch(app.base + detail.body.pago.comprobanteUrl, { headers: { Cookie: stranger.cookie } });
    denied(thirdParty.status);
    denied((await app.proof(stranger.cookie, ad.id)).response.status);
    for (const cookie of [owner.cookie, admin.cookie]) {
      const actual = await fetch(app.base + detail.body.pago.comprobanteUrl, { headers: { Cookie: cookie } });
      assert.equal(actual.status, 200); assert.match(actual.headers.get('content-type'), /^image\//);
      assert((await actual.arrayBuffer()).byteLength > 0);
    }
    const stored = (await fs.readdir(app.settings.privateUploadDir, { recursive: true })).filter(name => !String(name).endsWith('/'));
    assert(stored.length > 0, 'Los archivos privados deben quedar dentro del temporal de esta prueba.');
    assert.equal((await fetch(app.base + '/uploads/.privado/')).status, 404);
  });

  it('Aprobar exige administrador, confirmación explícita y comprobante o referencia', async () => {
    const ad = listingOk(await app.listing(owner.cookie, { titulo: 'No aprobar sin revisar pago' }));
    assert.equal((await app.approve(owner.cookie, ad.id)).response.status, 403);
    assert.equal((await app.request('/admin/anuncios/' + ad.id + '/aprobar', jsonRequest({ referenciaPago: 'Referencia sin confirmar pago' }, admin.cookie))).response.status, 422);
    assert.equal((await app.approve(admin.cookie, ad.id, { referenciaPago: '' })).response.status, 422);
    assert.equal((await app.request('/anuncios/' + ad.id, { headers: { Cookie: owner.cookie } })).body.moderacion, 'pendiente');
    assert.equal((await app.request('/anuncios/' + ad.id)).response.status, 404);
  });

  it('La aprobación con comprobante inicia siete días y publica sin exponer el pago', async () => {
    const ad = listingOk(await app.listing(owner.cookie, { titulo: 'Aprobado con pago manual comprobado' }));
    await app.proof(owner.cookie, ad.id);
    const before = await publicTotal();
    const approved = approvedOk(await app.approve(admin.cookie, ad.id, { referenciaPago: '' }));
    assert.equal(approved.estado, 'activo'); assert.equal(approved.moderacion, 'aprobado'); assert.equal(approved.diasVigencia, 7); assert.equal(approved.diasPromocion, 0);
    assert.equal(Date.parse(approved.fechaVencimiento) - Date.parse(approved.fechaAprobacion), 7 * day);
    assert.equal(approved.pago.fechaConfirmacion, approved.fechaAprobacion);
    const publicDetail = await app.request('/anuncios/' + ad.id);
    assert.equal(publicDetail.response.status, 200); assert(!publicDetail.body.pago, 'El comprobante y la referencia no se publican.');
    assert.equal((await app.request('/anuncios?q=' + encodeURIComponent(ad.titulo))).body.total, 1);
    assert.equal(await publicTotal(), before + 1);
    const privateFiles = (await fs.readdir(app.settings.privateUploadDir)).sort();
    const replacement = await app.proof(owner.cookie, ad.id);
    assert.equal(replacement.response.status, 409, 'Un comprobante confirmado no se sustituye después de la aprobación.');
    assert.deepEqual((await fs.readdir(app.settings.privateUploadDir)).sort(), privateFiles);
  });

  it('Una doble aprobación concurrente conserva las fechas y no duplica la vigencia', async () => {
    const ad = listingOk(await app.listing(owner.cookie, { titulo: 'Aprobación idempotente concurrente' }));
    const results = await Promise.all([app.approve(admin.cookie, ad.id), app.approve(admin.cookie, ad.id)]);
    const first = approvedOk(results[0]); const second = approvedOk(results[1]);
    assert.equal(first.fechaAprobacion, second.fechaAprobacion); assert.equal(first.fechaVencimiento, second.fechaVencimiento);
    assert.equal(first.diasPromocion, second.diasPromocion);
    const again = approvedOk(await app.approve(admin.cookie, ad.id, { referenciaPago: 'Otra referencia que no renueva la vigencia' }));
    assert.equal(again.fechaAprobacion, first.fechaAprobacion); assert.equal(again.fechaVencimiento, first.fechaVencimiento);
    assert.equal((await app.request('/anuncios?q=' + encodeURIComponent(ad.titulo))).body.total, 1);
  });

  it('Los valores del plan vienen del servidor y la edición posterior no cambia un pendiente', async () => {
    const ad = listingOk(await app.listing(owner.cookie, { titulo: 'Snapshot de plan sin alteraciones', montoPublicacion: '0', diasVigencia: '999', diasPromocion: '999', estado: 'activo', pagoConfirmado: 'true', moderacion: 'aprobado', estadoPago: 'confirmado', fechaAprobacion: '2026-01-01T00:00:00.000Z', fechaVencimiento: '2099-01-01T00:00:00.000Z' }));
    assert.equal(ad.moderacion, 'pendiente'); assert.equal(ad.montoPublicacion, 5); assert.equal(ad.diasVigencia, 7); assert.equal(ad.diasPromocion, 0);
    assert.equal(ad.estadoPago, 'pendiente');
    assert.equal(ad.fechaAprobacion, null); assert.equal((await app.request('/anuncios/' + ad.id)).response.status, 404);
    const edited = await app.request('/admin/planes/1', jsonRequest({ nombre: 'Semanal actualizado para prueba', precio: 9, dias: 2, bonoPrimerAnuncio: 8, destacado: false, activo: true }, admin.cookie, 'PATCH'));
    assert.equal(edited.response.status, 200, JSON.stringify(edited.body));
    try {
      const approved = approvedOk(await app.approve(admin.cookie, ad.id));
      assert.equal(approved.montoPublicacion, 5); assert.equal(approved.diasVigencia, 7); assert.equal(approved.diasPromocion, 0);
      assert.equal(Date.parse(approved.fechaVencimiento) - Date.parse(approved.fechaAprobacion), 7 * day);
      const newer = listingOk(await app.listing(owner.cookie, { titulo: 'Nueva solicitud usa el plan editado' }));
      assert.equal(newer.montoPublicacion, 9); assert.equal(newer.diasVigencia, 2);
    } finally {
      await app.request('/admin/planes/1', jsonRequest({ nombre: 'Semanal', precio: 5, dias: 7, bonoPrimerAnuncio: 0, destacado: false, activo: true }, admin.cookie, 'PATCH'));
    }
    const inactive = await app.listing(owner.cookie, { planId: '2' }); assert.equal(inactive.response.status, 422);
    const missing = await app.listing(owner.cookie, { planId: '99999' }); assert.equal(missing.response.status, 422);
  });

  it('La promoción configurable corresponde sólo a la primera publicación pagada', async () => {
    const buyer = await app.register('primera-publicacion');
    await app.request('/admin/planes/1', jsonRequest({ nombre: 'Semanal con promoción de prueba', precio: 5, dias: 7, bonoPrimerAnuncio: 3, destacado: false, activo: true }, admin.cookie, 'PATCH'));
    try {
      const first = listingOk(await app.listing(buyer.cookie, { titulo: 'Primera solicitud pendiente del mismo usuario' }));
      const second = listingOk(await app.listing(buyer.cookie, { titulo: 'Segunda solicitud pendiente del mismo usuario' }));
      await app.request('/admin/planes/1', jsonRequest({ nombre: 'Plan posteriormente editado', precio: 9, dias: 2, bonoPrimerAnuncio: 8, destacado: false, activo: true }, admin.cookie, 'PATCH'));
      const results = await Promise.all([app.approve(admin.cookie, first.id), app.approve(admin.cookie, second.id)]);
      const approved = results.map(approvedOk);
      assert.deepEqual(approved.map(ad => ad.diasPromocion).sort((a, b) => a - b), [0, 3], 'Dos aprobaciones simultáneas no pueden cobrar el bono dos veces.');
      for (const ad of approved) {
        assert.equal(ad.montoPublicacion, 5); assert.equal(ad.diasVigencia, 7);
        assert.equal(Date.parse(ad.fechaVencimiento) - Date.parse(ad.fechaAprobacion), (7 + ad.diasPromocion) * day);
      }
    } finally {
      await app.request('/admin/planes/1', jsonRequest({ nombre: 'Semanal', precio: 5, dias: 7, bonoPrimerAnuncio: 0, destacado: false, activo: true }, admin.cookie, 'PATCH'));
    }
  });

  it('Un plan borrador necesita precio antes de activarse y sólo aparece al habilitarse', async () => {
    const initialPlans = (await app.db.get('SELECT COUNT(*) AS n FROM planes_publicacion')).n;
    const freeActive = await app.request('/admin/planes', jsonRequest({ nombre: 'Plan activo inválido de cero soles', precio: 0, dias: 7, bonoPrimerAnuncio: 0, destacado: false, activo: true }, admin.cookie));
    assert.equal(freeActive.response.status, 422); assert(freeActive.body.fields.precio);
    assert.equal((await app.db.get('SELECT COUNT(*) AS n FROM planes_publicacion')).n, initialPlans);
    const freePatch = await app.request('/admin/planes/1', jsonRequest({ precio: 0, activo: true }, admin.cookie, 'PATCH'));
    assert.equal(freePatch.response.status, 422); assert(freePatch.body.fields.precio);
    assert.equal((await app.db.get('SELECT precio_centimos FROM planes_publicacion WHERE id = 1')).precio_centimos, 500);
    const zeroDraft = await app.request('/admin/planes', jsonRequest({ nombre: 'Borrador sin tarifa definitiva', precio: 0, dias: 1, bonoPrimerAnuncio: 0, destacado: false, activo: false }, admin.cookie));
    assert.equal(zeroDraft.response.status, 201); assert.equal(zeroDraft.body.activo, false);
    assert(!(await app.request('/publicacion')).body.planes.some(plan => plan.id === zeroDraft.body.id));
    assert.equal((await app.listing(owner.cookie, { planId: zeroDraft.body.id })).response.status, 422);
    const draft = await app.request('/admin/planes', jsonRequest({ nombre: 'Plan especial de prueba', precio: null, dias: 30, bonoPrimerAnuncio: 0, destacado: false, activo: false }, admin.cookie));
    assert.equal(draft.response.status, 201, JSON.stringify(draft.body));
    assert.equal(draft.body.precio, null); assert.equal(draft.body.activo, false);
    const premature = await app.request('/admin/planes/' + draft.body.id, jsonRequest({ activo: true }, admin.cookie, 'PATCH'));
    assert.equal(premature.response.status, 422); assert(premature.body.fields.precio);
    assert(!(await app.request('/publicacion')).body.planes.some(plan => plan.id === draft.body.id));
    const ready = await app.request('/admin/planes/' + draft.body.id, jsonRequest({ precio: 12, activo: true, destacado: true }, admin.cookie, 'PATCH'));
    assert.equal(ready.response.status, 200); assert.equal(ready.body.precio, 12); assert.equal(ready.body.destacado, true);
    assert((await app.request('/publicacion')).body.planes.some(plan => plan.id === draft.body.id && plan.precio === 12));
    const ad = listingOk(await app.listing(owner.cookie, { titulo: 'Solicitud con nuevo plan disponible', planId: draft.body.id }));
    assert.equal(ad.planId, draft.body.id); assert.equal(ad.montoPublicacion, 12); assert.equal(ad.diasVigencia, 30); assert.equal(ad.destacado, true);
  });

  it('El rechazo exige motivo y el propietario puede leerlo sin publicar el anuncio', async () => {
    const ad = listingOk(await app.listing(owner.cookie, { titulo: 'Anuncio rechazado por revisión manual' }));
    const empty = await app.request('/admin/anuncios/' + ad.id + '/rechazar', jsonRequest({ motivo: '' }, admin.cookie)); assert.equal(empty.response.status, 422);
    const reason = 'Añade una fotografía clara del producto y revisa sus datos.';
    const rejected = await app.request('/admin/anuncios/' + ad.id + '/rechazar', jsonRequest({ motivo: reason }, admin.cookie));
    assert.equal(rejected.response.status, 200, JSON.stringify(rejected.body));
    const detail = await app.request('/anuncios/' + ad.id, { headers: { Cookie: owner.cookie } });
    assert.equal(detail.body.moderacion, 'rechazado'); assert.equal(detail.body.motivoRevision, reason); assert.equal(detail.body.fechaAprobacion, null);
    const profile = await app.request('/perfil/anuncios', { headers: { Cookie: owner.cookie } });
    assert(profile.body.some(item => item.id === ad.id && item.moderacion === 'rechazado' && item.motivoRevision === reason));
    assert.equal((await app.request('/anuncios/' + ad.id)).response.status, 404);
    assert.equal((await app.request('/anuncios?q=' + encodeURIComponent(ad.titulo))).body.total, 0);
  });

  it('La vigencia vencida desaparece del catálogo, contadores y detalle público sin cron', async () => {
    const ad = listingOk(await app.listing(owner.cookie, { titulo: 'Anuncio vencido sin tarea programada' }));
    approvedOk(await app.approve(admin.cookie, ad.id));
    const before = await publicTotal();
    await app.db.run('UPDATE anuncios SET fecha_vencimiento = ? WHERE id = ?', new Date(Date.now() - day).toISOString(), ad.id);
    assert.equal((await app.request('/anuncios?q=' + encodeURIComponent(ad.titulo))).body.total, 0);
    assert.equal((await app.request('/anuncios/' + ad.id)).response.status, 404);
    assert.equal((await app.request('/anuncios/' + ad.id, { headers: { Cookie: stranger.cookie } })).response.status, 404);
    const own = await app.request('/anuncios/' + ad.id, { headers: { Cookie: owner.cookie } });
    assert.equal(own.response.status, 200); assert(Date.parse(own.body.fechaVencimiento) < Date.now());
    assert.equal(await publicTotal(), before - 1);
  });

  it('Una aprobación sin pago confirmado o sin fecha no se filtra al catálogo público', async () => {
    const ad = listingOk(await app.listing(owner.cookie, { titulo: 'Estados incompletos no aparecen publicados' }));
    const approved = approvedOk(await app.approve(admin.cookie, ad.id));
    const before = await publicTotal();
    for (const sql of ["UPDATE anuncios SET estado_pago = 'pendiente' WHERE id = ?", 'UPDATE anuncios SET fecha_aprobacion = NULL WHERE id = ?']) {
      await app.db.run(sql, ad.id);
      assert.equal((await app.request('/anuncios?q=' + encodeURIComponent(ad.titulo))).body.total, 0);
      assert.equal((await app.request('/anuncios/' + ad.id)).response.status, 404);
      assert.equal(await publicTotal(), before - 1);
      await app.db.run("UPDATE anuncios SET estado_pago = 'confirmado', fecha_aprobacion = ? WHERE id = ?", approved.fechaAprobacion, ad.id);
    }
    assert.equal((await app.request('/anuncios/' + ad.id)).response.status, 200);
  });

  it('El administrador configura el destino y un QR real; su imagen se entrega como archivo', async () => {
    const data = { metodo: 'Yape', titular: 'Titular ficticio de pruebas', numero: '900000005', instrucciones: 'Prueba aislada: no realices ninguna transferencia.' };
    const configured = await app.request('/admin/configuracion', jsonRequest(data, admin.cookie, 'PUT'));
    assert.equal(configured.response.status, 200, JSON.stringify(configured.body));
    const form = new FormData(); form.append('qr', new Blob([await testPicture()], { type: 'image/png' }), 'qr-proporcionado.png');
    const uploaded = await app.request('/admin/configuracion/qr', { method: 'POST', headers: { Cookie: admin.cookie }, body: form });
    assert.equal(uploaded.response.status, 200, JSON.stringify(uploaded.body));
    const publicData = (await app.request('/publicacion')).body.pago;
    assert.equal(publicData.configurado, true); assert.equal(publicData.metodo, data.metodo); assert.equal(publicData.titular, data.titular); assert.equal(publicData.numero, data.numero);
    assert(publicData.qrUrl && !publicData.qrUrl.startsWith('data:'));
    const image = await fetch(app.base + publicData.qrUrl);
    assert.equal(image.status, 200); assert.match(image.headers.get('content-type'), /^image\//); assert((await image.arrayBuffer()).byteLength > 0);
  });

  it('El identificador DEMO lo determina la cuenta y sobrevive la moderación', async () => {
    const cookie = await app.login(DEMO_USER.correo, DEMO_USER.password);
    const ad = listingOk(await app.listing(cookie, { titulo: 'DEMO conservado después de aprobar', demo: 'false', es_demo: '0' }));
    assert.equal(ad.demo, true); assert.equal(ad.vendedor.demo, true); assert.equal(ad.moderacion, 'pendiente');
    approvedOk(await app.approve(admin.cookie, ad.id));
    const visible = await app.request('/anuncios/' + ad.id);
    assert.equal(visible.body.demo, true); assert.equal(visible.body.vendedor.demo, true);
  });

  it('El resumen administrativo calcula ingresos confirmados y excluye ejemplos DEMO', async () => {
    approvedOk(await app.approve(admin.cookie, 2)); // Anuncio DEMO del seed: su pago no cuenta como ingreso.
    approvedOk(await app.approve(admin.cookie, listingOk(await app.listing(owner.cookie, { titulo: 'Pago real incluido en el resumen' })).id));
    const summary = await app.request('/admin/resumen', { headers: { Cookie: admin.cookie } });
    assert.equal(summary.response.status, 200);
    const expected = await app.db.get("SELECT COUNT(*) AS n, COALESCE(SUM(monto_publicacion_centimos), 0) AS monto FROM anuncios WHERE estado_pago = 'confirmado' AND es_demo = 0");
    assert.equal(summary.body.pagosConfirmados, expected.n); assert.equal(summary.body.ingresos, expected.monto / 100);
    assert.equal(summary.body.activos, (await app.request('/anuncios')).body.total);
    assert((await app.db.get("SELECT COUNT(*) AS n FROM anuncios WHERE estado_pago = 'confirmado' AND es_demo = 1")).n > 0, 'La comparación debe incluir un pago DEMO aprobado que se excluye del ingreso.');
  });
});
