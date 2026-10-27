# Portada con paisaje y degradado

Actualización del 20 de octubre de 2026 en el proyecto existente `C:\xampp\htdocs\AnuncioSur`.

Se sustituyó el fondo casi blanco del inicio por un paisaje decorativo inspirado en el lago Titicaca, con un degradado azul marino que conserva la lectura del título, el buscador y las acciones. El título usa blanco y turquesa; las tarjetas conservan las fotos, precios y enlaces del catálogo. Se retiró el panel azul claro con palabras de fondo. La carga del contenido principal es inmediata.

El fondo ahora pertenece a toda la página de inicio. Una sola imagen y su degradado quedan fijos al viewport mientras se recorren categorías, anuncios recientes, beneficios, localidades, pasos y la acción final de publicar. Las secciones grandes son transparentes; categorías, filtros y directorio utilizan paneles azules translúcidos y textos claros. Las fotos y los datos de las tarjetas de producto se conservan. Al navegar a otra página se retira esta capa. No se añaden listeners de scroll ni nuevas dependencias.

Los colores del nuevo fondo están centralizados en las variables `--hero-*` de `frontend/src/styles.css`. Se ajustaron las separaciones entre tarjetas y los saltos del título en tablet. No se modificaron el logo, las rutas, la API, la autenticación ni la base de datos; tampoco se instalaron dependencias.

## Archivos

| Archivo | Cambio |
| --- | --- |
| `frontend/src/pages/HomePage.tsx` | Contenedor de inicio completo e imagen decorativa local con dimensiones y prioridad de carga. |
| `frontend/src/components/HeroShowcase.tsx` | Etiqueta regional, sin el panel claro anterior. |
| `frontend/src/styles.css` | Fondo fijo, degradado, contraste, superficies translúcidas y composición responsive, limitados a `.home-page`. |
| `frontend/public/images/avisosur-titicaca-hero.webp` | Fondo de 1672 × 941 px, 97 466 bytes (95,2 KiB). |

## Verificación

La ampliación del fondo se verificó desplazando realmente la página a siete secciones en cuatro tamaños: 1280 × 800, 768 × 1024, 390 × 844 y 375 × 812. La imagen y el degradado mantienen la misma posición en el viewport durante las 28 comprobaciones. Se verificaron el filtro real de categoría, las fichas y el enlace al catálogo; los 20 anuncios existentes permanecieron intactos. Compilación correcta en workspace y XAMPP.

- [Resultado del fondo continuo](continuous-background-validation.json)
- [Categorías y anuncios a 1280 × 800](screenshots/redesign/fondo-continuo-categorias-1280x800.png)
- [Beneficios al bajar](screenshots/redesign/fondo-continuo-beneficios-1280x800.png)
- [Categorías en móvil](screenshots/redesign/fondo-continuo-categorias-390x844.png)

La revisión inicial del fondo de portada compiló correctamente con TypeScript y Vite en el workspace y en XAMPP. Esa versión se comprobó en `http://127.0.0.1:3001/` a 1440 × 900, 1280 × 800, 1100 × 850, 1024 × 768, 900 × 900, 768 × 1024, 601 × 960, 390 × 844 y 375 × 812. Sin desbordamientos horizontales, imágenes fallidas, tarjetas recortadas ni superposición entre tarjetas. Consola sin errores.

Se comprobó la búsqueda de una refrigeradora en Juliaca usando el anuncio existente, apertura de fichas, acciones de explorar y publicar, menú móvil, navegación y preferencia de movimiento reducido. El catálogo MySQL conservó exactamente sus 20 anuncios. Esta revisión no publicó anuncios nuevos.

- [Resultados](hero-validation.json)
- [Captura real a 1280 × 800](screenshots/redesign/fondo-inicio-1280x800.png)
- [Captura real a 1440 × 900](screenshots/redesign/fondo-inicio-1440x900.png)
- [Captura móvil](screenshots/redesign/fondo-inicio-390x844.png)
- [Página completa](screenshots/redesign/fondo-inicio-1440-completa.png)

## Procedencia del fondo

Imagen decorativa generada con la herramienta integrada `imagegen`; no representa un registro documental de un lugar exacto. El original se conserva en el directorio de imágenes generadas de Codex y se exportó a WebP con `sharp`, dependencia que ya tenía el proyecto. El archivo consumido por la web está dentro de `frontend/public/images/` y no depende de servicios externos.

Prompt utilizado:

> Create one polished website hero background image, ultra-wide landscape composition (roughly 16:9). Use-case: photorealistic-natural editorial landscape, used behind real HTML typography and marketplace listing cards for AvisoSur, a local marketplace in Puno in southern Peru. Scene: an atmospheric panoramic view inspired by the shores of Lake Titicaca at blue hour, calm expansive water reflecting a delicate pale-gold horizon, layered Andean mountains in the far distance, the shore and a small part of Puno's hillside urban fabric along the lower right. Sophisticated photographic realism, nuanced natural texture, rich cobalt and midnight blue with luminous restrained turquoise reflections and a warm thin sunset glow. The lake and recognizable layered mountain silhouette should be clearly visible, not abstract. Composition: upper and left 55 percent should be calm dark blue open sky and water with very little detail, for large white heading and search control that will be added in code; scene detail concentrated along right third and bottom, horizon at about 58 percent of image height. Wide, elegant, airy, high-end editorial art direction. No people, no products, no floating objects, no UI, no cards, no text, no letters, no logo, no watermarks, no star field, no fantasy planets, no circular orbital lines. This is only a decorative background, not a screenshot or a website mockup.

## Ejecución

Con MySQL iniciado en XAMPP:

```powershell
cd C:\xampp\htdocs\AnuncioSur
npm.cmd start
```

Abrir `http://127.0.0.1:3001/`. El frontend ya está compilado. Después de futuras ediciones, ejecutar `npm.cmd run build` antes de `npm.cmd start`.
