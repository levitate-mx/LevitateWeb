# Invitados de Mi Levitate

Un invitado tiene nombre, academia y una edición concreta, sin crear una
inscripción ni inventar una CURP. Se utiliza para personas acreditadas en el
programa que no tienen registro, intérpretes Relevé y coreógrafos.

Las tablas `participant_portal_guests`, `participant_portal_guest_dances`,
`participant_portal_guest_access` y `participant_portal_guest_sessions`
conservan sus identidades, pertenencias, accesos y sesiones separadas del
registro. Los accesos anteriores mantienen sus IDs, hashes y QR.

La acción administrativa `guest.create` requiere la sesión normal de un
administrador global. Valida la academia, edición, créditos del programa y
presentaciones indicadas antes de escribir. El origen de la persona debe ser
un coreógrafo existente o un nombre acreditado en el programa oficial. Una
persona que ya tiene registro no se convierte en invitado. Repetir el mismo
alta reutiliza el perfil; no cambia silenciosamente sus pertenencias.

`access.create` acepta el ID del invitado y emite el mismo tipo de enlace
`/mi-levitate#access=…`. El token aleatorio de 32 bytes se guarda como SHA-256.
La sesión conserva la cookie privada HttpOnly, Secure y SameSite=Strict y vence
a los siete días. Emitir otro QR activo exige una rotación explícita;
revocarlo o reemplazarlo invalida también las sesiones anteriores.

Las vistas de lectura unifican personas, pertenencias y accesos para el portal.
El servidor obtiene persona y edición únicamente de la sesión. Los invitados
solo ven sus presentaciones asignadas y los archivos aprobados de esas
presentaciones; se mantienen los controles de edición, bloque, galería y
descarga. El reconocimiento automático usa su nombre y academia reales. Las
subidas de diplomas personalizados siguen reservadas a registros normales.

La búsqueda automática de carpetas de Drive continúa usando identidades del
registro. Para invitados, la sincronización devuelve `unavailable`, sin
crear registros ni buscar carpetas de otra persona. Las fotos ya aprobadas
y asignadas a su presentación se sirven con las mismas comprobaciones de
pertenencia del portal.

`releve.link` permite asociar una presentación Relevé a una persona ya
registrada, sin cambiar su QR ni su inscripción. Comprueba la identidad del
coreógrafo, academia, edición y presentación. La asociación se guarda aparte
en `participant_portal_additional_dances`.

## Emisión operativa

Un operador autenticado en la cuenta propietaria de Cloudflare también puede
invocar las funciones de `worker/participant-guests.js` mediante D1, conservando
un identificador de operador en `created_by`. No se crean sesiones de
administrador, contraseñas, privilegios ni bypasses de la API de la web.

El emisor debe guardar en una carpeta privada la credencial aleatoria mediante
`beforeInsert` antes de insertar el acceso. Si se pierde la respuesta, se
comprueba el ID y hash guardados antes de continuar; nunca se genera un enlace
nuevo para resolver una respuesta incierta. Los QR existentes se reexportan
desde su emisión original y se cotejan con el hash activo.

La preparación estándar aplica únicamente tablas, vistas e índices aditivos.
Las pruebas comprueban aislamiento entre personas y academias, rechazo de
sesiones no administrativas, publicación, revocación, duplicados y
conservación de registros y accesos previos.
