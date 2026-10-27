import mysql from 'mysql2/promise';

// La aplicación conserva las fechas ISO en UTC. DATETIME no lleva zona horaria,
// por lo que se convierte solo en el límite con MySQL.
const isoDate = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/;
const dateFields = new Set(['fecha_registro', 'fecha_publicacion', 'fecha_subida', 'fecha', 'expira']);
const parameters = values => values.map(value => typeof value === 'string' && isoDate.test(value) ? value.slice(0, -1).replace('T', ' ') : value);
const normalizeRow = row => {
  if (!row) return row;
  for (const field of dateFields) {
    if (typeof row[field] === 'string') row[field] = row[field].replace(' ', 'T') + 'Z';
  }
  return row;
};

function mysqlQueries(connection) {
  return {
    kind: 'mysql',
    async all(sql, ...values) {
      const [rows] = await connection.execute(sql, parameters(values));
      return rows.map(normalizeRow);
    },
    async get(sql, ...values) {
      const [rows] = await connection.execute(sql, parameters(values));
      return normalizeRow(rows[0]);
    },
    async run(sql, ...values) {
      const [result] = await connection.execute(sql, parameters(values));
      return { lastInsertRowid: result.insertId, changes: result.affectedRows };
    },
  };
}

export async function openMysqlDatabase(config) {
  const pool = mysql.createPool({
    host: config.dbHost,
    port: config.dbPort,
    database: config.dbName,
    user: config.dbUser,
    password: config.dbPassword,
    charset: 'utf8mb4',
    dateStrings: true,
    waitForConnections: true,
    connectionLimit: 10,
  });
  try {
    await pool.execute('SELECT 1 FROM categorias LIMIT 1');
  } catch (error) {
    await pool.end();
    throw new Error('No se pudo abrir el esquema MySQL de AvisoSur. Ejecuta database/avisosur_mysql.sql en phpMyAdmin y revisa DB_HOST, DB_PORT, DB_NAME, DB_USER y DB_PASSWORD.', { cause: error });
  }
  const queries = mysqlQueries(pool);
  return {
    ...queries,
    async transaction(work) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const result = await work(mysqlQueries(connection));
        await connection.commit();
        return result;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },
    close: () => pool.end(),
  };
}
