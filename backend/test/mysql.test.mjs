import test from 'node:test';
import assert from 'node:assert/strict';
import { getCatalog } from '../src/listings.mjs';
import { validateListing } from '../src/validation.mjs';

test('consultas MySQL usan precio decimal y parámetros, sin sintaxis SQLite', async () => {
  const calls = [];
  const db = {
    kind: 'mysql',
    async get(sql, ...values) { calls.push({ sql, values }); return { total: 1 }; },
    async all(sql, ...values) {
      calls.push({ sql, values });
      return [{ id: 8, usuario_id: 2, titulo: 'Moto de prueba', descripcion: 'Ejemplo', precio: '5000.00', zona: 'Puno', categoria_id: 1, categoria: 'Vehículos', subcategoria: 'Motos', estado: 'activo', fecha_publicacion: '2026-10-16T12:00:00.000Z', imagen: '/demo/moto-roja.svg', es_demo: 1 }];
    },
  };
  const result = await getCatalog(db, { q: 'moto', min: '1', max: '5000', sort: 'price_asc' });
  assert.equal(result.anuncios[0].precio, 5000);
  assert.equal(result.total, 1);
  assert.match(calls[0].sql, /LOCATE\(\?, CONCAT\(/);
  assert.match(calls[0].sql, /a\.precio >= \?/);
  assert.doesNotMatch(calls[0].sql, /normalizar|precio_centimos/);
  assert.deepEqual(calls[0].values, ['moto', '1.00', '5000.00']);
  assert.match(calls[1].sql, /ORDER BY a\.precio ASC/);
});

test('validación acepta categorías JSON decodificadas por MySQL', async () => {
  const db = { async get() { return { id: 1, subcategorias: ['Motos', 'Autos'] }; } };
  const result = await validateListing({ titulo: 'Moto de prueba', descripcion: 'Motor en buen estado', categoriaId: '1', subcategoria: 'Motos', zona: 'Puno', precio: '99.99' }, db, 1);
  assert.equal(result.precioCentimos, 9999);
});
