import {
  BarChart3,
  CheckCircle2,
  CircleHelp,
  CirclePlay,
  Lightbulb,
  Megaphone,
  Music2,
  Pencil,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Users,
  WandSparkles,
} from "lucide-react";
import { useState } from "react";
import { assets } from "../../data/homeContent";
import { LevitateFooter } from "../home/LevitateFooter";
import { LevitateHeader } from "../home/LevitateHeader";

const medalVideoUrl = "";

const medalRules = [
  {
    label: "Oro",
    description: "Del puntaje más alto hasta 5 puntos menos.",
    image: "/assets/medallero-oro.png",
    mediaKey: "medal.gold",
    alt: "Medalla de oro Levitate 2026.",
    tone: "gold",
  },
  {
    label: "Plata",
    description: "De 6 a 15 puntos por debajo del puntaje más alto.",
    image: "/assets/medallero-plata.png",
    mediaKey: "medal.silver",
    alt: "Medalla de plata Levitate 2026.",
    tone: "silver",
  },
  {
    label: "Bronce",
    description: "De 16 a 25 puntos por debajo del puntaje más alto.",
    image: "/assets/medallero-bronce.png",
    mediaKey: "medal.bronze",
    alt: "Medalla de bronce Levitate 2026.",
    tone: "bronze",
  },
  {
    label: "Participación",
    description: "26 puntos o más por debajo del puntaje más alto.",
    image: "/assets/medallero-participacion.png",
    mediaKey: "medal.participation",
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
    mediaKey: "premiation.medal-system.motion",
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
    mediaKey: "premiation.medal-system.aerial",
    imageAlt: "Participante de Aerial en telas durante una experiencia Levitate.",
    imageFirst: false,
  },
];

const recognitionShowcase = [
  {
    title: "Medallas",
    label: "Oro · Plata · Bronce · Participación",
    image: "/assets/medallero-oro.png",
    mediaKey: "premiation.recognition.medals",
    alt: "Medalla de oro del sistema de medallero Levitate.",
    copy: "Reconocimientos individuales diseñados para distinguir ranking, puntaje absoluto y participación dentro de cada sede.",
  },
  {
    title: "Trofeos",
    label: "Dúos · Tríos · Grupales",
    image: assets.venue,
    mediaKey: "premiation.recognition.trophies",
    alt: "Escenario Levitate preparado para entrega de trofeos.",
    copy: "Piezas de escenario para primeros lugares en formatos colectivos, acompañadas por medallas para sus integrantes.",
  },
  {
    title: "Premios especiales",
    label: "MVP · Vestuario · Música · Porra",
    image: assets.community,
    mediaKey: "premiation.recognition.special",
    alt: "Comunidad Levitate celebrando una experiencia de competencia.",
    copy: "Distinciones seleccionadas por el equipo técnico para reconocer presencia, creatividad, energía y propuesta artística.",
  },
];

const directRanking = [
  {
    place: "2do lugar",
    award: "Plata",
    image: assets.community,
    mediaKey: "premiation.direct.second",
    alt: "Participante recibiendo reconocimiento en escenario Levitate.",
    variant: "silver",
  },
  {
    place: "1er lugar",
    award: "Oro",
    image: assets.venue,
    mediaKey: "premiation.direct.first",
    alt: "Escenario Levitate durante una premiación.",
    variant: "gold",
    featured: true,
  },
  {
    place: "3er lugar",
    award: "Bronce",
    image: assets.workshops,
    mediaKey: "premiation.direct.third",
    alt: "Participantes durante una experiencia Levitate.",
    variant: "bronze",
  },
];

