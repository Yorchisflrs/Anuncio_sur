-- AvisoSur: actualización conservadora para las observaciones de la Práctica 9.
-- Solo agrega columnas, tablas e índices; no borra ni modifica anuncios o usuarios.
-- Ejecutar con una copia de seguridad y sobre avisosur_db, después de actualizar_moderacion_mysql.sql.
-- La misma actualización se aplica automáticamente al iniciar el backend.
USE avisosur_db;
DELIMITER $$
DROP PROCEDURE IF EXISTS avisosur_agregar_columna$$
CREATE PROCEDURE avisosur_agregar_columna(IN tabla_nombre VARCHAR(64),IN columna_nombre VARCHAR(64),IN definicion TEXT)
BEGIN
 IF NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=tabla_nombre AND COLUMN_NAME=columna_nombre) THEN
  SET @avisosur_ddl=CONCAT('ALTER TABLE `',tabla_nombre,'` ADD COLUMN `',columna_nombre,'` ',definicion);
  PREPARE avisosur_statement FROM @avisosur_ddl;
  EXECUTE avisosur_statement;
  DEALLOCATE PREPARE avisosur_statement;
 END IF;
END$$
DELIMITER ;
-- Nombre público del vendedor (ya no se deriva del correo).
CALL avisosur_agregar_columna('usuarios','nombre','VARCHAR(60) NOT NULL DEFAULT ''''');
-- Celular verificado: las cuentas existentes empiezan sin verificar.
CALL avisosur_agregar_columna('usuarios','celular_verificado','TINYINT(1) NOT NULL DEFAULT 0');
CALL avisosur_agregar_columna('usuarios','fecha_verificacion','DATETIME(3) NULL');
CALL avisosur_agregar_columna('usuarios','metodo_verificacion','VARCHAR(20) NOT NULL DEFAULT ''''');
-- Reportes de estafa: detalle opcional, revisión del moderador y aviso oculto por reportes.
CALL avisosur_agregar_columna('reportes','detalle','VARCHAR(500) NOT NULL DEFAULT ''''');
CALL avisosur_agregar_columna('reportes','fecha_revision','DATETIME(3) NULL');
CALL avisosur_agregar_columna('reportes','revisado_por','BIGINT UNSIGNED NULL');
CALL avisosur_agregar_columna('reportes','resolucion','VARCHAR(20) NOT NULL DEFAULT ''''');
CALL avisosur_agregar_columna('anuncios','revision_reportes','TINYINT(1) NOT NULL DEFAULT 0');
CALL avisosur_agregar_columna('anuncios','fecha_revision_reportes','DATETIME(3) NULL');
-- Venta o alquiler: los avisos existentes quedan como venta.
CALL avisosur_agregar_columna('anuncios','tipo_operacion','VARCHAR(10) NOT NULL DEFAULT ''venta''');
DROP PROCEDURE avisosur_agregar_columna;
-- Solo los avisos DEMO del seed que son alquileres mensuales según su descripción.
UPDATE anuncios SET tipo_operacion='alquiler' WHERE es_demo=1 AND tipo_operacion='venta'
  AND titulo IN ('Departamento luminoso de 2 habitaciones','Habitación cerca de la UNA Puno','Local comercial cerca del mercado')
  AND NOT EXISTS(SELECT 1 FROM metadata WHERE clave='tipo_operacion_demo_v1');
INSERT IGNORE INTO metadata(clave,valor) VALUES('tipo_operacion_demo_v1','1');
-- Pedidos de contacto: una fila por persona y aviso (la persona se guarda como hash).
CREATE TABLE IF NOT EXISTS contactos_anuncio (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, anuncio_id BIGINT UNSIGNED NOT NULL,
 visitante CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, fecha DATETIME(3) NOT NULL,
 UNIQUE KEY uq_contactos_anuncio_visitante (anuncio_id, visitante),
 CONSTRAINT fk_contactos_anuncio FOREIGN KEY (anuncio_id) REFERENCES anuncios (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- Códigos de verificación pendientes: solo se guarda el hash del código.
CREATE TABLE IF NOT EXISTS verificaciones_celular (
 usuario_id BIGINT UNSIGNED NOT NULL PRIMARY KEY, solicitado DATETIME(3) NOT NULL,
 codigo_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL, expira DATETIME(3) NULL,
 intentos INT UNSIGNED NOT NULL DEFAULT 0, enviado DATETIME(3) NULL,
 CONSTRAINT fk_verificaciones_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- Un reporte por persona y aviso (solo si la tabla no tiene duplicados) e índice para la página del moderador.
DELIMITER $$
DROP PROCEDURE IF EXISTS avisosur_indices_reportes$$
CREATE PROCEDURE avisosur_indices_reportes()
BEGIN
 IF NOT EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='reportes' AND INDEX_NAME='uq_reportes_anuncio_usuario')
    AND NOT EXISTS(SELECT 1 FROM reportes GROUP BY anuncio_id, usuario_id HAVING COUNT(*) > 1) THEN
  ALTER TABLE reportes ADD UNIQUE KEY uq_reportes_anuncio_usuario (anuncio_id, usuario_id);
 END IF;
 IF NOT EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='reportes' AND INDEX_NAME='idx_reportes_estado') THEN
  CREATE INDEX idx_reportes_estado ON reportes(estado, anuncio_id);
 END IF;
END$$
DELIMITER ;
CALL avisosur_indices_reportes();
DROP PROCEDURE avisosur_indices_reportes;
