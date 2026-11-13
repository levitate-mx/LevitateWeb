# Levitate Entrada

Aplicación Android para validar los boletos QR en la entrada de los eventos Levitate.

## Flujo de puerta

1. La misma APK preconfigurada se puede instalar en varios teléfonos, sin usuario ni contraseña.
2. En el primer inicio cada teléfono se activa automáticamente en segundo plano y recibe su propia sesión cifrada.
3. Al iniciar una sesión nueva, el operador selecciona explícitamente el bloque que está ingresando. Las opciones se obtienen del servidor; no hay un bloque predeterminado.
4. La cámara y el ingreso manual se habilitan después de seleccionar un bloque. El bloque actual permanece visible y puede cambiarse entre lecturas.
5. Los boletos por bloque sólo se aceptan en las entradas que cubre su compra. Una entrada incorrecta se rechaza sin consumir el boleto.
6. Los pases Día y Full se canjean una sola vez por su pulsera. La pantalla verde indica el canje que debe realizar el operador.
7. El primer canje del QR se registra una sola vez. En Estado de México, el acceso al bloque 4 permite además una validación en 4A y otra en 4B. Repetir la misma parte se rechaza, incluso desde otro teléfono.

La selección de bloque no puede cambiar durante una validación o un reintento. Cada reintento conserva el bloque de la lectura original. Después de cerrar el resultado o cancelar la lectura se puede elegir otro bloque.

La app nunca admite un boleto sin conexión. En ese caso muestra `SIN CONEXIÓN / NO ADMITIR` y permite reintentar.

## Entradas de Estado de México · noviembre de 2026

El selector muestra **1, 2 y 3, 4A, 4B, 5, 6 y 7**. La entrada conjunta de 2 y 3
acepta los Single pass comprados para cualquiera de esos dos bloques. Los boletos
del bloque 4 permiten usar el mismo QR una vez en 4A y una vez en 4B, en cualquier
orden. Los Day del sábado y Full también permiten validar cada parte; sólo su
primer canje entrega brazalete. Leer el mensaje de cada resultado verde.

Los QR emitidos, las compras y el primer canje se conservan. No se necesita otro
APK: **cerrar completamente la app y volver a abrirla**, conservando sus datos,
para recuperar el selector nuevo. Si una app abierta conserva “Bloque 4”, el
servidor pide seleccionar 4A o 4B y no consume el boleto. Las selecciones antiguas
2 o 3 se reconocen como la entrada conjunta.

## Ocupación por ventas y QR canjeados (1.2.0)

Debajo del bloque seleccionado se muestra **Ocupación por ventas**: por ejemplo,
`120/500 vendidos · 24%`, con desglose de compras Single / Day / Full. La capacidad
por bloque viene del servidor. El porcentaje puede superar el 100%; la barra se
limita al ancho disponible y se advierte el exceso. Si hay boletos vendidos sin
bloque asignado se informa por separado, sin atribuirlos a un bloque arbitrario.

Las ventas se consultan al recuperar la sesión, al volver a la app y con
**Actualizar**. No se consultan por cada QR ni en el sondeo de 30 segundos.
Una consulta trae todos los bloques, así que cambiar de bloque reutiliza sus datos.
Las ventas pueden disminuir al cancelar compras; no son un contador acumulativo.

**QR canjeados atribuidos** sigue separado como dato secundario. Son datos globales
del servidor para todos los teléfonos. Day se atribuye a las entradas de su día y
Full a todas las del evento. Un Single del bloque 4 cuenta como vendido en ambas
partes; sus QR canjeados se atribuyen a cada parte cuando se valida en ella. En la
entrada 2 y 3 cada QR se cuenta una sola vez.
Sumar los bloques no equivale a personas únicas y no mide butacas físicamente ocupadas.
**QR únicos canjeados** cuenta cada boleto usado una sola vez.

**Ver bloques / Historial** muestra los bloques del evento y permite elegir otro
evento cuando existe historial. Esta selección no cambia el bloque del escáner.
No se suman admisiones en el teléfono ni se reinician las cifras al cerrar la app.