const specialAwards = [
  {
    id: "musica",
    icon: Music2,
    title: "Mejor música",
    summary:
      "Reconocimiento a la selección, edición e integración musical que fortalece la propuesta escénica.",
    image: assets.venue,
    mediaKey: "premiation.special.music",
    imageAlt: "Escenario Levitate con iluminación para una presentación de competencia.",
    criteria: [
      {
        icon: Music2,
        title: "Selección musical",
        copy: "Se reconocerá la elección de música que mejor fortalezca la propuesta artística, el concepto y la interpretación de la coreografía.",
        highlights: ["propuesta artística", "concepto", "interpretación"],
      },
      {
        icon: SlidersHorizontal,
        title: "Edición y estructura",
        copy: "Se valorará la calidad de la edición musical, la fluidez de las transiciones, la coherencia entre segmentos y el aprovechamiento de los cambios de ritmo, intensidad y dinámica.",
        highlights: ["edición musical", "transiciones", "cambios de ritmo", "intensidad y dinámica"],
      },
      {
        icon: Sparkles,
        title: "Originalidad y creatividad",
        copy: "Se considerará el uso creativo de mezclas, efectos, adaptaciones o combinaciones musicales que aporten identidad y valor a la presentación.",
        highlights: ["mezclas", "efectos", "adaptaciones", "identidad"],
      },
      {
        icon: Star,
        title: "Relación con la ejecución",
        copy: "La música deberá integrarse de manera efectiva con la coreografía, permitiendo que los movimientos, acentos y momentos clave se desarrollen en armonía con la composición musical.",
        highlights: ["movimientos", "acentos", "momentos clave", "armonía"],
      },
      {
        icon: WandSparkles,
        title: "Impacto escénico",
        copy: "Se evaluará la capacidad de la música para generar emoción, reforzar la narrativa y contribuir a una experiencia memorable para el público y los jueces.",
        highlights: ["emoción", "narrativa", "experiencia memorable"],
      },
    ],
    note: "Este reconocimiento premia exclusivamente la selección, edición e integración musical dentro de la propuesta escénica, independientemente de la calificación técnica obtenida en la competencia.",
  },
  {
    id: "coreografia",
    icon: Lightbulb,
    title: "Mejor coreografía",
    summary:
      "Reconocimiento a la calidad de la composición coreográfica y a la claridad de su propuesta artística.",
    image: assets.workshops,
    mediaKey: "premiation.special.choreography",
    imageAlt: "Participantes en una sesión de movimiento y preparación coreográfica.",
    criteria: [
      {
        icon: Lightbulb,
        title: "Creatividad y composición",
        copy: "Se evaluará la originalidad de la propuesta, la construcción de secuencias, el uso del espacio y la capacidad de desarrollar una idea clara y atractiva.",
        highlights: ["originalidad", "construcción de secuencias", "uso del espacio", "idea clara y atractiva"],
      },
      {
        icon: SlidersHorizontal,
        title: "Estructura coreográfica",
        copy: "La rutina deberá presentar una composición coherente, con un adecuado desarrollo, transiciones fluidas y una distribución equilibrada de los elementos técnicos y artísticos.",
        highlights: ["composición coherente", "desarrollo", "transiciones fluidas", "distribución equilibrada"],
      },
      {
        icon: Music2,
        title: "Relación con la música",
        copy: "Se valorará la sincronía entre la coreografía y la música, así como el aprovechamiento de acentos, cambios de ritmo y matices musicales.",
        highlights: ["sincronía", "acentos", "cambios de ritmo", "matices musicales"],
      },
      {
        icon: Star,
        title: "Impacto artístico",
        copy: "Se considerará la capacidad de la coreografía para transmitir emociones, contar una historia o comunicar un concepto de manera efectiva.",
        highlights: ["transmitir emociones", "contar una historia", "comunicar un concepto"],
      },
      {
        icon: Sparkles,
        title: "Innovación y propuesta escénica",
        copy: "Se reconocerán las coreografías que aporten elementos creativos, recursos originales y una identidad artística que las haga destacar dentro de la competencia.",
        highlights: ["elementos creativos", "recursos originales", "identidad artística"],
      },
    ],
    note: "Este reconocimiento premia la calidad de la composición coreográfica y su propuesta artística, independientemente del nivel técnico de ejecución o de la puntuación final obtenida en la competencia.",
  },
  {
    id: "vestuario",
    icon: WandSparkles,
    title: "Mejor vestuario",
    summary:
      "Se reconocerá el vestuario que complemente la propuesta escénica, refuerce el concepto de la coreografía y mantenga coherencia visual, funcionalidad y cuidado en su presentación.",
    image: assets.competition,
    mediaKey: "premiation.special.costume",
    imageAlt: "Participante en escenario Levitate durante una presentación.",
    criteria: [
      {
        icon: Star,
        title: "Relación con la propuesta artística",
        copy: "El vestuario deberá complementar y reforzar la temática, concepto o historia presentada en la coreografía.",
        highlights: ["complementar", "reforzar", "temática", "concepto o historia"],
      },
      {
        icon: Pencil,
        title: "Creatividad y diseño",
        copy: "Se valorará la originalidad, estética, combinación de elementos y el impacto visual generado en escena.",
        highlights: ["originalidad", "estética", "combinación de elementos", "impacto visual"],
      },
      {
        icon: Sparkles,
        title: "Presentación y cuidado",
        copy: "El vestuario deberá encontrarse limpio, en buen estado y con acabados que reflejen atención al detalle.",
        highlights: ["limpio", "buen estado", "atención al detalle"],
      },
      {
        icon: ShieldCheck,
        title: "Funcionalidad y seguridad",
        copy: "El vestuario no deberá representar riesgos para la ejecución técnica ni interferir con el desarrollo de la rutina.",
        highlights: ["riesgos", "ejecución técnica", "desarrollo de la rutina"],
      },
      {
        icon: Users,
        title: "Imagen integral",
        copy: "Se tomará en cuenta la armonía entre vestuario, peinado, maquillaje y accesorios como parte de la propuesta escénica completa.",
        highlights: ["armonía", "vestuario", "peinado", "maquillaje y accesorios"],
      },
    ],
    note: "ESTE RECONOCIMIENTO ES INDEPENDIENTE DE LA CALIFICACIÓN TÉCNICA Y ARTÍSTICA OBTENIDA EN LA COMPETENCIA.",
  },
  {
    id: "porra",
    icon: Megaphone,
    title: "Mejor porra",
    summary:
      "Reconocimiento a la energía, organización y actitud positiva de la porra durante toda la competencia.",
    image: assets.community,
    mediaKey: "premiation.special.cheer",
    imageAlt: "Comunidad Levitate celebrando durante una experiencia de competencia.",
    criteria: [
      {
        icon: Star,
        title: "Espíritu deportivo y valores",
        copy: "El premio reconocerá a la porra que demuestre entusiasmo, compañerismo, respeto, inclusión y apoyo positivo durante toda la competencia.",
        highlights: ["entusiasmo", "compañerismo", "respeto", "inclusión", "apoyo positivo"],
      },
      {
        icon: Users,
        title: "Animar es compartir",
        copy: "Una gran porra no solo alienta a su propia academia, sino que también reconoce, celebra y aplaude el esfuerzo de los demás participantes y escuelas, contribuyendo a un ambiente de unión y crecimiento para toda la comunidad.",
        highlights: ["reconoce", "celebra", "aplaude", "unión y crecimiento"],
      },
      {
        icon: Megaphone,
        title: "Uso responsable de accesorios sonoros",
        copy: "Las cornetas, matracas y otros elementos de animación podrán utilizarse únicamente durante el momento indicado por el conductor del evento para la dinámica de elección de la Mejor Porra.",
        highlights: ["cornetas", "matracas", "momento indicado", "Mejor Porra"],
      },
      {
        icon: ShieldCheck,
        title: "Respeto y sana convivencia",
        copy: "No se permitirán gritos ofensivos, burlas, abucheos, conductas antideportivas ni acciones que incomoden, distraigan o molesten a otros participantes, espectadores o academias.",
        highlights: ["gritos ofensivos", "burlas", "abucheos", "conductas antideportivas"],
      },
      {
        icon: CheckCircle2,
        title: "Seguridad ante todo",
        copy: "Queda estrictamente prohibido el uso de humo, máquinas de niebla, agua, espuma, confeti líquido, pirotecnia o cualquier otro elemento que pueda representar un riesgo para los asistentes, participantes, instalaciones o equipos del evento.",
        highlights: ["humo", "pirotecnia", "riesgo", "asistentes", "equipos del evento"],
      },
    ],
    note: "Se evaluará la energía, creatividad, organización y actitud positiva de la porra. Cualquier conducta o acción que vaya en contra de los valores de respeto, inclusión, seguridad y sana convivencia podrá ser motivo de descalificación para la obtención de este reconocimiento.",
  },
];

