import { ArrowRight, MapPin } from "lucide-react";
import { LevitateFooter } from "../home/LevitateFooter";
import { LevitateHeader } from "../home/LevitateHeader";

export function HospedajePage() {
  return (
    <main className="hospedaje-page levitate-home-redesign">
      <LevitateHeader useRootLinks />

      <section className="hospedaje-hero">
        <figure className="hospedaje-hero__media">
          <img src="/assets/hotel-city-express-mundo-e.png" alt="City Express Plus Mundo E by Marriott" />
        </figure>
        <div className="hospedaje-hero__content">
          <p>Hospedaje oficial</p>
          <h1>Hotel sede Edo Méx.</h1>
          <strong>City Express Plus Mundo E by Marriott</strong>
          <span>
            Una opción cercana al Teatro Gran Recinto para quienes viajan con su academia, familia o equipo.
          </span>
        </div>
      </section>

      <section className="hospedaje-info">
        <div>
          <p>Ubicación</p>
          <h2>A unos minutos del teatro sede.</h2>
        </div>
        <article>
          <MapPin aria-hidden="true" size={28} />
          <div>
            <strong>City Express Plus Mundo E by Marriott</strong>
            <span>
              El hotel sede estará conectado con la logística de Edo Méx para facilitar traslados, descanso y organización durante el evento.
            </span>
          </div>
        </article>
        <article>
          <div className="hospedaje-info__marker">01</div>
          <div>
            <strong>Proceso de hospedaje</strong>
            <span>
              Próximamente compartiremos la dinámica de reserva, disponibilidad y pasos para asegurar tu estancia.
            </span>
          </div>
        </article>
        <a href="/sedes/estado-de-mexico">
          Volver a Edo Méx <ArrowRight aria-hidden="true" size={18} />
        </a>
      </section>

      <LevitateFooter useRootLinks />
    </main>
  );
}
