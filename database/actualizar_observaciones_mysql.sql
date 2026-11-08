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
DROP PROCEDURE avisosur_agregar_columna;
