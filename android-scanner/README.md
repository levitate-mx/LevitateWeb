# Levitate Entrada

Aplicación Android para validar los boletos QR en la entrada de los eventos Levitate.

## Flujo de puerta

1. El APK se entrega preconfigurado para un único teléfono, sin usuario ni contraseña.
2. En el primer inicio la app se activa automáticamente en segundo plano.
3. Al iniciar una sesión nueva, el operador selecciona explícitamente el bloque que está ingresando. Las opciones se obtienen del servidor; no hay un bloque predeterminado.
4. La cámara y el ingreso manual se habilitan después de seleccionar un bloque. El bloque actual permanece visible y puede cambiarse entre lecturas.
5. Los boletos por bloque sólo se aceptan en el bloque seleccionado. Un bloque incorrecto se rechaza sin consumir el boleto.
6. Los pases Día y Full se canjean una sola vez por su pulsera. La pantalla verde indica el canje que debe realizar el operador.
7. Todos los QR son de un solo uso: el servidor valida y marca cada boleto como usado en una única operación. Un segundo intento con el mismo QR se rechaza, incluso desde otro teléfono.

La selección de bloque no puede cambiar durante una validación o un reintento. Cada reintento conserva el bloque de la lectura original. Después de cerrar el resultado o cancelar la lectura se puede elegir otro bloque.

La app nunca admite un boleto sin conexión. En ese caso muestra `SIN CONEXIÓN / NO ADMITIR` y permite reintentar.

## Accesos por bloque e historial (1.1.0)

Debajo del bloque seleccionado se muestra **Accesos contabilizados**, con desglose
Single / Day / Full. Son datos globales del servidor para todos los teléfonos:
Single se atribuye a su bloque, Day a los bloques del día comprado y Full a todos
los bloques del evento. Representan accesos atribuidos por pases canjeados, no
butacas físicamente ocupadas. **QR únicos canjeados** cuenta cada boleto una sola vez.

**Ver bloques / Historial** muestra los bloques del evento y permite elegir otro
evento cuando existe historial. Esta selección no cambia el bloque del escáner.
No se suman admisiones en el teléfono ni se reinician las cifras al cerrar la app.

El resumen se consulta al recuperar la sesión, al cambiar de bloque, al volver a
la app, con **Actualizar** y cada 30 segundos mientras la actividad está visible.
El sondeo se detiene al pasar a segundo plano. Una validación puede incluir el
resumen actualizado; respuestas anteriores no reemplazan datos más recientes.
Si el resumen falla se conserva el último dato, marcado sin actualizar con hora
de consulta en CDMX. Si nunca se obtuvo un resumen se muestra `—`, no cero.
Un fallo del contador no cambia la decisión de un QR ya validado.

Contrato: `GET /api/registration/scanner/attendance?eventId=...` devuelve
`{attendance: {eventId, eventName, venue, updatedAt, uniqueAdmissions, blocks, events}}`.
`eventId` es opcional para el evento actual. El POST de escaneo puede incluir el
mismo objeto `attendance`. Ambas solicitudes utilizan la sesión individual
`Authorization: Scanner …`; el contador no requiere nuevas credenciales.

## Actualizar una instalación existente

La versión 1.1.0 usa `versionCode=2`. Instalar el APK **encima de la versión
anterior**, con el mismo identificador de aplicación y certificado de firma.
No desinstalar ni borrar datos. Se mantienen el nombre de preferencias y el alias
de Android Keystore para recuperar la sesión cifrada existente. Las variantes
debug y release tienen identificadores distintos: usar la misma variante que
está instalada. El APK de actualización no necesita regenerar la autorización
de vinculación; una instalación nueva sí necesita el aprovisionamiento habitual.

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

El APK preconfigurado se compila con una autorización de un solo uso:

```bash
./gradlew assembleDebug -PLEVITATE_SCANNER_BOOTSTRAP_PAYLOAD=LEVITATE:SCANNER-PAIR:...
```

Una vez activado el teléfono, no se debe borrar el almacenamiento de la app ni desinstalarla. Si ocurre, hay que generar un APK nuevo.

## Generar una versión para distribución

Abrir `android-scanner` en Android Studio, configurar una firma de aplicación y generar un APK o Android App Bundle de release. La autorización incluida sólo sirve para activar un dispositivo una vez; después la app guarda su acceso individual cifrado con Android Keystore.
