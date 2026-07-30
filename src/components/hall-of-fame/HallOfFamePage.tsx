import { useState } from "react";
import { Building2, ChevronDown, ChevronLeft, ChevronRight, Download, MapPin } from "lucide-react";
import { LevitateFooter } from "../home/LevitateFooter";
import { LevitateHeader } from "../home/LevitateHeader";

type MvpPerformance = {
  academy: string;
  heroImage?: string;
  image: string;
  imageClassName?: string;
  sortOrder: number;
  title: string;
  venue: string;
  year: string;
};

const mvpPerformances: MvpPerformance[] = [
  {
    sortOrder: 202302,
    year: "Otoño 2023",
    title: "Barracuda",
    academy: "Ventuerion",
    venue: "CDMX",
    image: "/assets/mvp-barracuda-2023-left.jpg",
  },
  {
    sortOrder: 202401,
    year: "Primavera 2024",
    title: "Paint in Black",
    academy: "Dance Forum",
    venue: "CDMX",
    heroImage: "/assets/mvp-paint-in-black-2024-hero.jpg",
    image: "/assets/mvp-paint-in-black-2024.jpg",
    imageClassName: "levitate-mvp-card__image--fill",
  },
  { sortOrder: 202402, year: "Otoño 2024", title: "Zozobra", academy: "Spiralis", venue: "CDMX", image: "/assets/mvp-zozobra-2024.jpg" },
  {
    sortOrder: 202501,
    year: "Primavera 2025",
    title: "Querida Yo",
    academy: "Ars Nova",
    venue: "Puebla",
    image: "/assets/mvp-querida-yo-2024.jpg",
    imageClassName: "levitate-mvp-card__image--fill",
  },
  {
    sortOrder: 202502,
    year: "Primavera 2025",
    title: "Party, Party, Party",
    academy: "Stiletto Estudio de Danza",
    venue: "San Luis Potosí",
    image: "/assets/mvp-party-party-party-2025-slp.png",
    imageClassName: "levitate-mvp-card__image--fill",
  },
  {
    sortOrder: 202503,
    year: "Otoño 2025",
    title: "La Forma",
    academy: "Release Danza de Alto Rendimiento",
    venue: "CDMX",
    image: "/assets/mvp-la-forma-otono-2026-cdmx.jpg",
    imageClassName: "levitate-mvp-card__image--fill",
  },
  {
    sortOrder: 202601,
    year: "Primavera 2026",
    title: "Run",
    academy: "Release Danza de Alto Rendimiento",
    venue: "Veracruz",
    image: "/assets/mvp-run-primavera-2026-veracruz.jpg",
    imageClassName: "levitate-mvp-card__image--fill",
  },
  {
    sortOrder: 202602,
    year: "Primavera 2026",
    title: "El Nahual",
    academy: "Azquil",
    venue: "CDMX",
    image: "/assets/mvp-el-nahual-primavera-2026-cdmx.jpg",
    imageClassName: "levitate-mvp-card__image--fill levitate-mvp-card__image--nahual",
  },
  {
    sortOrder: 202603,
    year: "Primavera 2026",
    title: "Instruction",
    academy: "Plataforma studio",
    venue: "Puebla",
    image: "/assets/mvp-instruction-primavera-2026-puebla.jpg",
    imageClassName: "levitate-mvp-card__image--fill",
  },
].sort((left, right) => left.sortOrder - right.sortOrder);

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
    <main className="levitate-page levitate-home-redesign hall-fame-page">
      <section className="hall-fame-shell">
        <section className="levitate-hof" id="mvps">
          <LevitateHeader activeLabel="Salón de la fama" useRootLinks variant="pill" />

          <img
            alt=""
            aria-hidden="true"
            className="levitate-hof__hero-image"
            src={activePerformance.heroImage ?? activePerformance.image}
          />

          <div className="levitate-hof__content">
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
