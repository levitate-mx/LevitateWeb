import { ArrowUpRight, CalendarDays, MapPin } from "lucide-react";
import { edoMexWorkshops, formatWorkshopTime } from "../../data/workshopsContent";

function WorkshopTimeRange({ start, end }: { start: string; end: string }) {
  return (
    <>
      <time dateTime={`${edoMexWorkshops.date}T${start}`}>{formatWorkshopTime(start)}</time>
      {" - "}
      <time dateTime={`${edoMexWorkshops.date}T${end}`}>{formatWorkshopTime(end)}</time>
    </>
  );
}

export function WorkshopSchedule({ title = "Workshops" }: { title?: string }) {
  return (
    <section className="workshop-schedule" id="horarios-edomex" aria-labelledby="workshop-schedule-title">
      <div className="workshop-schedule__inner">
        <div className="workshop-schedule__intro">
          <header className="workshop-schedule__header">
            <p className="workshop-schedule__eyebrow">Otoño 2026 · Estado de México</p>
            <h2 id="workshop-schedule-title">{title}.</h2>
          </header>
          <div className="workshop-schedule__meta">
            <div className="workshop-schedule__date">
              <CalendarDays aria-hidden="true" size={20} />
              <time dateTime={edoMexWorkshops.date}>{edoMexWorkshops.dateLabel}</time>
            </div>
            {edoMexWorkshops.tracks.map((track) => (
              <div className="workshop-schedule__venue" key={track.id}>
                <MapPin aria-hidden="true" size={20} />
                <div>
                  <strong>{track.title}</strong>
                  <a className="workshop-schedule__map" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(track.venue)}`} target="_blank" rel="noreferrer" aria-label={`Ver mapa de ${track.venue}`}>
                    {track.venue} <ArrowUpRight aria-hidden="true" size={15} />
                  </a>
                </div>
              </div>
            ))}
          </div>

          <div className="workshop-schedule__groups">
            {edoMexWorkshops.tracks.flatMap((track) => track.groups.map((group) => (
              <article className="workshop-schedule__group" key={group.label}>
                <h3>{group.label}</h3>
                <span>{track.title}</span>
                <p>{group.ages}</p>
              </article>
            )))}
          </div>
          <p className="workshop-schedule__notice">Aerial y Motion se realizan en sedes distintas.</p>
          <p className="workshop-schedule__footnote">{edoMexWorkshops.footnote}</p>
        </div>

        <div className="workshop-schedule__agenda">
          {edoMexWorkshops.tracks.map((track) => (
            <section className={`workshop-schedule__track workshop-schedule__track--${track.id}`} key={track.id} aria-labelledby={`workshop-${track.id}-title`}>
              <header className="workshop-schedule__track-header">
                <h3 id={`workshop-${track.id}-title`}>{track.title}</h3>
                <p>{track.venue}</p>
              </header>

              <table className="workshop-schedule__table" aria-label={`Horarios de ${track.title}`}>
                <thead>
                  <tr>
                    <th scope="col">Horario</th>
                    {track.groups.map((group) => (
                      <th scope="col" key={group.label}>
                        <strong>{group.label}</strong>
                        <span>{group.ages}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {track.slots.map((slot) => (
                    <tr key={slot.start}>
                      <th scope="row"><WorkshopTimeRange start={slot.start} end={slot.end} /></th>
                      {slot.shared ? (
                        <td className="workshop-schedule__shared" colSpan={track.groups.length}>
                          <span className="workshop-schedule__mobile-group" aria-hidden="true">
                            <b>{track.groups.map((group) => group.label).join(" + ")}</b>
                            Ambos grupos
                          </span>
                          <strong>{slot.shared.title}</strong>
                          <span className="workshop-schedule__coach">{slot.shared.coach}</span>
                        </td>
                      ) : slot.classes.map((workshop, index) => (
                        <td key={track.groups[index].label}>
                          <span className="workshop-schedule__mobile-group" aria-hidden="true">
                            <b>{track.groups[index].label}</b>
                            {track.groups[index].ages}
                          </span>
                          <strong>{workshop.title}</strong>
                          <span className="workshop-schedule__coach">{workshop.coach}</span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}
