import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  CircleUserRound,
  Clock3,
  Droplets,
  MapPin,
  Shirt,
  Sparkles,
  Ticket,
  Users,
} from "lucide-react";
import { assets } from "../../data/homeContent";
import { LevitateFooter } from "../home/LevitateFooter";
import { LevitateHeader } from "../home/LevitateHeader";

const workshopIconBase = "/assets/icons/workshops";

const disciplines = [
  { label: "Telas", icon: `${workshopIconBase}/telas.png` },
  { label: "Aro", icon: `${workshopIconBase}/aro.png` },
  { label: "Trapecio", icon: `${workshopIconBase}/trapecio.png` },
  { label: "Cintas", icon: `${workshopIconBase}/cintas.png` },
  { label: "Flex", icon: `${workshopIconBase}/flex.png` },
  { label: "Expresión corporal", icon: `${workshopIconBase}/expresion-corporal.png` },
];

const includedCards = [
  {
    icon: Users,
    title: "Participantes inscritos",
    copy: "Si estás inscrito en la competencia, accedes sin costo a 3 de los workshops incluidos en tu experiencia Levitate.",
  },
  {
    icon: Ticket,
    title: "Público externo",
    copy: (
      <>
        <strong>¿No estás inscrito en la competencia?</strong> También puedes ser parte con el acceso para el público en
        los workshops de algunas sedes.
      </>
    ),
  },
  {
    icon: Sparkles,
    title: "Grupos y disciplinas",
    copy: "Los grupos de aprendizaje se organizan según nivel, edades y disciplinas disponibles en cada sede.",
  },
  {
    icon: Clock3,
    title: "Cupo sujeto a disponibilidad",
    copy: "Los talleres y grupos tienen cupo limitado. Asegura tu lugar o sé parte de cada sede.",
  },
];

const confirmedWorkshops = [
  { discipline: "Telas", coach: "Alex Nájera" },
  { discipline: "Aro / Trapecio", coach: "Vladimir Garza" },
  { discipline: "Cintas", coach: "Luis Raio" },
  { discipline: "Flex", coach: "Yoli Campos" },
];

const basics = [
  {
    title: "Agua",
    copy: "Para mantenerte hidratado durante la práctica.",
    icon: Droplets,
  },
  {
    title: "Ropa cómoda",
    copy: "Que te permita moverte con libertad y seguridad en el aula.",
    icon: Shirt,
  },
  {
    title: "Cabello recogido",
    copy: "Por tu seguridad y la de quienes entrenan a tu lado.",
    icon: CircleUserRound,
  },
];

