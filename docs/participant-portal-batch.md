# Lotes del portal de participantes

Los lotes usan el mismo registro D1 y la API administrativa autenticada que la pantalla del administrador. Cada participante se identifica con su `registration_participants.id` y cada coreografía con su `registration_dances.id`. Una asignación explícita vincula esos registros a una edición del portal. Los nombres y academias de los diplomas y del CSV se toman del registro autenticado, mediante el ID.

La ejecución predeterminada valida el manifiesto y los archivos de forma local. `--apply` guarda borradores, crea accesos y escribe los archivos privados. `--publish` es un paso adicional explícito que publica los archivos, documentos, coreografías incluidas y la edición. Conviene revisar el borrador en `/admin/mi-levitate` antes de publicar.

Requisitos locales: Node 22 o posterior, las dependencias del proyecto instaladas y Python 3 con Pillow para las vistas de fotos. La API necesita la migración del portal y su almacenamiento `PARTICIPANT_MEDIA` configurados para recibir archivos.

## Preparar el manifiesto

Copia [el ejemplo del lote](examples/participant-portal-batch.example.json) a una carpeta privada y reemplaza todos los IDs de ejemplo por los IDs reales ya existentes. `venue` es `cdmx`, `puebla`, `edomex` o `veracruz`. Cada resultado y hoja de jueceo exige `approved: true`; el lote copia la evaluación revisada y usa las mismas validaciones del servidor. `sourceEventId` y `sourceRoutineId`, cuando se proporcionan, van juntos.

`result` y `judging` pueden ser `null` para una ficha pendiente. Guardar una coreografía actualiza toda su ficha y vuelve a ponerla en borrador. Si se omiten ambos identificadores de jueceo, conserva su vínculo existente. Para retirarlo explícitamente, proporciona `sourceEventId: ""` y `sourceRoutineId: ""` juntos. Para un lote que solo añade fotos a fichas existentes, deja `routines: []`. El lote resuelve el `danceId` de las fotos contra las fichas guardadas en esa edición. El álbum de esa ficha debe tener `photosPublished: true` para publicar las fotos; el lote se detiene si está desactivado.

`participants` contiene las personas a las que se emitirá o reexportará un acceso. Su campo `name` sirve como referencia al preparar el JSON; el CSV y los diplomas usan el nombre del registro. Un resultado colectivo se guarda una sola vez por `danceId` y aparece a los participantes vinculados a esa coreografía en el registro.

```sh
node scripts/participant-portal-batch.mjs --manifest /ruta/privada/lote.json
```

Para generar reconocimientos autenticados con el QR personal, añade `--diplomas`. La plantilla vectorial incluida conserva el arte oficial de Otoño 2026; el lote superpone el nombre y la academia del registro autenticado, el sello de autenticación y el QR privado. Las etiquetas `diploma.dateLabel` y `diploma.venueLabel` se conservan en el manifiesto para validar la edición, aunque la fecha y sede visibles pertenecen al arte aprobado. Los PDF generados se guardan con permisos privados y se cargan y asignan como borradores. El mismo lote puede incluir PDF con el arte final ya aprobado en `assets`, con `kind: "diploma"`, un `participantId` y su ruta `file`, más una entrada `documents` que vincule `participantId` con `assetKey`. Cada persona utiliza una de esas dos opciones.

## Preparar las fotos

Copia [el ejemplo de carpetas](examples/participant-portal-media.example.json) y asigna a cada `danceId` una carpeta de originales. El proceso selecciona hasta 20 JPEG, PNG o WebP por carpeta, ordenados por nombre. `--limit-per-dance 10` permite preparar diez. La asignación procede del manifiesto revisado.

```sh
python3 scripts/participant-portal-media.py --manifest /ruta/privada/fotos.json
python3 scripts/participant-portal-media.py --manifest /ruta/privada/fotos.json --out /ruta/privada/vistas --apply
```

