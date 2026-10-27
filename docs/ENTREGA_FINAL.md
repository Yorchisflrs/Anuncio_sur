# AvisoSur · Escaparate giratorio y fondo compartido

Entrega verificada el 26 de octubre de 2026 sobre el proyecto existente `C:\xampp\htdocs\AnuncioSur`.

El escaparate anterior distribuía las tarjetas en filas. Ahora los anuncios recorren una trayectoria circular con coordenadas X/Y/Z, perspectiva, escala y orden de profundidad: pasan del fondo al frente y continúan el giro. Las tarjetas mantienen la orientación de lectura y una superficie sólida. La burbuja decorativa es transparente y permite ver el paisaje regional.

## Comportamiento

- Inicio y `/anuncios` reutilizan el mismo componente. La selección inicial intercala categorías y prioriza títulos descriptivos sin excluir registros. Los grupos permiten consultar todos los resultados. El orden por precio y la vista sencilla conservan el orden recibido de la API.
- Cada tarjeta visible abre el detalle real: fotografías, precio, ubicación, descripción completa, vendedor disponible, enlace a WhatsApp y ficha. El modal admite Escape, atrapa el foco y lo devuelve al anuncio al cerrar.
- Anterior/Siguiente y las flechas del teclado giran los anuncios. El arrastre se distingue del clic. El movimiento se pausa con hover, foco de teclado, interacción táctil, apertura del modal y pausa manual. La pausa manual no se cancela al cerrar el detalle. Girar permite reanudar con el ratón.
- En teléfono se muestra una tarjeta principal y partes de las vecinas; se puede deslizar horizontalmente conservando el desplazamiento vertical. El giro automático comienza detenido y puede activarse con Girar. La preferencia de movimiento reducido desactiva el giro automático y conserva los controles manuales.
- Una única imagen fija y su degradado pertenecen a `Layout`, compartidos por inicio, catálogo, categorías, acceso, registro, publicación, perfil, ficha y ayuda. Los paneles, textos y controles conservan contraste sobre el paisaje.
- Publicar presenta Fotos → Datos del anuncio → Contacto. Usa el teléfono y correo de la sesión existente. El handler de envío, multipart, FileReader y protección contra doble clic se conservaron. La confirmación sigue siendo «Tu anuncio se publicó correctamente.».

## Archivos modificados

| Área | Archivos |
| --- | --- |
| Burbuja y selección | `frontend/src/components/OrbitGallery.tsx`, `OrbitGallery.css`, `balancedListings.ts` |
| Integración | `frontend/src/components/HeroShowcase.tsx`, `frontend/src/pages/ExplorePage.tsx` |
| Fondo y navegación | `frontend/src/components/Layout.tsx`, `frontend/src/pages/HomePage.tsx`, `frontend/src/styles.css`, `frontend/src/site-landscape.css` |
| Detalle y publicación | `frontend/src/components/ListingPreviewModal.tsx`, `frontend/src/pages/PublishPage.tsx`, `frontend/src/detail-publish.css` |

[Lista exacta de los 12 archivos](bubble-changed-files.json). Se reutiliza `frontend/public/images/avisosur-titicaca-hero.webp` y el logo oficial. No se instalaron dependencias ni se cambió el backend, la autenticación o el esquema MySQL.

## Verificación ejecutada

| Comprobación | Resultado |
| --- | --- |
| TypeScript y Vite en workspace y proyecto XAMPP | Compilación correcta |
| Pruebas existentes del backend | 20 aprobadas |
| Nueve rutas × cuatro tamaños | 36 combinaciones sin desbordamiento, imágenes fallidas ni errores de consola |
| Tamaños | 1280 × 800, 1440 × 900, 768 × 1024 y 390 × 844 |
| Fondo compartido | Una sola imagen cargada; posición fija antes/después de bajar y en todas las rutas comprobadas |
| Recorrido 3D | Giro automático y paso medido de profundidad frontal a trasera |
| Acceso a datos | Todos los anuncios de la página API alcanzables por grupos, búsqueda y filtro de categoría correctos |
| Interacción | Clic nativo frontal y lateral, arrastre sin apertura accidental, swipe móvil, vista sencilla y movimiento reducido correctos |
| Pausa y teclado | Pausa manual, hover, foco, reanudación con ratón y flechas comprobados |
| Modal | Descripción y WhatsApp coinciden con API; Tab/Shift+Tab, Escape y restauración del foco correctos |
| Controles de la burbuja | Ningún control visible por debajo de 48 × 48 px en los tamaños comprobados |
| Publicación aislada con doble clic | De 16 a 17 anuncios; exactamente un anuncio, una foto, precio S/ 1, botón deshabilitado y confirmación visible |
| Catálogo MySQL real | Los mismos 20 anuncios antes y después; sin publicaciones de prueba |

La publicación se realizó con la API real y el frontend compilado en SQLite y archivos temporales aislados, que se retiraron al finalizar. Las pruebas de descripción larga y galería de tres fotos del modal utilizaron una respuesta alterada únicamente en el navegador de prueba; no alteraron la base real. Se validaron 2805 caracteres visibles en su totalidad, sin un área interna de descripción recortada.

El último ajuste de separación de tarjetas y reanudación de Girar se volvió a compilar y comprobar en los cuatro tamaños. La función `submit`, el archivo de autenticación y las dependencias se compararon con la copia anterior y permanecen iguales.

Resultados:

- [Rutas, trayectoria e interacciones](bubble-validation.json)
- [Revisión final de pausa, foco y reanudación](bubble-final-controls.json)
- [Publicación aislada y doble clic](bubble-publication-validation.json)
- [Detalle y formulario](detail-publish-validation.json)
- [Revisión independiente del fondo](shared-landscape-validation.json)
- [Pruebas existentes](acceptance-results.json)

## Capturas reales

- [Antes](screenshots/redesign/burbuja-antes-1280x800.png)
- [Burbuja en escritorio](screenshots/redesign/burbuja-anuncios-1440x900.png)
- [Burbuja en teléfono](screenshots/redesign/burbuja-anuncios-390x844.png)
- [Portada](screenshots/redesign/burbuja-inicio-1440x900.png)
- [Detalle abierto](screenshots/redesign/burbuja-detalle-1440x900.png)
- [Detalle en teléfono](screenshots/redesign/burbuja-detalle-390x844.png)
- [Confirmación después de publicar](screenshots/redesign/burbuja-publicacion-exito-1280x800.png)

## Cómo ejecutar

Si ya está funcionando, abrir `http://127.0.0.1:3001/` o `/anuncios` y recargar con Ctrl + F5.

Si está detenido, iniciar MySQL en XAMPP y ejecutar:

```powershell
cd C:\xampp\htdocs\AnuncioSur
npm.cmd start
```

El frontend queda compilado. Después de futuras ediciones se puede ejecutar `npm.cmd run build`. Para desarrollo, `npm.cmd run dev`.

## Pendiente de contenido y validación con usuarios

El catálogo conserva sus anuncios DEMO y varias ilustraciones de ejemplo. No se sustituyeron fotos ni se borraron publicaciones de prueba. Para una presentación comercial convendría preparar fotografías propias y ejemplos completos de distintas categorías. La facilidad de uso para personas no lectoras todavía necesita validación con usuarios; no se presenta como una capacidad demostrada. No se incorporaron instrucciones de audio ni traducciones nuevas.
