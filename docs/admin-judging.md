# Puntuaciones de JueceoCore

La sección `/admin/puntuaciones` consulta la base de la versión nueva de
JueceoCore. No copia ni modifica eventos, coreografías, notas o comprobantes.

## Configuración del servidor

- `JUDGING_SUPABASE_URL`: URL del proyecto confirmado de jueceo.
- `JUDGING_SUPABASE_PUBLISHABLE_KEY`: clave pública de la aplicación, almacenada
  como secreto del Worker. No se incluye en el JavaScript del navegador.

La conexión usa exclusivamente `GET` a tablas y columnas permitidas. No admite
claves secretas ni `service_role`. Conserva las políticas RLS existentes y no
consulta códigos de acceso, fotos de jueces ni datos de dispositivos.

Las rutas `/api/registration/admin/judging/events` y
`/api/registration/admin/judging/scores?eventId=UUID` requieren la sesión normal
de un usuario con rol `admin` antes de consultar Supabase. Las respuestas usan
`Cache-Control: private, no-store`. Un error de conexión se muestra como error,
no como una lista vacía o puntuaciones de cero.

## Interpretación del visor

- Se selecciona un evento y se muestran sus rutinas y hojas por juez.
- Las notas ausentes se distinguen de una nota válida de cero.
- La hoja se considera completa cuando sus criterios tienen notas válidas en
  el servidor. Los cambios pendientes de sincronizar en un dispositivo todavía
  no aparecen.
- El subtotal por juez aplica las ponderaciones de criterios del evento. El
  total de la hoja aplica su penalización y tiene un mínimo de cero. El visor
  no calcula un resultado general, posiciones ni premios.
- Se respetan las asignaciones por bloque y se excluyen administradores de los
  jueces esperados. Las plantillas no reconocidas se indican explícitamente.
- El botón **Actualizar** vuelve a consultar eventos y notas. No hay sondeo
  periódico ni consultas en segundo plano desde esta sección.

La identidad es `(event_id, routine_id)` de JueceoCore. La web de registros usa
otros UUID: no se asocian coreografías de ambas bases por coincidencia de nombre.
Una futura relación entre ambos programas debe guardar un identificador
explícito y verificado.

La consulta lee todas las páginas dentro de un límite acotado. Si se supera el
límite o falla una tabla, no presenta un conjunto truncado como completo.

## Verificación

`npm run test:registration` cubre el acceso administrativo, consultas de solo
lectura, paginación, aislamiento por evento, plantillas, notas incompletas,
ceros, penalizaciones y formato del panel. `npm run build` valida la integración
del panel con la navegación administrativa.
