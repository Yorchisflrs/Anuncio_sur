# Levantamiento de observaciones · Práctica 9

Respuesta del equipo de AvisoSur a las observaciones de la Práctica 9 (integración, aceptación y Git), revisadas el 2 de noviembre de 2026. Para cada observación se indica qué se cambió, dónde se ve y con qué prueba se comprueba. Lo que todavía depende del equipo o de otra mesa se marca como pendiente.

Fecha de este documento: 8 de noviembre de 2026.

## Cómo se entregó

Los cambios están en cuatro ramas, cada una con su pull request hacia `main`, y en commits pequeños, uno por observación:

| Rama | Contenido | Commits |
| --- | --- | --- |
| `test/pruebas-por-requisito` | Pruebas separadas por requisito y orden del repositorio | 2 |
| `fix/observaciones-diseno` | Observaciones de diseño | 5 |
| `feat/vendedor-verificado-y-reportes` | Novedad propuesta: vendedor verificado y reporte de estafa | 6 |
| `docs/acta-y-evidencias` | Acta, guía de entrevistas, evidencias y documentación | 2 |
| `mejora/nota-validador` | Cuenta demo sin contraseña en el código y prueba del recorrido completo | 3 |

Cada rama parte de la anterior. Fusionadas en ese orden, `main` queda con los 18 commits.

## Resumen

