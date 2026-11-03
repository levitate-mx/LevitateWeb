# Prueba privada de votación Relevé

La sección **Pruebas → Votación Relevé** del panel administrativo está en
`/admin/releve/votacion`. Es un prototipo para revisar el recorrido del público
antes de definir y habilitar una votación real.

## Alcance actual

- Dos ramas separadas: Relevé Motion y Relevé Aerial.
- Seis participaciones ficticias, identificadas como ejemplos; no se consultan
  inscripciones, maestros ni academias reales.
- Selección de candidato, confirmación y recibo de voto simulado.
- Estados de apertura y cierre para probar la experiencia.
- Los votos y resultados de prueba viven únicamente en la memoria del panel.
  No se envían, comparten ni guardan en una base de datos o en el navegador.
  Recargar o salir de la sección reinicia la simulación.

La ruta no está enlazada desde el sitio público ni desde el portal de academias.
El panel verifica la sesión normal y rechaza a usuarios sin rol `admin` antes
de montar el prototipo. Además, `GET /api/registration/admin/releve-voting/preview`
exige autenticación administrativa en el servidor antes de devolver los
candidatos de ejemplo. La respuesta utiliza `Cache-Control: private, no-store`
y `Vary: Cookie`; no actualiza la sesión ni otros registros durante la consulta.
La aplicación pública puede servir el mismo HTML base del sitio, pero ese HTML
no contiene la maqueta ni sus candidatos.

El servidor devuelve explícitamente `mode: "preview"` y
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

Las pruebas cubren acceso sin sesión, acceso de academia, acceso administrativo,
ausencia de escrituras, rechazo de otros métodos y de rutas de votos, datos
ficticios y comportamiento de la simulación. La revisión visual incluye
1280×720 y 390×844.