Las vistas son JPEG de hasta 1600 píxeles en su lado mayor, con marca de agua repetida y metadatos EXIF retirados. Se respeta la orientación de la foto. Los originales se conservan. `--max-edge` admite de 320 a 2000 y `--font` permite indicar una fuente local para la marca de agua.

La salida `media-previews.json` incorpora `danceId`, dimensiones y rutas relativas de las vistas. Úsala en la validación y la carga del lote.

```sh
node scripts/participant-portal-batch.mjs --manifest /ruta/privada/lote.json --media /ruta/privada/vistas/media-previews.json --diplomas
```

`allowDownload` se guarda en `false` para las vistas. La publicación de fotos requiere edición publicada, ficha publicada, `photosPublished: true` en esa ficha y cada archivo publicado.

## Guardar y revisar

La sesión debe ser la cookie `levitate_registration_session` de un administrador conectado. Cárgala en `LEVITATE_ADMIN_COOKIE` mediante entrada oculta de tu terminal, o usa `--cookie-stdin` leyendo un archivo privado que contenga la cookie. No se admite pasar la sesión como argumento del comando. El lote muestra conteos y acciones, y guarda las URLs personales en archivos privados.

```sh
node scripts/participant-portal-batch.mjs --manifest /ruta/privada/lote.json --media /ruta/privada/vistas/media-previews.json --diplomas --base-url https://sitio.example --out /ruta/privada/emision --apply --cookie-stdin < /ruta/privada/sesion.txt
```

La carpeta de salida tiene permisos `700`. El CSV `accesos-privados.csv`, el estado `estado-privado.json`, cada QR en `qr/` y los PDF de `diplomas/` tienen permisos `600`. El CSV conserva los nombres reales, los IDs de registro, los enlaces personales y las rutas de sus QR. Cada QR apunta al enlace aleatorio entregado por el servidor. Conserva esta carpeta de emisión para reimprimir o reanudar el lote.

La edición conserva su estado de publicación si ya existe. Las fichas guardadas pasan a borrador. Los archivos nuevos y las asignaciones de documentos quedan en borrador hasta la publicación explícita.

## Publicar el lote revisado

Usa el mismo manifiesto y la misma carpeta de emisión para publicar el lote ya revisado.

```sh
node scripts/participant-portal-batch.mjs --manifest /ruta/privada/lote.json --media /ruta/privada/vistas/media-previews.json --diplomas --base-url https://sitio.example --out /ruta/privada/emision --apply --publish --cookie-stdin < /ruta/privada/sesion.txt
```

Este paso publica la edición completa. Las fichas y archivos de otros lotes que ya estén publicados también podrán quedar visibles al publicar esa edición. El manifiesto debe corresponder a la edición cuya apertura se aprobó.

## Reanudar y añadir material

El estado privado permite reanudar usando la misma carpeta. Las cargas de archivos tienen una clave estable derivada de su contenido y asignación. Las operaciones completadas se reutilizan, y la publicación explícita se vuelve a aplicar para que una ficha corregida salga de borrador.

Cada creación de acceso se registra antes de enviarse y su enlace se guarda en cuanto responde el servidor. Si la conexión se interrumpe durante ese paso, el lote se detiene y conserva la operación pendiente. Recupera los archivos de emisión si el enlace alcanzó a guardarse. Si se perdió la respuesta, reemplaza el acceso de esa persona desde el administrador y conserva el nuevo QR emitido allí. Retira a esa persona de `participants` en el manifiesto para continuar con las demás; su diploma puede asignarse desde el administrador. El servidor rechaza crear otro enlace activo para la misma persona y edición. El lote también se detiene si descubre que un acceso guardado fue revocado o reemplazado.

Un archivo `.batch.lock` impide dos procesos simultáneos sobre la misma carpeta. Si una interrupción abrupta dejó ese archivo, confirma que el proceso terminó antes de retirarlo. Los archivos completados y el estado permiten continuar. Para agregar fotos a una ficha existente, usa el mismo evento y sus `danceId`, y deja fuera de `routines` las fichas cuya evaluación debe conservarse.
