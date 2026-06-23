import { useState } from "react";
import { Building2, ChevronLeft, ChevronRight, Star } from "lucide-react";
import { assets } from "../../data/homeContent";
import { LevitateFooter } from "../home/LevitateFooter";
import { LevitateHeader } from "../home/LevitateHeader";

const mvpPerformances = [
  { year: "2026", title: "MVP por anunciar", academy: "Academia por anunciar", category: "Categoría por anunciar", image: assets.competition },
  { year: "2026", title: "MVP por anunciar", academy: "Academia por anunciar", category: "Categoría por anunciar", image: "/assets/sedes-cdmx-aerial.jpg" },
  { year: "2026", title: "MVP por anunciar", academy: "Academia por anunciar", category: "Categoría por anunciar", image: "/assets/premiation-recognition-special.jpg" },
  { year: "2026", title: "MVP por anunciar", academy: "Academia por anunciar", category: "Categoría por anunciar", image: "/assets/sedes-cdmx-motion.jpg" },
  { year: "2026", title: "MVP por anunciar", academy: "Academia por anunciar", category: "Categoría por anunciar", image: assets.venue },
  { year: "2026", title: "MVP por anunciar", academy: "Academia por anunciar", category: "Categoría por anunciar", image: assets.workshops },
  { year: "2026", title: "MVP por anunciar", academy: "Academia por anunciar", category: "Categoría por anunciar", image: "/assets/premiation-aerial-medal-system.jpg" },
  { year: "2026", title: "MVP por anunciar", academy: "Academia por anunciar", category: "Categoría por anunciar", image: "/assets/premiation-motion-medal-system.jpg" },
  { year: "2026", title: "MVP por anunciar", academy: "Academia por anunciar", category: "Categoría por anunciar", image: assets.hero },
  { year: "2026", title: "MVP por anunciar", academy: "Academia por anunciar", category: "Categoría por anunciar", image: "/assets/sedes-edomex-hero.jpg" },
];

function getMvpStackPosition(index: number, activeIndex: number) {
  const total = mvpPerformances.length;
  let offset = (index - activeIndex + total) % total;

  if (offset > total / 2) offset -= total;

  if (offset === 0) return "is-active";
  if (offset === 1) return "is-next";
  if (offset === -1) return "is-prev";
  if (offset === 2) return "is-far-next";
  if (offset === -2) return "is-far-prev";
  return "is-hidden";
}

export function HallOfFamePage() {
  const [activeMvpIndex, setActiveMvpIndex] = useState(0);

  const showMvp = (step: number) => {
    setActiveMvpIndex((currentIndex) => (currentIndex + step + mvpPerformances.length) % mvpPerformances.length);
  };

  return (
    <main className="levitate-page hall-fame-page">
      <section className="hall-fame-shell">
        <LevitateHeader activeLabel="Salón de la fama" useRootLinks />

        <section className="levitate-hof" id="mvps">
          <div className="levitate-hof__header">
            <div className="levitate-hof__rule" aria-hidden="true">
              <span />
              <i />
              <span />
            </div>
            <p className="levitate-eyebrow">Hall of the Fame</p>
            <h1>
              <span>MVPs</span>
              {" "}
              Levitate
            </h1>
            <strong>Los grandes protagonistas de cada edición.</strong>
          </div>

          <div className="levitate-hof__carousel" aria-label="MVPs Levitate">
            <button
              aria-label="Ver MVP anterior"
              className="levitate-hof__arrow levitate-hof__arrow--prev"
              onClick={() => showMvp(-1)}
              type="button"
            >
              <ChevronLeft aria-hidden="true" size={26} />
            </button>

            <div className="levitate-hof__stage">
              {mvpPerformances.map((performance, index) => {
                const stackPosition = getMvpStackPosition(index, activeMvpIndex);
                const isActive = stackPosition === "is-active";

                return (
                  <article
                    aria-hidden={!isActive}
                    className={`levitate-mvp-card ${stackPosition}`}
                    key={`${performance.image}-${index}`}
                  >
                    <figure>
                      <img src={performance.image} alt={`Imagen de referencia para ${performance.title}`} loading={isActive ? "eager" : "lazy"} />
                      <span>{performance.year}</span>
                    </figure>
                    <div className="levitate-mvp-card__content">
                      <small>MVP Levitate</small>
                      <h2>{performance.title}</h2>
                      <i aria-hidden="true" />
                      <dl>
                        <div>
                          <dt><Building2 aria-hidden="true" size={20} /> Academia</dt>
                          <dd>{performance.academy}</dd>
                        </div>
                        <div>
                          <dt><Star aria-hidden="true" size={20} /> Categoría</dt>
                          <dd>{performance.category}</dd>
                        </div>
                      </dl>
                    </div>
                  </article>
                );
              })}
            </div>

            <button
              aria-label="Ver siguiente MVP"
              className="levitate-hof__arrow levitate-hof__arrow--next"
              onClick={() => showMvp(1)}
              type="button"
            >
              <ChevronRight aria-hidden="true" size={26} />
            </button>
          </div>
        </section>
      </section>

      <LevitateFooter />
    </main>
  );
}
