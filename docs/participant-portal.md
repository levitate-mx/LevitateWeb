# Mi Levitate · Experiencia de participante

El ejemplo público muestra la experiencia con datos ilustrativos. El material real se administra como borrador y solo resulta visible para participantes después de su publicación explícita.

## Experiencia

`/mi-levitate` abre el espacio individual desde el QR del diploma. El nombre es el protagonista; los colores, Inter, botones y proporciones siguen la web actual. No hay folio visible ni foto grupal en la portada.

Cada presentación conserva su puntaje y escala, medalla, hoja de jueceo y galería. Un selector cambia estos contenidos juntos. El lugar se muestra únicamente si el resultado publicado declara competencia directa, al menos dos presentaciones elegibles y un lugar oficial entre 1 y 3. La medalla no se calcula a partir del lugar ni se adivina a partir de una escala fija.

El diploma pertenece al participante y la edición. La galería y el jueceo pertenecen a la presentación: los integrantes de una pieza grupal reciben el mismo álbum sin duplicar archivos.

Los accesos emitidos identifican al participante por su ID de registro. Para las ediciones configuradas explícitamente en `PARTICIPANT_REGISTRATION_EVENT_IDS`, el portal consulta sus pertenencias a coreografías de la sede aunque todavía no exista una ficha editorial. Estas presentaciones mantienen un ID estable `registration:<danceId>` y muestran el material pendiente; cuando existe una ficha de la edición, se conserva su ID, evaluación y publicación. La consulta no crea registros. Una edición futura de la misma sede no hereda esta asociación salvo configuración explícita.

El acceso acepta una comilla final o un par de comillas concordantes que puedan acompañar una celda CSV copiada. La clave sigue exigiendo sus 43 caracteres exactos: no se recortan caracteres internos ni se vuelve a decodificar. El fragmento se retira antes de solicitar datos. Si se abre otro acceso en la misma pestaña, el portal oculta el perfil anterior y vuelve a identificar a la persona; los canjes se realizan en orden para impedir cruces de sesiones.

El ejemplo público está en `/mi-levitate/demo`; usa datos ilustrativos y dos imágenes de archivo identificadas como tales, una de ellas desenfocada como archivo derivado. Las imágenes se leen desde las copias privadas preparadas en Drive, mediante dos rutas fijas de demostración. El enlace con punto final `/mi-levitate/demo.` funciona como alias de la misma demo. Ninguna variante acepta accesos privados ni abre una sesión real. En desarrollo también puede abrirse con `/mi-levitate?preview=1`. La galería real admite el conjunto de fotografías cargadas; muestra las primeras 20 y permite continuar, con carga diferida y visor accesible.

## Resumen, Drive y revisión interna

Después de la portada, el espacio abre directamente el reconocimiento autenticado y continúa con jueceo y fotografías. El reconocimiento pertenece al participante y la edición; los selectores de presentación sincronizan el jueceo y el álbum. Los estados se calculan a partir de los archivos y resultados disponibles, no de que Drive esté conectado. Una carpeta de Drive vinculada no equivale a un álbum cargado o publicado.

`/admin/foto-video` conserva las compras y la conexión de Drive, y enlaza a la gestión de Mi Levitate. `/admin/mi-levitate` reutiliza el mismo panel de conexión, permite seleccionar la edición y el participante, y abre **Revisar su resumen de Mi Levitate**. La navegación administrativa incluye una entrada directa a Mi Levitate.

La revisión usa `/admin/mi-levitate/resumen?eventId=…&participantId=…`. Esta página exige una sesión administrativa y solicita una proyección de lectura en `GET /api/registration/admin/participant-portal?preview=1&eventId=…&participantId=…`. El servidor devuelve la misma estructura del portal más `adminPreview: true`, con los borradores de esa persona y edición. Los archivos se consultan por el endpoint administrativo; las URLs públicas del participante mantienen sus controles de acceso y publicación.

