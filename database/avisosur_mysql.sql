-- AvisoSur: ejecutar en la pestaña SQL de phpMyAdmin a nivel de servidor.
-- Reejecutable: crea solamente los objetos que aún no existan.
CREATE DATABASE IF NOT EXISTS avisosur_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE avisosur_db;

CREATE TABLE IF NOT EXISTS usuarios (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(60) NOT NULL DEFAULT '',
  correo VARCHAR(254) NOT NULL,
  celular CHAR(9) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  es_demo TINYINT(1) NOT NULL DEFAULT 0,
  rol VARCHAR(20) NOT NULL DEFAULT 'usuario',
  celular_verificado TINYINT(1) NOT NULL DEFAULT 0,
  fecha_verificacion DATETIME(3) NULL,
  metodo_verificacion VARCHAR(20) NOT NULL DEFAULT '',
  fecha_registro DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_usuarios_correo (correo),
  UNIQUE KEY uq_usuarios_celular (celular),
  CONSTRAINT ck_usuarios_celular CHECK (celular REGEXP '^9[0-9]{8}$'),
  CONSTRAINT ck_usuarios_demo CHECK (es_demo IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS verificaciones_celular (
  usuario_id BIGINT UNSIGNED NOT NULL,
  solicitado DATETIME(3) NOT NULL,
  codigo_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  expira DATETIME(3) NULL,
  intentos INT UNSIGNED NOT NULL DEFAULT 0,
  enviado DATETIME(3) NULL,
  PRIMARY KEY (usuario_id),
  CONSTRAINT fk_verificaciones_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
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

CREATE TABLE IF NOT EXISTS planes_publicacion (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL, precio_centimos INT UNSIGNED NULL,
  dias INT UNSIGNED NOT NULL, bono_primer_anuncio INT UNSIGNED NOT NULL DEFAULT 0,
  destacado TINYINT(1) NOT NULL DEFAULT 0, activo TINYINT(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT IGNORE INTO planes_publicacion (id,nombre,precio_centimos,dias,bono_primer_anuncio,destacado,activo) VALUES
  (1,'Semanal',500,7,0,0,1),(2,'Diario',NULL,1,0,0,0),(3,'Mensual',NULL,30,0,0,0);

CREATE TABLE IF NOT EXISTS anuncios (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id BIGINT UNSIGNED NOT NULL,
  categoria_id INT UNSIGNED NOT NULL,
  titulo VARCHAR(100) NOT NULL,
  descripcion TEXT NOT NULL,
  precio DECIMAL(10,2) NOT NULL,
  zona VARCHAR(100) NOT NULL,
  subcategoria VARCHAR(100) NOT NULL DEFAULT '',
  tipo_operacion VARCHAR(10) NOT NULL DEFAULT 'venta',
  estado VARCHAR(20) NOT NULL DEFAULT 'activo',
  es_demo TINYINT(1) NOT NULL DEFAULT 0,
  fecha_publicacion DATETIME(3) NOT NULL,
  moderacion VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  estado_pago VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  plan_id INT UNSIGNED NOT NULL DEFAULT 1,
  dias_vigencia INT UNSIGNED NOT NULL DEFAULT 7,
  dias_promocion INT UNSIGNED NOT NULL DEFAULT 0,
  bono_primer_snapshot INT UNSIGNED NOT NULL DEFAULT 0,
  monto_publicacion_centimos INT UNSIGNED NOT NULL DEFAULT 500,
  destacado TINYINT(1) NOT NULL DEFAULT 0,
  fecha_aprobacion DATETIME(3) NULL, fecha_vencimiento DATETIME(3) NULL,
  motivo_revision VARCHAR(1000) NOT NULL DEFAULT '',
  direccion VARCHAR(200) NOT NULL DEFAULT '', referencia VARCHAR(300) NOT NULL DEFAULT '',
  contacto VARCHAR(100) NOT NULL DEFAULT '', comprobante_archivo VARCHAR(100) NULL,
  referencia_pago VARCHAR(160) NOT NULL DEFAULT '',fecha_comprobante DATETIME(3) NULL,fecha_confirmacion DATETIME(3) NULL,
  revision_reportes TINYINT(1) NOT NULL DEFAULT 0, fecha_revision_reportes DATETIME(3) NULL,
  PRIMARY KEY (id),
  KEY idx_anuncios_catalogo (estado, categoria_id, precio),
  KEY idx_anuncios_zona_fecha (estado, zona, fecha_publicacion),
  KEY idx_anuncios_usuario_fecha (usuario_id, fecha_publicacion),
  KEY idx_moderacion_vigencia (moderacion,estado_pago,fecha_vencimiento),
  CONSTRAINT fk_anuncios_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
  CONSTRAINT fk_anuncios_categoria FOREIGN KEY (categoria_id) REFERENCES categorias (id),
  CONSTRAINT ck_anuncios_precio CHECK (precio > 0),
  CONSTRAINT ck_anuncios_estado CHECK (estado IN ('activo', 'dado_de_baja')),
  CONSTRAINT ck_anuncios_tipo CHECK (tipo_operacion IN ('venta', 'alquiler')),
  CONSTRAINT ck_anuncios_demo CHECK (es_demo IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS fotos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  anuncio_id BIGINT UNSIGNED NOT NULL,
  archivo VARCHAR(2048) NOT NULL,
  orden TINYINT UNSIGNED NOT NULL,
  fecha_subida DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_fotos_anuncio_orden (anuncio_id, orden),
  CONSTRAINT fk_fotos_anuncio FOREIGN KEY (anuncio_id) REFERENCES anuncios (id),
  CONSTRAINT ck_fotos_orden CHECK (orden BETWEEN 0 AND 6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reportes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  anuncio_id BIGINT UNSIGNED NOT NULL,
  usuario_id BIGINT UNSIGNED NOT NULL,
  motivo TEXT NOT NULL,
  detalle VARCHAR(500) NOT NULL DEFAULT '',
  fecha DATETIME(3) NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  fecha_revision DATETIME(3) NULL,
  revisado_por BIGINT UNSIGNED NULL,
  resolucion VARCHAR(20) NOT NULL DEFAULT '',
  PRIMARY KEY (id),
  UNIQUE KEY uq_reportes_anuncio_usuario (anuncio_id, usuario_id),
  KEY idx_reportes_anuncio (anuncio_id),
  KEY idx_reportes_usuario (usuario_id),
  KEY idx_reportes_estado (estado, anuncio_id),
  CONSTRAINT fk_reportes_anuncio FOREIGN KEY (anuncio_id) REFERENCES anuncios (id),
  CONSTRAINT fk_reportes_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
  CONSTRAINT ck_reportes_estado CHECK (estado IN ('pendiente', 'revisado'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS contactos_anuncio (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  anuncio_id BIGINT UNSIGNED NOT NULL,
  visitante CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  fecha DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_contactos_anuncio_visitante (anuncio_id, visitante),
  CONSTRAINT fk_contactos_anuncio FOREIGN KEY (anuncio_id) REFERENCES anuncios (id)
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
