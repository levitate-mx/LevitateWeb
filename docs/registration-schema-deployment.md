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
