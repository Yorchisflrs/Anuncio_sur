import { ApiError } from './validation.mjs';
import { getListing } from './listings.mjs';
import { publicationPlan } from './moderation.mjs';
import { requireVerified } from './verification.mjs';

// Volver a publicar: un aviso vencido se copia en una solicitud nueva, con los mismos datos y fotos, que
// pasa otra vez por pago y revisión. El aviso anterior no cambia y conserva su historial.
const validId = value => { const id = Number(value); if (!Number.isSafeInteger(id) || id < 1) throw new ApiError(404, 'No encontramos este anuncio.'); return id; };

/** Motivo por el que el aviso todavía no se puede volver a publicar, o null si ya venció. */
function renewalConflict(ad) {
  if (ad.estado !== 'activo') return 'Un aviso dado de baja no se puede volver a publicar.';
  if (Number(ad.revision_reportes)) return 'Este aviso está en revisión por reportes. Espera la decisión de administración.';
  if (!ad.fecha_aprobacion) return 'Este aviso todavía no fue aprobado. Complétalo desde «Pago y revisión».';
  if (!(Date.parse(ad.fecha_vencimiento) <= Date.now())) return 'Este aviso sigue vigente. Podrás volver a publicarlo cuando venza.';
  return null;
}

export function registerRenewRoutes(app, db, auth) {
  app.post('/api/anuncios/:id/renovar', auth.requireUser, requireVerified, async (req, res) => {
    const id = validId(req.params.id);
    const nuevoId = await db.transaction(async tx => {
      const ad = await tx.get('SELECT * FROM anuncios WHERE id = ?' + (tx.kind === 'mysql' ? ' FOR UPDATE' : ''), id);
      if (!ad) throw new ApiError(404, 'No encontramos este anuncio.');
      if (ad.usuario_id !== req.user.id) throw new ApiError(403, 'Solo puedes volver a publicar tus propios avisos.');
      const conflict = renewalConflict(ad);
      if (conflict) throw new ApiError(409, conflict);
      // Como al publicar, la categoría debe seguir activa: si no, se pagaría por un aviso que nadie vería.
      const category = await tx.get('SELECT activa FROM categorias WHERE id = ?', ad.categoria_id);
      if (!Number(category?.activa)) throw new ApiError(409, 'La categoría de este aviso ya no está disponible. Publica un aviso nuevo en otra categoría.');
      // Dentro de la transacción se consulta con tx: en SQLite, db esperaría a que la transacción termine.
      const plan = await publicationPlan(tx, req.body?.planId);
      const date = new Date().toISOString();
      const priceColumn = tx.kind === 'mysql' ? 'precio' : 'precio_centimos';
      const result = await tx.run(`INSERT INTO anuncios (usuario_id, titulo, descripcion, ${priceColumn}, zona, categoria_id, subcategoria, tipo_operacion, es_demo, fecha_publicacion, plan_id, dias_vigencia, monto_publicacion_centimos, bono_primer_snapshot, destacado, direccion, referencia, contacto) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, req.user.id, ad.titulo, ad.descripcion, ad[priceColumn], ad.zona, ad.categoria_id, ad.subcategoria, ad.tipo_operacion, Number(ad.es_demo), date, plan.id, plan.dias, plan.precio_centimos, plan.bono_primer_anuncio, plan.destacado, ad.direccion, ad.referencia, ad.contacto);
      const nuevo = Number(result.lastInsertRowid);
      // Las filas nuevas apuntan al mismo archivo o enlace, en el mismo orden: no se copia nada en el disco.
      for (const photo of await tx.all('SELECT archivo, orden, fecha_subida FROM fotos WHERE anuncio_id = ? ORDER BY orden', id)) {
        await tx.run('INSERT INTO fotos (anuncio_id, archivo, orden, fecha_subida) VALUES (?, ?, ?, ?)', nuevo, photo.archivo, photo.orden, photo.fecha_subida);
      }
      return nuevo;
    });
    res.status(201).json(await getListing(db, nuevoId, req.user));
  });
}
