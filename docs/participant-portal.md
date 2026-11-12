# Mi Levitate · Experiencia de participante

El ejemplo público muestra la experiencia con datos ilustrativos. El material real se administra como borrador y solo resulta visible para participantes después de su publicación explícita.

## Experiencia

`/mi-levitate` abre el espacio individual desde el QR del diploma. El nombre es el protagonista; los colores, Inter, botones y proporciones siguen la web actual. No hay folio visible ni foto grupal en la portada.

Los [invitados sin CURP](participant-portal-guests.md) utilizan el mismo portal
y diseño, con su identidad y sus presentaciones guardadas aparte del registro.

Cada presentación conserva su puntaje y escala, medalla, hoja de jueceo y galería. Un selector cambia estos contenidos juntos. El lugar se muestra únicamente si el resultado publicado declara competencia directa, al menos dos presentaciones elegibles y un lugar oficial entre 1 y 3. La medalla no se calcula a partir del lugar ni se adivina a partir de una escala fija.

El diploma pertenece al participante y la edición. La galería y el jueceo pertenecen a la presentación: los integrantes de una pieza grupal reciben el mismo álbum sin duplicar archivos.

Los accesos emitidos identifican al participante por su ID de registro. Para las ediciones configuradas explícitamente en `PARTICIPANT_REGISTRATION_EVENT_IDS`, el portal consulta sus pertenencias a coreografías de la sede aunque todavía no exista una ficha editorial. Estas presentaciones mantienen un ID estable `registration:<danceId>` y muestran el material pendiente; cuando existe una ficha de la edición, se conserva su ID, evaluación y publicación. La consulta no crea registros. Una edición futura de la misma sede no hereda esta asociación salvo configuración explícita.

El acceso acepta una comilla final o un par de comillas concordantes que puedan acompañar una celda CSV copiada. La clave sigue exigiendo sus 43 caracteres exactos: no se recortan caracteres internos ni se vuelve a decodificar. El fragmento se retira antes de solicitar datos. Si se abre otro acceso en la misma pestaña, el portal oculta el perfil anterior y vuelve a identificar a la persona; los canjes se realizan en orden para impedir cruces de sesiones.

El ejemplo público está en `/mi-levitate/demo`; usa datos ilustrativos y dos imágenes de archivo identificadas como tales, una de ellas desenfocada como archivo derivado. Las imágenes se leen desde las copias privadas preparadas en Drive, mediante dos rutas fijas de demostración. El enlace con punto final `/mi-levitate/demo.` funciona como alias de la misma demo. Ninguna variante acepta accesos privados ni abre una sesión real. En desarrollo también puede abrirse con `/mi-levitate?preview=1`. La galería real admite el conjunto de fotografías cargadas; muestra las primeras 20 y permite continuar, con carga diferida y visor accesible.

## Resumen, Drive y revisión interna

Después de la portada, el espacio abre directamente el reconocimiento autenticado y continúa con jueceo y fotografías. El reconocimiento pertenece al participante y la edición; los selectores de presentación sincronizan el jueceo y el álbum. Los estados se calculan a partir de los archivos y resultados disponibles, no de que Drive esté conectado. Una carpeta de Drive vinculada no equivale a un álbum cargado o publicado.

`/admin/foto-video` conserva las compras y la conexión de Drive, y enlaza a la gestión de Mi Levitate. `/admin/mi-levitate` reutiliza el mismo panel de conexión, permite seleccionar la edición y el participante, y abre **Revisar su resumen de Mi Levitate**. La navegación administrativa incluye una entrada directa a Mi Levitate.

La revisión usa `/admin/mi-levitate/resumen?eventId=…&participantId=…`. Esta página exige una sesión administrativa y solicita una proyección de lectura en `GET /api/registration/admin/participant-portal?preview=1&eventId=…&participantId=…`. El servidor devuelve la misma estructura del portal más `adminPreview: true`, con los borradores de esa persona y edición. Los archivos se consultan por el endpoint administrativo; las URLs públicas del participante mantienen sus controles de acceso y publicación.

