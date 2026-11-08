# Acta de aceptación · AvisoSur

Esta acta la ejecuta **otra mesa**, no el equipo de AvisoSur, frente a la aplicación funcionando y en pantalla. El equipo prepara el entorno y observa; la mesa evaluadora sigue cada escenario y anota lo que realmente ocurre. Los resultados automáticos de `npm test` no reemplazan esta acta.

## Datos de la ejecución

| Dato | Valor |
| --- | --- |
| Fecha y hora | |
| Mesa evaluadora (integrantes) | |
| Equipo que presenta | AvisoSur |
| Versión probada (commit de `main`) | |
| Dirección usada | `http://127.0.0.1:3001` u otra: |
| Navegador y dispositivo | |
| Base de datos | MySQL de XAMPP / SQLite |

## Preparación (la hace el equipo antes de empezar)

1. Iniciar MySQL en XAMPP, ejecutar `npm.cmd run build` y luego `npm.cmd start`.
2. Tener una cuenta de administración (`node scripts/admin-user.mjs correo@dominio --crear`) y el celular de AvisoSur con WhatsApp a mano para enviar códigos.
3. Configurar el medio de pago y un plan activo en **Administración → QR y datos de pago / Planes y tarifas**.
4. Tener al menos un aviso aprobado de cuarto en alquiler en Puno con precio hasta S/ 300, publicado por una cuenta verificada.
5. Para el escenario de reporte, preparar un aviso «falso» de prueba y tres cuentas de compradores con celular verificado (pueden ser los celulares de la mesa evaluadora).

Cada escenario se marca como **Cumple** o **No cumple**. Si no cumple, se anota qué pasó.

## Escenarios

### CA-01 · Crear una cuenta con nombre para mostrar (RF-01)

- **Dado** que una persona no tiene cuenta,
- **cuando** se registra con nombre para mostrar, correo, celular de 9 dígitos y contraseña,
- **entonces** entra a «Mi cuenta» con su nombre, y en sus avisos se mostrará ese nombre, nunca su correo.

Resultado: ☐ Cumple ☐ No cumple — Observaciones:

### CA-02 · Ingresar con el celular (RF-01)

- **Dado** que la cuenta de CA-01 cerró sesión,
- **cuando** ingresa escribiendo su celular y su contraseña,
- **entonces** vuelve a su cuenta; con una contraseña incorrecta ve el mensaje «El correo, celular o contraseña no es correcto».

Resultado: ☐ Cumple ☐ No cumple — Observaciones:

### CA-03 · Buscar cuartos hasta S/ 300 cerca de la UNA (RF-03)

- **Dado** que hay avisos publicados de venta y de alquiler,
- **cuando** un comprador entra a **Explorar anuncios**, elige Inmuebles, Habitaciones, «Solo en alquiler», Puno y un máximo de S/ 300,
- **entonces** ve en una **lista** solo cuartos en alquiler de Puno, con precios como «S/ 280 al mes», todos de S/ 300 o menos.

Resultado: ☐ Cumple ☐ No cumple — Observaciones:

### CA-04 · El celular solo aparece al pedir el contacto (RF-04)

- **Dado** que un comprador abre el detalle de un aviso publicado,
- **cuando** mira la página antes de pulsar ningún botón,
- **entonces** no ve el celular del vendedor; al pulsar **Ver contacto del vendedor** aparece el número y **Escribir por WhatsApp** abre una conversación con el mensaje preparado, sin enviarlo.

Resultado: ☐ Cumple ☐ No cumple — Observaciones:

### CA-05 · Sin celular verificado no se publica (novedad)

- **Dado** que la cuenta de CA-01 todavía no verificó su celular,
- **cuando** entra a **Publicar anuncio**,
- **entonces** ve el aviso «Verifica tu celular para publicar» y no puede enviar el aviso.

Resultado: ☐ Cumple ☐ No cumple — Observaciones:

### CA-06 · Un vendedor real verifica su celular (novedad)

- **Dado** que la cuenta de CA-01 usa un celular real de la mesa,
- **cuando** administración entra a **Verificar celulares**, pulsa **Generar código** y **Enviar por WhatsApp**, y la persona escribe en «Mi cuenta» el código que recibió,
- **entonces** su cuenta queda con «Celular verificado»; si antes escribe un código equivocado, ve «El código no es correcto» y cuántos intentos le quedan.

Resultado: ☐ Cumple ☐ No cumple — Observaciones:

### CA-07 · Publicar con una foto tomada con el celular (RF-02)

- **Dado** que la cuenta ya está verificada,
- **cuando** publica un cuarto eligiendo «Lo alquilo», con una foto del celular de más de 2 MB (o HEIC desde un iPhone) y un plan,
- **entonces** la foto se acepta, la vista previa muestra «S/ … al mes» y el aviso queda «Pendiente de pago y revisión», sin aparecer todavía en el catálogo.

Resultado: ☐ Cumple ☐ No cumple — Observaciones:

### CA-08 · Pago y aprobación (publicación pagada)

- **Dado** que el aviso de CA-07 está pendiente,
- **cuando** el vendedor adjunta su comprobante y administración confirma el pago y lo aprueba,
- **entonces** el aviso aparece en el catálogo con la insignia «Celular verificado» y su fecha de vencimiento.

Resultado: ☐ Cumple ☐ No cumple — Observaciones:

### CA-09 · El vendedor ve cuántas personas pidieron su contacto (novedad)

- **Dado** que el aviso de CA-08 está publicado,
- **cuando** dos personas distintas pulsan **Ver contacto del vendedor**,
- **entonces** el vendedor ve en «Mi cuenta» «2 personas pidieron tu contacto».

Resultado: ☐ Cumple ☐ No cumple — Observaciones:

### CA-10 · Un comprador real reporta un aviso falso (novedad)

- **Dado** que hay un aviso falso publicado y tres compradores con celular verificado,
- **cuando** el primero pulsa **Reportar este aviso**, elige «Pide un adelanto antes de mostrar el producto» y lo envía, y el segundo hace lo mismo,
- **entonces** el aviso sigue en el catálogo; **cuando** el tercero lo reporta, el aviso **desaparece del catálogo** y su enlace ya no se abre.

Resultado: ☐ Cumple ☐ No cumple — Observaciones:

### CA-11 · La misma persona no reporta dos veces (novedad)

- **Dado** que uno de los compradores de CA-10 ya reportó un aviso,
- **cuando** intenta reportarlo otra vez,
- **entonces** ve «Ya reportaste este aviso» y el reporte no se duplica.

Resultado: ☐ Cumple ☐ No cumple — Observaciones:

### CA-12 · El moderador decide (novedad)

- **Dado** que el aviso de CA-10 está oculto por reportes,
- **cuando** administración abre **Reportes**, revisa los motivos y pulsa **Restaurar aviso** (o **Dar de baja**),
- **entonces** el aviso vuelve al catálogo (o queda dado de baja), y sus reportes dejan de aparecer como pendientes.

Resultado: ☐ Cumple ☐ No cumple — Observaciones:

## Resumen

| Escenarios | Cumple | No cumple |
| --- | --- | --- |
| 12 | | |

Observaciones generales de la mesa:

## Firmas

| Rol | Nombre | Firma |
| --- | --- | --- |
| Mesa evaluadora | | |
| Mesa evaluadora | | |
| Equipo AvisoSur | | |
