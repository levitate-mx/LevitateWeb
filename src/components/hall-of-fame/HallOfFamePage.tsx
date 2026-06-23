import { Building2, Star } from "lucide-react";
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

const mvpDepthClasses = [" is-depth-front", " is-depth-mid", " is-depth-back", " is-depth-mid"];

export function HallOfFamePage() {
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

          <div className="levitate-hof__viewport" aria-label="MVPs Levitate">
            <div className="levitate-hof__rail">
              {[0, 1].map((loopIndex) => (
                <div
                  aria-hidden={loopIndex === 1 ? true : undefined}
                  className="levitate-hof__loop"
                  key={`mvp-loop-${loopIndex}`}
                >
                  {mvpPerformances.map((performance, index) => {
                    const depthIndex = loopIndex * mvpPerformances.length + index;

                    return (
                      <article
                        className={`levitate-mvp-card${mvpDepthClasses[depthIndex % mvpDepthClasses.length]}`}
                        key={`${performance.image}-${loopIndex}-${index}`}
                      >
                        <figure>
                          <img src={performance.image} alt={`Imagen de referencia para ${performance.title}`} loading="lazy" />
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
              ))}
            </div>
          </div>
        </section>
      </section>

      <LevitateFooter />
    </main>
  );
}
