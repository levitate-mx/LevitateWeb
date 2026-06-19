import { ArrowLeft, ArrowRight, CalendarDays, Ticket, Users } from "lucide-react";
import { type CSSProperties, useEffect, useState } from "react";
import { Button } from "../ui/Button";
import { SectionEyebrow } from "../ui/SectionEyebrow";
import { LevitateFooter } from "../home/LevitateFooter";
import { LevitateHeader } from "../home/LevitateHeader";
import { MotionReveal } from "../home/MotionReveal";
import { KineticMarquee } from "../ui/KineticMarquee";
import { AnimatedTextReveal } from "../motion/AnimatedTextReveal";
import type { VenuePageData } from "../../data/venueContent";

type VenuePageProps = {
  venue?: VenuePageData;
};

const participationSteps = [
  { number: "01", label: "Disciplina" },
  { number: "02", label: "Especialidad" },
  { number: "03", label: "Formato" },
];

const scoreRanges = [
  { number: "01", label: "Oro", range: "181 - 210 pts", width: "100%" },
  { number: "02", label: "Plata", range: "161 - 180 pts", width: "82%" },
  { number: "03", label: "Bronce", range: "141 - 160 pts", width: "64%" },
  { number: "04", label: "Participación", range: "≤ 140 pts", width: "46%" },
];

const rankingAwards = [
  {
    place: "1º lugar",
    solo: "Medalla de oro",
    group: "Trofeo + medallas",
  },
  {
    place: "2º lugar",
    solo: "Medalla de plata",
    group: "Trofeo + medallas",
  },
  {
    place: "3º lugar",
    solo: "Medalla de bronce",
    group: "Trofeo + medallas",
  },
];

const specialAwards = [
  "MVP: mejor puntaje de toda la competencia",
  "Beca 100% Levitate 2027",
  "Mejor puntaje de Aerial",
  "Mejor puntaje de Motion",
  "Mejor vestuario",
  "Mejor idea coreográfica",
  "Mejor música",
  "Mejor porra",
];