| Observación | Estado | Evidencia |
| --- | --- | --- |
| Hay ramas, pero no hay merge | Levantada | PR #2 y PR #3 fusionados; los commits de `nelsoncaisa07` y `promclaudio` están en `main` |
| No hay historia | Levantada desde ahora | 15 commits pequeños en 4 ramas con PR (no se reescribe el historial anterior) |
| El aporte de dos integrantes es cosmético | **Pendiente del equipo** | Propuestas listas en [Pendiente del equipo](#pendiente-del-equipo) |
| Pocas pruebas: una prueba con 17 pasos | Levantada | 102 pruebas en 11 archivos; [reporte JUnit](evidencias/pruebas-automatizadas.xml) |
| No está el acta de aceptación | Acta lista; **falta que otra mesa la ejecute** | [ACTA_ACEPTACION.md](ACTA_ACEPTACION.md) |
| GET /api/anuncios/:id entrega el celular | Levantada | `rf04-contacto.test.mjs` |
| Innovación: la novedad propuesta | Levantada (partes 1 a 6) | `novedad-celular-verificado.test.mjs`, `novedad-reportes.test.mjs` |
| Diseño: 8 observaciones | Levantadas | Capturas en [screenshots/observaciones-p9](screenshots/observaciones-p9) |
| Precios: «Hoy no hay precios» | Levantada (desde el PR #3) | Planes configurables y pago manual con Yape |
| Entrevistas antes de programar más | **Pendiente del equipo** | Guía lista en [ENTREVISTAS.md](ENTREVISTAS.md) |

## Lo que faltaba respecto a lo pedido

### Hay ramas, pero no hay merge

- `mejoras-visuales-logo-tipografia` (`promclaudio`) entró a `main` con el PR #2.
- `feat/nelson-fondo` (`nelsoncaisa07`) entró a `main` con el PR #3, porque la rama de pagos partió de ella. Sus commits `5c9c79d` y `5584d56` están en `main`.
- Las correcciones de esta entrega usan el mismo flujo de rama y pull request.

### No hay historia

El commit inicial de 235 archivos no se reescribe: hacerlo obligaría a forzar la subida y a cambiar las copias de todo el equipo. Desde esta entrega, cada observación tiene su propio commit con una explicación del motivo.

### El aporte de dos integrantes es solo de colores, fondo y logo

**Pendiente.** Requiere que `nelsoncaisa07` y `promclaudio` implementen, cada uno en su rama, una función del sistema con su prueba. Nadie más puede hacerlo por ellos. Abajo hay propuestas concretas para que empiecen sin esperar.

### Pocas pruebas: una sola prueba grande

`api.test.mjs` tenía una prueba con 17 pasos encadenados. Ahora hay **102 pruebas** en 11 archivos. Cada caso prepara sus propios datos y no depende del orden, salvo el recorrido completo, que a propósito sigue los escenarios del acta como una sola historia. Todas levantan el servidor real con `listen(0)`, hacen pedidos HTTP con `fetch` y usan una base SQLite temporal.

| Archivo | Requisito | Pruebas |
| --- | --- | --- |
| `rf01-cuenta.test.mjs` | RF-01 Cuenta y acceso; RNF-03 límite de intentos y cuenta demo sin contraseña conocida | 13 |
| `rf02-publicacion.test.mjs` | RF-02 Publicación, fotos, venta o alquiler, nombre del vendedor | 15 |
| `rf03-busqueda.test.mjs` | RF-03 Consulta, filtros, orden, paginación, persistencia | 12 |
| `rf04-contacto.test.mjs` | RF-04 Contacto a pedido y límite por persona | 8 |
| `novedad-celular-verificado.test.mjs` | Novedad: celular verificado e insignia | 11 |
| `novedad-reportes.test.mjs` | Novedad: reporte de estafa y moderador | 11 |
| `moderation.test.mjs` | Publicación pagada, pago manual, planes y vigencia | 16 |
| `integracion-recorrido.test.mjs` | Integración: un cuarto en alquiler de la cuenta nueva a la decisión del moderador (CA-01 a CA-12) | 12 |
| `migration.test.mjs`, `mysql.test.mjs` | Migración y consultas MySQL | 3 |
| `mysql-integration.test.mjs` | Integración con MySQL/MariaDB (opcional) | 1 |

`npm test` ejecuta todo; `npm run test:reporte` genera además [evidencias/pruebas-automatizadas.xml](evidencias/pruebas-automatizadas.xml). Las pruebas ya no reescriben `docs/acceptance-results.json`, que no era un acta.

### No está el acta de aceptación

[ACTA_ACEPTACION.md](ACTA_ACEPTACION.md) tiene 12 escenarios Dado/Cuando/Entonces, incluidos los dos que pidió el profesor: un comprador real que reporta un aviso falso y un vendedor real que verifica su celular, en pantalla. **Falta que otra mesa la ejecute y la firme.** El equipo no puede llenar los resultados por ella.

## Cuidado con esto: el celular

`GET /api/anuncios/:id` entregaba el celular a cualquiera. Además, el catálogo `GET /api/anuncios` incluía el campo `contacto` de cada aviso, así que una sola consulta reunía muchos números.

- El detalle y el catálogo públicos ya no incluyen celular, contacto ni enlace de WhatsApp.
- `GET /api/anuncios/:id/contacto` lo entrega al pulsar «Ver contacto del vendedor», con un límite de 20 pedidos cada 15 minutos por persona (cuenta o IP).
- El vendedor ve en su perfil cuántas personas pidieron su contacto. De quien lo pide se guarda solo un hash, nunca el IP.

## Innovación: la novedad propuesta

Se eligió la propuesta del profesor, **vendedor verificado y reporte de estafa**, y se implementaron sus seis partes. Las ideas «precio justo por zona» y «búsquedas guardadas» no se hicieron porque la indicación fue elegir una.

| Parte | Implementación | Pruebas del profesor |
| --- | --- | --- |
| 1. Celular verificado | `usuarios.celular_verificado` y `fecha_verificacion`. El código de 6 dígitos se guarda como hash, vence en 24 h y admite 5 intentos. Sin verificar se puede mirar, pero no publicar. | Usuario sin verificar intenta publicar → **403**; código equivocado → **422** |
| 2. Insignia visible | «Celular verificado» en tarjetas, lista y detalle, junto a «Miembro desde», con avisos publicados y dados de baja | Insignia en catálogo y detalle |
| 3. Reportar este aviso | `POST /api/anuncios/:id/reportes` con motivos fijos y `UNIQUE(anuncio_id, usuario_id)` | La misma persona reporta dos veces → **409** |
| 4. Revisión automática | Con 3 reportes de cuentas verificadas distintas, el aviso se oculta del catálogo | Dos reportes → sigue en el catálogo; el tercero de otra cuenta → **ya no aparece en /api/anuncios** |
| 5. Celular solo al hacer clic | `GET /api/anuncios/:id/contacto` con límite por persona y conteo de interesados | `GET /api/anuncios/:id` **ya no trae el celular** |
| 6. Página del moderador | Pestaña «Reportes»: restaurar el aviso (con los días que estuvo oculto) o darlo de baja; los reportes pasan a «revisado» | Restaurar, dar de baja, permisos |

Dos decisiones de diseño que conviene explicar:

- **El código se envía por WhatsApp, no por SMS.** Un proveedor de SMS cuesta dinero y necesita claves que el proyecto no tiene. El servidor genera el código y administración lo envía con un botón que abre WhatsApp con el mensaje escrito, igual que ya confirma los pagos de Yape. Quien escribe el código demuestra que controla el número. Más adelante se puede cambiar por SMS sin tocar el resto. Administración también puede **verificar en persona**, como se sugiere para los arrendadores.
- **«En revisión» es una columna, no un estado nuevo.** Ampliar el CHECK de `anuncios.estado` obliga en SQLite a reconstruir la tabla, con riesgo para los datos. La columna aditiva `revision_reportes` se filtra en `publicCondition`, la regla única del catálogo, y el aviso desaparece igual.

## El diseño

| Observación | Qué se hizo | Captura |
| --- | --- | --- |
| Mucha frase y poca información | Titular: «Motos, cuartos y electrodomésticos en Puno y Juliaca», con el número de avisos. Se quitaron las frases sin información, y la barra superior y el pie ya no se repiten. | `01-portada` |
| El catálogo abre en «Burbuja» | `/anuncios` abre en una **lista** con todos los avisos de la página y el precio alineado; también se puede ver en tarjetas. La burbuja queda solo en la portada. | `02-catalogo-lista`, `03-catalogo-celular` |
| No se distingue alquiler de venta | Campo «¿Lo vendes o lo alquilas?», precio «S/ 950 al mes» y filtro de venta o alquiler. Los tres alquileres DEMO del seed quedaron marcados. | `04-detalle-alquiler-insignia`, `10-publicar-fotos-y-operacion` |
| El nombre del vendedor sale de su correo | Se pide un **nombre para mostrar** al registrarse; las cuentas anteriores se muestran como «Vendedor de AvisoSur», nunca con su correo | `07-registro-nombre-para-mostrar` |
| Categorías que no existen | Se quitaron las cuatro tarjetas «Próximamente» | `06-categorias-sin-proximamente` |
| Textos de prototipo | Se quitaron «comprueba que el servidor esté iniciado», «Reclamaciones · Prototipo» y la promesa de respuesta en 15 días | `14-ayuda-sin-textos-de-prototipo` |
| La cuenta demo en la pantalla de ingreso | El botón ya no existe y la cuenta demo ya no tiene una contraseña escrita en el código: recibe una clave aleatoria al crear la base. Además, la cuenta demo tiene un número ficticio y no se puede verificar, así que **no puede publicar** como «Vendedor de demostración». | Prueba en `rf02-publicacion.test.mjs` |
| Fotos: solo JPG o PNG de hasta 2 MB | JPG, PNG, WebP y HEIC de hasta 10 MB. El navegador reduce las fotos grandes antes de subirlas y el servidor las deja en 1600 px WebP. | `10-publicar-fotos-y-operacion` |

## ¿Quién lo usaría y cómo se vende?

- **Precios.** Desde el PR #3 hay planes configurables por administración, con pago manual por Yape: en la base local, diario a S/ 1 y semanal a S/ 5 con días extra en la primera publicación. Buscar sigue siendo gratis.
- **Nicho.** La portada ofrece «Cuartos en alquiler en Puno» y el catálogo filtra alquileres. La insignia y los reportes atienden el miedo a pagar un adelanto por un cuarto que no existe.
- **Entrevistas.** **Pendiente del equipo.** [ENTREVISTAS.md](ENTREVISTAS.md) tiene la guía con las preguntas del profesor, la muestra (5 estudiantes, 3 arrendadores, 1 tienda de motos) y una tabla para registrar respuestas. No se completa con respuestas supuestas.

## Lista «Para el viernes 6»

- [x] Hacer merge de las dos ramas a `main`.
- [ ] Que `nelsoncaisa07` y `promclaudio` tengan cada uno una función del sistema en su rama, con su prueba. **Pendiente del equipo.**
- [x] Partir `api.test.mjs` en una prueba por requisito.
- [ ] El acta de aceptación en el repositorio. **Plantilla lista; falta que otra mesa la ejecute y la firme.**

## Pendiente del equipo

Funciones propuestas para `nelsoncaisa07` y `promclaudio`. Cada una toca backend, frontend y pruebas, y no choca con lo ya hecho:

1. **Editar un aviso pendiente u observado.** `PATCH /api/anuncios/:id`, solo para el propietario y solo si el aviso todavía no fue aprobado. Pruebas: otro usuario → 403; aviso aprobado → 409; propietario → 200 con título y precio cambiados.
2. **Volver a publicar un aviso vencido.** `POST /api/anuncios/:id/renovar` crea una nueva solicitud de pago con los mismos datos y fotos. Pruebas: solo el propietario; solo avisos vencidos; la nueva solicitud queda pendiente.
3. **Búsquedas guardadas** (idea 2 del profesor). Tabla `busquedas_guardadas`, reutiliza `parseFilters` y `getCatalog`; el perfil muestra cuántos avisos nuevos hay desde la última visita. Pruebas: guardar, listar y contar avisos nuevos.

Cada integrante crea su rama desde `main`, hace commits con su propia cuenta y abre su pull request.

## Cómo comprobarlo

```powershell
npm.cmd test                 # 102 pruebas (la de MySQL se activa con AVISOSUR_TEST_MYSQL=1)
npm.cmd run test:reporte     # además genera docs/evidencias/pruebas-automatizadas.xml
npm.cmd run benchmark        # RNF-01: 500 avisos públicos y 50 clientes concurrentes
npm.cmd run check            # TypeScript
npm.cmd run build            # compilación de producción
```

Los resultados de la última ejecución están en [VALIDACION.md](VALIDACION.md).
