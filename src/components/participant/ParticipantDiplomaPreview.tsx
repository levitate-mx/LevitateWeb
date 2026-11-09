export function ParticipantDiplomaPreview({
  name,
  academy,
  season,
  eventTitle,
  preview,
  internalPreview = false,
}: {
  name: string;
  academy: string;
  season: string;
  eventTitle: string;
  preview: boolean;
  internalPreview?: boolean;
}) {
  return (
    <div className="participant-diploma-stage" data-participant-reveal>
      <div
        className="participant-certificate participant-certificate--authenticated"
        role="img"
        aria-label={`Reconocimiento de participación autenticado de ${name}`}
      >
        <img
          className="participant-certificate__art"
          src="/assets/participant-recognition-template.png"
          alt=""
          aria-hidden="true"
          width="1020"
          height="1320"
        />
        <div className="participant-certificate__content" aria-hidden="true">
          <div className="participant-certificate__recipient participant-certificate__recipient--authenticated">
            <strong>{name}</strong>
            <small>{academy}</small>
          </div>
          <div className="participant-certificate__auth">
            <span aria-hidden="true">✓</span>
            {internalPreview ? "Vista interna · No publicado" : preview ? "Ejemplo autenticado" : "Reconocimiento autenticado"}
          </div>
        </div>
      </div>
      <span className="participant-diploma-stage__caption">
        {internalPreview ? "Vista interna · No publicado" : "Reconocimiento autenticado"} · {season || eventTitle}
      </span>
    </div>
  );
}
