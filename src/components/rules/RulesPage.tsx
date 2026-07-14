import { ArrowRight, Clock3, FileText, RefreshCw, SlidersHorizontal, Target } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { assets } from "../../data/homeContent";
import { LevitateFooter } from "../home/LevitateFooter";
import { LevitateHeader } from "../home/LevitateHeader";

type RulesModality = "motion" | "aerial";

type RulesCta = {
  label: string;
  href: string;
};

type CriterionRuleCard = {
  kind: "criterion";
  number: string;
  title: string;
  image: string;
  text?: string;
  points?: string[];
};

type ImageRuleCard = {
  kind: "image";
  title: string;
  image: string;
  caption: string;
};

type RuleCard = CriterionRuleCard | ImageRuleCard;

type RulesTitle = {
  text: string;
  accent: string;
};

type RulesInfoCard = {
  icon: typeof FileText;
  title: string;
  text: string;
};

type RulesProcessCard = {
  icon: typeof FileText;
  number: string;
  title: string;
  text: string;
  cta?: RulesCta;
};

type RulesContent = {
  className: string;
  heroEyebrow: string;
  heroTitle: RulesTitle;
  heroIntro: string[];
  heroImage: string;
  carouselLabel: string;
  carouselRail: string;
  ruleCards: RuleCard[];
  explainerTitle: RulesTitle;
  explainerParagraphs: string[];
  explainerCta?: RulesCta;
  explainerCards: RulesInfoCard[];
  processTitle: RulesTitle;
  processIntro: string;
  processCards: RulesProcessCard[];
};

const motionRuleCards: RuleCard[] = [
  {
    kind: "criterion",
    number: "01",
    title: "Coreografía",
    image: assets.community,
    text: "Se evalúa composición, dominio del género, diseño coreográfico, técnica, originalidad y creatividad.",
  },
  {
    kind: "criterion",
    number: "02",
    title: "Ejecución",
    image: assets.competition,
    text: "Musicalidad, flexibilidad, fuerza, control corporal, limpieza, energía, floorwork y transiciones.",
  },
  {
    kind: "criterion",
    number: "03",
    title: "Performance",
    image: assets.hero,
    text: "Interpretación, musicalización, maquillaje, vestuario, manejo de props, accesorios y presencia escénica.",
  },
];

const aerialRuleCards: RuleCard[] = [
  {
    kind: "criterion",
    number: "01",
    title: "Técnica",
    image: assets.communityAquaSilks,
    points: ["Dominio y equilibrio", "Complejidad de secuencias", "Manejo de fuerza", "Flexibilidad"],
  },
  {
    kind: "image",
    title: "Línea aérea",
    image: assets.communityLyraSmoke,
    caption: "Control, altura y presencia",
  },
  {
    kind: "criterion",
    number: "02",
    title: "Ejecución",
    image: assets.communityBlueSilks,
    points: [
      "Trabajo de piso, destreza y fluidez",
      "Presentación y alineación corporal",
      "Transiciones limpias y orgánicas",
      "Movimientos sincronizados y musicalidad",
    ],
  },
  {
    kind: "image",
    title: "Escena",
    image: assets.communityRedHoop,
    caption: "Impacto visual y performance",
  },
  {
    kind: "criterion",
    number: "03",
    title: "Performance",
    image: assets.communityAerial,
    points: [
      "Interpretación y musicalización",
      "Impacto visual: maquillaje y vestuario",
      "Uso y manejo de accesorios y props",
      "Obligatorios",
    ],
  },
];

const genreEvaluationCards: RulesInfoCard[] = [
  {
    icon: FileText,
    title: "Hojas por género",
    text: "Cada género Motion cuenta con criterios específicos para evaluar su técnica, estructura y propuesta.",
  },
  {
    icon: Target,
    title: "Evaluación rigurosa",
    text: "El sistema permite analizar cada presentación con mayor precisión según las exigencias del género.",
  },
  {
    icon: SlidersHorizontal,
    title: "Criterios adaptables",
    text: "La hoja de jueceo se moldea a los distintos estilos, composiciones y lenguajes de baile.",
  },
];

const judgingProcessCards: RulesProcessCard[] = [
  {
    icon: Clock3,
    number: "01",
    title: "Evaluación en tiempo real",
    text: "Los jueces califican cada rutina en vivo, registrando observaciones y puntajes durante la presentación.",
  },
  {
    icon: RefreshCw,
    number: "02",
    title: "Reasignación de género",
    text: "Si el jurado determina que una coreografía corresponde claramente a otro género y fue inscrita en una división equivocada, podrá reasignarla. Será evaluada con la hoja correcta y competirá por el premio de ese género.",
  },
  {
    icon: FileText,
    number: "03",
    title: "Retroalimentación y transparencia",
    text: "Las hojas de jueceo se entregarán a participantes o responsables de academia a través del portal. Funcionan como retroalimentación y aseguran transparencia sobre los puntajes obtenidos.",
  },
];

