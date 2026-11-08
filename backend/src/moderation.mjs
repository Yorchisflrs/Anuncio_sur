import path from 'node:path';
import fs from 'node:fs/promises';
import { ApiError } from './validation.mjs';
import { getListing, listingSelect, publicCondition } from './listings.mjs';
import { singleImage, preparePhotos, persistPhotos } from './uploads.mjs';

const PAYMENT_KEY = 'publicacion_pago_v1';
const emptyPayment = { metodo: '', titular: '', numero: '', instrucciones: '', qrArchivo: null, configurado: false };
const text = (value, max, field) => { if (typeof value !== 'string' || value.trim().length > max) throw new ApiError(422, 'Revisa la configuración.', { [field]: `Usa texto de hasta ${max} caracteres.` }); return value.trim(); };
const validId = value => { const id = Number(value); if (!Number.isSafeInteger(id) || id < 1) throw new ApiError(404, 'No encontramos este recurso.'); return id; };
export const serializePlan = row => ({ id: Number(row.id), nombre: row.nombre, precio: row.precio_centimos === null ? null : row.precio_centimos / 100, dias: Number(row.dias), bonoPrimerAnuncio: Number(row.bono_primer_anuncio), destacado: Boolean(row.destacado), activo: Boolean(row.activo) });
export async function readPayment(db, lock = false) {
  const row = await db.get('SELECT valor FROM metadata WHERE clave = ?' + (lock && db.kind === 'mysql' ? ' FOR UPDATE' : ''), PAYMENT_KEY);
  if (!row) return { ...emptyPayment };
  try { return { ...emptyPayment, ...JSON.parse(row.valor) }; } catch { return { ...emptyPayment }; }
}
const publicPayment = data => ({ configurado: Boolean(data.configurado), metodo: data.metodo, titular: data.titular, numero: data.numero, qrUrl: data.qrArchivo ? '/api/publicacion/qr' : null, instrucciones: data.instrucciones });
async function writePayment(db, value) {
  const clause = db.kind === 'mysql' ? 'ON DUPLICATE KEY UPDATE valor = VALUES(valor)' : 'ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor';
  await db.run('INSERT INTO metadata (clave,valor) VALUES (?,?) ' + clause, PAYMENT_KEY, JSON.stringify(value));
}
export async function getPublicationConfig(db) {
  return { planes: (await db.all('SELECT * FROM planes_publicacion WHERE activo = 1 AND precio_centimos > 0 ORDER BY id')).map(serializePlan), pago: publicPayment(await readPayment(db)) };
}
export async function publicationPlan(db, value) {
  const id = value === undefined || value === '' ? 1 : Number(value);
  const plan = Number.isSafeInteger(id) && await db.get('SELECT * FROM planes_publicacion WHERE id = ? AND activo = 1 AND precio_centimos > 0', id);
  if (!plan) throw new ApiError(422, 'Selecciona un plan de publicación disponible.', { planId: 'El plan no está disponible.' });
  return plan;
}
function validatePlan(body, previous = {}) {
  const merged = { ...serializePlan({ id: 0, nombre: '', precio_centimos: null, dias: 7, bono_primer_anuncio: 0, destacado: 0, activo: 0 }), ...previous, ...body };
  const nombre = text(merged.nombre, 80, 'nombre');
  if (!nombre) throw new ApiError(422, 'Escribe el nombre del plan.', { nombre: 'El nombre es obligatorio.' });
  const price = merged.precio === null || merged.precio === '' ? null : Number(merged.precio);
  if (price !== null && (!Number.isFinite(price) || price < 0 || price > 99999 || !/^\d+(\.\d{1,2})?$/.test(String(merged.precio)))) throw new ApiError(422, 'Revisa el precio del plan.', { precio: 'Usa un monto no negativo con hasta dos decimales.' });
  const dias = Number(merged.dias), bono = Number(merged.bonoPrimerAnuncio);
  if (!Number.isInteger(dias) || dias < 1 || dias > 365 || !Number.isInteger(bono) || bono < 0 || bono > 365) throw new ApiError(422, 'La duración debe ser de 1 a 365 días y el bono de 0 a 365 días.');
  if (typeof merged.activo !== 'boolean' || typeof merged.destacado !== 'boolean') throw new ApiError(422, 'Revisa las opciones del plan.');
  if (merged.activo && (price === null || price <= 0)) throw new ApiError(422, 'Configura un precio mayor que cero antes de activar el plan.', { precio: 'El plan activo necesita un precio de al menos S/ 0.01.' });
  return { nombre, precio: price === null ? null : Math.round(price * 100), dias, bono, activo: Number(merged.activo), destacado: Number(merged.destacado) };
}

