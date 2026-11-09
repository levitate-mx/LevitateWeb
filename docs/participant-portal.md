# Mi Levitate · Experiencia de participante

El ejemplo público muestra la experiencia con datos ilustrativos. El material real se administra como borrador y solo resulta visible para participantes después de su publicación explícita.

## Experiencia

`/mi-levitate` abre el espacio individual desde el QR del diploma. El nombre es el protagonista; los colores, Inter, botones y proporciones siguen la web actual. No hay folio visible ni foto grupal en la portada.

Cada presentación conserva su puntaje y escala, medalla, hoja de jueceo y galería. Un selector cambia estos contenidos juntos. El lugar se muestra únicamente si el resultado publicado declara competencia directa, al menos dos presentaciones elegibles y un lugar oficial entre 1 y 3. La medalla no se calcula a partir del lugar ni se adivina a partir de una escala fija.

El diploma pertenece al participante y la edición. La galería y el jueceo pertenecen a la presentación: los integrantes de una pieza grupal reciben el mismo álbum sin duplicar archivos.

El ejemplo público está en `/mi-levitate/demo`; usa datos ilustrativos y dos imágenes de archivo identificadas como tales, una de ellas desenfocada como archivo derivado. El enlace con punto final `/mi-levitate/demo.` funciona como alias de la misma demo. Ninguna variante consulta Drive, acepta accesos privados ni abre una sesión real. En desarrollo también puede abrirse con `/mi-levitate?preview=1`. La galería real admite el conjunto de fotografías cargadas; muestra las primeras 20 y permite continuar, con carga diferida y visor accesible.

## Resumen, Drive y revisión interna

El resumen inicial reúne diploma, jueceo y fotografías. El diploma pertenece a la edición; el jueceo y hasta dos miniaturas del resumen cambian con la presentación seleccionada. Los estados se calculan a partir de los archivos y resultados disponibles, no de que Drive esté conectado. Una carpeta de Drive vinculada no equivale a un álbum cargado o publicado.

`/admin/foto-video` conserva las compras y la conexión de Drive, y enlaza a la gestión de Mi Levitate. `/admin/mi-levitate` reutiliza el mismo panel de conexión, permite seleccionar la edición y el participante, y abre **Revisar su resumen de Mi Levitate**. La navegación administrativa incluye una entrada directa a Mi Levitate.

La revisión usa `/admin/mi-levitate/resumen?eventId=…&participantId=…`. Esta página exige una sesión administrativa y solicita una proyección de lectura en `GET /api/registration/admin/participant-portal?preview=1&eventId=…&participantId=…`. El servidor devuelve la misma estructura del portal más `adminPreview: true`, con los borradores de esa persona y edición. Los archivos se consultan por el endpoint administrativo; las URLs públicas del participante mantienen sus controles de acceso y publicación.

Abrir la revisión no genera QR, accesos o sesiones de participante, no modifica los borradores y no publica la edición. La vista interna no es un enlace de entrega ni debe imprimirse en las tarjetas PVC. El arte Aura de 54 × 85 mm tiene un QR de muestra; los accesos reales se emiten por el proceso aprobado de diplomas.

Los originales permanecen en Drive. La vinculación de la carpeta está preparada, pero este cambio no importa automáticamente su contenido: las vistas previas se preparan y cargan mediante el flujo de archivos existente. Los enlaces de Drive, la cuenta conectada y sus identificadores se muestran únicamente en administración. El contrato actual de la galería incluye fotografías; no se anuncia un video disponible mientras no exista un archivo y una entrega de video implementados.

## Flujo para operar el evento

1. Crear la edición en `/admin/mi-levitate`, inicialmente oculta.
2. Vincular las presentaciones mediante su ID de inscripción; cuando exista fuente de jueceo, conservar su evento y rutina de origen. No emparejar personas o piezas solo por nombre.
3. Importar y revisar los resultados oficiales: puntaje, máximo, medalla, competencia directa y lugar, si corresponde. Las observaciones se conservan por juez y criterio; puede adjuntarse la hoja PDF.
4. Crear los accesos individuales y generar los diplomas por lote. Revisar los PDF antes de publicarlos; también se pueden cargar diplomas ya aprobados.
5. Pedir al fotógrafo carpetas identificadas por presentación. Preparar 10–20 vistas previas JPEG con marca de agua por pieza, revisar el manifiesto y cargarlas una vez por álbum.
6. Aprobar los archivos, publicar la presentación y hacer visible la edición. Los documentos tienen su publicación independiente.
7. Entregar cada QR al participante o su responsable. Un acceso puede revocarse o reemplazarse. Al reemplazarlo, el QR anterior deja de abrir el espacio.