Abrir la revisión no genera QR, accesos o sesiones de participante ni publica la edición. Sus GET son de lectura; después de cargar el resumen, el navegador inicia un POST autenticado para buscar y preparar fotografías nuevas en borrador. La vista interna no es un enlace de entrega ni debe imprimirse en las tarjetas PVC. Los PVC personalizados utilizan los accesos individuales reales ya emitidos por el proceso aprobado de diplomas; activar fotografías conserva esos QR.

Los originales permanecen en Drive. Las carpetas gestionadas de fotografías se consultan automáticamente al abrir el pasaporte, con la identidad y pertenencias obtenidas de la sesión. La vinculación general de una carpeta de respaldo sigue siendo independiente. También se conservan las cargas manuales desde el navegador administrativo y el procesador local. Las copias reducidas con marca de agua se guardan en una carpeta privada independiente de música, originales y QRs. Las rutas autenticadas de Mi Levitate entregan los archivos; los participantes no reciben enlaces, credenciales ni permisos de Drive. La cuenta y la carpeta de almacenamiento se muestran únicamente en administración. El contrato actual de la galería incluye fotografías; no se anuncia un video disponible mientras no exista un archivo y una entrega de video implementados.

La relación entre archivo, edición, coreografía y participantes se conserva en D1. Drive almacena los bytes. La búsqueda inicial utiliza nombre completo, academia y coreografía dentro de la raíz de fotos autorizada y verifica los identificadores de edición y pertenencia. Una vez vinculada, conserva el ID de la carpeta. Las copias incluyen un registro de preparación `levitate-preview-v2`, con dimensiones e integridad. El servidor genera las previews automáticas con marca rasterizada y valida las copias antes de servirlas. El registro de preparación previene cargas equivocadas o modificaciones del JPEG; no prueba por sí solo que los píxeles contengan una marca, por lo que las cargas manuales mantienen el procesador de administradores confiables del navegador o `participant-portal-media.py --for-upload`.

### Prueba de carpeta por coreografía y participante

En administración, seleccionar una persona y **Probar fotos desde Drive** permite elegir únicamente una de sus coreografías de la sede. La acción `photo.demo.trial` crea o reutiliza una carpeta `coreografía · participante · DEMO` en una raíz independiente **Mi Levitate · Fotos por coreografía**, usando la cuenta OAuth configurada para las fotos. Los identificadores de edición y coreografía se guardan en `appProperties` privados de la misma aplicación; el nombre de la carpeta sirve al operador y no determina la identidad.

La prueba copia exclusivamente las dos fotografías archivadas de demostración, ya reducidas y marcadas. Las descarga otra vez desde Drive, verifica contenido y privacidad y las incorpora como archivos en borrador a la presentación. Las copias de entrega permanecen en la raíz privada de previews: no se mueven los archivos de la demo actual ni se modifica música, originales, notas, QR o visibilidad de la edición. Una ficha de presentación existente se conserva íntegra. Repetir la operación reutiliza los archivos mediante una clave estable.

El resultado ofrece enlaces a la carpeta de Drive y al resumen administrativo del participante. Las imágenes están rotuladas como demostración y exigen sesión administrativa mientras estén en borrador. **Preparar foto sin marca para prueba automática** agrega una fotografía de archivo sin marca a esa carpeta, incorporando nombre de academia e identificadores explícitos de persona y academia. Esta preparación no genera una preview: abrir el resumen dispara su generación y permite comprobar el flujo completo con un original sin marca. Los archivos anteriores se conservan.

### Búsqueda y preparación al abrir el pasaporte

El resumen inicia `POST /api/participant/photos/sync` después de validar su sesión. La ruta obtiene la persona y edición del acceso; no acepta elegir otra identidad. La revisión interna usa la acción administrativa `photo.sync`. El navegador recibe únicamente estado y conteos, y después vuelve a leer su perfil para mostrar las nuevas previews. Los originales y las URLs firmadas de Google permanecen en el servidor. Los GET de perfiles y archivos conservan sus comprobaciones de sesión, edición, pertenencia y publicación.

