-- AvisoSur: ejecutar en la pestaña SQL de phpMyAdmin a nivel de servidor.
-- Reejecutable: crea solamente los objetos que aún no existan.
CREATE DATABASE IF NOT EXISTS avisosur_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE avisosur_db;

CREATE TABLE IF NOT EXISTS usuarios (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  correo VARCHAR(254) NOT NULL,
  celular CHAR(9) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  es_demo TINYINT(1) NOT NULL DEFAULT 0,
  fecha_registro DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_usuarios_correo (correo),
  UNIQUE KEY uq_usuarios_celular (celular),
  CONSTRAINT ck_usuarios_celular CHECK (celular REGEXP '^9[0-9]{8}$'),
  CONSTRAINT ck_usuarios_demo CHECK (es_demo IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS categorias (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(100) NOT NULL,
  subcategorias JSON NOT NULL,
  activa TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categorias_nombre (nombre),
  CONSTRAINT ck_categorias_activa CHECK (activa IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS anuncios (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
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
  PRIMARY KEY (id),
  KEY idx_anuncios_catalogo (estado, categoria_id, precio),
  KEY idx_anuncios_zona_fecha (estado, zona, fecha_publicacion),
  KEY idx_anuncios_usuario_fecha (usuario_id, fecha_publicacion),
  CONSTRAINT fk_anuncios_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
  CONSTRAINT fk_anuncios_categoria FOREIGN KEY (categoria_id) REFERENCES categorias (id),
  CONSTRAINT ck_anuncios_precio CHECK (precio > 0),
  CONSTRAINT ck_anuncios_estado CHECK (estado IN ('activo', 'dado_de_baja')),
  CONSTRAINT ck_anuncios_demo CHECK (es_demo IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS fotos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  anuncio_id BIGINT UNSIGNED NOT NULL,
  archivo VARCHAR(500) NOT NULL,
  orden TINYINT UNSIGNED NOT NULL,
  fecha_subida DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_fotos_anuncio_orden (anuncio_id, orden),
  CONSTRAINT fk_fotos_anuncio FOREIGN KEY (anuncio_id) REFERENCES anuncios (id),
  CONSTRAINT ck_fotos_orden CHECK (orden BETWEEN 0 AND 2)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reportes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  anuncio_id BIGINT UNSIGNED NOT NULL,
  usuario_id BIGINT UNSIGNED NOT NULL,
  motivo TEXT NOT NULL,
  fecha DATETIME(3) NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  PRIMARY KEY (id),
  KEY idx_reportes_anuncio (anuncio_id),
  KEY idx_reportes_usuario (usuario_id),
  CONSTRAINT fk_reportes_anuncio FOREIGN KEY (anuncio_id) REFERENCES anuncios (id),
  CONSTRAINT fk_reportes_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
  CONSTRAINT ck_reportes_estado CHECK (estado IN ('pendiente', 'revisado'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sesiones (
  token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  usuario_id BIGINT UNSIGNED NOT NULL,
  expira DATETIME(3) NOT NULL,
  PRIMARY KEY (token_hash),
  KEY idx_sesiones_usuario (usuario_id),
  KEY idx_sesiones_expira (expira),
  CONSTRAINT fk_sesiones_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS metadata (
  clave VARCHAR(100) NOT NULL,
  valor TEXT NOT NULL,
  PRIMARY KEY (clave)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
