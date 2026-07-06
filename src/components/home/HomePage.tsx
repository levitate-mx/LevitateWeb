import {
  ArrowRight,
  Award,
  Building2,
  CalendarDays,
  GraduationCap,
  MapPin,
  Star,
  Trophy,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
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
    image: "/assets/sedes-primavera-2027-theater.jpeg",
  },
];

const standardCards = [
  {
    icon: Trophy,
    title: "Escenario de alto nivel",
    text: "Producción, sede y ritmo pensados para que cada presentación llegue con la presencia que merece.",
  },
  {
    icon: Award,
    title: "Criterio de\njueceo",
    text: "Evaluación transparente en cada momento y una retroalimentación que te ayuda a crecer.",
  },
  {
    icon: GraduationCap,
    title: "Formación que eleva",
    text: "Workshops y recursos para llegar al escenario con más técnica, intención y seguridad.",
  },
  {
    icon: Users,
    title: "Comunidad única",
    text: "Academias y artistas nacionales e internacionales que se apoyan y comparten una experiencia inolvidable.",
  },
];

const stats = [
  { icon: Users, value: "+900", label: "participaciones" },
  { icon: Star, value: "+250", label: "academias" },
  { icon: MapPin, value: "16", label: "Estados de la República" },
  { icon: CalendarDays, value: "90%", label: "repite la experiencia" },
  { icon: Building2, value: "6", label: "sedes nacionales" },
];

const sponsors = [
  { name: "Electrolit", logo: "/assets/electrolit-logo.png", className: "sponsor-electrolit" },
  { name: "AEParty", logo: "/assets/sponsor-aeparty.png", className: "sponsor-aeparty" },
  { name: "VideoImagen Digital", logo: "/assets/sponsor-videoimagen-digital.png", className: "sponsor-videoimagen" },
];

