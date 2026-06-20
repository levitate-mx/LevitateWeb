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
import { useEffect } from "react";
import { assets } from "../../data/homeContent";
import { LevitateFooter } from "./LevitateFooter";
import { LevitateHeader } from "./LevitateHeader";

const venues = [
  {
    title: "Cirko de Mente",
    city: "Ciudad de México",
    date: "29, 30 y 31 de mayo 2026",
    image: assets.competition,
    href: "/sedes/ciudad-de-mexico",
  },
  {
    title: "Auditorio Daniel Forcelledo",
    city: "Puebla",
    date: "7 de junio 2026",
    image: assets.hero,
    href: "/sedes/puebla",
  },
  {
    title: "Teatro El Gran Recinto",
    city: "Tlalnepantla, Edo. Méx.",
    date: "13, 14 y 15 noviembre 2026",
    image: assets.venue,
    href: "/sedes/estado-de-mexico",
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

const gallery = [
  { image: assets.venue, className: "levitate-gallery__item--wide", alt: "Público durante una presentación Levitate" },
  { image: assets.community, alt: "Comunidad Levitate celebrando backstage" },
  { image: assets.workshops, alt: "Jueces y producción de Levitate" },
  { image: assets.competition, className: "levitate-gallery__item--tall", alt: "Artista aérea en escena" },
  { image: assets.hero, alt: "Reconocimientos Levitate" },
  { image: assets.competition, alt: "Presentación aérea con luces rosas" },
  { image: assets.venue, className: "levitate-gallery__item--wide", alt: "Escenario Levitate con público" },
  { image: assets.competition, className: "levitate-gallery__item--vertical", alt: "Presentación vertical Levitate en escena" },
];

const sponsors = [
  { name: "Electrolit", logo: "/assets/electrolit-logo.png" },
  { name: "aeparty" },
  { name: "videoimagendigital" },
];

const announcementItems = [
  "Preventa disponible para Otoño 2026",
  "Asegura tu lugar en Levitate MX",
  "Inscripciones y beneficios por temporada",
];

export function HomePage() {
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
        <img className="levitate-hero__media" src={assets.hero} alt="" aria-hidden="true" />
        <div className="levitate-hero__smoke" aria-hidden="true" />
        <div className="levitate-hero__silk levitate-hero__silk--one" aria-hidden="true" />
        <div className="levitate-hero__silk levitate-hero__silk--two" aria-hidden="true" />

        <div className="levitate-announcement" aria-label="Avisos importantes">
          <div className="levitate-announcement__track">
            {[...announcementItems, ...announcementItems, ...announcementItems].map((item, index) => (
              <span key={`${item}-${index}`}>
                <strong>{item}</strong>
                <i aria-hidden="true">Levitate MX</i>
              </span>
            ))}
          </div>
        </div>

        <LevitateHeader activeLabel="Inicio" />

        <div className="levitate-hero__grid">
          <div className="levitate-hero__copy" data-levitate-reveal>
            <p className="levitate-eyebrow">Competencia nacional de danza</p>
            <h1>
              <span>Eleva tu arte</span>
              <strong>Vive la experiencia Levitate</strong>
            </h1>
            <p>Un encuentro para academias, participantes y artistas que buscan inspiración, crecimiento y conexión.</p>
            <div className="levitate-hero__actions">
              <a className="levitate-button levitate-button--primary" href="#convocatorias">
                Ver próximos eventos <ArrowRight aria-hidden="true" size={18} />
              </a>
              <a className="levitate-button levitate-button--outline" href="#contacto">
                <MessageCircle aria-hidden="true" size={18} /> Contáctanos por WhatsApp
              </a>
            </div>
          </div>

          <aside className="levitate-next-event" aria-label="Próximo evento" data-levitate-reveal>
            <p>Próximo evento</p>
            <h2>Cirko de Mente</h2>
            <span><MapPin aria-hidden="true" size={17} /> Ciudad de México</span>
            <span><CalendarDays aria-hidden="true" size={17} /> 29, 30 y 31 de mayo 2026</span>
            <div className="levitate-next-event__line" />
            <a href="#convocatorias">Ver fechas y sedes <ArrowRight aria-hidden="true" size={16} /></a>
          </aside>
        </div>
      </section>

      <section id="convocatorias" className="levitate-venues">
        <div className="levitate-section-title" data-levitate-reveal>
          <span />
          <h2>Próximas sedes</h2>
          <span />
        </div>
        <div className="levitate-venue-grid">
          {venues.map((venue) => (
            <a className="levitate-venue-card" href={venue.href} key={venue.title} data-levitate-reveal>
              <img src={venue.image} alt="" loading="lazy" />
              <div>
                <h3>{venue.title}</h3>
                <p><MapPin aria-hidden="true" size={16} /> {venue.city}</p>
                <p><CalendarDays aria-hidden="true" size={16} /> {venue.date}</p>
                <span>Ver convocatoria <ArrowRight aria-hidden="true" size={16} /></span>
              </div>
            </a>
          ))}
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

      <section id="workshops" className="levitate-community">
        <div className="levitate-community__copy" data-levitate-reveal>
          <p className="levitate-eyebrow">Comunidad</p>
          <h2>Donde el arte nos une</h2>
          <span aria-hidden="true" />
        </div>
        <div className="levitate-gallery" data-levitate-reveal>
          {gallery.map((item, index) => (
            <figure className={item.className} key={`${item.image}-${index}`}>
              <img src={item.image} alt={item.alt} loading="lazy" />
            </figure>
          ))}
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
            <strong className={sponsor.logo ? "has-logo" : ""} key={sponsor.name}>
              {sponsor.logo ? <img src={sponsor.logo} alt={sponsor.name} loading="lazy" /> : <span>{sponsor.name}</span>}
            </strong>
          ))}
        </div>
      </section>

      <LevitateFooter />
    </main>
  );
}
