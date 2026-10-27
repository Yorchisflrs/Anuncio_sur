import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { createApp } from '../backend/src/app.mjs';

const project = fileURLToPath(new URL('../', import.meta.url));
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'avisosur-benchmark-'));
const { app, db } = await createApp({ databaseClient: 'sqlite', databasePath: path.join(temporary, 'load.sqlite'), uploadDir: path.join(temporary, 'uploads') });
const insert = db.prepare('INSERT INTO anuncios (usuario_id, titulo, descripcion, precio_centimos, zona, categoria_id, subcategoria, es_demo, fecha_publicacion) VALUES (1, ?, ?, ?, ?, ?, ?, 1, ?)');
const count = db.prepare("SELECT COUNT(*) AS n FROM anuncios WHERE estado = 'activo'").get().n;
db.exec('BEGIN');
for (let index = count; index < 500; index++) {
  const category = index % 3 + 1;
  const result = insert.run(['Moto de carga', 'Departamento en alquiler', 'Lavadora automática'][category - 1] + ' ' + index, 'Registro sintético de rendimiento, no visible en el catálogo de demostración.', (index % 80 + 1) * 10000, index % 2 ? 'Puno' : 'Juliaca', category, ['Motos', 'Departamentos', 'Lavadoras'][category - 1], new Date(Date.now() - index * 1000).toISOString());
  db.prepare('INSERT INTO fotos (anuncio_id, archivo, orden, fecha_subida) VALUES (?, ?, 0, ?)').run(result.lastInsertRowid, '/demo/moto-roja.svg', new Date().toISOString());
}
db.exec('COMMIT');
const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
const base = 'http://127.0.0.1:' + server.address().port + '/api/anuncios';
const queries = ['', '?categoriaId=1&min=0&max=5000', '?q=departamento&zona=Puno', '?categoriaId=3&subcategoria=Lavadoras&sort=price_asc', '?min=5000&max=5000'];
try {
  for (let index = 0; index < 25; index++) { const response = await fetch(base + queries[index % queries.length]); if (!response.ok) throw new Error('Falló el calentamiento'); await response.json(); }
  const durations = []; let failures = 0; const started = performance.now();
  await Promise.all(Array.from({ length: 50 }, async (_, user) => {
    for (let iteration = 0; iteration < 10; iteration++) {
      const start = performance.now();
      try { const response = await fetch(base + queries[(user + iteration) % queries.length]); const body = await response.json(); if (!response.ok || !Array.isArray(body.anuncios)) failures++; }
      catch { failures++; }
      durations.push(performance.now() - start);
    }
  }));
  const totalMs = performance.now() - started; durations.sort((a, b) => a - b);
  const round = value => Math.round(value * 100) / 100;
  const percentile = value => durations[Math.ceil(durations.length * value) - 1];
  const report = {
    fecha: new Date().toISOString(), requisito: 'RNF-01', entorno: { node: process.version, sistema: os.platform() + ' ' + os.release(), cpu: os.cpus()[0].model, red: 'HTTP loopback en 127.0.0.1; cliente y servidor en la misma computadora' },
    anunciosActivos: 500, usuariosConcurrentes: 50, solicitudesPorUsuario: 10, solicitudes: durations.length, calentamiento: 25, errores: failures,
    latenciaMs: { minimo: round(durations[0]), mediana: round(percentile(.5)), p95: round(percentile(.95)), p99: round(percentile(.99)), maximo: round(durations.at(-1)) },
    duracionTotalMs: round(totalMs), solicitudesPorSegundo: round(durations.length * 1000 / totalMs),
    objetivoMs: 2000, objetivoCumplidoEnEsteEntorno: failures === 0 && durations.at(-1) < 2000,
    alcance: 'Prueba de la API con 50 clientes virtuales, 10 búsquedas secuenciales por cliente. No mide navegador, red 3G, tráfico público ni disponibilidad.',
    planDeConsulta: db.prepare("EXPLAIN QUERY PLAN SELECT id FROM anuncios WHERE estado = 'activo' AND categoria_id = 1 AND precio_centimos >= 0 AND precio_centimos <= 500000").all(),
  };
  await fs.mkdir(path.join(project, 'docs'), { recursive: true });
  await fs.writeFile(path.join(project, 'docs', 'benchmark-results.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  if (!report.objetivoCumplidoEnEsteEntorno) process.exitCode = 1;
} finally {
  await new Promise(resolve => server.close(resolve)); db.close();
  const resolved = path.resolve(temporary);
  if (resolved.startsWith(path.resolve(os.tmpdir()) + path.sep + 'avisosur-benchmark-')) await fs.rm(resolved, { recursive: true, force: true });
}
