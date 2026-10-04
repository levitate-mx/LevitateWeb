import { ArrowLeft, Clock3 } from "lucide-react";

export function AcademyMaintenancePage() {
  return (
    <main className="academy-maintenance-page">
      <div className="academy-maintenance-page__backdrop" aria-hidden="true">
        <img src="/assets/levitate-home-hero-poster.jpg" alt="" />
      </div>

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
        <p className="academy-maintenance-page__eyebrow">Panel de academias</p>

        <h1 id="academy-maintenance-title">
          Volvemos a las <span>18:00.</span>
        </h1>

        <p className="academy-maintenance-page__description">
          Estamos realizando una pausa técnica para mejorar el servicio. El mantenimiento terminará hoy a las
          18:00 h, tiempo de México.
        </p>

        <div className="academy-maintenance-page__time">
          <Clock3 aria-hidden="true" size={19} />
          <div>
            <strong>Mantenimiento en curso</strong>
            <span>Agradecemos tu paciencia; estamos trabajando para ofrecerte una mejor experiencia.</span>
          </div>
        </div>
      </section>
    </main>
  );
}
