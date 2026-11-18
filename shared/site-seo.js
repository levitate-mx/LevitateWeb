export const siteOrigin = "https://levitate.mx";
export const siteName = "Levitate MX";

// Public editorial pages only. Account, payment, voting and participant routes
// deliberately have no fallback here, even when the app displays the homepage.
export const sitePages = Object.freeze([
  {
    key: "home", path: "/",
    title: "Levitate MX | Competencia nacional de danza en México",
    description: "Conoce Levitate MX, la competencia nacional de danza con modalidades Motion y Aerial. Explora sedes, evaluaciones, workshops e inscripciones.",
    image: "/assets/levitate-home-hero-poster.jpg", imageAlt: "Escenario de la competencia nacional de danza Levitate MX",
  },
  {
    key: "motion", path: "/modalidades/levitate-motion/generos",
    title: "Competencia de danza escénica | Levitate Motion",
    description: "Consulta los géneros, categorías, divisiones por edad y requisitos de música de Levitate Motion para preparar tu participación en danza.",
    image: "/assets/visuals/community-kids-stage.jpg", imageAlt: "Participantes de danza en el escenario de Levitate Motion",
  },
  {
    key: "aerial", path: "/modalidades/levitate-aerial/evaluacion",
    title: "Competencia de danza aérea en México | Levitate Aerial",
    description: "Conoce los géneros Tela, Aro y Open de Levitate Aerial, sus categorías, niveles, obligatorios y criterios de evaluación.",
    image: "/assets/visuals/community-aerial-hoop.jpg", imageAlt: "Presentación de una disciplina aérea en Levitate MX",
  },
  {
    key: "inscripciones", path: "/inscripciones",
    title: "Inscripciones a la competencia de danza | Levitate MX",
    description: "Consulta costos y accesos de inscripción a Levitate MX: registro de academias, participantes y coreografías, además de información para el pago.",
    image: "/assets/inscripciones-hero-color-4.jpg", imageAlt: "Participantes de la competencia Levitate MX",
  },
  {
    key: "evaluaciones", path: "/evaluaciones",
    title: "Evaluaciones y criterios de jueceo | Levitate MX",
    description: "Conoce cómo se evalúa tu presentación en Levitate MX: criterios de coreografía, ejecución y performance, sistema de jueceo y retroalimentación.",
    image: "/assets/visuals/community-kids-stage.jpg", imageAlt: "Presentación de danza en el escenario de Levitate MX",
  },
  {
    key: "workshops", path: "/workshops",
    title: "Workshops de danza y disciplinas aéreas | Levitate MX",
    description: "Explora los workshops de Levitate MX, las disciplinas, docentes y horarios publicados, y la información para elegir tus talleres.",
    image: "/assets/workshops-hero-motion-4.jpg", imageAlt: "Bailarinas de Motion en el escenario de Levitate",
  },
  {
    key: "premiacion", path: "/premiacion",
    title: "Premiación: medallas, lugares y MVP | Levitate MX",
    description: "Conoce el medallero por puntaje, los lugares por competencia directa y los premios especiales de Levitate MX, incluido el MVP.",
    image: "/assets/premiation-recognition-special.jpg", imageAlt: "Comunidad Levitate celebrando la competencia",
  },
  {
    key: "releve", path: "/releve",
    title: "Relevé: alumnos creadores y maestros en escena | Levitate MX",
    description: "Descubre Relevé de Levitate MX: alumnos que crean y dirigen coreografías interpretadas por sus maestros en las ramas Motion y Aerial.",
    image: "/assets/releve-hero-award.png", imageAlt: "Alumnos y maestros celebrando en la premiación de Levitate",
  },
  {
    key: "mvps", path: "/salon-de-la-fama/mvps",
    title: "MVPs y becados del Salón de la Fama | Levitate MX",
    description: "Descubre las coreografías y academias MVP de Levitate MX por sede y edición, y consulta los reconocimientos de becados del Salón de la Fama.",
    image: "/assets/mvp-barracuda-2023-left.jpg", imageAlt: "Barracuda, coreografía MVP de la academia Ventuerion en Levitate",
  },
  {
    key: "estado-de-mexico", path: "/sedes/estado-de-mexico",
    title: "Levitate Estado de México: sede y programa | Levitate MX",
    description: "Consulta la sede de Levitate MX en el Teatro Gran Recinto de Tlalnepantla, el programa de bloques, modalidades, jurado y workshops.",
    image: "/assets/sedes-edomex-hero.jpg", imageAlt: "Teatro Gran Recinto, sede de Levitate en Estado de México",
  },
  {
    key: "veracruz", path: "/sedes/veracruz",
    title: "Levitate Veracruz: competencia de danza | Levitate MX",
    description: "Conoce la edición de Levitate MX en Veracruz y consulta la información publicada sobre la sede y las modalidades Motion y Aerial.",
    image: "/assets/sedes-veracruz-primavera-2027.png", imageAlt: "Edición de Levitate MX en Veracruz",
  },
].map(page => Object.freeze({ ...page, canonical: `${siteOrigin}${page.path}`, image: `${siteOrigin}${page.image}` })));

