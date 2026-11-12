# Votación Relevé por enlace

`/votacion-releve` recibe votos reales cuando administración abre la votación.
La instalación queda cerrada. No se agregan enlaces en menús públicos ni se
publican resultados. La página y sus alias conservan `noindex, nofollow`.

## Participantes

El catálogo aprobado de Estado de México · Otoño 2026 vive en
`shared/releve-voting-catalog.js`, compartido por servidor y navegador.
Incluye cinco opciones: Estrella Mística, Queen of Cosmic Fever, Con amor,
Guardiana del mar y Reloj de los 70s y 80s. La galería conserva la distribución
2–1–2 y muestra academia, coreografía y nombre completo, en ese orden.

La foto de Mariana sigue pendiente. Su opción es seleccionable cuando la
votación está abierta, para no excluir a una participante confirmada por faltar
su foto. La confirmación vuelve a mostrar la identidad elegida.

## Voto único aproximado por dispositivo

Por decisión de la organización no se solicita código ni inicio de sesión.
FingerprintJS 5.3.0 se sirve dentro del sitio, con `monitoring: false`.
Solo su identificador resumido llega al servidor; los atributos detallados y
la telemetría no se envían a un proveedor externo. La identificación se inicia
únicamente cuando la votación está abierta.

El servidor deriva un hash acotado a esta votación y lo vincula a una sesión
aleatoria con cookie `HttpOnly`, `Secure` y `SameSite=Strict`. Reenviar una huella
distinta desde la misma sesión no cambia esa identidad. La base exige una sola
boleta por `(poll_id, voter_hash)` incluso ante solicitudes simultáneas.

Una sesión nueva con la misma huella encuentra el voto anterior y no puede
emitir otro. No recibe la elección anterior si no conserva la cookie original.
La boleta no se cambia ante reintentos; el servidor devuelve el comprobante ya
persistido. La interfaz solo confirma después de recibir esa respuesta. Ante
una respuesta incierta ofrece verificar el estado antes de intentar otra vez.

Este control **es aproximado**. La huella proviene del navegador y no es una
identidad autenticada: puede cambiar con otro navegador, protecciones de
privacidad o manipulación deliberada. También puede coincidir entre usuarios.
No garantiza un único voto por teléfono, ni por persona, ni inmunidad al modo
incógnito. La interfaz pública y administración muestran esta limitación.

No se impone un único voto por IP: distintos asistentes con el mismo Wi-Fi
pueden votar. Hay un límite de solicitudes por minuto y dirección resumida
para frenar ráfagas, sin almacenar la IP original. No sustituye una identidad
verificada ni una protección completa frente a automatización.

## Administración

En `/jueceo/admin?view=releve`, **Votación Relevé** permite consultar totales
por participante, copiar el enlace, abrir y cerrar. Requiere una sesión real
con rol `admin` o `judging_admin`, verificada en cada solicitud.

La apertura exige una segunda confirmación e informa que se recibirán votos
reales por los cinco participantes. Cerrar impide nuevos votos y conserva los
existentes. Reabrir continúa el mismo recuento y las mismas restricciones de
duplicados. No hay acción para reiniciar, borrar o cambiar votos.

Las modificaciones comprueban una revisión para no pisar a otro administrador.
Cada apertura y cierre registra actor, revisión y transición en una bitácora
privada. No se alteran registros, CURP, QR de acceso, pagos ni notas de jueces.

## Bono en el dictamen final

El dictamen del evento definitivo de Estado de México conecta los votos con
las cinco rutinas Relevé mediante sus IDs de origen verificados, no mediante
los números editables del programa. Las cinco aparecen juntas en una categoría
Relevé, con jurado, votos, bono y puntaje final, también en el PDF.

El favorito único recibe **5 puntos fijos** después de calcular el puntaje
normalizado del jurado sobre 150: el total puede llegar a **155**. Los votos
no se convierten proporcionalmente en puntos. El bono se deriva del recuento
guardado; actualizar o volver a cerrar no lo acumula ni modifica las notas.

La apertura y el cierre siguen siendo manuales desde administración. El estado
y los totales se consultan en una sola lectura consistente. Mientras la
votación no haya comenzado, esté abierta o no pueda comprobarse, Relevé no
recibe lugares finales ni se publica automáticamente en Mi Levitate. Reabrir
retira la condición de resultado final hasta volver a cerrar. Una votación
abierta y luego cerrada sin votos termina sin bono.

Por decisión de la organización, un **empate del público queda por definir**:
se muestran las opciones empatadas, no se otorga un bono automático y el
dictamen de Relevé permanece pendiente. No se inventa una regla de desempate.
Mi Levitate usa la escala de 155 únicamente para las rutinas Relevé; las demás
rutinas conservan su escala y sus reglas.

## Endpoints y almacenamiento

- `GET /api/releve-voting`: estado, catálogo público y comprobante de la sesión;
  nunca devuelve recuentos, identidades internas ni hashes.
- `POST /api/releve-voting/session`: reconoce la huella del navegador y crea o
  reutiliza su sesión cuando la votación está abierta.
- `POST /api/releve-voting/vote`: guarda la primera elección válida. Valida
  origen, sesión, candidato permitido y estado abierto dentro del INSERT.
- `GET/POST /api/registration/admin/releve-voting`: totales y apertura/cierre,
  exclusivamente para administración autenticada.

Todas las respuestas usan `private, no-store` y `Vary: Cookie`. Los POST exigen
JSON del mismo origen, un cuerpo acotado y campos permitidos. No se aceptan
IDs de votaciones o ediciones elegidos por el navegador. Los errores de
almacenamiento no se muestran como éxitos o recuentos de cero.

`db/registration_releve_voting.sql` agrega tablas de votación, sesiones,
boletas, bitácora y límites. La preparación estándar las instala antes de
publicar el Worker; no abre la votación ni inserta boletas de prueba.
Las sesiones y los límites vencidos se limpian durante solicitudes POST;
la expiración de una sesión no elimina su voto.

La antigua API `/api/registration/admin/releve-voting/preview` conserva su
simulación de seis candidatos ficticios, protegida y sin persistencia. No se
usa para la votación real ni puede abrirla.

## Verificación

Las pruebas comprueban autenticación administrativa, cierre inicial, votos
persistentes, repetición sin cookie con la misma huella, privacidad del
comprobante, solicitudes simultáneas, sesiones vencidas, aislamiento de
resultados, origen y tamaño del cuerpo, revisiones concurrentes, cierre
durante un envío, recuentos y reapertura sin reinicio. Las pruebas de flujo
usan almacenamiento local; no se emiten votos de ensayo en producción.
