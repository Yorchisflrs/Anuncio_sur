# AvisoSur · Rediseño visual

Estado actual del 26 de octubre de 2026: [escaparate giratorio, fondo en todas las rutas y verificación final](ENTREGA_FINAL.md). El registro que sigue documenta la iteración anterior del 20 de octubre.
Validación local: 20 de octubre de 2026. Proyecto utilizado: C:\xampp\htdocs\AnuncioSur.

El frontend existente conserva sus rutas y servicios. El rediseño cambia la composición de inicio, catálogo, categorías, acceso, registro, publicación, perfil y ficha de producto. Se reutilizan los anuncios y el logo oficial; no se instalaron dependencias.

## Sistema visual
Los tokens de color, sombras, radios, tipografía y la unidad de 8 px están en frontend/src/styles.css. Azul dominante, turquesa para interacción y naranja para acentos. Inter se sirve localmente; los títulos utilizan Segoe UI Variable Display/Segoe UI, con Arial como alternativa del sistema.

La portada utiliza anuncios del catálogo en una composición con flotación y parallax. Su actualización final incorpora un paisaje local optimizado inspirado en el Titicaca, degradado azul marino y título blanco/turquesa: [cambios y verificación del fondo](PORTADA.md). Las tarjetas, campos, botones, estados y pie comparten el mismo sistema. Se retiraron afirmaciones de verificación y moderación no implementadas. El mapa externo se sustituyó por un directorio de localidades con cantidades y enlaces reales.

## Escaparate
OrbitGallery.tsx conserva su nombre de componente para la integración existente, pero ya no muestra órbitas, anillos ni estrellas. Presenta hasta seis tarjetas en capas, perspectiva CSS, desplazamiento automático discreto, arrastre con inercia, parallax y elevación al pasar el cursor. Se puede pausar o cambiar a lista. En móviles se utiliza una cuadrícula legible; prefers-reduced-motion abre la alternativa sin movimiento. La animación escribe transforms mediante requestAnimationFrame y referencias, sin renderizar React en cada cuadro.

El modal consulta el mismo detalle de la API e incluye fotografías, precio, descripción, vendedor, fecha, zona, WhatsApp y ficha completa. Conserva el foco dentro del diálogo y admite Escape.

## Verificación ejecutada
| Comprobación | Resultado |
| --- | --- |
| Compilación TypeScript y Vite en XAMPP y workspace | Correcta |
| Pruebas existentes: npm test | 20 aprobadas |
| Ocho pantallas × cinco tamaños | 40 combinaciones revisadas en Chrome |
| Tamaños | 1440×900, 1280×800, 768×1024, 390×844 y 375×812 |
| Desbordamiento, tarjetas recortadas, superposición significativa e imágenes fallidas | Ningún caso detectado |
| Consola durante la revisión final | Sin excepciones ni entradas de error |
| Ingreso demo, búsqueda, filtro de categoría, lista, pausa, arrastre y modal | Correctos |
| Navegación móvil, filtros y cierre con Escape | Correctos |
| Vista previa en frontend compilado con MySQL | Correcta |
| Publicación con dos pulsaciones consecutivas | Un anuncio, una foto, confirmación visible y ficha accesible |

La publicación se probó con la API real y el frontend compilado en una base SQLite temporal aislada: pasó de 16 a 17 anuncios, con precio S/ 1 y una fotografía. No se insertaron anuncios de prueba en MySQL. La revisión contra avisosur_db mantuvo exactamente los 20 anuncios existentes.

Se detectó y corrigió una incompatibilidad anterior entre las URL blob de previsualización y la política de imágenes del servidor compilado. Las vistas previas ahora usan FileReader/data URL. El archivo original, la validación y el envío multipart se conservan; no se cambió la política del servidor.

Resultados reproducibles de esta sesión:
- [Revisión responsive e interacciones](redesign-validation.json)
- [Publicación y doble pulsación](redesign-publication-validation.json)
- [Frontend compilado con MySQL](redesign-production-validation.json)
- [Pruebas de aceptación existentes](acceptance-results.json)

## Capturas reales
| Vista | Antes | Después |
| --- | --- | --- |
| Inicio | [Antes](screenshots/redesign/before-home-1440.png) | [Después](screenshots/redesign/fondo-inicio-1440x900.png) |
| Anuncios | [Antes](screenshots/redesign/before-anuncios-1440.png) | [Después](screenshots/redesign/presentacion-anuncios-1440x900.png) |
| Móvil | — | [Anuncios a 390 px](screenshots/redesign/presentacion-anuncios-390x844.png) |
| Detalle rápido | — | [Modal](screenshots/redesign/modal-1440x900.png) |
| Publicación | — | [Confirmación después de guardar](screenshots/redesign/publication-success-1280x800.png) |

La carpeta screenshots/redesign contiene también las capturas completas por página y tamaño. Las publicaciones DEMO conservan sus imágenes originales de ejemplo.

## Ejecutar
Con MySQL de XAMPP encendido:
~~~powershell
cd C:\xampp\htdocs\AnuncioSur
npm.cmd start
~~~
Abrir http://127.0.0.1:3001. La compilación ya está generada. Para editar con recarga: npm.cmd run dev y http://127.0.0.1:5173.

No hay cambios en SQLite/MySQL, modelos, endpoints, registro, autenticación, contacto o reglas de publicación. La modificación funcional del frontend se limita a que las vistas previas funcionen también con la política de imágenes del servidor compilado.
