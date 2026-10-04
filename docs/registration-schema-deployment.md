# Preparación del esquema de registro

Las solicitudes del Worker usan un esquema preparado antes del despliegue. Las
tablas, columnas e índices que antes se verificaban o creaban durante cada
solicitud se preparan con `scripts/prepare-registration-db.mjs`.

## Desplegar una actualización

Usar `npm run deploy`. Ejecuta las pruebas de registro, compila, prepara el
esquema remoto y verifica el resultado antes de publicar el Worker. Si alguno de
esos pasos falla, no publica. Configurar también los despliegues automatizados
para usar este comando: ejecutar `wrangler deploy` directamente omite este paso.

Para comprobar producción sin cambiarla:

```sh
npm run db:check:registration
```

El chequeo consulta estructura y conteos de tokens faltantes/duplicados; no
devuelve datos personales ni tokens. Un resultado pendiente termina con código
1 e indica qué preparación falta. Para aplicar únicamente esa preparación:

```sh
npm run db:prepare:registration
```

El script agrega solo los elementos que antes preparaba el Worker y completa
tokens de tienda vacíos. Conserva tokens existentes, IDs, roles, cuentas,
comprobantes y música. Si encuentra una estructura base incompatible o tokens
duplicados, se detiene antes de escribir. Después de aplicar vuelve a verificar;
una segunda ejecución sobre un esquema preparado no escribe nada.

No elimina ni reconstruye tablas. Conserva la columna `venue` de academias en
bases antiguas; el alta mantiene su consulta de compatibilidad para aceptar
ambas estructuras. La creación de perfiles de alumnos y la emisión de boletos
siguen ejecutándose en sus operaciones habituales. Las actualizaciones de
`last_seen_at`, el polling y los controles de acceso no cambian.

No ejecutar todos los SQL históricos para preparar una base existente: algunos
reconstruyen tablas o contienen `ALTER TABLE` que no admite repetición. Esta
preparación es deliberadamente aditiva y no reemplaza migraciones ajenas a los
elementos retirados del Worker.

## Desarrollo y pruebas

Las pruebas usan bases SQLite en memoria con datos sintéticos:

```sh
npm run test:registration
```

Para inicializar una base local vacía:

```sh
npm run db:migrate:registration:local
npm run db:prepare:registration:local
npm run db:check:registration:local
```

Para probar en un directorio local aislado, pasar el mismo `--persist-to` al
comando de inicialización de Wrangler y al script de preparación. El script
exige seleccionar `--local` o `--remote` y `--check` o `--apply`; no tiene un modo
de escritura implícito.

Las pruebas requieren Node.js con `node:sqlite` disponible (Node 22.13 o
posterior). La preparación usa el Wrangler instalado en el proyecto y la
configuración raíz `wrangler.jsonc`.

Si falla la preparación, conservar el Worker desplegado y corregir el error
indicado antes de volver a ejecutar `npm run deploy`. Si una ejecución quedó a
medias, el siguiente chequeo informa únicamente lo pendiente; no hace falta
deshacer las adiciones compatibles con la versión anterior.

## Admin payment read usage

The payment list uses `/api/registration/admin/payment-orders` with 10, 25, or 50
orders per page. Status, venue, and purchase type are filtered before SQL
pagination. Proofs and QR tickets are fetched only when an order is opened via
the authenticated `/api/registration/admin/payment-order` endpoint. Approval and
note responses update that order and the displayed totals without reloading the
complete order list. If an update changes filter membership or moves an order
between pages, only the current page is refilled to keep navigation accurate.

Page navigation reuses the filtered count and global totals already loaded by
the screen. Changing filters recounts matching orders; the Refresh button also
refreshes global totals. If another administrator removes the final page, the
client recounts and returns to a valid page. Changes from other sessions become
visible on Refresh. Other admin views load their required datasets on entry,
reuse them for up to one minute when navigating, and no longer poll every minute.

Full CSV exports are explicit reads of all matching orders, including proof
filenames and ticket counts. Text search still scans candidate order records to
preserve computed domestic/international payment-reference matching, without
loading proof files or tickets. Reports and other views requiring complete
registration data retain their complete datasets; pagination here applies to
the payment review list.

`db/registration_admin_order_indexes.sql` documents the ordered payment indexes.
They are also included in the canonical schema and in the existing deployment
preflight (`npm run db:prepare:registration`), so existing databases receive them
before deployment. Index creation is a one-time operation and does not run on
user requests. Use local sample data for development (`--local` database commands)
and compare D1 `rows_read` metrics before and after production rollout.
