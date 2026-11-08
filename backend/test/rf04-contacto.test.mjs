import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createIsolatedApp, isolatedApp } from './support.mjs';
import { DEMO_USER } from '../src/seed.mjs';

// RF-04: contacto directo por WhatsApp con un mensaje preparado; nunca se envía solo.
// El celular solo se entrega al pedir el contacto, con un límite por persona.
describe('RF-04 · Contacto por WhatsApp', () => {
  let app, seller, ad;
  before(async () => {
    app = await createIsolatedApp();
    const approved = await app.approve((await app.admin()).cookie, 1);
    assert.equal(approved.response.status, 200, JSON.stringify(approved.body));
    seller = await app.register('vendedor-rf04');
    ad = await app.publish(seller.cookie, { titulo: 'Moto con contacto protegido', contacto: '987654321' });
  });
  after(() => app?.close());

  it('GET /api/anuncios/:id ya no trae el celular ni el enlace de WhatsApp', async () => {
    const { response, body } = await app.request('/anuncios/' + ad.id);
    assert.equal(response.status, 200);
    const text = JSON.stringify(body);
    assert(!text.includes('987654321'), 'El celular del anuncio no aparece en el detalle público.');
    assert(!text.includes(seller.celular), 'El celular de la cuenta no aparece en el detalle público.');
    assert.equal(body.whatsappUrl, undefined); assert.equal(body.contacto, undefined); assert.equal(body.vendedor.celular, undefined);
    assert(!text.includes('password_hash') && !text.includes('passwordHash'));
  });

  it('El catálogo público tampoco incluye celulares', async () => {
    const { body } = await app.request('/anuncios?limit=48');
    const text = JSON.stringify(body);
    assert(body.anuncios.some(item => item.id === ad.id));
    assert(!text.includes('987654321') && !text.includes(DEMO_USER.celular)); assert(body.anuncios.every(item => item.contacto === undefined));
  });

  it('Al pedir el contacto se entrega el enlace con prefijo 51, el celular del anuncio y el mensaje exacto', async () => {
    const { response, body } = await app.request('/anuncios/' + ad.id + '/contacto');
    assert.equal(response.status, 200);
    assert.equal(body.celular, '987654321');
    const url = new URL(body.whatsappUrl);
    assert.equal(url.origin, 'https://wa.me'); assert.equal(url.pathname, '/51987654321');
    assert.equal(url.searchParams.get('text'), 'Hola, vi tu anuncio de ' + ad.titulo + ' en AvisoSur y quisiera saber si todavía está disponible');
  });

  it('Sin un celular propio en el anuncio se usa el de la cuenta, como el aviso DEMO', async () => {
    const { body } = await app.request('/anuncios/1/contacto');
    assert.equal(new URL(body.whatsappUrl).pathname, '/51' + DEMO_USER.celular);
  });

  it('El contacto de un aviso que no es público devuelve 404', async () => {
    const pending = await app.listing(seller.cookie, { titulo: 'Aviso pendiente sin contacto público' });
    assert.equal((await app.request('/anuncios/' + pending.body.id + '/contacto')).response.status, 404);
    assert.equal((await app.request('/anuncios/999999/contacto')).response.status, 404);
  });

  it('El propietario y la administración siguen viendo el celular en la vista privada', async () => {
    for (const cookie of [seller.cookie, (await app.admin()).cookie]) {
      const { body } = await app.request('/anuncios/' + ad.id, { headers: { Cookie: cookie } });
      assert.equal(body.contacto, '987654321'); assert.equal(body.vendedor.celular, '987654321');
    }
  });
});

describe('RF-04 · Límite de pedidos y personas interesadas', () => {
  it('Una persona que pide demasiados contactos recibe 429', async t => {
    const app = await isolatedApp(t, { contactLimit: 3 });
    assert.equal((await app.approve((await app.admin()).cookie, 1)).response.status, 200);
    for (let request = 0; request < 3; request += 1) assert.equal((await app.request('/anuncios/1/contacto')).response.status, 200);
    const blocked = await app.request('/anuncios/1/contacto');
    assert.equal(blocked.response.status, 429); assert.match(blocked.body.message, /muchos contactos/);
    const buyer = await app.register('comprador-con-cuenta');
    assert.equal((await app.request('/anuncios/1/contacto', { headers: { Cookie: buyer.cookie } })).response.status, 200, 'El límite es por persona: otra cuenta conserva sus pedidos.');
  });

  it('El vendedor ve cuántas personas distintas pidieron su contacto', async t => {
    const app = await isolatedApp(t);
    const seller = await app.register('vendedor-interesados');
    const ad = await app.publish(seller.cookie, { titulo: 'Aviso con personas interesadas' });
    const [first, second] = [await app.register('interesado-uno'), await app.register('interesado-dos')];
    for (const cookie of [first.cookie, first.cookie, second.cookie, '', '', seller.cookie]) {
      assert.equal((await app.request('/anuncios/' + ad.id + '/contacto', cookie ? { headers: { Cookie: cookie } } : {})).response.status, 200);
    }
    // Dos cuentas distintas y una visita sin cuenta; las repeticiones y el propio vendedor no cuentan.
    const profile = await app.request('/perfil/anuncios', { headers: { Cookie: seller.cookie } });
    assert.equal(profile.body.find(item => item.id === ad.id).contactos, 3);
    assert.equal((await app.request('/anuncios/' + ad.id, { headers: { Cookie: seller.cookie } })).body.contactos, 3);
    const stored = await app.db.all('SELECT visitante FROM contactos_anuncio WHERE anuncio_id = ?', ad.id);
    assert(stored.every(row => /^[a-f0-9]{64}$/.test(row.visitante)), 'Se guarda un hash, no el IP ni la cuenta.');
  });
});
