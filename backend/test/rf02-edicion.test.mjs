import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isolatedApp, jsonRequest } from './support.mjs';
import { registerEditRoutes } from '../src/edicion.mjs';

// Cada caso tiene su propio servidor, vendedor, aviso y SQLite temporal.
async function fixture(t) {
  const app = await isolatedApp(t);
  const seller = await app.register('vendedor-edicion');
  const created = await app.listing(seller.cookie, { titulo: 'Moto antes de editar', precio: '150.25' });
  assert.equal(created.response.status, 201, JSON.stringify(created.body));
  const ad = created.body;
  const row = async () => ({ ...await app.db.get('SELECT * FROM anuncios WHERE id = ?', ad.id) });
  const edit = (body, cookie = seller.cookie, id = ad.id) => app.request('/anuncios/' + id, jsonRequest(body, cookie, 'PATCH'));
  return { app, seller, ad, row, edit };
}

describe('RF-02 · Edición de un aviso antes de aprobarlo', () => {
  it('Sin sesión devuelve 401 y conserva el aviso', async t => {
    const { row, edit } = await fixture(t);
    const before = await row();
    assert.equal((await edit({ titulo: 'Intento sin sesión' }, '')).response.status, 401);
    assert.deepEqual(await row(), before);
  });

  it('Otra cuenta recibe 403 y no cambia el aviso', async t => {
    const { app, row, edit } = await fixture(t);
    const other = await app.register('otra-cuenta-edicion');
    const before = await row();
    assert.equal((await edit({ titulo: 'Intento de otra cuenta' }, other.cookie)).response.status, 403);
    assert.deepEqual(await row(), before);
  });

  it('Administración tampoco puede editar un aviso ajeno', async t => {
    const { app, row, edit } = await fixture(t);
    const admin = await app.admin();
    const before = await row();
    assert.equal((await edit({ precio: '50' }, admin.cookie)).response.status, 403);
    assert.deepEqual(await row(), before);
  });

  for (const id of ['0', '-1', '1.5', 'abc', '9007199254740992', '99999999']) {
    it('El identificador ' + id + ' devuelve 404 sin cambiar el aviso', async t => {
      const { row, edit } = await fixture(t);
      const before = await row();
      assert.equal((await edit({ titulo: 'No debe guardarse' }, undefined, id)).response.status, 404);
      assert.deepEqual(await row(), before);
    });
  }

  it('Un aviso aprobado devuelve 409 y conserva todos sus datos', async t => {
    const { app, ad, row, edit } = await fixture(t);
    assert.equal((await app.approve((await app.admin()).cookie, ad.id)).response.status, 200);
    const before = await row();
    assert.equal((await edit({ titulo: 'No debe editarse después de aprobar' })).response.status, 409);
    assert.deepEqual(await row(), before);
  });

  it('Un aviso dado de baja devuelve 409', async t => {
    const { app, seller, ad, row, edit } = await fixture(t);
    assert.equal((await app.request('/anuncios/' + ad.id + '/baja', { method: 'PATCH', headers: { Cookie: seller.cookie } })).response.status, 200);
    const before = await row();
    assert.equal((await edit({ precio: '200' })).response.status, 409);
    assert.deepEqual(await row(), before);
  });

  for (const [field, value] of [['precio', '0'], ['titulo', '']]) {
    it('El campo ' + field + ' inválido devuelve 422 sin guardar cambios parciales', async t => {
      const { row, edit } = await fixture(t);
      const before = await row();
      const result = await edit({ descripcion: 'Esta descripción tampoco debe guardarse.', [field]: value });
      assert.equal(result.response.status, 422);
      assert(result.body.fields[field]);
      assert.deepEqual(await row(), before);
    });
  }

  it('Cada campo usa los mismos límites y mensajes que al publicar', async t => {
    const { row, edit } = await fixture(t);
    const before = await row();
    const result = await edit({ titulo: 'Moto', descripcion: '', precio: '1.005', zona: 'Cusco', tipoOperacion: 'permuta', direccion: 'a'.repeat(201), referencia: 'a'.repeat(301) });
    assert.equal(result.response.status, 422);
    assert.deepEqual(result.body.fields, {
      titulo: 'El título debe tener entre 5 y 100 caracteres.',
      descripcion: 'Escribe una descripción de hasta 3000 caracteres.',
      precio: 'El precio debe ser mayor que S/ 0 y tener como máximo dos decimales.',
      zona: 'Selecciona una zona.',
      tipoOperacion: 'Indica si vendes o alquilas.',
      direccion: 'Usa hasta 200 caracteres.',
      referencia: 'Usa hasta 300 caracteres.',
    });
    assert.deepEqual(await row(), before);
  });

  it('Un pedido vacío o con solo campos no editables devuelve 422', async t => {
    const { row, edit } = await fixture(t);
    const before = await row();
    for (const body of [{}, { moderacion: 'aprobado' }, []]) {
      const result = await edit(body);
      assert.equal(result.response.status, 422);
      assert(Object.keys(result.body.fields).length > 0);
      assert.deepEqual(await row(), before);
    }
  });

  it('El dueño cambia título y precio; el GET privado devuelve los datos nuevos', async t => {
    const { app, seller, ad, row, edit } = await fixture(t);
    const before = await row();
    const result = await edit({ titulo: 'Moto Honda con mantenimiento reciente', precio: '199.90' });
    assert.equal(result.response.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.titulo, 'Moto Honda con mantenimiento reciente');
    assert.equal(result.body.precio, 199.9);
    const detail = await app.request('/anuncios/' + ad.id, { headers: { Cookie: seller.cookie } });
    assert.equal(detail.response.status, 200);
    assert.equal(detail.body.titulo, result.body.titulo);
    assert.equal(detail.body.precio, 199.9);
    assert.deepEqual(detail.body.fotos, ad.fotos);
    assert.deepEqual(await row(), { ...before, titulo: result.body.titulo, precio_centimos: 19990 });
  });

  it('Los campos son opcionales y se pueden vaciar dirección y referencia', async t => {
    const { row, edit } = await fixture(t);
    const before = await row();
    assert.equal((await edit({ direccion: '', referencia: '' })).response.status, 200);
    assert.deepEqual(await row(), { ...before, direccion: '', referencia: '' });
  });

  it('Admite los siete campos editables sin alterar categoría, contacto, fotos ni plan', async t => {
    const { row, edit } = await fixture(t);
    const before = await row();
    const data = { titulo: 'Cuarto amoblado cerca del parque', descripcion: 'Habitación con baño y acceso independiente.', precio: '300.50', zona: 'Juliaca', tipoOperacion: 'alquiler', direccion: '  Jr. Los Andes 123  ', referencia: '  Frente al parque  ' };
    const result = await edit(data);
    assert.equal(result.response.status, 200, JSON.stringify(result.body));
    assert.deepEqual(await row(), { ...before, titulo: data.titulo, descripcion: data.descripcion, precio_centimos: 30050, zona: data.zona, tipo_operacion: 'alquiler', direccion: 'Jr. Los Andes 123', referencia: 'Frente al parque' });
  });

  it('Ignora cambios de propietario, moderación, pago o plan enviados con un título válido', async t => {
    const { row, edit } = await fixture(t);
    const before = await row();
    const result = await edit({ titulo: 'Solo cambia este título', usuario_id: 999, usuarioId: 999, categoriaId: 2, moderacion: 'aprobado', estado_pago: 'confirmado', fecha_aprobacion: '2099-01-01T00:00:00.000Z', planId: 99, fotos: [] });
    assert.equal(result.response.status, 200);
    assert.deepEqual(await row(), { ...before, titulo: 'Solo cambia este título' });
  });

  it('El aviso editado sigue privado hasta que administración lo apruebe', async t => {
    const { app, ad, edit } = await fixture(t);
    assert.equal((await edit({ titulo: 'Moto corregida para revisión' })).response.status, 200);
    const pending = await app.request('/anuncios');
    assert(!pending.body.anuncios.some(item => item.id === ad.id));
    assert.equal((await app.request('/anuncios/' + ad.id)).response.status, 404);
    assert.equal((await app.approve((await app.admin()).cookie, ad.id)).response.status, 200);
    const published = await app.request('/anuncios');
    assert(published.body.anuncios.some(item => item.id === ad.id && item.titulo === 'Moto corregida para revisión'));
  });

  it('Un aviso rechazado vuelve a pendiente al editarlo y conserva el pago para revisión', async t => {
    const { app, ad, row, edit } = await fixture(t);
    const rejected = await app.request('/admin/anuncios/' + ad.id + '/rechazar', jsonRequest({ motivo: 'La descripción necesita más información.' }, (await app.admin()).cookie));
    assert.equal(rejected.response.status, 200);
    const before = await row();
    const result = await edit({ descripcion: 'Motor revisado, documentos al día y entrega en Puno.' });
    assert.equal(result.response.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.moderacion, 'pendiente');
    assert.deepEqual(await row(), { ...before, descripcion: 'Motor revisado, documentos al día y entrega en Puno.', moderacion: 'pendiente' });
    assert(!(await app.request('/anuncios')).body.anuncios.some(item => item.id === ad.id));
  });

  it('Una edición inválida de un aviso rechazado no lo devuelve a pendiente', async t => {
    const { app, ad, row, edit } = await fixture(t);
    assert.equal((await app.request('/admin/anuncios/' + ad.id + '/rechazar', jsonRequest({ motivo: 'Revisa los datos del aviso.' }, (await app.admin()).cookie))).response.status, 200);
    const before = await row();
    assert.equal((await edit({ titulo: '' })).response.status, 422);
    assert.deepEqual(await row(), before);
  });

  it('Si tuvo fecha de aprobación, tampoco se edita aunque figure rechazado o vencido', async t => {
    const { app, ad, row, edit } = await fixture(t);
    assert.equal((await app.approve((await app.admin()).cookie, ad.id)).response.status, 200);
    await app.db.run("UPDATE anuncios SET moderacion = 'rechazado', fecha_vencimiento = ? WHERE id = ?", new Date(Date.now() - 86400000).toISOString(), ad.id);
    const before = await row();
    assert.equal((await edit({ titulo: 'Intento de editar un aviso ya aprobado' })).response.status, 409);
    assert.deepEqual(await row(), before);
  });

  it('Una aprobación concurrente impide guardar cambios después de aprobar', async t => {
    const { app, seller, ad, edit } = await fixture(t);
    const admin = await app.admin();
    const [approval, edition] = await Promise.all([app.approve(admin.cookie, ad.id), edit({ titulo: 'Título corregido antes de aprobar' })]);
    assert.equal(approval.response.status, 200, JSON.stringify(approval.body));
    assert([200, 409].includes(edition.response.status));
    const detail = await app.request('/anuncios/' + ad.id, { headers: { Cookie: seller.cookie } });
    assert.equal(detail.body.moderacion, 'aprobado');
    assert.equal(detail.body.titulo, edition.response.status === 200 ? 'Título corregido antes de aprobar' : ad.titulo);
    assert.equal((await edit({ titulo: 'Este cambio posterior debe rechazarse' })).response.status, 409);
  });

  it('Acepta los extremos de precio y longitud sin perder los céntimos', async t => {
    const { edit, row } = await fixture(t);
    assert.equal((await edit({ precio: '0.01' })).response.status, 200);
    assert.equal((await row()).precio_centimos, 1);
    const result = await edit({ titulo: 'a'.repeat(100), descripcion: 'a'.repeat(3000), direccion: 'a'.repeat(200), referencia: 'a'.repeat(300), precio: '99999999.99' });
    assert.equal(result.response.status, 200, JSON.stringify(result.body));
    assert.equal((await row()).precio_centimos, 9999999999);
    assert.equal(result.body.precio, 99999999.99);
  });

  it('MySQL bloquea el aviso y guarda el precio en soles con dos decimales', async () => {
    // Contrato del adaptador: no abre una conexión ni usa las credenciales de MySQL.
    let handler, update, transactionActive = false, selectedWithLock = false;
    const ad = { id: 7, usuario_id: 3, fecha_aprobacion: null, estado: 'activo', moderacion: 'pendiente', precio: '150.25' };
    const db = {
      kind: 'mysql',
      async transaction(work) { transactionActive = true; try { return await work(db); } finally { transactionActive = false; } },
      async get(sql) {
        if (sql.startsWith('SELECT * FROM anuncios')) {
          selectedWithLock = transactionActive && sql.endsWith(' FOR UPDATE');
          return ad;
        }
        if (sql.startsWith('SELECT id, nombre, celular')) return { id: 3, nombre: 'Vendedor de prueba', celular: '900000003' };
        if (sql.startsWith('SELECT SUM')) return { publicados: 0, bajas: 0 };
        if (sql.includes('FROM contactos_anuncio')) return { n: 0 };
        return ad;
      },
      async all() { return []; },
      async run(sql, ...values) { assert(transactionActive); update = { sql, values }; ad.precio = values[0]; },
    };
    registerEditRoutes({ patch(_path, _auth, route) { handler = route; } }, db, { requireUser() {} });
    let response;
    await handler({ params: { id: '7' }, user: { id: 3 }, body: { precio: '10.50' } }, { json(value) { response = value; } });
    assert(selectedWithLock);
    assert.match(update.sql, /SET precio = \?/);
    assert.doesNotMatch(update.sql, /precio_centimos/);
    assert.deepEqual(update.values, ['10.50', 7]);
    assert.equal(response.precio, 10.5);
  });
});
