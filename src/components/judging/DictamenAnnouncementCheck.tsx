import type { AnnouncementState } from "./dictamenAnnouncements";
import "./DictamenAnnouncementCheck.css";

export function DictamenAnnouncementCheck({ announcement, label }: { announcement: AnnouncementState; label: string }) {
  return <label className={`dictamen-announcement-check${announcement.checked ? " is-announced" : ""}`}>
    <input type="checkbox" aria-label={`Anunciado: ${label}`} checked={announcement.checked} onChange={event => announcement.onChange(event.target.checked)} />
    <span>Anunciado</span>
  </label>;
}

export function DictamenAnnouncementProgress({ announced, total, storageError }: { announced: number; total: number; storageError: boolean }) {
  return <div className="dictamen-announcement-progress" aria-label="Avance de anuncios del bloque">
    <p role="status">{announced} de {total} anunciados</p>
    <small>{storageError ? "Las marcas se mantienen sólo en esta página; no se pudieron guardar en este navegador." : "Guardado en este navegador"}</small>
  </div>;
}
