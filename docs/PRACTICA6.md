# Práctica 6 — Del boceto al prototipo

La pantalla funcional es /publicar del proyecto AvisoSur existente. Conserva el formulario, la vista previa y el guardado real. En la numeración del proyecto, RF-01 es cuenta y acceso; RF-02 es publicación. La entrega del 26 de octubre de 2026 añade el escaparate giratorio y el fondo compartido: [estado final y pruebas](ENTREGA_FINAL.md).

| Bloque | Archivo | Objeto del modelo | Requisito |
| --- | --- | --- | --- |
| Cabecera | frontend/src/components/Layout.tsx, Logo.tsx, frontend/public/logo-avisosur.jpg | Usuario (sesión para el enlace al perfil) | RF-01 |
| Migas de navegación | frontend/src/pages/PublishPage.tsx | — (navegación) | — |
| Contenido del formulario | frontend/src/pages/PublishPage.tsx, frontend/src/services/validation.ts | Anuncio, Categoría, Foto y Usuario autenticado | RF-01, RF-02 |
| Botón principal | frontend/src/pages/PublishPage.tsx, backend/src/app.mjs | Anuncio y Foto, asociados al Usuario | RF-01, RF-02 |
| Mensaje de estado | frontend/src/pages/PublishPage.tsx | Anuncio publicado (id devuelto por la API) | RF-02 |
| Pie de página | frontend/src/components/Layout.tsx | — (contenido institucional) | — |

La identidad usa el logo oficial sin deformación y colores, tipografías (Inter y Segoe UI) y espaciado de 8 px definidos en frontend/src/styles.css. El rediseño del 20 de octubre de 2026 conserva estos seis bloques. El botón de publicar utiliza el acento naranja; la cabecera, las secciones numeradas, los campos y la vista previa comparten el sistema visual de la aplicación.

Verificación actual: compilación correcta y 20 pruebas existentes aprobadas. En Chrome a 1280 × 800 se realizaron dos pulsaciones consecutivas para publicar un anuncio ficticio con foto y precio S/ 1. Apareció debajo del botón “Tu anuncio se publicó correctamente.”, el botón quedó deshabilitado y se guardaron exactamente un anuncio y una foto. El enlace abrió la ficha guardada.

Esta última prueba utilizó la API real y el frontend compilado con una base temporal aislada, sin añadir datos a MySQL. La aplicación real se comprobó conectada a avisosur_db con sus 20 anuncios conservados.

- [Captura real después de publicar](screenshots/redesign/burbuja-publicacion-exito-1280x800.png)
- [Resultado actual de publicación y doble pulsación](bubble-publication-validation.json)
- [Revisión completa del rediseño](REDISENO_VISUAL.md)

Para repetir la demostración: inicia MySQL y ejecuta npm.cmd start en C:\xampp\htdocs\AnuncioSur. Abre http://127.0.0.1:3001/publicar, inicia sesión con Rellenar datos de demostración, completa los campos y usa una imagen propia o Usar imagen de demostración. Esta ejecución normal sí guarda en la base configurada.
