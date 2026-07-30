import { ArrowRight, FileText, MapPin } from "lucide-react";
import { LevitateFooter } from "../home/LevitateFooter";
import { LevitateHeader } from "../home/LevitateHeader";

const lodgingDocuments = [
  {
    title: "Información del hotel",
    description: "Consulta detalles del hotel sede, ubicación y datos principales para planear tu estancia.",
    href: "/assets/hotel-levitate-2026.pdf",
  },
  {
    title: "Beneficios para huéspedes",
    description: "Revisa los beneficios disponibles para huéspedes Levitate 2026.",
    href: "/assets/beneficios-huespedes-levitate-2026.pdf",
  },
];

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

      <section className="hospedaje-info" id="documentos-hospedaje">
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
              Ya puedes consultar los documentos base para revisar información del hotel y beneficios para huéspedes.
            </span>
          </div>
        </article>
        <div className="hospedaje-documents" aria-label="Documentos de hospedaje">
          {lodgingDocuments.map((document) => (
            <a href={document.href} key={document.href} rel="noreferrer" target="_blank">
              <FileText aria-hidden="true" size={26} />
              <span>
                <strong>{document.title}</strong>
                <small>{document.description}</small>
              </span>
              <ArrowRight aria-hidden="true" size={18} />
            </a>
          ))}
        </div>
        <a href="/sedes/estado-de-mexico">
          Volver a Edo Méx <ArrowRight aria-hidden="true" size={18} />
        </a>
      </section>

      <LevitateFooter useRootLinks />
    </main>
  );
}
