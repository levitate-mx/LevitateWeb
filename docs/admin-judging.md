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

Se selecciona un evento verificado de Levitate y un bloque. La vista reproduce
el dictamen de la app nueva de iOS: encabezados rosas por grupo, tarjetas por
categoría, número de participación, coreografía, academia, estado, puntaje y
posición. Conserva el detalle de criterios, penalización y comentarios de cada
juez. Los filtros de búsqueda no vuelven a calcular posiciones: estas siempre
se obtienen del bloque completo.

Las reglas se portaron de `Packages/JueceoCore/Sources/JueceoCore/ScoringEngine.swift`,
`AppModels.swift`, `CompetitionBranding.swift`, y del método `result(for:)` de
`JudgingStore.swift` y `DictamenBuilder` de `Views/DictamenView.swift` del proyecto
iOS. Las pruebas incluyen resultados de referencia ejecutados con ese código
Swift. La web consulta Supabase y calcula la presentación en el servidor; no
invoca el paquete Swift desde el navegador.

- El subtotal aplica las ponderaciones de criterios. El dictamen utiliza la
  agregación oficial del evento (promedio o suma), pesos de evaluadores,
  exclusión de extremos, penalizaciones y política de notas faltantes; luego
  normaliza a 150 puntos. Se respetan los jueces asignados a cada bloque.
- La app considera una evaluación enviada para la agregación cuando su
  subtotal es mayor que cero; por defecto, las evaluaciones faltantes cuentan
  como cero en el dictamen. Esto es independiente del indicador de hoja
  completa: una hoja con todos sus criterios en cero sigue siendo completa.
- Las posiciones se asignan por puntaje sin redondearlo. Los empates con
  diferencia menor a 0.0001 comparten lugar, por ejemplo 1°, 1°, 3°.
  `DictamenBuilder` no aplica los desempates de la pantalla de ranking. Como
  en la app, las filas se presentan de menor a mayor puntaje, con el ganador
  al final. Una categoría con una sola participación aplica los umbrales del
  paquete, salvo que el evento los desactive.
- El evento configura los campos de agrupación, cantidad de lugares,
  alias de disciplinas, mejor puntaje y premios especiales. Las asignaciones
  de premios se leen del servidor; esta vista no permite modificarlas.
- Las notas ausentes se distinguen de una nota válida de cero en el detalle.
  Las hojas incompletas conservan su indicador; los datos inválidos o sin una
  plantilla reconocida no reciben puntaje ni posición. Los cambios pendientes
  de sincronizar en un dispositivo todavía no aparecen.
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