Abrir la revisión no genera QR, accesos o sesiones de participante, no modifica los borradores y no publica la edición. La vista interna no es un enlace de entrega ni debe imprimirse en las tarjetas PVC. Los PVC personalizados utilizan los accesos individuales reales ya emitidos por el proceso aprobado de diplomas; activar fotografías conserva esos QR.

Los originales permanecen en Drive. Vincular su carpeta no importa automáticamente el contenido: el operador selecciona las fotos de cada presentación. El navegador administrativo o el procesador local genera las copias reducidas con marca de agua antes de cargarlas. Esas copias se guardan en una carpeta privada independiente de música, originales y QRs. Las rutas autenticadas de Mi Levitate entregan los archivos; los participantes no reciben enlaces, credenciales ni permisos de Drive. La cuenta y la carpeta de almacenamiento se muestran únicamente en administración. El contrato actual de la galería incluye fotografías; no se anuncia un video disponible mientras no exista un archivo y una entrega de video implementados.

La relación entre archivo, edición, coreografía y participantes se conserva en D1. Drive almacena los bytes; no se emparejan fotografías por nombre de archivo, nombre de persona o CURP. Las copias incluyen un registro de preparación `levitate-preview-v2`, con dimensiones e integridad. El servidor comprueba ese registro y la integridad del archivo antes de servirlo, sin procesar sus píxeles. Este registro previene cargas equivocadas o modificaciones del JPEG; no prueba por sí solo que los píxeles contengan una marca. La preparación pertenece al flujo de administradores autenticados y confiables, mediante el navegador o `participant-portal-media.py --for-upload`.

## Flujo para operar el evento

1. Crear la edición en `/admin/mi-levitate`, inicialmente oculta.
2. Vincular las presentaciones mediante su ID de inscripción; cuando exista fuente de jueceo, conservar su evento y rutina de origen. No emparejar personas o piezas solo por nombre.
3. Vincular el evento y el programa de JueceoCore una sola vez mediante **Hojas de jueceo automáticas**. Sus criterios, puntajes, penalizaciones y observaciones se consultan directamente al abrir el resumen; la descarga genera un PDF por juez dentro de un mismo documento, sin cargarlo ni guardarlo en Drive. Los resultados oficiales generales (puntaje, máximo, medalla y lugar) conservan su publicación independiente.
4. Reutilizar los accesos individuales ya emitidos. Para una edición nueva, crear sus accesos y generar los diplomas por lote. Revisar los PDF antes de publicarlos; también se pueden cargar diplomas ya aprobados. La activación de fotografías no requiere reemplazar los QR actuales.
5. Pedir al fotógrafo carpetas identificadas por presentación. Cargar 10–20 fotografías por pieza desde administración, o preparar el lote con `participant-portal-media.py --for-upload`. La computadora del operador genera las vistas con marca de agua antes de subirlas; cada álbum se carga una vez para sus integrantes.
6. Aprobar los archivos, publicar la presentación y hacer visible la edición. Los documentos tienen su publicación independiente.
7. Entregar cada QR al participante o su responsable. Un acceso puede revocarse o reemplazarse. Al reemplazarlo, el QR anterior deja de abrir el espacio.

El QR es una llave personal: quien lo tenga puede consultar ese espacio. Para compartir en redes conviene usar una imagen del reconocimiento sin su QR privado. Este sistema no incorpora reconocimiento facial, cobro ni entrega de originales comprados. Las fotografías se entregan como vistas previas; cualquier descarga adicional debe habilitarse explícitamente.

## Qué está implementado

