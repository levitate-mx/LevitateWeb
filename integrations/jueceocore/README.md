# Importación de programa con vinculación automática

Esta copia parte de la función `import-excel` versión 8 desplegada en JueceoCore y agrega la vinculación automática con Mi Levitate. Se mantiene aquí para no modificar el checkout de iOS con cambios locales pendientes.

## Contrato

El programa se descarga desde la web mediante una sesión administrativa. Las columnas reservadas `ID INSCRIPCIÓN`, `ID EDICIÓN` y `TOKEN VINCULACIÓN` mantienen la identidad de la coreografía y una autorización de un solo programa. Los números nativos de rutina no cambian por UUID. La autorización no aparece en logs, URLs, configuración pública ni filas almacenadas en Supabase.

Después de importar, la función confirma la asociación en el endpoint fijo `https://levitate.mx/api/integrations/jueceocore/program`. La web comprueba la autorización, su vencimiento, los IDs y el programa realmente importado antes de guardar referencias en su D1 existente. El callback es idempotente para el mismo evento, rechaza otros eventos o contenidos y no reactiva conexiones deshabilitadas. No cambia puntajes ni sesiones QR.

Los archivos antiguos sin autorización mantienen su flujo anterior, incluidos los exportados con solo `ID INSCRIPCIÓN`. Los programas con vinculación no admiten reemplazos forzados. Si la confirmación falla después de importar, la respuesta aclara que los datos ya están en jueceo: no intenta borrarlos ni revertirlos.

## Despliegue

Proyecto: `twazfaytgmgeyqeopgut` (JueceoCore). Función: `import-excel`. Incluir `index.ts`, `default_templates.ts`, `registration_link.js` y `registration_link.d.ts`. Mantener la configuración existente del servicio y no desplegar por encima de una versión remota más nueva sin compararla primero. La actualización inicial de esta integración se publicó como versión 9.

La opción `dry_run: true` valida y parsea el archivo sin escribir eventos, bloques, coreografías o calificaciones y sin llamar al callback. Es la verificación apropiada para probar el formato en producción sin modificar datos reales.
