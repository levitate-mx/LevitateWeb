import {
  ArrowRight,
  Building2,
  CalendarDays,
  GraduationCap,
  Heart,
  MapPin,
  MessageCircle,
  Music2,
  Star,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { assets } from "../../data/homeContent";
import { LevitateFooter } from "./LevitateFooter";
import { LevitateHeader } from "./LevitateHeader";

const venues = [
  {
    title: "Teatro El Gran Recinto",
    city: "Tlalnepantla, Edo. Méx.",
    date: "13, 14 y 15 noviembre 2026",
    image: "/assets/sedes-edomex-hero.jpg",
    href: "/sedes/estado-de-mexico",
  },
  {
    title: "Primavera 2027",
    city: "",
    date: "",
    image: assets.hero,
  },
];

const whyItems = [
  {
    icon: GraduationCap,
    title: "Talleres que enriquecen",
    text: "Espacios de aprendizaje para fortalecer técnica, confianza y expresión artística.",
  },
  {
    icon: Users,
    title: "Comunidad que inspira",
    text: "Academias, participantes y artistas que se apoyan, se acompañan y celebran cada logro.",
  },
  {
    icon: Music2,
    title: "Diversidad dancística",
    text: "Danza aérea y danza de piso conviven en una misma experiencia escénica.",
  },
  {
    icon: Heart,
    title: "Competencia con propósito",
    text: "Más que un certamen: una plataforma para crecer, conectar y trascender.",
  },
];

const stats = [
  { icon: Users, value: "+900", label: "participaciones" },
  { icon: Star, value: "+250", label: "academias" },
  { icon: MapPin, value: "16", label: "estados de la república" },
  { icon: Heart, value: "90%", label: "repite la experiencia" },
  { icon: Building2, value: "6", label: "sedes nacionales" },
];

const galleryImages = {
  folkStage: {
    image: assets.communityFolkStage,
    alt: "Grupo de danza folclórica en escenario Levitate",
  },
  lyraSmoke: {
    image: assets.communityLyraSmoke,
    alt: "Artista en aro aéreo sobre escenario con humo e iluminación",
  },
  kidsStage: {
    image: assets.communityKidsStage,
    alt: "Grupo infantil bailando en escenario Levitate",
  },
  floorSpotlight: {
    image: assets.communityFloorSpotlight,
    alt: "Artista de danza bajo luces de escenario",
  },
  redHoop: {
    image: assets.communityRedHoop,
    alt: "Artista en aro aéreo con vestuario rojo sobre escenario Levitate",
  },
  aerialHoop: {
    image: assets.communityAerial,
    alt: "Artista suspendida en aro aéreo con luz escénica",
  },
  aquaSilks: {
    image: assets.communityAquaSilks,
    alt: "Artista en telas aéreas color aqua durante una presentación",
  },
  duoSilks: {
    image: assets.communityDuoSilks,
    alt: "Dúo de artistas en telas aéreas con luces moradas",
  },
  redSilks: {
    image: assets.communityRedSilks,
    alt: "Artista en telas aéreas rojas sobre escenario",
  },
  blueSilks: {
    image: assets.communityBlueSilks,
    alt: "Artista en telas aéreas azules durante una presentación",
  },
};

const galleryExamples = [
  {
    id: "mosaico",
    label: "01",
    title: "Mosaico",
    className: "levitate-gallery--mosaic",
    tiles: [
      { ...galleryImages.folkStage, className: "is-feature" },
      { ...galleryImages.floorSpotlight, className: "is-wide-top" },
      { ...galleryImages.aerialHoop, className: "is-wide-top" },
      { ...galleryImages.redHoop, className: "is-wide-mid" },
      { ...galleryImages.lyraSmoke, className: "is-wide-mid" },
      { ...galleryImages.kidsStage, className: "is-feature-lower" },
      { ...galleryImages.aquaSilks, className: "is-tall" },
      { ...galleryImages.duoSilks, className: "is-tall" },
      { ...galleryImages.redSilks, className: "is-tall" },
      { ...galleryImages.blueSilks, className: "is-tall" },
    ],
  },
  {
    id: "editorial",
    label: "02",
    title: "Editorial",
    className: "levitate-gallery--editorial",
    tiles: [
      { ...galleryImages.lyraSmoke, className: "is-cover" },
      { ...galleryImages.folkStage, className: "is-side-a" },
      { ...galleryImages.redHoop, className: "is-side-b" },
      { ...galleryImages.kidsStage, className: "is-strip-a" },
      { ...galleryImages.duoSilks, className: "is-strip-b" },
    ],
  },
  {
    id: "ritmo",
    label: "03",
    title: "Ritmo",
    className: "levitate-gallery--rhythm",
    tiles: [
      { ...galleryImages.folkStage, className: "is-landscape" },
      { ...galleryImages.aquaSilks, className: "is-portrait" },
      { ...galleryImages.duoSilks, className: "is-portrait is-raised" },
      { ...galleryImages.redSilks, className: "is-portrait" },
      { ...galleryImages.kidsStage, className: "is-landscape is-lower" },
      { ...galleryImages.blueSilks, className: "is-portrait is-raised" },
    ],
  },
  {
    id: "escenario",
    label: "04",
    title: "Escenario",
    className: "levitate-gallery--stage",
    tiles: [
      { ...galleryImages.floorSpotlight, className: "is-backdrop" },
      { ...galleryImages.folkStage, className: "is-main" },
      { ...galleryImages.redHoop, className: "is-card-a" },
      { ...galleryImages.aerialHoop, className: "is-card-b" },
      { ...galleryImages.lyraSmoke, className: "is-card-c" },
    ],
  },
  {
    id: "postales",
    label: "05",
    title: "Postales",
    className: "levitate-gallery--postcards",
    tiles: [
      { ...galleryImages.redHoop, className: "is-postcard-a" },
      { ...galleryImages.folkStage, className: "is-postcard-b" },
      { ...galleryImages.kidsStage, className: "is-postcard-c" },
      { ...galleryImages.duoSilks, className: "is-postcard-d" },
      { ...galleryImages.aquaSilks, className: "is-postcard-e" },
      { ...galleryImages.blueSilks, className: "is-postcard-f" },
    ],
  },
];

const sponsors = [
  { name: "Electrolit", logo: "/assets/electrolit-logo.png", className: "sponsor-electrolit" },
  { name: "AEParty", logo: "/assets/sponsor-aeparty.png", className: "sponsor-aeparty" },
  { name: "VideoImagen Digital", logo: "/assets/sponsor-videoimagen-digital.png", className: "sponsor-videoimagen" },
];

const announcementItems = [
  { kind: "text", label: "¡Asegura tu lugar!" },
  { kind: "text", label: "Conoce los precios preventa" },
  { kind: "text", label: "Otoño 2026" },
  { kind: "logo", label: "Levitate MX" },
  { kind: "text", label: "¡Inscríbete ahora!" },
] satisfies Array<{ kind: "text" | "logo"; label: string }>;

const announcementHref = "#premios";
const heroVideoMediaQuery = "(min-width: 769px) and (prefers-reduced-motion: no-preference)";

type BrowserConnection = {
  effectiveType?: string;
  saveData?: boolean;
};

function canUseHomeHeroVideo() {
  const connection =
    (navigator as Navigator & {
      connection?: BrowserConnection;
      mozConnection?: BrowserConnection;
      webkitConnection?: BrowserConnection;
    }).connection ??
    (navigator as Navigator & { mozConnection?: BrowserConnection }).mozConnection ??
    (navigator as Navigator & { webkitConnection?: BrowserConnection }).webkitConnection;

  if (connection?.saveData || connection?.effectiveType?.includes("2g")) {
    return false;
  }

  return window.matchMedia(heroVideoMediaQuery).matches;
}

export function HomePage() {
  const [shouldRenderHeroVideo, setShouldRenderHeroVideo] = useState(false);
  const [activeGalleryIndex, setActiveGalleryIndex] = useState(0);
  const activeGallery = galleryExamples[activeGalleryIndex] ?? galleryExamples[0];

  useEffect(() => {
    const mediaQuery = window.matchMedia(heroVideoMediaQuery);
    const updateHeroVideoPreference = () => setShouldRenderHeroVideo(canUseHomeHeroVideo());

    updateHeroVideoPreference();
    mediaQuery.addEventListener("change", updateHeroVideoPreference);

    return () => mediaQuery.removeEventListener("change", updateHeroVideoPreference);
  }, []);

  useEffect(() => {
    const items = document.querySelectorAll<HTMLElement>("[data-levitate-reveal]");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14 },
    );

    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, []);

  return (
    <main className="levitate-page">
      <section id="inicio" className="levitate-hero">
        <img className="levitate-hero__poster" src="/assets/levitate-home-hero-poster.jpg" alt="" fetchPriority="high" aria-hidden="true" />
        {shouldRenderHeroVideo ? (
          <video
            className="levitate-hero__media"
            poster="/assets/levitate-home-hero-poster.jpg"
            autoPlay
            muted
            loop
            playsInline
            preload="none"
            aria-hidden="true"
          >
            <source src="/assets/levitate-home-hero.mp4" type="video/mp4" />
          </video>
        ) : null}
        <div className="levitate-hero__smoke" aria-hidden="true" />

        <div className="levitate-announcement" aria-label="Avisos importantes">
          <div className="levitate-announcement__track">
            {[...announcementItems, ...announcementItems, ...announcementItems].map((item, index) => (
              <a href={announcementHref} key={`${item.label}-${index}`}>
                {item.kind === "logo" ? (
                  <span className="levitate-announcement__logo" aria-label={item.label}>
                    <span>Levitate</span>
                    <small>MX</small>
                  </span>
                ) : (
                  <strong>{item.label}</strong>
                )}
              </a>
            ))}
          </div>
        </div>

        <LevitateHeader activeLabel="Inicio" />

        <div className="levitate-hero__grid">
          <div className="levitate-hero__copy" data-levitate-reveal>
            <h1>
              <span>Eleva tu arte</span>
              <strong>Vive la experiencia Levitate</strong>
            </h1>
            <p>Un encuentro para academias, participantes y artistas que buscan inspiración, crecimiento y conexión.</p>
            <div className="levitate-hero__actions">
              <a className="levitate-button levitate-button--primary" href="#convocatorias">
                Ver próximos eventos <ArrowRight aria-hidden="true" size={18} />
              </a>
              <a className="levitate-button levitate-button--outline" href="https://wa.me/5217774920775">
                <MessageCircle aria-hidden="true" size={18} /> Contáctanos por WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="convocatorias" className="levitate-venues">
        <div className="levitate-section-title" data-levitate-reveal>
          <span />
          <h2>Próximas sedes</h2>
          <span />
        </div>
        <div className="levitate-venue-grid">
          {venues.map((venue) => {
            const content = (
              <>
                <img src={venue.image} alt="" loading="lazy" />
                <div>
                  <h3>{venue.title}</h3>
                  {venue.city ? <p><MapPin aria-hidden="true" size={16} /> {venue.city}</p> : null}
                  {venue.date ? <p><CalendarDays aria-hidden="true" size={16} /> {venue.date}</p> : null}
                  {venue.href ? (
                    <span>Ver convocatoria <ArrowRight aria-hidden="true" size={16} /></span>
                  ) : (
                    <span>Próximamente...</span>
                  )}
                </div>
              </>
            );

            return venue.href ? (
              <a className="levitate-venue-card" href={venue.href} key={venue.title} data-levitate-reveal>
                {content}
              </a>
            ) : (
              <article className="levitate-venue-card levitate-venue-card--soon" key={venue.title} data-levitate-reveal>
                {content}
              </article>
            );
          })}
        </div>
      </section>

      <section id="categorías" className="levitate-why">
        <div className="levitate-why__copy" data-levitate-reveal>
          <p className="levitate-eyebrow">¿Por qué</p>
          <h2>Levitate?</h2>
          <span aria-hidden="true" />
          <div className="levitate-why__manifesto">
            <strong>No es solo competir.</strong>
            <em>Es crecer.</em>
            <strong>Aprender.</strong>
            <em>Conectar.</em>
            <strong>Y volar.</strong>
          </div>
          <p className="levitate-why__closing">
            Cada sede se vive como una <span>experiencia artística en comunidad.</span>
          </p>
        </div>

        <div className="levitate-why__list" data-levitate-reveal>
          {whyItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <article key={item.title}>
                <Icon aria-hidden="true" size={54} strokeWidth={1.7} />
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h3>{item.title}</h3>
                <i aria-hidden="true" />
                <p>{item.text}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section id="premios" className="levitate-stats" aria-label="Levitate en números" data-levitate-reveal>
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <article key={stat.label}>
              <Icon aria-hidden="true" size={38} />
              <div>
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </div>
            </article>
          );
        })}
      </section>

      <section id="galeria" className="levitate-community">
        <div className="levitate-community__copy" data-levitate-reveal>
          <p className="levitate-eyebrow">Comunidad</p>
          <h2>
            Explora <span>formatos</span> de galería
          </h2>
          <span aria-hidden="true" />
          <div className="levitate-gallery-tabs" role="tablist" aria-label="Ejemplos de galería">
            {galleryExamples.map((example, index) => (
              <button
                aria-controls={`levitate-gallery-panel-${example.id}`}
                aria-selected={activeGalleryIndex === index}
                id={`levitate-gallery-tab-${example.id}`}
                key={example.id}
                onClick={() => setActiveGalleryIndex(index)}
                role="tab"
                type="button"
              >
                <span>{example.label}</span>
                <strong>{example.title}</strong>
              </button>
            ))}
          </div>
        </div>

        <div
          aria-labelledby={`levitate-gallery-tab-${activeGallery.id}`}
          className={`levitate-gallery ${activeGallery.className}`}
          id={`levitate-gallery-panel-${activeGallery.id}`}
          role="tabpanel"
        >
          {activeGallery.tiles.map((item, index) => (
            <figure className={`levitate-gallery__tile ${item.className}`} key={`${activeGallery.id}-${item.image}-${index}`}>
              <img src={item.image} alt={item.alt} loading="lazy" />
            </figure>
          ))}
          <div className="levitate-gallery__statement" aria-label="Donde el arte nos une">
            <span>Comunidad</span>
            <strong>
              Donde el <em>arte</em> nos une
            </strong>
            <i aria-hidden="true" />
          </div>
        </div>
      </section>

      <section className="levitate-sponsors" aria-label="Sponsors">
        <div className="levitate-section-title levitate-section-title--small" data-levitate-reveal>
          <span />
          <h2>Sponsors</h2>
          <span />
        </div>
        <div className="levitate-sponsor-row" data-levitate-reveal>
          {sponsors.map((sponsor) => (
            <strong className={`has-logo ${sponsor.className}`} key={sponsor.name}>
              {sponsor.logo ? <img src={sponsor.logo} alt={sponsor.name} loading="lazy" /> : <span>{sponsor.name}</span>}
            </strong>
          ))}
        </div>
      </section>

      <LevitateFooter />
    </main>
  );
}
