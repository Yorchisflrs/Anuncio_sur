# AvisoSur

Portal de avisos clasificados para Puno, Juliaca y el sur del Perú: motos, cuartos y departamentos, y electrodomésticos. Proyecto de Ingeniería de Software II de la Universidad Nacional del Altiplano.

Cualquiera puede buscar y comparar avisos sin cuenta. Para publicar hace falta una cuenta con el **celular verificado**. Cada aviso pasa por **revisión y pago manual** antes de aparecer: quien publica paga un plan por Yape, adjunta su comprobante y administración lo aprueba. El celular del vendedor solo se muestra a quien lo pide. Los compradores pueden **reportar avisos sospechosos**: con tres reportes de personas verificadas, el aviso se oculta hasta que lo revise un moderador.

Las observaciones de la Práctica 9 y cómo se levantaron están en [docs/OBSERVACIONES_P9.md](docs/OBSERVACIONES_P9.md).

## Inicio rápido

Requiere **Node.js 24 o superior** y npm. En PowerShell, si la política impide ejecutar `npm.ps1`, usa `npm.cmd`.

```powershell
npm install
npm run dev
```

Abre **http://127.0.0.1:5173**. La API escucha en **http://127.0.0.1:3001** y Vite le redirige `/api` y `/uploads`. Sin archivo `.env`, se usa SQLite en `backend/data/avisosur.sqlite`, que se crea con 16 avisos DEMO **pendientes de revisión**.

Para servir la versión compilada con un solo servidor:

```powershell
npm run build
npm start
```

Abre **http://127.0.0.1:3001**. Para usar el MySQL de XAMPP, sigue [docs/MYSQL.md](docs/MYSQL.md).

### Primera configuración

1. Crea una cuenta de administración desde la terminal (la contraseña se pide sin mostrarse):

   ```powershell
   node scripts/admin-user.mjs tu-correo@dominio.com --crear
   ```

2. En **Administración → QR y datos de pago**, registra el medio de pago (titular, número y QR) y revisa los **Planes y tarifas**.
3. Aprueba los avisos que quieras mostrar en **Revisar anuncios**. Los 16 avisos DEMO se aprueban como cualquier otro.
4. Las cuentas nuevas aparecen en **Verificar celulares**: genera el código y envíalo por WhatsApp, o verifica en persona.

### Avisos de demostración

Los 16 avisos de ejemplo pertenecen a la cuenta «Vendedor de demostración» (`demo@avisosur.local`, celular ficticio `900000000`). Sus tarjetas dicen «Ejemplo» y sus imágenes son ilustraciones, no fotos reales.

Esa cuenta **no tiene una contraseña escrita en el código**: al crear la base se le asigna una clave aleatoria que nadie conoce. Como su número es ficticio, tampoco se puede verificar ni publicar. Para probar el sistema, crea tu propia cuenta. Si para una exposición hace falta entrar como demo, define `DEMO_PASSWORD` en `.env` antes de que se cree la base SQLite.

## Funcionalidades

| Requisito | Implementación |
| --- | --- |
| RF-01 · Cuenta y acceso | Registro con nombre para mostrar, correo, celular y contraseña; acceso con correo o celular; sesión de 7 días; cierre de sesión; cambio de nombre en el perfil. |
| RF-02 · Publicación | Fotos JPG, PNG, WebP o HEIC (hasta 7, de 10 MB cada una, reducidas a 1600 px WebP) o enlaces HTTPS directos; venta o alquiler mensual; plan de publicación; exige celular verificado. |
| RF-03 · Consulta y búsqueda | Catálogo en lista o en tarjetas; filtros por texto, categoría, subcategoría, venta o alquiler, zona y rango de precio inclusivo; orden y paginación. |
| RF-04 · Contacto | «Ver contacto del vendedor» entrega el celular y un enlace `wa.me` con el mensaje preparado, con un límite de pedidos por persona; el vendedor ve cuántas personas lo pidieron. |
| Publicación pagada | Planes configurables, pago por Yape con comprobante privado, aprobación o rechazo con motivo, vigencia desde la aprobación y días extra en la primera publicación. |
| Renovación | Un aviso vencido se vuelve a publicar con los mismos datos y fotos, y pasa otra vez por pago y revisión. |
| Confianza (novedad) | Celular verificado con código o en persona; insignia «Celular verificado» con avisos publicados y dados de baja; reportes con motivos fijos; ocultamiento automático con tres reportes verificados; página del moderador. |
| RNF-01 · Búsqueda rápida | Consultas parametrizadas e índices; prueba de carga con 500 avisos públicos y 50 clientes concurrentes. |
| RNF-03 · Seguridad | bcrypt con costo 12, sesiones guardadas como SHA-256, cookie HttpOnly y SameSite=Strict, rechazo de origen ajeno, límite de intentos, roles verificados en el servidor y celulares fuera de las respuestas públicas. |

### Pantallas

| Ruta | Pantalla |
| --- | --- |
| `/` | Portada con búsqueda, avisos recientes, planes, categorías y zonas |
| `/anuncios` | Catálogo en lista, con filtros |
| `/anuncios/:id` | Detalle con fotos, vendedor, insignia, contacto y reporte |
| `/categorias` | Categorías y subcategorías |
| `/ayuda/:tema` | Seguridad, términos, privacidad y ayuda para publicar |
| `/registro` y `/login` | Crear cuenta e ingresar |
| `/publicar` | Formulario de publicación |
| `/perfil` | Mis publicaciones, verificación del celular y nombre para mostrar |
| `/mis-anuncios/:id/pago` | Pago y comprobante de una publicación |
| `/mis-anuncios/:id/editar` | Edición del aviso propio antes de su aprobación |
| `/admin` | Revisión, reportes, verificación de celulares, pago y planes |

