import { Clock3, FileText, RefreshCw, SlidersHorizontal, Target } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { assets } from "../../data/homeContent";
import { LevitateFooter } from "../home/LevitateFooter";
import { LevitateHeader } from "../home/LevitateHeader";

const ruleCards = [
  {
    number: "01",
    title: "Coreografía",
    image: assets.community,
    text: "Se evalúa composición, dominio del género, diseño coreográfico, técnica, originalidad y creatividad.",
  },
  {
    number: "02",
    title: "Ejecución",
    image: assets.competition,
    text: "Musicalidad, flexibilidad, fuerza, control corporal, limpieza, energía, floorwork y transiciones.",
  },
  {
    number: "03",
    title: "Performance",
    image: assets.hero,
    text: "Interpretación, musicalización, maquillaje, vestuario, manejo de props, accesorios y presencia escénica.",
  },
];

const genreEvaluationCards = [
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

const judgingProcessCards = [
  {
    icon: Clock3,
    number: "01",
    title: "Evaluación en tiempo real",
    text: "Los jueces califican las coreografías conforme se van presentando en el escenario, registrando sus observaciones y puntajes durante la ejecución de cada rutina.",
  },
  {
    icon: RefreshCw,
    number: "02",
    title: "Reasignación de género",
    text: "Si el panel jurado considera que una coreografía corresponde claramente a otro género específico y fue inscrita en una división equivocada, se podrá tomar la decisión de cambiarla de división. En ese caso, la coreografía será evaluada con la hoja de jueceo del género correcto y competirá para ser premiada dentro del género correspondiente.",
  },
  {
    icon: FileText,
    number: "03",
    title: "Retroalimentación y transparencia",
    text: "Las hojas de jueceo serán devueltas a los participantes o responsables de academia a través del portal. Estas hojas funcionan como una herramienta de auto retroalimentación para seguir creciendo, además de garantizar transparencia sobre los puntajes obtenidos.",
  },
];

export function RulesPage() {
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
    <main className="rules-page">
      <LevitateHeader activeLabel="Convocatoria" useRootLinks />

      <section className="rules-hero">
        <div className="rules-hero__copy">
          <p className="rules-eyebrow">Evaluaciones</p>
          <h1>Cómo se evalúa tu presentación</h1>
        </div>

        <div className="rules-hero__intro">
          <p>
            En Levitate, cada presentación es evaluada por jueces especializados bajo un sistema justo, transparente y estandarizado.
          </p>
          <p>Conoce los criterios de evaluación.</p>
        </div>

        <div className="rules-hero__mark" aria-hidden="true">
          <img src={assets.competition} alt="" />
          <div>
            <span>Levitate MX</span>
            <strong>L</strong>
          </div>
        </div>
      </section>

      <section className="rules-carousel-pin" aria-label="Pilares de evaluación" ref={pinRef}>
        <div className="rules-carousel">
          <aside className="rules-carousel__rail" aria-hidden="true">
            <span>Desliza</span>
          </aside>

          <div className="rules-track-window">
            <div className="rules-track" ref={trackRef}>
              {ruleCards.map((card, index) => (
                <article
                  className={`rules-card${activeIndex === index ? " is-active" : ""}`}
                  key={card.title}
                  style={{ "--card-index": index } as CSSProperties}
                >
                  <img src={card.image} alt="" aria-hidden="true" />
                  <div className="rules-card__shade" aria-hidden="true" />
                  <div className="rules-card__content">
                    <div className="rules-card__topline">
                      <strong>{card.number}</strong>
                    </div>
                    <h2>{card.title}</h2>
                    <p>{card.text}</p>
                  </div>
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

      <section className="rules-motion-explainer" aria-labelledby="rules-motion-genre-title">
        <div className="rules-motion-explainer__copy">
          <h2 id="rules-motion-genre-title">Cada género tiene su propia forma de ser evaluado.</h2>
          <p>
            En Levitate, cada género Motion cuenta con su propia hoja de jueceo, diseñada para evaluar con mayor rigor,
            claridad y precisión las características específicas de cada disciplina.
          </p>
          <p>
            Este sistema permite que la evaluación se moldee a los diferentes estilos, composiciones, lenguajes técnicos y
            formas de expresión dentro de los géneros de baile, reconociendo que no todos se construyen ni se interpretan de
            la misma manera.
          </p>
          <p>
            Así, cada presentación es evaluada bajo criterios adecuados a su género, manteniendo un proceso justo,
            especializado y coherente con la propuesta artística de cada participante.
          </p>
        </div>

        <div className="rules-motion-explainer__cards" aria-label="Ventajas de la evaluación por género">
          {genreEvaluationCards.map(({ icon: Icon, text, title }) => (
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
          <h2 id="rules-motion-process-title">¿Cómo funciona el jueceo en LevitateMX?</h2>
          <p>
            Nuestro sistema de evaluación está diseñado para ser justo, preciso y transparente, asegurando que cada
            presentación sea valorada de manera adecuada y profesional.
          </p>
        </div>

        <div className="rules-motion-process__cards">
          {judgingProcessCards.map(({ icon: Icon, number, text, title }) => (
            <article className="rules-motion-step-card" key={title}>
              <Icon aria-hidden="true" size={34} strokeWidth={1.8} />
              <strong>{number}</strong>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <LevitateFooter useRootLinks />
    </main>
  );
}
