// Additive, repeatable upgrades. Legacy advertisements are deliberately left pending.
const sqliteColumns = {
  moderacion: "TEXT NOT NULL DEFAULT 'pendiente' CHECK(moderacion IN ('pendiente','aprobado','rechazado'))",
  estado_pago: "TEXT NOT NULL DEFAULT 'pendiente' CHECK(estado_pago IN ('pendiente','en_revision','confirmado','rechazado'))",
  plan_id: 'INTEGER REFERENCES planes_publicacion(id)', dias_vigencia: 'INTEGER NOT NULL DEFAULT 7', dias_promocion: 'INTEGER NOT NULL DEFAULT 0',
  monto_publicacion_centimos: 'INTEGER NOT NULL DEFAULT 500', destacado: 'INTEGER NOT NULL DEFAULT 0',
  bono_primer_snapshot: 'INTEGER NOT NULL DEFAULT 0',
  fecha_aprobacion: 'TEXT', fecha_vencimiento: 'TEXT', motivo_revision: "TEXT NOT NULL DEFAULT ''",
  direccion: "TEXT NOT NULL DEFAULT ''", referencia: "TEXT NOT NULL DEFAULT ''", contacto: "TEXT NOT NULL DEFAULT ''",
  comprobante_archivo: 'TEXT', referencia_pago: "TEXT NOT NULL DEFAULT ''", fecha_comprobante: 'TEXT', fecha_confirmacion: 'TEXT',
};
export function migrateSqlite(db) {
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS planes_publicacion (
      id INTEGER PRIMARY KEY, nombre TEXT NOT NULL, precio_centimos INTEGER,
      dias INTEGER NOT NULL CHECK(dias > 0), bono_primer_anuncio INTEGER NOT NULL DEFAULT 0,
      destacado INTEGER NOT NULL DEFAULT 0, activo INTEGER NOT NULL DEFAULT 0
    )`);
    db.exec(`INSERT OR IGNORE INTO planes_publicacion (id,nombre,precio_centimos,dias,bono_primer_anuncio,destacado,activo) VALUES
      (1,'Semanal',500,7,0,0,1),(2,'Diario',NULL,1,0,0,0),(3,'Mensual',NULL,30,0,0,0)`);
    const users = new Set(db.prepare('PRAGMA table_info(usuarios)').all().map(row => row.name));
    if (!users.has('rol')) db.exec("ALTER TABLE usuarios ADD COLUMN rol TEXT NOT NULL DEFAULT 'usuario' CHECK(rol IN ('usuario','admin'))");
    const columns = new Set(db.prepare('PRAGMA table_info(anuncios)').all().map(row => row.name));
    for (const [name, type] of Object.entries(sqliteColumns)) if (!columns.has(name)) db.exec(`ALTER TABLE anuncios ADD COLUMN ${name} ${type}`);
    db.exec('UPDATE anuncios SET plan_id=1 WHERE plan_id IS NULL');
    const photoSchema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='fotos'").get()?.sql || '';
    if (/orden\s*<\s*3|orden\s+BETWEEN\s+0\s+AND\s+2/i.test(photoSchema)) {
      db.exec(`CREATE TABLE fotos_migracion7 (
        id INTEGER PRIMARY KEY, anuncio_id INTEGER NOT NULL REFERENCES anuncios(id),
        archivo TEXT NOT NULL, orden INTEGER NOT NULL CHECK(orden >= 0 AND orden < 7),
        fecha_subida TEXT NOT NULL, UNIQUE(anuncio_id, orden)
      );
      INSERT INTO fotos_migracion7 (id,anuncio_id,archivo,orden,fecha_subida) SELECT id,anuncio_id,archivo,orden,fecha_subida FROM fotos;
      DROP TABLE fotos; ALTER TABLE fotos_migracion7 RENAME TO fotos;`);
    }
    db.exec(`INSERT OR IGNORE INTO planes_publicacion (id,nombre,precio_centimos,dias,bono_primer_anuncio,destacado,activo) VALUES
      (1,'Semanal',500,7,0,0,1),(2,'Diario',NULL,1,0,0,0),(3,'Mensual',NULL,30,0,0,0);
      CREATE INDEX IF NOT EXISTS idx_moderacion_vigencia ON anuncios(moderacion,estado_pago,fecha_vencimiento);
      INSERT OR IGNORE INTO metadata (clave,valor) VALUES ('moderacion_v1','1');`);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

export async function migrateMysql(pool) {
  // MySQL DDL commits automatically. Each step checks schema metadata so an interrupted
  // upgrade can be safely resumed without changing pre-existing values or IDs.
  await pool.query(`CREATE TABLE IF NOT EXISTS planes_publicacion (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,nombre VARCHAR(80) NOT NULL,
    precio_centimos INT UNSIGNED NULL,dias INT UNSIGNED NOT NULL,bono_primer_anuncio INT UNSIGNED NOT NULL DEFAULT 0,
    destacado TINYINT(1) NOT NULL DEFAULT 0,activo TINYINT(1) NOT NULL DEFAULT 0
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  const [userColumns] = await pool.query('SHOW COLUMNS FROM usuarios');
  if (!userColumns.some(row => row.Field === 'rol')) await pool.query("ALTER TABLE usuarios ADD COLUMN rol VARCHAR(20) NOT NULL DEFAULT 'usuario'");
  const [adColumns] = await pool.query('SHOW COLUMNS FROM anuncios');
  const names = new Set(adColumns.map(row => row.Field));
  const mysqlColumns = {
    moderacion: "VARCHAR(20) NOT NULL DEFAULT 'pendiente'", estado_pago: "VARCHAR(20) NOT NULL DEFAULT 'pendiente'",
    plan_id: 'INT UNSIGNED NOT NULL DEFAULT 1', dias_vigencia: 'INT UNSIGNED NOT NULL DEFAULT 7',dias_promocion:'INT UNSIGNED NOT NULL DEFAULT 0',
    monto_publicacion_centimos:'INT UNSIGNED NOT NULL DEFAULT 500',destacado:'TINYINT(1) NOT NULL DEFAULT 0',
    bono_primer_snapshot:'INT UNSIGNED NOT NULL DEFAULT 0',
    fecha_aprobacion:'DATETIME(3) NULL',fecha_vencimiento:'DATETIME(3) NULL',motivo_revision:"VARCHAR(1000) NOT NULL DEFAULT ''",
    direccion:"VARCHAR(200) NOT NULL DEFAULT ''",referencia:"VARCHAR(300) NOT NULL DEFAULT ''",contacto:"VARCHAR(100) NOT NULL DEFAULT ''",
    comprobante_archivo:'VARCHAR(100) NULL',referencia_pago:"VARCHAR(160) NOT NULL DEFAULT ''",fecha_comprobante:'DATETIME(3) NULL',fecha_confirmacion:'DATETIME(3) NULL',
  };
  for (const [name,type] of Object.entries(mysqlColumns)) if (!names.has(name)) await pool.query(`ALTER TABLE anuncios ADD COLUMN ${name} ${type}`);
  const [photoColumns] = await pool.query('SHOW COLUMNS FROM fotos');
  const photoPath = photoColumns.find(row => row.Field === 'archivo');
  const currentPathLength = Number(/varchar\((\d+)\)/i.exec(photoPath?.Type || '')?.[1] || 0);
  if (currentPathLength && currentPathLength < 2048) await pool.query('ALTER TABLE fotos MODIFY COLUMN archivo VARCHAR(2048) NOT NULL');
  const [constraints] = await pool.query("SELECT CONSTRAINT_NAME,CHECK_CLAUSE FROM information_schema.CHECK_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME='ck_fotos_orden'");
  let photoConstraintReady = false;
  for (const row of constraints) {
    if (row.CONSTRAINT_NAME === 'ck_fotos_orden') {
      if (/between\s+0\s+and\s+6|<\s*7/i.test(row.CHECK_CLAUSE)) { photoConstraintReady=true;continue; }
      // MariaDB/XAMPP and MySQL use different DROP syntax for CHECK constraints.
      try { await pool.query('ALTER TABLE fotos DROP CONSTRAINT ck_fotos_orden'); }
      catch (error) { if (error.code !== 'ER_PARSE_ERROR') throw error; await pool.query('ALTER TABLE fotos DROP CHECK ck_fotos_orden'); }
    }
  }
  if(!photoConstraintReady)await pool.query('ALTER TABLE fotos ADD CONSTRAINT ck_fotos_orden CHECK (orden BETWEEN 0 AND 6)');
  const [indexes] = await pool.query("SHOW INDEX FROM anuncios WHERE Key_name='idx_moderacion_vigencia'");
  if(!indexes.length)await pool.query('CREATE INDEX idx_moderacion_vigencia ON anuncios(moderacion,estado_pago,fecha_vencimiento)');
  await pool.query("INSERT IGNORE INTO planes_publicacion (id,nombre,precio_centimos,dias,bono_primer_anuncio,destacado,activo) VALUES (1,'Semanal',500,7,0,0,1),(2,'Diario',NULL,1,0,0,0),(3,'Mensual',NULL,30,0,0,0)");
  await pool.query("INSERT IGNORE INTO metadata (clave,valor) VALUES ('moderacion_v1','1')");
}