- Portal responsive, selector de presentaciones, estados en revisión, visor de fotos y lectura de jueceo.
- Hojas de JueceoCore por coreografía y juez, generadas como PDF A4 en el navegador con el formato de la app. Las hojas largas continúan en otras páginas sin omitir criterios ni observaciones.
- API D1 de participantes, publicación y archivos; autorización por pertenencia a la presentación.
- Sesión privada por cookie; el enlace QR se intercambia por la sesión y desaparece del fragmento. Los tokens se guardan como hash.
- Panel de edición, búsqueda y paginación de participantes, presentaciones y archivos.
- Diplomas PDF carta con nombre, logo y QR; QR SVG individuales; importaciones y generación en lote.
- Preparación automática de vistas previas JPEG con marca de agua y sin metadatos EXIF en el navegador administrativo; preparación equivalente mediante Pillow para las cargas en lote.
- Almacenamiento de copias en Drive privado mediante la autorización existente de `musica.levitate@gmail.com`, con comprobación de cuenta, carpeta y cuota; la asociación de archivos permanece en D1.
- Validación del JPEG preparado, su versión, dimensiones e integridad antes de aceptarlo o entregarlo. El Worker no ejecuta el procesamiento de imágenes durante las consultas.
- Borradores, publicación, revocación, versiones de resultados y registro del administrador que los modificó.
- Preparación aditiva del esquema, sin crear tablas durante peticiones de participantes.

## Configuración y activación

La configuración usa `PARTICIPANT_MEDIA_DRIVE_ACCOUNT_EMAIL = "musica.levitate@gmail.com"` y reutiliza la autorización existente de Google Drive. El perfil Ati de Chrome es independiente de la cuenta OAuth que almacena archivos de la web. El 9 de noviembre de 2026 se verificaron la cuenta y la cuota y se creó la carpeta **Mi Levitate · Vistas previas privadas** mediante la sesión administrativa normal. Esta ruta aprovecha el Drive, D1 y el plan gratuito del Worker actuales. No requiere contratar R2 ni Workers Paid ni activar ampliaciones de almacenamiento o facturación.

1. Confirmar que la autorización existente de Drive corresponde a `musica.levitate@gmail.com` y permite crear archivos de la aplicación. El servidor debe rechazar otra cuenta antes de crear o cargar material. Se reutilizan las credenciales descritas en [la conexión de Drive](media-drive-connection.md), sin enviarlas al navegador ni ampliar sus alcances automáticamente.
2. Ejecutar las pruebas y compilar; desplegar mediante `npm run deploy`, conservando los secretos existentes. La aplicación puede mostrar el almacenamiento pendiente hasta preparar su carpeta; no debe simular una conexión lista ni publicar fotos de ejemplo en perfiles reales.
3. Como administrador autenticado, usar **Preparar carpeta privada en Drive** en `/admin/mi-levitate`. La acción `storage.prepare` comprueba cuenta y cuota y crea o reutiliza una carpeta propia de la aplicación en la cuenta autorizada. Se mantiene separada de carpetas compartidas, música, originales y QRs; no se habilitan permisos públicos o de dominio. La aplicación descubre su referencia mediante `appProperties` de Drive, sin crear tablas ni alterar la configuración de música o de originales. `GET /api/registration/admin/participant-portal?storage=1` comprueba el estado sin crear la carpeta.
4. El esquema aditivo de `db/registration_participant_portal.sql` ya está aplicado. La consulta de lectura del 9 de noviembre de 2026 encontró la edición real `edomex-2026-otono` oculta (`published = 0`), sin fichas editoriales ni archivos del portal. Conservar los 262 accesos emitidos, las inscripciones, resultados y relaciones actuales. Esta activación no requiere crear o reemplazar accesos ni crear otra base de datos.
5. Ejecutar la comprobación interna de almacenamiento. Las copias de fotos deben llegar preparadas, medir hasta 1600 píxeles por lado y pesar como máximo 1 MB; los PDF admiten hasta 8 MB. El preparador ajusta calidad y tamaño automáticamente antes de cargar. El Worker valida y entrega archivos mediante su API autenticada, con operaciones acotadas para el plan actual. Drive conserva sus cuotas y espacio disponibles; una cuota agotada debe detener la operación, sin contratar ampliaciones automáticamente. Ver [el flujo de lotes](participant-portal-batch.md).
6. Antes de publicar material real, revisar arte, nombres, correspondencias y resultados oficiales. La plantilla de reconocimientos conserva el arte de Otoño 2026 y rechaza nombres que no caben, sin truncar la identidad. Las hojas de jueceo leen automáticamente la fuente de JueceoCore vinculada, mientras el dictamen general y los documentos conservan su publicación independiente.

