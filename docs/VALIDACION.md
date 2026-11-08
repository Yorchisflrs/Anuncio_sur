# Validación ejecutada de AvisoSur

Fecha: 8 de noviembre de 2026 (America/Lima). Entorno: Windows 11, Node v24.16.0, Intel Core i5-1235U y MariaDB de XAMPP. Se validó la versión con las observaciones de la Práctica 9 (ramas `test/pruebas-por-requisito`, `fix/observaciones-diseno`, `feat/vendedor-verificado-y-reportes` y `docs/acta-y-evidencias`).

## Resumen

| Verificación | Resultado |
| --- | --- |
| `npm test`: pruebas HTTP con SQLite temporal | **88 correctas, 0 fallos**, 1 omitida por diseño (la de MySQL, que se ejecutó aparte) |
| Integración con MySQL/MariaDB (`AVISOSUR_TEST_MYSQL=1`) | **Correcta**, sobre una base temporal que se borró al terminar; `avisosur_db` no se tocó |
| `npm run check` (TypeScript) | Sin errores |
| `npm run build` (Vite) | Compilación correcta |
| `npm run benchmark` (RNF-01) | 500 solicitudes, 0 errores, máximo 145 ms: objetivo de menos de 2000 ms cumplido |
| Recorrido completo contra el servidor compilado | Correcto (detalle abajo) |
| Revisión visual a 1366 px y a 390 px | Sin desborde horizontal en ninguna pantalla revisada |

## Pruebas automáticas

`npm run test:reporte` ejecuta las 89 pruebas y deja el detalle en [evidencias/pruebas-automatizadas.xml](evidencias/pruebas-automatizadas.xml), en formato JUnit. En ese archivo, las rutas absolutas de la copia de trabajo se cambiaron por rutas relativas; los resultados no se modificaron.

| Grupo | Pruebas | Resultado |
| --- | --- | --- |
| RF-01 · Cuenta y acceso | 11 | correctas |
| RNF-03 · Protección del acceso | 1 | correcta |
| RF-02 · Publicación de anuncios | 15 | correctas |
| RF-03 · Consulta y búsqueda | 11 | correctas |
| RF-03 · Persistencia | 1 | correcta |
| RF-04 · Contacto por WhatsApp | 6 | correctas |
| RF-04 · Límite de pedidos y personas interesadas | 2 | correctas |
| Novedad · Celular verificado | 11 | correctas |
| Novedad · Reporte de estafa y revisión automática | 11 | correctas |
| Moderación, pagos manuales y planes | 16 | correctas |
| Migración SQLite y consultas MySQL | 3 | correctas |
| Integración MySQL/MariaDB (opcional) | 1 | omitida en `npm test`; ejecutada aparte con éxito |

Cada prueba levanta el servidor real en un puerto libre, hace pedidos HTTP y usa SQLite y carpetas temporales que se borran al terminar. Los casos que pidió el profesor para la novedad están incluidos con esos nombres:

- usuario sin verificar intenta publicar → 403;
- código equivocado → 422;
- la misma persona reporta dos veces → 409;
- dos reportes → el aviso sigue en el catálogo;
- el tercero de otra cuenta → ya no aparece en `/api/anuncios`;
- `GET /api/anuncios/:id` ya no trae el celular.

## Integración con MySQL/MariaDB

La prueba opcional crea `avisosur_test_<aleatorio>` en el servidor de XAMPP, carga el esquema anterior a la moderación, arranca la aplicación (que aplica las migraciones) y comprueba:

- que existan las columnas y tablas nuevas y el índice único de reportes;
- que el aviso antiguo quede como venta y que el detalle no entregue el celular;
- que el contacto se entregue a pedido;
- que tres reportes verificados simultáneos oculten el aviso y que el moderador lo restaure;
- que los datos se conserven al reiniciar.

Al terminar, la base temporal se borró; en el servidor solo quedó `avisosur_db`, que la prueba no abre.

## RNF-01: búsqueda concurrente

Se usaron 500 avisos **públicos**: aprobados, pagados y vigentes. Hubo 50 clientes virtuales concurrentes con diez consultas cada uno, después de 25 solicitudes de calentamiento. El cliente y la API se ejecutaron en esta computadora por HTTP loopback.

