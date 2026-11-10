# Conexión de Google Drive para foto y video

En `/admin/foto-video`, el panel **Drive para foto y video** comprueba la autorización existente y permite vincular una carpeta independiente de música. Requiere la sesión normal de un administrador global.

## Conexión independiente de Ati para fotos

Las fotos admiten una autorización propia, independiente de la conexión histórica de música:

- `PARTICIPANT_PHOTO_DRIVE_OAUTH_CLIENT_ID`
- `PARTICIPANT_PHOTO_DRIVE_OAUTH_CLIENT_SECRET`
- `PARTICIPANT_PHOTO_DRIVE_OAUTH_REFRESH_TOKEN`
- `PARTICIPANT_PHOTO_DRIVE_ACCOUNT_EMAIL` (`ati.levitatemx@gmail.com`)

Si ninguna está presente se conserva el comportamiento anterior. Si hay una configuración parcial, las operaciones de fotos fallan sin recurrir a la cuenta musical. Los archivos históricos `google_drive:<id>` y todos los PDF mantienen la conexión original; las fotos nuevas usan `google_drive_photo:<id>`. Una caída de Ati no impide leer los archivos históricos ni preparar PDF con su proveedor original.

Las cuatro variables se guardan como secretos del servidor. Nunca se sustituyen `GOOGLE_DRIVE_OAUTH_*`, `GMAIL_OAUTH_*`, `PARTICIPANT_MEDIA_DRIVE_ACCOUNT_EMAIL` ni la carpeta musical. El diagnóstico de Foto y video utiliza la conexión nueva y comprueba el correo antes de vincular una carpeta.

### Carpetas por academia y coreografía

El árbol de originales para esta edición queda así:

```text
Mi Levitate · Fotos · Estado de México 2026/
  Academia/
    Coreografía/
```

Las carpetas se asocian mediante IDs de edición, academia y coreografía en `appProperties`; los nombres visibles son los de la BD y pueden cambiarse sin perder la asociación. Los integrantes registrados de una misma coreografía comparten sus fotos; otra academia o coreografía no puede consultarlas. No hay CURP ni identificadores de acceso en los nombres.

La lectura automática al abrir el pasaporte valida la pertenencia en D1, la cuenta Ati y toda la cadena de carpetas. Solo importa hasta dos vistas reducidas por coreografía, preparadas en el servidor con la marca de agua vigente. Los originales y las vistas guardadas permanecen privados en Drive; no se entregan enlaces ni credenciales de Google a participantes. Se mantienen el control de publicación, los bloqueos manuales y la edición oculta cuando aún no está publicada.

La preparación operativa no adopta carpetas por nombre, no cambia permisos ni edita o elimina archivos anteriores. Los duplicados de asociación se rechazan para revisión. La carpeta privada de vistas preparadas es independiente del árbol de originales.

### Alta operativa

1. Crear un cliente OAuth de tipo Desktop dedicado a fotos, sin modificar el de música. Google Cloud debe permitir el acceso de Ati; puede exigir verificación en dos pasos.
2. Ejecutar `node scripts/connect-participant-photo-drive.mjs --client-file /ruta/privada/desktop.json --credentials-file /ruta/privada/fotos.json`. Abrir la URL local impresa con el perfil Ati. Usa state, PKCE, consentimiento offline y verifica la cuenta antes de guardar las cuatro variables en un archivo privado. Nunca imprime códigos ni tokens.
3. Los alcances son `drive.readonly` para descubrir originales subidos manualmente y `drive.file` para crear las carpetas y las copias preparadas. No se solicita permiso general de edición o borrado. Revisar el estado de publicación del cliente OAuth: los refresh tokens de aplicaciones en Testing pueden vencer a los siete días.
4. Ejecutar `node scripts/prepare-participant-photo-folders.mjs --remote --credentials-file /ruta/privada/fotos.json --event-id edomex-2026-otono --output-file /ruta/privada/carpetas.json`. La lista se obtiene de academias/coreografías de la edición en D1, sin modificar registros ni leer música. Procesa lotes de hasta ocho coreografías y puede repetirse sin duplicar carpetas. Prepara además la carpeta privada de previews y verifica en Ati las dos imágenes de demo aprobadas desde los assets locales.
5. Publicar el código verificado y cargar únicamente los cuatro secretos nuevos. Vincular la raíz de originales en Foto y video; verificar una lectura del pasaporte y que los recursos históricos sigan disponibles. No activar la configuración parcial durante el alta.

