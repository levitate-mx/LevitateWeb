import { useEffect, useState } from "react";

const launchAt = new Date("2026-08-02T10:00:00-06:00").getTime();

function getRemainingTime() {
  const total = Math.max(0, launchAt - Date.now());
  const totalSeconds = Math.floor(total / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { days, hours, minutes, seconds };
}

function formatTime(value: number) {
  return String(value).padStart(2, "0");
}

export function LaunchTeaserPage() {
  const [remainingTime, setRemainingTime] = useState(getRemainingTime);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setRemainingTime(getRemainingTime());
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  const units = [
    { label: "Días", value: remainingTime.days },
    { label: "Horas", value: remainingTime.hours },
    { label: "Min", value: remainingTime.minutes },
    { label: "Seg", value: remainingTime.seconds },
  ];

  return (
    <main className="launch-teaser" aria-label="Cuenta regresiva para el lanzamiento de Levitate">
      <section className="launch-teaser__content">
        <img className="launch-teaser__logo" src="/assets/levitate-logo-mx.png" alt="Levitate MX" />

        <div className="launch-teaser__timer" aria-live="polite">
          {units.map((unit) => (
            <div className="launch-teaser__unit" key={unit.label}>
              <strong>{formatTime(unit.value)}</strong>
              <span>{unit.label}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