| Métrica | Resultado |
| --- | --- |
| Solicitudes | 500 |
| Resultados devueltos | 10 300 |
| Errores | 0 |
| Mediana | 101 ms |
| Percentil 95 | 138 ms |
| Percentil 99 | 141 ms |
| Máximo | 145 ms |
| Objetivo | Menos de 2000 ms: cumplido en esta ejecución |

La medición anterior (13 de octubre, mediana de 52 ms) se hizo antes de la moderación. Hasta esta corrección, el script fallaba y sus avisos habrían quedado pendientes, así que las búsquedas no devolvían resultados. El plan de consulta usa `idx_catalogo`. El resultado no se extrapola a tráfico real ni a conexiones 3G. Datos completos en [benchmark-results.json](benchmark-results.json).

## Recorrido completo contra el servidor compilado

Con el frontend compilado, una base SQLite nueva y el servidor en un puerto de prueba se comprobó, de punta a punta:

1. Las rutas de React (`/`, `/anuncios`, `/categorias`, detalle y ayuda) se sirven compiladas. El paquete incluye la interfaz nueva y ya no contiene «Próximamente», «Reclamaciones · Prototipo» ni «servidor esté iniciado».
2. Administración aprueba los 16 avisos DEMO.
3. Una vendedora sin verificar no puede publicar (403). Administración genera su código; un código equivocado da 422 y el correcto la verifica.
4. Publica un cuarto en alquiler con foto, administración lo aprueba, y el detalle muestra «S/ 350 al mes», su nombre y la insignia sin el celular. El celular solo sale al pedir el contacto.
5. Tres compradores verificados en persona reportan un aviso: con el tercer reporte se oculta y aparece en la página del moderador.

## Revisión visual

Capturas tomadas con Microsoft Edge sin interfaz, a 1366 px y con emulación de 390 px mediante DevTools. Se midió el ancho del documento en cada pantalla, sin desbordes horizontales. Están en [screenshots/observaciones-p9](screenshots/observaciones-p9):

| Captura | Qué muestra |
| --- | --- |
| `01-portada` | Titular informativo con el número de avisos publicados |
| `02-catalogo-lista`, `03-catalogo-celular` | Catálogo en lista, con «al mes» en los alquileres y la insignia |
| `04-detalle-alquiler-insignia` | Venta o alquiler, nombre del vendedor, «Celular verificado» e historial |
| `05-contacto-y-reporte` | Contacto revelado a pedido y formulario de reporte |
| `06-categorias-sin-proximamente` | Solo las categorías que existen |
| `07-registro-nombre-para-mostrar` | Campo «Nombre para mostrar» |
| `08-perfil-por-verificar`, `09-publicar-sin-verificar` | Verificación pendiente: se puede mirar, no publicar |
| `10-publicar-fotos-y-operacion` | Fotos JPG, PNG, WebP o HEIC y «¿Lo vendes o lo alquilas?» |
| `11-perfil-contactos` | «1 persona pidió tu contacto» |
| `12-moderador-reportes` | Página del moderador con un aviso oculto por reportes |
| `13-administracion-verificaciones` | Código generado y botón «Enviar por WhatsApp» |
| `14-ayuda-sin-textos-de-prototipo` | Ayuda sin textos de prototipo |
| `15-reporte-enviado` | Reporte enviado desde la interfaz |

Los nombres, correos y celulares de las capturas son ficticios.

## Límites de esta validación

- **La aceptación por otra mesa no está hecha.** [ACTA_ACEPTACION.md](ACTA_ACEPTACION.md) está lista para ejecutarse; los resultados de esta página no la reemplazan.
- La verificación con un celular real por WhatsApp y la subida de fotos HEIC desde un iPhone se probaron con datos simulados; quedan para el acta.
- El ocultamiento por reportes y la verificación se probaron con cuentas marcadas como verificadas en la base temporal o en persona.
- RNF-02 (98 % de disponibilidad en 30 días) y la medición de RNF-04 (menos de 4 s en 3G) siguen pendientes de un despliegue real.

Para repetir: `npm run test:reporte`, `npm run benchmark`, `npm run check` y `npm run build`.
