# Arquitectura de AvisoSur

Aplicación monolítica local con frontend separado. React consume la API REST de Express. Express valida los datos, consulta SQLite o MySQL según `DB_CLIENT` y guarda las imágenes WebP en disco. En desarrollo, Vite actúa como proxy; después de compilar, Express también entrega el frontend y resuelve las rutas de React Router.

## Modelo de datos

| Tabla | Campos principales y relaciones |
| --- | --- |
| `usuarios` | id, **nombre** para mostrar, correo único, celular único, password_hash, rol (`usuario`/`admin`), es_demo, **celular_verificado**, **fecha_verificacion**, **metodo_verificacion** (`codigo`/`presencial`), fecha_registro. |
| `verificaciones_celular` | usuario_id → usuarios, solicitado, codigo_hash (SHA-256), expira, intentos, enviado. Una fila por cuenta pendiente; se borra al verificar. |
| `categorias` | id, nombre, subcategorias (JSON) y activa. |
| `anuncios` | id, usuario_id → usuarios, categoria_id → categorias, título, descripción, precio (céntimos en SQLite, `DECIMAL` en MySQL), zona, subcategoría, **tipo_operacion** (`venta`/`alquiler`), estado (`activo`/`dado_de_baja`), moderación, estado del pago, plan, monto y días de vigencia, fechas de aprobación y vencimiento, dirección, referencia, contacto, comprobante, **revision_reportes** y **fecha_revision_reportes**. |
| `fotos` | id, anuncio_id → anuncios, archivo (ruta local o enlace HTTPS de hasta 2048 caracteres), orden de 0 a 6 y fecha_subida. |
| `reportes` | id, anuncio_id → anuncios, usuario_id → usuarios, motivo, **detalle**, fecha, estado (`pendiente`/`revisado`), **fecha_revision**, **revisado_por**, **resolucion**. Único por (anuncio_id, usuario_id). |
| `contactos_anuncio` | id, anuncio_id → anuncios, visitante (SHA-256 con sal de la instalación), fecha. Único por (anuncio_id, visitante). |
| `planes_publicacion` | id, nombre, precio, días, bono del primer anuncio, destacado y activo. |
| `sesiones` | token_hash (SHA-256 del token aleatorio), usuario_id → usuarios y expira. |
| `metadata` | Versiones del seed y de las migraciones, configuración del pago y sal de contactos. |

Las columnas en negrita se agregaron para las observaciones de la Práctica 9. `backend/src/migrations.mjs` las agrega al iniciar, tanto en SQLite como en MySQL, sin borrar ni reescribir datos; los mismos cambios están en `database/actualizar_observaciones_mysql.sql`. La única corrección de datos marca como alquiler los tres avisos DEMO del seed que lo son, una sola vez y solo en filas `es_demo = 1`.

### Cuándo un aviso es público

Una sola regla, `publicCondition` en `listings.mjs`, decide qué ve el público y se usa en el catálogo, los contadores de categorías, el detalle y el resumen de administración. Un aviso es público si está activo, aprobado, con pago confirmado, sin vencer, en una categoría activa y **no está oculto por reportes**. El propietario y administración pueden abrir sus avisos no públicos.

## API

Las respuestas de error tienen la forma `{ message, fields }`. Códigos principales: 401 sin sesión, 403 sin permiso u origen ajeno, 404 recurso inexistente o no público, 409 conflicto (duplicado o estado que no lo permite), 422 datos inválidos y 429 demasiados pedidos.

