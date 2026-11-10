# Administracion de jueceo web

`/jueceo/admin` usa el login y la sesion HttpOnly existentes de Levitate. Se
abre desde **Jueceo admin** en el panel de administracion. El usuario debe ser
un administrador real: un juez o una academia no pueden habilitar este acceso
con parametros de URL. No se crearon nuevos administradores en produccion.

## Flujos

- Navegacion basada en iOS: Home, Editar calificaciones, Jueces, Dictamen final,
  Favoritos e Importar Excel; actividad, ranking y configuracion secundarios.
- Matriz por coreografia y juez, estados completos/incompletos, filtros,
  metadatos editables, movimiento entre bloques y eliminacion confirmada.
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
- Favoritos multiples compatibles con los aliases anteriores, votos por juez
  y cuatro premios especiales manuales por bloque.
- Dictamen, ranking y PDF reutilizan el calculo oficial y la presentacion de
  lugares ya aprobada para la web; `/admin/puntuaciones` sigue siendo de solo
  lectura y conserva sus reglas. No se cambiaron las reglas de los clientes iOS.
- Excel de hasta 20 MB usa el importador nativo con un identificador nuevo,
  sin activar ni reemplazar otros programas. Los eventos anteriores se pueden
  activar, archivar y restaurar con confirmacion. Activar solo afecta al alcance
  verificado de Levitate, nunca a otras marcas.

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

## Exportaciones y correo

La descarga PDF funciona localmente. La subida de hojas a Drive exige que el
bloque este completo, genera un PDF por coreografia con todas sus hojas y usa
el almacenamiento privado existente. El maximo por PDF es 8 MB. No se crea un
permiso publico en Drive. Las exportaciones anteriores quedan en el selector.

El directorio `academy_contacts` determina los destinatarios; se muestran para
confirmacion explicita antes de enviar. Gmail recibe enlaces privados con
vencimiento de 30 dias, no adjuntos publicos. El token se deriva con HMAC del
secreto del servidor y solo su hash se guarda en D1. El endpoint de descarga
valida hash, vencimiento y evento; responde sin cache y sin referer.

Cada envio reserva una identidad unica por exportacion y destinatario antes de
contactar Gmail. Un envio incierto no se repite automaticamente: debe revisarse
en Gmail antes de preparar otro. Las pruebas no enviaron correos reales.

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
