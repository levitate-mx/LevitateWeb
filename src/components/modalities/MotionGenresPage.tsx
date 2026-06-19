import { ArrowRight, Scale, Sparkles, UsersRound } from "lucide-react";
import { assets } from "../../data/homeContent";
import { LevitateFooter } from "../home/LevitateFooter";
import { LevitateHeader } from "../home/LevitateHeader";

const benefits = [
  {
    icon: Sparkles,
    title: "Destaca tu estilo único",
    copy: "Competir en tu género te hace más relevante y te ayuda a destacar.",
  },
  {
    icon: UsersRound,
    title: "Evaluación con claridad",
    copy: "Los jueces evalúan tu coreo dentro de contextos adecuados a cada disciplina.",
  },
  {
    icon: Scale,
    title: "Vive una clasificación justa",
    copy: "Cada coreografía compite en su género, para una valoración imparcial.",
  },
];

const genres = [
  {
    number: "01",
    title: "Acrojazz",
    copy: "Fusiona el jazz técnico y acrobacias contemporáneas para crear coreos de gran impacto visual.",
  },
  {
    number: "02",
    title: "Ballet",
    copy: "Técnica clásica y líneas tradicionales, con precisión, postura y estética en su máxima expresión.",
  },
  {
    number: "03",
    title: "Jazz",
    copy: "Estilo libre y expresivo. Combina jazz técnico con movimientos dinámicos y versátil contemporáneo.",
  },
  {
    number: "04",
    title: "Folklore",
    copy: "Expresa la identidad, raíces y cultura de regiones o países a través de danzas tradicionales.",
  },
  {
    number: "05",
    title: "Contemporáneo",
    copy: "Movimiento libre y emocional, que mezcla técnica, fluidez y creatividad sin límites.",
  },
  {
    number: "06",
    title: "Urbanos",
    copy: "Incluye street jazz, commercial, hip hop, waacking, heels, house y demás fusiones urbanas.",
  },
  {
    number: "07",
    title: "Lírico",
    copy: "Combina técnica, musicalidad e interpretación para contar una historia desde el movimiento.",
  },
  {
    number: "08",
    title: "Belly Dance",
    copy: "Danza oriental con control corporal, aislamientos, musicalidad y presencia escénica.",
  },
  {
    number: "09",
    title: "Open",
    copy: "Para propuestas que integran estilos, lenguajes o fusiones que no encajan en un género único.",
  },
];

export function MotionGenresPage() {
  return (
    <main className="motion-genres-page">
      <section className="motion-genres-hero" id="generos-motion">
        <LevitateHeader activeLabel="Modalidades" useRootLinks />
        <img className="motion-genres-hero__image" src={assets.hero} alt="" aria-hidden="true" />
        <div className="motion-genres-hero__shade" aria-hidden="true" />
        <div className="motion-genres-hero__light motion-genres-hero__light--one" aria-hidden="true" />
        <div className="motion-genres-hero__light motion-genres-hero__light--two" aria-hidden="true" />

        <div className="motion-genres-hero__content">
          <h1>
            <span>Géneros</span>
            <span>Levitate Motion</span>
          </h1>
          <p>Clasifica tu coreografía con precisión.</p>
          <a href="#generos-participantes">
            Ver géneros participantes <ArrowRight aria-hidden="true" size={18} />
          </a>
        </div>
      </section>

      <section className="motion-genres-intro" aria-labelledby="motion-genero-importa">
        <div className="motion-genres-intro__header">
          <h2 id="motion-genero-importa">
            El género <span>importa.</span>
          </h2>
        </div>

        <div className="motion-genres-benefits">
          {benefits.map((benefit) => {
            const Icon = benefit.icon;
            return (
              <article key={benefit.title}>
                <Icon aria-hidden="true" size={44} strokeWidth={1.6} />
                <h3>{benefit.title}</h3>
                <p>{benefit.copy}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="motion-genres-catalog" id="generos-participantes" aria-labelledby="motion-generos-title">
        <img
          className="motion-genres-catalog__dancer"
          src={assets.competition}
          alt=""
          aria-hidden="true"
          loading="lazy"
        />
        <div className="motion-genres-catalog__content">
          <div className="motion-genres-catalog__header">
            <p>Categorías oficiales</p>
            <h2 id="motion-generos-title">Géneros participantes</h2>
            <span>Todos los géneros deberán adecuarse a los lineamientos oficiales de cada categoría.</span>
          </div>

          <div className="motion-genres-grid">
            {genres.map((genre) => (
              <article key={genre.number}>
                <span>{genre.number}</span>
                <h3>{genre.title}</h3>
                <p>{genre.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <LevitateFooter useRootLinks />
    </main>
  );
}
