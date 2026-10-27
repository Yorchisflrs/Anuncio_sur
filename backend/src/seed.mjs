import bcrypt from 'bcryptjs';

export const DEMO_USER = { correo: 'demo@avisosur.local', celular: '900000000', password: 'AvisoSur2026!' };
export const CATEGORIES = [
  { id: 1, nombre: 'Vehículos', subcategorias: ['Motos', 'Autos', 'Mototaxis'] },
  { id: 2, nombre: 'Inmuebles', subcategorias: ['Departamentos', 'Habitaciones', 'Casas', 'Terrenos', 'Locales comerciales'] },
  { id: 3, nombre: 'Electrodomésticos', subcategorias: ['Refrigeradoras', 'Lavadoras', 'Televisores', 'Cocinas', 'Otros'] },
];

// Personas, precios, productos y ubicaciones de ejemplo; sin datos de terceros.
export const DEMO_LISTINGS = [
  ['Moto Honda CB190R · lista para rodar', 5000, 'Puno', 1, 'Motos', 'moto-roja', 'Moto de uso particular, modelo 2021. Motor de 190 cc, mantenimiento al día y documentación de ejemplo. Incluye casco. Ideal para moverse por la ciudad.'],
  ['Departamento luminoso de 2 habitaciones', 950, 'Puno', 2, 'Departamentos', 'departamento', 'Alquiler mensual de un departamento de 65 m² con dos habitaciones, sala, cocina y baño. Cerca del centro de Puno. Servicios no incluidos. Visitas previa coordinación.'],
  ['Refrigeradora Samsung de 320 litros', 780, 'Juliaca', 3, 'Refrigeradoras', 'refrigeradora', 'Refrigeradora de dos puertas en buen estado. Capacidad de 320 litros, sistema no frost y compartimientos completos. Dos años de uso. Recoger previa coordinación.'],
  ['Toyota Yaris 2018 · mecánico', 32500, 'Juliaca', 1, 'Autos', 'auto-blanco', 'Sedán de uso familiar con transmisión mecánica. 82 000 km de ejemplo, aire acondicionado y mantenimiento al día. Se puede revisar con un mecánico de confianza.'],
  ['Lavadora LG automática de 10 kg', 650, 'Puno', 3, 'Lavadoras', 'lavadora', 'Lavadora automática con carga frontal y capacidad de 10 kg. Funciona correctamente en todos sus programas. Incluye mangueras y manual de referencia.'],
  ['Cocina Mabe de 4 hornillas', 350, 'Juliaca', 3, 'Cocinas', 'cocina', 'Cocina a gas de cuatro hornillas con horno. Acabado de acero, encendido manual y parrillas completas. Lista para un nuevo hogar.'],
  ['Yamaha FZ 150 · azul', 6500, 'Juliaca', 1, 'Motos', 'moto-azul', 'Moto Yamaha de 150 cc, modelo 2022. Uso urbano y mantenimiento periódico. Buen estado general, con documentación de ejemplo.'],
  ['Habitación cerca de la UNA Puno', 280, 'Puno', 2, 'Habitaciones', 'habitacion', 'Habitación individual en alquiler mensual cerca de la universidad. Cuenta con ventana, espacio para escritorio y baño compartido. Ideal para estudiantes.'],
  ['Mototaxi Bajaj en buen estado', 4800, 'Juliaca', 1, 'Mototaxis', 'mototaxi', 'Mototaxi de uso particular con techo y asientos conservados. Motor revisado y lista para inspección. Precio conversable después de verla.'],
  ['Smart TV Samsung de 50 pulgadas', 890, 'Puno', 3, 'Televisores', 'televisor', 'Televisor inteligente de 50 pulgadas con resolución 4K. Incluye control remoto y soporte. Funciona correctamente, sin golpes en la pantalla.'],
  ['Casa familiar de 3 habitaciones', 168000, 'Puno', 2, 'Casas', 'casa', 'Casa de ejemplo con tres habitaciones, sala comedor, cocina y patio. Área referencial de 120 m². La información y documentación se revisan durante la visita.'],
  ['Chevrolet Spark 2015 · compacto', 21500, 'Puno', 1, 'Autos', 'auto-turquesa', 'Auto compacto de transmisión mecánica, ideal para ciudad. Cuatro puertas, interior conservado y mantenimiento reciente. Kilometraje referencial de 95 000 km.'],
  ['Microondas Panasonic de 25 litros', 180, 'Juliaca', 3, 'Otros', 'microondas', 'Microondas digital con capacidad de 25 litros. Plato giratorio completo y varios niveles de potencia. En buen estado y listo para usar.'],
  ['Local comercial cerca del mercado', 600, 'Juliaca', 2, 'Locales comerciales', 'local', 'Alquiler mensual de un local de 30 m² en una zona comercial de ejemplo. Acceso independiente, puerta amplia y baño. Visitas previa coordinación.'],
  ['Licuadora Oster con vaso de vidrio', 120, 'Puno', 3, 'Otros', 'licuadora', 'Licuadora de tres velocidades con vaso de vidrio de 1,5 litros. Cuchillas en buen estado y base conservada. Probada antes de su publicación.'],
  ['Terreno urbano de 95 m²', 24500, 'Otras localidades del sur del Perú', 2, 'Terrenos', 'terreno', 'Terreno de ejemplo de 95 m² con acceso por vía local. Zona residencial referencial del sur del Perú. Coordinar visita y revisión de documentación.'],
];

export async function seedDatabase(db) {
  for (const category of CATEGORIES) {
    db.prepare('INSERT OR IGNORE INTO categorias (id, nombre, subcategorias) VALUES (?, ?, ?)').run(category.id, category.nombre, JSON.stringify(category.subcategorias));
  }
  if (db.prepare("SELECT valor FROM metadata WHERE clave = 'seed_v1'").get()) return;
  const hash = await bcrypt.hash(DEMO_USER.password, 12);
  db.exec('BEGIN');
  try {
    const user = db.prepare('INSERT INTO usuarios (correo, celular, password_hash, es_demo, fecha_registro) VALUES (?, ?, ?, 1, ?)').run(DEMO_USER.correo, DEMO_USER.celular, hash, new Date().toISOString());
    const listing = db.prepare('INSERT INTO anuncios (usuario_id, titulo, descripcion, precio_centimos, zona, categoria_id, subcategoria, es_demo, fecha_publicacion) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)');
    const photo = db.prepare('INSERT INTO fotos (anuncio_id, archivo, orden, fecha_subida) VALUES (?, ?, 0, ?)');
    DEMO_LISTINGS.forEach(([titulo, precio, zona, categoria, subcategoria, asset, descripcion], index) => {
      const date = new Date(Date.now() - index * 3600000 * 7).toISOString();
      const result = listing.run(user.lastInsertRowid, titulo, descripcion, precio * 100, zona, categoria, subcategoria, date);
      photo.run(result.lastInsertRowid, '/demo/' + asset + '.svg', date);
    });
    db.prepare("INSERT INTO metadata (clave, valor) VALUES ('seed_v1', '1')").run();
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
