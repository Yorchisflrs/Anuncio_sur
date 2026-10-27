# AvisoSur

Portal de anuncios clasificados para Puno, Juliaca y el sur del Perú. Prototipo académico funcional para Ingeniería de Software II de la Universidad Nacional del Altiplano. La integración opcional con MySQL de XAMPP se explica en [docs/MYSQL.md](docs/MYSQL.md).

Permite explorar anuncios sin cuenta, combinar filtros, consultar fotografías y abrir un contacto por WhatsApp. Los usuarios registrados pueden publicar y consultar sus anuncios, cerrar sesión y dar de baja sus publicaciones conservando los registros.

## Inicio rápido

Requiere **Node.js 24 o superior** y npm. SQLite funciona sin instalar un servidor; para usar MySQL inicia XAMPP y sigue [la secuencia de importación y conexión](docs/MYSQL.md). La primera instalación requiere Internet para descargar paquetes; el uso posterior y las imágenes son locales. El enlace de WhatsApp sí abre un servicio externo.

Desde esta carpeta:

```powershell
npm install
npm run dev
```

Abre **http://127.0.0.1:5173**. El backend escucha en **http://127.0.0.1:3001** y Vite redirige `/api` y `/uploads` al backend. `Ctrl+C` detiene ambos procesos.

Para ejecutar el frontend compilado con un único servidor:

```powershell
npm run build
npm start
```

Abre **http://127.0.0.1:3001**. Las rutas de React admiten acceso directo y recarga. Si AvisoSur ya está iniciado en ese puerto, abre su URL sin lanzar una segunda instancia.

En PowerShell, si la política impide ejecutar `npm.ps1`, usa `npm.cmd` en los mismos comandos. Si `node` no está en PATH, configura la instalación de Node antes de ejecutar los comandos.

## Cuenta y datos de demostración

| Dato | Valor ficticio |
| --- | --- |
| Correo | `demo@avisosur.local` |
| Celular | `900000000` |
| Contraseña | `AvisoSur2026!` |

También se puede iniciar sesión usando el celular. El botón **Rellenar datos de demostración** completa el formulario de acceso; después pulsa **Iniciar sesión**.

En modo SQLite, la base se crea y carga automáticamente en el primer arranque con **16 anuncios**, distribuidos en las tres categorías y en Puno, Juliaca y otras localidades del sur. El seed es idempotente: reiniciar no duplica anuncios ni borra publicaciones. En MySQL, los datos se incorporan con la migración o con el SQL opcional. Las tarjetas muestran **DEMO**, y el detalle identifica las ilustraciones y el vendedor ficticio. Los anuncios publicados desde la cuenta demo conservan esa marca.

Las imágenes de demostración son recursos locales creados para este proyecto; representan productos de ejemplo y no son fotografías de esos bienes. La cabecera y el pie muestran el logo oficial azul y gris. El número demo es un marcador inventado, no un contacto verificado: revisa la URL de WhatsApp sin enviar un mensaje a ese número. Ninguna función envía mensajes automáticamente.

Para demostrar una publicación en el prototipo, usa JPG o PNG propios o pulsa **Usar imagen de demostración** en el formulario. Este botón selecciona un PNG local, muestra la vista previa y permite guardarlo mediante el mismo flujo de carga del backend. También se incluye `docs/fixtures/moto-demo.png`. Todos los datos de las pruebas son ficticios.

## Funcionalidades implementadas

| Requisito del alcance | Implementación |
| --- | --- |
| RF-01 — Cuenta y acceso | Registro validado, acceso con correo o celular, bcrypt, sesión persistente y cierre de sesión. |
| RF-02 — Publicación | Ruta autenticada, título, descripción, categoría, subcategoría, precio, zona y de una a tres fotos; vista previa y errores que conservan campos. |
| RF-03 — Consulta y búsqueda | Catálogo, detalle, filtros combinados, subcategorías, ordenamiento, paginación y precios mínimo y máximo inclusivos. |
| RF-04 — Contacto | Enlace `wa.me` con `51` y celular del vendedor, más un mensaje codificado con el título del anuncio. |
| RNF-01 — Búsqueda | Consultas parametrizadas, índices, límite de resultados y prueba reproducible con 500 anuncios y 50 clientes concurrentes. |
| RNF-03 — Contraseñas | bcrypt con costo 12, hashes excluidos de la API, tokens de sesión aleatorios con solo su SHA-256 guardado, cookie HttpOnly y validación en backend. |

