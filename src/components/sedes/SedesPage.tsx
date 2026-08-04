import { ArrowRight, ArrowUpRight, CalendarDays, CheckCircle2, MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { assets } from "../../data/homeContent";
import { LevitateFooter } from "../home/LevitateFooter";
import { LevitateHeader } from "../home/LevitateHeader";

type CompetitionBlockDay = {
  date: string;
  items: Array<{ title: string; text: string }>;
};

type CompetitionBlockLegendItem = {
  range: string;
  label: string;
  tone: "motion" | "aerial";
};

type WorkshopSession = {
  label?: string;
  time: string;
  group: string;
};

type WorkshopCoach = {
  name: string;
  specialty?: string;
  sessions: WorkshopSession[];
};

type WorkshopTableRow = WorkshopSession & {
  className: string;
  coachName: string;
  sortValue: number;
};

type JuryMember = {
  name: string;
  specialty: string;
  image: string;
};

type HotelFeature = {
  name: string;
  image: string;
  title: string;
  copy: string;
  distance: string;
};

type SedeContent = {
  heroTitle: string;
  eventName: string;
  venueName: string;
  heroImage: string;
  location: string;
  mapsUrl: string;
  date: string;
  metaLabel: string;
  metaValue: string;
  motionGenres: string[];
  aerialGenres: string[];
  competitionBlocks?: CompetitionBlockDay[];
  competitionBlockLegend?: CompetitionBlockLegendItem[];
  workshops?: {
    title: string;
    location: string;
    groups: Array<{ label: string; text: string }>;
    footnote: string;
    coaches: WorkshopCoach[];
  };
  hotel?: HotelFeature;
  jury?: JuryMember[];
};

const defaultMotionGenres = ["Acrojazz", "Ballet", "Belly Dance", "Contemporáneo", "Folklore", "Urbanos", "Jazz", "Lírico", "Open"];
const defaultAerialGenres = ["Tela", "Aro", "Open"];
const convocatoriaPdfHref = "/assets/convocatoria-nacional-otono-2026.pdf";
const hotelDocumentDownloads = [
  {
    fileName: "Hotel_Levitate2026.pdf",
    href: "/assets/hotel-levitate-2026.pdf",
  },
];

function downloadHotelDocuments() {
  hotelDocumentDownloads.forEach((documentDownload, index) => {
    window.setTimeout(() => {
      const link = document.createElement("a");
      link.href = documentDownload.href;
      link.download = documentDownload.fileName;
      document.body.append(link);
      link.click();
      link.remove();
    }, index * 120);
  });
}

const sedesContent: Record<"edomex" | "veracruz", SedeContent> = {
  edomex: {
    heroTitle: "Estado de México",
    eventName: "Teatro Gran Recinto",
    venueName: "Teatro Gran Recinto",
    heroImage: "/assets/sedes-edomex-hero.jpg",
    location: "Tlalnepantla, Edo. Méx.",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Teatro%20El%20Gran%20Recinto%20Tlalnepantla%20Estado%20de%20Mexico",
    date: "13 · 14 · 15\nnoviembre 2026",
    metaLabel: "Status",
    metaValue: "Inscripciones abiertas",
    motionGenres: defaultMotionGenres,
    aerialGenres: defaultAerialGenres,
    competitionBlocks: [
      { date: "14 de noviembre 2026", items: [
        { title: "Bloque 1", text: "Baby + Petite" },
        { title: "Bloque 2", text: "Junior + Teen" },
        { title: "Bloque 3", text: "Senior + Legacy + Relevé" },
        { title: "Bloque 4", text: "Baby + Petite" },
      ] },
      { date: "15 de noviembre 2026", items: [
        { title: "Bloque 5", text: "Junior" },
        { title: "Bloque 6", text: "Teen + Legacy" },
        { title: "Bloque 7", text: "Seniors + Relevé" },
      ] },
    ],
    competitionBlockLegend: [
      { range: "Bloques 1-3", label: "Motion", tone: "motion" },
      { range: "Bloques 4-7", label: "Aerial", tone: "aerial" },
    ],
    workshops: {
      title: "Viernes 13 de noviembre",
      location: "Motion: City Express Plus Mundo E by Marriott\nAerial: sede por confirmar",
      groups: [
        { label: "Grupo A", text: "Aerial\nHasta 12 años" },
        { label: "Grupo B", text: "Aerial\nMayores de 12 años" },
        { label: "Grupo C", text: "Motion\nHasta 12 años" },
        { label: "Grupo D", text: "Motion\nMayores de 12 años" },
      ],
      footnote: "*La inscripción incluye acceso a 3 workshops de la elección del participante.",
      coaches: [
        {
          name: "Ana Karen Rojas",
          specialty: "Flex",
          sessions: [
            { label: "Todos los grupos", time: "10:00 AM - 11:30 AM", group: "Flex" },
          ],
        },
        {
          name: "Vladimir Garza",
          specialty: "Aerial",
          sessions: [
            { label: "Aro", time: "12:00 PM - 1:30 PM", group: "Grupo A · Hasta 12 años" },
            { label: "Trapecio", time: "10:00 AM - 11:30 AM", group: "Grupo B · Mayores de 12 años" },
          ],
        },
        {
          name: "Daniel Herrera",
          specialty: "Aerial",
          sessions: [
            { label: "Tela", time: "2:30 PM - 4:30 PM", group: "Grupo A · Hasta 12 años" },
            { label: "Cuna", time: "12:00 PM - 2:00 PM", group: "Grupo B · Mayores de 12 años" },
          ],
        },
        {
          name: "Jorge Díaz",
          specialty: "Motion",
          sessions: [
            { label: "Comedia musical", time: "12:00 PM - 2:00 PM", group: "Grupo C · Hasta 12 años" },
            { label: "Comedia musical", time: "10:00 AM - 11:30 AM", group: "Grupo D · Mayores de 12 años" },
          ],
        },
        {
          name: "Daniel Montalvo",
          specialty: "Motion",
          sessions: [
            { label: "Contemporary Jazz", time: "2:30 PM - 4:30 PM", group: "Grupo C · Hasta 12 años" },
            { label: "Contemporary Jazz", time: "12:00 PM - 2:00 PM", group: "Grupo D · Mayores de 12 años" },
          ],
        },
        {
          name: "Pablo Emmanuel",
          specialty: "Motion",
          sessions: [
            { label: "Urbanos", time: "2:30 PM - 4:30 PM", group: "Grupo D · Mayores de 12 años" },
          ],
        },
      ],
    },
    hotel: {
      name: "City Express Plus Mundo E by Marriott",
      image: "/assets/hotel-city-express-mundo-e.png",
      title: "Quédate cerca del escenario.",
      copy: "Nuestro hotel sede para Edo Méx está pensado para quienes viajan con su academia, familia o equipo y quieren moverse fácil durante el evento.",
      distance: "A unos minutos del Teatro Gran Recinto.",
    },
    jury: [
      { name: "Daniel Herrera", specialty: "Acrobacias aéreas · Técnica de piso", image: "/assets/daniel-herrera.jpg" },
      { name: "Vladimir Garza", specialty: "Técnicas aéreas circenses", image: "/assets/vladimir-garza.jpg" },
      { name: "Ana Karen Rojas", specialty: "Artista Circense", image: "/assets/ana-karen-rojas.jpg" },
      { name: "Daniel Montalvo", specialty: "Creador escénico", image: "/assets/daniel-montalvo.jpg" },
      { name: "Ivonne Robles", specialty: "Maestra de danza clásica y neoclásica", image: "/assets/ivonne-robles.jpg" },
      { name: "Pablo Emmanuel", specialty: "Performance urbano", image: "/assets/pablo-emmanuel.jpg" },
    ],
  },
  veracruz: {
    heroTitle: "Veracruz",
    eventName: "Primavera 2027",
    venueName: "Sede por confirmar",
    heroImage: "/assets/sedes-veracruz-primavera-2027.png",
    location: "Veracruz",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Veracruz%20Mexico",
    date: "Primavera\n2027",
    metaLabel: "Status",
    metaValue: "Próximamente",
    motionGenres: defaultMotionGenres,
    aerialGenres: defaultAerialGenres,
  },
};

function SectionHeading({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="sedes-section-heading">
      <p>{kicker}</p>
      <h2>{title}</h2>
    </div>
  );
}

function renderBlockText(text: string) {
  const highlightedTerms = new Set(["baby", "junior", "legacy", "petite", "relevé", "senior", "seniors", "teen", "teens"]);
  const renderLevels = (line: string) => line.split(/\b(Baby|Junior|Legacy|Petite|Relevé|Senior|Seniors|Teen|Teens)\b/gi).map((part, index) => (
    highlightedTerms.has(part.toLowerCase())
      ? <span className="sedes-block-level" key={`${part}-${index}`}>{part}</span>
      : part
  ));

  return text.split("\n").map((line, lineIndex) => {
    const modalityMatch = line.match(/^(.*?)\s+-\s+(Motion|Aerial)$/i);

    return (
      <span className="sedes-block-line" key={`${line}-${lineIndex}`}>
        {modalityMatch ? (
          <>
            {renderLevels(modalityMatch[1])}
            <span className="sedes-block-modality">{modalityMatch[2]}</span>
          </>
        ) : renderLevels(line)}
      </span>
    );
  });
}

function buildJuryLineup(jury: JuryMember[]) {
  const lineup = jury.slice(0, 6);

  while (lineup.length < 6) {
    lineup.push({
      name: "Jurado por confirmar",
      specialty: "Panel Levitate",
      image: assets.community,
    });
  }

  return lineup;
}

function getWorkshopStartMinutes(time: string) {
  const [start = ""] = time.split("-");
  const match = start.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);

  if (!match) {
    return Number.POSITIVE_INFINITY;
  }

  const [, hourValue, minuteValue, periodValue] = match;
  const period = periodValue.toUpperCase();
  const hour = Number(hourValue);
  const minute = Number(minuteValue);
  const normalizedHour = period === "PM" && hour !== 12 ? hour + 12 : period === "AM" && hour === 12 ? 0 : hour;

  return normalizedHour * 60 + minute;
}

