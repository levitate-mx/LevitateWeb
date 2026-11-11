# Importación de programa con vinculación automática

Esta copia parte de la función `import-excel` versión 8 desplegada en JueceoCore y agrega la vinculación automática con Mi Levitate. Se mantiene aquí para no modificar el checkout de iOS con cambios locales pendientes.

## Contrato

El programa se descarga desde la web mediante una sesión administrativa. Las columnas reservadas `ID INSCRIPCIÓN`, `ID EDICIÓN` y `TOKEN VINCULACIÓN` mantienen la identidad de la coreografía y una autorización de un solo programa. Los números nativos de rutina no cambian por UUID. La autorización no aparece en logs, URLs, configuración pública ni filas almacenadas en Supabase.

Después de importar, la función confirma la asociación en el endpoint fijo `https://levitate.mx/api/integrations/jueceocore/program`. La web comprueba la autorización, su vencimiento, los IDs y el programa realmente importado antes de guardar referencias en su D1 existente. El callback es idempotente para el mismo evento, rechaza otros eventos o contenidos y no reactiva conexiones deshabilitadas. No cambia puntajes ni sesiones QR.

Los archivos antiguos sin autorización mantienen su flujo anterior, incluidos los exportados con solo `ID INSCRIPCIÓN`. Los programas con vinculación no admiten reemplazos forzados. Si la confirmación falla después de importar, la respuesta aclara que los datos ya están en jueceo: no intenta borrarlos ni revertirlos.

Los programas organizados por secciones reconocen los títulos `BLOQUE` aunque compartan fila con la temporada o fecha. Los encabezados repetidos actualizan las columnas. Las filas de premiación, receso, descanso y `BREAK` se omiten cuando carecen de número y datos de presentación. Una columna `BLOQUE` explícita conserva prioridad sobre el título de sección, y se mantiene el orden de las coreografías dentro de cada bloque. Los valores del Excel son la referencia de importación para nombres, niveles, integrantes y horarios.

Las presentaciones cuya división o categoría indica `EXHIBICIÓN` o `EXHIBITION` se omiten y se informan en `warnings`. No requieren plantilla de puntuación.

Cuando una hoja `SABADO` o `DOMINGO` tiene horarios y secciones de bloques, las hojas de referencia con nombre `levitate-programa` o `levitate-programa (n)` se omiten y se informa en `warnings`. Una exportación independiente con ese nombre sigue siendo válida. La importación devuelve la hoja y fila de una presentación numerada cuyo nombre está vacío.

Las equivalencias de plantillas incluyen `BELLY DANCE` con `BELLYDANCE`, `TRAPECIO` con danza aérea y `OPEN: MOTION` con contemporáneo. Las disciplinas sin plantilla o equivalencia configurada siguen requiriendo su hoja de evaluación.

## Despliegue

Proyecto: `twazfaytgmgeyqeopgut` (JueceoCore). Función: `import-excel`. Incluir `index.ts`, `default_templates.ts`, `registration_link.js` y `registration_link.d.ts`. Mantener la configuración existente del servicio y no desplegar por encima de una versión remota más nueva sin compararla primero. La actualización inicial de esta integración se publicó como versión 9.

La opción `dry_run: true` valida y parsea el archivo sin escribir eventos, bloques, coreografías o calificaciones y sin llamar al callback. Es la verificación apropiada para probar el formato en producción sin modificar datos reales.
