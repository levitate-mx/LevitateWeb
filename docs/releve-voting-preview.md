# Prueba de votación Relevé por enlace

La página independiente está en `/votacion-releve` y no requiere iniciar sesión.
Es un prototipo para revisar el recorrido del público antes de definir y
habilitar una votación real. No hay enlaces hacia ella en los menús públicos,
el portal de academias ni el espacio de jueceo. Tanto el encabezado HTTP
`X-Robots-Tag` como la etiqueta `robots` de la página indican `noindex, nofollow`.
La ruta es pública para quien conozca el enlace; no es una página privada.

Los enlaces anteriores `/jueceo/releve` y `/admin/releve/votacion` redirigen a
la nueva página. El alias de jueceo se resuelve antes de comprobar sesiones,
también sin acceso a la base de datos.

## Alcance actual

- La página pública muestra una galería de cinco opciones, distribuida como el
  boceto proporcionado: dos fotos, una centrada y dos fotos.
- Cuatro fotografías proporcionadas por la organización, en el orden indicado:
  ESTRELLA MÍSTICA, QUEEN OF COSMIC FEVER, Damar y Hazel. Se prepararon en WebP
  sin modificar su contenido. El encuadre cuadrado se ajusta en la página.
- Falta la foto de Mariana Álvarez Dorado, de «Reloj de los 70s y 80s». Su espacio
  aparece como «Foto pendiente» y no se puede seleccionar en esta revisión.
- Cada foto permite seleccionar una opción; «Votar» abre una confirmación breve.
  La confirmación indica que es una elección de prueba. No hay resultados ni
  controles administrativos en la página pública.
- Las elecciones de prueba viven únicamente en la memoria de la página.
  No se envían, comparten ni guardan en una base de datos o en el navegador.
  Recargar o salir de la sección reinicia la simulación.

La página carga un catálogo estático en `src/data/releveVotingCandidates.ts`,
sin consultar sesiones, inscripciones ni endpoints de administración. Solo se
publican las fotos y los nombres indicados para esta galería. No se incluye la
imagen del boceto entre los candidatos.

La vista administrativa mantiene sus seis candidatos ficticios en
`shared/releve-voting-preview.js` y sus controles de simulación. Las rutas de
jueceo y sus APIs conservan su autenticación.
`GET /api/registration/admin/releve-voting/preview` sigue exigiendo un rol
`admin` o `judging_admin` en el servidor. Su respuesta utiliza
`Cache-Control: private, no-store` y `Vary: Cookie`; no actualiza la sesión
ni otros registros durante la consulta.

Los datos de la API administrativa indican explícitamente `mode: "preview"` y
`publicVotingEnabled: false`. No existen rutas de emisión de votos. Cambiar el
estado del prototipo no habilita la votación pública.

## Antes de una votación real

Quedan por definir la lista oficial por sede y rama, el periodo de votación,
quién puede votar y cómo se identifica, los límites de votos, la resolución de
empates, y cuándo se publican los resultados. Los controles del prototipo no
establecen esas reglas definitivas.

La próxima implementación necesitará persistencia y validación de votos en el
servidor, control de apertura y cierre, protección contra duplicados y abuso, y
una apertura pública explícita. Ninguna de esas funciones queda activada con
esta prueba.

## Verificación

Las pruebas cubren la página sin sesión ni base de datos, los alias y encabezados
de no indexación, el acceso protegido a la API administrativa, ausencia de
escrituras, rechazo de otros métodos y de rutas de votos, datos ficticios y
comportamiento de la simulación. La revisión visual de la galería incluye
1280×720 y 390×844, el encuadre de cada foto, la distribución 2–1–2, la selección
con teclado y la confirmación de prueba sin persistencia.
