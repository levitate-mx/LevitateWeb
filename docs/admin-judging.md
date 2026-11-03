# Puntuaciones de JueceoCore

La sección `/admin/puntuaciones` consulta la base de la versión nueva de
JueceoCore. No copia ni modifica eventos, coreografías, notas o comprobantes.

## Configuración del servidor

- `JUDGING_SUPABASE_URL`: URL del proyecto confirmado de jueceo.
- `JUDGING_SUPABASE_PUBLISHABLE_KEY`: clave pública de la aplicación, almacenada
  como secreto del Worker. No se incluye en el JavaScript del navegador.
- `JUDGING_LEVITATE_EVENT_IDS`: lista de UUID de eventos verificados de Levitate,
  separados por comas. Se aplica tanto al listado como a la consulta directa de
  puntuaciones. Si falta o es inválida, la consulta se bloquea.

Los eventos de otras marcas y los programas sin una asociación verificada con
Levitate no aparecen. No se deduce la pertenencia por coincidencias de nombre.
Para incorporar un programa nuevo, se verifica su identidad y se añade su UUID
a la configuración del Worker.

La conexión usa exclusivamente `GET` a tablas y columnas permitidas. No admite
claves secretas ni `service_role`. Conserva las políticas RLS existentes y no
consulta códigos de acceso, fotos de jueces ni datos de dispositivos.

Las rutas `/api/registration/admin/judging/events` y
`/api/registration/admin/judging/scores?eventId=UUID` requieren la sesión normal
de un usuario con rol `admin` antes de consultar Supabase. Las respuestas usan
`Cache-Control: private, no-store`. Un error de conexión se muestra como error,
no como una lista vacía o puntuaciones de cero.

## Dictamen por bloque

Se selecciona un evento verificado de Levitate y un bloque. La vista está
pensada para leer los resultados en voz alta: filas sencillas con número de
participación, coreografía, academia, puntaje y lugar, con tipografía grande y
alto contraste. Las categorías conservan su agrupación. Los datos de cada
juez quedan en el detalle desplegable y la búsqueda y los filtros, en un
control secundario. Se quitaron las explicaciones técnicas, la hora de
consulta y las tarjetas de métricas de la lectura principal.

La sección sigue protegida para administradores. Este cambio facilita la
lectura ante el público; no publica las puntuaciones ni habilita acceso anónimo.

El cálculo del puntaje se portó de `Packages/JueceoCore/Sources/JueceoCore/ScoringEngine.swift`,
`AppModels.swift`, `CompetitionBranding.swift`, y del método `result(for:)` de
`JudgingStore.swift` y `DictamenBuilder` de `Views/DictamenView.swift` del proyecto
iOS. Las pruebas numéricas incluyen resultados de referencia ejecutados con
ese código Swift. La presentación de lugares sigue la regla solicitada para
la web y puede diferir de los umbrales de premiación de la app. La web consulta
Supabase y calcula la presentación en el servidor; no invoca el paquete Swift
desde el navegador.

- El subtotal aplica las ponderaciones de criterios. El dictamen utiliza la
  agregación oficial del evento (promedio o suma), pesos de evaluadores,
  exclusión de extremos, penalizaciones y política de notas faltantes; luego
  normaliza a 150 puntos. Se respetan los jueces asignados a cada bloque.
- La app considera una evaluación enviada para la agregación cuando su
  subtotal es mayor que cero; por defecto, las evaluaciones faltantes cuentan
  como cero en el dictamen. Esto es independiente del indicador de hoja
  completa: una hoja con todos sus criterios en cero sigue siendo completa.
- Se asignan únicamente 1.º, 2.º y 3.º lugar por categoría; desde el cuarto
  lugar se muestra **Participación**. Una categoría con una sola coreografía
  evaluada recibe el primer lugar sin aplicar umbrales porcentuales. Los campos
  `ranked_positions` y `use_solo_placement_thresholds` del evento no cambian
  esta regla de la web.
- Las posiciones utilizan el puntaje sin redondearlo. Los empates con
  diferencia menor a 0.0001 comparten lugar, por ejemplo 1.º, 1.º, 3.º. Las
  filas se presentan de menor a mayor puntaje dentro de su grupo, con el
  ganador al final. Los filtros no vuelven a calcular lugares.
- El evento configura los campos de agrupación, alias de disciplinas y
  premios especiales. Las asignaciones de premios se leen del servidor;
  esta vista no permite modificarlas.
- Las notas ausentes se distinguen de una nota válida de cero en el detalle.
  Las hojas incompletas conservan su indicador; los datos inválidos o sin una
  plantilla reconocida no reciben puntaje ni posición. Una coreografía sin
  notas registradas se muestra pendiente y no recibe lugar; un cero evaluado
  sí es una nota real. Los cambios pendientes de sincronizar en un dispositivo
  todavía no aparecen.
- El botón **Actualizar** vuelve a consultar eventos, notas y premios. No hay
  sondeo periódico ni consultas en segundo plano desde esta sección.

La identidad es `(event_id, routine_id)` de JueceoCore. La web de registros usa
otros UUID: no se asocian coreografías de ambas bases por coincidencia de nombre.
Una futura relación entre ambos programas debe guardar un identificador
explícito y verificado.

La consulta lee todas las páginas dentro de un límite acotado. Si se supera el
límite o falla una tabla, no presenta un conjunto truncado como completo.

## Verificación

`npm run test:registration` cubre el acceso administrativo, consultas de solo
lectura, paginación, aislamiento por evento, plantillas, notas incompletas,
ceros, penalizaciones, cálculo oficial, posiciones, agrupaciones, premios y
formato del panel. `npm run build` valida la integración con la navegación
administrativa. La verificación visual incluye escritorio y móvil.
