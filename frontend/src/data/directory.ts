import { CarFront, Building2, Refrigerator, Laptop, Shirt, BriefcaseBusiness, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Íconos de las categorías activas en el backend (por id).
export const CATEGORY_ICONS: Record<number, LucideIcon> = { 1: CarFront, 2: Building2, 3: Refrigerator };

// Categorías del prototipo que aún no existen en el backend.
export const UPCOMING_CATEGORIES: { nombre: string; icon: LucideIcon; detalle: string }[] = [
  { nombre: 'Tecnología', icon: Laptop, detalle: 'Laptops, celulares y equipos' },
  { nombre: 'Ropa y textil', icon: Shirt, detalle: 'Artesanías y fibra de alpaca' },
  { nombre: 'Empleo & Serv.', icon: BriefcaseBusiness, detalle: 'Bolsa de trabajo y servicios' },
  { nombre: 'Herramientas', icon: Wrench, detalle: 'Maquinaria y equipos de obra' }
];

export const QUICK_SEARCHES = [
  { label: 'Motos en Juliaca', to: '/anuncios?categoriaId=1&subcategoria=Motos&zona=Juliaca' },
  { label: 'Departamentos en Puno', to: '/anuncios?categoriaId=2&subcategoria=Departamentos&zona=Puno' },
  { label: 'Terrenos', to: '/anuncios?categoriaId=2&subcategoria=Terrenos' },
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
    intro: 'Así tratamos la información que compartes en este prototipo académico.',
    points: [
      'Solo pedimos correo, celular y contraseña para crear tu cuenta.',
      'Tu celular se muestra a los compradores únicamente para el contacto por WhatsApp de tus anuncios.',
      'Las contraseñas nunca se muestran a otros usuarios.',
      'Puedes dar de baja tus anuncios en cualquier momento desde Mi cuenta.'
    ]
  },
  reclamaciones: {
    kicker: 'ATENCIÓN AL USUARIO', title: 'Libro de reclamaciones virtual',
    intro: 'En la versión final aquí podrás registrar un reclamo o queja. En este prototipo la función es solo demostrativa.',
    points: [
      'Identifica el anuncio o la situación que motiva tu reclamo.',
      'Describe los hechos con fecha, zona y datos de contacto.',
      'Recibirás una respuesta en un plazo máximo de 15 días hábiles.'
    ]
  },
  soporte: {
    kicker: 'AYUDA', title: 'Soporte técnico',
    intro: '¿Tienes problemas para publicar o ingresar? Revisa estas soluciones rápidas.',
    points: [
      'Las fotos deben estar en formato JPG o PNG.',
      'Si no puedes ingresar, revisa que tu correo o celular estén bien escritos.',
      'Si la página no carga anuncios, comprueba que el servidor de AvisoSur esté iniciado.',
      'Para cualquier otra consulta, escribe al equipo del proyecto en la UNA Puno.'
    ]
  }
};