Las siete rutas son `/`, `/anuncios`, `/anuncios/:id`, `/registro`, `/login`, `/publicar` y `/perfil`. Incluyen navegación móvil, estados de carga, error y listas vacías. El perfil muestra los anuncios activos y dados de baja. Solo su propietario puede retirarlos del catálogo y consultar el detalle de sus anuncios retirados.

## Tecnologías y decisiones

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, React Router, Lucide e Inter alojada localmente.
- **Backend:** Node, Express, SQLite mediante `node:sqlite` o MySQL mediante `mysql2/promise`, bcryptjs, Multer y Sharp.
- **Persistencia:** SQLite en `backend/data/avisosur.sqlite` o MySQL en `avisosur_db`, más fotos optimizadas en `backend/uploads/`. Para respaldar los datos originales, detén el servidor y copia completas las carpetas `backend/data/` y `backend/uploads/`, incluyendo los archivos auxiliares de SQLite.
- **SQLite integrado:** evita compilar un conector nativo en Windows. Se eligió Node 24 como mínimo; la API utilizada es `DatabaseSync`. [Documentación oficial de SQLite en Node](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html).
- **bcryptjs:** implementa bcrypt en JavaScript sin compilar módulos adicionales. Se rechazan contraseñas menores de ocho caracteres o mayores de 72 bytes para evitar truncamientos.
- **Sesiones:** cookie HttpOnly, SameSite=Strict, duración de siete días y revocación al cerrar sesión. No se guardan tokens en localStorage. El servidor rechaza escrituras con un origen ajeno y limita intentos de registro/acceso.
- **Precios:** SQLite almacena centavos enteros; MySQL usa `DECIMAL(10,2)`. La API devuelve soles y la búsqueda incluye ambos extremos del rango.
- **Fotos:** límite temporal de tres JPG/PNG de hasta 2 MB cada uno, y protección de decodificación de 20 megapíxeles. Se comprueban el formato y el contenido, se elimina metadatos al recodificar, se ajusta a 1600 px y se almacena WebP. **Estos límites deben validarse con usuarios.**
- **Búsqueda:** insensible a mayúsculas y tildes; los índices cubren estado, categoría, precio, zona y fecha. La búsqueda de texto recorre los anuncios candidatos; para un catálogo mayor se puede introducir FTS5.
- **Identidad:** `frontend/src/components/Logo.tsx` muestra `frontend/public/logo-avisosur.jpg`, el logo oficial. `frontend/public/favicon.svg` conserva el icono simplificado. `scripts/generate-demo-assets.mjs` regenera las ilustraciones.
- **Tailwind:** integrado como plugin de Vite y usado junto con estilos de componentes. [Guía oficial de instalación](https://tailwindcss.com/docs/installation/using-vite).

## Estructura

```text
frontend/
  public/demo/          Ilustraciones sin dependencias externas
  src/components/       Layout, navegación, tarjetas, estados y rutas protegidas
  src/pages/            Las siete pantallas
  src/context/          Sesión y notificaciones
  src/hooks/            Carga cancelable de recursos
  src/services/         API, formatos y validaciones del formulario
  src/types.ts          Modelos del frontend
  src/styles.css        Diseño responsive y accesibilidad
backend/
  src/app.mjs           API REST y controladores
  src/database.mjs      Esquema, claves foráneas e índices
  src/auth.mjs          Gestión de sesiones
  src/listings.mjs      Consultas y serialización de anuncios
  src/uploads.mjs       Validación y optimización de fotos
  src/validation.mjs    Validaciones de servidor
  src/seed.mjs          Categorías, cuenta y 16 anuncios ficticios
  test/api.test.mjs     Escenarios de integración y persistencia
scripts/
  dev.mjs               Inicio conjunto de API y Vite
  benchmark.mjs         Carga aislada para RNF-01
  generate-demo-assets.mjs
docs/
  VALIDACION.md         Resultados y límites de la verificación
  ARQUITECTURA.md       Modelo, API y decisiones
  acceptance-results.json
  benchmark-results.json
```

## Verificación reproducible

```powershell
npm run check
npm run build
npm test
npm run benchmark
```

Las pruebas usan SQLite y carpetas temporales aisladas, sin alterar el catálogo normal. `npm test` comprueba registro, hash, acceso, protección, publicación por S/ 1, tres imágenes, archivos inválidos, filtros inclusivos, ausencia de coincidencias, URL de WhatsApp, propiedad, baja y persistencia tras reiniciar. Produce `docs/acceptance-results.json` y mide la publicación contra el objetivo local de cinco segundos.

`npm run benchmark` prepara 500 anuncios activos y lanza 50 clientes virtuales con diez búsquedas por cliente, después de 25 búsquedas de calentamiento. Produce `docs/benchmark-results.json` con latencias, errores, entorno y plan de consulta. Falla si hay errores o si alguna respuesta tarda dos segundos o más. Es una prueba HTTP de la API en la misma máquina; no mide experiencia 3G ni una red pública. Consulta los resultados efectivamente ejecutados en [docs/VALIDACION.md](docs/VALIDACION.md).

## Configuración opcional

Sin `.env`, el proyecto conserva el modo SQLite. Para MySQL, copia `.env.example` a `.env` después de crear el esquema. El servidor carga `.env` automáticamente y usa `DB_CLIENT=mysql`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` y `DB_PASSWORD`. Consulta [docs/MYSQL.md](docs/MYSQL.md) para el orden exacto.

El servidor está enlazado a `127.0.0.1`. En desarrollo, si cambias el puerto de la API, ajusta también el destino del proxy en `frontend/vite.config.ts`. Para el prototipo HTTP local, `Secure` está desactivado en la cookie; en HTTPS se debe activar `COOKIE_SECURE=true` y configurar el origen. No se proporciona despliegue comercial ni acceso público.

## Pendientes y límites del prototipo

- **RF-05 — Sugerencia de precio:** después se pueden comparar anuncios activos de categoría, subcategoría y zona similares y presentar una mediana y su tamaño de muestra; distinguir alquileres de ventas y justificar el criterio con usuarios.
- **RF-06 — Patrones de riesgo:** incorporar reportes y reglas revisables con moderación humana. Evaluar falsos positivos antes de mostrar alertas. No existe un detector de estafas en esta versión.
- **RF-07 — Categoría sugerida:** añadir una clasificación por palabras clave o un modelo evaluado con ejemplos etiquetados; permitir que el vendedor corrija la sugerencia.
- **RF-08 — Moderación:** la tabla `reportes` y sus relaciones están preparadas; faltan endpoint, formulario, permisos administrativos y panel de revisión.
- **RNF-02 — 98% durante 30 días:** objetivo documental pendiente de monitoreo real.
- **RNF-04 — Inicio en menos de cuatro segundos en 3G:** diseño móvil, imágenes optimizadas y fuentes locales implementados; la medición específica en 3G sigue pendiente.
- Faltan verificación de correo/celular, recuperación de contraseña, edición de anuncios, restauración de bajas y operación de producción. No hay pagos, chat interno ni resultados de IA simulados.

## Guion de exposición

1. Abre el inicio y entra a **Explorar anuncios**.
2. Selecciona **Vehículos**, mínimo **0**, máximo **5000** y aplica filtros: aparecen la moto de S/ 5000 y el mototaxi de S/ 4800.
3. Abre la moto, revisa el detalle y el enlace de WhatsApp sin enviar mensajes al número ficticio.
4. Busca `sincoincidencia-xyz` y observa el mensaje y la sugerencia para ampliar filtros.
5. Registra una cuenta ficticia con un correo nuevo y celular peruano de nueve dígitos; llegas al perfil.
6. Cierra sesión e ingresa con correo o celular.
7. Publica un anuncio con una foto JPG/PNG y precio **S/ 1**. Prueba primero **S/ 0** o categoría vacía: los datos se conservan.
8. Comprueba la confirmación debajo del botón y abre **Ver anuncio publicado** para revisar el detalle. Luego consulta el catálogo y el perfil. Da de baja el anuncio para mostrar que desaparece del catálogo y permanece en tu perfil.
