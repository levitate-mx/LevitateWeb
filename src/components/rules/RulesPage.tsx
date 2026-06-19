import { ArrowUpRight } from "lucide-react";
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
  {
    number: "04",
    title: "Niveles y obligatorios",
    image: assets.workshops,
    text: "Para las disciplinas áreas las categorías se dividen en tres niveles:",
    levels: "Principiante • Intermedio • Avanzado",
    note: "Cada nivel cuenta con obligatorios y criterios técnicos específicos. Por ello, invitamos a maestros y participantes a inscribirse en el nivel que mejor represente su preparación y ejecución actual. Esto permite mantener un jueceo más claro, equilibrado y justo para todos los participantes.",
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
                  className={`rules-card${activeIndex === index ? " is-active" : ""}${card.note ? " rules-card--wide" : ""}`}
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
                  {"levels" in card ? <strong className="rules-card__levels">{card.levels}</strong> : null}
                  {card.note ? <p className="rules-card__note">{card.note}</p> : null}
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

      <section className="rules-bottom">
        <p>Cada criterio se evalúa de manera individual y contribuye al puntaje final de tu presentación.</p>
        <a href="/#convocatorias">
          Consulta la guía de evaluación <ArrowUpRight aria-hidden="true" size={18} />
        </a>
        <a href="/#convocatorias">
          Inscribe tu coreografía <ArrowUpRight aria-hidden="true" size={18} />
        </a>
      </section>

      <LevitateFooter useRootLinks />
    </main>
  );
}
