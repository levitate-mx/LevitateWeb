export function ParticipantDiplomaPreview({
  name,
  academy,
  season,
  eventTitle,
  venue,
  date,
  preview,
}: {
  name: string;
  academy: string;
  season: string;
  eventTitle: string;
  venue: string;
  date: string;
  preview: boolean;
}) {
  return (
    <div className="participant-diploma-stage" data-participant-reveal>
      <div
        className="participant-certificate"
        role="img"
        aria-label={`Representación del diploma de participación de ${name}`}
      >
        <div className="participant-certificate__content" aria-hidden="true">
          <div className="participant-certificate__edition">
            <span />
            {season || eventTitle}
            {preview && <b>Ejemplo</b>}
          </div>
          <img
            className="participant-certificate__logo"
            src="/assets/levitate-logo-mx.png"
            alt=""
            width="1395"
            height="420"
          />
          <div className="participant-certificate__title">
            <i>Diploma</i>
            <span>DE PARTICIPACIÓN</span>
          </div>
          <div className="participant-certificate__recipient">
            <span>Se otorga a</span>
            <strong>{name}</strong>
            <small>{academy}</small>
          </div>
          <div className="participant-certificate__recognition">
            <span />
            <p>Por compartir su talento en el escenario de Levitate MX.</p>
          </div>
          <div className="participant-certificate__event">
            <i>Te elevaste con nosotros.</i>
            <strong>{eventTitle}</strong>
            <span>{date}</span>
            <span>{venue}</span>
          </div>
          <div className="participant-certificate__signature">
            <span />
            DIRECCIÓN LEVITATE MX
          </div>
        </div>
      </div>
      <span className="participant-diploma-stage__caption">
        Vista del reconocimiento · {season}
      </span>
    </div>
  );
}
