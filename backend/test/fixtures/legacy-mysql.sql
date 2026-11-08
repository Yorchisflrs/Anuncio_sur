-- Esquema legado exclusivamente para pruebas en una base temporal nueva.
-- No contiene CREATE DATABASE, USE, DROP DATABASE ni datos de producción.
CREATE TABLE usuarios (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  correo VARCHAR(254) NOT NULL UNIQUE,
  celular CHAR(9) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  es_demo TINYINT(1) NOT NULL DEFAULT 0,
  fecha_registro DATETIME(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE categorias (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL UNIQUE,
  subcategorias JSON NOT NULL,
  activa TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE anuncios (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  usuario_id BIGINT UNSIGNED NOT NULL,
  categoria_id INT UNSIGNED NOT NULL,
  titulo VARCHAR(100) NOT NULL,
  descripcion TEXT NOT NULL,
  precio DECIMAL(10,2) NOT NULL,
  zona VARCHAR(100) NOT NULL,
  subcategoria VARCHAR(100) NOT NULL DEFAULT '',
  estado VARCHAR(20) NOT NULL DEFAULT 'activo',
  es_demo TINYINT(1) NOT NULL DEFAULT 0,
  fecha_publicacion DATETIME(3) NOT NULL,
  KEY idx_anuncios_catalogo (estado, categoria_id, precio),
  KEY idx_anuncios_zona_fecha (estado, zona, fecha_publicacion),
  KEY idx_anuncios_usuario_fecha (usuario_id, fecha_publicacion),
  CONSTRAINT fk_anuncios_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  CONSTRAINT fk_anuncios_categoria FOREIGN KEY (categoria_id) REFERENCES categorias(id),
  CONSTRAINT ck_anuncios_precio CHECK(precio > 0),
  CONSTRAINT ck_anuncios_estado CHECK(estado IN ('activo', 'dado_de_baja'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE fotos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  anuncio_id BIGINT UNSIGNED NOT NULL,
  archivo VARCHAR(500) NOT NULL,
  orden TINYINT UNSIGNED NOT NULL,
  fecha_subida DATETIME(3) NOT NULL,
  UNIQUE KEY uq_fotos_anuncio_orden (anuncio_id, orden),
  CONSTRAINT fk_fotos_anuncio FOREIGN KEY (anuncio_id) REFERENCES anuncios(id),
  CONSTRAINT ck_fotos_orden CHECK(orden BETWEEN 0 AND 2)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE reportes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  anuncio_id BIGINT UNSIGNED NOT NULL,
  usuario_id BIGINT UNSIGNED NOT NULL,
  motivo TEXT NOT NULL,
  fecha DATETIME(3) NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  CONSTRAINT fk_reportes_anuncio FOREIGN KEY (anuncio_id) REFERENCES anuncios(id),
  CONSTRAINT fk_reportes_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE sesiones (
  token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  usuario_id BIGINT UNSIGNED NOT NULL,
  expira DATETIME(3) NOT NULL,
  CONSTRAINT fk_sesiones_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE metadata (clave VARCHAR(100) NOT NULL PRIMARY KEY, valor TEXT NOT NULL)
  ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
