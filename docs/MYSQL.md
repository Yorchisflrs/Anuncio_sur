# AvisoSur con MySQL de XAMPP

El proyecto conserva `backend/data/avisosur.sqlite` como respaldo. Ningún archivo SQL lo modifica. La aplicación usa MySQL únicamente cuando `.env` contiene `DB_CLIENT=mysql`.

1. Inicia **MySQL** en el panel de XAMPP. Abre phpMyAdmin, sitúate a nivel del servidor y pega el contenido completo de [`database/avisosur_mysql.sql`](../database/avisosur_mysql.sql) en la pestaña **SQL**. Pulsa **Continuar**. Crea `avisosur_db` y las siete tablas; repetirlo no borra datos.
2. Para conservar todos los usuarios, anuncios, fotos y demás datos del SQLite actual, copia `.env.example` a `.env`, revisa `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` y `DB_PASSWORD`, y ejecuta `npm run migrate:mysql` **antes de iniciar el sitio**. La importación lee SQLite sin alterarlo, usa una transacción MySQL y evita duplicar registros al repetirse.
3. Si prefieres una base nueva con ejemplos, en lugar de la migración ejecuta después el contenido de [`database/avisosur_datos_demo.sql`](../database/avisosur_datos_demo.sql) en phpMyAdmin. Incluye tres categorías, una cuenta con hash bcrypt, 16 anuncios ficticios y rutas `/demo/*.svg` ya existentes. Es opcional y se puede volver a ejecutar sin duplicar esos anuncios.
4. En la carpeta del proyecto ejecuta `npm install` si todavía no están instaladas las dependencias y luego `npm run dev`. Abre `http://127.0.0.1:5173`. Para servir la compilación desde Express: `npm run build` y `npm start`, luego abre `http://127.0.0.1:3001`.

Para comprobar la persistencia, registra un usuario y publica un anuncio desde `/publicar`. Luego, en phpMyAdmin, selecciona `avisosur_db` y ejecuta:

```sql
SELECT id, correo, fecha_registro FROM usuarios ORDER BY id DESC LIMIT 5;
SELECT id, titulo, precio, estado, fecha_publicacion FROM anuncios ORDER BY id DESC LIMIT 5;
SELECT id, anuncio_id, archivo, orden FROM fotos ORDER BY id DESC LIMIT 5;
```

El nuevo usuario y anuncio deben aparecer también al recargar `/perfil` y `/anuncios`. Las fotos se guardan como archivos en `backend/uploads/`; la tabla `fotos` conserva sus rutas. Si se hace una copia de seguridad, conserva tanto `backend/data/` como `backend/uploads/`.

`npm test` y `npm run benchmark` usan bases SQLite temporales aisladas para no modificar tus datos MySQL. Hasta que ejecutes el primer SQL y configures `.env`, no es posible completar la prueba HTTP real contra MySQL.