La búsqueda se limita a **Mi Levitate · Fotos por coreografía**, separada de música y del almacenamiento de previews. Compara nombre completo, academia y coreografía normalizados; valida propietario, privacidad y metadatos de edición/coreografía/persona/academia. Una coincidencia ambigua queda pendiente. Las carpetas vinculadas se vuelven a comprobar por ID aunque cambien de nombre. Se seleccionan hasta dos fuentes por álbum, se procesa una por petición y los archivos preparados previamente se excluyen de la búsqueda de originales.

`IMAGES` transforma los bytes privados con un máximo de 800 px, elimina EXIF y dibuja repetidamente la marca en los píxeles antes de producir el JPEG. Puede desenfocar antes de dibujar la marca. La copia resultante se valida y guarda en Drive privado; D1 conserva vínculos, versiones y bloqueos breves para evitar trabajo duplicado. Una consulta terminada se reutiliza durante un minuto. Cerrar o cambiar de pasaporte cancela el trabajo del navegador y las respuestas tardías no cambian la identidad abierta.

La revisión administrativa y los álbumes demo generan archivos en borrador. Los álbumes reales con identificación explícita permiten la publicación automática de previews bajo los controles de edición, galería y bloque; las retenciones administrativas se conservan. No se modifican notas, QR, pagos, música ni la visibilidad global de la edición. Una falla del procesador mantiene el pasaporte disponible y nunca entrega el original como sustituto.

