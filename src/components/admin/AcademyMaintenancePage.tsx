import { ArrowLeft, Clock3, CloudOff } from "lucide-react";

export function AcademyMaintenancePage() {
  return (
    <main className="academy-maintenance-page">
      <header className="academy-maintenance-page__header">
        <a className="academy-maintenance-page__logo" href="/" aria-label="Levitate MX, ir al inicio">
          <img src="/assets/levitate-logo-mx.png" alt="Levitate MX" />
        </a>

        <a className="academy-maintenance-page__back" href="/">
          <ArrowLeft aria-hidden="true" size={17} />
          <span>Volver al sitio</span>
        </a>
      </header>

      <div className="academy-maintenance-page__rule" aria-hidden="true" />

      <section className="academy-maintenance-page__content" aria-labelledby="academy-maintenance-title">
        <div className="academy-maintenance-page__copy">
          <p className="academy-maintenance-page__eyebrow">
            <span aria-hidden="true" />
            Panel de academias
          </p>

          <h1 id="academy-maintenance-title">
            Estamos en <span>mantenimiento.</span>
          </h1>

          <p className="academy-maintenance-page__description">
            El panel de academias no está disponible temporalmente. Nuestro equipo ya está trabajando para
            restablecer el acceso lo antes posible.
          </p>

          <div className="academy-maintenance-page__note">
            <Clock3 aria-hidden="true" size={21} />
            <div>
              <strong>No necesitas realizar ninguna acción.</strong>
              <span>Te recomendamos volver a intentarlo más tarde.</span>
            </div>
          </div>
        </div>

        <aside className="academy-maintenance-page__status" aria-label="Estado del servicio">
          <div className="academy-maintenance-page__status-icon" aria-hidden="true">
            <CloudOff size={32} strokeWidth={1.7} />
          </div>
          <p>Estado del servicio</p>
          <h2>Acceso temporalmente suspendido</h2>
          <span>Gracias por tu paciencia y comprensión.</span>
          <div className="academy-maintenance-page__status-line">
            <i aria-hidden="true" />
            Mantenimiento en curso
          </div>
        </aside>
      </section>
    </main>
  );
}