const heroVideoMediaQuery = "(prefers-reduced-motion: no-preference)";

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

  useEffect(() => {
    const gradientLine = document.querySelector<HTMLElement>("[data-levitate-gradient-line]");
    const section = gradientLine?.closest<HTMLElement>(".levitate-home-standard");

    if (!gradientLine || !section) {
      return;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;

    const clamp = (value: number) => Math.min(Math.max(value, 0), 1);
    const ease = (value: number) => value * value * (3 - 2 * value);

    const renderGradientLine = () => {
      if (reducedMotion.matches) {
        gradientLine.style.setProperty("--home-gradient-progress", "100%");
        return;
      }

      const sectionRect = section.getBoundingClientRect();
      const viewportHeight = window.innerHeight || 1;
      const triggerPoint = sectionRect.top;
      const start = viewportHeight * 0.48;
      const finish = viewportHeight * 0.16;
      const progress = ease(clamp((start - triggerPoint) / (start - finish)));

      gradientLine.style.setProperty("--home-gradient-progress", `${(progress * 100).toFixed(2)}%`);
    };

    const requestRender = () => {
      if (frame) {
        return;
      }

      frame = window.requestAnimationFrame(() => {
        frame = 0;
        renderGradientLine();
      });
    };

    renderGradientLine();
    window.addEventListener("scroll", requestRender, { passive: true });
    window.addEventListener("resize", requestRender);
    reducedMotion.addEventListener("change", requestRender);

    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }

      window.removeEventListener("scroll", requestRender);
      window.removeEventListener("resize", requestRender);
      reducedMotion.removeEventListener("change", requestRender);
    };
  }, []);

  return (
    <main className="levitate-page levitate-home-redesign">
      <section id="inicio" className="levitate-home-hero">
        <div className="levitate-home-hero__backdrop" aria-hidden="true">
          {shouldRenderHeroVideo ? (
            <video autoPlay muted loop playsInline preload="metadata">
              <source src="/assets/levitate-home-hero.mp4" type="video/mp4" />
            </video>
          ) : null}
        </div>
        <LevitateHeader activeLabel="Inicio" variant="pill" />

        <div className="levitate-home-hero__inner">
          <div className="levitate-home-hero__copy" data-levitate-reveal>
            <p className="levitate-home-eyebrow">Competencia Nacional de Danza</p>
            <h1>Competir se siente distinto.</h1>
            <div className="levitate-home-hero__actions">
              <a className="levitate-home-button levitate-home-button--dark" href="/sedes/estado-de-mexico">
                Ver próxima sede <ArrowRight aria-hidden="true" size={18} />
              </a>
              <a className="levitate-home-button levitate-home-button--light" href="/inscripciones">
                Inscribirme <ArrowRight aria-hidden="true" size={18} />
              </a>
            </div>
          </div>
        </div>

      </section>

      <section id="premios" className="levitate-home-stats" aria-label="Levitate en números" data-levitate-reveal>
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <article key={stat.label}>
              <Icon aria-hidden="true" size={32} />
              <div>
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </div>
            </article>
          );
        })}
      </section>

      <section id="categorías" className="levitate-home-standard">
        <div
          className="levitate-home-section-copy levitate-home-section-copy--wide levitate-home-section-copy--statement"
          data-levitate-reveal
        >
          <p className="levitate-home-eyebrow">¿Por qué Levitate?</p>
          <h2>
            Porque el talento merece un escenario a su altura.
            <span
              className="levitate-home-gradient-line"
              data-levitate-gradient-line
              data-text="Competir. Crecer. Elevarse."
            >
              Competir. Crecer. Elevarse.
            </span>
          </h2>
        </div>

        <div className="levitate-home-card-grid">
          {standardCards.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title} data-levitate-reveal>
                <Icon aria-hidden="true" size={36} strokeWidth={1.85} />
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section id="convocatorias" className="levitate-home-venues">
        <div className="levitate-home-section-copy levitate-home-section-copy--split" data-levitate-reveal>
          <p className="levitate-home-eyebrow">Próximas ediciones</p>
          <h2>Encuentra la sede perfecta para ti.</h2>
        </div>

        <div className="levitate-home-venue-grid">
          {venues.map((venue) => {
            const content = (
              <>
                <img src={venue.image} alt="" loading="lazy" />
                <div>
                  <h3>{venue.title}</h3>
                  {venue.city ? (
                    <p>
                      <MapPin aria-hidden="true" size={16} /> {venue.city}
                    </p>
                  ) : null}
                  {venue.date ? (
                    <p>
                      <CalendarDays aria-hidden="true" size={16} /> {venue.date}
                    </p>
                  ) : null}
                  {venue.href ? (
                    <span>
                      Ver convocatoria <ArrowRight aria-hidden="true" size={16} />
                    </span>
                  ) : (
                    <span>Próximamente</span>
                  )}
                </div>
              </>
            );

            return venue.href ? (
              <a className="levitate-home-venue-card" href={venue.href} key={venue.title} data-levitate-reveal>
                {content}
              </a>
            ) : (
              <article className="levitate-home-venue-card" key={venue.title} data-levitate-reveal>
                {content}
              </article>
            );
          })}
        </div>
      </section>

      <section className="levitate-home-sponsors" aria-label="Sponsors">
        <div className="levitate-home-sponsors__inner">
          <div className="levitate-home-sponsors__copy" data-levitate-reveal>
            <p className="levitate-home-eyebrow">Sponsors</p>
            <h2>Aliados que elevan la experiencia.</h2>
          </div>

          <div className="levitate-home-sponsor-grid" data-levitate-reveal>
            {sponsors.map((sponsor) => (
              <strong className={`levitate-home-sponsor-card ${sponsor.className}`} key={sponsor.name}>
                {sponsor.logo ? <img src={sponsor.logo} alt={sponsor.name} loading="lazy" /> : <span>{sponsor.name}</span>}
              </strong>
            ))}
          </div>
        </div>
      </section>

      <LevitateFooter />
    </main>
  );
}