El QR es una llave personal: quien lo tenga puede consultar ese espacio. Para compartir en redes conviene usar una imagen del reconocimiento sin su QR privado. Este sistema no incorpora reconocimiento facial, cobro ni entrega de originales comprados. Las fotografías se entregan como vistas previas; cualquier descarga adicional debe habilitarse explícitamente.

## Qué está implementado

- Portal responsive, selector de presentaciones, estados en revisión, visor de fotos y lectura de jueceo.
- API D1 de participantes, publicación y archivos; autorización por pertenencia a la presentación.
- Sesión privada por cookie; el enlace QR se intercambia por la sesión y desaparece del fragmento. Los tokens se guardan como hash.
- Panel de edición, búsqueda y paginación de participantes, presentaciones y archivos.
- Diplomas PDF carta con nombre, logo y QR; QR SVG individuales; importaciones y generación en lote.
- Preparación local de vistas previas con marca de agua y sin metadatos EXIF.
- Borradores, publicación, revocación, versiones de resultados y registro del administrador que los modificó.
- Preparación aditiva del esquema, sin crear tablas durante peticiones de participantes.

## Antes de activar producción

1. Provisionar un bucket R2 **privado**, sin `r2.dev` ni dominio público para originales o documentos. Añadir su binding `PARTICIPANT_MEDIA` al Worker existente. Ejemplo de configuración (ajustar el nombre al bucket creado):

```json
"r2_buckets": [
  { "binding": "PARTICIPANT_MEDIA", "bucket_name": "levitate-participant-media" }
]
```

2. El esquema aditivo de `db/registration_participant_portal.sql` quedó aplicado el 9 de noviembre de 2026. Se comprobaron las siete tablas nuevas vacías y los registros previos sin cambios; no se crearon ediciones, accesos QR ni sesiones de participantes. El preparador general no se ejecutó contra producción en esta tarea.
3. Revisar el arte final del diploma y los nombres. La plantilla incluida es una base funcional con fuentes latinas; para nombres con glifos fuera de su cobertura usar un PDF aprobado o integrar una fuente Unicode. El generador rechaza textos que no caben en lugar de truncar la identidad.
4. Importar las correspondencias reales y los resultados aprobados. **La integración actual de JueceoCore se reutiliza como fuente de consulta de administración, pero este módulo no sincroniza automáticamente sus cambios.** El portal recibe un registro revisado mediante el panel o manifiesto, con IDs de origen; una sincronización posterior debe conservar el paso de aprobación y la regla de competencia directa.
5. Cargar las fotografías y documentos reales; comprobar un QR de prueba en escritorio y teléfono antes de emitir el lote.
6. Desplegar el código y probar el control de acceso, la publicación y las descargas con una edición de prueba antes de hacerlo visible para todos.

Sin el binding de almacenamiento las consultas de datos siguen funcionando, pero cargar o descargar archivos devuelve una indisponibilidad explícita. No se ha simulado una conexión a fotografías o resultados reales.

## Ejecución y validación

```text
npm install
npm run dev
npm run build
npm run test:registration
python3 -m unittest discover -s tests -p participant_portal_media_test.py
```

Ver `docs/participant-portal-batch.md` para manifiestos, generación de diplomas y carga masiva. El modo de lote predeterminado solo valida; `--apply` escribe borradores y `--publish` publica explícitamente.

Referencias primarias de la implementación: [D1 Worker API](https://developers.cloudflare.com/d1/worker-api/d1-database/), [R2 Worker API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/), [PDF-LIB](https://pdf-lib.js.org/docs/api/classes/pdfdocument).