export function registerModerationRoutes(app, db, auth, config) {
  const privateDir = path.resolve(config.privateUploadDir || path.join(config.uploadDir, '.privado'));
  const privateImage = name => path.join(privateDir, path.basename(name));
  const sendImage = async (res,name,privacy='private, no-store') => {
    const file=privateImage(name);
    let image;
    try { image=await fs.readFile(file); } catch { throw new ApiError(404,'No encontramos esta imagen.'); }
    res.set('Cache-Control',privacy).type('image/webp').send(image);
  };
  const ensureOwner = async (req, id) => {
    const ad = await db.get('SELECT * FROM anuncios WHERE id = ?', id);
    if (!ad) throw new ApiError(404, 'No encontramos este anuncio.');
    if (ad.usuario_id !== req.user.id && req.user.rol !== 'admin') throw new ApiError(403, 'Este documento es privado.');
    return ad;
  };
  app.get('/api/publicacion', async (_req,res) => res.json(await getPublicationConfig(db)));
  app.get('/api/publicacion/qr', async (_req,res) => {
    const payment = await readPayment(db);
    if (!payment.qrArchivo) throw new ApiError(404, 'Todavía no se ha configurado un QR de pago.');
    await sendImage(res,payment.qrArchivo,'no-store');
  });
  app.post('/api/anuncios/:id/comprobante', auth.requireUser, singleImage('comprobante'), async (req,res) => {
    const id = validId(req.params.id);
    await ensureOwner(req,id);
    const reference = req.body?.referenciaPago === undefined ? null : text(req.body.referenciaPago,160,'referenciaPago');
    if (!req.file) throw new ApiError(422,'Adjunta una imagen del comprobante (JPG, PNG, WebP o HEIC).',{comprobante:'Selecciona el comprobante.'});
    const photos = await preparePhotos([req.file],{field:'comprobante'});
    const saved = await persistPhotos(photos,privateDir);
    let oldFile;
    try {
      await db.transaction(async tx => {
        const ad = await tx.get('SELECT * FROM anuncios WHERE id = ?' + (tx.kind === 'mysql' ? ' FOR UPDATE' : ''),id);
        if (ad.moderacion === 'aprobado' || ad.estado_pago === 'confirmado') throw new ApiError(409,'El pago ya fue confirmado. No se puede sustituir su comprobante.');
        if (ad.estado !== 'activo') throw new ApiError(409,'No puedes adjuntar un comprobante a un anuncio dado de baja.');
        oldFile = ad.comprobante_archivo;
        await tx.run("UPDATE anuncios SET comprobante_archivo = ?, referencia_pago = ?, fecha_comprobante = ?, estado_pago = 'en_revision', moderacion = 'pendiente', motivo_revision = '' WHERE id = ?",photos[0].filename,reference ?? ad.referencia_pago,new Date().toISOString(),id);
      });
    } catch(error) { await Promise.allSettled(saved.map(file=>fs.unlink(file))); throw error; }
    if (oldFile) await fs.unlink(privateImage(oldFile)).catch(()=>{});
    res.json(await getListing(db,id,req.user));
  });
  app.get('/api/anuncios/:id/comprobante', auth.requireUser, async (req,res) => {
    const ad = await ensureOwner(req,validId(req.params.id));
    if (!ad.comprobante_archivo) throw new ApiError(404,'Este anuncio todavía no tiene comprobante.');
    await sendImage(res,ad.comprobante_archivo);
  });
  app.get('/api/admin/resumen', auth.requireAdmin, async (_req,res) => {
    const now = new Date().toISOString();
    const totals = await db.get(`SELECT COUNT(*) AS anuncios,
      SUM(CASE WHEN moderacion='pendiente' THEN 1 ELSE 0 END) AS pendientes,
      SUM(CASE WHEN moderacion='aprobado' THEN 1 ELSE 0 END) AS aprobados,
      SUM(CASE WHEN moderacion='rechazado' THEN 1 ELSE 0 END) AS rechazados,
      SUM(CASE WHEN ${publicCondition('anuncios')} AND EXISTS(SELECT 1 FROM categorias c WHERE c.id=anuncios.categoria_id AND c.activa=1) THEN 1 ELSE 0 END) AS activos,
      SUM(CASE WHEN moderacion='aprobado' AND fecha_vencimiento <= ? THEN 1 ELSE 0 END) AS vencidos,
      SUM(CASE WHEN estado_pago='en_revision' THEN 1 ELSE 0 END) AS pagosEnRevision,
      SUM(CASE WHEN estado_pago='confirmado' AND es_demo=0 THEN 1 ELSE 0 END) AS pagosConfirmados,
      SUM(CASE WHEN estado_pago='confirmado' AND es_demo=0 THEN monto_publicacion_centimos ELSE 0 END) AS ingreso_centimos FROM anuncios`,now,now);
    const users = await db.get('SELECT COUNT(*) AS total FROM usuarios');
    const reports = await db.get("SELECT COUNT(*) AS total, COUNT(DISTINCT anuncio_id) AS avisos FROM reportes WHERE estado = 'pendiente'");
    const hidden = await db.get('SELECT COUNT(*) AS n FROM anuncios WHERE revision_reportes = 1');
    const unverified = await db.get('SELECT COUNT(*) AS n FROM usuarios WHERE celular_verificado = 0 AND es_demo = 0');
    res.json({ anuncios:Number(totals.anuncios),usuarios:Number(users.total),pendientes:Number(totals.pendientes||0),aprobados:Number(totals.aprobados||0),rechazados:Number(totals.rechazados||0),activos:Number(totals.activos||0),vencidos:Number(totals.vencidos||0),pagosEnRevision:Number(totals.pagosEnRevision||0),pagosConfirmados:Number(totals.pagosConfirmados||0),ingresos:Number(totals.ingreso_centimos||0)/100,
      reportesPendientes:Number(reports.total||0),avisosReportados:Number(reports.avisos||0),ocultosPorReportes:Number(hidden.n||0),celularesSinVerificar:Number(unverified.n||0) });
  });
  app.get('/api/admin/anuncios', auth.requireAdmin, async (req,res) => {
    const where = [], values = [];
    if (req.query.moderacion && req.query.moderacion !== 'todos') {
      if (!['pendiente','aprobado','rechazado'].includes(req.query.moderacion)) throw new ApiError(422,'Selecciona un estado de revisión válido.');
      where.push('a.moderacion = ?'); values.push(req.query.moderacion);
    }
    const q = String(req.query.q || '').trim().slice(0,100);
    if (q) { where.push(db.kind === 'mysql' ? "LOCATE(?, CONCAT(a.titulo,' ',a.descripcion)) > 0" : "instr(lower(a.titulo || ' ' || a.descripcion), lower(?)) > 0"); values.push(q); }
    const rows = await db.all(listingSelect + (where.length ? ' WHERE '+where.join(' AND ') : '') + ' ORDER BY a.fecha_publicacion DESC,a.id DESC',...values);
    res.json(await Promise.all(rows.map(row=>getListing(db,row.id,req.user))));
  });
  app.post('/api/admin/anuncios/:id/aprobar', auth.requireAdmin, async (req,res) => {
    const id = validId(req.params.id);
    if (req.body?.confirmarPago !== true) throw new ApiError(422,'Confirma que revisaste y recibiste el pago.',{confirmarPago:'Debes confirmar el pago manualmente.'});
    const reference = req.body.referenciaPago === undefined ? '' : text(req.body.referenciaPago,160,'referenciaPago');
    const owner = await db.get('SELECT usuario_id FROM anuncios WHERE id = ?',id);
    if (!owner) throw new ApiError(404,'No encontramos este anuncio.');
    await db.transaction(async tx => {
      const lock = tx.kind === 'mysql' ? ' FOR UPDATE' : '';
      await tx.get('SELECT id FROM usuarios WHERE id = ?'+lock,owner.usuario_id);
      const ad = await tx.get('SELECT * FROM anuncios WHERE id = ?'+lock,id);
      if (ad.moderacion === 'aprobado' && ad.estado_pago === 'confirmado') return;
      if (ad.estado !== 'activo') throw new ApiError(409,'El anuncio está dado de baja.');
      const hasReceipt=ad.comprobante_archivo&&await fs.access(privateImage(ad.comprobante_archivo)).then(()=>true,()=>false);
      if (!hasReceipt && reference.length < 4) throw new ApiError(422,'Revisa un comprobante o escribe una referencia explícita del pago externo.',{referenciaPago:'Escribe al menos cuatro caracteres para identificar el pago.'});
      const previous = await tx.get('SELECT COUNT(*) AS total FROM anuncios WHERE usuario_id = ? AND fecha_aprobacion IS NOT NULL AND id <> ?',ad.usuario_id,id);
      const bonus = previous.total === 0 ? Number(ad.bono_primer_snapshot) : 0;
      const approved = new Date();
      const expires = new Date(approved.getTime() + (Number(ad.dias_vigencia)+bonus)*86400000);
      await tx.run("UPDATE anuncios SET moderacion='aprobado',estado_pago='confirmado',fecha_aprobacion=?,fecha_confirmacion=?,fecha_vencimiento=?,dias_promocion=?,referencia_pago=?,motivo_revision='' WHERE id=?",approved.toISOString(),approved.toISOString(),expires.toISOString(),bonus,reference||ad.referencia_pago,id);
    });
    res.json(await getListing(db,id,req.user));
  });
  app.post('/api/admin/anuncios/:id/rechazar', auth.requireAdmin, async (req,res) => {
    const id = validId(req.params.id), motivo = text(req.body?.motivo || '',1000,'motivo');
    if (motivo.length < 5) throw new ApiError(422,'Explica el motivo de la revisión con al menos cinco caracteres.',{motivo:'El motivo es obligatorio.'});
    await db.transaction(async tx => {
      const ad = await tx.get('SELECT * FROM anuncios WHERE id = ?'+(tx.kind==='mysql'?' FOR UPDATE':''),id);
      if (!ad) throw new ApiError(404,'No encontramos este anuncio.');
      if (ad.fecha_aprobacion || ad.estado_pago === 'confirmado') throw new ApiError(409,'Un pago confirmado no se puede cambiar por un rechazo.');
      await tx.run("UPDATE anuncios SET moderacion='rechazado',estado_pago='rechazado',motivo_revision=? WHERE id=?",motivo,id);
    });
    res.json(await getListing(db,id,req.user));
  });
  app.get('/api/admin/configuracion', auth.requireAdmin, async (_req,res)=>res.json(publicPayment(await readPayment(db))));
  app.put('/api/admin/configuracion', auth.requireAdmin, async (req,res)=>{
    let payment;
    await db.transaction(async tx=>{
      payment = await readPayment(tx,true);
      for (const [key,max] of Object.entries({metodo:80,titular:160,numero:100,instrucciones:1000})) if (req.body?.[key] !== undefined) payment[key]=text(req.body[key],max,key);
      if (req.body?.qrUrl === '') payment.qrArchivo=null;
      payment.configurado = Boolean(payment.metodo && payment.titular && (payment.numero || payment.qrArchivo));
      if (req.body?.configurado === false) payment.configurado=false;
      await writePayment(tx,payment);
    });
    res.json(publicPayment(payment));
  });
  app.post('/api/admin/configuracion/qr', auth.requireAdmin, singleImage('qr'), async (req,res)=>{
    if (!req.file) throw new ApiError(422,'Selecciona una imagen del QR (JPG, PNG o WebP).',{qr:'Selecciona el QR de tu cuenta.'});
    const photos=await preparePhotos([req.file],{lossless:true,field:'qr'}),saved=await persistPhotos(photos,privateDir);
    let payment,oldFile;
    try { await db.transaction(async tx=>{ payment=await readPayment(tx,true);oldFile=payment.qrArchivo;payment.qrArchivo=photos[0].filename;payment.configurado=Boolean(payment.metodo&&payment.titular);await writePayment(tx,payment); }); }
    catch(error){await Promise.allSettled(saved.map(file=>fs.unlink(file)));throw error;}
    if(oldFile)await fs.unlink(privateImage(oldFile)).catch(()=>{});
    res.json(publicPayment(payment));
  });
  app.get('/api/admin/planes', auth.requireAdmin, async (_req,res)=>res.json((await db.all('SELECT * FROM planes_publicacion ORDER BY id')).map(serializePlan)));
  app.post('/api/admin/planes', auth.requireAdmin, async (req,res)=>{
    const plan=validatePlan(req.body||{});
    const result=await db.run('INSERT INTO planes_publicacion (nombre,precio_centimos,dias,bono_primer_anuncio,destacado,activo) VALUES (?,?,?,?,?,?)',plan.nombre,plan.precio,plan.dias,plan.bono,plan.destacado,plan.activo);
    res.status(201).json(serializePlan(await db.get('SELECT * FROM planes_publicacion WHERE id=?',result.lastInsertRowid)));
  });
  app.patch('/api/admin/planes/:id', auth.requireAdmin, async (req,res)=>{
    const id=validId(req.params.id);
    await db.transaction(async tx=>{
      const row=await tx.get('SELECT * FROM planes_publicacion WHERE id=?'+(tx.kind==='mysql'?' FOR UPDATE':''),id);
      if(!row)throw new ApiError(404,'No encontramos este plan.');
      const plan=validatePlan(req.body||{},serializePlan(row));
      await tx.run('UPDATE planes_publicacion SET nombre=?,precio_centimos=?,dias=?,bono_primer_anuncio=?,destacado=?,activo=? WHERE id=?',plan.nombre,plan.precio,plan.dias,plan.bono,plan.destacado,plan.activo,id);
    });
    res.json(serializePlan(await db.get('SELECT * FROM planes_publicacion WHERE id=?',id)));
  });
}
