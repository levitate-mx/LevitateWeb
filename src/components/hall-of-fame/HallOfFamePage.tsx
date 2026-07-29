import { useState } from "react";
import { Building2, ChevronDown, ChevronLeft, ChevronRight, Download, MapPin } from "lucide-react";
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

const scholarshipDownloads = [
  { label: "Veracruz Primavera 2026", href: "/assets/becados-proxima-edicion.pdf" },
  { label: "Puebla Primavera 2026", href: "/assets/becados-proxima-edicion.pdf" },
  { label: "CDMX Primavera 2026", href: "/assets/becados-proxima-edicion.pdf" },
];

export function HallOfFamePage() {
  const [activeMvpIndex, setActiveMvpIndex] = useState(0);
  const [selectedScholarshipIndex, setSelectedScholarshipIndex] = useState(0);
  const activePerformance = mvpPerformances[activeMvpIndex] ?? mvpPerformances[0];
  const selectedScholarshipDownload = scholarshipDownloads[selectedScholarshipIndex] ?? scholarshipDownloads[0];

  const showMvp = (step: number) => {
    setActiveMvpIndex((currentIndex) => (currentIndex + step + mvpPerformances.length) % mvpPerformances.length);
  };

  return (
    <main className="levitate-page hall-fame-page">
      <section className="hall-fame-shell">
        <section className="levitate-hof" id="mvps">
          <LevitateHeader activeLabel="Salón de la fama" useRootLinks />

          <img
            alt=""
            aria-hidden="true"
            className="levitate-hof__hero-image"
            src={activePerformance.image}
          />
          <div className="levitate-hof__shade" aria-hidden="true" />

          <div className="levitate-hof__content">
            <div className="levitate-hof__header">
              <p className="levitate-eyebrow">Salón de la fama</p>
              <h1>
                Historias que siguen
                {" "}
                <span>elevando.</span>
              </h1>
              <strong>Un archivo vivo de los MVPs que marcaron cada edición de Levitate.</strong>
            </div>

            <article className="levitate-hof__featured" aria-live="polite">
              <small>MVP seleccionado</small>
              <h2>{activePerformance.title}</h2>
              <dl>
                <div>
                  <dt><Building2 aria-hidden="true" size={18} /> Academia</dt>
                  <dd>{activePerformance.academy}</dd>
                </div>
                <div>
                  <dt><MapPin aria-hidden="true" size={18} /> Sede</dt>
                  <dd>
                    {activePerformance.venue}
                    {" · "}
                    {activePerformance.year}
                  </dd>
                </div>
              </dl>
              <div className="levitate-hof__controls">
                <button aria-label="Ver MVP anterior" onClick={() => showMvp(-1)} type="button">
                  <ChevronLeft aria-hidden="true" size={22} />
                </button>
                <button aria-label="Ver siguiente MVP" onClick={() => showMvp(1)} type="button">
                  <ChevronRight aria-hidden="true" size={22} />
                </button>
              </div>
            </article>
          </div>
        </section>

        <section className="levitate-hof-archive" aria-labelledby="hof-archive-title">
          <div className="levitate-hof-archive__head">
            <div>
              <p className="levitate-eyebrow">MVPs Levitate</p>
              <h2 id="hof-archive-title">Ganadores por edición.</h2>
            </div>
            <p>
              Selecciona una edición para ver su historia destacada en portada. Cada MVP representa presencia,
              propuesta y una ejecución que dejó huella.
            </p>
          </div>

          <div className="levitate-hof-archive__grid" aria-label="Archivo de MVPs">
            {mvpPerformances.map((performance, index) => (
              <button
                aria-pressed={activeMvpIndex === index}
                className={`levitate-hof-archive__card${activeMvpIndex === index ? " is-active" : ""}`}
                key={`${performance.title}-${performance.year}`}
                onClick={() => setActiveMvpIndex(index)}
                type="button"
              >
                <img
                  alt={`MVP ${performance.title}`}
                  loading={index === 0 ? "eager" : "lazy"}
                  src={performance.image}
                />
                <span>{performance.year}</span>
                <strong>{performance.title}</strong>
                <small>
                  {performance.academy}
                  {" · "}
                  {performance.venue}
                </small>
              </button>
            ))}
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
              <div className="levitate-scholarships__actions">
                <label className="levitate-scholarships__select" htmlFor="scholarship-edition">
                  <span>Edición</span>
                  <select
                    id="scholarship-edition"
                    onChange={(event) => setSelectedScholarshipIndex(Number(event.target.value))}
                    value={selectedScholarshipIndex}
                  >
                    {scholarshipDownloads.map((download, index) => (
                      <option key={download.label} value={index}>
                        {download.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown aria-hidden="true" size={20} />
                </label>
                <a className="levitate-scholarships__download" download href={selectedScholarshipDownload.href}>
                  <Download aria-hidden="true" size={20} />
                  Descargar PDF
                </a>
              </div>
            </div>

          </div>
        </section>
      </section>

      <LevitateFooter />
    </main>
  );
}