export function VenuePage({ venue }: VenuePageProps) {
  const [activeDiscipline, setActiveDiscipline] = useState("Aerial");

  useEffect(() => {
    if (!window.location.hash) return;

    const frame = window.requestAnimationFrame(() => {
      document.querySelector(window.location.hash)?.scrollIntoView();
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  if (!venue) {
    return (
      <>
        <LevitateHeader activeLabel="Convocatoria" useRootLinks />
        <main className="venue-not-found">
          <SectionEyebrow>SEDE NO ENCONTRADA</SectionEyebrow>
          <h1>No encontramos esta sede.</h1>
          <Button href="/#eventos">Volver a sedes</Button>
        </main>
        <LevitateFooter useRootLinks />
      </>
    );
  }

  const activeGenre = venue.genreGroups.find((group) => group.title === activeDiscipline) ?? venue.genreGroups[0];

  return (
    <>
      <LevitateHeader activeLabel="Convocatoria" useRootLinks />
      <main className="venue-page">
        <section className="venue-hero">
          <img src={venue.heroImage} alt="" aria-hidden="true" />
          <div className="venue-hero__shade" aria-hidden="true" />
          <div className="venue-hero__content">
            <a className="venue-back" href="/#eventos">
              <ArrowLeft aria-hidden="true" size={16} />
              Sedes
            </a>
            <MotionReveal>
              <p className="section-eyebrow">{venue.season}</p>
              <h1>{venue.title}</h1>
              <p>{venue.intro}</p>
              <div className="venue-hero__actions">
                <Button href="#inscripciones">Inscribirme</Button>
              </div>
            </MotionReveal>
            <MotionReveal className="venue-hero__facts" delay={120}>
              <div>
                <span>Fecha</span>
                <strong>{venue.dateLong}</strong>
              </div>
              <div>
                <span>Estatus</span>
                <strong>{venue.status}</strong>
              </div>
            </MotionReveal>
          </div>
        </section>

        <KineticMarquee items={["FECHA", "BLOQUES", "AERIAL", "MOTION", "JUECES", "MEDALLERO"]} />

        <section id="info-general" className="venue-section venue-section--info">
          <div className="section__inner">
            <MotionReveal className="venue-section__header">
              <SectionEyebrow>INFO GENERAL · FECHA</SectionEyebrow>
              <h2>Todo lo esencial antes de llegar.</h2>
              <p>
                La sede se organiza para que academias, participantes y familias sepan cuándo
                llegar, dónde presentarse y cómo se vive la jornada.
              </p>
            </MotionReveal>
            <div className="venue-general-grid">
              {venue.generalInfo.map((item, index) => (
                <MotionReveal key={item.label} delay={index * 70}>
                  <article className="venue-panel venue-general-card">
                    {index === 0 ? (
                      <CalendarDays aria-hidden="true" size={19} />
                    ) : (
                      <Users aria-hidden="true" size={19} />
                    )}
                    <span>{item.label}</span>
                    <h3>{item.value}</h3>
                    <p>{item.description}</p>
                  </article>
                </MotionReveal>
              ))}
            </div>
          </div>
        </section>

        <section id="bloques" className="venue-section">
          <div className="section__inner">
            <MotionReveal className="venue-section__header">
              <SectionEyebrow>BLOQUES</SectionEyebrow>
              <h2>El día corre por etapas claras.</h2>
              <p>
                Los bloques separan registro, competencia y cierre para mantener el flujo ordenado
                sin perder la energía escénica de la sede.
              </p>
            </MotionReveal>

            <div className="venue-block-grid">
              {venue.blocks.map((block, index) => (
                <MotionReveal key={block.label} delay={index * 80}>
                  <article className="venue-panel venue-block">
                    <span>0{index + 1}</span>
                    <h3>{block.label}</h3>
                    <strong>{block.time}</strong>
                    <p>{block.description}</p>
                  </article>
                </MotionReveal>
              ))}
            </div>
          </div>
        </section>

        <section id="generos" className="venue-section venue-section--split">
          <div className="section__inner venue-builder">
            <MotionReveal className="venue-section__header venue-builder__header">
              <SectionEyebrow>CATEGORÍAS</SectionEyebrow>
              <AnimatedTextReveal
                as="h2"
                lines={[
                  "Tu disciplina.",
                  <>
                    Tu formato. <span className="text-pink animated-text__accent">Tu escenario.</span>
                  </>,
                ]}
              />
              <p>
                Levitate organiza cada participación por universo escénico, especialidad y formato,
                para que cada academia encuentre su lugar con claridad.
              </p>
            </MotionReveal>

            <MotionReveal className="venue-builder__steps" delay={80}>
              {participationSteps.map((step, index) => (
                <div key={step.number} style={{ "--step-index": index } as CSSProperties}>
                  <span>{step.number}</span>
                  <strong>{step.label}</strong>
                </div>
              ))}
            </MotionReveal>

            <MotionReveal className="venue-builder__surface" delay={130}>
              <div className="venue-builder__discipline">
                <div className="venue-builder__topline">
                  <span>Disciplina</span>
                  <p>Elige el universo escénico.</p>
                </div>
                <div className="venue-tabs" role="tablist" aria-label="Disciplinas Levitate">
                  {venue.genreGroups.map((group) => (
                    <button
                      key={group.title}
                      type="button"
                      role="tab"
                      aria-selected={activeGenre.title === group.title}
                      className={activeGenre.title === group.title ? "is-active" : ""}
                      onClick={() => setActiveDiscipline(group.title)}
                    >
                      {group.title}
                    </button>
                  ))}
                </div>

                <div className="venue-specialty-panel" key={activeGenre.title}>
                  <span>Especialidades {activeGenre.title}</span>
                  <div className="venue-chip-list venue-chip-list--animated">
                    {activeGenre.items.map((item, index) => (
                      <span key={item} style={{ "--chip-index": index } as CSSProperties}>
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <aside className="venue-builder__formats" aria-label="Formatos de participación">
                <div className="venue-builder__topline">
                  <span>Formatos de participación</span>
                  <p>Cómo se presenta cada academia.</p>
                </div>
                <div className="venue-chip-list venue-chip-list--formats">
                  {venue.categories.map((category, index) => (
                    <span key={category} style={{ "--chip-index": index } as CSSProperties}>
                      {category}
                    </span>
                  ))}
                </div>
              </aside>
            </MotionReveal>
          </div>
        </section>

        <section id="inscripciones" className="venue-section">
          <div className="section__inner venue-registration-layout">
            <MotionReveal className="venue-section__header">
              <SectionEyebrow>INSCRIPCIONES</SectionEyebrow>
              <h2>Costos referenciales por formato.</h2>
              <p>
                Los importes son referenciales para esta versión. La página queda preparada para
                reemplazar precios, cupos y formulario oficial cuando cierre la convocatoria.
              </p>
            </MotionReveal>
            <MotionReveal className="venue-panel venue-price-card" delay={90}>
              {venue.registration.map((item) => (
                <div key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </MotionReveal>
          </div>
        </section>

        <section className="venue-section venue-section--table">
          <div className="section__inner">
            <MotionReveal className="venue-section__header">
              <SectionEyebrow>DIVISIÓN DE EDADES · MÚSICA</SectionEyebrow>
              <h2>Tiempos de ejecución por división.</h2>
            </MotionReveal>
            <MotionReveal className="venue-table-wrap" delay={80}>
              <table className="venue-table">
                <thead>
                  <tr>
                    <th>División</th>
                    <th>Edad</th>
                    <th>Música</th>
                  </tr>
                </thead>
                <tbody>
                  {venue.ageDivisions.map((division) => (
                    <tr key={division.name}>
                      <td>{division.name}</td>
                      <td>{division.ages}</td>
                      <td>{division.music}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </MotionReveal>
          </div>
        </section>

        <section id="jueces" className="venue-section">
          <div className="section__inner">
            <MotionReveal className="venue-section__header">
              <SectionEyebrow>JUECES</SectionEyebrow>
              <h2>Miradas expertas para elevar cada presentación.</h2>
              <p>
                El panel combina técnica, lectura escénica y experiencia formativa. Los nombres son
                temporales y se reemplazarán cuando se confirme el jurado oficial.
              </p>
            </MotionReveal>
            <div className="venue-judge-grid">
              {venue.judges.map((judge, index) => (
                <MotionReveal key={judge.name} delay={index * 80}>
                  <article className="venue-panel venue-judge">
                    <span>0{index + 1}</span>
                    <h3>{judge.name}</h3>
                    <strong>{judge.specialty}</strong>
                    <p>{judge.bio}</p>
                  </article>
                </MotionReveal>
              ))}
            </div>
          </div>
        </section>

        <section id="medallero" className="venue-section">
          <div className="section__inner venue-medals">
            <MotionReveal className="venue-section__header venue-medals__intro">
              <SectionEyebrow>PREMIOS · MEDALLERO</SectionEyebrow>
              <AnimatedTextReveal as="h2" lines={["Cada punto", "cuenta."]} />
              <p>
                Levitate reconoce el desempeño por ranking competitivo y por puntaje absoluto
                cuando una categoría no tiene competencia directa.
              </p>
            </MotionReveal>

            <MotionReveal className="venue-score-card" delay={90}>
              <div className="venue-score-card__heading">
                <span>Sin competencia directa</span>
                <h3>Sistema por puntaje absoluto</h3>
              </div>
              <div className="venue-score-ladder">
                {scoreRanges.map((score, index) => (
                  <div
                    className="venue-score-row"
                    key={score.label}
                    style={
                      {
                        "--score-index": index,
                        "--score-width": score.width,
                      } as CSSProperties
                    }
                  >
                    <span>{score.number}</span>
                    <strong>{score.label}</strong>
                    <em>{score.range}</em>
                    <i aria-hidden="true" />
                  </div>
                ))}
              </div>
            </MotionReveal>

            <MotionReveal className="venue-ranking-card" delay={140}>
              <div className="venue-card-heading">
                <AwardIcon />
                <h3>Medallero con competencia directa</h3>
              </div>
              <div className="venue-ranking-table" role="table" aria-label="Medallero por ranking">
                <div role="row">
                  <span role="columnheader">Lugar</span>
                  <span role="columnheader">Solos</span>
                  <span role="columnheader">Dúos / Tríos / Grupales</span>
                </div>
                {rankingAwards.map((row) => (
                  <div role="row" key={row.place}>
                    <strong role="cell">{row.place}</strong>
                    <span role="cell">{row.solo}</span>
                    <span role="cell">{row.group}</span>
                  </div>
                ))}
              </div>
              <p>Los participantes fuera de los tres primeros lugares reciben medalla de participación.</p>
            </MotionReveal>

            <MotionReveal className="venue-special-awards" delay={190}>
              <span>Premios especiales</span>
              <div>
                {specialAwards.map((award, index) => (
                  <p key={award} style={{ "--award-index": index } as CSSProperties}>
                    {award}
                  </p>
                ))}
              </div>
            </MotionReveal>
          </div>
        </section>

        <section id="entradas" className="venue-section">
          <div className="section__inner venue-ticketing-layout">
            <MotionReveal className="venue-ticketing-copy">
              <SectionEyebrow>BOLETERÍA</SectionEyebrow>
              <AnimatedTextReveal as="h2" lines={["Boletos para", "vivir Levitate."]} />
              <p>Elige tu acceso y asegura tu lugar en la experiencia.</p>
              <div className="venue-ticket-list">
                {venue.tickets.map((ticket, index) => (
                  <div
                    className="venue-ticket-row"
                    key={ticket.label}
                    style={{ "--ticket-index": index } as CSSProperties}
                  >
                    <span>{ticket.label}</span>
                    <strong>{ticket.value}</strong>
                  </div>
                ))}
              </div>
              {/* TODO: reemplazar con URL oficial de compra de boletos. */}
              <Button href="#" className="venue-ticketing-cta">Comprar boletos ahora</Button>
              <p className="venue-ticketing-note">
                ¿Tienes dudas? Escríbenos por Instagram.
              </p>
            </MotionReveal>
            <MotionReveal className="venue-ticketing-visual" delay={110}>
              <img src={venue.heroImage} alt="" loading="lazy" aria-hidden="true" />
              <span className="venue-ticketing-visual__curtain" aria-hidden="true" />
              <div>
                <Ticket aria-hidden="true" size={18} />
                <span>Acceso sujeto a disponibilidad.</span>
                <strong>{venue.venue} · Levitate MX</strong>
              </div>
            </MotionReveal>
          </div>
        </section>
      </main>
      <LevitateFooter useRootLinks />
    </>
  );
}

function AwardIcon() {
  return <ArrowRight aria-hidden="true" size={19} />;
}