const aerialLevelCards: RulesInfoCard[] = [
  {
    icon: FileText,
    title: "Telas, aro y open aéreos",
    text: "Los géneros aéreos se dividen por niveles, y a cada nivel le corresponden obligatorios específicos.",
  },
  {
    icon: Target,
    title: "Baby y Legacy",
    text: "No habrá división por niveles y no cuentan con obligatorios.",
  },
  {
    icon: SlidersHorizontal,
    title: "Petite a Senior",
    text: "Nudo se divide en cuatro niveles: Principiante, Intermedio, Avanzado y Elite.",
  },
];

const aerialJudgingProcessCards: RulesProcessCard[] = [
  {
    icon: Clock3,
    number: "01",
    title: "Tiempo real",
    text: "Los jueces califican cada rutina en vivo, registrando observaciones y puntajes durante la presentación.",
  },
  {
    icon: RefreshCw,
    number: "02",
    title: "Reasignación de nivel",
    text: "Si un participante está inscrito en un nivel que no le corresponde, el panel jurado podrá reclasificarlo al nivel adecuado y premiarlo dentro de su nuevo nivel asignado.",
    cta: { label: "Ver reglamento", href: "/#reglamento-aerial" },
  },
  {
    icon: FileText,
    number: "03",
    title: "Retroalimentación",
    text: "Las hojas de jueceo se entregan como una herramienta de retroalimentación para seguir creciendo y dar transparencia a los puntajes obtenidos.",
  },
];

const rulesContent: Record<RulesModality, RulesContent> = {
  motion: {
    className: "rules-page--motion",
    heroEyebrow: "Evaluaciones",
    heroTitle: { text: "Cómo se evalúa tu", accent: "presentación" },
    heroIntro: [
      "En Levitate, cada presentación es evaluada por jueces especializados bajo un sistema justo, transparente y estandarizado.",
      "Conoce los criterios de evaluación.",
    ],
    heroImage: assets.competition,
    carouselLabel: "Pilares de evaluación Motion",
    carouselRail: "Desliza",
    ruleCards: motionRuleCards,
    explainerTitle: { text: "Cada género tiene su propia forma de ser", accent: "evaluado." },
    explainerParagraphs: [
      "En Levitate, cada género Motion cuenta con su propia hoja de jueceo, diseñada para evaluar con mayor rigor, claridad y precisión las características específicas de cada disciplina.",
      "Este sistema permite que la evaluación se moldee a los diferentes estilos, composiciones, lenguajes técnicos y formas de expresión dentro de los géneros de baile, reconociendo que no todos se construyen ni se interpretan de la misma manera.",
      "Así, cada presentación es evaluada bajo criterios adecuados a su género, manteniendo un proceso justo, especializado y coherente con la propuesta artística de cada participante.",
    ],
    explainerCards: genreEvaluationCards,
    processTitle: { text: "Sistema de", accent: "jueceo" },
    processIntro:
      "Nuestro sistema de evaluación está diseñado para ser justo, preciso y transparente, asegurando que cada presentación sea valorada de manera adecuada y profesional.",
    processCards: judgingProcessCards,
  },
  aerial: {
    className: "rules-page--aerial",
    heroEyebrow: "Modalidad",
    heroTitle: { text: "Levitate", accent: "Aerial" },
    heroIntro: [
      "Evaluación clara para telas, aro, trapecio y propuestas open.",
      "Técnica, ejecución y performance se leen de acuerdo con aparato, división y nivel.",
    ],
    heroImage: assets.communityAerial,
    carouselLabel: "Criterios de evaluación",
    carouselRail: "Aerial",
    ruleCards: aerialRuleCards,
    explainerTitle: { text: "Niveles y", accent: "obligatorios" },
    explainerParagraphs: [
      "Los géneros aéreos se dividen por niveles, y a cada nivel le corresponden obligatorios específicos para ordenar la evaluación con mayor claridad.",
      "En Baby y Legacy no habrá división por niveles ni obligatorios. De Petite a Senior, Nudo se clasifica en Principiante, Intermedio, Avanzado y Elite.",
    ],
    explainerCta: { label: "Conocer obligatorios", href: "#niveles-aerial" },
    explainerCards: aerialLevelCards,
    processTitle: { text: "Sistema de", accent: "jueceo" },
    processIntro:
      "El jueceo Aerial se realiza en tiempo real, contempla reclasificación de nivel cuando corresponde y entrega retroalimentación para transparentar la evaluación.",
    processCards: aerialJudgingProcessCards,
  },
};

