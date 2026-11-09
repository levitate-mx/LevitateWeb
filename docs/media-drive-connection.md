# Conexión de Google Drive para foto y video

En `/admin/foto-video`, el panel **Drive para foto y video** comprueba la autorización existente y permite vincular una carpeta independiente de música. Requiere la sesión normal de un administrador global.

## Autorización existente

Se reutilizan los secretos `GOOGLE_DRIVE_OAUTH_CLIENT_ID`, `GOOGLE_DRIVE_OAUTH_CLIENT_SECRET` y `GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN`. Los identificadores de cliente pueden conservar la compatibilidad existente con `GMAIL_OAUTH_CLIENT_ID` y `GMAIL_OAUTH_CLIENT_SECRET`; el refresh token de Gmail no se usa para Drive. Si no hay configuración OAuth específica, se admite la cuenta de servicio existente con `GOOGLE_DRIVE_CLIENT_EMAIL` y `GOOGLE_DRIVE_PRIVATE_KEY`.

No se crean credenciales, no se amplían sus alcances y no se modifican permisos en Google. El acceso efectivo a una carpeta debe verificarse con la misma autorización que usa la web. Compartir una carpeta con una cuenta no necesariamente la autoriza para una aplicación con alcance `drive.file`; si Google la rechaza, hay que revisar el acceso otorgado a la aplicación.

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

Este alcance prepara la conexión y la selección de carpeta. Las galerías, asociaciones por usuario, vistas previas con blur y rol específico del encargado se implementan por separado.
