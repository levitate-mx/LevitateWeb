import { ArrowRight, ArrowUpRight, CalendarDays, CheckCircle2, Clock3, MapPin } from "lucide-react";
import { useEffect } from "react";
import { assets } from "../../data/homeContent";
import { LevitateFooter } from "../home/LevitateFooter";
import { LevitateHeader } from "../home/LevitateHeader";

type CompetitionBlockDay = {
  date: string;
  items: Array<{ title: string; text: string }>;
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

type JuryMember = {
  name: string;
  specialty: string;
  image: string;
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
  jury: JuryMember[];
};

const defaultMotionGenres = ["Acrojazz", "Ballet", "Belly Dance", "Contemporáneo", "Folklore", "Urbanos", "Jazz", "Lírico", "Open"];
const defaultAerialGenres = ["Tela", "Aro", "Open"];

const sedesContent: Record<"cdmx" | "puebla" | "edomex", SedeContent> = {
  cdmx: {
    heroTitle: "CDMX",
    eventName: "CAO Tiempo Nuevo",
    venueName: "CAO Tiempo Nuevo",
    heroImage: "/assets/sedes-cdmx-hero.png",
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
    heroImage: "/assets/sedes-puebla-hero.png",
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
      { name: "Daniel Montalvo", specialty: "Creador escénico", image: "/assets/daniel-montalvo.png" },
      { name: "Luis Raio", specialty: "Especialista en aéreos · Aerial straps", image: "/assets/luis-raio.png" },
    ],
  },
  edomex: {
    heroTitle: "Estado de México",
    eventName: "Teatro El Gran Recinto",
    venueName: "Teatro El Gran Recinto",
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
    jury: [
      { name: "Daniel Herrera", specialty: "Acrobacias aéreas · Técnica de piso", image: "/assets/daniel-herrera.jpg" },
      { name: "Vladimir Garza", specialty: "Técnicas aéreas circenses", image: "/assets/vladimir-garza.jpg" },
      { name: "Pendiente", specialty: "Juez por confirmar", image: assets.community },
      { name: "Daniel Montalvo", specialty: "Creador escénico", image: "/assets/daniel-montalvo.png" },
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

type SedesPageProps = {
  venueKey?: keyof typeof sedesContent;
};

export function SedesPage({ venueKey = "cdmx" }: SedesPageProps) {
  const venue = sedesContent[venueKey] ?? sedesContent.cdmx;
  const juryLineup = buildJuryLineup(venue.jury);

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
      </div>

      {venue.workshops ? (
        <section className="sedes-workshops">
          <div className="sedes-workshops__intro">
            <p className="sedes-kicker">Workshops</p>
            <h2>{venue.workshops.title}</h2>
            <span><MapPin aria-hidden="true" size={17} /> {venue.workshops.location}</span>

            <div className="sedes-workshop-groups">
              {venue.workshops.groups.map((group) => (
                <article key={group.label}>
                  <span>{group.label}</span>
                  <p>{group.text}</p>
                </article>
              ))}
            </div>
            <small>{venue.workshops.footnote}</small>
          </div>

          <div className="sedes-workshop-grid">
            {venue.workshops.coaches.map((workshop) => (
              <article className="sedes-workshop-card" key={workshop.name}>
                <div className="sedes-workshop-card__head">
                  <div>
                    <h3>{workshop.name}</h3>
                    {workshop.specialty ? <strong>{workshop.specialty}</strong> : null}
                  </div>
                </div>
                <ul>
                  {workshop.sessions.map((session) => (
                    <li
                      className={session.label ? "sedes-workshop-card__session sedes-workshop-card__session--tagged" : "sedes-workshop-card__session"}
                      key={`${workshop.name}-${session.time}-${session.group}`}
                    >
                      {session.label ? <span className="sedes-workshop-card__tag">{session.label}</span> : null}
                      <span className="sedes-workshop-card__clock"><Clock3 aria-hidden="true" size={24} /></span>
                      <span className="sedes-workshop-card__session-copy">
                        <span className="sedes-workshop-card__time">{session.time}</span>
                        <span className="sedes-workshop-card__group">{session.group}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="sedes-light-section sedes-jury">
        <div className="sedes-jury__header">
          <SectionHeading kicker="LINEUP" title="Panel de Jurados" />
          <p>Conoce al panel de artistas y profesionales que formarán parte de esta sede.</p>
        </div>
        <div className="sedes-jury-grid sedes-jury-grid--six">
          {juryLineup.map((judge, index) => (
            <article className="sedes-jury-card" key={`${judge.name}-${index}`}>
              <img src={judge.image} alt="" aria-hidden="true" />
              <h3>{judge.name}</h3>
              <p>{judge.specialty}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="sedes-final-cta">
        <img
          className="sedes-final-cta__background"
          src={venue.heroImage}
          alt=""
          loading="lazy"
          aria-hidden="true"
        />
        <div className="sedes-final-cta__content">
          <p>Siguiente paso</p>
          <span>{venue.venueName}</span>
          <h2>Asegura tu lugar.</h2>
          <a href="/inscripciones">
            Inscribirme <ArrowRight aria-hidden="true" size={18} />
          </a>
        </div>
      </section>

      <LevitateFooter useRootLinks />
    </main>
  );
}
