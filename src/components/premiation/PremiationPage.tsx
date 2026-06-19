import {
  BarChart3,
  CheckCircle2,
  Megaphone,
  Music2,
  SlidersHorizontal,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { assets } from "../../data/homeContent";
import { LevitateFooter } from "../home/LevitateFooter";
import { LevitateHeader } from "../home/LevitateHeader";

const medalRules = [
  {
    label: "Oro",
    description: "Del puntaje más alto hasta 5 puntos menos.",
    image: "/assets/medallero-oro.png",
    alt: "Medalla de oro Levitate 2026.",
    tone: "gold",
  },
  {
    label: "Plata",
    description: "De 6 a 15 puntos por debajo del puntaje más alto.",
    image: "/assets/medallero-plata.png",
    alt: "Medalla de plata Levitate 2026.",
    tone: "silver",
  },
  {
    label: "Bronce",
    description: "De 16 a 25 puntos por debajo del puntaje más alto.",
    image: "/assets/medallero-bronce.png",
    alt: "Medalla de bronce Levitate 2026.",
    tone: "bronze",
  },
  {
    label: "Participación",
    description: "26 puntos o más por debajo del puntaje más alto.",
    image: "/assets/medallero-participacion.png",
    alt: "Medalla de participación Levitate 2026.",
    tone: "pink",
  },
];

const medalSystems = [
  {
    icon: SlidersHorizontal,
    title: "Motion",
    adjustment: "Ajuste por división",
    options: ["Baby", "Petite", "Junior", "Teen", "Senior", "Legacy"],
    copy: "Se aplican rangos de medalla de acuerdo con el mayor puntaje obtenido en una misma división.",
    image: assets.competition,
    imageAlt: "Participante de Motion sobre escenario Levitate.",
    imageFirst: true,
  },
  {
    icon: BarChart3,
    title: "Aerial",
    adjustment: "Ajuste por nivel",
    options: ["Nudo", "Principiantes", "Intermedio", "Avanzado", "Elite"],
    copy: "Se aplican rangos de medalla de acuerdo con el mayor puntaje obtenido en un mismo nivel.",
    image: assets.hero,
    imageAlt: "Participante de Aerial en telas durante una experiencia Levitate.",
    imageFirst: false,
  },
];

const recognitionShowcase = [
  {
    title: "Medallas",
    label: "Oro · Plata · Bronce · Participación",
    image: "/assets/medallero-oro.png",
    alt: "Medalla de oro del sistema de medallero Levitate.",
    copy: "Reconocimientos individuales diseñados para distinguir ranking, puntaje absoluto y participación dentro de cada sede.",
  },
  {
    title: "Trofeos",
    label: "Dúos · Tríos · Grupales",
    image: assets.venue,
    alt: "Escenario Levitate preparado para entrega de trofeos.",
    copy: "Piezas de escenario para primeros lugares en formatos colectivos, acompañadas por medallas para sus integrantes.",
  },
  {
    title: "Premios especiales",
    label: "MVP · Vestuario · Música · Porra",
    image: assets.community,
    alt: "Comunidad Levitate celebrando una experiencia de competencia.",
    copy: "Distinciones seleccionadas por el equipo técnico para reconocer presencia, creatividad, energía y propuesta artística.",
  },
];

const directRanking = [
  {
    place: "2do lugar",
    award: "Plata",
    image: assets.community,
    alt: "Participante recibiendo reconocimiento en escenario Levitate.",
    variant: "silver",
  },
  {
    place: "1er lugar",
    award: "Oro",
    image: assets.venue,
    alt: "Escenario Levitate durante una premiación.",
    variant: "gold",
    featured: true,
  },
  {
    place: "3er lugar",
    award: "Bronce",
    image: assets.workshops,
    alt: "Participantes durante una experiencia Levitate.",
    variant: "bronze",
  },
];

const specialAwards = [
  {
    icon: Music2,
    title: "Mejor música",
    copy: "Se reconocerá la selección musical que mejor acompañe la interpretación y potencie la intención artística de la presentación.",
  },
  {
    icon: Sparkles,
    title: "Mejor idea coreográfica",
    copy: "Se premiará la originalidad de la propuesta y la creatividad en la composición coreográfica.",
  },
  {
    icon: WandSparkles,
    title: "Mejor vestuario",
    copy: "Se valorará la elección del vestuario de acuerdo al concepto, funcionalidad e impacto visual en el escenario.",
  },
  {
    icon: Megaphone,
    title: "Mejor porra",
    copy: "Se destacará la energía, apoyo y pasión del público que impulse a su equipo a través del aliento.",
  },
];

const mvpAwards = [
  {
    title: "MVP Motion",
    copy: "Para el puntaje más alto de la competencia de géneros de piso.",
    image: assets.workshops,
  },
  {
    title: "MVP Aerial",
    copy: "Para el puntaje más alto de la competencia de géneros aéreos.",
    image: assets.competition,
  },
];

const considerations = [
  "Los resultados son finales y no hay apelaciones.",
  "Las premiaciones dependen del registro, inscripción, asistencia y participación.",
  "La devolución de hojas de jueceo está disponible al concluir la ceremonia de premiación.",
];

export function PremiationPage() {
  return (
    <main className="premiation-page">
      <section className="premiation-hero">
        <LevitateHeader activeLabel="Convocatoria" useRootLinks />
        <img src={assets.competition} alt="" aria-hidden="true" />
        <div className="premiation-hero__shade" aria-hidden="true" />
        <div className="premiation-hero__content">
          <h1>Premiación</h1>
          <strong>El vuelo también se reconoce.</strong>
          <p>
            En Levitate MX reconocemos el talento, la dedicación y el crecimiento artístico en cada paso que das.
          </p>
          <p>
            Nuestro sistema de premiación está diseñado para reconocer el nivel real de cada participación, otorgando a
            los participantes el mérito a su trabajo, esfuerzo y ejecución.
          </p>
        </div>
      </section>

      <div className="premiation-awards-flow">
        <section className="premiation-section premiation-section--light premiation-direct">
          <div className="premiation-section__body">
            <div className="premiation-direct__header">
              <p className="premiation-kicker">Sistemas de premiación</p>
              <h2>
                Competencia <strong>directa</strong>
              </h2>
              <p>
                Cuando dos o más participaciones comparten la misma división, género, nivel y categoría, se comparan
                entre sí y el resultado se define por ranking.
              </p>
            </div>

            <div className="premiation-direct__stage" aria-label="Ranking de competencia directa">
              {directRanking.map((rank) => (
                <article
                  className={`premiation-rank-card premiation-rank-card--${rank.variant}${
                    rank.featured ? " is-featured" : ""
                  }`}
                  key={rank.place}
                >
                  <figure>
                    <img src={rank.image} alt={rank.alt} loading="lazy" />
                  </figure>
                  <div>
                    <strong>{rank.place}</strong>
                    <small>{rank.award}</small>
                  </div>
                </article>
              ))}
            </div>

            <div className="premiation-direct__note">
              <div>
                <strong>Ranking real por bloque.</strong>
                <p>
                  Si una categoría cuenta con más de tres participaciones, las coreografías restantes reciben medalla de
                  participación.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="premiation-section premiation-section--light premiation-medals">
          <div className="premiation-section__body">
            <div className="premiation-medals__intro">
              <i className="premiation-medals__rule" aria-hidden="true" />
              <h2>
                <span>Sistema de </span>
                <strong>Medallero</strong>
              </h2>
              <div className="premiation-medals__copy">
                <p>
                  Así se premian las participaciones <strong>sin competencia directa.</strong>
                </p>
              </div>
            </div>

            <div className="premiation-medal-systems">
              {medalSystems.map((system) => {
                const AdjustmentIcon = system.icon;

                return (
                  <article
                    className={`premiation-medal-system${system.imageFirst ? " premiation-medal-system--image-first" : ""}`}
                    key={system.title}
                  >
                    {system.imageFirst && (
                      <figure className="premiation-medal-system__visual">
                        <img src={system.image} alt={system.imageAlt} loading="lazy" />
                      </figure>
                    )}
                    <div className="premiation-medal-system__content">
                      <p className="premiation-medal-system__kicker">Sistema de medallero</p>
                      <h3>{system.title}</h3>
                      <p className="premiation-medal-system__adjustment">
                        <AdjustmentIcon aria-hidden="true" size={22} strokeWidth={2.6} />
                        {system.adjustment}
                      </p>
                      <div className="premiation-medal-system__chips" aria-label={system.adjustment}>
                        {system.options.map((option) => (
                          <span key={option}>{option}</span>
                        ))}
                      </div>
                      <i aria-hidden="true" />
                      <p className="premiation-medal-system__copy">{system.copy}</p>
                    </div>

                    {!system.imageFirst && (
                      <figure className="premiation-medal-system__visual">
                        <img src={system.image} alt={system.imageAlt} loading="lazy" />
                      </figure>
                    )}
                  </article>
                );
              })}
            </div>

            <article className="premiation-medal-rules" aria-label="Rangos del sistema de medallero">
              {medalRules.map((rule) => (
                <div className={`premiation-medal-rule is-${rule.tone}`} key={rule.label}>
                  <img src={rule.image} alt={rule.alt} loading="lazy" />
                  <div>
                    <strong>{rule.label}</strong>
                    <p>{rule.description}</p>
                  </div>
                </div>
              ))}
            </article>
          </div>
        </section>
      </div>

      <div className="premiation-dark-flow">
        <section className="premiation-section premiation-section--dark premiation-recognition">
          <div className="premiation-section__body">
            <div className="premiation-split-heading premiation-recognition__heading">
              <div>
                <p className="premiation-kicker">Reconocimientos Levitate</p>
                <h2>
                  Lo que se entrega <strong>en escena.</strong>
                </h2>
              </div>
            </div>

            <div className="premiation-recognition__grid">
              {recognitionShowcase.map((item) => (
                <article className="premiation-recognition__card" key={item.title}>
                  <figure className="premiation-recognition__visual">
                    <img src={item.image} alt={item.alt} loading="lazy" />
                  </figure>
                  <div>
                    <span className="premiation-recognition__label">{item.label}</span>
                    <h3>{item.title}</h3>
                    <p>{item.copy}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </div>

      <div className="premiation-light-flow">
        <section className="premiation-section premiation-section--light premiation-special">
          <div className="premiation-section__body">
            <div className="premiation-split-heading">
              <div>
                <p className="premiation-kicker">Premios especiales</p>
                <h2>
                  Premios especiales <strong>por bloque</strong>
                </h2>
              </div>
            </div>
            <div className="premiation-special-grid">
              {specialAwards.map((award) => {
                const Icon = award.icon;
                return (
                  <article key={award.title}>
                    <Icon size={34} />
                    <h3>{award.title}</h3>
                    <p>{award.copy}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="premiation-section premiation-section--light premiation-mvp">
          <div className="premiation-section__body">
            <p className="premiation-kicker">MVP Levitate</p>
            <div className="premiation-mvp__layout">
              <div>
                <h2>
                  El mejor puntaje <strong>del evento.</strong>
                </h2>
                <p>
                  El MVP de Levitate MX se concede a la rutina de toda la competencia que obtenga el puntaje más alto,
                  sin importar el nivel, división o categoría.
                </p>
              </div>
              <div className="premiation-mvp__cards">
                {mvpAwards.map((award) => (
                  <article key={award.title}>
                    <img src={award.image} alt="" aria-hidden="true" />
                    <h3>{award.title}</h3>
                    <p>{award.copy}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="premiation-dark-flow premiation-awards-end">
        <section className="premiation-bottom">
          <article className="premiation-bottom__headline">
            <p className="premiation-kicker">Entrega de premios</p>
            <h2>
              <span>Premiación</span>
              {" "}
              <strong>por bloque</strong>
            </h2>
            <i aria-hidden="true" />
          </article>
          <article className="premiation-bottom__details">
            <p className="premiation-kicker">Consideraciones importantes</p>
            <ul>
              {considerations.map((item) => (
                <li key={item}>
                  <CheckCircle2 size={22} /> <span>{item}</span>
                </li>
              ))}
            </ul>
            <a href="/evaluaciones">Consulta tus resultados</a>
          </article>
        </section>

      </div>

      <LevitateFooter useRootLinks />
    </main>
  );
}