const aliases = Object.freeze({
  "/premio-releve": "/releve",
  "/modalidades/releve": "/releve",
  "/modalidades/levitate-releve": "/releve",
  "/sedes": "/sedes/estado-de-mexico",
  "/sedes/edomex": "/sedes/estado-de-mexico",
});
const byPath = new Map(sitePages.map(page => [page.path, page]));

export function resolveSiteMetadata(input) {
  if (typeof input !== "string" || !input || input.startsWith("//") || input.includes("\\")
    || !input.startsWith("/") && !/^https?:\/\//i.test(input)) return null;
  let url;
  try { url = new URL(input, siteOrigin); } catch { return null; }
  if (!["http:", "https:"].includes(url.protocol)) return null;
  const path = url.pathname === "/" ? "/" : url.pathname.replace(/\/$/, "");
  return byPath.get(Object.hasOwn(aliases, path) ? aliases[path] : path) ?? null;
}

export function getSiteMetadataTags(metadata) {
  const meta = (key, name, content, property = false) => ({ tagName: "meta", attributes: { "data-site-seo": key, [property ? "property" : "name"]: name, content } });
  return [
    { tagName: "title", attributes: { "data-site-seo": "title" }, text: metadata.title },
    meta("description", "description", metadata.description),
    { tagName: "link", attributes: { "data-site-seo": "canonical", rel: "canonical", href: metadata.canonical } },
    meta("og-site-name", "og:site_name", siteName, true),
    meta("og-type", "og:type", "website", true),
    meta("og-locale", "og:locale", "es_MX", true),
    meta("og-title", "og:title", metadata.title, true),
    meta("og-description", "og:description", metadata.description, true),
    meta("og-url", "og:url", metadata.canonical, true),
    meta("og-image", "og:image", metadata.image, true),
    meta("og-image-alt", "og:image:alt", metadata.imageAlt, true),
    meta("twitter-card", "twitter:card", "summary_large_image"),
    meta("twitter-title", "twitter:title", metadata.title),
    meta("twitter-description", "twitter:description", metadata.description),
    meta("twitter-url", "twitter:url", metadata.canonical),
    meta("twitter-image", "twitter:image", metadata.image),
    meta("twitter-image-alt", "twitter:image:alt", metadata.imageAlt),
  ];
}

export function isSiteMetadataTag(tagName, attributes) {
  const tag = String(tagName).toLowerCase();
  const name = String(attributes.name || "").trim().toLowerCase();
  const property = String(attributes.property || "").trim().toLowerCase();
  return tag === "title" || tag === "link" && String(attributes.rel || "").toLowerCase().split(/\s+/).includes("canonical")
    || tag === "meta" && (name === "description" || [name, property].some(value => value.startsWith("og:") || value.startsWith("twitter:")));
}

const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

export function renderSiteMetadataTags(metadata) {
  return getSiteMetadataTags(metadata).map(({ tagName, attributes, text }) => {
    const start = `<${tagName} ${Object.entries(attributes).map(([name, value]) => `${name}="${escapeHtml(value)}"`).join(" ")}>`;
    return tagName === "title" ? `${start}${escapeHtml(text)}</title>` : start;
  }).join("\n");
}

function htmlAttributes(tag) {
  const attributes = {};
  const content = tag.replace(/^<\w+\b/, "").replace(/\/?\s*>$/, "");
  for (const match of content.matchAll(/([^\s=/'"<>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
    attributes[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? "";
  }
  return attributes;
}

export function applySiteMetadataToHtml(html, metadata) {
  if (!metadata) return html;
  if (!/<head\b[^>]*>[\s\S]*?<\/head\s*>/i.test(html)) throw new Error("The site HTML must contain a head element.");
  return html.replace(/(<head\b[^>]*>)([\s\S]*?)(<\/head\s*>)/i, (_, opening, head, closing) => {
    // Do not mistake example markup in comments, scripts or styles for tags.
    const retained = head.replace(/<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>|<title\b[^>]*>[\s\S]*?<\/title\s*>|<(?:meta|link)\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi, tag => {
      const name = tag.match(/^<(title|meta|link)\b/i)?.[1];
      return name && isSiteMetadataTag(name, htmlAttributes(tag)) ? "" : tag;
    }).trimEnd();
    return `${opening}${retained}\n    ${renderSiteMetadataTags(metadata).replace(/\n/g, "\n    ")}\n  ${closing}`;
  });
}
