import {
  ArrowUpRight,
  BedDouble,
  ClipboardList,
  FileCheck2,
  ListChecks,
  Search,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { LevitateFooter } from "../home/LevitateFooter";
import { LevitateHeader } from "../home/LevitateHeader";

type DocumentCategory = "Convocatoria" | "Reglamentos" | "Hospedaje";

type LevitateDocument = {
  title: string;
  href: string;
  fileName: string;
  category: DocumentCategory;
  context: string;
  icon: LucideIcon;
};

const documentFilters = ["Todos", "Convocatoria", "Reglamentos", "Hospedaje"] as const;

const levitateDocuments: LevitateDocument[] = [
  {
    title: "Convocatoria Nacional Otoño 2026",
    href: "/assets/convocatoria-nacional-otono-2026.pdf",
    fileName: "convocatoria-nacional-otono-2026.pdf",
    category: "Convocatoria",
    context: "Próxima edición",
    icon: ClipboardList,
  },
  {
    title: "Reglamento Levitate Motion Primavera 2026",
    href: "/assets/reglamento-levitate-primavera-2026-motion.pdf",
    fileName: "reglamento-levitate-primavera-2026-motion.pdf",
    category: "Reglamentos",
    context: "Motion",
    icon: FileCheck2,
  },
  {
    title: "Reglamento Levitate Aerial Primavera 2026",
    href: "/assets/reglamento-levitate-primavera-2026-aerial.pdf",
    fileName: "reglamento-levitate-primavera-2026-aerial.pdf",
    category: "Reglamentos",
    context: "Aerial",
    icon: FileCheck2,
  },
  {
    title: "Niveles Obligatorios Aerial Otoño 2026",
    href: "/assets/niveles-obligatorios-aerial-otono-2026.pdf",
    fileName: "niveles-obligatorios-aerial-otono-2026.pdf",
    category: "Reglamentos",
    context: "Aerial",
    icon: ListChecks,
  },
  {
    title: "Hotel Levitate 2026",
    href: "/assets/hotel-levitate-2026.pdf",
    fileName: "hotel-levitate-2026.pdf",
    category: "Hospedaje",
    context: "Hotel sede",
    icon: BedDouble,
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
        `${document.title} ${document.fileName} ${document.category} ${document.context}`,
      );
      const matchesQuery = normalizedQuery.length === 0 || searchableText.includes(normalizedQuery);

      return matchesFilter && matchesQuery;
    });
  }, [activeFilter, query]);

  const resultLabel = `${visibleDocuments.length} ${
    visibleDocuments.length === 1 ? "PDF" : "PDFs"
  }`;

  return (
    <main className="documents-page levitate-home-redesign">
      <LevitateHeader activeLabel="Documentos" useRootLinks variant="pill" />

      <section className="documents-library" id="documentos" aria-labelledby="documents-library-title">
        <div className="documents-library__header" data-docs-reveal>
          <p className="documents-kicker">Documentos</p>
          <h1 id="documents-library-title">PDFs Levitate.</h1>
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
            <div className="documents-list">
              {visibleDocuments.map((document) => {
                const Icon = document.icon;

                return (
                  <a
                    className="documents-row"
                    href={document.href}
                    key={document.href}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <span className="documents-row__icon">
                      <Icon aria-hidden="true" size={24} strokeWidth={1.9} />
                    </span>
                    <span className="documents-row__body">
                      <strong>{document.title}</strong>
                      <small>{document.category} / {document.context} / {document.fileName}</small>
                    </span>
                    <span className="documents-row__action" aria-label={`Abrir ${document.title}`}>
                      Abrir <ArrowUpRight aria-hidden="true" size={17} />
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

      <LevitateFooter useRootLinks />
    </main>
  );
}
