import { CarFront, Building2, Refrigerator } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Category } from '../types';

// Motivos fijos del reporte; las claves coinciden con REPORT_REASONS de backend/src/reports.mjs.
export const REPORT_REASONS = [
  { value: 'pide_adelanto', label: 'Pide un adelanto antes de mostrar el producto' },
  { value: 'precio_sospechoso', label: 'El precio es sospechoso' },
  { value: 'no_existe', label: 'El producto o el inmueble no existe' },
  { value: 'ya_vendido', label: 'Ya se vendió o ya se alquiló' },
];

// Íconos de las categorías activas en el backend (por id). Solo se muestran las que existen.
export const CATEGORY_ICONS: Record<number, LucideIcon> = { 1: CarFront, 2: Building2, 3: Refrigerator };

// Las mismas categorías mientras responde la API: la página se dibuja con su alto final y no salta (CLS).
export const CATEGORY_FALLBACK: Category[] = [{ id: 1, nombre: 'Vehículos', subcategorias: [], total: 0 }, { id: 2, nombre: 'Inmuebles', subcategorias: [], total: 0 }, { id: 3, nombre: 'Electrodomésticos', subcategorias: [], total: 0 }];

export const QUICK_SEARCHES = [
  { label: 'Cuartos en alquiler en Puno', to: '/anuncios?categoriaId=2&subcategoria=Habitaciones&zona=Puno&tipo=alquiler' },
  { label: 'Motos en Juliaca', to: '/anuncios?categoriaId=1&subcategoria=Motos&zona=Juliaca' },
  { label: 'Departamentos en alquiler', to: '/anuncios?categoriaId=2&subcategoria=Departamentos&tipo=alquiler' },
  { label: 'Refrigeradoras', to: '/anuncios?categoriaId=3&subcategoria=Refrigeradoras' }
];

export const COVERAGE = [
  { zona: 'Puno', label: 'Puno (Cercado, Bellavista, Salcedo)' },
  { zona: 'Juliaca', label: 'Juliaca (San Román, Taparachi, Salida Cusco)' },
  { zona: 'Otras localidades del sur del Perú', label: 'Ilave, Yunguyo, Ayaviri y Azángaro' }
];

export const PRICE_RANGES = [
  { value: '', label: 'Cualquier precio' },
  { value: '0-500', label: 'Hasta S/ 500' },
  { value: '500-5000', label: 'S/ 500 – 5,000' },
  { value: '5000-50000', label: 'S/ 5,000 – 50,000' },
  { value: '50000-', label: 'Más de S/ 50,000' }
];

export interface InfoTopic { title: string; kicker: string; intro: string; points: string[] }
export const INFO_TOPICS: Record<string, InfoTopic> = {
  seguridad: {
    kicker: 'SEGURIDAD Y CONFIANZA', title: 'Consejos de prevención de fraudes',
    intro: 'Compra y vende con tranquilidad siguiendo estas recomendaciones para Puno, Juliaca y el altiplano.',
    points: [
      'Coordina la entrega en lugares públicos y concurridos: Plaza de Armas de Puno, Terminal Terrestre de Juliaca o centros cívicos.',
      'Revisa el producto o visita el inmueble antes de entregar cualquier pago.',
      'Desconfía de precios demasiado bajos o de quien te pida adelantos por transferencia.',
      'Prefiere vendedores con la insignia «Celular verificado». Si un aviso te parece falso, usa «Reportar este aviso»: con tres reportes de personas verificadas se oculta hasta que administración lo revise.',
      'Para vehículos e inmuebles, verifica los documentos en SUNARP antes de cerrar el trato.',
      'Nunca compartas contraseñas ni códigos que lleguen a tu celular.'
    ]
  },
  terminos: {
    kicker: 'NORMAS DE LA COMUNIDAD', title: 'Términos de publicación',
    intro: 'Para mantener AvisoSur útil y confiable, todos los anuncios deben cumplir estas normas.',
    points: [
      'Publica solo productos, inmuebles o servicios reales que te pertenezcan o que estés autorizado a ofrecer.',
      'Usa fotos propias y una descripción clara y honesta del estado del producto.',
      'Indica el precio final en soles; no se permiten precios engañosos.',
      'Están prohibidos los artículos ilegales, robados, armas o medicamentos controlados.',
      'Los anuncios que no cumplan estas normas pueden ser dados de baja.'
    ]
  },
  privacidad: {
    kicker: 'TUS DATOS', title: 'Política de privacidad',
    intro: 'Así tratamos la información que compartes en AvisoSur.',
    points: [
      'Pedimos un nombre para mostrar, correo, celular y contraseña para crear tu cuenta.',
      'En tus avisos solo aparece tu nombre para mostrar; tu correo no se publica.',
      'El celular de tus avisos no aparece en el catálogo: se muestra solo a quien pulsa «Ver contacto del vendedor», con un límite de pedidos por persona.',
      'En Mi cuenta ves cuántas personas pidieron tu contacto. De quienes lo piden sin cuenta solo guardamos un código cifrado, no su dirección.',
      'Las contraseñas nunca se muestran a otros usuarios.',
      'Puedes dar de baja tus anuncios en cualquier momento desde Mi cuenta.'
    ]
  },
  soporte: {
    kicker: 'AYUDA', title: 'Ayuda para publicar',
    intro: '¿Tienes problemas para publicar o ingresar? Revisa estas soluciones rápidas.',
    points: [
      'Puedes subir fotos JPG, PNG, WebP o HEIC del celular; las fotos grandes se reducen automáticamente.',
      'Si una foto HEIC del iPhone no se abre, elige «Más compatible» en Ajustes > Cámara > Formatos o compártela como JPG.',
      'Si no puedes ingresar, revisa que tu correo o celular estén bien escritos.',
      'Tu aviso aparece en el catálogo cuando administración confirma el pago y lo aprueba. Revisa su estado en Mi cuenta.',
      'Si tu aviso fue observado, abre «Pago y revisión» en Mi cuenta para leer el motivo y corregirlo.'
    ]
  }
};