## Hojas automáticas desde JueceoCore

1. Exportar el programa de esta web e importar **ese mismo archivo** en la app de jueceo. El archivo conserva números consecutivos en la columna `ID` y añade `ID INSCRIPCIÓN` para mantener la identidad de cada coreografía, sin sustituir sus números por UUID. Los programas antiguos sin estas columnas no permiten reconstruir una relación segura por nombres; no se intenta adivinarla.
2. En `/admin/mi-levitate`, elegir la edición y un evento de Levitate autorizado en **Hojas de jueceo automáticas**. Elegir el mismo archivo en **Vincular el programa de competencia**, revisar su conteo y confirmar la asociación una sola vez. El servidor valida IDs, sede, nombre y academia contra ambos programas antes de guardar el lote atómicamente. Rechaza duplicados, eventos ajenos y asociaciones existentes diferentes; conserva resultados, fotos, QR y estados previos.
3. Al abrir el resumen, el servidor verifica sesión y pertenencia y consulta únicamente eventos autorizados de JueceoCore. Una edición visible con conexión automática habilitada permite las hojas completas de las coreografías vinculadas, independientemente de los borradores de fotos o resultados. Sin conexión automática, los vínculos individuales conservan los controles anteriores de publicación de la ficha. Una edición oculta nunca expone estas hojas al participante. Desactivar la conexión conserva sus referencias y detiene la consulta remota.
4. Las hojas incompletas permanecen pendientes para participantes. Administración puede revisar evaluaciones parciales con marca **VISTA PREVIA - NO OFICIAL**. Que exista un puntaje numérico o que el evento esté activo no prueba cierre administrativo: se exige que estén completos todos los criterios de los jueces esperados. Los ceros explícitos son calificaciones válidas.
5. **Descargar hojas de jueceo** genera localmente un PDF A4 con una hoja por juez y páginas adicionales cuando hagan falta. El subtotal individual suma los criterios sin las ponderaciones del dictamen; el total sigue la app: `subtotal > 0 ? max(0, subtotal + penalización) : 0`. El máximo utiliza el de la plantilla, con respaldo en la suma de máximos. El PDF incluye criterios, penalización y retroalimentación; no consulta Drive ni crea archivos en el almacenamiento. Las descargas pendientes se cancelan al cambiar de persona, edición o coreografía.

La relación edición → evento se guarda en `participant_portal_judging_sources`, en la D1 existente; las relaciones exactas coreografía → rutina utilizan los campos de origen ya existentes. Los GET no crean fichas ni cambian calificaciones. La conexión de Supabase sigue siendo de solo lectura y con la clave de aplicación en el servidor. Una falla de la fuente deja el jueceo no disponible sin impedir consultar fotos o diplomas; no entrega una hoja manual vieja como sustituto de una fuente vinculada.

La consulta del 9 de noviembre de 2026 encontró solo eventos de prueba en JueceoCore y ninguna calificación cargada. No se vinculó una demo con la edición real ni se publicó esa edición. El programa real debe estar importado y asociado antes de que sus hojas puedan aparecer.

### Comprobación interna de almacenamiento

