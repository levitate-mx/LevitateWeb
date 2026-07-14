import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  Clock3,
  Droplets,
  MapPin,
  ShieldCheck,
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
  { label: "Jazz", icon: `${workshopIconBase}/jazz.png` },
  { label: "Urban", icon: `${workshopIconBase}/urban.png` },
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

const edoMexConfirmedWorkshops = [
  { discipline: "Flex", coach: "Ana Karen Rojas" },
  { discipline: "Contemporary Jazz", coach: "Daniel Montalvo" },
  { discipline: "Urban", coach: "Pablo Emmanuel" },
  { discipline: "Comedia musical", coach: "Jorge Díaz" },
  { discipline: "Aro y trapecio", coach: "Vladimir Garza" },
  { discipline: "Tela y Cuna", coach: "Daniel Herrera" },
];

const basics = [
  {
    title: "Agua",
    copy: "Para mantenerte hidratado durante el entrenamiento.",
    icon: Droplets,
  },
  {
    title: "Ropa cómoda",
    copy: "Usa ropa que te permita moverte con libertad y seguridad. También está permitido acceder con el uniforme representativo de tu academia o escuela.",
    icon: Shirt,
  },
  {
    title: "Responsable mayor de edad",
    copy: "Las academias o escuelas que asistan a los workshops deberán contar con una persona responsable mayor de edad presente en todo momento.",
    icon: ShieldCheck,
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
        <img
          className="workshops-hero__image"
          src="/assets/workshops-hero-motion-4.jpg"
          alt="Grupo de bailarinas de Motion en el escenario de Levitate."
        />
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
              <span>Más que una clase,</span>
              <span>una experiencia</span>
              <span>formativa.</span>
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
          <p className="workshops-light-kicker">Workshops 2026</p>
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

          <article className="workshops-venue-card workshops-venue-card--confirmed workshops-venue-card--edomex">
            <img
              className="workshops-venue-card__image--edomex"
              src="/assets/workshops-edomex-taller-1.jpg"
              alt="Participantes en un workshop de Motion en Estado de México."
              loading="lazy"
            />
            <div>
              <h2>EDO MEX</h2>
              <p>
                <CalendarDays aria-hidden="true" size={17} /> Viernes 14 de noviembre
              </p>
              <p className="workshops-venue-card__location">
                <MapPin aria-hidden="true" size={17} />
                <span>
                  <strong>Aerial</strong>
                  <small>Por confirmar lugar</small>
                </span>
              </p>
              <p className="workshops-venue-card__location">
                <MapPin aria-hidden="true" size={17} />
                <span>
                  <strong>Motion</strong>
                  <small>City Express Plus by Marriott Mundo E</small>
                </span>
              </p>
              <h3>Workshops confirmados</h3>
              <ul>
                {edoMexConfirmedWorkshops.map((workshop) => (
                  <li key={workshop.discipline}>
                    <span aria-hidden="true" />
                    <strong>{workshop.discipline}</strong>
                    <small>{workshop.coach}</small>
                  </li>
                ))}
              </ul>
              <a href="/sedes/estado-de-mexico">
                Ver horarios <ArrowUpRight aria-hidden="true" size={17} />
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
