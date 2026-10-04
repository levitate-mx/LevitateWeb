import { ArrowLeft, Clock3 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getMexicoCityDateFromParts, getMexicoCityDateTimeParts } from "../../utils/mexicoCityTime";

function getMaintenanceDeadline() {
  const mexicoCityNow = getMexicoCityDateTimeParts(new Date());

  if (!mexicoCityNow) {
    return Date.now();
  }

  return getMexicoCityDateFromParts({
    day: mexicoCityNow.day,
    hour: 18,
    month: mexicoCityNow.month,
    year: mexicoCityNow.year,
  }).getTime();
}

function padCountdownUnit(value: number) {
  return String(value).padStart(2, "0");
}

export function AcademyMaintenancePage() {
  const deadline = useMemo(getMaintenanceDeadline, []);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const remainingMilliseconds = Math.max(0, deadline - currentTime);
  const remainingSeconds = Math.floor(remainingMilliseconds / 1000);
  const countdown = {
    hours: Math.floor(remainingSeconds / 3600),
    minutes: Math.floor((remainingSeconds % 3600) / 60),
    seconds: remainingSeconds % 60,
  };
  const countdownLabel = `${countdown.hours} horas, ${countdown.minutes} minutos y ${countdown.seconds} segundos`;

  useEffect(() => {
    if (deadline <= Date.now()) {
      return;
    }

    const updateCountdown = () => {
      const nextTime = Math.min(Date.now(), deadline);
      setCurrentTime(nextTime);

      if (nextTime === deadline) {
        window.clearInterval(intervalId);
      }
    };
    const intervalId = window.setInterval(updateCountdown, 1000);

    updateCountdown();
    return () => window.clearInterval(intervalId);
  }, [deadline]);

  return (
    <main className="academy-maintenance-page">
      <header className="academy-maintenance-page__header">
        <a className="academy-maintenance-page__back" href="/">
          <ArrowLeft aria-hidden="true" size={17} />
          <span>Volver al sitio</span>
        </a>

        <a className="academy-maintenance-page__logo" href="/" aria-label="Levitate MX, ir al inicio">
          <img src="/assets/levitate-logo-mx.png" alt="Levitate MX" />
        </a>

        <span aria-hidden="true" />
      </header>

      <section className="academy-maintenance-page__content" aria-labelledby="academy-maintenance-title">
        <div className="academy-maintenance-page__copy">
          <p className="academy-maintenance-page__eyebrow">Panel de academias</p>

          <h1 id="academy-maintenance-title">
            Volvemos a las <span>18:00.</span>
          </h1>

          <p className="academy-maintenance-page__description">
            Estamos realizando una pausa técnica para mejorar el servicio. Agradecemos tu paciencia mientras
            trabajamos para ofrecerte una mejor experiencia.
          </p>

          <div className="academy-maintenance-page__time">
            <Clock3 aria-hidden="true" size={20} />
            <div className="academy-maintenance-page__time-copy">
              <strong>Mantenimiento en curso</strong>
              <div className="academy-maintenance-page__countdown" role="timer" aria-label={countdownLabel}>
                <time dateTime={`PT${countdown.hours}H${countdown.minutes}M${countdown.seconds}S`}>
                  {padCountdownUnit(countdown.hours)}:{padCountdownUnit(countdown.minutes)}:{padCountdownUnit(countdown.seconds)}
                </time>
                <small>{remainingMilliseconds > 0 ? "Tiempo restante" : "Restableciendo acceso"}</small>
              </div>
              <span>Hora de la Ciudad de México.</span>
            </div>
          </div>
        </div>

        <figure className="academy-maintenance-page__media" aria-hidden="true">
          <img src="/assets/academy-maintenance-illustration.png" alt="" />
        </figure>
      </section>
    </main>
  );
}
