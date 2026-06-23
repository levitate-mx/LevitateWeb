import { ArrowUpRight, CalendarDays, CheckCircle2, Clock3, MapPin } from "lucide-react";
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

const sedesContent: Record<"cdmx" | "puebla" | "edomex", SedeContent> = {
  cdmx: {
    heroTitle: "Sede CDMX",
    eventName: "CAO Tiempo Nuevo",
    venueName: "CAO Tiempo Nuevo",
    heroImage: assets.venue,
    motionImage: "/assets/sedes-cdmx-motion.jpg",
    aerialImage: "/assets/sedes-cdmx-aerial.jpg",
    location: "Miguel Hidalgo, Tlalpan",
    mapsUrl: "https://share.google/gU1NBVUQocefpnxPP",
    date: "29 · 30 · 31\nmayo 2026",
    metaLabel: "Status",
    metaValue: "Convocatoria\nfinalizada",
    motionGenres: ["Acrojazz", "Ballet", "Belly Dance", "Contemporáneo", "Folklore", "Urbanos", "Jazz", "Lírico", "Open"],
    aerialGenres: ["Tela", "Aro", "Open"],
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
    heroTitle: "Sede Puebla",
    eventName: "Auditorio Daniel Forcelledo",
    venueName: "Auditorio Daniel Forcelledo",
    heroImage: assets.hero,
    location: "Tlatempa, San Pedro Cholula",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Auditorio%20Daniel%20Forcelledo%20Puebla",
    date: "7 junio 2026",
    metaLabel: "Status",
    metaValue: "Inscripciones abiertas",
    motionGenres: ["Acrojazz", "Ballet", "Belly Dance", "Contemporáneo", "Folklore", "Urbanos (nuevo!)", "Jazz", "Lírico", "Open (nuevo!)"],
    aerialGenres: ["Tela", "Aro", "Open"],
    competitionBlocks: [
      { date: "7 de junio", items: [
        { title: "Bloque 1", text: "Baby y Petite - Motion" },
        { title: "Bloque 2", text: "Junior, Teen y Senior - Motion" },
        { title: "Bloque 3", text: "Baby y Petite - Aerial" },
        { title: "Bloque 4", text: "Junior, Teen y Senior - Aerial" },
      ] },
    ],
    jury: [
      { name: "Andrea Salinas", specialty: "Contemporary · Jazz", image: assets.community },
      { name: "Mariana Ríos", specialty: "Hip Hop · Urbano", image: assets.workshops },
      { name: "Daniel Figueroa", specialty: "Ballet · Técnica clásica", image: assets.venue },
      { name: "Lucía Torres", specialty: "Danza contemporánea", image: assets.hero },
    ],
  },
  edomex: {
    heroTitle: "Sede Estado de México",
    eventName: "Teatro El Gran Recinto",
    venueName: "Teatro El Gran Recinto",
    heroImage: "/assets/sedes-edomex-hero.jpg",
    location: "Tlalnepantla, Edo. Méx.",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Teatro%20El%20Gran%20Recinto%20Tlalnepantla%20Estado%20de%20Mexico",
    date: "13 · 14 · 15\nnoviembre 2026",
    metaLabel: "Status",
    metaValue: "Convocatoria próxima",
    motionGenres: ["Acrojazz", "Ballet", "Belly Dance", "Contemporáneo", "Folklore", "Urbanos", "Jazz", "Lírico", "Open"],
    aerialGenres: ["Tela", "Aro", "Open"],
    competitionBlocks: [
      { date: "14 de noviembre", items: [
        { title: "Bloque 1", text: "Baby y Petite - Motion" },
        { title: "Bloque 2", text: "Junior, Teen y Senior - Motion" },
      ] },
      { date: "15 de noviembre", items: [
        { title: "Bloque 3", text: "Baby y Petite - Aerial" },
        { title: "Bloque 4", text: "Junior, Teen y Senior - Aerial" },
      ] },
    ],
    jury: [
      { name: "Andrea Salinas", specialty: "Contemporary · Jazz", image: assets.community },
      { name: "Mariana Ríos", specialty: "Hip Hop · Urbano", image: assets.workshops },
      { name: "Daniel Figueroa", specialty: "Ballet · Técnica clásica", image: assets.venue },
      { name: "Lucía Torres", specialty: "Danza contemporánea", image: assets.hero },
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

function GenreList({ columns = 2, items }: { columns?: 1 | 2; items: string[] }) {
  const midpoint = Math.ceil(items.length / columns);
  const groupedItems = columns === 1 ? [items] : [items.slice(0, midpoint), items.slice(midpoint)];

  return (
    <div className={`sedes-genre-list${columns === 1 ? " sedes-genre-list--single" : ""}`}>
      {groupedItems.map((group, index) => (
        <ul key={index}>
          {group.map((genre) => {
            const isNew = /\(nuevo!\)/i.test(genre);
            const label = genre.replace(/\s*\(nuevo!\)/i, "");

            return (
              <li className={isNew ? "sedes-genre-item sedes-genre-item--new" : "sedes-genre-item"} key={genre}>
                <span>{label}</span>
                {isNew ? <em>Nuevo</em> : null}
              </li>
            );
          })}
        </ul>
      ))}
    </div>
  );
}

function renderBlockText(text: string) {
  const highlightedTerms = new Set(["baby", "junior", "legacy", "petite", "senior", "teen", "teens"]);

  return text.split("\n").map((line) => (
    <span className="sedes-block-line" key={line}>
      {line.split(/\b(Baby|Junior|Legacy|Petite|Senior|Teen|Teens)\b/gi).map((part, index) => (
        highlightedTerms.has(part.toLowerCase())
          ? <span className="sedes-block-level" key={`${part}-${index}`}>{part}</span>
          : part
      ))}
    </span>
  ));
}

type SedesPageProps = {
  venueKey?: keyof typeof sedesContent;
};

export function SedesPage({ venueKey = "cdmx" }: SedesPageProps) {
  const venue = sedesContent[venueKey] ?? sedesContent.cdmx;

  return (
    <main className="sedes-page">
      <section className="sedes-hero">
        <LevitateHeader activeLabel="Convocatoria" useRootLinks />
        <img className="sedes-hero__image" src={venue.heroImage} alt="" aria-hidden="true" />
        <div className="sedes-hero__shade" aria-hidden="true" />

        <div className="sedes-hero__content">
          <p className="sedes-kicker">Convocatoria</p>
          <h1>{venue.heroTitle}</h1>
          <strong>{venue.eventName}</strong>

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

      <div className="sedes-light-flow">
        <section className="sedes-light-section sedes-genres">
          <div className="sedes-genre-grid">
            <article className="sedes-genre-card sedes-genre-card--motion">
              <img src={venue.motionImage ?? assets.competition} alt="Participante de Motion con vestuario rojo en escenario Levitate" />
              <div>
                <p className="sedes-genre-card__eyebrow">Géneros de competencia</p>
                <h3>Motion</h3>
                <div className="sedes-genre-card__label">
                  <span className="sedes-genre-card__mark sedes-genre-card__mark--motion" aria-hidden="true" />
                  <strong>Géneros de danza y piso</strong>
                </div>
                <GenreList items={venue.motionGenres} />
              </div>
            </article>

            <article className="sedes-genre-card sedes-genre-card--aerial">
              <div>
                <p className="sedes-genre-card__eyebrow">Géneros de competencia</p>
                <h3>Aerial</h3>
                <div className="sedes-genre-card__label">
                  <span className="sedes-genre-card__mark sedes-genre-card__mark--aerial" aria-hidden="true" />
                  <strong>Géneros aéreos</strong>
                </div>
                <GenreList columns={1} items={venue.aerialGenres} />
              </div>
              <img src={venue.aerialImage ?? assets.hero} alt="Participante de Aerial en tela durante una presentación Levitate" />
            </article>
          </div>
        </section>

        <section className="sedes-light-section sedes-blocks">
          <SectionHeading kicker="Bloques" title="de competencia" />
          <div className={`sedes-block-columns${venue.competitionBlocks.length === 1 ? " sedes-block-columns--single" : ""}`}>
            {venue.competitionBlocks.map((day) => (
              <div className="sedes-block-day" key={day.date}>
                <h3>{day.date}</h3>
                <div>
                  {day.items.map((item) => (
                    <article key={item.title}>
                      <h4>{item.title}</h4>
                      <p>{renderBlockText(item.text)}</p>
                    </article>
                  ))}
                </div>
              </div>
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
          <SectionHeading kicker="Jurado" title="invitado" />
          <p>Conoce al panel de artistas y profesionales que formarán parte de esta sede.</p>
        </div>
        <div className={`sedes-jury-grid${venue.jury.length === 4 ? " sedes-jury-grid--four" : ""}`}>
          {venue.jury.map((judge) => (
            <article className="sedes-jury-card" key={judge.name}>
              <img src={judge.image} alt="" aria-hidden="true" />
              <h3>{judge.name}</h3>
              <p>{judge.specialty}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="sedes-final-cta">
        <video
          className="sedes-final-cta__video"
          autoPlay
          loop
          muted
          playsInline
          poster={venue.heroImage}
          onLoadedMetadata={(event) => {
            event.currentTarget.playbackRate = 0.75;
          }}
          aria-hidden="true"
        >
          <source src="/assets/sedes-final-cta-bg.mp4" type="video/mp4" />
        </video>
        <div className="sedes-final-cta__line" aria-hidden="true"><span>✦</span></div>
        <div className="sedes-final-cta__content">
          <p>Convocatoria</p>
          <span>Consulta todos los detalles de esta sede</span>
          <h2>El vuelo te espera</h2>
          <a href="/#convocatorias">
            Descargar convocatoria <ArrowUpRight aria-hidden="true" size={18} />
          </a>
        </div>
        <div className="sedes-final-cta__line" aria-hidden="true"><span>✦</span></div>
      </section>

      <LevitateFooter useRootLinks />
    </main>
  );
}
