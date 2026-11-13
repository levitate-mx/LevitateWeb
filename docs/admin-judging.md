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
pensada para leer los resultados en voz alta: puntaje primero, luego la
coreografía y la academia, y la medalla por puntaje al extremo derecho. El lugar
se agrega únicamente cuando hay competencia directa. Se conserva la
tipografía grande, el alto contraste y los acentos rosados de Levitate. El
número de participación ya no se muestra en las filas. Las categorías conservan
su agrupación. Los datos de cada
juez quedan en el detalle desplegable y la búsqueda y los filtros, en un
control secundario. Se quitaron las explicaciones técnicas, la hora de
consulta y las tarjetas de métricas de la lectura principal.

La sección sigue protegida para administradores. Este cambio facilita la
lectura ante el público; no publica las puntuaciones ni habilita acceso anónimo.

El dictamen web y su PDF muestran la suma real de los totales de los jueces.
Los criterios, agrupaciones y umbrales de medallas conservan las referencias del
proyecto iOS. Las pruebas distinguen esta suma de la anterior normalización a
150 puntos. El medallero por puntaje y los lugares por competencia directa son
reconocimientos independientes, tanto en pantalla como en el PDF. La web consulta
Supabase y calcula la presentación en el servidor.

- Cada total por juez ya contiene las ponderaciones de criterios y su
  penalización. El dictamen suma esos totales una sola vez, sin promediarlos ni
  convertirlos a porcentajes. Se respetan los jueces asignados a cada rutina.
  Las opciones de agregación, pesos de evaluadores y exclusión de extremos de
  los clientes nativos no reemplazan la suma real solicitada para la web.
- Las evaluaciones pendientes no agregan puntos y siguen pendientes. Un cero
  registrado se conserva como cero. El máximo por rutina suma los máximos de
  sus jueces: tres hojas de 70 puntos tienen un máximo de 210. Relevé suma el
  jurado y, cuando corresponde, el bono de cinco puntos del público.
- Toda coreografía evaluada recibe medalla por puntaje, tenga o no competencia
  directa. Se usan los mismos umbrales que el portal de participantes: oro desde
  181/210, plata desde 161/210, bronce desde 141/210 y participación por debajo
  de 141/210 de la escala efectiva. No se redondea el puntaje para asignar la
  medalla. Un cero evaluado recibe medalla de participación; una coreografía
  sin notas o con datos inválidos no recibe una medalla inventada.
- Se agregan únicamente 1.º, 2.º y 3.º lugar cuando dos o más coreografías
  comparten bloque y agrupación competitiva (por defecto, género, división,
  nivel y categoría). Una coreografía sola conserva su medalla y no recibe
  primer lugar. Fuera de los tres primeros puestos se indica **Sin lugar de
  podio**, sin alterar la medalla obtenida. Los filtros no modifican el número
  de competidores ni convierten una categoría con competencia en una individual.
  Los campos `ranked_positions` y `use_solo_placement_thresholds` del evento no
  cambian esta regla de la web.
- Las posiciones utilizan el puntaje sin redondearlo. Los empates con
  diferencia menor a 0.0001 comparten lugar, por ejemplo 1.º, 1.º, 3.º. Las
  filas se presentan de menor a mayor puntaje dentro de su grupo, con el
  ganador al final. Los filtros no vuelven a calcular lugares.
- El dictamen final muestra los puntajes como enteros y no imprime números de
  presentación, ni en pantalla ni en su PDF. El cálculo de medallas, ranking y
  campeón conserva toda la precisión; el detalle por juez también conserva sus
  valores originales.
- El evento configura los campos de agrupación, alias de disciplinas y
  premios especiales. Las asignaciones de premios se leen del servidor;
  esta vista no permite modificarlas.
- Relevé se presenta después de la competencia general, en una sección propia
  **Premio Relevé · Premiación independiente**, tanto en pantalla como en el PDF.
  Conserva su agrupación competitiva y el resultado de jurado más el bono del
  público; sus rutinas no participan en Campeón de campeones.
- Antes de leer el ranking de Relevé se anuncia **El más votado por el público**,
  con coreografía, academia y votos confirmados. Mientras la votación esté
  abierta o exista empate pendiente se indica ese estado, sin inventar ganador.
- Después de Relevé siguen directamente los premios especiales. El dictamen
  final y su PDF no presentan una tarjeta **TOP SCORE**. En todos los bloques,
  **Mejor porra** cierra la premiación, aunque aparezca antes de otros premios
  en la configuración. El orden es **Mejor música → Mejor vestuario → Mejor idea
  coreográfica → Mejor porra**. En el último bloque, la secuencia de cierre es **Relevé → premios
  especiales → Campeón de campeones → Mejor porra**; el campeón se inserta
  inmediatamente antes de porra.
- En el último bloque de Estado de México, **Campeón de campeones** aparece
  inmediatamente antes de **Mejor porra**. El servidor lo calcula con el mayor
  puntaje oficial de la competencia general de todos los bloques del evento.
  Incluye coreografía, academia y puntaje; un empate conserva a todos los
  ganadores. Queda pendiente mientras falten calificaciones generales completas
  o haya datos inválidos. Las notas o la votación pendientes de Relevé no lo
  bloquean. Seleccionar otro bloque o aplicar filtros no recalcula al ganador.
  Solamente las lecturas del evento completo pueden asignar este premio; las
  consultas de hojas por participante o por bloque no certifican ese resultado.
- Las notas ausentes se distinguen de una nota válida de cero en el detalle.
  Las hojas incompletas conservan su indicador; los datos inválidos o sin una
  plantilla reconocida no reciben puntaje ni posición. Una coreografía sin
  notas registradas se muestra pendiente y no recibe lugar; un cero evaluado
  sí es una nota real. Los cambios pendientes de sincronizar en un dispositivo
  todavía no aparecen.
- El botón **Actualizar** vuelve a consultar eventos, notas y premios. No hay
  sondeo periódico ni consultas en segundo plano desde esta sección.

La identidad es `(event_id, routine_id)` de JueceoCore. `program_number` conserva
el número impreso del programa, como `194 a` o `237`, para el programa y la
edición de hojas; el dictamen final no lo muestra.
Las consultas, ediciones, notas y asociaciones conservan el ID interno estable.
La exportación del programa incluye los UUID de inscripción y una autorización
acotada al archivo. El importador confirma esa relación con Mi Levitate y
verifica el programa completo por IDs; no asocia por coincidencia de nombre.

La consulta lee todas las páginas dentro de un límite acotado. Si se supera el
límite o falla una tabla, no presenta un conjunto truncado como completo.

## Verificación

`npm run test:registration` cubre el acceso administrativo, consultas de solo
lectura, paginación, aislamiento por evento, plantillas, notas incompletas,
ceros, penalizaciones, cálculo oficial, posiciones, agrupaciones, premios y
formato del panel. `npm run build` valida la integración con la navegación
administrativa. La verificación visual incluye escritorio y móvil.
