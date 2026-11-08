export interface User { id: number; nombre: string; correo: string; celular: string; fechaRegistro: string; demo: boolean; rol: 'usuario' | 'admin' }
export interface Category { id: number; nombre: string; subcategorias: string[]; total: number }
export interface Listing {
  id: number; usuarioId: number; titulo: string; descripcion: string; precio: number; zona: string;
  categoriaId: number; categoria: string; subcategoria: string; tipoOperacion: 'venta' | 'alquiler'; estado: 'activo' | 'dado_de_baja';
  fechaPublicacion: string; imagen: string; demo: boolean;
  moderacion: 'pendiente' | 'aprobado' | 'rechazado';
  estadoPago: 'pendiente' | 'en_revision' | 'confirmado' | 'rechazado';
  fechaAprobacion: string | null; fechaVencimiento: string | null;
  diasVigencia: number; diasPromocion: number; montoPublicacion: number; planId: number | null;
  destacado: boolean; motivoRevision: string; direccion: string; referencia: string;
  /** Solo en vistas privadas (propietario y administración). */
  contacto?: string; contactos?: number;
}
export interface ListingDetail extends Listing {
  fotos: { id: number; archivo: string; orden: number }[];
  vendedor: { id: number; nombre: string; celular?: string; fechaRegistro: string; demo: boolean };
  pago?: { comprobanteUrl: string | null; referenciaPago: string; fechaComprobante: string | null; fechaConfirmacion: string | null };
}
export interface PlanPublicacion { id: number; nombre: string; precio: number | null; dias: number; bonoPrimerAnuncio: number; destacado: boolean; activo: boolean }
export interface ConfigPago { configurado: boolean; metodo: string; titular: string; numero: string; qrUrl: string | null; instrucciones: string }
export interface PublicacionConfig { planes: (PlanPublicacion & { precio: number })[]; pago: ConfigPago }
export interface AdminResumen { anuncios: number; usuarios: number; pendientes: number; aprobados: number; rechazados: number; activos: number; vencidos: number; pagosEnRevision: number; pagosConfirmados: number; ingresos: number }
export interface CatalogResult { anuncios: Listing[]; total: number; page: number; totalPages: number }
export const ZONES = ['Puno', 'Juliaca', 'Otras localidades del sur del Perú'];