## Autorización histórica

Sin una conexión nueva de fotos se reutilizan los secretos `GOOGLE_DRIVE_OAUTH_CLIENT_ID`, `GOOGLE_DRIVE_OAUTH_CLIENT_SECRET` y `GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN`. Los identificadores de cliente pueden conservar la compatibilidad existente con `GMAIL_OAUTH_CLIENT_ID` y `GMAIL_OAUTH_CLIENT_SECRET`; el refresh token de Gmail no se usa para Drive. Si no hay configuración OAuth específica, se admite la cuenta de servicio existente con `GOOGLE_DRIVE_CLIENT_EMAIL` y `GOOGLE_DRIVE_PRIVATE_KEY`.

El diagnóstico y la selección de carpeta no crean credenciales ni modifican permisos en Google; la autorización independiente se realiza durante el alta operativa descrita arriba. El acceso efectivo a una carpeta debe verificarse con la misma autorización que usa la web. Compartir una carpeta con una cuenta no necesariamente la autoriza para una aplicación con alcance `drive.file`; si Google la rechaza, hay que revisar el acceso otorgado a la aplicación.

Las credenciales registradas no se consideran una conexión válida por sí solas. El servidor obtiene un token y consulta `about.get` con campos limitados de cuenta y almacenamiento. Solo entonces muestra **Drive conectado**, con la cuenta utilizada. Los errores del proveedor no se envían al navegador ni se copian completos a los logs de autenticación.

## Seleccionar la carpeta después

Sin carpeta guardada, una conexión válida muestra **Carpeta pendiente**. No se hereda `REGISTRATION_MUSIC_DRIVE_FOLDER_ID` ni `GOOGLE_DRIVE_MUSIC_FOLDER_ID`.

El administrador puede pegar un ID o enlace de carpeta de `drive.google.com`. El servidor extrae el ID; nunca hace una petición a la URL recibida. Luego consulta exclusivamente `files.get` en Google, con `supportsAllDrives=true`, y verifica el ID, tipo carpeta, nombre, ausencia de papelera y permiso para listar su contenido. Un acceso de lectura es suficiente para vincular; el permiso para agregar archivos se informa por separado.

Solo una carpeta verificada se guarda en `registration_media_drive_settings`, bajo la clave `photo_video`, con ID, nombre, unidad compartida si corresponde, administrador y fecha. Una validación fallida conserva la selección anterior. Esta vinculación no importa archivos, no publica enlaces y no concede permisos a participantes.

## API

- `GET /api/registration/admin/media-drive/connection`: diagnóstico de autorización y de la carpeta guardada, si existe. No escribe en D1 ni actualiza la actividad de la sesión.
- `POST /api/registration/admin/media-drive/folder`: cuerpo `{ "folder": "ID o enlace de carpeta" }`. Comprueba Google y guarda únicamente la configuración verificada. Rechaza solicitudes de otro origen.

Ambas rutas autentican antes de leer la configuración o contactar Google. Todas las respuestas, incluidos errores, usan `Cache-Control: private, no-store` y `Vary: Cookie`. No aceptan tokens de administración por URL. Las consultas a Google tienen tiempos de espera y no siguen redirecciones con credenciales.

## Publicación

1. Ejecutar las pruebas de registro y compilar la web.
2. Aplicar únicamente `db/registration_media_drive_settings.sql` a una instalación ya preparada. Es una tabla aditiva vacía; no modifica música, recursos, órdenes, pagos ni QR existentes.
3. Publicar el Worker conservando los secretos actuales.
4. Abrir Foto y video como administrador y comprobar el resultado real de Google. La carpeta puede permanecer pendiente hasta que se defina el destino.

La conexión de fotos se integra con la búsqueda automática del pasaporte y sus previews protegidas. El acceso del fotógrafo desde otra cuenta requiere un flujo de colaboración específico; actualmente los originales y previews se validan como privados y propiedad de Ati.
