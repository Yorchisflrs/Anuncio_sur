import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createIsolatedApp } from './support.mjs';
import { DEMO_USER } from '../src/seed.mjs';

// RF-04: contacto directo por WhatsApp con un mensaje preparado; nunca se envía solo.
describe('RF-04 · Contacto por WhatsApp', () => {
  let app;
  before(async () => {
    app = await createIsolatedApp();
    const approved = await app.approve((await app.admin()).cookie, 1);
    assert.equal(approved.response.status, 200, JSON.stringify(approved.body));
  });
  after(() => app?.close());

  it('El enlace usa el prefijo 51, el celular del anuncio y el mensaje exacto', async () => {
    const { body } = await app.request('/anuncios/1');
    const url = new URL(body.whatsappUrl);
    assert.equal(url.origin, 'https://wa.me'); assert.equal(url.pathname, '/51' + DEMO_USER.celular);
    assert.equal(url.searchParams.get('text'), 'Hola, vi tu anuncio de ' + body.titulo + ' en AvisoSur y quisiera saber si todavía está disponible');
  });

  it('El detalle público no incluye contraseñas ni hashes', async () => {
    const { body } = await app.request('/anuncios/1');
    assert(!JSON.stringify(body).includes('password_hash')); assert(!JSON.stringify(body).includes('passwordHash'));
  });
});