La comprobación inicial puede usar **Guardar fotos de la demo en Drive**. Esta acción administrativa copia únicamente las dos imágenes de archivo aprobadas de la demo. No crea fichas, eventos, accesos ni asociaciones a participantes. Sus rutas públicas `/media/mi-levitate-demo/foto-1.jpg` y `/media/mi-levitate-demo/foto-2.jpg` leen las copias privadas de Drive y verifican el hash, tamaño y dimensiones contra la lista fija incluida en el código. No aceptan otros archivos, IDs o consultas; los recursos de participantes reales conservan su autenticación. La caché de esta demo dura cinco minutos y está ligada al hash de cada imagen. La cabecera `X-Levitate-Media-Source: google-drive` permite verificar la fuente; no hay sustitución por archivos estáticos si Drive falla.

El 9 de noviembre de 2026 se guardaron ambas copias desde la sesión administrativa del perfil Ati. Las dos rutas devolvieron JPEG desde `google-drive`, con los tamaños y hashes esperados; también se verificaron la galería y el visor en la web publicada. Las rutas desconocidas y los parámetros de archivo arbitrarios devolvieron 404. Esta prueba no creó ni publicó material de participantes reales.

Para comprobar una galería personal adicional antes de publicar material real:

Usar una sesión administrativa legítima y una edición separada, oculta y claramente identificada como prueba interna. Conservar el evento real, sus fichas y los accesos existentes sin modificaciones.

1. Crear una edición interna con `published: false` y una ficha en borrador vinculada a una coreografía existente de la misma sede, con `result: null`, `judging: null` y `photosPublished: false`. Esta ficha pertenece únicamente a la edición interna; no llamar a `routine.save` sobre una ficha real, porque esa operación actualiza sus resultados y la devuelve a borrador.
2. Cargar una única imagen de prueba identificada como «VERIFICACIÓN INTERNA · NO PUBLICAR», con `allowDownload: false` y un `uploadId` fijo para reutilizar la carga si se repite. No publicar el evento, la ficha ni el archivo y no emitir un acceso QR para esa edición.
3. Revisar el archivo mediante la ruta administrativa autenticada y el resumen interno de un integrante de esa coreografía. Comprobar JPEG válido, orientación, tamaño, marca incorporada y metadatos retirados. Reintentar la misma carga y verificar que no se duplique.
4. Comprobar que una solicitud sin sesión no recibe el archivo, y que un acceso de la edición real tampoco puede leer la imagen de prueba. La carpeta y los archivos de Drive deben conservar permisos restringidos; el perfil del participante recibe únicamente las rutas autenticadas de Mi Levitate. Verificar que los estados del evento real, las fichas, los resultados y los accesos coincidan con la lectura previa.
5. Dejar los registros de comprobación ocultos y etiquetados como internos; no aprobarlos ni borrar registros o archivos existentes. Registrar sus identificadores y el resultado de la comprobación en un archivo privado de operación. Una prueba adicional de publicación visible debe usar material real revisado y tener alcance explícito.

Mientras la cuenta o carpeta de almacenamiento no esté verificada, las consultas de datos siguen funcionando y las cargas o descargas de archivos devuelven una indisponibilidad explícita. Los archivos sin preparación válida o con integridad alterada se rechazan; no se entrega un original como sustituto. La demo identifica sus fotos como imágenes de archivo, independientes de la participante ficticia.

## Ejecución y validación

```text
npm install
npm run dev
npm run build
npm run test:registration
python3 -m unittest discover -s tests -p participant_portal_media_test.py
```

Ver `docs/participant-portal-batch.md` para manifiestos, generación de diplomas y carga masiva. El modo de lote predeterminado solo valida; `--apply` escribe borradores y `--publish` publica explícitamente.

Referencias primarias de la implementación: [D1 Worker API](https://developers.cloudflare.com/d1/worker-api/d1-database/), [cargas de Google Drive](https://developers.google.com/workspace/drive/api/guides/manage-uploads), [descargas de Google Drive](https://developers.google.com/workspace/drive/api/guides/manage-downloads), [cuotas de Google Drive](https://developers.google.com/workspace/drive/api/guides/limits), [PDF-LIB](https://pdf-lib.js.org/docs/api/classes/pdfdocument).
