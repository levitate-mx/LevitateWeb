# Administracion de jueceo web

`/jueceo/admin` usa el login y la sesion HttpOnly existentes de Levitate. Se
abre desde **Jueceo admin** en el panel de administracion. El usuario debe ser
un administrador real: un juez o una academia no pueden habilitar este acceso
con parametros de URL. No se crearon nuevos administradores en produccion.

## Flujos

- Navegacion con etiquetas en escritorio y barra compacta en movil: Home,
  Editar calificaciones, Jueces, Dictamen final, Favoritos e Importar Excel;
  Votacion Releve y configuracion. La actividad aparece arriba en Inicio y Editar calificaciones. El tablero prioriza el bloque,
  el avance de evaluacion y las proximas coreografias con la identidad de Levitate.
- Matriz por coreografia y juez, estados completos/incompletos, filtros,
  metadatos editables, movimiento entre bloques y eliminacion confirmada.
  El total se muestra sin decimales y se identifica como provisional mientras
  faltan evaluaciones; solo una fila completa se identifica como oficial.
  La columna suma las notas reales de los jueces, con la penalizacion ya
  incluida en cada nota; no convierte esa suma a la escala de 150 puntos.
- El puntaje abre la hoja Flutter ya utilizada por los jueces, en modo editor
  administrativo. Usa endpoints administrativos separados y almacenamiento
  local aislado por administrador, evento y juez. No simula actividad del juez.
  El boton de volver espera a que los envios pendientes se sincronicen.
- Jueces: nombre, foto JPEG/PNG/WebP de hasta 1 MB, bloques, codigo nativo y
  acceso web. Los usuarios nuevos reciben una contrasena aleatoria que se
  muestra una sola vez; no se reemplazan cuentas existentes ni contrasenas.
  Un correo `.invalid` permite ingreso por usuario pero no recuperacion por mail.
- Actividad consulta cada 10 segundos; notas cada 30 segundos con la pagina
  visible y sin formularios abiertos. Los reportes viejos no cuentan como datos
  sincronizados. Una nota pendiente en una tablet aun no aparece en la web.
  El panel superior muestra todos los jueces del evento con la hoja abierta y
  su bloque. Cada encabezado de juez tambien identifica la hoja abierta, aunque
  los filtros de la tabla la oculten o pertenezca a otro bloque. Abrir una hoja no implica que el
  juez este modificando una nota. Inicio, hoja cerrada y actividad vencida se
  distinguen sin inventar una hoja actual.
- Favoritos multiples compatibles con los aliases anteriores, votos por juez
  y cuatro premios especiales manuales por bloque.
- Dictamen y PDF reutilizan el calculo oficial y la presentacion de
  lugares ya aprobada para la web; `/admin/puntuaciones` sigue siendo de solo
  lectura y conserva sus reglas. No se cambiaron las reglas de los clientes iOS.
- Dictamen conserva el detalle por juez y los filtros del admin
  anterior: busqueda, disciplina y estado. Filtrar no recalcula lugares ni
  modifica el PDF ni los premios del bloque. Cambiar evento, bloque o
  vista limpia esos filtros y cierra el detalle; actualizar datos conserva la
  seleccion y muestra las notas nuevas sin guardar ni editar calificaciones.
- Excel de hasta 20 MB usa el importador nativo con un identificador nuevo,
  sin activar ni reemplazar otros programas. Los eventos anteriores se pueden
  activar, archivar y restaurar con confirmacion. Activar solo afecta al alcance
  verificado de Levitate, nunca a otras marcas.

Releve permite abrir y cerrar la votacion real y consultar resultados privados.
La instalacion queda cerrada. Ver `releve-voting-preview.md` para el control
aproximado por dispositivo y la persistencia.

## Escrituras y seguridad

Las rutas `/api/registration/admin/judging/workspace/*` y `editor/*` verifican el
rol en cada solicitud. Las escrituras exigen POST JSON desde el mismo origen.
Los eventos permitidos provienen de `JUDGING_LEVITATE_EVENT_IDS`, importaciones
administrativas y vinculaciones verificadas de las ediciones de registro.

La nueva funcion `levitate-web-admin` autentica un secreto compartido con el
Worker, `LEVITATE_ADMIN_WEB_SECRET` (minimo 40 caracteres). Se configura mediante
los almacenes de secretos de Cloudflare y Supabase, nunca en codigo, variables
publicas o assets. La clave de servicio permanece dentro de Supabase. La RPC
`web_admin_judging_operation` es SECURITY INVOKER, ejecutable solo por
`service_role`. No se ampliaron las politicas de los clientes nativos.

Las migraciones de `supabase/migrations/` agregan una bitacora privada y las
operaciones transaccionales. Mover una coreografia conserva notas, devoluciones,
penalizaciones y todos los favoritos, incluidos los anteriores. Los cambios de
metadatos, jueces y evento comprueban `updated_at`; un conflicto no sobrescribe
una edicion posterior. La bitacora no es una papelera ni una funcion de deshacer.

`npm run db:prepare:registration` agrega exclusivamente las nuevas tablas D1.
Debe ejecutarse antes de publicar el Worker. No modifica participantes, nombres,
pagos, QR, calificaciones existentes ni membresias del jurado.

## Hojas en Mi Levitate

La descarga PDF administrativa funciona localmente. **Enviar hojas de jueceo**
habilita las hojas terminadas de los jueces del bloque seleccionado en Mi
Levitate únicamente al pulsar el botón. Basta con una hoja completa de un juez;
las evaluaciones de los demás jueces y coreografías pueden seguir pendientes.
El servidor exige un administrador autorizado y registra administrador, fecha
y la huella de cada hoja habilitada. Las nuevas hojas o las corregidas requieren
otro envío; el avance de otras evaluaciones conserva las hojas ya habilitadas
que siguen iguales. Las lecturas, actualizaciones y el
guardado de calificaciones nunca habilitan hojas automáticamente.

El favorito del público y sus votos no alteran la huella de las hojas del
jurado. Los resultados y las fotografías mantienen sus controles de publicación
independientes. Las rutas directas de hojas también requieren la habilitación
manual vigente de cada juez y la pertenencia autenticada del participante.

El esquema aditivo agrega `manifest_json` en `registration_judging_sheet_releases`
sin modificar las aprobaciones anteriores. `db:prepare:registration` verifica y
aplica la columna antes de publicar el Worker. Las aprobaciones anteriores sin
manifiesto conservan su comprobación original de bloque completo.

El envío por correo está retirado de la interfaz. Las acciones anteriores
`export-send` y `export-recipients` responden 410 después de comprobar la sesión;
no consultan destinatarios ni envían correos. Los registros anteriores se
conservan.

## Verificacion

- `npm run test:registration`: permisos, alcance de marca, notas, favoritos,
  revisiones, accesos web, importacion segura, PDF privado y correos sin duplicar.
- Flutter: pruebas existentes de jueceo, almacenamiento y sincronizacion; nuevo
  cliente administrativo reutiliza exactamente las mismas validaciones.
- `tests/fixtures/judging-admin-transaction.sql`: crea datos temporales dentro
  de una transaccion y finaliza con ROLLBACK. Verifica movimientos, cascadas,
  aliases de favoritos, jueces, archivo y rechazos de revisiones viejas.
- Revision visual en escritorio/movil y PDF renderizado; no se editaron notas
  reales para comprobar la interfaz.

El acceso inicial administrativo requiere conexion. Las colas del editor web
no deben borrarse limpiando los datos del navegador mientras existan pendientes.
