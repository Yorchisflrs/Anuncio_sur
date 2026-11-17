import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { defaultConfig, projectRoot } from '../backend/src/config.mjs';
import { openDatabase } from '../backend/src/database.mjs';

/**
 * Carga 50 anuncios referenciales con fotos reales y licencia documentada.
 * Solo reutiliza los anuncios de la cuenta de muestra. No toca anuncios de otras cuentas.
 * Ejecutar explícitamente: npm run catalog:seed
 */
const catalog = JSON.parse(await fs.readFile(path.join(projectRoot, 'database', 'catalogo-fotografico.json'), 'utf8'));
if (catalog.length !== 50 || new Set(catalog.map(item => item.key)).size !== 50) throw new Error('El catálogo debe contener exactamente 50 entradas únicas.');
for (const item of catalog) {
  if (!item.foto.startsWith('/images/catalogo/') || !Number.isInteger(item.precio * 100) || item.precio <= 0) throw new Error(`Entrada inválida: ${item.key}`);
  const stat = await fs.stat(path.join(projectRoot, 'frontend', 'public', item.foto.slice(1)));
  if (stat.size < 10_000) throw new Error(`Foto incompleta: ${item.foto}`);
}

const db = await openDatabase(defaultConfig);
try {
  const now = new Date();
  const approved = now.toISOString();
  const expires = new Date(now.getTime() + 365 * 86400_000).toISOString();
  const priceColumn = db.kind === 'mysql' ? 'precio' : 'precio_centimos';
  const result = await db.transaction(async tx => {
    let user = await tx.get('SELECT id, es_demo FROM usuarios WHERE correo = ?', 'demo@avisosur.local');
    if (user && !Number(user.es_demo)) throw new Error('El correo reservado para las muestras pertenece a una cuenta real.');
    if (!user) {
      const passwordHash = await bcrypt.hash(randomBytes(24).toString('base64url'), 12);
      const inserted = await tx.run('INSERT INTO usuarios (nombre, correo, celular, password_hash, es_demo, fecha_registro) VALUES (?, ?, ?, ?, 1, ?)', 'AvisoSur · contenido referencial', 'demo@avisosur.local', '900000000', passwordHash, approved);
      user = { id: Number(inserted.lastInsertRowid) };
    } else {
      await tx.run('UPDATE usuarios SET nombre = ? WHERE id = ?', 'AvisoSur · contenido referencial', user.id);
    }
    const existing = await tx.all('SELECT id FROM anuncios WHERE usuario_id = ? AND es_demo = 1 ORDER BY id', user.id);
    let added = 0;
    for (let index = 0; index < catalog.length; index++) {
      const item = catalog[index];
      const published = new Date(now.getTime() - index * 45 * 60_000).toISOString();
      const price = db.kind === 'mysql' ? item.precio.toFixed(2) : Math.round(item.precio * 100);
      const featured = index < 6 ? 1 : 0;
      let id = existing[index]?.id;
      if (id) {
        await tx.run(`UPDATE anuncios SET titulo=?, descripcion=?, ${priceColumn}=?, zona=?, categoria_id=?, subcategoria=?, tipo_operacion=?, estado='activo', moderacion='aprobado', estado_pago='confirmado', fecha_publicacion=?, plan_id=1, dias_vigencia=365, dias_promocion=0, monto_publicacion_centimos=0, destacado=?, bono_primer_snapshot=0, fecha_aprobacion=?, fecha_vencimiento=?, fecha_confirmacion=?, motivo_revision='', contacto='', revision_reportes=0 WHERE id=? AND usuario_id=? AND es_demo=1`, item.titulo, item.descripcion, price, item.zona, item.categoriaId, item.subcategoria, item.tipoOperacion, published, featured, approved, expires, approved, id, user.id);
        await tx.run('DELETE FROM fotos WHERE anuncio_id = ?', id);
      } else {
        const inserted = await tx.run(`INSERT INTO anuncios (usuario_id, titulo, descripcion, ${priceColumn}, zona, categoria_id, subcategoria, tipo_operacion, estado, es_demo, fecha_publicacion, moderacion, estado_pago, plan_id, dias_vigencia, dias_promocion, monto_publicacion_centimos, destacado, bono_primer_snapshot, fecha_aprobacion, fecha_vencimiento, fecha_confirmacion, revision_reportes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'activo', 1, ?, 'aprobado', 'confirmado', 1, 365, 0, 0, ?, 0, ?, ?, ?, 0)`, user.id, item.titulo, item.descripcion, price, item.zona, item.categoriaId, item.subcategoria, item.tipoOperacion, published, featured, approved, expires, approved);
        id = Number(inserted.lastInsertRowid);
        added++;
      }
      await tx.run('INSERT INTO fotos (anuncio_id, archivo, orden, fecha_subida) VALUES (?, ?, 0, ?)', id, item.foto, published);
    }
    return { updated: Math.min(existing.length, catalog.length), added, otherSampleAds: Math.max(0, existing.length - catalog.length) };
  });
  console.log(JSON.stringify({ database: db.kind, catalog: catalog.length, ...result }));
} finally {
  await db.close();
}