export function WorkshopsPage() {
  const [isExperienceOverlayVisible, setIsExperienceOverlayVisible] = useState(true);
  const [isExperienceVideoReady, setIsExperienceVideoReady] = useState(false);
  const experienceOverlayTimer = useRef<number | null>(null);

  const scheduleExperienceOverlayHide = useCallback(() => {
    if (experienceOverlayTimer.current !== null) {
      window.clearTimeout(experienceOverlayTimer.current);
    }

    experienceOverlayTimer.current = window.setTimeout(() => {
      setIsExperienceOverlayVisible(false);
    }, 4200);
  }, []);

  const revealExperienceOverlay = useCallback(() => {
    setIsExperienceOverlayVisible(true);
    scheduleExperienceOverlayHide();
  }, [scheduleExperienceOverlayHide]);

  useEffect(() => {
    revealExperienceOverlay();
    window.addEventListener("scroll", revealExperienceOverlay, { passive: true });
    window.addEventListener("pointermove", revealExperienceOverlay, { passive: true });

    return () => {
      window.removeEventListener("scroll", revealExperienceOverlay);
      window.removeEventListener("pointermove", revealExperienceOverlay);

      if (experienceOverlayTimer.current !== null) {
        window.clearTimeout(experienceOverlayTimer.current);
      }
    };
  }, [revealExperienceOverlay]);

  return (
    <main className="workshops-page levitate-home-redesign">
      <section className="workshops-hero" id="workshops">
        <LevitateHeader activeLabel="Convocatoria" useRootLinks variant="pill" />
        <div className="workshops-hero__content">
          <p className="workshops-kicker">Workshops Levitate</p>
          <h1>Entrena con intención.</h1>
        </div>
      </section>

      <section className="workshops-light-section workshops-intro">
        <div className="workshops-intro__layout">
          <article className="workshops-intro__copy">
            <h2>
              Más que una clase, una <span>experiencia formativa</span>.
            </h2>
            <p>
              Cada workshop está diseñado para entrenar, inspirar y potenciar tu arte. Vivirás una experiencia única con
              docentes invitados de alto nivel.
            </p>
          </article>

          <figure className="workshops-intro__media">
            <img
              src="/assets/workshops-experiencia-formativa.jpg"
              alt="Participantes entrenando en una experiencia formativa Levitate."
              loading="lazy"
            />
          </figure>

          <article className="workshops-intro__audience">
            <p className="workshops-light-kicker">¿Quién puede tomarlos?</p>
            <h2>Para quienes empiezan, entrenan y quieren seguir creciendo.</h2>
            <p>
              Los workshops son para toda la comunidad apasionada por el vuelo en sus múltiples disciplinas. Encuentra
              opciones para cada nivel, objetivo y momento de tu camino artístico.
            </p>
          </article>

          <div className="workshops-intro__disciplines">
            <h3>DISCIPLINAS</h3>
            <div className="workshops-disciplines" aria-label="Disciplinas de workshops">
              {disciplines.map((discipline) => (
                <span key={discipline.label}>
                  <span
                    aria-hidden="true"
                    className="workshops-discipline-icon"
                    style={{ "--workshops-discipline-icon": `url(${discipline.icon})` } as CSSProperties}
                  />
                  {discipline.label}
                </span>
              ))}
            </div>
          </div>

          <div className="workshops-note workshops-note--wide">
            <img
              className="workshops-inline-icon"
              src={`${workshopIconBase}/info.png`}
              alt=""
              aria-hidden="true"
              loading="lazy"
            />
            La disponibilidad de los talleres se comunica según la convocatoria de cada sede.
          </div>
        </div>
      </section>

      <section className="workshops-dark-band">
        <div className="workshops-section-head">
          <p className="workshops-kicker">¿Cómo funcionan?</p>
          <h2>Incluidos en tu experiencia</h2>
        </div>
        <div className="workshops-rule-grid">
          {includedCards.map((card) => {
            const Icon = card.icon;
            return (
              <article key={card.title}>
                <Icon aria-hidden="true" size={34} />
                <h3>{card.title}</h3>
                <p>{card.copy}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="workshops-light-section workshops-venues" id="workshops-disponibles">
        <div className="workshops-section-head workshops-section-head--light">
          <p className="workshops-light-kicker">Próximos workshops por sede</p>
        </div>

        <div className="workshops-venue-grid">
          <article className="workshops-venue-card workshops-venue-card--confirmed">
            <img
              className="workshops-venue-card__image--cdmx"
              src="/assets/workshops-cdmx-parque-juana-asbaje.png"
              alt="Participantes del workshop de CDMX en Parque Juana de Asbaje."
              loading="lazy"
            />
            <div>
              <h2>CDMX</h2>
              <p>
                <CalendarDays aria-hidden="true" size={17} /> Viernes 29 de mayo
              </p>
              <p>
                <MapPin aria-hidden="true" size={17} /> Parque Juana de Asbaje, Tlalpan
              </p>
              <h3>Workshops confirmados</h3>
              <ul>
                {confirmedWorkshops.map((workshop) => (
                  <li key={workshop.discipline}>
                    <span aria-hidden="true" />
                    <strong>{workshop.discipline}</strong>
                    <small>{workshop.coach}</small>
                  </li>
                ))}
              </ul>
              <a href="/sedes/ciudad-de-mexico">
                Ver horarios <ArrowUpRight aria-hidden="true" size={17} />
              </a>
            </div>
          </article>

          <article className="workshops-venue-card workshops-venue-card--soon">
            <img
              className="workshops-venue-card__image--edomex"
              src="/assets/workshops-edomex-taller-1.jpg"
              alt=""
              aria-hidden="true"
              loading="lazy"
            />
            <div>
              <h2>EDO MEX</h2>
              <p>
                <CalendarDays aria-hidden="true" size={17} /> 13 de noviembre
              </p>
              <h3>Una nueva experiencia está por revelarse.</h3>
              <p>
                Los workshops para esta sede se están preparando. Muy pronto conocerás talleres, docentes y horarios que
                te esperan.
              </p>
              <a href="/sedes/estado-de-mexico">
                Próximamente <ArrowUpRight aria-hidden="true" size={17} />
              </a>
            </div>
          </article>
        </div>
      </section>

      <section
        className={[
          "workshops-experience",
          isExperienceOverlayVisible ? "" : "is-overlay-hidden",
          isExperienceVideoReady ? "" : "is-video-loading",
        ].filter(Boolean).join(" ")}
        onFocus={revealExperienceOverlay}
        onPointerMove={revealExperienceOverlay}
      >
        <div className="levitate-video-fallback" aria-hidden="true" />
        <video
          className="workshops-experience__background"
          aria-hidden="true"
          autoPlay
          loop
          muted
          playsInline
          poster={assets.community}
          preload="metadata"
          onCanPlay={() => setIsExperienceVideoReady(true)}
          onLoadedData={() => setIsExperienceVideoReady(true)}
        >
          <source src="/assets/videos/talleres-mix.mp4" type="video/mp4" />
        </video>
        <div className="workshops-experience__overlay">
          <div className="workshops-experience__copy">
            <p className="workshops-kicker">Lo que se vive en workshops</p>
            <h2>Aprender. Conectar. Inspirar.</h2>
          </div>
        </div>
      </section>

      <section className="workshops-light-section workshops-basics">
        <div className="workshops-section-head workshops-section-head--light">
          <p className="workshops-light-kicker">Antes de tomar tu workshop</p>
          <h2>Para vivir la mejor experiencia</h2>
        </div>
        <div className="workshops-basics__grid">
          {basics.map((basic) => {
            const Icon = basic.icon;
            return (
            <article key={basic.title}>
              <Icon aria-hidden="true" size={44} strokeWidth={2.15} />
              <div>
                <h3>{basic.title}</h3>
                <p>{basic.copy}</p>
              </div>
            </article>
            );
          })}
        </div>
      </section>

      <LevitateFooter useRootLinks />
    </main>
  );
}