const mvpAwards = [
  {
    title: "MVP Motion",
    copy: "Para el puntaje más alto de la competencia de géneros de piso.",
    image: assets.workshops,
    mediaKey: "premiation.mvp.motion",
  },
  {
    title: "MVP Aerial",
    copy: "Para el puntaje más alto de la competencia de géneros aéreos.",
    image: assets.competition,
    mediaKey: "premiation.mvp.aerial",
  },
];

const considerations = [
  "Los resultados son finales y no hay apelaciones.",
  "Las premiaciones dependen del registro, inscripción, asistencia y participación.",
  "La devolución de hojas de jueceo está disponible al concluir la ceremonia de premiación.",
];

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderHighlightedCopy(copy: string, highlights: string[] = []) {
  if (!highlights.length) {
    return copy;
  }

  const sortedHighlights = [...highlights].sort((a, b) => b.length - a.length);
  const highlightedSet = new Set(sortedHighlights.map((highlight) => highlight.toLocaleLowerCase("es-MX")));
  const parts = copy.split(new RegExp(`(${sortedHighlights.map(escapeRegExp).join("|")})`, "gi"));

  return parts.map((part, index) =>
    highlightedSet.has(part.toLocaleLowerCase("es-MX")) ? (
      <mark className="premiation-special-keyword" key={`${part}-${index}`}>
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

export function PremiationPage() {
  const [activeSpecialAwardId, setActiveSpecialAwardId] = useState("vestuario");
  const activeSpecialAward = specialAwards.find((award) => award.id === activeSpecialAwardId) ?? specialAwards[0];

  return (
    <main className="premiation-page">
      <section className="premiation-hero">
        <LevitateHeader activeLabel="Convocatoria" useRootLinks />
        <video
          className="premiation-hero__video"
          data-levitate-media-key="premiation.hero"
          poster={assets.competition}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
        >
          <source
            src="/assets/visuals/workshops-experience-bg.mp4"
            data-levitate-media-key="premiation.hero.video"
            type="video/mp4"
          />
        </video>
        <img
          className="premiation-hero__fallback"
          src={assets.competition}
          data-levitate-media-key="premiation.hero"
          alt=""
          aria-hidden="true"
        />
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
                    <img src={rank.image} data-levitate-media-key={rank.mediaKey} alt={rank.alt} loading="lazy" />
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
                        <img
                          src={system.image}
                          data-levitate-media-key={system.mediaKey}
                          alt={system.imageAlt}
                          loading="lazy"
                        />
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
                        <img
                          src={system.image}
                          data-levitate-media-key={system.mediaKey}
                          alt={system.imageAlt}
                          loading="lazy"
                        />
                      </figure>
                    )}
                  </article>
                );
              })}
            </div>

            <article className="premiation-medal-rules" aria-label="Rangos del sistema de medallero">
              {medalRules.map((rule) => (
                <div className={`premiation-medal-rule is-${rule.tone}`} key={rule.label}>
                  <img src={rule.image} data-levitate-media-key={rule.mediaKey} alt={rule.alt} loading="lazy" />
                  <div>
                    <strong>{rule.label}</strong>
                    <p>{rule.description}</p>
                  </div>
                </div>
              ))}
            </article>

            <aside className="premiation-medal-help" id="video-medallero">
              <div>
                <span aria-hidden="true">
                  <CircleHelp size={26} strokeWidth={2.2} />
                </span>
                <div>
                  <p className="premiation-kicker">¿Tienes dudas?</p>
                  <h3>Video explicativo del medallero</h3>
                  <p>
                    Mira una guía rápida para entender cómo se asignan Oro, Plata, Bronce y Participación según el
                    puntaje de cada bloque.
                  </p>
                </div>
              </div>

              {medalVideoUrl ? (
                <a href={medalVideoUrl} rel="noreferrer" target="_blank">
                  <CirclePlay aria-hidden="true" size={22} strokeWidth={2.3} />
                  Ver video explicativo
                </a>
              ) : (
                <button disabled type="button">
                  <CirclePlay aria-hidden="true" size={22} strokeWidth={2.3} />
                  Video explicativo próximamente
                </button>
              )}
            </aside>
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
                    <img src={item.image} data-levitate-media-key={item.mediaKey} alt={item.alt} loading="lazy" />
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
        <section className="premiation-section premiation-section--light premiation-special" id="premios-especiales">
          <div className="premiation-section__body">
            <div className="premiation-special__heading">
              <div>
                <p className="premiation-kicker">Criterios de selección</p>
                <h2>
                  Premios especiales <strong>por bloque</strong>
                </h2>
              </div>
            </div>

            <div className="premiation-special-tabs" role="tablist" aria-label="Premios especiales por bloque">
              {specialAwards.map((award) => {
                const Icon = award.icon;
                const isActive = award.id === activeSpecialAward.id;

                return (
                  <button
                    aria-controls="premiation-special-panel"
                    aria-selected={isActive}
                    className={isActive ? "is-active" : undefined}
                    id={`premiation-special-tab-${award.id}`}
                    key={award.id}
                    onClick={() => setActiveSpecialAwardId(award.id)}
                    role="tab"
                    type="button"
                  >
                    <Icon aria-hidden="true" size={44} strokeWidth={1.8} />
                    <span>{award.title}</span>
                  </button>
                );
              })}
            </div>

            <article
              aria-labelledby={`premiation-special-tab-${activeSpecialAward.id}`}
              className="premiation-special-panel"
              id="premiation-special-panel"
              key={activeSpecialAward.id}
              role="tabpanel"
            >
              <figure className="premiation-special-panel__visual">
                <img
                  src={activeSpecialAward.image}
                  data-levitate-media-key={activeSpecialAward.mediaKey}
                  alt={activeSpecialAward.imageAlt}
                  loading="lazy"
                />
              </figure>

              <div className="premiation-special-panel__details">
                <div className="premiation-special-panel__summary">
                  <h3>{activeSpecialAward.title}</h3>
                  <p>{activeSpecialAward.summary}</p>
                </div>

                <div className="premiation-special-panel__criteria">
                  <p className="premiation-kicker">Criterios:</p>
                  <div className="premiation-special-panel__criteria-grid">
                    {activeSpecialAward.criteria.map((criterion) => {
                      const CriterionIcon = criterion.icon;

                      return (
                        <div className="premiation-special-criterion" key={criterion.title}>
                          <CriterionIcon aria-hidden="true" size={34} strokeWidth={1.7} />
                          <div>
                            <strong>{criterion.title}</strong>
                            <p>{renderHighlightedCopy(criterion.copy, criterion.highlights)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="premiation-special-panel__note">
                <CheckCircle2 aria-hidden="true" size={22} strokeWidth={2.2} />
                <p>{activeSpecialAward.note}</p>
              </div>
            </article>
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
                    <img src={award.image} data-levitate-media-key={award.mediaKey} alt="" aria-hidden="true" />
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
