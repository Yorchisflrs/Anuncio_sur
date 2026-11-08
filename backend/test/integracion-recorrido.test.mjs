import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { createIsolatedApp, jsonRequest, cookieFrom, TEST_PASSWORD } from './support.mjs';

// Prueba de integración: el recorrido completo de un cuarto en alquiler, en el orden en que lo vive la gente.
// Un arrendador crea su cuenta, administración verifica su celular, publica con una foto del celular, paga y
// lo aprueban; una estudiante lo encuentra, pide el contacto, y tres compradores lo reportan hasta que el
// moderador decide. Junta en un solo caso los módulos de cuenta, verificación, publicación, fotos, pago,
// catálogo, contacto, reportes y moderación, que los demás archivos prueban por separado.
// A diferencia de esos archivos, aquí cada paso usa lo que dejó el anterior, como el acta (CA-01 a CA-12).
// Todo va por HTTP contra el servidor real y una base SQLite temporal. La única excepción es dar el rol de
// administrador, que en una instalación real se hace desde la terminal con scripts/admin-user.mjs.
describe('Integración · Recorrido completo de un cuarto en alquiler (acta CA-01 a CA-12)', () => {
  const titulo = 'Cuarto amoblado cerca de la UNA Puno';
  let app, admin, arrendador, cuarto;
  const compradores = [];

  before(async () => {
    app = await createIsolatedApp();
    admin = await app.administrator('moderador-del-recorrido');
  });
  after(() => app?.close());

  const get = (endpoint, cookie = '') => app.request(endpoint, cookie ? { headers: { Cookie: cookie } } : {});
  const buscar = (filtros = '') => get('/anuncios?q=' + encodeURIComponent('UNA Puno') + filtros);
  const enCatalogo = async (filtros = '') => (await buscar(filtros)).body.anuncios.some(item => item.id === cuarto.id);
  const codigoEquivocado = codigo => String((Number(codigo) + 1) % 1000000).padStart(6, '0');

  async function crearCuenta(nombre, correo, celular) {
    const { response, body } = await app.request('/auth/registro', jsonRequest({ nombre, correo, celular, password: TEST_PASSWORD, confirmacion: TEST_PASSWORD }));
    assert.equal(response.status, 201, JSON.stringify(body));
    return { ...body.usuario, cookie: cookieFrom(response) };
  }
  // Administración genera el código, lo envía por WhatsApp y la persona lo escribe en su perfil.
  async function verificarCelular(cuenta) {
    const enviado = await app.request('/admin/verificaciones/' + cuenta.id + '/codigo', jsonRequest({}, admin.cookie));
    assert.equal(enviado.response.status, 201, JSON.stringify(enviado.body));
    assert.equal(new URL(enviado.body.whatsappUrl).pathname, '/51' + cuenta.celular, 'El mensaje va al celular de la cuenta.');
    const confirmado = await app.request('/perfil/verificacion/confirmar', jsonRequest({ codigo: enviado.body.codigo }, cuenta.cookie));
    assert.equal(confirmado.response.status, 200, JSON.stringify(confirmado.body));
  }

  it('CA-01 · El arrendador crea su cuenta con un nombre para mostrar y queda con la sesión abierta', async () => {
    arrendador = await crearCuenta('Cuartos La Merced', 'merced@recorrido.local', '951000001');
    const yo = await get('/auth/me', arrendador.cookie);
    assert.equal(yo.body.usuario.nombre, 'Cuartos La Merced');
    assert.equal(yo.body.usuario.celularVerificado, false, 'Una cuenta nueva empieza sin el celular verificado.');
  });

  it('CA-02 · Puede volver a entrar con su celular en vez del correo', async () => {
    const { response } = await app.request('/auth/login', jsonRequest({ identificador: '951000001', password: TEST_PASSWORD }));
    assert.equal(response.status, 200);
    assert(cookieFrom(response), 'El ingreso abre una sesión nueva.');
  });

  it('CA-05 · Sin celular verificado no puede publicar, y no queda nada guardado', async () => {
    const intento = await app.listing(arrendador.cookie, { titulo });
    assert.equal(intento.response.status, 403); assert(intento.body.fields.verificacion);
    assert.equal((await get('/perfil/anuncios', arrendador.cookie)).body.length, 0);
  });

  it('CA-06 · Administración le envía un código: el equivocado se rechaza y el correcto verifica el celular', async () => {
    const pendiente = (await get('/admin/verificaciones', admin.cookie)).body.find(item => item.usuarioId === arrendador.id);
    assert(pendiente, 'La cuenta nueva aparece en «Verificar celulares».');
    const enviado = await app.request('/admin/verificaciones/' + arrendador.id + '/codigo', jsonRequest({}, admin.cookie));
    assert.equal(enviado.response.status, 201);
    const equivocado = await app.request('/perfil/verificacion/confirmar', jsonRequest({ codigo: codigoEquivocado(enviado.body.codigo) }, arrendador.cookie));
    assert.equal(equivocado.response.status, 422);
    const correcto = await app.request('/perfil/verificacion/confirmar', jsonRequest({ codigo: enviado.body.codigo }, arrendador.cookie));
    assert.equal(correcto.response.status, 200);
    assert.equal((await get('/auth/me', arrendador.cookie)).body.usuario.celularVerificado, true);
  });

  it('CA-07 · Publica el cuarto en alquiler con una foto grande tomada con el celular', async () => {
    const foto = await sharp({ create: { width: 3200, height: 2400, channels: 3, background: '#b7a58a' } }).jpeg({ quality: 90 }).toBuffer();
    const creado = await app.listingWith(arrendador.cookie, {
      titulo, descripcion: 'Cuarto amoblado con escritorio, ventana a la calle y baño compartido. A cinco cuadras de la UNA.',
      categoriaId: '2', subcategoria: 'Habitaciones', tipoOperacion: 'alquiler', precio: '280', zona: 'Puno', contacto: '951000001',
    }, [{ buffer: foto, name: 'IMG_2026.jpg', type: 'image/jpeg' }]);
    assert.equal(creado.response.status, 201, JSON.stringify(creado.body));
    cuarto = creado.body;
    assert.equal(cuarto.moderacion, 'pendiente'); assert.equal(cuarto.tipoOperacion, 'alquiler');
    const imagen = await fetch(app.base + cuarto.fotos[0].archivo);
    assert.equal(imagen.status, 200);
    const guardada = await sharp(Buffer.from(await imagen.arrayBuffer())).metadata();
    assert.equal(guardada.format, 'webp'); assert(Math.max(guardada.width, guardada.height) <= 1600, 'El servidor la reduce a 1600 px.');
    assert.equal(await enCatalogo(), false, 'Antes de pagar y ser aprobado no aparece en el catálogo.');
    assert.equal((await get('/anuncios/' + cuarto.id)).response.status, 404);
  });

  it('CA-08 · Adjunta el comprobante de Yape y administración aprueba el pago: el aviso se publica', async () => {
    const comprobante = await app.proof(arrendador.cookie, cuarto.id);
    assert.equal(comprobante.response.status, 200, JSON.stringify(comprobante.body));
    const bandeja = (await get('/admin/anuncios', admin.cookie)).body.find(item => item.id === cuarto.id);
    assert(bandeja?.pago?.comprobanteUrl, 'Administración ve el comprobante en la bandeja de revisión.');
    const aprobado = await app.approve(admin.cookie, cuarto.id, { referenciaPago: '' });
    assert.equal(aprobado.response.status, 200, JSON.stringify(aprobado.body));
    assert.equal(aprobado.body.estado, 'activo'); assert.equal(aprobado.body.moderacion, 'aprobado');
    assert(Date.parse(aprobado.body.fechaVencimiento) > Date.now(), 'La vigencia empieza al aprobar.');
  });

  it('CA-03 · Una estudiante, sin cuenta, lo encuentra buscando alquileres hasta S/ 300 en Puno', async () => {
    assert.equal(await enCatalogo('&tipo=alquiler&categoriaId=2&zona=Puno&max=300'), true);
    assert.equal(await enCatalogo('&max=280'), true, 'El precio máximo es inclusivo.');
    assert.equal(await enCatalogo('&max=250'), false);
    assert.equal(await enCatalogo('&tipo=venta'), false, 'No se mezcla con lo que se vende.');
    const detalle = await get('/anuncios/' + cuarto.id);
    assert.equal(detalle.response.status, 200);
    assert.equal(detalle.body.vendedor.nombre, 'Cuartos La Merced');
    assert.equal(detalle.body.vendedor.verificado, true, 'Se ve la insignia «Celular verificado».');
    assert.equal(detalle.body.vendedor.avisosPublicados, 1);
  });

  it('CA-04 · El celular no está en el catálogo ni en el detalle: aparece solo al pedir el contacto', async () => {
    const publico = JSON.stringify([(await buscar()).body, (await get('/anuncios/' + cuarto.id)).body]);
    assert(!publico.includes('951000001'), 'Ni el catálogo ni el detalle público traen el celular.');
    const contacto = await get('/anuncios/' + cuarto.id + '/contacto');
    assert.equal(contacto.response.status, 200);
    assert.equal(contacto.body.celular, '951000001');
    assert.equal(new URL(contacto.body.whatsappUrl).pathname, '/51951000001');
  });

  it('CA-09 · El arrendador ve en su perfil cuántas personas pidieron su contacto, contando una vez a cada una', async () => {
    assert.equal((await get('/anuncios/' + cuarto.id + '/contacto')).response.status, 200); // La misma estudiante otra vez.
    for (const [index, nombre] of ['Comprador Uno', 'Comprador Dos', 'Comprador Tres'].entries()) {
      const cuenta = await crearCuenta(nombre, 'comprador' + (index + 1) + '@recorrido.local', '95200000' + (index + 1));
      await verificarCelular(cuenta);
      compradores.push(cuenta);
    }
    assert.equal((await get('/anuncios/' + cuarto.id + '/contacto', compradores[0].cookie)).response.status, 200);
    const mio = (await get('/perfil/anuncios', arrendador.cookie)).body.find(item => item.id === cuarto.id);
    assert.equal(mio.contactos, 2, 'La estudiante y el primer comprador: dos personas, aunque ella lo pidió dos veces.');
  });

  it('CA-10 y CA-11 · Reportan el aviso: la misma persona no puede repetir y con dos reportes sigue publicado', async () => {
    const reportar = (cuenta, motivo = 'pide_adelanto') => app.request('/anuncios/' + cuarto.id + '/reportes', jsonRequest({ motivo, detalle: 'Pidió un adelanto por Yape antes de mostrar el cuarto.' }, cuenta.cookie));
    assert.equal((await app.request('/anuncios/' + cuarto.id + '/reportes', jsonRequest({ motivo: 'pide_adelanto' }))).response.status, 401, 'Reportar exige una cuenta.');
    assert.equal((await reportar(arrendador)).response.status, 403, 'Nadie reporta su propio aviso.');
    const primero = await reportar(compradores[0]);
    assert.equal(primero.response.status, 201); assert.equal(primero.body.enRevision, false);
    assert.equal((await reportar(compradores[0], 'no_existe')).response.status, 409, 'CA-11: la misma persona no reporta dos veces.');
    assert.equal((await reportar(compradores[1], 'precio_sospechoso')).response.status, 201);
    assert.equal(await enCatalogo(), true, 'Con dos reportes el aviso sigue en el catálogo.');
  });

  it('CA-10 · El tercer reporte de otra cuenta verificada oculta el aviso del catálogo, del detalle y del contacto', async () => {
    const tercero = await app.request('/anuncios/' + cuarto.id + '/reportes', jsonRequest({ motivo: 'no_existe' }, compradores[2].cookie));
    assert.equal(tercero.response.status, 201); assert.equal(tercero.body.enRevision, true);
    assert.equal(await enCatalogo(), false);
    assert.equal((await get('/anuncios/' + cuarto.id)).response.status, 404);
    assert.equal((await get('/anuncios/' + cuarto.id + '/contacto')).response.status, 404);
    const mio = (await get('/perfil/anuncios', arrendador.cookie)).body.find(item => item.id === cuarto.id);
    assert.equal(mio.revisionReportes, true, 'El arrendador lo ve en su perfil como «en revisión».');
  });

  it('CA-12 · El moderador revisa los tres motivos y lo restaura: vuelve al catálogo y los reportes quedan revisados', async () => {
    const grupo = (await get('/admin/reportes', admin.cookie)).body.find(item => item.anuncio.id === cuarto.id);
    assert.equal(grupo.reportes.length, 3); assert.equal(grupo.reportantesVerificados, 3);
    assert.deepEqual(grupo.reportes.map(item => item.motivo).sort(), ['no_existe', 'pide_adelanto', 'precio_sospechoso']);
    const resuelto = await app.request('/admin/anuncios/' + cuarto.id + '/reportes/resolver', jsonRequest({ accion: 'restaurar' }, admin.cookie));
    assert.equal(resuelto.response.status, 200, JSON.stringify(resuelto.body)); assert.equal(resuelto.body.revisionReportes, false);
    assert.equal(await enCatalogo('&tipo=alquiler&max=300'), true);
    assert.equal((await get('/anuncios/' + cuarto.id + '/contacto')).response.status, 200, 'El contacto vuelve a estar disponible.');
    const resumen = (await get('/admin/resumen', admin.cookie)).body;
    assert.equal(resumen.ocultosPorReportes, 0); assert.equal(resumen.reportesPendientes, 0);
  });
});
