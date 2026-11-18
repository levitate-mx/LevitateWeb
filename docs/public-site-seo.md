# SEO de páginas públicas

`shared/site-seo.js` define títulos, descripciones, canonical y tarjetas sociales
para las once páginas del sitemap. Las URL canónicas usan `https://levitate.mx`,
sin parámetros de campaña, fragmentos ni variantes de barra final. Los alias
existentes conservan la navegación y apuntan a su página canónica.

`npm run build` genera los documentos públicos en `dist/client/__seo/<key>/`.
Inicio, Motion y Aerial incluyen el HTML de sus componentes React actuales,
sin duplicar sus textos en plantillas. El cliente hidrata ese contenido con el
mismo árbol y los mismos estilos. Las otras páginas reciben sus metadatos desde
la primera respuesta y montan su interfaz normalmente.

El menú de Inicio incluye sus enlaces reales a Motion y Aerial en el HTML
inicial. El menú y los submenús cerrados permanecen montados con `hidden` e
`inert`, fuera de la vista y del recorrido del teclado. Al abrirlos se muestran
los mismos elementos y estilos de navegación; no se agrega una lista exclusiva
para buscadores ni se altera el aspecto de la portada.

El `index.html` general conserva un root vacío para los accesos personales,
administrativos y demás rutas de la aplicación. El Worker sólo entrega los
documentos nuevos para la lista explícita de páginas públicas y peticiones
GET/HEAD. No consulta sesiones ni la base de datos para producirlos. Las URL
internas `/__seo/*` responden 404 cuando se solicitan directamente; no se
agregan al sitemap. Un archivo de build faltante o inválido devuelve un error
temporal 503 y nunca se disfraza de portada.

La generación forma parte del build habitual y se repite en cada publicación,
por lo que los textos prerenderizados se actualizan con los mismos componentes
que ve el visitante. No hay un servicio externo ni una tarea programada.

Verificación:

- Ejecutar `npm run test:registration`, las pruebas de metadatos y `npm run build`.
- Confirmar en la respuesta HTML original títulos y canonical únicos en las
  once rutas, incluido GET/HEAD con barra final y alias.
- Confirmar títulos, textos y enlaces dentro del primer HTML de las tres rutas
  prerenderizadas y la ausencia de contenido de esas páginas en el shell general.
- Revisar escritorio y celular: diseño, menús y botones funcionales, sin errores
  de hidratación en la consola.

Estas mejoras preparan las páginas para el rastreo; Google decide cuándo
actualizar la indexación y cómo presentar cada resultado.
