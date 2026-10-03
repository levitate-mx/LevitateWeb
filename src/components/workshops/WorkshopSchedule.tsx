import { ArrowUpRight, CalendarDays, Clock3, MapPin } from "lucide-react";
import { edoMexWorkshops, formatWorkshopTime } from "../../data/workshopsContent";

export function WorkshopSchedule({ title = "Workshops" }: { title?: string }) {
  return (
    <section className="workshop-schedule" id="horarios-edomex" aria-labelledby="workshop-schedule-title">
      <div className="workshop-schedule__inner">
        <header className="workshop-schedule__header">
          <div>
            <p className="workshop-schedule__eyebrow">Otoño 2026 · Estado de México</p>
            <h2 id="workshop-schedule-title"><span>{title}</span>.</h2>
          </div>
          <div className="workshop-schedule__date">
            <CalendarDays aria-hidden="true" size={20} />
            <time dateTime={edoMexWorkshops.date}>{edoMexWorkshops.dateLabel}</time>
          </div>
        </header>
        <p className="workshop-schedule__notice">Aerial y Motion se realizan en sedes distintas.</p>

        {edoMexWorkshops.tracks.map((track) => (
          <section className={`workshop-schedule__track workshop-schedule__track--${track.id}`} key={track.id} aria-labelledby={`workshop-${track.id}-title`}>
            <header className="workshop-schedule__track-header">
              <div>
                <h3 id={`workshop-${track.id}-title`}>{track.title}</h3>
                <p className="workshop-schedule__venue"><MapPin aria-hidden="true" size={19} />{track.venue}</p>
                <a className="workshop-schedule__map" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(track.venue)}`} target="_blank" rel="noreferrer" aria-label={`Ver mapa de ${track.venue}`}>
                  Ver mapa <ArrowUpRight aria-hidden="true" size={16} />
                </a>
              </div>
              <p className="workshop-schedule__hours">
                <Clock3 aria-hidden="true" size={18} />
                {formatWorkshopTime(track.slots[0].start)} - {formatWorkshopTime(track.slots[track.slots.length - 1].end)}
              </p>
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
                    <th scope="row">
                      <time dateTime={`${edoMexWorkshops.date}T${slot.start}`}>{formatWorkshopTime(slot.start)}</time>
                      {" - "}
                      <time dateTime={`${edoMexWorkshops.date}T${slot.end}`}>{formatWorkshopTime(slot.end)}</time>
                    </th>
                    {slot.shared ? (
                      <td colSpan={2} className="workshop-schedule__shared">
                        <span className="workshop-schedule__shared-label">{track.groups.map((group) => group.label).join(" + ")}</span>
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
        <p className="workshop-schedule__footnote">{edoMexWorkshops.footnote}</p>
      </div>
    </section>
  );
}
