# Validación ejecutada de AvisoSur

Fecha: 13 de octubre de 2026 (America/Lima). Entorno: Windows, Node v24.16.0, Intel Core i5-1235U. Los resultados crudos contienen fecha UTC y métricas reproducibles.

## Compilación y ejecución

- `npm install`: dependencias instaladas; `package-lock.json` generado.
- `npm run build`: TypeScript sin errores y compilación de producción de Vite correcta.
- `npm run dev`: API en `127.0.0.1:3001` y Vite en `127.0.0.1:5173`, con proxy funcional.
- Frontend compilado servido por Express y acceso directo a las rutas. La última carga de la versión compilada verificó acceso y cierre de sesión, con cero errores de consola durante ese recorrido.

## Escenarios de integración

17 escenarios correctos, cero fallos. Node Test Runner cuenta además la prueba contenedora: 18 pruebas aprobadas. Se usa una base y una carpeta temporal aisladas; se comprueba persistencia reabriendo SQLite.

| Escenario | Resultado |
| --- | --- |
| Datos iniciales: 16 anuncios y tres categorías | correcto |
| Registro, hash bcrypt y cookie HttpOnly | correcto |
| Registro inválido y datos duplicados | correcto |
| Inicio de sesión por correo y celular; errores comprensibles | correcto |
| Publicación y perfil protegidos; rechazo de origen ajeno | correcto |
| Publicación por S/ 1, tres fotografías y objetivo de cinco segundos | correcto |
| Precio S/ 0 y categoría vacía no guardan anuncios ni fotos | correcto |
| Fotografía, descripción y zona obligatorias | correcto |
| Rechazo de archivos falsos, cuatro fotos y más de dos MB | correcto |
| Rango inclusivo: Vehículos entre S/ 0 y S/ 5000 | correcto |
| Filtros combinados, subcategoría y búsqueda sin tildes | correcto |
| Sin coincidencias y texto SQL tratado como dato | correcto |
| WhatsApp: prefijo 51 y mensaje exacto, sin enviar mensajes | correcto |
| Baja exclusiva del propietario y conservación del registro | correcto |
| Persistencia al reiniciar y seed idempotente | correcto |
| Cerrar sesión revoca el token y protege el perfil | correcto |
| Las publicaciones de la cuenta demo mantienen su identificación ficticia | correcto |

La publicación HTTP de un anuncio a **S/ 1 con tres fotografías** tardó **57.88 ms** en la última ejecución, inferior al objetivo de 5000 ms en este entorno. La medición va desde el envío multipart hasta la recepción y lectura de la respuesta; incluye validación, recodificación y persistencia. No mide el tiempo que la persona dedica a completar el formulario.

## RNF-01: búsqueda concurrente

500 anuncios activos, 50 clientes virtuales concurrentes y diez consultas secuenciales por cliente, con 25 solicitudes de calentamiento. El cliente y la API se ejecutan en esta computadora por HTTP loopback.

| Métrica | Resultado |
| --- | --- |
| Solicitudes | 500 |
| Errores | 0 |
| Mediana | 51.77 ms |
| Percentil 95 | 73.6 ms |
| Percentil 99 | 80.49 ms |
| Máximo | 82.59 ms |
| Objetivo | Menos de 2000 ms |
| Resultado local medido | Cumplido en esta ejecución |

El plan de consulta usa `idx_catalogo` para estado, categoría y precio. No se extrapola el resultado a tráfico real, conexiones 3G ni otros dispositivos.

## Verificación de interfaz en Edge

- Registro ficticio y redirección al perfil; acceso por celular y con cuenta demo.
- Protección de `/publicar`, retorno a publicar después del acceso y cierre de sesión con retorno al inicio.
- Filtros Vehículos, mínimo 0 y máximo 5000: moto de exactamente S/ 5000 y mototaxi de S/ 4800.
- Filtros combinados con Puno: únicamente la moto correspondiente.
- Búsqueda sin coincidencias: mensaje exacto **No hay anuncios con esos filtros** y sugerencia de ampliar filtros.
- Publicación desde la UI por S/ 1 con tres PNG de muestra, confirmación debajo del botón y enlace al detalle; comprobación posterior en el catálogo.
- Error por categoría vacía y S/ 0: título, descripción, zona y foto permanecen.
- Galería: selección de la tercera foto y contador 3/3.
- Perfil: baja del anuncio de prueba, registro conservado y exclusión del catálogo. Permanecen los 16 anuncios iniciales activos.
- Botón de WhatsApp: abrió una nueva pestaña con `phone=51900000000` y el mensaje esperado, comprobado en la URL resultante.
- Diseño móvil a 390 × 844 y tablet a 768 × 1024, menú y filtros móviles funcionales y sin desborde horizontal. El ancho de contenido descuenta la barra de desplazamiento de Edge.

## Límites de la verificación

La extensión de Edge no tiene permiso de acceso a URLs de archivos; el selector de archivos local no se pudo automatizar. La carga multipart JPG/PNG, cantidad, tamaño y contenido se verificaron en las pruebas HTTP. La vista previa, envío y persistencia de la UI se verificaron usando el botón **Usar imagen de demostración**, que entrega un PNG local al mismo flujo real. La selección manual de archivos usa el selector habitual del navegador.

La revisión automática bloqueó la lectura de la pestaña de WhatsApp porque podría exponer una sesión privada. Se verificaron la apertura, el teléfono y el texto de la URL; no se inspeccionó una cuenta ni se envió un mensaje.

RNF-02 (98% durante 30 días) y la medición RNF-04 (menos de cuatro segundos en 3G) permanecen pendientes. El logo y las imágenes de los anuncios iniciales son marcadores/ilustraciones temporales de demostración.

## Evidencias

- [Resultados de aceptación](acceptance-results.json)
- [Prueba de carga](benchmark-results.json)
- [Inicio de escritorio](screenshots/inicio-desktop.jpg)
- [Inicio completo](screenshots/inicio-completo.jpg)
- [Catálogo móvil](screenshots/catalogo-movil.jpg)
- [Catálogo tablet](screenshots/catalogo-tablet.jpg)

Para repetir las pruebas: `npm test` y `npm run benchmark`.
