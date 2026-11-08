-- AvisoSur: actualización conservadora de un esquema existente.
-- No elimina anuncios, usuarios, fotos, reportes ni sesiones.
-- No aprueba anuncios ni confirma pagos. Los registros previos quedan pendientes.
-- Ejecutar con una copia de seguridad y sobre avisosur_db.
-- La misma actualización se aplica automáticamente al iniciar el backend.
USE avisosur_db;
ALTER TABLE fotos MODIFY COLUMN archivo VARCHAR(2048) NOT NULL;
CREATE TABLE IF NOT EXISTS planes_publicacion (
 id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,nombre VARCHAR(80) NOT NULL,
 precio_centimos INT UNSIGNED NULL,dias INT UNSIGNED NOT NULL,
 bono_primer_anuncio INT UNSIGNED NOT NULL DEFAULT 0,
 destacado TINYINT(1) NOT NULL DEFAULT 0,activo TINYINT(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT IGNORE INTO planes_publicacion (id,nombre,precio_centimos,dias,bono_primer_anuncio,destacado,activo)
VALUES (1,'Semanal',500,7,0,0,1),(2,'Diario',NULL,1,0,0,0),(3,'Mensual',NULL,30,0,0,0);
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
CALL avisosur_agregar_columna('usuarios','rol','VARCHAR(20) NOT NULL DEFAULT ''usuario''');
CALL avisosur_agregar_columna('anuncios','moderacion','VARCHAR(20) NOT NULL DEFAULT ''pendiente''');
CALL avisosur_agregar_columna('anuncios','estado_pago','VARCHAR(20) NOT NULL DEFAULT ''pendiente''');
CALL avisosur_agregar_columna('anuncios','plan_id','INT UNSIGNED NOT NULL DEFAULT 1');
CALL avisosur_agregar_columna('anuncios','dias_vigencia','INT UNSIGNED NOT NULL DEFAULT 7');
CALL avisosur_agregar_columna('anuncios','dias_promocion','INT UNSIGNED NOT NULL DEFAULT 0');
CALL avisosur_agregar_columna('anuncios','bono_primer_snapshot','INT UNSIGNED NOT NULL DEFAULT 0');
CALL avisosur_agregar_columna('anuncios','monto_publicacion_centimos','INT UNSIGNED NOT NULL DEFAULT 500');
CALL avisosur_agregar_columna('anuncios','destacado','TINYINT(1) NOT NULL DEFAULT 0');
CALL avisosur_agregar_columna('anuncios','fecha_aprobacion','DATETIME(3) NULL');
CALL avisosur_agregar_columna('anuncios','fecha_vencimiento','DATETIME(3) NULL');
CALL avisosur_agregar_columna('anuncios','motivo_revision','VARCHAR(1000) NOT NULL DEFAULT ''''');
CALL avisosur_agregar_columna('anuncios','direccion','VARCHAR(200) NOT NULL DEFAULT ''''');
CALL avisosur_agregar_columna('anuncios','referencia','VARCHAR(300) NOT NULL DEFAULT ''''');
CALL avisosur_agregar_columna('anuncios','contacto','VARCHAR(100) NOT NULL DEFAULT ''''');
CALL avisosur_agregar_columna('anuncios','comprobante_archivo','VARCHAR(100) NULL');
CALL avisosur_agregar_columna('anuncios','referencia_pago','VARCHAR(160) NOT NULL DEFAULT ''''');
CALL avisosur_agregar_columna('anuncios','fecha_comprobante','DATETIME(3) NULL');
CALL avisosur_agregar_columna('anuncios','fecha_confirmacion','DATETIME(3) NULL');
DROP PROCEDURE avisosur_agregar_columna;
DELIMITER $$
DROP PROCEDURE IF EXISTS avisosur_siete_fotos$$
CREATE PROCEDURE avisosur_siete_fotos()
BEGIN
 IF EXISTS(SELECT 1 FROM information_schema.CHECK_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND CONSTRAINT_NAME='ck_fotos_orden' AND LOWER(CHECK_CLAUSE) NOT REGEXP 'between[[:space:]]+0[[:space:]]+and[[:space:]]+6|<[[:space:]]*7') THEN
  SET @avisosur_ddl=IF(VERSION() LIKE '%MariaDB%','ALTER TABLE fotos DROP CONSTRAINT ck_fotos_orden','ALTER TABLE fotos DROP CHECK ck_fotos_orden');
  PREPARE avisosur_statement FROM @avisosur_ddl; EXECUTE avisosur_statement; DEALLOCATE PREPARE avisosur_statement;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM information_schema.CHECK_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND CONSTRAINT_NAME='ck_fotos_orden') THEN
  ALTER TABLE fotos ADD CONSTRAINT ck_fotos_orden CHECK(orden BETWEEN 0 AND 6);
 END IF;
 IF NOT EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='anuncios' AND INDEX_NAME='idx_moderacion_vigencia') THEN
  CREATE INDEX idx_moderacion_vigencia ON anuncios(moderacion,estado_pago,fecha_vencimiento);
 END IF;
END$$
DELIMITER ;
CALL avisosur_siete_fotos();
DROP PROCEDURE avisosur_siete_fotos;
INSERT IGNORE INTO metadata(clave,valor) VALUES('moderacion_v1','1');
