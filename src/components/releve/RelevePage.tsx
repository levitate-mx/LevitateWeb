import { ArrowRight, CheckCircle2, Clock3, FileText, Sparkles, Trophy, UsersRound } from "lucide-react";
import { LevitateFooter } from "../home/LevitateFooter";
import { LevitateHeader } from "../home/LevitateHeader";

const regulationsPdfHref = "/assets/reglamento-levitate.pdf";

const roleCards = [
  {
    title: "Alumnos creadores",
    copy: "Diseñan la idea, construyen la propuesta y toman decisiones de dirección.",
  },
  {
    title: "Maestros intérpretes",
    copy: "Suben al escenario para ejecutar una coreografía creada por sus alumnos.",
  },
  {
    title: "Academia en equipo",
    copy: "La pieza representa una mirada colectiva: alumno, maestro y academia.",
  },
];

const ruleHighlights = [
  {
    icon: UsersRound,
    title: "Sin subdivisiones",
    copy: "No hay edades ni niveles en esta modalidad. Todos los Relevé compiten por igual.",
  },
  {
    icon: Sparkles,
    title: "Dos ramas",
    copy: "La competencia se divide únicamente en Relevé Motion y Relevé Aerial.",
  },
  {
    icon: CheckCircle2,
    title: "Mínimo requerido",
    copy: "Para participar, el maestro debe tener mínimo tres coreografías registradas.",
  },
  {
    icon: Clock3,
    title: "Tiempo en escena",
    copy: "La ejecución debe durar de 2:30 a 3:30 min.",
  },
];

const awardItems = [
  "Premio de $5,000 MXN al maestro ganador.",
  "Reconocimientos para alumnos y academias.",
  "Los 3 primeros lugares recibirán un taller impartido por Mariana Lara, fisioterapeuta en danza de @ritmo_fisio.",
];

export function RelevePage() {
  return (
    <main className="releve-page levitate-home-redesign">
      <section className="releve-hero" id="inicio">
        <img
          className="releve-hero__image"
          src="/assets/releve-hero-award.png"
          alt="Alumnos y maestros celebrando en premiación Levitate."
        />
        <LevitateHeader activeLabel="Modalidades" useRootLinks variant="pill" />

        <div className="releve-hero__content">
          <p className="releve-kicker">Modalidad</p>
          <h1 aria-label="Levitate Relevé">
            <span aria-hidden="true">Levitate</span>
            <span aria-hidden="true">Relevé</span>
          </h1>
          <a className="releve-hero__download" download href={regulationsPdfHref}>
            <FileText aria-hidden="true" size={18} />
            <span>PDF de reglamento</span>
          </a>
        </div>
      </section>

      <section className="releve-light-section releve-intro" id="como-funciona">
        <div className="releve-intro__layout">
          <article className="releve-intro__copy">
            <p className="releve-kicker">La idea</p>
            <h2>
              <span>La propuesta</span>
              <span>nace desde</span>
              <span>los alumnos.</span>
            </h2>
            <p>
              Relevé invierte el proceso creativo: los alumnos imaginan y dirigen la pieza, mientras el maestro lleva
              esa visión al escenario con presencia, técnica e interpretación.
            </p>
          </article>

          <figure className="releve-intro__media">
            <img
              src="/assets/releve-idea-aerial.jpg"
              alt="Intérprete aérea en tela durante una presentación Levitate."
              loading="lazy"
            />
          </figure>

          <article className="releve-intro__audience">
            <p className="releve-light-kicker">¿Qué lo hace distinto?</p>
            <p>
              El maestro no compite por su propia coreografía, interpreta la visión creada por sus alumnos, para
              fomentar un ambiente de empatía y trabajo en equipo.
            </p>
          </article>
        </div>
      </section>

      <section className="releve-dark-band" aria-label="Roles del Premio Relevé">
        <div className="releve-section-head">
          <p className="releve-kicker">Cómo se construye</p>
          <h2>Alumno, maestro y academia en una misma pieza.</h2>
        </div>

        <div className="releve-rule-grid releve-rule-grid--roles">
          {roleCards.map((card, index) => (
            <article key={card.title}>
              <span>0{index + 1}</span>
              <h3>{card.title}</h3>
              <p>{card.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="releve-light-section releve-divisions">
        <div className="releve-section-head releve-section-head--split">
          <div>
            <p className="releve-light-kicker">Premio doble</p>
            <h2>Motion y Aerial se reconocen por separado.</h2>
          </div>
          <p>
            No hay subdivisiones por edades ni niveles. Todos los Relevé compiten por igual, divididos únicamente por
            rama.
          </p>
        </div>
      </section>

      <section className="releve-light-section releve-rules">
        <div className="releve-section-wrap">
          <header className="releve-section-head">
            <p className="releve-light-kicker">Participación</p>
            <h2>Bases de participación.</h2>
          </header>

          <div className="releve-rule-grid">
            {ruleHighlights.map(({ icon: Icon, title, copy }) => (
              <article key={title}>
                <Icon aria-hidden="true" size={24} />
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="releve-light-section releve-awards" id="premios">
        <div className="releve-awards__grid">
          <article className="releve-awards__main">
            <p className="releve-light-kicker">Qué se premia</p>
            <h2>$5,000 MXN</h2>
            <p>Premio en efectivo al maestro ganador.</p>
          </article>

          <div className="releve-awards__details">
            {awardItems.map((item) => (
              <article key={item}>
                <Trophy aria-hidden="true" size={20} />
                <p>{item}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="releve-light-section releve-cta">
        <div className="releve-cta__grid">
          <div>
            <p className="releve-light-kicker">Convocatoria</p>
            <h2>Una categoría para crear en equipo.</h2>
          </div>
          <div className="releve-cta__actions">
            <a href="/inscripciones">
              Inscripciones <ArrowRight aria-hidden="true" size={18} />
            </a>
            <a href="/sedes/estado-de-mexico">
              Ver sede Edo. Méx <ArrowRight aria-hidden="true" size={18} />
            </a>
          </div>
        </div>
      </section>

      <LevitateFooter useRootLinks />
    </main>
  );
}
