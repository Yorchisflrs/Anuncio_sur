# Calidad y métricas web · Práctica 10

Medición con Lighthouse de AvisoSur, mejoras con su número y pruebas automáticas en GitHub. Fecha: 10 de noviembre de 2026.

## Cómo se midió

- **Herramienta:** Lighthouse 13.6.0 desde la consola, el mismo motor de la pestaña Lighthouse de Chrome 157.
- **Modo celular:** Moto G Power emulado, 4G lenta simulada y procesador cuatro veces más lento. No se usó el modo escritorio.
- **Corridas:** cada página se midió tres veces y se informa la corrida mediana tal cual, sin redondear.
- **Servidor:** la compilación de producción (`npm run build` y `npm start`) en `localhost`, con SQLite y datos de prueba: los 16 avisos de ejemplo y un cuarto en alquiler publicado por un vendedor verificado.
- **Evidencia:** los reportes completos están en [evidencias/lighthouse](evidencias/lighthouse). Se abren en el navegador. Todas las cifras de cada paso están en [mediciones.json](evidencias/lighthouse/mediciones.json).

Para repetir una medición:

```powershell
npm run build
npm start
npx lighthouse http://127.0.0.1:3001/anuncios --view
```

## Parte 1 · Medir

Se midieron dos páginas del recorrido: el **catálogo** (`/anuncios`), que es la que más se usa, y el **detalle de un aviso** (`/anuncios/17`), que es la que más carga porque abre con la foto. También se midió la portada.

| Página | Rendimiento | Accesibilidad | Prácticas | SEO | LCP | CLS | TBT |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/anuncios` · catálogo | 99 | 100 | 100 | 92 | 1,66 s | 0,039 | 62 ms |
| `/anuncios/17` · detalle | 65 | 100 | 100 | 92 | 6,21 s | 0,236 | 39 ms |
| `/` · portada | 99 | 100 | 100 | 92 | 1,66 s | 0,000 | 85 ms |

Reportes: [catálogo](evidencias/lighthouse/antes-catalogo.html) y [detalle](evidencias/lighthouse/antes-detalle.html).

### Hallazgos

| # | Auditoría | Elemento que señala | Nota o métrica que mueve |
| --- | --- | --- | --- |
| 1 | El detalle salta mientras carga (*Avoid large layout shifts*) | `footer.site-footer`, y en el catálogo `div.catalog-layout` | CLS 0,236 en el detalle y 0,039 en el catálogo |
| 2 | La foto principal tarda en aparecer (*LCP request discovery*, *Render-blocking requests*) | `div.gallery-main > img`; el JS de 439 KB y el CSS de 183 KB viajaban sin comprimir | LCP 6,21 s en el detalle; rendimiento 65 |
| 3 | *robots.txt is not valid* | `/robots.txt` no existía y el servidor respondía con la página de la aplicación | SEO 92 en las tres páginas |

Otros diagnósticos que no bajaban la nota: 261 KiB de JavaScript sin usar, imágenes más pesadas que su tamaño en pantalla y, en la portada, botones de la galería de burbujas cuyo nombre accesible no coincide con su texto visible.

## Parte 2 · Proponer, arreglar y medir

### Las tres propuestas

| | Propuesta 1 | Propuesta 2 | Propuesta 3 |
| --- | --- | --- | --- |
| **Métrica** | SEO de las tres páginas | CLS del detalle y del catálogo | LCP y rendimiento del detalle |
| **Hoy** | 92 | 0,236 y 0,039 | 6,21 s · 65 |
| **Meta** | 100 | menos de 0,1 | menos de 2,5 s · 90 o más |
| **Qué cambiar** | Un `robots.txt` de verdad en `frontend/public/` | Reservar el alto mientras carga (`States.tsx`, `styles.css`) y dibujar las categorías desde el principio (`ExplorePage.tsx`, `data/directory.ts`) | Comprimir y cachear el JS y el CSS (`backend/src/static.mjs`), precargar la foto, aligerar las imágenes decorativas y cargar aparte las páginas con sesión (`App.tsx`) |
| **Cuánto cuesta** | 10 minutos | 40 minutos | 3 horas |
| **Después** | 100 | 0,000 y 0,002 | 2,64 s · 97 |

### Antes y después de cada cambio

Cada fila es un commit en la rama `calidad/lighthouse`, medido en la misma página y en el mismo modo.

| Paso y commit | Detalle: rendimiento · SEO · LCP · CLS | Catálogo: rendimiento · SEO · LCP · CLS |
| --- | --- | --- |
| Antes | 65 · 92 · 6,21 s · 0,236 | 99 · 92 · 1,66 s · 0,039 |
| 1 · `robots.txt` (`fe62ada`) | 65 · **100** · 6,20 s · 0,236 | 99 · **100** · 1,66 s · 0,039 |
| 2 · Sin saltos al cargar (`03b8680`) | **77** · 100 · 6,20 s · **0,000** | 99 · 100 · 1,66 s · **0,002** |
| 3 · Brotli y caché (`9210576`) | **89** · 100 · **3,80 s** · 0,000 | **100** · 100 · **0,91 s** · 0,002 |
| 4 · Foto precargada e imágenes livianas (`3fb6715`) | **95** · 100 · **2,92 s** · 0,000 | no se volvió a medir en este paso |
| 5 · Páginas con sesión aparte (`562e6a5`) | **97** · 100 · **2,64 s** · 0,000 | 100 · 100 · 0,91 s · 0,002 |

Reportes finales: [catálogo](evidencias/lighthouse/despues-catalogo.html) y [detalle](evidencias/lighthouse/despues-detalle.html).

### Resultado final

| Página | Rendimiento | Accesibilidad | Prácticas | SEO | LCP | CLS | TBT |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/anuncios` · catálogo | 99 → **100** | 100 | 100 | 92 → **100** | 1,66 → 0,91 s | 0,039 → 0,002 | 62 → 44 ms |
| `/anuncios/17` · detalle | 65 → **97** | 100 | 100 | 92 → **100** | 6,21 → 2,64 s | 0,236 → 0,000 | 39 → 9 ms |
| `/` · portada | 99 → **100** | 100 | 100 | 92 → **100** | 1,66 → 0,91 s | 0,000 | 85 → 67 ms |