| Método y ruta | Acceso | Resultado |
| --- | --- | --- |
| GET `/api/health` | Público | Estado del servicio. |
| GET `/api/categorias` | Público | Categorías, subcategorías y avisos públicos por categoría. |
| GET `/api/auth/me` | Público | Usuario de la sesión o `null`. |
| POST `/api/auth/registro` | Público | Registra con nombre, correo, celular y contraseña; inicia sesión y deja pendiente la verificación del celular. |
| POST `/api/auth/login` | Público | Acceso con correo o celular. |
| POST `/api/auth/logout` | Público | Revoca la sesión. |
| PATCH `/api/perfil` | Cuenta | Cambia el nombre para mostrar. |
| GET `/api/perfil/anuncios` | Cuenta | Avisos propios, con su contacto y cuántas personas lo pidieron. |
| GET `/api/perfil/verificacion` | Cuenta | Estado de la verificación del celular. |
| POST `/api/perfil/verificacion` | Cuenta | Pide un código nuevo. |
| POST `/api/perfil/verificacion/confirmar` | Cuenta | Confirma el código (422 si es incorrecto, 429 tras 5 intentos). |
| GET `/api/anuncios` | Público | Catálogo paginado. Filtros: `q`, `categoriaId`, `subcategoria`, `tipo`, `zona`, `min`, `max`, `sort`, `page` y `limit`. Sin celulares. |
| GET `/api/anuncios/:id` | Público / propietario / admin | Detalle sin celular; el propietario y administración ven además el contacto y el pago. |
| GET `/api/anuncios/:id/contacto` | Público, con límite | Celular y enlace de WhatsApp de un aviso público; registra a la persona interesada. |
| POST `/api/anuncios` | Cuenta verificada | Crea una solicitud con fotos o enlaces (403 si el celular no está verificado). |
| PATCH `/api/anuncios/:id/baja` | Propietario | Da de baja el aviso y conserva el registro. |
| PATCH `/api/anuncios/:id` | Propietario | Edita título, descripción, precio, zona, venta/alquiler, dirección o referencia antes de la primera aprobación y si no está dado de baja; un rechazado vuelve a pendiente. |
| POST `/api/anuncios/:id/reportes` | Cuenta | Reporta un aviso público con un motivo fijo (409 si ya lo reportó). |
| GET `/api/publicacion` | Público | Planes activos y datos de pago. |
| GET `/api/publicacion/qr` | Público | Imagen del QR de pago. |
| POST `/api/anuncios/:id/comprobante` | Propietario | Adjunta el comprobante de pago. |
| POST `/api/anuncios/:id/renovar` | Propietario con celular verificado | Vuelve a publicar un aviso vencido: crea una solicitud nueva con los mismos datos y las mismas fotos en el mismo orden, pendiente de pago y revisión, y deja el anterior sin cambios. Acepta `planId` (por defecto, el plan 1). 409 si el aviso no venció, nunca se aprobó, está dado de baja u oculto por reportes, o si su categoría ya no está activa. |
| GET `/api/anuncios/:id/comprobante` | Propietario / admin | Imagen privada del comprobante. |
| GET `/api/admin/resumen` | Admin | Contadores de revisión, pagos, reportes y celulares sin verificar. |
| GET `/api/admin/anuncios` | Admin | Bandeja de revisión. |
| POST `/api/admin/anuncios/:id/aprobar` | Admin | Confirma el pago y aprueba (exige confirmación explícita). |
| POST `/api/admin/anuncios/:id/rechazar` | Admin | Rechaza con motivo. |
| GET `/api/admin/reportes` | Admin | Reportes pendientes agrupados por aviso, primero los ocultos. |
| POST `/api/admin/anuncios/:id/reportes/resolver` | Admin | `restaurar` (devuelve los días que estuvo oculto) o `dar_de_baja`. |
| GET `/api/admin/verificaciones` | Admin | Cuentas sin verificar. |
| POST `/api/admin/verificaciones/:usuarioId/codigo` | Admin | Genera un código y el enlace de WhatsApp para enviarlo. |
| POST `/api/admin/verificaciones/:usuarioId/presencial` | Admin | Verifica en persona, con confirmación explícita. |
| GET `/api/admin/configuracion` | Admin | Datos de pago. |
| PUT `/api/admin/configuracion` | Admin | Edita los datos de pago. |
| POST `/api/admin/configuracion/qr` | Admin | Sube el QR (se guarda sin pérdida en la carpeta privada). |
| GET `/api/admin/planes` | Admin | Planes. |
| POST `/api/admin/planes` | Admin | Crea un plan. |
| PATCH `/api/admin/planes/:id` | Admin | Edita un plan. |

## Flujos principales

**Publicar.** La sesión y el celular verificado se comprueban antes de recibir archivos. Luego se validan los campos, la cantidad y el contenido de las fotos (hasta 10 MB y 50 megapíxeles), una por una: se corrige la orientación, se reduce a 1600 px y se guarda WebP sin metadatos. El aviso y sus fotos se insertan en una transacción; si falla, se borran los archivos nuevos. El aviso queda pendiente hasta que administración confirme el pago.

**Contacto.** El catálogo y el detalle nunca incluyen el celular. Al pulsar «Ver contacto», `GET /api/anuncios/:id/contacto` lo entrega con el enlace `wa.me/51…` y el mensaje preparado. El límite es de 20 pedidos cada 15 minutos por cuenta o por IP. Cada persona se registra una vez por aviso.

**Verificación del celular.** Al registrarse, la cuenta queda pendiente. Administración genera un código de 6 dígitos (se guarda solo su hash) y lo envía por WhatsApp desde el celular de AvisoSur; la persona lo escribe en «Mi cuenta». El código vence en 24 horas y admite 5 intentos. Administración también puede verificar en persona.

**Reportes.** Una cuenta reporta un aviso público una sola vez, con un motivo fijo. Si hay tres reportes pendientes de cuentas verificadas distintas, el aviso se oculta (`revision_reportes = 1`) dentro de la misma transacción. El moderador lo restaura, devolviendo los días que estuvo oculto, o lo da de baja; los reportes pasan a «revisado».

## Seguridad

Contraseñas con bcrypt de costo 12. Tokens de sesión aleatorios de 256 bits, guardados solo como SHA-256. Cookie HttpOnly y SameSite=Strict, que vence en 7 días y se revoca al cerrar sesión. Las escrituras con un `Origin` ajeno se rechazan. Hay límites de intentos de acceso y de pedidos de contacto, y los roles se comprueban en el servidor. Todas las consultas usan parámetros. Los comprobantes y el QR están en una carpeta privada que el servidor estático no expone. El alcance es HTTP local enlazado a `127.0.0.1`; una operación pública necesitaría HTTPS, respaldos, monitoreo y una revisión de seguridad adicional.