function getWorkshopGroupLabel(group: string) {
  return group.split("·")[0]?.trim() || group;
}

function buildWorkshopRows(workshops: NonNullable<SedeContent["workshops"]>) {
  return workshops.coaches
    .flatMap((coach) =>
      coach.sessions.map((session) => {
        const labelIsGroup = session.label?.toLowerCase().includes("grupo");

        return {
          ...session,
          coachName: coach.name,
          className: labelIsGroup ? session.group : session.label ?? coach.specialty ?? "Workshop",
          group: labelIsGroup ? session.label ?? session.group : getWorkshopGroupLabel(session.group),
          sortValue: getWorkshopStartMinutes(session.time),
        };
      }),
    )
    .sort((left, right) => left.sortValue - right.sortValue);
}

function buildWorkshopTimeGroups(workshops: NonNullable<SedeContent["workshops"]>) {
  const rows = buildWorkshopRows(workshops);
  const groups: Array<{ time: string; rows: WorkshopTableRow[] }> = [];

  rows.forEach((row) => {
    const group = groups.find((item) => item.time === row.time);

    if (group) {
      group.rows.push(row);
      return;
    }

    groups.push({ time: row.time, rows: [row] });
  });

  return groups;
}

type SedesPageProps = {
  venueKey?: keyof typeof sedesContent;
};

