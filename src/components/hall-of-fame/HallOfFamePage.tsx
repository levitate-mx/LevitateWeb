import { useState } from "react";
import { Building2, ChevronLeft, ChevronRight, Download, MapPin } from "lucide-react";
import { LevitateFooter } from "../home/LevitateFooter";
import { LevitateHeader } from "../home/LevitateHeader";

const mvpPerformances = [
  { year: "Otoño 2023", title: "Barracuda", academy: "Ventuerion", venue: "CDMX", image: "/assets/mvp-barracuda-2023.jpg" },
  {
    year: "Primavera 2024",
    title: "Paint in Black",
    academy: "Dance Forum",
    venue: "CDMX",
    image: "/assets/mvp-paint-in-black-2024.jpg",
    imageClassName: "levitate-mvp-card__image--fill",
  },
  {
    year: "Primavera 2024",
    title: "Querida Yo",
    academy: "Ars Nova",
    venue: "Puebla",
    image: "/assets/mvp-querida-yo-2024.jpg",
    imageClassName: "levitate-mvp-card__image--fill",
  },
  { year: "Otoño 2024", title: "Zozobra", academy: "Spiralis", venue: "CDMX", image: "/assets/mvp-zozobra-2024.jpg" },
  {
    year: "2025",
    title: "Party, Party, Party",
    academy: "Stiletto Estudio de Danza",
    venue: "San Luis Potosí",
    image: "/assets/mvp-party-party-party-2025-slp.png",
    imageClassName: "levitate-mvp-card__image--fill",
  },
  {
    year: "Primavera 2026",
    title: "RUN",
    academy: "Release Danza de Alto Rendimiento",
    venue: "Veracruz",
    image: "/assets/mvp-run-primavera-2026-veracruz.jpg",
    imageClassName: "levitate-mvp-card__image--fill",
  },
  {
    year: "Primavera 2026",
    title: "El Nahual",
    academy: "Azquil",
    venue: "CDMX",
    image: "/assets/mvp-el-nahual-primavera-2026-cdmx.jpg",
    imageClassName: "levitate-mvp-card__image--fill levitate-mvp-card__image--nahual",
  },
  {
    year: "Primavera 2026",
    title: "INSTRUCTION",
    academy: "Plataforma studio",
    venue: "Puebla",
    image: "/assets/mvp-instruction-primavera-2026-puebla.jpg",
    imageClassName: "levitate-mvp-card__image--fill",
  },
  {
    year: "Otoño 2026",
    title: "LA FORMA",
    academy: "Release Danza de Alto Rendimiento",
    venue: "CDMX",
    image: "/assets/mvp-la-forma-otono-2026-cdmx.jpg",
    imageClassName: "levitate-mvp-card__image--fill",
  },
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
                      <img
                        aria-hidden="true"
                        className="levitate-mvp-card__image-backdrop"
                        src={performance.image}
                        alt=""
                        loading={isActive ? "eager" : "lazy"}
                      />
                      <img
                        className={`levitate-mvp-card__image${performance.imageClassName ? ` ${performance.imageClassName}` : ""}`}
                        src={performance.image}
                        alt={`Imagen de referencia para ${performance.title}`}
                        loading={isActive ? "eager" : "lazy"}
                      />
                    </figure>
                    <div className="levitate-mvp-card__content">
                      <small>{performance.year}</small>
                      <h2>{performance.title}</h2>
                      <i aria-hidden="true" />
                      <dl>
                        <div>
                          <dt><Building2 aria-hidden="true" size={20} /> Academia</dt>
                          <dd>{performance.academy}</dd>
                        </div>
                        <div>
                          <dt><MapPin aria-hidden="true" size={20} /> Sede</dt>
                          <dd>{performance.venue}</dd>
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

        <section className="levitate-scholarships" id="becados" aria-labelledby="scholarships-title">
          <div className="levitate-scholarships__grid">
            <div className="levitate-scholarships__copy">
              <p className="levitate-eyebrow">Reconocimiento Levitate</p>
              <h2 id="scholarships-title">
                <span>Becados</span>
                {" "}
                de próxima edición
              </h2>
              <strong>Los mejores puntajes de la competencia.</strong>
              <p>
                Este reconocimiento impulsa a quienes dejaron una marca especial en el escenario. Las becas celebran
                su nivel, disciplina y presencia para que sigan entrenando, creciendo y compitiendo dentro de Levitate.
              </p>
              <a className="levitate-scholarships__download" download href="/assets/becados-proxima-edicion.pdf">
                <Download aria-hidden="true" size={20} />
                Descargar PDF de becados
              </a>
            </div>

            <aside className="levitate-scholarships__panel" aria-label="Criterios de becados">
              <div>
                <span>Ranking</span>
                <p>Mejores puntajes oficiales de la competencia.</p>
              </div>
              <div>
                <span>Impulso</span>
                <p>Reconocimiento para continuar el proceso competitivo.</p>
              </div>
            </aside>
          </div>
        </section>
      </section>

      <LevitateFooter />
    </main>
  );
}
