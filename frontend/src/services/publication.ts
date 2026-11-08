import type { Listing } from '../types';

export function publicationStatus(ad: Listing) {
  if (ad.estado === 'dado_de_baja') return { key: 'baja', label: 'Dado de baja' };
  if (ad.revisionReportes) return { key: 'reportado', label: 'Oculto: en revisión por reportes' };
  if (ad.moderacion === 'rechazado') return { key: 'rechazado', label: 'Requiere atención' };
  if (ad.moderacion === 'aprobado' && ad.fechaVencimiento && new Date(ad.fechaVencimiento).getTime() <= Date.now()) return { key: 'vencido', label: 'Vigencia finalizada' };
  if (ad.moderacion === 'aprobado' && ad.estadoPago === 'confirmado') return { key: 'activo', label: 'Publicado' };
  if (ad.estadoPago === 'en_revision') return { key: 'revision', label: 'Comprobante en revisión' };
  if (ad.estadoPago === 'confirmado') return { key: 'revision', label: 'Esperando aprobación' };
  return { key: 'pendiente', label: 'Pendiente de pago y revisión' };
}
