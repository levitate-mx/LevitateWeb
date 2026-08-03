import { ArrowRight, ArrowUpRight, CalendarDays, CheckCircle2, MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { assets } from "../../data/homeContent";
import { LevitateFooter } from "../home/LevitateFooter";
import { LevitateHeader } from "../home/LevitateHeader";

type CompetitionModality = "motion" | "aerial";

type CompetitionBlockItem = {
  title: string;
  text: string;
  modality?: CompetitionModality;
};

type CompetitionBlockGroup = {
  modality?: CompetitionModality;
  items: CompetitionBlockItem[];
};

type CompetitionBlockDay = {
  date: string;
  items: CompetitionBlockItem[];
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
  motionImage?: string;
  aerialImage?: string;
  location: string;
  mapsUrl: string;
  date: string;
  metaLabel: string;
  metaValue: string;
  motionGenres: string[];
  aerialGenres: string[];
  competitionBlocks: CompetitionBlockDay[];
  workshops?: {
    title: string;
    location: string;
    groups: Array<{ label: string; text: string }>;
    footnote: string;
    coaches: WorkshopCoach[];
  };
  hotel?: HotelFeature;
  jury: JuryMember[];
};

const defaultMotionGenres = ["Acrojazz", "Ballet", "Belly Dance", "Contemporáneo", "Folklore", "Urbanos", "Jazz", "Lírico", "Open"];
const defaultAerialGenres = ["Tela", "Aro", "Open"];
const competitionModalityLabels: Record<CompetitionModality, string> = {
  motion: "Levitate Motion",
  aerial: "Levitate Aerial",
};
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

const sedesContent: Record<"cdmx" | "puebla" | "edomex", SedeContent> = {
  cdmx: {
    heroTitle: "CDMX",
    eventName: "CAO Tiempo Nuevo",
    venueName: "CAO Tiempo Nuevo",
    heroImage: "/assets/sedes-cdmx-hero.jpg",
    motionImage: "/assets/sedes-cdmx-motion.jpg",
    aerialImage: "/assets/sedes-cdmx-aerial.jpg",
    location: "Miguel Hidalgo, Tlalpan",
    mapsUrl: "https://share.google/gU1NBVUQocefpnxPP",
    date: "29 · 30 · 31\nmayo 2026",
    metaLabel: "Status",
    metaValue: "Convocatoria\nfinalizada",
    motionGenres: defaultMotionGenres,
    aerialGenres: defaultAerialGenres,
    competitionBlocks: [
      { date: "30 de mayo", items: [
        { title: "Bloque 1", text: "Baby · Aéreo\nPetite · Aro · Open\nJunior · Tela" },
        { title: "Bloque 2", text: "Petite · Tela" },
        { title: "Bloque 3", text: "Junior · Tela" },
      ] },
      { date: "31 de mayo", items: [
        { title: "Bloque 4", text: "Danza\nno aérea" },
        { title: "Bloque 5", text: "Teens\nLegacy" },
        { title: "Bloque 6", text: "Senior" },
      ] },
    ],
    workshops: {
      title: "Viernes 29 de mayo",
      location: "CAO Tiempo Nuevo, Miguel Hidalgo, Tlalpan",
      groups: [
        { label: "Grupo A", text: "Menores de 12 años\nDanza aérea" },
        { label: "Grupo B", text: "Mayores de 13 años\nDanza aérea" },
        { label: "Grupo C", text: "Flex" },
      ],
      footnote: "*Cada participante podrá tomar 3 clases.",
      coaches: [
        {
          name: "Alex Nájera",
          specialty: "Telas",
          sessions: [
            { time: "10:00 AM - 11:30 AM", group: "Grupo A" },
            { time: "11:45 AM - 1:15 PM", group: "Grupo B" },
          ],
        },
        {
          name: "Vladimir Garza",
          sessions: [
            { label: "Aro", time: "11:45 AM - 1:15 PM", group: "Grupo A" },
            { label: "Trapecio", time: "10:00 AM - 11:30 AM", group: "Grupo B" },
          ],
        },
        {
          name: "Luis Raio",
          specialty: "Cintas",
          sessions: [
            { time: "2:00 PM - 4:00 PM", group: "Grupo B" },
          ],
        },
        {
          name: "Yoli Campos",
          specialty: "Flex",
          sessions: [
            { time: "2:00 PM - 4:00 PM", group: "Grupo A" },
            { time: "2:00 PM - 4:00 PM", group: "Grupo B" },
          ],
        },
      ],
    },
    jury: [
      { name: "Daniel Herrera", specialty: "Acrobacias aéreas · Técnica de piso", image: "/assets/daniel-herrera.jpg" },
      { name: "Alex Nájera", specialty: "Artista circense", image: "/assets/alex-najera.jpg" },
      { name: "Vladimir Garza", specialty: "Técnicas aéreas circenses", image: "/assets/vladimir-garza.jpg" },
      { name: "Yoli Campos", specialty: "Artista circense · Danza escénica", image: "/assets/yoli-campos.jpg" },
      { name: "Ángela Kryuff", specialty: "Maestra de danza · Técnica y composición escénica", image: "/assets/angela-kryuff.jpg" },
    ],
  },
  puebla: {
    heroTitle: "Puebla",
    eventName: "Auditorio Daniel Forcelledo",
    venueName: "Auditorio Daniel Forcelledo",
    heroImage: "/assets/sedes-puebla-hero.jpg",
    motionImage: "/assets/sedes-cdmx-motion.jpg",
    aerialImage: "/assets/sedes-cdmx-aerial.jpg",
    location: "Tlatempa, San Pedro Cholula",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Auditorio%20Daniel%20Forcelledo%20Puebla",
    date: "7 junio 2026",
    metaLabel: "Status",
    metaValue: "Inscripciones abiertas",
    motionGenres: defaultMotionGenres,
    aerialGenres: defaultAerialGenres,
    competitionBlocks: [
      { date: "7 de junio", items: [
        { title: "Bloque 1", text: "Baby y Petite - Motion" },
        { title: "Bloque 2", text: "Junior, Teen y Senior - Motion" },
        { title: "Bloque 3", text: "Baby y Petite - Aerial" },
        { title: "Bloque 4", text: "Junior, Teen y Senior - Aerial" },
      ] },
    ],
    jury: [
      { name: "Daniel Herrera", specialty: "Acrobacias aéreas · Técnica de piso", image: "/assets/daniel-herrera.jpg" },
      { name: "Yoli Campos", specialty: "Artista circense · Danza escénica", image: "/assets/yoli-campos.jpg" },
      { name: "Daniel Montalvo", specialty: "Creador escénico", image: "/assets/daniel-montalvo.jpg" },
      { name: "Luis Raio", specialty: "Especialista en aéreos · Aerial straps", image: "/assets/luis-raio.jpg" },
    ],
  },
  edomex: {
    heroTitle: "Estado de México",
    eventName: "Teatro Gran Recinto",
    venueName: "Teatro Gran Recinto",
    heroImage: "/assets/sedes-edomex-hero.jpg",
    motionImage: "/assets/sedes-cdmx-motion.jpg",
    aerialImage: "/assets/sedes-cdmx-aerial.jpg",
    location: "Tlalnepantla, Edo. Méx.",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Teatro%20El%20Gran%20Recinto%20Tlalnepantla%20Estado%20de%20Mexico",
    date: "13 · 14 · 15\nnoviembre 2026",
    metaLabel: "Status",
    metaValue: "Convocatoria próxima",
    motionGenres: defaultMotionGenres,
    aerialGenres: defaultAerialGenres,
    competitionBlocks: [
      { date: "14 de noviembre 2026", items: [
        { title: "Bloque 1", text: "Baby + Petite", modality: "motion" },
        { title: "Bloque 2", text: "Junior + Teen", modality: "motion" },
        { title: "Bloque 3", text: "Senior + Legacy + Relevé", modality: "motion" },
        { title: "Bloque 4", text: "Baby + Petite", modality: "aerial" },
      ] },
      { date: "15 de noviembre 2026", items: [
        { title: "Bloque 5", text: "Junior", modality: "aerial" },
        { title: "Bloque 6", text: "Teen + Legacy", modality: "aerial" },
        { title: "Bloque 7", text: "Seniors + Relevé", modality: "aerial" },
      ] },
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

function buildCompetitionBlockGroups(items: CompetitionBlockItem[]) {
  return items.reduce<CompetitionBlockGroup[]>((groups, item) => {
    const activeGroup = groups.at(-1);

    if (activeGroup && activeGroup.modality === item.modality) {
      activeGroup.items.push(item);
      return groups;
    }

    groups.push({ modality: item.modality, items: [item] });
    return groups;
  }, []);
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
  const juryLineup = buildJuryLineup(venue.jury);
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
              <a className="sedes-button sedes-button--primary" href="/inscripciones">
                Inscribirme <ArrowRight aria-hidden="true" size={18} />
              </a>
              <a className="sedes-button sedes-button--ghost" href="#convocatoria-sede">
                Descargar convocatoria <ArrowRight aria-hidden="true" size={18} />
              </a>
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

        <section className="sedes-light-section sedes-blocks">
          <SectionHeading kicker="Cronograma" title="Bloques de competencia." />
          <div className={`sedes-block-columns${venue.competitionBlocks.length === 1 ? " sedes-block-columns--single" : ""}`}>
            {venue.competitionBlocks.map((day) => (
              <article className="sedes-block-day" key={day.date}>
                <h3>{day.date}</h3>
                <div className="sedes-block-day__groups">
                  {buildCompetitionBlockGroups(day.items).map((group, groupIndex) => (
                    <div
                      className={`sedes-block-group${group.modality ? ` sedes-block-group--${group.modality}` : " sedes-block-group--plain"}`}
                      key={`${day.date}-${group.modality ?? "general"}-${groupIndex}`}
                    >
                      {group.modality ? (
                        <span className="sedes-block-group__label" aria-label={`Modalidad ${competitionModalityLabels[group.modality]}`} />
                      ) : null}
                      <div className="sedes-block-group__items">
                        {group.items.map((item) => (
                          <article key={item.title}>
                            <h4>{item.title}</h4>
                            <p>{renderBlockText(item.text)}</p>
                          </article>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
          <p className="sedes-note">*Horarios a definir. La logística puede cambiar.</p>
        </section>
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
            <p>Siguiente paso</p>
            <h2>Asegura tu lugar.</h2>
            <a href="/inscripciones">
              Inscribirme <ArrowRight aria-hidden="true" size={18} />
            </a>
          </div>
        </section>
      )}

      <LevitateFooter useRootLinks />
    </main>
  );
}
