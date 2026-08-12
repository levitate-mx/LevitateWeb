# Levitate Entrada

Aplicación Android para validar los boletos QR en la entrada de los eventos Levitate.

## Flujo de puerta

1. El APK se entrega preconfigurado para un único teléfono, sin usuario ni contraseña.
2. En el primer inicio la app se activa automáticamente en segundo plano.
3. A partir de entonces cada apertura muestra directamente la cámara de entrada.
4. El servidor valida y marca cada boleto como usado en una única operación.
5. La pantalla muestra verde para admitir o rojo para rechazar.
6. Un segundo intento con el mismo QR se rechaza, incluso desde otro teléfono.

La app nunca admite un boleto sin conexión. En ese caso muestra `SIN CONEXIÓN / NO ADMITIR` y permite reintentar.

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
