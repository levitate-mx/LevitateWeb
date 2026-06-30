import {
  CheckCircle2,
  Info,
  Lightbulb,
  Megaphone,
  Music2,
  Pencil,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trophy,
  Users,
  WandSparkles,
} from "lucide-react";
import { useState } from "react";
import { assets } from "../../data/homeContent";
import { LevitateFooter } from "../home/LevitateFooter";
import { LevitateHeader } from "../home/LevitateHeader";

const medalRules = [
  {
    label: "Oro",
    description: "181 - 210 puntos",
    image: "/assets/medallero-oro.png",
    alt: "Medalla de oro Levitate 2026.",
    tone: "gold",
  },
  {
    label: "Plata",
    description: "161 - 180 puntos",
    image: "/assets/medallero-plata.png",
    alt: "Medalla de plata Levitate 2026.",
    tone: "silver",
  },
  {
    label: "Bronce",
    description: "141 - 160 puntos",
    image: "/assets/medallero-bronce.png",
    alt: "Medalla de bronce Levitate 2026.",
    tone: "bronze",
  },
  {
    label: "Participación",
    description: "Menor a 141 puntos",
    image: "/assets/medallero-participacion.png",
    alt: "Medalla de participación Levitate 2026.",
    tone: "pink",
  },
];

const recognitionShowcase = [
  {
    title: "Medallas",
    label: "Oro · Plata · Bronce · Participación",
    image: "/assets/medallero-oro.png",
    alt: "Medalla de oro del medallero por puntaje Levitate.",
    copy: "Reconocimientos individuales que distinguen el puntaje obtenido, independientemente del ranking por bloque.",
  },
  {
    title: "Trofeos",
    label: "Dúos · Tríos · Grupales",
    image: "/assets/premiation-recognition-trophies.png",
    alt: "Escenario Levitate preparado para entrega de trofeos.",
    copy: "Piezas de escenario para lugares competitivos en formatos colectivos, acompañadas por medallas para sus integrantes.",
  },
  {
    title: "Premios especiales",
    label: "MVP · Vestuario · Música · Porra",
    image: "/assets/premiation-recognition-special.jpg",
    alt: "Comunidad Levitate celebrando una experiencia de competencia.",
    copy: "Distinciones seleccionadas por el equipo técnico para reconocer presencia, creatividad, energía y propuesta artística.",
  },
];

const directRanking = [
  {
    place: "1er lugar",
    image: "/assets/ranking-oro.png",
    alt: "Equipo Levitate celebrando primer lugar en escenario.",
    variant: "gold",
    mediaType: "image",
    featured: true,
  },
  {
    place: "2do lugar",
    image: "/assets/ranking-plata.png",
    alt: "Equipo Levitate con medallas de plata en escenario.",
    variant: "silver",
    mediaType: "image",
  },
  {
    place: "3er lugar",
    image: "/assets/ranking-bronce.jpg",
    alt: "Equipo Levitate con medalla de bronce en escenario.",
    variant: "bronze",
    mediaType: "image",
  },
];