## Tecnologías y decisiones

- **Frontend:** React 19, TypeScript, Vite, React Router, Lucide, CSS propio y Tailwind como plugin de Vite.
- **Backend:** Node 24, Express 5, SQLite mediante `node:sqlite` o MySQL/MariaDB mediante `mysql2`, bcryptjs, Multer, Sharp y express-rate-limit.
- **Migraciones aditivas:** al iniciar, el servidor agrega las columnas, tablas e índices que falten en SQLite o MySQL, sin borrar ni reescribir datos. También hay scripts SQL equivalentes en `database/`.
- **Fotos:** el formato se comprueba por el contenido. Se corrige la orientación, se quitan los metadatos y se guarda WebP de hasta 1600 px. El navegador reduce las fotos grandes antes de subirlas.
- **Verificación del celular:** el código de 6 dígitos se guarda solo como hash, vence en 24 horas y admite 5 intentos. No hay proveedor de SMS: administración lo envía por WhatsApp con el mensaje preparado.
- **Contacto:** quien pide un contacto se registra una vez por aviso, como hash con sal propia de la instalación; no se guarda su IP.
- **Precios:** SQLite guarda céntimos enteros y MySQL usa `DECIMAL(10,2)`; la API responde en soles. El precio de lo que se ofrece es distinto del costo del plan.
- **Archivos privados:** los comprobantes y el QR se guardan en una carpeta privada que el servidor estático no expone.

La arquitectura, el modelo de datos y la lista completa de endpoints están en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).

## Estructura

```text
frontend/src/
  pages/                Pantallas (portada, catálogo, detalle, publicar, perfil, pago, administración…)
  components/           Tarjetas y lista, contacto, reporte, verificación, moderador, galería
  services/             API, imágenes del celular, validaciones y estados de publicación
backend/src/
  app.mjs               API REST y publicación
  listings.mjs          Catálogo, detalle y regla única de visibilidad pública
  contact.mjs           Contacto a pedido con límite por persona
  verification.mjs      Celular verificado
  reports.mjs           Reportes, revisión automática y moderador
  moderation.mjs        Pago manual, aprobación, planes y resumen
  migrations.mjs        Migraciones aditivas SQLite y MySQL
backend/test/           Pruebas por requisito (rf01…rf04), novedad, moderación, migración y recorrido completo
database/               Esquema MySQL, datos DEMO y actualizaciones aditivas
docs/                   Arquitectura, validación, acta, entrevistas, observaciones y evidencias
```

## Pruebas y verificación

```powershell
npm test                 # pruebas HTTP reales con SQLite temporal
npm run test:reporte     # además escribe docs/evidencias/pruebas-automatizadas.xml
npm run benchmark        # RNF-01, escribe docs/benchmark-results.json
npm run check            # TypeScript
npm run build            # compilación de producción
```

Cada archivo de `backend/test/` corresponde a un requisito y cada caso es independiente: levanta el servidor real en un puerto libre, hace pedidos HTTP y usa una base y carpetas temporales que borra al terminar. `integracion-recorrido.test.mjs` junta todo en una sola historia, en el orden del acta: un arrendador crea su cuenta, verifica su celular, publica un cuarto, paga y lo aprueban; una estudiante lo encuentra y pide el contacto; tres compradores lo reportan y el moderador decide. La prueba de integración con MySQL crea y borra su propia base `avisosur_test_<aleatorio>`, y solo corre con `AVISOSUR_TEST_MYSQL=1`. Ninguna prueba toca `avisosur_db`.

Los resultados de la última ejecución están en [docs/VALIDACION.md](docs/VALIDACION.md). El acta Dado/Cuando/Entonces para otra mesa está en [docs/ACTA_ACEPTACION.md](docs/ACTA_ACEPTACION.md), y la guía de entrevistas en [docs/ENTREVISTAS.md](docs/ENTREVISTAS.md).

## Configuración

Copia `.env.example` como `.env` para usar MySQL. Variables principales: `DB_CLIENT` (`mysql` o `sqlite`), `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` y `DB_PASSWORD`. Además: `PORT` y `HOST` del servidor, `APP_ORIGIN` (el origen extra que puede enviar formularios), `DB_PATH` y `UPLOAD_DIR` para SQLite y fotos, y `COOKIE_SECURE=true` solo con HTTPS. El servidor escucha en `127.0.0.1`. No se incluye despliegue público.

## Límites conocidos

- La verificación del celular depende de que administración envíe el código por WhatsApp; no hay SMS automático.
- No hay recuperación de contraseña ni notificaciones.
- Las fotos HEIC se convierten en el navegador cuando este puede abrirlas (Safari). En otros navegadores se pide enviarlas como JPG.
- RNF-02 (98 % de disponibilidad en 30 días) y la medición de RNF-04 (menos de 4 s en 3G) siguen pendientes de un despliegue real.
- Antes de operar públicamente faltan HTTPS, términos y privacidad revisados, libro de reclamaciones, respaldos y monitoreo.

## Guion de exposición (2 minutos)

1. En la portada, pulsa «Cuartos en alquiler en Puno». En el catálogo, fija el máximo en S/ 300: se ven los precios «al mes» en una lista.
2. Abre un cuarto publicado por un arrendador con la insignia «Celular verificado» y su historial de avisos. Pulsa **Ver contacto del vendedor**: el número aparece solo ahora.
3. Con tres cuentas de compradores verificadas, reporta un aviso falso. Con el tercer reporte desaparece del catálogo.
4. En **Administración → Reportes**, revisa los motivos y restáuralo o dalo de baja.