const aerialImportanceStatements = [
  "Competir en tu género te hace más relevante y te ayuda a destacar.",
  "El panel de jurados evalúa tu coreo dentro de contextos adecuados a cada disciplina.",
];

const aerialCompetitionGenres = [
  {
    title: "Tela",
    text: "Combina fuerza, flexibilidad y fluidez en el aire a través de amarres, escaladas y caídas acrobáticas suspendidas en dos bandas de tela.",
  },
  {
    title: "Aro",
    text: "Explora la estética, el equilibrio y giros dinámicos sobre una estructura circular metálica, creando líneas corporales de gran impacto visual en suspensión.",
  },
  {
    title: "Trapecio",
    text: "Fusiona fuerza y control técnico sobre una barra suspendida por dos cuerdas, ideal para transiciones fluidas, figuras estáticas y balanceos acrobáticos.",
  },
  {
    title: "Open",
    text: "Para propuestas en aparatos alternativos, no mencionados anteriormente, y fusiones circenses creativas que desafían la gravedad fuera de los formatos tradicionales.",
  },
];

type RulesPageProps = {
  modality?: RulesModality;
};

function RulesTitleText({ title }: { title: RulesTitle }) {
  return (
    <>
      <span className="rules-title__line">{title.text} </span>
      <span className="rules-title__accent">{title.accent}</span>
    </>
  );
}

