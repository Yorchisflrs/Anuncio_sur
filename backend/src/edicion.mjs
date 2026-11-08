import { ApiError, ZONES, OPERATIONS } from './validation.mjs';
import { getListing } from './listings.mjs';

const EDITABLE_FIELDS = ['titulo', 'descripcion', 'precio', 'zona', 'tipoOperacion', 'direccion', 'referencia'];
const validId = value => { const id = Number(value); if (!Number.isSafeInteger(id) || id < 1) throw new ApiError(404, 'No encontramos este anuncio.'); return id; };

// Valida solo los campos enviados; los datos que no se editan permanecen intactos.
function validateEdit(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || !EDITABLE_FIELDS.some(field => Object.hasOwn(body, field))) {
    throw new ApiError(422, 'Cambia al menos un dato del aviso.', { formulario: 'Envía al menos un campo editable.' });
  }
  const data = {}, fields = {};
  for (const field of EDITABLE_FIELDS) if (Object.hasOwn(body, field)) data[field] = String(body[field] || '').trim();
  if (Object.hasOwn(data, 'titulo') && (data.titulo.length < 5 || data.titulo.length > 100)) fields.titulo = 'El título debe tener entre 5 y 100 caracteres.';
  if (Object.hasOwn(data, 'descripcion') && (!data.descripcion || data.descripcion.length > 3000)) fields.descripcion = 'Escribe una descripción de hasta 3000 caracteres.';
  if (Object.hasOwn(data, 'precio')) {
    const precio = Number(body.precio);
    if (!Number.isFinite(precio) || precio <= 0 || precio > 99999999.99 || !/^\d+(\.\d{1,2})?$/.test(String(body.precio || ''))) fields.precio = 'El precio debe ser mayor que S/ 0 y tener como máximo dos decimales.';
    else data.precio = Math.round(precio * 100);
  }
  if (Object.hasOwn(data, 'zona') && !ZONES.includes(data.zona)) fields.zona = 'Selecciona una zona.';
  if (Object.hasOwn(data, 'tipoOperacion')) {
    data.tipoOperacion = String(body.tipoOperacion);
    if (!OPERATIONS.includes(data.tipoOperacion)) fields.tipoOperacion = 'Indica si vendes o alquilas.';
  }
  if (Object.hasOwn(data, 'direccion') && data.direccion.length > 200) fields.direccion = 'Usa hasta 200 caracteres.';
  if (Object.hasOwn(data, 'referencia') && data.referencia.length > 300) fields.referencia = 'Usa hasta 300 caracteres.';
  if (Object.keys(fields).length) throw new ApiError(422, 'Revisa los datos antes de publicar.', fields);
  return data;
}

export function registerEditRoutes(app, db, auth) {
  app.patch('/api/anuncios/:id', auth.requireUser, async (req, res) => {
    const id = validId(req.params.id);
    await db.transaction(async tx => {
      // Comparte el bloqueo del aviso con la aprobación: el estado se comprueba antes de escribir.
      const ad = await tx.get('SELECT * FROM anuncios WHERE id = ?' + (tx.kind === 'mysql' ? ' FOR UPDATE' : ''), id);
      if (!ad) throw new ApiError(404, 'No encontramos este anuncio.');
      if (ad.usuario_id !== req.user.id) throw new ApiError(403, 'Solo puedes editar tus propios avisos.');
      if (ad.fecha_aprobacion !== null || ad.estado === 'dado_de_baja') throw new ApiError(409, 'Solo puedes editar un aviso que todavía no fue aprobado ni dado de baja.');
      const data = validateEdit(req.body);
      const columns = { titulo: 'titulo', descripcion: 'descripcion', precio: tx.kind === 'mysql' ? 'precio' : 'precio_centimos', zona: 'zona', tipoOperacion: 'tipo_operacion', direccion: 'direccion', referencia: 'referencia' };
      const updates = [], values = [];
      for (const [field, value] of Object.entries(data)) {
        updates.push(columns[field] + ' = ?');
        values.push(field === 'precio' && tx.kind === 'mysql' ? (value / 100).toFixed(2) : value);
      }
      if (ad.moderacion === 'rechazado') updates.push("moderacion = 'pendiente'");
      await tx.run('UPDATE anuncios SET ' + updates.join(', ') + ' WHERE id = ?', ...values, id);
    });
    res.json(await getListing(db, id, req.user));
  });
}
