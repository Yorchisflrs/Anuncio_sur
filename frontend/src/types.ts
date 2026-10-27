export interface User { id: number; correo: string; celular: string; fechaRegistro: string; demo: boolean }
export interface Category { id: number; nombre: string; subcategorias: string[]; total: number }
export interface Listing {
  id: number; usuarioId: number; titulo: string; descripcion: string; precio: number; zona: string;
  categoriaId: number; categoria: string; subcategoria: string; estado: 'activo' | 'dado_de_baja';
  fechaPublicacion: string; imagen: string; demo: boolean;
}
export interface ListingDetail extends Listing {
  fotos: { id: number; archivo: string; orden: number }[];
  vendedor: { id: number; nombre: string; celular: string; fechaRegistro: string; demo: boolean };
  whatsappUrl: string;
}
export interface CatalogResult { anuncios: Listing[]; total: number; page: number; totalPages: number }
export const ZONES = ['Puno', 'Juliaca', 'Otras localidades del sur del Perú'];
