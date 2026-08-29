import {
  ArrowDown,
  ArrowUpRight,
  Award,
  BedDouble,
  ClipboardList,
  Download,
  FileCheck2,
  FileText,
  ListChecks,
  Search,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { assets } from "../../data/homeContent";
import { LevitateFooter } from "../home/LevitateFooter";
import { LevitateHeader } from "../home/LevitateHeader";

type DocumentCategory = "Convocatoria" | "Reglamentos" | "Hospedaje" | "Reconocimientos";

type LevitateDocument = {
  title: string;
  description: string;
  href: string;
  fileName: string;
  category: DocumentCategory;
  context: string;
  icon: LucideIcon;
};

const documentFilters = ["Todos", "Convocatoria", "Reglamentos", "Hospedaje", "Reconocimientos"] as const;

const levitateDocuments: LevitateDocument[] = [
  {
    title: "Convocatoria Nacional Otoño 2026",
    description: "Documento base de la edición Edo. Méx. con fechas, sede, modalidades y lineamientos generales.",
    href: "/assets/convocatoria-nacional-otono-2026.pdf",
    fileName: "convocatoria-nacional-otono-2026.pdf",
    category: "Convocatoria",
    context: "Próxima edición",
    icon: ClipboardList,
  },
  {
    title: "Reglamento Levitate Motion Primavera 2026",
    description: "Reglas, categorías y criterios para la modalidad Motion.",
    href: "/assets/reglamento-levitate-primavera-2026-motion.pdf",
    fileName: "reglamento-levitate-primavera-2026-motion.pdf",
    category: "Reglamentos",
    context: "Motion",
    icon: FileCheck2,
  },
  {
    title: "Reglamento Levitate Aerial Primavera 2026",
    description: "Reglas, criterios y requisitos para la modalidad Aerial.",
    href: "/assets/reglamento-levitate-primavera-2026-aerial.pdf",
    fileName: "reglamento-levitate-primavera-2026-aerial.pdf",
    category: "Reglamentos",
    context: "Aerial",
    icon: FileCheck2,
  },
  {
    title: "Niveles Obligatorios Aerial Otoño 2026",
    description: "Guía de niveles obligatorios para preparar rutinas de Levitate Aerial.",
    href: "/assets/niveles-obligatorios-aerial-otono-2026.pdf",
    fileName: "niveles-obligatorios-aerial-otono-2026.pdf",
    category: "Reglamentos",
    context: "Aerial",
    icon: ListChecks,
  },
  {
    title: "Reglamento Levitate MX",
    description: "Reglamento general publicado para consulta rápida desde el sitio.",
    href: "/assets/reglamento-levitate.pdf",
    fileName: "reglamento-levitate.pdf",
    category: "Reglamentos",
    context: "General",
    icon: FileText,
  },
  {
    title: "Hotel Levitate 2026",
    description: "Información del hotel sede, ubicación y datos principales para planear tu estancia.",
    href: "/assets/hotel-levitate-2026.pdf",
    fileName: "hotel-levitate-2026.pdf",
    category: "Hospedaje",
    context: "Hotel sede",
    icon: BedDouble,
  },
  {
    title: "Beneficios Huéspedes Levitate 2026",
    description: "Beneficios disponibles para huéspedes Levitate durante la edición 2026.",
    href: "/assets/beneficios-huespedes-levitate-2026.pdf",
    fileName: "beneficios-huespedes-levitate-2026.pdf",
    category: "Hospedaje",
    context: "Beneficios",
    icon: BedDouble,
  },
  {
    title: "Becados Próxima Edición",
    description: "Documento de seguimiento para becas y reconocimientos rumbo a la siguiente edición.",
    href: "/assets/becados-proxima-edicion.pdf",
    fileName: "becados-proxima-edicion.pdf",
    category: "Reconocimientos",
    context: "Becados",
    icon: Award,
  },
];

const normalizeSearchValue = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export function DocumentsPage() {
  const [activeFilter, setActiveFilter] = useState<(typeof documentFilters)[number]>("Todos");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const items = document.querySelectorAll<HTMLElement>("[data-docs-reveal]");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.16 },
    );

    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, []);

  const visibleDocuments = useMemo(() => {
    const normalizedQuery = normalizeSearchValue(query.trim());

    return levitateDocuments.filter((document) => {
      const matchesFilter = activeFilter === "Todos" || document.category === activeFilter;
      const searchableText = normalizeSearchValue(
        `${document.title} ${document.description} ${document.fileName} ${document.category} ${document.context}`,
      );
      const matchesQuery = normalizedQuery.length === 0 || searchableText.includes(normalizedQuery);

      return matchesFilter && matchesQuery;
    });
  }, [activeFilter, query]);

  const resultLabel = `${visibleDocuments.length} ${
    visibleDocuments.length === 1 ? "documento disponible" : "documentos disponibles"
  }`;

  return (
    <main className="documents-page levitate-home-redesign">
      <LevitateHeader activeLabel="Documentos" useRootLinks variant="pill" />

      <section className="documents-hero" id="inicio">
        <img className="documents-hero__image" src={assets.communityKidsStage} alt="" aria-hidden="true" />
        <div className="documents-hero__shade" aria-hidden="true" />

        <div className="documents-hero__content">
          <div className="documents-hero__copy" data-docs-reveal>
            <p className="documents-kicker">Centro de documentos</p>
            <h1>
              Documentos para <span>competir.</span>
            </h1>
            <p className="documents-hero__lead">
              Convocatoria, reglamentos, hospedaje y reconocimientos en un solo lugar para que academias,
              participantes y familias encuentren rápido el PDF correcto.
            </p>
            <a className="documents-hero__button" href="#documentos">
              Ver PDFs <ArrowDown aria-hidden="true" size={18} />
            </a>
          </div>

          <aside className="documents-hero__summary" aria-label="Resumen del centro de documentos" data-docs-reveal>
            <strong>{levitateDocuments.length}</strong>
            <span>PDFs actuales</span>
            <p>Convocatoria, reglamentos, hospedaje y becados.</p>
          </aside>
        </div>
      </section>

      <section className="documents-library" id="documentos" aria-labelledby="documents-library-title">
        <div className="documents-library__header" data-docs-reveal>
          <p className="documents-kicker">Biblioteca</p>
          <h2 id="documents-library-title">Todo el material descargable.</h2>
          <p>
            Los documentos están agrupados por momento de consulta para que cada equipo pueda llegar directo a lo que necesita.
          </p>
        </div>

        <div className="documents-controls" data-docs-reveal>
          <label className="documents-search">
            <Search aria-hidden="true" size={18} />
            <input
              aria-label="Buscar documentos"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por sede, modalidad o archivo"
              type="search"
              value={query}
            />
          </label>

          <div className="documents-filters" aria-label="Filtrar documentos">
            {documentFilters.map((filter) => (
              <button
                aria-pressed={activeFilter === filter}
                className={activeFilter === filter ? "is-active" : undefined}
                key={filter}
                onClick={() => setActiveFilter(filter)}
                type="button"
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        <div className="documents-results" data-docs-reveal>
          <p>{resultLabel}</p>

          {visibleDocuments.length > 0 ? (
            <div className="documents-grid">
              {visibleDocuments.map((document) => {
                const Icon = document.icon;

                return (
                  <a
                    className="documents-card"
                    href={document.href}
                    key={document.href}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <span className="documents-card__icon">
                      <Icon aria-hidden="true" size={24} strokeWidth={1.9} />
                    </span>
                    <span className="documents-card__body">
                      <span className="documents-card__meta">
                        {document.category} / {document.context}
                      </span>
                      <strong>{document.title}</strong>
                      <span>{document.description}</span>
                      <small>{document.fileName}</small>
                    </span>
                    <span className="documents-card__action">
                      Abrir PDF <ArrowUpRight aria-hidden="true" size={17} />
                    </span>
                  </a>
                );
              })}
            </div>
          ) : (
            <p className="documents-empty">No hay documentos que coincidan con tu búsqueda.</p>
          )}
        </div>
      </section>

      <section className="documents-final" aria-label="Descarga directa" data-docs-reveal>
        <div>
          <p className="documents-kicker">Acceso rápido</p>
          <h2>Guarda la convocatoria principal.</h2>
        </div>
        <a href="/assets/convocatoria-nacional-otono-2026.pdf" rel="noreferrer" target="_blank">
          <Download aria-hidden="true" size={20} />
          Convocatoria Otoño 2026
        </a>
      </section>

      <LevitateFooter useRootLinks />
    </main>
  );
}