### Lo que no funcionó a la primera

- **Las categorías en una sola fila no bajaron el CLS del catálogo.** Lighthouse culpaba a la fuente Inter. Se agregó una fuente de respaldo con sus medidas y el CLS siguió en 0,039. Al registrar los saltos en Chrome se vio la causa real: debajo de 600 px las categorías son una grilla de dos columnas que pasaba de una fila a dos al llegar de la API. Se dibujan desde el principio y el CLS bajó a 0,002.
- **Precargar la foto movió poco el LCP: de 3,80 a 3,66 s.** La auditoría de descubrimiento pasó a estar bien, pero la simulación de Lighthouse cuenta todos los bytes que llegan antes de pintar la foto. Lo que sí lo movió fue aligerar el paisaje decorativo, que se pedía con prioridad alta y pesaba 95 KB, y cargar aparte las páginas con sesión.
- **Mandar los datos del aviso dentro del HTML no cambió nada.** Con y sin ellos salió 95 y 2,93 s, así que se quitaron para no sumar complejidad.

### Pruebas nuevas

`backend/test/rnf01-compresion.test.mjs` tiene 9 pruebas: Brotli, gzip, sin compresión, caché de un año para lo que tiene hash, 304 con el ETag, `robots.txt`, que no se pueda salir de la carpeta, la precarga solo para avisos públicos y el escape del atributo.

## Parte 3 · Las pruebas corren solas en GitHub

- **Archivo:** [.github/workflows/pruebas.yml](../.github/workflows/pruebas.yml).
- **Cuándo:** en cada push y en cada pull request.
- **Dónde:** Ubuntu limpio con Node 24.
- **Qué corre:** `npm ci`, `npm test` y `npm run build`.
- **Base de datos:** no hace falta. Las pruebas usan SQLite y carpetas temporales, y la de MySQL solo corre con `AVISOSUR_TEST_MYSQL=1`.
- **Corridas:** https://github.com/Yorchisflrs/Anuncio_sur/actions/workflows/pruebas.yml

## Qué falta

- **El detalle está en 97, no en 100.** Lighthouse estima un LCP de 2,64 s en 4G lenta, aunque en esta computadora sin limitar la foto aparece en 0,3 s. Antes de pintarla todavía llegan el JS principal (346 KB, 108 KB con gzip), cinco pesos de la fuente Inter (125 KB) y el CSS (183 KB, de los que unos 150 KB no se usan en esa página).
- **Quitar los pesos 500 y 800 de Inter subiría el detalle a 98, con LCP de 2,33 s.** Se midió, pero no se aplicó, porque cambia el grosor del logotipo y de tres textos pequeños. Lo decide el equipo.
- **Lo siguiente con más efecto sería dividir el CSS por página** o dibujar el detalle desde el servidor. Cuesta más que todo lo anterior junto.
- **Accesibilidad 100 en Lighthouse no cubre todo.** Falta revisar a mano el uso con teclado y con lector de pantalla, y el aviso de las burbujas de la portada.
- **Falta medir en un celular real y con una red real,** incluido el RNF-04 (menos de 4 s en 3G).