El resumen de QR se consulta al recuperar la sesión, al cambiar de bloque, al volver a
la app, con **Actualizar** y cada 30 segundos mientras la actividad está visible.
El sondeo se detiene al pasar a segundo plano. Una validación puede incluir el
resumen actualizado; respuestas anteriores no reemplazan datos más recientes.
Si el resumen falla se conserva el último dato, marcado sin actualizar con hora
de consulta en CDMX. Si nunca se obtuvo un resumen se muestra `—`, no cero.
Cada fuente conserva su propia hora de consulta y error; una actualización de QR no
cambia la fecha ni las cifras de ventas. No se mezclan eventos aunque tengan bloques
con el mismo identificador. Un fallo de cualquiera de los resúmenes no cambia la
decisión de un QR ya validado.

Contrato: `GET /api/registration/scanner/attendance?eventId=...` devuelve
`{attendance: {eventId, eventName, venue, updatedAt, uniqueAdmissions, blocks, events}}`.
`eventId` es opcional para el evento actual. El POST de escaneo puede incluir el
mismo objeto `attendance`. Ambas solicitudes utilizan la sesión individual
`Authorization: Scanner …`; el contador no requiere nuevas credenciales.

Ventas: `GET /api/registration/scanner/ticket-sales-summary?eventId=...` devuelve
`{sales: {eventId, eventName, venue, updatedAt, capacityPerBlock, uniqueTickets, unassignedTickets, blocks}}`.
En este objeto `total`, `single`, `day` y `full` son compras. `eventId` es opcional
para el evento actual. Usa la misma sesión `Authorization: Scanner …`.

## Actualizar una instalación existente

La versión 1.2.1 usa `versionCode=4`. Instalar el APK **encima de la versión
anterior**, con el mismo identificador de aplicación y certificado de firma.
No desinstalar ni borrar datos. Se mantienen el nombre de preferencias y el alias
de Android Keystore para recuperar la sesión cifrada existente. Las variantes
debug y release tienen identificadores distintos: usar la misma variante que
está instalada. El APK de actualización no necesita regenerar la autorización
de vinculación; una instalación nueva se activa automáticamente con la APK de distribución configurada.

Validación local: `./gradlew :app:testDebugUnitTest :app:assembleDebug`.

## Instalar para pruebas

El APK de prueba se genera en:

`app/build/outputs/apk/debug/app-debug.apk`

Para instalarlo en un teléfono con depuración USB habilitada:

```bash
./gradlew installDebug
```

La aplicación de producción usa por defecto:

`https://levitateweb.ati-levitatemx.workers.dev`

Para apuntar una compilación de prueba al servidor local desde el emulador:

```bash
./gradlew assembleDebug -PLEVITATE_API_BASE_URL=http://10.0.2.2:5174
```

En un teléfono físico, reemplazar `10.0.2.2` por la IP local de la computadora.

La APK de distribución se compila con la autorización reutilizable del instalador:

```bash
./gradlew assembleDebug -PLEVITATE_REQUIRE_SCANNER_PROVISIONING=true -PLEVITATE_SCANNER_BOOTSTRAP_PAYLOAD=LEVITATE:SCANNER-PAIR:...
```

Para evitar exponerla en comandos, se recomienda suministrar la propiedad mediante `ORG_GRADLE_PROJECT_LEVITATE_SCANNER_BOOTSTRAP_PAYLOAD`. La opción `LEVITATE_REQUIRE_SCANNER_PROVISIONING=true` rechaza una compilación de distribución sin autorización; las compilaciones vacías siguen sirviendo para pruebas y actualizaciones de teléfonos ya vinculados.

En el Worker, el secreto `REGISTRATION_SCANNER_INSTALLER` contiene JSON `{version:1, tokenHash, issuedByUserId}`: sólo el SHA-256 de la autorización y el identificador del administrador activo que la emitió. No se guarda la autorización en el código fuente. El servidor comprueba el instalador y crea una vinculación de un solo uso diferente para cada teléfono, conservando la sesión individual y las validaciones autenticadas. Los códigos administrativos ordinarios siguen venciendo a los diez minutos y no se pueden reutilizar.

Si se reinstala o borra el almacenamiento, la misma APK de distribución puede activar nuevamente el teléfono. Las instalaciones existentes conservan sus sesiones; no se borran boletos ni canjes. Rotar o retirar el secreto del instalador detiene nuevas activaciones con esa APK, sin cambiar las sesiones existentes.

## Generar una versión para distribución

Abrir `android-scanner` en Android Studio, configurar una firma de aplicación y generar un APK o Android App Bundle de release. Usar la autorización de distribución configurada en el servidor y activar la comprobación de aprovisionamiento. El mismo archivo sirve para varios teléfonos; cada uno guarda su acceso individual cifrado con Android Keystore.