export function SedesPage({ venueKey = "edomex" }: SedesPageProps) {
  const venue = sedesContent[venueKey] ?? sedesContent.edomex;
  const hasCompetitionBlocks = Boolean(venue.competitionBlocks?.length);
  const hasPublishedConvocation = venueKey === "edomex";
  const juryLineup = venue.jury?.length ? buildJuryLineup(venue.jury) : [];
  const workshopTimeGroups = venue.workshops ? buildWorkshopTimeGroups(venue.workshops) : [];
  const [activeJudgeIndex, setActiveJudgeIndex] = useState(0);
  const juryScrollRegionRef = useRef<HTMLDivElement | null>(null);
  const juryStepRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    setActiveJudgeIndex(0);
  }, [venueKey]);

  useEffect(() => {
    let animationFrame = 0;

    const syncActiveJudge = () => {
      const region = juryScrollRegionRef.current;
      const nodes = juryStepRefs.current.slice(0, juryLineup.length).filter((node): node is HTMLButtonElement => Boolean(node));

      if (!region || !nodes.length) {
        return;
      }

      const regionBox = region.getBoundingClientRect();

      if (regionBox.bottom < 0 || regionBox.top > window.innerHeight) {
        return;
      }

      const targetY = window.innerHeight * 0.5;
      let closestIndex = 0;
      let closestDistance = Number.POSITIVE_INFINITY;

      nodes.forEach((node) => {
        const nodeIndex = Number(node.dataset.juryIndex);

        if (Number.isNaN(nodeIndex)) {
          return;
        }

        const nodeBox = node.getBoundingClientRect();
        const nodeCenter = nodeBox.top + nodeBox.height / 2;
        const distance = Math.abs(nodeCenter - targetY);

        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = nodeIndex;
        }
      });

      setActiveJudgeIndex((currentIndex) => (currentIndex === closestIndex ? currentIndex : closestIndex));
    };

    const scheduleSync = () => {
      if (animationFrame) {
        return;
      }

      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = 0;
        syncActiveJudge();
      });
    };

    scheduleSync();
    window.addEventListener("scroll", scheduleSync, { passive: true });
    window.addEventListener("resize", scheduleSync);

    return () => {
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
      }

      window.removeEventListener("scroll", scheduleSync);
      window.removeEventListener("resize", scheduleSync);
    };
  }, [juryLineup.length, venueKey]);

  useEffect(() => {
    const choice = document.querySelector<HTMLElement>("[data-sedes-modality-choice]");

    if (!choice) {
      return;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    if (reducedMotion.matches) {
      choice.classList.add("is-choice-visible");
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          choice.classList.add("is-choice-visible");
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -22% 0px", threshold: 0.34 },
    );

    observer.observe(choice);
    return () => observer.disconnect();
  }, []);

  return (
    <main className="sedes-page">
      <section className="sedes-hero">
        <LevitateHeader activeLabel="Convocatoria" useRootLinks variant="pill" />
        <img className={`sedes-hero__image sedes-hero__image--${venueKey}`} src={venue.heroImage} alt="" aria-hidden="true" />
        <div className="sedes-hero__shade" aria-hidden="true" />

        <div className="sedes-hero__content">
          <div className="sedes-hero__headline">
            <p className="sedes-kicker">Convocatoria nacional</p>
            <h1>{venue.heroTitle}</h1>
            <strong>{venue.eventName}</strong>
            <div className="sedes-hero__actions">
              {hasPublishedConvocation ? (
                <>
                  <a className="sedes-button sedes-button--primary" href="/inscripciones">
                    Inscribirme <ArrowRight aria-hidden="true" size={18} />
                  </a>
                  <a
                    className="sedes-button sedes-button--ghost"
                    download="Convocatoria_Nacional_Otono_2026.pdf"
                    href={convocatoriaPdfHref}
                  >
                    Descargar convocatoria <ArrowRight aria-hidden="true" size={18} />
                  </a>
                </>
              ) : (
                <span className="sedes-button sedes-button--primary sedes-button--disabled">
                  Próximamente
                </span>
              )}
            </div>
          </div>

          <div className="sedes-event-info" aria-label="Información principal de la sede">
            <article>
              <MapPin aria-hidden="true" size={24} />
              <span>Lugar</span>
              <p>{venue.location}</p>
              <a href={venue.mapsUrl} target="_blank" rel="noreferrer">
                Ver en Google Maps <ArrowUpRight aria-hidden="true" size={15} />
              </a>
            </article>
            <article>
              <CalendarDays aria-hidden="true" size={24} />
              <span>Fecha del evento</span>
              <p>{venue.date}</p>
            </article>
            <article>
              <CheckCircle2 aria-hidden="true" size={24} />
              <span>{venue.metaLabel}</span>
              <p>{venue.metaValue}</p>
            </article>
          </div>
        </div>
      </section>

      <div className="sedes-light-flow" id="convocatoria-sede">
        <section className="sedes-light-section sedes-genres sedes-modalities">
          <div className="sedes-modality-choice" data-sedes-modality-choice>
            <a
              className="sedes-modality-choice__brand sedes-modality-choice__brand--motion"
              href="/modalidades/levitate-motion/generos"
              aria-label="Ver Levitate Motion"
            >
              <img src="/assets/levitate-motion-logo.png" alt="Levitate Motion" />
            </a>

            <div className="sedes-modality-choice__center">
              <p className="sedes-kicker">Modalidades</p>
              <h2>Elige tu forma de competir.</h2>
            </div>

            <a
              className="sedes-modality-choice__brand sedes-modality-choice__brand--aerial"
              href="/modalidades/levitate-aerial/evaluacion"
              aria-label="Ver Levitate Aerial"
            >
              <img src="/assets/levitate-aerial-logo.png" alt="Levitate Aerial" />
            </a>
          </div>
        </section>

        {hasCompetitionBlocks ? (
          <section className="sedes-light-section sedes-blocks">
            <SectionHeading kicker="Cronograma" title="Bloques de competencia." />
            {venue.competitionBlockLegend ? (
              <div className="sedes-block-legend" aria-label="Distribución de modalidades por bloque">
                {venue.competitionBlockLegend.map((item) => (
                  <article className={`sedes-block-legend__item sedes-block-legend__item--${item.tone}`} key={item.range}>
                    <span>{item.range}</span>
                    <strong>{item.label}</strong>
                  </article>
                ))}
              </div>
            ) : null}
            <div className={`sedes-block-columns${venue.competitionBlocks?.length === 1 ? " sedes-block-columns--single" : ""}`}>
              {venue.competitionBlocks?.map((day) => (
                <article className="sedes-block-day" key={day.date}>
                  <h3>{day.date}</h3>
                  <div>
                    {day.items.map((item) => (
                      <article key={item.title}>
                        <h4>{item.title}</h4>
                        <p>{renderBlockText(item.text)}</p>
                      </article>
                    ))}
                  </div>
                </article>
              ))}
            </div>
            <p className="sedes-note">*Horarios a definir. La logística puede cambiar.</p>
          </section>
        ) : null}
      </div>

      {venue.workshops ? (
        <section className="sedes-workshops">
          <div className="sedes-workshops__intro">
            <h2>Workshops.</h2>
            <div className="sedes-workshops__meta">
              <span><CalendarDays aria-hidden="true" size={17} /> {venue.workshops.title}</span>
              <span><MapPin aria-hidden="true" size={17} /> {venue.workshops.location}</span>
            </div>

            <div className="sedes-workshop-groups">
              {venue.workshops.groups.map((group) => {
                const [modality, ...details] = group.text.split("\n");

                return (
                  <article key={group.label}>
                    <span className="sedes-workshop-groups__label">{group.label}</span>
                    <p>
                      <span className="sedes-workshop-groups__modality">{modality}</span>
                      {details.length ? (
                        <>
                          <br />
                          {details.join(" ")}
                        </>
                      ) : null}
                    </p>
                  </article>
                );
              })}
            </div>
            <small>{venue.workshops.footnote}</small>
          </div>

          <div className="sedes-workshop-agenda">
            <div className="sedes-workshop-agenda__head" aria-hidden="true">
              <span>Hora</span>
              <span>Grupo</span>
              <span>Clase</span>
              <span>Ponente</span>
            </div>
            {workshopTimeGroups.map((slot) => (
              <article className="sedes-workshop-slot" key={slot.time}>
                <time>{slot.time}</time>
                <div className="sedes-workshop-slot__sessions">
                  {slot.rows.map((session) => (
                    <div
                      className="sedes-workshop-slot__session"
                      key={`${session.time}-${session.group}-${session.className}-${session.coachName}`}
                    >
                      <span className="sedes-workshop-slot__group" data-label="Grupo">{session.group}</span>
                      <span className="sedes-workshop-slot__class" data-label="Clase">{session.className}</span>
                      <span className="sedes-workshop-slot__speaker" data-label="Ponente">{session.coachName}</span>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {juryLineup.length ? (
        <section className="sedes-light-section sedes-jury">
          <div className="sedes-jury__header">
            <SectionHeading kicker="LINEUP" title="Panel de Jurados." />
          </div>
          <div className="sedes-jury-sticky" ref={juryScrollRegionRef}>
            <div className="sedes-jury-sticky__visual" aria-hidden="true">
              {juryLineup.map((judge, index) => (
                <figure className={index === activeJudgeIndex ? "is-active" : ""} key={`${judge.name}-visual-${index}`}>
                  <img src={judge.image} alt="" loading={index === 0 ? "eager" : "lazy"} />
                  <figcaption>
                    <strong>{judge.name}</strong>
                  </figcaption>
                </figure>
              ))}
            </div>

            <div className="sedes-jury-sticky__list">
              {juryLineup.map((judge, index) => (
                <button
                  className={`sedes-jury-step${index === activeJudgeIndex ? " is-active" : ""}`}
                  data-jury-index={index}
                  key={`${judge.name}-${index}`}
                  aria-pressed={index === activeJudgeIndex}
                  onClick={() => setActiveJudgeIndex(index)}
                  onFocus={() => setActiveJudgeIndex(index)}
                  onMouseEnter={() => setActiveJudgeIndex(index)}
                  ref={(node) => {
                    juryStepRefs.current[index] = node;
                  }}
                  type="button"
                >
                  <span className="sedes-jury-step__copy">
                    <span>{judge.name}</span>
                    <small>{judge.specialty}</small>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {venue.hotel ? (
        <section className="sedes-hotel-cta" id="hotel-sede">
          <div className="sedes-hotel-cta__content">
            <p>Hotel sede</p>
            <h2>{venue.hotel.title}</h2>
            <strong>{venue.hotel.name}</strong>
            <span>{venue.hotel.copy}</span>
            <small>{venue.hotel.distance}</small>
            <button onClick={downloadHotelDocuments} type="button">
              Ver hospedaje <ArrowRight aria-hidden="true" size={18} />
            </button>
          </div>
          <figure className="sedes-hotel-cta__media">
            <img src={venue.hotel.image} alt={venue.hotel.name} loading="lazy" />
          </figure>
        </section>
      ) : (
        <section className="sedes-final-cta">
          <img
            className="sedes-final-cta__background"
            src="/assets/sedes-final-cta-minimal-bg.jpg"
            alt=""
            loading="lazy"
            aria-hidden="true"
          />
          <div className="sedes-final-cta__content">
            <p>{hasPublishedConvocation ? "Siguiente paso" : "Próxima sede"}</p>
            <h2>{hasPublishedConvocation ? "Asegura tu lugar." : "Veracruz está en camino."}</h2>
            {hasPublishedConvocation ? (
              <a href="/inscripciones">
                Inscribirme <ArrowRight aria-hidden="true" size={18} />
              </a>
            ) : (
              <span>Muy pronto compartiremos convocatoria y fechas finales.</span>
            )}
          </div>
        </section>
      )}

      <LevitateFooter useRootLinks />
    </main>
  );
}