const specialAwards = [
  {
    id: "musica",
    icon: Music2,
    title: "Mejor música",
    summary:
      "Reconocimiento a la selección, edición e integración musical que fortalece la propuesta escénica.",
    image: "/assets/premio-especial-musica.png",
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
    image: "/assets/premio-especial-coreografia.png",
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
    image: "/assets/premio-especial-vestuario.png",
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
    image: "/assets/premio-especial-porra.png",
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
  },
  {
    title: "MVP Aerial",
    copy: "Para el puntaje más alto de la competencia de géneros aéreos.",
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
  const [isHeroVideoReady, setIsHeroVideoReady] = useState(false);
  const activeSpecialAward = specialAwards.find((award) => award.id === activeSpecialAwardId) ?? specialAwards[0];

  return (
    <main className="premiation-page">
      <section className={`premiation-hero${isHeroVideoReady ? "" : " is-video-loading"}`}>
        <LevitateHeader activeLabel="Convocatoria" useRootLinks />
        <div className="levitate-video-fallback" aria-hidden="true" />
        <video
          className="premiation-hero__video"
          poster={assets.competition}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
          onCanPlay={() => setIsHeroVideoReady(true)}
          onLoadedData={() => setIsHeroVideoReady(true)}
        >
          <source src="/assets/visuals/workshops-experience-bg.mp4" type="video/mp4" />
        </video>
        <div className="premiation-hero__shade" aria-hidden="true" />
        <div className="premiation-hero__content">
          <h1>Premiación</h1>
          <strong>El vuelo también se reconoce.</strong>
          <p>
            En Levitate MX reconocemos el talento, la dedicación y el crecimiento artístico en cada paso que das.
          </p>
          <p>
            Todas las participaciones reciben medalla según su puntaje obtenido y, cuando existe competencia directa,
            también se otorga ranking por bloque.
          </p>
        </div>
      </section>

      <div className="premiation-awards-flow">
        <section className="premiation-section premiation-section--light premiation-system">
          <div className="premiation-section__body">
            <div className="premiation-system__header">
              <h2>
                <span>Sistema de </span>
                <strong>premiación</strong>
              </h2>
              <p>
                Todas las participaciones se rigen bajo un <strong>medallero por puntaje</strong> y, si existe
                competencia directa, también se otorgan lugares por ranking dentro de tu bloque.
              </p>
            </div>

            <div className="premiation-system__layout">
              <article className="premiation-score-panel">
                <div className="premiation-system__title-row">
                  <span>1</span>
                  <h3>
                    Medallero por <strong>puntaje</strong>
                  </h3>
                </div>
                <p>Todas las participaciones reciben una medalla según su puntaje obtenido.</p>

                <div className="premiation-score-list">
                  {medalRules.map((rule) => (
                    <div className={`premiation-score-row is-${rule.tone}`} key={rule.label}>
                      <img src={rule.image} alt={rule.alt} loading="lazy" />
                      <div>
                        <strong>{rule.label}</strong>
                        <p>{rule.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article className="premiation-ranking-panel">
                <div className="premiation-system__title-row">
                  <span>2</span>
                  <h3>
                    <strong>Ranking</strong> por bloque de competencia
                  </h3>
                </div>
                <p>
                  Cuando dos o más participantes comparten la misma división, género, nivel y categoría, compiten entre
                  sí por un lugar en el ranking de su bloque.
                </p>

                <div className="premiation-ranking-box" aria-label="Ranking por bloque de competencia">
                  <div className="premiation-ranking-grid">
                    {directRanking.map((rank) => (
                      <article className={`premiation-ranking-item is-${rank.variant}`} key={rank.place}>
                        <figure>
                          {rank.mediaType === "video" ? (
                            <video src={rank.image} aria-label={rank.alt} autoPlay loop muted playsInline />
                          ) : (
                            <img src={rank.image} alt={rank.alt} loading="lazy" />
                          )}
                          <figcaption>
                            <strong>{rank.place}</strong>
                          </figcaption>
                        </figure>
                      </article>
                    ))}
                  </div>
                  <p className="premiation-ranking-note">
                    <Info aria-hidden="true" size={22} strokeWidth={2.2} />
                    <span>El sistema de medallero es independiente al ranking obtenido.</span>
                  </p>
                </div>

                <aside className="premiation-system-note">
                  <Trophy aria-hidden="true" size={48} strokeWidth={1.9} />
                  <div>
                    <strong>Importante</strong>
                    <p>
                      El medallero reconoce tu puntaje individual. El ranking reconoce tu posición frente a tus
                      competidores directos.
                    </p>
                    <p>Por eso puede haber un 1er lugar oro, plata, bronce o participación.</p>
                  </div>
                </aside>
              </article>
            </div>
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

            <div className="premiation-special-preload" aria-hidden="true">
              {specialAwards.map((award) => (
                <img alt="" key={award.id} src={award.image} loading="eager" />
              ))}
            </div>

            <article
              aria-labelledby={`premiation-special-tab-${activeSpecialAward.id}`}
              className="premiation-special-panel"
              id="premiation-special-panel"
              role="tabpanel"
            >
              <figure className="premiation-special-panel__visual">
                <img
                  src={activeSpecialAward.image}
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
