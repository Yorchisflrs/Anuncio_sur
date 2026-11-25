# AvisoSur en Railway · Práctica 14

El servicio de la aplicación sirve React compilado y Express bajo un mismo origen HTTPS. MySQL se conecta por la red privada de Railway. Un volumen del servicio de la aplicación conserva fotos, QR y comprobantes.

## Preparación y datos

1. Usar la rama `deploy/railway`. La raíz del servicio es la raíz del repositorio.
2. Crear primero el servicio MySQL. Exportar la base local de XAMPP con estructura y datos e importar en la base que proporciona Railway. Usar una copia consistente y verificar el resultado antes de arrancar la aplicación.
3. En phpMyAdmin exportar la base sin las instrucciones `CREATE DATABASE` ni `USE`, para que la importación use la base de destino seleccionada. Al usar mysqldump, exportar una base por su nombre sin `--databases`. Mantener el respaldo en `backups/`, que está excluido de Git y de Docker.
4. La copia debe conservar categorías, cuentas y sus hashes, planes, anuncios, fotos y metadata de pago. Las fotos referenciales versionadas se incluyen en la imagen. Los archivos de `backend/uploads/`, incluida su carpeta oculta `.privado/`, se trasladan a `/data/uploads/`. Si la instalación local tiene `PRIVATE_UPLOAD_DIR` personalizado, trasladar también sus archivos privados al destino `/data/uploads/.privado/`.
5. El usuario de base de la aplicación necesita permisos sobre su esquema, incluidas las migraciones aditivas existentes. Una base vacía todavía necesita la importación. El arranque comprueba que exista la tabla `categorias`.

## Aplicación y volumen

Conectar el repositorio al servicio de la aplicación y seleccionar `deploy/railway`. Railway detecta el `Dockerfile` de la raíz. Sus etapas ejecutan `npm ci`, `npm run build` y conservan las dependencias de producción. El contenedor inicia directamente `node backend/src/server.mjs`. Para ejecutar fuera de Docker está disponible `npm start`.

Montar un volumen persistente en **/data** del servicio de la aplicación. Mantener una sola réplica mientras se guardan las subidas en este volumen.

Generar un dominio público del servicio y configurar su puerto de destino con el puerto que usa la aplicación. La aplicación lee `PORT`, que Railway proporciona. En **Settings → Deploy**, configurar **Healthcheck Path** como **/salud**, con un tiempo de espera de 120 segundos y reinicio por fallo.

## Variables del servicio de la aplicación

Introducir los valores reales en Railway Variables. En las evidencias mostrar únicamente los nombres.

| Nombre | Configuración |
|---|---|
| NODE_ENV | production; ya definido en Docker |
| HOST | 0.0.0.0; ya definido en Docker |
| PORT | Puerto proporcionado por Railway |
| TRUST_PROXY | 1 para el acceso directo mediante el proxy público de Railway |
| DB_CLIENT | mysql; ya definido en Docker |
| DB_HOST | Referencia a MYSQLHOST del servicio MySQL |
| DB_PORT | Referencia a MYSQLPORT |
| DB_NAME | Referencia a MYSQLDATABASE |
| DB_USER | Referencia a MYSQLUSER |
| DB_PASSWORD | Referencia a MYSQLPASSWORD |
| APP_ORIGIN | Origen HTTPS del dominio público, sin ruta ni parámetros. También se reconoce RAILWAY_PUBLIC_DOMAIN si APP_ORIGIN está vacío |
| COOKIE_SECURE | true; producción fuerza cookies seguras |
| UPLOAD_DIR | /data/uploads; ya definido en Docker |
| PRIVATE_UPLOAD_DIR | /data/uploads/.privado; ya definido en Docker |

En el editor de Variables se pueden utilizar referencias a las variables del servicio MySQL. El nombre del servicio debe coincidir con el que muestra el proyecto. El archivo `.env.example` documenta las opciones locales y de producción. El archivo `.env` local permanece fuera del despliegue.

Si cambia el dominio, actualizar APP_ORIGIN. Si se añade otro proxy delante de Railway, revisar TRUST_PROXY y los límites de acceso con esa topología.

## Comprobación y evidencia

La ruta pública `/salud` devuelve JSON con `status=ok` y HTTP 200 cuando puede consultar la base. Devuelve un estado general y HTTP 503 si la consulta falla. No incluye detalles de la conexión. La ruta anterior `/api/health` sigue disponible.

Ejecutar desde la raíz del proyecto:

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run smoke -- https://DOMINIO-PUBLICO
```

La prueba de humo realiza lecturas de salud, interfaz compilada, JavaScript, categorías, catálogo y PWA. Guardar su salida contra la dirección pública para la parte 3.

Comprobar además el inicio de sesión, publicación con foto, comprobante privado y aprobación administrativa. Crear un anuncio identificado como prueba. Reiniciar el servicio y verificar que sus datos y archivos siguen disponibles. Eliminar o retirar ese anuncio al terminar la comprobación.

Para el PDF de la práctica guardar el log real del arranque y de las pruebas, una captura del panel con nombres de variables y una captura del teléfono abriendo la dirección HTTPS con datos móviles. La dirección copiable va en la primera página. Esas evidencias se recogen después del despliegue.

## Referencias

- [Express en Railway](https://railway.com/guides/express)
- [MySQL](https://docs.railway.com/databases/mysql)
- [Volúmenes persistentes](https://docs.railway.com/volumes/reference)
- [Healthchecks](https://docs.railway.com/deployments/healthchecks)
