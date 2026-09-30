import { Download } from "lucide-react";
import { useMemo, useState } from "react";
import {
  prepareBrowserDownload,
  startBrowserDownload,
  type BrowserDownload,
} from "../../utils/browserDownload";
import { AdminMessageComposer } from "./AdminMessageComposer";
import {
  buildAcademyPendingMessage,
  buildAcademyPendingReport,
  pendingCategories,
  type AcademyPendingSources,
  type PendingCategory,
} from "./academyPendingReport";
import "./AcademyPendingPanel.css";

export function AcademyPendingPanel({
  source,
  unavailableReason = "",
}: {
  source: AcademyPendingSources;
  unavailableReason?: string;
}) {
  const [venue, setVenue] = useState("all");
  const [categories, setCategories] = useState<PendingCategory[]>(
    pendingCategories.map((category) => category.id),
  );
  const [isExporting, setIsExporting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [preparedDownload, setPreparedDownload] = useState<
    (BrowserDownload & { reportKey: string }) | null
  >(null);
  const report = useMemo(
    () => buildAcademyPendingReport(source, venue),
    [source, venue],
  );
  const selectedItems = report.items.filter((item) =>
    categories.includes(item.category),
  );
  const templates = [
    {
      id: "academy-pending",
      label: "Pendientes por categoría",
      body: buildAcademyPendingMessage(report, categories),
    },
  ];
  const reportKey = JSON.stringify([report, categories]);
  const currentDownload =
    preparedDownload?.reportKey === reportKey ? preparedDownload : null;
  const savePreparedDownload = (download: BrowserDownload) => {
    try {
      startBrowserDownload(download);
    } catch {
      // The native link below remains available if automatic downloading is blocked.
    }
    setFeedback(
      "PDF listo. Si la descarga no comenzó, usa el enlace Guardar PDF.",
    );
  };
  const exportPdf = async () => {
    setIsExporting(true);
    setFeedback("");
    try {
      if (currentDownload) {
        savePreparedDownload(currentDownload);
        return;
      }
      const { createAcademyPendingPdf } = await import("./academyPendingPdf");
      const blob = await createAcademyPendingPdf(report, categories);
      const name =
        report.academyName
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-zA-Z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 70) || "academia";
      const download = prepareBrowserDownload(
        blob,
        `levitate-pendientes-${name}.pdf`,
      );
      setPreparedDownload({ ...download, reportKey });
      savePreparedDownload(download);
    } catch {
      setFeedback("No se pudo generar el PDF. Intenta descargarlo de nuevo.");
    } finally {
      setIsExporting(false);
    }
  };
  return (
    <section className="academy-pending" aria-label="Pendientes por academia">
      <header>
        <h3>Pendientes por academia</h3>
        <p>
          Revisa el detalle y elige qué incluir en el PDF y el mensaje para el
          titular.
        </p>
      </header>
      {unavailableReason ? (
        <p role="status" className="academy-pending__notice">
          {unavailableReason}
        </p>
      ) : null}
      <fieldset
        className="academy-pending__content"
        disabled={Boolean(unavailableReason)}
        aria-busy={Boolean(unavailableReason)}
      >
        <label className="academy-pending__event">
          Evento
          <select
            value={venue}
            onChange={(event) => {
              setVenue(event.target.value);
              setFeedback("");
            }}
          >
            <option value="all">Todos los eventos</option>
            {report.venues.map((event) => (
              <option key={event.id} value={event.id}>
                {event.label}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="academy-pending__categories">
          <legend>Incluir en el reporte</legend>
          {pendingCategories.map((category) => (
            <label key={category.id}>
              <input
                type="checkbox"
                checked={categories.includes(category.id)}
                onChange={(event) => {
                  setCategories((current) =>
                    event.target.checked
                      ? [...current, category.id]
                      : current.filter((id) => id !== category.id),
                  );
                  setFeedback("");
                }}
              />
              <span>{category.label}</span>
              <strong>
                {
                  report.items.filter((item) => item.category === category.id)
                    .length
                }
              </strong>
            </label>
          ))}
        </fieldset>
        <button
          className="academy-pending__download"
          type="button"
          disabled={isExporting || !categories.length}
          onClick={exportPdf}
        >
          <Download aria-hidden="true" size={17} />
          {isExporting ? "Generando PDF…" : "Descargar PDF de pendientes"}
        </button>
        <p className="academy-pending__notice">
          El PDF incluye las categorías seleccionadas. Descárgalo y adjúntalo en
          WhatsApp; el mensaje se abre listo para revisar y enviar.
        </p>
        {feedback ? <p role="status">{feedback}</p> : null}
        {currentDownload && !unavailableReason ? (
          <a
            className="academy-pending__save"
            href={currentDownload.url}
            download={currentDownload.fileName}
            target="_blank"
            rel="noopener"
          >
            <Download aria-hidden="true" size={16} /> Guardar PDF
          </a>
        ) : null}
        {!categories.length ? (
          <p role="status">Selecciona al menos una categoría.</p>
        ) : (
          <>
            <div className="academy-pending__sections">
              {pendingCategories
                .filter((category) => categories.includes(category.id))
                .map((category) => {
                  const items = selectedItems.filter(
                    (item) => item.category === category.id,
                  );
                  return (
                    <details key={category.id} open={items.length > 0}>
                      <summary>
                        {category.label}
                        <span>{items.length}</span>
                      </summary>
                      <p>{category.description}</p>
                      {items.length ? (
                        <ul>
                          {items.map((item) => (
                            <li key={item.id}>
                              <strong>{item.subject}</strong>
                              {item.context ? (
                                <small>{item.context}</small>
                              ) : null}
                              <p>{item.detail}</p>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p>Sin pendientes registrados.</p>
                      )}
                    </details>
                  );
                })}
            </div>
            <AdminMessageComposer
              recipientName={source.academy.contactName || source.academy.name}
              phone={source.academy.phone || ""}
              requireCountryPrefix
              templates={templates}
              contextKey={`pending:${source.academy.id}`}
            />
          </>
        )}
      </fieldset>
    </section>
  );
}