Se utiliza únicamente la transformación de **Images Free**, sin almacenamiento de Images ni suscripción pagada. El plan gratuito admite 5.000 transformaciones mensuales y rechaza las nuevas cuando se supera la cuota, sin cobrar excedentes. [Condiciones del plan gratuito](https://developers.cloudflare.com/images/pricing/). Los resultados preparados quedan guardados en Drive para no volver a transformarlos en cada visita.

## Flujo para operar el evento

1. Crear la edición en `/admin/mi-levitate`, inicialmente oculta.
2. Exportar el programa de una sola sede desde administración e importar ese archivo en la app. La exportación identifica la edición, conserva números estables por coreografía y contiene una autorización acotada de vinculación. El importador confirma automáticamente la asociación con Mi Levitate, sin volver a subir el archivo al panel.
3. Los criterios, puntajes, penalizaciones, observaciones y resultados oficiales se consultan directamente desde JueceoCore. La descarga genera un PDF por juez dentro de un mismo documento, sin cargarlo ni guardarlo en Drive. Los lugares esperan a que esté completa la categoría correspondiente.
4. Reutilizar los accesos individuales ya emitidos. El reconocimiento digital se genera al descargarlo, con el nombre, academia y edición de la persona identificada. No crea ni reemplaza sus QR y no necesita guardarse en Drive. Los PDF personalizados aprobados anteriormente mantienen prioridad.
5. Pedir al fotógrafo carpetas identificadas por presentación. Cargar 10–20 fotografías por pieza desde administración, o preparar el lote con `participant-portal-media.py --for-upload`. La computadora del operador genera las vistas con marca de agua antes de subirlas; cada álbum se carga una vez para sus integrantes.
6. Elegir **Cuando terminen todos los jueces** para que el pasaporte consulte las notas y libere cada bloque completo automáticamente. Aprobar los archivos de fotos y habilitar su galería. Hacer visible la edición cuando corresponda. También se conservan la publicación individual y el cierre administrativo como opciones alternativas. Los documentos tienen su publicación independiente.
7. Entregar cada QR al participante o su responsable. Un acceso puede revocarse o reemplazarse. Al reemplazarlo, el QR anterior deja de abrir el espacio.

El QR es una llave personal: quien lo tenga puede consultar ese espacio. Para compartir en redes conviene usar una imagen del reconocimiento sin su QR privado. Este sistema no incorpora reconocimiento facial, cobro ni entrega de originales comprados. Las fotografías se entregan como vistas previas; cualquier descarga adicional debe habilitarse explícitamente.

## Qué está implementado

- Portal responsive, selector de presentaciones, estados en revisión, visor de fotos y lectura de jueceo.
- Hojas de JueceoCore por coreografía y juez, generadas como PDF A4 en el navegador con el formato de la app. Las hojas largas continúan en otras páginas sin omitir criterios ni observaciones.
- API D1 de participantes, publicación y archivos; autorización por pertenencia a la presentación.
- Sesión privada por cookie; el enlace QR se intercambia por la sesión y desaparece del fragmento. Los tokens se guardan como hash.
- Panel de edición, búsqueda y paginación de participantes, presentaciones y archivos.
- Reconocimientos PDF carta automáticos con nombre y academia; se conserva la plantilla aprobada y el acceso QR existente. Las herramientas anteriores de diplomas con QR, documentos personalizados y lotes siguen disponibles para operaciones especiales.
- Preparación automática de vistas previas JPEG con marca de agua y sin metadatos EXIF en el navegador administrativo; preparación equivalente mediante Pillow para las cargas en lote.
- Almacenamiento de copias en Drive privado mediante la autorización existente de `musica.levitate@gmail.com`, con comprobación de cuenta, carpeta y cuota; la asociación de archivos permanece en D1.
- Validación del JPEG preparado, su versión, dimensiones e integridad antes de aceptarlo o entregarlo. El Worker no ejecuta el procesamiento de imágenes durante las consultas.
- Borradores, publicación, revocación, versiones de resultados y registro del administrador que los modificó.
- Preparación aditiva del esquema, sin crear tablas durante peticiones de participantes.

## Publicación automática de los bloques

En **Mi Levitate → Publicación por bloque**, la opción **Cuando terminen todos los jueces** consulta JueceoCore al abrir el pasaporte y en sus actualizaciones. Un bloque muestra sus puntuaciones y hojas cuando todas sus coreografías tienen completas las evaluaciones de todos los jueces correspondientes. No necesita pulsar un botón de cierre ni guardar una copia de las notas en D1. Una lectura parcial, un vínculo ambiguo o una fuente no disponible mantiene el material pendiente; un puntaje de cero es válido.

Si se corrige una nota y el bloque sigue completo, el próximo acceso o refresco refleja el resultado actualizado. Si vuelve a faltar una evaluación, el material pasa nuevamente a pendiente. La comprobación usa la identidad y pertenencia reales del bloque, nunca `is_active`, su nombre visible o un cierre anterior. Las consultas no modifican notas, fichas ni estados de publicación en la base de datos.

Las fotografías mantienen sus controles independientes: cada archivo debe estar aprobado y su galería habilitada. La edición debe estar visible para que cualquier material llegue al participante. Retirar una presentación desde administración pausa su publicación automática hasta volver a publicarla; guardar o importar una ficha nueva en borrador no cuenta como una retirada. Los reconocimientos conservan su publicación independiente.

También se conservan **Publicación individual** y **Al cerrar cada bloque**. Esta última exige revisión y cierre administrativo, registra al administrador y una huella del programa y de la evaluación, y permite **Reabrir y ocultar** sin borrar notas ni archivos. Sus cierres anteriores no son necesarios ni autorizan la publicación cuando se elige el modo automático por evaluación completa. Las rutas directas de archivos aplican el mismo control que el resumen.

Cambiar la opción no abre la edición ni modifica accesos, QR, música o evaluaciones de JueceoCore. Una edición todavía sin programa puede dejar preparada la opción; sus bloques aparecerán después de vincular el programa real.

Los perfiles reales abiertos actualizan su contenido cada 60 segundos mientras la pestaña está visible y al volver a ella, con un mínimo de 30 segundos entre consultas. Conservan la presentación seleccionada y cancelan descargas pendientes si cambian la identidad, la edición o la publicación. Las páginas de ejemplo y la revisión administrativa no realizan este refresco automático.

La configuración y el historial se guardan en las tablas aditivas de `db/registration_participant_block_publication.sql`, dentro de la D1 existente; las dos banderas de compatibilidad están en `db/registration_participant_block_completion.sql` y las prepara el gestor de esquema existente. Las peticiones de lectura no crean ni modifican cierres. No se necesitan tareas programadas, servicios de pago ni nuevas bases de datos.

## Configuración y activación

La configuración usa `PARTICIPANT_MEDIA_DRIVE_ACCOUNT_EMAIL = "musica.levitate@gmail.com"` y reutiliza la autorización existente de Google Drive. El perfil Ati de Chrome es independiente de la cuenta OAuth que almacena archivos de la web. El 9 de noviembre de 2026 se verificaron la cuenta y la cuota y se creó la carpeta **Mi Levitate · Vistas previas privadas** mediante la sesión administrativa normal. Esta ruta aprovecha el Drive, D1 y el plan gratuito del Worker actuales. No requiere contratar R2 ni Workers Paid ni activar ampliaciones de almacenamiento o facturación.

1. Confirmar que la autorización existente de Drive corresponde a `musica.levitate@gmail.com` y permite crear archivos de la aplicación. El servidor debe rechazar otra cuenta antes de crear o cargar material. Se reutilizan las credenciales descritas en [la conexión de Drive](media-drive-connection.md), sin enviarlas al navegador ni ampliar sus alcances automáticamente.
2. Ejecutar las pruebas y compilar; desplegar mediante `npm run deploy`, conservando los secretos existentes. La aplicación puede mostrar el almacenamiento pendiente hasta preparar su carpeta; no debe simular una conexión lista ni publicar fotos de ejemplo en perfiles reales.
3. Como administrador autenticado, usar **Preparar carpeta privada en Drive** en `/admin/mi-levitate`. La acción `storage.prepare` comprueba cuenta y cuota y crea o reutiliza una carpeta propia de la aplicación en la cuenta autorizada. Se mantiene separada de carpetas compartidas, música, originales y QRs; no se habilitan permisos públicos o de dominio. La aplicación descubre su referencia mediante `appProperties` de Drive, sin crear tablas ni alterar la configuración de música o de originales. `GET /api/registration/admin/participant-portal?storage=1` comprueba el estado sin crear la carpeta.
4. El esquema aditivo de `db/registration_participant_portal.sql` ya está aplicado. La consulta de lectura del 9 de noviembre de 2026 encontró la edición real `edomex-2026-otono` oculta (`published = 0`), sin fichas editoriales ni archivos del portal. Conservar los 262 accesos emitidos, las inscripciones, resultados y relaciones actuales. Esta activación no requiere crear o reemplazar accesos ni crear otra base de datos.
5. Ejecutar la comprobación interna de almacenamiento. Las copias de fotos deben llegar preparadas, medir hasta 1600 píxeles por lado y pesar como máximo 1 MB; los PDF admiten hasta 8 MB. El preparador ajusta calidad y tamaño automáticamente antes de cargar. El Worker valida y entrega archivos mediante su API autenticada, con operaciones acotadas para el plan actual. Drive conserva sus cuotas y espacio disponibles; una cuota agotada debe detener la operación, sin contratar ampliaciones automáticamente. Ver [el flujo de lotes](participant-portal-batch.md).
6. Antes de publicar material real, revisar arte, nombres, correspondencias y resultados oficiales. La plantilla de reconocimientos conserva el arte de Otoño 2026 y ajusta los nombres completos dentro de su espacio. Las hojas y resultados leen automáticamente la fuente de JueceoCore vinculada. Configurar la publicación cuando terminen todos los jueces, individual o por cierre administrativo; la edición permanece oculta hasta que un administrador la haga visible.

## Hojas automáticas desde JueceoCore

1. Exportar el programa de una sola sede e importar **ese mismo archivo** en la app de jueceo. La API administrativa emite números estables y una autorización limitada a esa edición y a ese conjunto de coreografías. El archivo incluye `ID`, `ID INSCRIPCIÓN`, `ID EDICIÓN` y `TOKEN VINCULACIÓN`; las tres columnas internas permanecen ocultas para lectura e impresión, pero el importador las conserva. No se sustituye el número de jueceo por un UUID ni se imprime la autorización de integración.
2. El importador desplegado de JueceoCore confirma la vinculación automáticamente mediante `/api/integrations/jueceocore/program`. La autorización viaja únicamente en el cuerpo, no habilita administración ni sesiones de participante y su hash se guarda en D1. Vence a los 14 días y solo puede confirmar un evento de origen; reintentos del mismo evento son idempotentes y conservan una conexión deshabilitada por administración. El servidor autentica la referencia antes de leer datos, verifica el programa completo contra la fuente y guarda la asociación atómicamente. Rechaza ediciones mezcladas, duplicados, cambios de origen y conflictos concurrentes; conserva resultados, fotos, QR y estados previos. Los programas antiguos con solo `ID INSCRIPCIÓN` mantienen importación sin vinculación automática, y la alternativa manual queda dentro de **Vinculación de programas anteriores**.
3. Al abrir el resumen, el servidor verifica sesión y pertenencia y consulta únicamente eventos autorizados de JueceoCore. Una edición visible con conexión automática habilitada permite las hojas completas de las coreografías vinculadas, independientemente de los borradores de fotos o resultados. Sin conexión automática, los vínculos individuales conservan los controles anteriores de publicación de la ficha. Una edición oculta nunca expone estas hojas al participante. Desactivar la conexión conserva sus referencias y detiene la consulta remota.
4. Las hojas incompletas permanecen pendientes para participantes. Administración puede revisar evaluaciones parciales con marca **VISTA PREVIA - NO OFICIAL**. Que exista un puntaje numérico o que el evento esté activo no prueba cierre administrativo: se exige que estén completos todos los criterios de los jueces esperados. Los ceros explícitos son calificaciones válidas.
5. **Descargar hojas de jueceo** genera localmente un PDF A4 con una hoja por juez y páginas adicionales cuando hagan falta. El subtotal individual suma los criterios sin las ponderaciones del dictamen; el total sigue la app: `subtotal > 0 ? max(0, subtotal + penalización) : 0`. El máximo utiliza el de la plantilla, con respaldo en la suma de máximos. El PDF incluye criterios, penalización y retroalimentación; no consulta Drive ni crea archivos en el almacenamiento. Las descargas pendientes se cancelan al cambiar de persona, edición o coreografía.

La relación edición → evento se guarda en `participant_portal_judging_sources`, en la D1 existente; las relaciones exactas coreografía → rutina utilizan los campos de origen ya existentes. Los GET no crean fichas ni cambian calificaciones. La conexión de Supabase sigue siendo de solo lectura y con la clave de aplicación en el servidor. Una falla de la fuente deja el jueceo no disponible sin impedir consultar fotos o diplomas; no entrega una hoja manual vieja como sustituto de una fuente vinculada.

La identidad de exportación se conserva en `participant_portal_program_links`; `participant_portal_program_exports` guarda el manifiesto y únicamente el hash de su autorización. La fuente no guarda esa autorización en tablas públicas. La copia mantenida del importador está en `integrations/jueceocore/import-excel/`; no se modificó el checkout de iOS con cambios locales pendientes.

Los resultados automáticos usan el cálculo oficial del dictamen existente. La consulta obtiene todos los competidores de los bloques correspondientes, restringe sus calificaciones a esos bloques y certifica la cobertura antes de calcular lugares. Las notas de otras personas nunca salen en la respuesta del participante. El resultado propio exige hojas completas; el lugar queda pendiente mientras haya competidores de su categoría sin completar. Los empates conservan los lugares de competencia y solo se muestran 1, 2 y 3. Las categorías individuales no inventan un podio. La medalla se representa con los rangos nativos de `CompetitionPlacement.solo`: 181/210, 161/210 y 141/210 de la escala efectiva, independientemente del lugar entre competidores.

El reconocimiento automático se ofrece en las ediciones de inscripción configuradas, para personas vinculadas por su registro o por un acceso activo ya emitido. Administración puede revisarlo con marca de vista interna aunque la edición esté oculta. La descarga usa la plantilla local aprobada y los datos de la sesión; no genera otro enlace de acceso, no rota los QR y no crea un archivo en Drive. Los documentos personalizados existentes continúan entregándose con sus permisos y publicación anteriores.

Se conservan las fuentes estándar cuando admiten el texto. Para caracteres adicionales se carga una copia local de Noto Sans bajo licencia SIL OFL y se incorpora solo la parte necesaria al PDF, sin sustituir letras ni cambiar los datos del registro. La comprobación del 9 de noviembre de 2026 generó en memoria los 262 reconocimientos actuales correctamente, incluidos ocho registros cuya academia contiene `ū`; no guardó ni publicó archivos ni modificó accesos.

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
