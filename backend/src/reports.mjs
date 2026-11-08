import { ApiError } from './validation.mjs';
import { getListing, isPublicRow, listingSelect } from './listings.mjs';

// Reporte de estafa: motivos fijos, un reporte por persona y aviso. Con tres reportes pendientes de
// cuentas con celular verificado distintas, el aviso se oculta hasta que lo revise administración.
export const REPORT_REASONS = {
  pide_adelanto: 'Pide un adelanto antes de mostrar el producto',
  precio_sospechoso: 'El precio es sospechoso',
  no_existe: 'El producto o el inmueble no existe',
  ya_vendido: 'Ya se vendió o ya se alquiló',
};
export const REPORT_THRESHOLD = 3;
const validId = value => { const id = Number(value); if (!Number.isSafeInteger(id) || id < 1) throw new ApiError(404, 'Este anuncio no está disponible.'); return id; };
const duplicateError = () => new ApiError(409, 'Ya reportaste este aviso. Administración lo revisará.');
const isUniqueViolation = error => error?.code === 'ER_DUP_ENTRY' || /UNIQUE constraint failed/i.test(String(error?.message));

export function registerReportRoutes(app, db, auth) {
  app.post('/api/anuncios/:id/reportes', auth.requireUser, async (req, res) => {
    const id = validId(req.params.id);
    const motivo = String(req.body?.motivo ?? '');
    const detalle = String(req.body?.detalle ?? '').trim();
    if (!Object.hasOwn(REPORT_REASONS, motivo)) throw new ApiError(422, 'Elige el motivo del reporte.', { motivo: 'Elige uno de los motivos de la lista.' });
    if (detalle.length > 500) throw new ApiError(422, 'Revisa el detalle del reporte.', { detalle: 'Usa hasta 500 caracteres.' });
    let enRevision = false;
    await db.transaction(async tx => {
      // En MySQL se bloquea el aviso para contar los reportes simultáneos uno tras otro.
      if (tx.kind === 'mysql') await tx.get('SELECT id FROM anuncios WHERE id = ? FOR UPDATE', id);
      const row = await tx.get(listingSelect + ' WHERE a.id = ?', id);
      if (!isPublicRow(row)) throw new ApiError(404, 'Este anuncio no está disponible.');
      if (row.usuario_id === req.user.id) throw new ApiError(403, 'No puedes reportar tu propio aviso.');
      if (await tx.get('SELECT id FROM reportes WHERE anuncio_id = ? AND usuario_id = ?', id, req.user.id)) throw duplicateError();
      try { await tx.run('INSERT INTO reportes (anuncio_id, usuario_id, motivo, detalle, fecha) VALUES (?, ?, ?, ?, ?)', id, req.user.id, motivo, detalle, new Date().toISOString()); }
      catch (error) { if (isUniqueViolation(error)) throw duplicateError(); throw error; }
      const verified = await tx.get("SELECT COUNT(DISTINCT r.usuario_id) AS n FROM reportes r JOIN usuarios u ON u.id = r.usuario_id WHERE r.anuncio_id = ? AND r.estado = 'pendiente' AND u.celular_verificado = 1", id);
      if (Number(verified.n) >= REPORT_THRESHOLD) {
        await tx.run('UPDATE anuncios SET revision_reportes = 1, fecha_revision_reportes = ? WHERE id = ? AND revision_reportes = 0', new Date().toISOString(), id);
        enRevision = true;
      }
    });
    res.status(201).json({ enRevision, message: enRevision ? 'Gracias. El aviso quedó oculto mientras administración lo revisa.' : 'Gracias. Administración revisará este aviso.' });
  });

  // Página del moderador: avisos con reportes pendientes, primero los que ya están ocultos.
  app.get('/api/admin/reportes', auth.requireAdmin, async (req, res) => {
    const rows = await db.all(`SELECT r.id, r.anuncio_id, r.motivo, r.detalle, r.fecha, u.id AS reportante_id, u.nombre AS reportante_nombre, u.celular_verificado AS reportante_verificado
      FROM reportes r JOIN usuarios u ON u.id = r.usuario_id WHERE r.estado = 'pendiente' ORDER BY r.fecha DESC, r.id DESC LIMIT 500`);
    const groups = new Map();
    for (const row of rows) {
      const id = Number(row.anuncio_id);
      if (!groups.has(id)) groups.set(id, []);
      groups.get(id).push({ id: Number(row.id), motivo: row.motivo, motivoTexto: REPORT_REASONS[row.motivo] || row.motivo, detalle: row.detalle || '', fecha: row.fecha, reportante: { id: Number(row.reportante_id), nombre: row.reportante_nombre || 'Sin nombre para mostrar', verificado: Boolean(Number(row.reportante_verificado)) } });
    }
    const result = await Promise.all([...groups].map(async ([id, reportes]) => ({ anuncio: await getListing(db, id, req.user), reportes, reportantesVerificados: new Set(reportes.filter(item => item.reportante.verificado).map(item => item.reportante.id)).size })));
    result.sort((one, two) => Number(two.anuncio.revisionReportes) - Number(one.anuncio.revisionReportes) || two.reportes.length - one.reportes.length);
    res.json(result);
  });

  app.post('/api/admin/anuncios/:id/reportes/resolver', auth.requireAdmin, async (req, res) => {
    const id = validId(req.params.id);
    const accion = req.body?.accion;
    if (!['restaurar', 'dar_de_baja'].includes(accion)) throw new ApiError(422, 'Elige restaurar el aviso o darlo de baja.', { accion: 'Acción no válida.' });
    await db.transaction(async tx => {
      const ad = await tx.get('SELECT * FROM anuncios WHERE id = ?' + (tx.kind === 'mysql' ? ' FOR UPDATE' : ''), id);
      if (!ad) throw new ApiError(404, 'No encontramos este anuncio.');
      const pending = Number((await tx.get("SELECT COUNT(*) AS n FROM reportes WHERE anuncio_id = ? AND estado = 'pendiente'", id)).n);
      if (!pending && !Number(ad.revision_reportes)) throw new ApiError(409, 'Este aviso no tiene reportes pendientes.');
      const now = new Date();
      if (accion === 'restaurar') {
        // Los días que estuvo oculto por reportes se devuelven al vendedor que pagó la publicación.
        const hiddenMs = Number(ad.revision_reportes) && ad.fecha_revision_reportes ? Math.max(0, now.getTime() - Date.parse(ad.fecha_revision_reportes)) : 0;
        const expires = ad.fecha_vencimiento ? new Date(Date.parse(ad.fecha_vencimiento) + hiddenMs).toISOString() : null;
        await tx.run('UPDATE anuncios SET revision_reportes = 0, fecha_revision_reportes = NULL, fecha_vencimiento = ? WHERE id = ?', expires, id);
      } else {
        await tx.run("UPDATE anuncios SET estado = 'dado_de_baja', revision_reportes = 0, fecha_revision_reportes = NULL WHERE id = ?", id);
      }
      await tx.run("UPDATE reportes SET estado = 'revisado', fecha_revision = ?, revisado_por = ?, resolucion = ? WHERE anuncio_id = ? AND estado = 'pendiente'", now.toISOString(), req.user.id, accion === 'restaurar' ? 'restaurado' : 'dado_de_baja', id);
    });
    res.json(await getListing(db, id, req.user));
  });
}