export function RulesPage({ modality = "motion" }: RulesPageProps) {
  const content = rulesContent[modality];
  const ruleCards = content.ruleCards;
  const explainerCta = content.explainerCta;
  const homeIdentityClass = modality === "aerial" ? " levitate-home-redesign" : "";
  const showHeroEyebrow = modality !== "aerial";
  const showHeroIntro = modality !== "aerial" && content.heroIntro.length > 0;
  const pinRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const goToCard = useCallback((index: number) => {
    const nextIndex = Math.min(Math.max(index, 0), ruleCards.length - 1);
    const pin = pinRef.current;

    if (pin) {
      const pinStart = window.scrollY + pin.getBoundingClientRect().top;
      const scrollRange = Math.max(0, pin.offsetHeight - window.innerHeight);
      const nextTop = pinStart + scrollRange * (nextIndex / Math.max(1, ruleCards.length - 1));
      window.scrollTo({ top: nextTop, behavior: "smooth" });
    }

    setActiveIndex(nextIndex);
  }, []);

  useEffect(() => {
    let frame = 0;

    const updateTrackFromPageScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const pin = pinRef.current;
        const track = trackRef.current;
        if (!pin || !track) return;

        const scrollRange = Math.max(1, pin.offsetHeight - window.innerHeight);
        const progress = Math.min(Math.max((window.scrollY - pin.offsetTop) / scrollRange, 0), 1);
        const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
        track.scrollLeft = progress * maxScroll;
        setActiveIndex(Math.round(progress * (ruleCards.length - 1)));
      });
    };

    updateTrackFromPageScroll();
    window.addEventListener("scroll", updateTrackFromPageScroll, { passive: true });
    window.addEventListener("resize", updateTrackFromPageScroll);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", updateTrackFromPageScroll);
      window.removeEventListener("resize", updateTrackFromPageScroll);
    };
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    let frame = 0;

    const updateActiveIndex = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const maxScroll = Math.max(1, track.scrollWidth - track.clientWidth);
        const nextIndex = Math.round((track.scrollLeft / maxScroll) * (ruleCards.length - 1));
        setActiveIndex(Math.min(Math.max(nextIndex, 0), ruleCards.length - 1));
      });
    };

    track.addEventListener("scroll", updateActiveIndex, { passive: true });

    return () => {
      cancelAnimationFrame(frame);
      track.removeEventListener("scroll", updateActiveIndex);
    };
  }, []);

  return (
    <main className={`rules-page ${content.className}${homeIdentityClass}`}>
      <LevitateHeader activeLabel="Modalidades" useRootLinks variant={modality === "aerial" ? "pill" : "classic"} />

      <section className="rules-hero">
        <div className="rules-hero__copy">
          {showHeroEyebrow ? <p className="rules-eyebrow">{content.heroEyebrow}</p> : null}
          <h1>
            <RulesTitleText title={content.heroTitle} />
          </h1>
        </div>

        {showHeroIntro ? (
          <div className="rules-hero__intro">
            {content.heroIntro.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        ) : null}

        <div className="rules-hero__mark" aria-hidden="true">
          <img src={content.heroImage} alt="" />
          <div>
            <span>Levitate MX</span>
            <strong>L</strong>
          </div>
        </div>
      </section>

      {modality === "aerial" ? (
        <>
          <section className="rules-aerial-importance" aria-labelledby="rules-aerial-importance-title">
            <div className="rules-aerial-importance__inner">
              <h2 id="rules-aerial-importance-title">El género importa.</h2>
              <div className="rules-aerial-importance__statements">
                {aerialImportanceStatements.map((statement) => (
                  <p key={statement}>
                    <strong>{statement}</strong>
                  </p>
                ))}
              </div>
            </div>
          </section>

          <section className="rules-aerial-genres" aria-labelledby="rules-aerial-genres-title">
            <div className="rules-aerial-genres__inner">
              <div className="rules-aerial-genres__head">
                <h2 id="rules-aerial-genres-title">Géneros disponibles</h2>
                <p>La competencia se organiza por aparato para que cada propuesta sea leída desde su propio lenguaje técnico y escénico.</p>
              </div>

              <div className="rules-aerial-genres__grid">
                {aerialCompetitionGenres.map((genre, index) => (
                  <article className="rules-aerial-genre" key={genre.title}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <h3>{genre.title}</h3>
                    <p>{genre.text}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </>
      ) : (
        <section className="rules-carousel-pin" aria-label={content.carouselLabel} ref={pinRef}>
          <div className="rules-carousel">
            <aside className="rules-carousel__rail" aria-hidden="true">
              <span>{content.carouselRail}</span>
            </aside>

            <div className="rules-track-window">
              <div className="rules-track" ref={trackRef}>
                {ruleCards.map((card, index) => (
                  <article
                    className={`rules-card${activeIndex === index ? " is-active" : ""}${
                      card.kind === "image" ? " rules-card--image" : ""
                    }`}
                    key={card.title}
                    style={{ "--card-index": index } as CSSProperties}
                  >
                    <img src={card.image} alt="" aria-hidden="true" />
                    <div className="rules-card__shade" aria-hidden="true" />
                    {card.kind === "image" ? (
                      <div className="rules-card__image-caption">
                        <span>Levitate Aerial</span>
                        <strong>{card.caption}</strong>
                      </div>
                    ) : (
                      <div className="rules-card__content">
                        <div className="rules-card__topline">
                          <strong>{card.number}</strong>
                        </div>
                        <h2>{card.title}</h2>
                        {card.points ? (
                          <ul className="rules-card__points">
                            {card.points.map((point) => (
                              <li key={point}>{point}</li>
                            ))}
                          </ul>
                        ) : (
                          <p>{card.text}</p>
                        )}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </div>

            <div className="rules-progress" aria-label="Pilares disponibles">
              {ruleCards.map((card, index) => (
                <button
                  aria-label={`Ver ${card.title}`}
                  className={activeIndex === index ? "is-active" : ""}
                  key={card.title}
                  onClick={() => goToCard(index)}
                  type="button"
                />
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="rules-motion-explainer" aria-labelledby="rules-motion-genre-title">
        <div className="rules-motion-explainer__copy">
          <h2 id="rules-motion-genre-title">
            <RulesTitleText title={content.explainerTitle} />
          </h2>
          {content.explainerParagraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          {explainerCta ? (
            <a className="rules-motion-cta" href={explainerCta.href}>
              {explainerCta.label} <ArrowRight aria-hidden="true" size={18} />
            </a>
          ) : null}
        </div>

        <div
          className="rules-motion-explainer__cards"
          id={modality === "aerial" ? "niveles-aerial" : undefined}
          aria-label={modality === "aerial" ? "Niveles aéreos" : "Ventajas de la evaluación por género"}
        >
          {content.explainerCards.map(({ icon: Icon, text, title }) => (
            <article className="rules-motion-info-card" key={title}>
              <Icon aria-hidden="true" size={42} strokeWidth={1.8} />
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rules-motion-process" aria-labelledby="rules-motion-process-title">
        <div className="rules-motion-process__intro">
          <h2 id="rules-motion-process-title">
            <RulesTitleText title={content.processTitle} />
          </h2>
          <p>{content.processIntro}</p>
        </div>

        <div className="rules-motion-process__cards">
          {content.processCards.map(({ cta, icon: Icon, number, text, title }) => (
            <article className="rules-motion-step-card" key={title}>
              <Icon aria-hidden="true" size={34} strokeWidth={1.8} />
              <strong>{number}</strong>
              <h3>{title}</h3>
              <p>{text}</p>
              {cta ? (
                <a className="rules-motion-step-card__link" href={cta.href}>
                  {cta.label} <ArrowRight aria-hidden="true" size={16} />
                </a>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <LevitateFooter useRootLinks />
    </main>
  );
}
