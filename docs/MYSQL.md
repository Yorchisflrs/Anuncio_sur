# AvisoSur con MySQL de XAMPP

La aplicación usa MySQL (o MariaDB de XAMPP) solo cuando `.env` contiene `DB_CLIENT=mysql`. Si no, usa SQLite en `backend/data/avisosur.sqlite`. Ningún script SQL modifica ese archivo.

## Instalación nueva

1. Inicia **MySQL** en el panel de XAMPP. Abre phpMyAdmin, sitúate a nivel del servidor y ejecuta el contenido completo de [`database/avisosur_mysql.sql`](../database/avisosur_mysql.sql) en la pestaña **SQL**. Crea `avisosur_db` con todas sus tablas; repetirlo no borra datos.
2. Copia `.env.example` como `.env` y revisa `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` y `DB_PASSWORD`.
3. Para conservar los datos de un SQLite anterior, ejecuta `npm run migrate:mysql` **antes de iniciar el sitio**. La importación lee SQLite sin alterarlo, usa una transacción y no duplica registros si se repite. Si prefieres empezar con ejemplos, ejecuta en su lugar [`database/avisosur_datos_demo.sql`](../database/avisosur_datos_demo.sql) (16 avisos DEMO, que quedan pendientes de revisión).
4. Ejecuta `npm run build` y `npm start`, y abre `http://127.0.0.1:3001`. En desarrollo usa `npm run dev` y abre `http://127.0.0.1:5173`.
5. Crea la cuenta de administración con `node scripts/admin-user.mjs tu-correo@dominio.com --crear`.

## Actualizar una base existente

**Haz una copia de seguridad antes** (en phpMyAdmin: Exportar `avisosur_db`; además, copia `backend/uploads/`).

Al iniciar, el servidor aplica automáticamente las actualizaciones que falten. Solo **agrega** columnas, tablas e índices; no borra ni modifica anuncios, usuarios, fotos ni pagos. Si prefieres aplicarlas a mano en phpMyAdmin, ejecuta en este orden:

1. [`database/actualizar_moderacion_mysql.sql`](../database/actualizar_moderacion_mysql.sql): publicación pagada, roles y siete fotos.
2. [`database/actualizar_observaciones_mysql.sql`](../database/actualizar_observaciones_mysql.sql): nombre para mostrar, venta o alquiler, celular verificado, contacto a pedido y reportes.

Lo que cambia para quienes ya usaban el sistema:

- **Las cuentas existentes empiezan sin el celular verificado** y no pueden publicar hasta verificarlo. Administración puede verificarlas en **Administración → Verificar celulares**, con un código por WhatsApp o en persona. También las cuentas de administración, si van a publicar.
- Las cuentas existentes aparecen como «Vendedor de AvisoSur» hasta que su dueño elija un nombre para mostrar en «Mi cuenta».
- Los avisos existentes quedan como **venta**. Solo los tres avisos DEMO del seed que son alquileres («Departamento luminoso de 2 habitaciones», «Habitación cerca de la UNA Puno» y «Local comercial cerca del mercado») se marcan como alquiler, una vez.

## Comprobar la persistencia

Registra un usuario, verifica su celular desde administración y publica un aviso desde `/publicar`. Luego, en phpMyAdmin, selecciona `avisosur_db` y ejecuta:

```sql
SELECT id, nombre, correo, celular_verificado, fecha_registro FROM usuarios ORDER BY id DESC LIMIT 5;
SELECT id, titulo, precio, tipo_operacion, moderacion, estado_pago FROM anuncios ORDER BY id DESC LIMIT 5;
SELECT id, anuncio_id, archivo, orden FROM fotos ORDER BY id DESC LIMIT 5;
```

Las fotos se guardan como archivos en `backend/uploads/`, y los comprobantes y el QR en su carpeta privada; la tabla `fotos` conserva las rutas.

## Pruebas

`npm test` y `npm run benchmark` usan bases SQLite temporales y no tocan MySQL. La prueba de integración con MySQL solo corre si se activa con `AVISOSUR_TEST_MYSQL=1`. Crea y borra su propia base `avisosur_test_<aleatorio>` con las credenciales de `.env`, y nunca abre `avisosur_db`.
