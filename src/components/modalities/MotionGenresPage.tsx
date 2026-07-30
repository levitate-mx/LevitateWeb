import { FileText } from "lucide-react";
import { assets } from "../../data/homeContent";
import { LevitateFooter } from "../home/LevitateFooter";
import { LevitateHeader } from "../home/LevitateHeader";

const regulationsPdfHref = "/assets/reglamento-levitate.pdf";

const motionGenres = [
  {
    title: "Acrojazz",
    text: "Fusiona jazz técnico y acrobacias contemporáneas para crear coreografías de alto impacto visual.",
  },
  {
    title: "Ballet",
    text: "Técnica clásica, postura, líneas tradicionales y precisión escénica.",
  },
  {
    title: "Jazz",
    text: "Estilo libre y expresivo con energía, dinámica, técnica y versatilidad.",
  },
  {
    title: "Folklore",
    text: "Danzas tradicionales que representan identidad, raíces, cultura y presencia escénica.",
  },
  {
    title: "Contemporáneo",
    text: "Movimiento libre, emocional y técnico con fluidez, intención y propuesta creativa.",
  },
  {
    title: "Urbanos",
    text: "Incluye street jazz, commercial, hip hop, waacking, heels, house y fusiones urbanas.",
  },
  {
    title: "Lírico",
    text: "Combina técnica, musicalidad e interpretación para contar una historia desde el movimiento.",
  },
  {
    title: "Belly Dance",
    text: "Danza oriental con control corporal, aislamientos, musicalidad y presencia.",
  },
  {
    title: "Open",
    text: "Para propuestas que integran estilos, lenguajes o fusiones fuera de un género único.",
  },
];

const motionCategories = [
  {
    title: "Solo",
    text: "Una persona en escena durante toda la presentación.",
    formats: ["1 participante"],
  },
  {
    title: "Dúo",
    text: "Dos participantes comparten la misma coreografía y propuesta escénica.",
    formats: ["2 participantes"],
  },
  {
    title: "Trío",
    text: "Tres participantes compiten dentro de una misma presentación.",
    formats: ["3 participantes"],
  },
  {
    title: "Grupo",
    text: "Cuatro o más participantes integran una coreografía colectiva.",
    formats: ["4+ participantes"],
  },
];

const motionDivisions = [
  { division: "Baby", ages: "Hasta los 6 años" },
  { division: "Petite", ages: "De 7 a 10 años" },
  { division: "Junior", ages: "De 11 a 13 años" },
  { division: "Teen", ages: "De 14 a 17 años" },
  { division: "Senior", ages: "18 años en adelante" },
  { division: "Legacy", ages: "+40 años Amateur" },
];

export function MotionGenresPage() {
  return (
    <main className="rules-page rules-page--aerial levitate-home-redesign motion-genres-page motion-genres-page--redesign">
      <LevitateHeader activeLabel="Modalidades" useRootLinks variant="pill" />

      <section className="rules-hero motion-genres-hero-redesign" id="generos-motion">
        <div className="rules-hero__copy">
          <p className="rules-eyebrow">MODALIDAD</p>
          <h1>
            <span className="rules-title__line">Levitate </span>
            <span className="rules-title__accent">Motion</span>
          </h1>
          <a className="rules-hero__download" download href={regulationsPdfHref}>
            <FileText aria-hidden="true" size={18} />
            <span>PDF de reglamento</span>
          </a>
        </div>

        <div className="rules-hero__mark" aria-hidden="true">
          <img src={assets.communityKidsStage} alt="" />
          <div>
            <span>Levitate MX</span>
            <strong>L</strong>
          </div>
        </div>
      </section>

      <section className="rules-aerial-program motion-program" aria-label="Guía de competencia Motion">
        <div className="rules-aerial-program__section rules-aerial-program__section--genres">
          <div className="rules-aerial-program__heading">
            <p className="rules-aerial-kicker">Géneros que participan</p>
            <h3>Estilos en competencia.</h3>
          </div>
          <div className="rules-aerial-genre-grid motion-program__genre-grid">
            {motionGenres.map((genre) => (
              <article className="rules-aerial-genre-card" key={genre.title}>
                <h4>{genre.title}</h4>
                <p>{genre.text}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="rules-aerial-program__section rules-aerial-program__section--categories">
          <div className="rules-aerial-program__heading">
            <p className="rules-aerial-kicker">Categorías</p>
            <h3>Formatos de participación.</h3>
          </div>
          <div className="rules-aerial-category-grid motion-program__category-grid">
            {motionCategories.map((category) => (
              <article className="rules-aerial-category-card" key={category.title}>
                <div>
                  <h4>{category.title}</h4>
                  <p>{category.text}</p>
                </div>
                <ul aria-label={`Formato ${category.title}`}>
                  {category.formats.map((format) => (
                    <li key={format}>{format}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>

        <div className="rules-aerial-program__section rules-aerial-program__section--divisions">
          <div className="rules-aerial-program__heading">
            <p className="rules-aerial-kicker">Divisiones</p>
            <h3>Rangos por edad.</h3>
          </div>
          <div className="rules-aerial-division-table" role="table" aria-label="Divisiones por edad">
            <div className="rules-aerial-division-table__head" role="row">
              <span role="columnheader">División</span>
              <span role="columnheader">Edades</span>
            </div>
            {motionDivisions.map((item) => (
              <div className="rules-aerial-division-table__row" role="row" key={item.division}>
                <strong role="cell">{item.division}</strong>
                <span role="cell">{item.ages}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <LevitateFooter useRootLinks />
    </main>
  );
}
