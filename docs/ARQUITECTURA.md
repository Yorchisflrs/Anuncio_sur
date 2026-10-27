# Arquitectura de AvisoSur

Aplicación monolítica local con frontend separado: React solicita la API REST de Express. Express valida datos, consulta SQLite o MySQL según `DB_CLIENT` y almacena imágenes WebP en disco. En desarrollo, Vite actúa como proxy; después de compilar, Express también entrega el frontend y resuelve las rutas de React Router.

## Modelo

| Entidad | Campos principales y relaciones |
| --- | --- |
| `usuarios` | id, correo único sin distinguir mayúsculas, celular único, password_hash, fecha_registro, es_demo. |
| `categorias` | id, nombre, subcategorias como JSON y activa. |
| `anuncios` | id, usuario_id → usuarios, categoria_id → categorias, título, descripción, precio_centimos en SQLite o precio DECIMAL(10,2) en MySQL, zona, subcategoria, estado, fecha_publicacion y es_demo. |
| `fotos` | id, anuncio_id → anuncios, archivo, orden de 0 a 2 y fecha_subida. Orden único por anuncio. |
| `reportes` | id, anuncio_id → anuncios, usuario_id → usuarios, motivo, fecha y estado pendiente/revisado. Preparado para la segunda iteración. |
| `sesiones` | token_hash → SHA-256 del token aleatorio, usuario_id → usuarios y expira. |
| `metadata` | Registro de la versión del seed para evitar duplicados. |

SQLite habilita claves foráneas, modo WAL y espera ante bloqueo. MySQL usa InnoDB, claves foráneas y transacciones; `database/avisosur_mysql.sql` crea su esquema. Los anuncios solo tienen estados `activo` y `dado_de_baja`; dar de baja cambia el estado y no borra filas ni fotos. La colección de subcategorías se guarda por categoría porque es pequeña y fija en esta iteración. No hay roles persistidos: una cuenta puede comprar y vender; el administrador queda pendiente.

## API

| Método y ruta | Acceso | Resultado |
| --- | --- | --- |
| GET `/api/health` | Público | Estado del servicio. |
| GET `/api/categorias` | Público | Categorías, subcategorías y recuentos activos. |
| GET `/api/auth/me` | Público | Usuario de la sesión o `null`. |
| POST `/api/auth/registro` | Público | Valida correo, celular, password y confirmación, registra e inicia sesión. |
| POST `/api/auth/login` | Público | Valida identificador y contraseña, crea una sesión. |
| POST `/api/auth/logout` | Público | Revoca la sesión y borra la cookie. |
| GET `/api/anuncios` | Público | Catálogo paginado de activos. |
| GET `/api/anuncios/:id` | Público / propietario | Detalle activo; el propietario puede consultar sus anuncios retirados. |
| POST `/api/anuncios` | Autenticado | Multipart con campos y `fotos`, hasta tres. |
| GET `/api/perfil/anuncios` | Autenticado | Todas las publicaciones del usuario actual. |
| PATCH `/api/anuncios/:id/baja` | Propietario | Cambia el estado y conserva los registros. |

Filtros del catálogo: `q`, `categoriaId`, `subcategoria`, `zona`, `min`, `max`, `sort`, `page`, `limit`. Ordenamientos: `recent`, `price_asc`, `price_desc`. Por defecto: 24 registros por página; máximo: 48. Los límites se convierten a centavos y se comparan con `>=` y `<=`.

Las respuestas de error tienen `{ message, fields }`; códigos principales: 401 sin sesión o credenciales incorrectas, 403 falta de propiedad/origen, 404 anuncio inexistente o retirado, 409 cuenta duplicada y 422 datos inválidos. Los errores de base de datos no se muestran al cliente.

## Publicación

1. Verificar sesión antes de aceptar archivos.
2. Comprobar campos, cantidad y tamaño de imágenes.
3. Detectar formato JPG/PNG por contenido y decodificar con límite de píxeles.
4. Corregir orientación, reducir dimensiones y recodificar WebP sin metadatos originales.
5. Guardar con nombres aleatorios; insertar anuncio y fotos dentro de una transacción.
6. Limpiar los archivos nuevos si falla la transacción. Devolver el detalle con la URL de WhatsApp.

La UI mantiene su estado y las vistas previas si falla la validación. Tras éxito muestra la confirmación debajo del botón y un enlace al detalle; bloquea una segunda publicación desde el mismo formulario. Los precios nunca se calculan con valores provenientes del frontend sin validación de servidor.

## Seguridad de sesión

Contraseñas bcrypt con costo 12, tokens aleatorios de 256 bits y únicamente su SHA-256 guardado en la base seleccionada. La cookie es HttpOnly y SameSite=Strict, expira a los siete días y se revoca al cerrar sesión. La API nunca serializa el hash ni el token. Las escrituras con encabezado Origin ajeno se rechazan. El acceso y registro admiten 30 intentos por IP en 15 minutos. Todas las consultas que contienen datos de usuario usan parámetros.

El alcance es HTTP local enlazado a loopback. Para una operación comercial se necesitarían HTTPS, revisión adicional de seguridad, verificación de identidad/contacto, backups, monitoreo y medidas frente al abuso.
