import {
  AlertTriangle,
  BadgeX,
  Camera,
  ClipboardList,
  Clock3,
  Download,
  FileText,
  HandHeart,
  Home,
  IdCard,
  LockKeyhole,
  Music2,
  Shield,
  ShieldCheck,
  Shirt,
  Star,
  Theater,
  UserRound,
  VenetianMask,
} from "lucide-react";
import { useState } from "react";
import { LevitateHeader } from "../home/LevitateHeader";

type RegulationTab = {
  id: string;
  number: string;
  title: string;
  icon: typeof Home;
  intro?: string;
  note?: string;
  rules: RegulationRule[];
};

type RegulationRule = {
  icon: typeof UserRound;
  text: string;
};

const regulationTabs: RegulationTab[] = [
  {
    id: "reglas-generales",
    number: "01",
    title: "Reglas generales",
    icon: Home,
    rules: [
      {
        icon: UserRound,
        text: "Todos los participantes deben ser supervisados por su entrenador/instructor durante toda la competencia.",
      },
      {
        icon: HandHeart,
        text: "Demuestra siempre un buen espíritu deportivo. El director/entrenador es responsable del comportamiento de su equipo, entrenadores, coreógrafos, padres y acompañantes.",
      },
      {
        icon: Clock3,
        text: "El cronometraje inicia con el primer movimiento coreográfico o nota musical, lo que indique el participante, y termina con el último movimiento o nota musical. Tolerancia máxima de 5 segundos.",
      },
      {
        icon: Star,
        text: "Un mismo participante puede inscribirse en las coreografías que desee siempre y cuando sean de distinto género o distinta categoría.",
      },
      {
        icon: BadgeX,
        text: "No se permite cambio de participantes.",
      },
      {
        icon: Camera,
        text: "Está prohibido el ingreso de cámaras fotográficas y/o de video semi profesionales/profesionales, tripiés y/o estabilizadores. Solo se permite grabar o tomar fotos con celular desde su asiento, sin entorpecer la visión del resto de los espectadores. Seamos respetuosos.",
      },
      {
        icon: Clock3,
        text: "Para realizar su registro el día del evento, presentarse 1 hora antes de su presentación, ya listos con vestuario, maquillaje y con todos los integrantes completos en caso de participación grupal.",
      },
      {
        icon: IdCard,
        text: "Solo podrán tener acceso a backstage quienes estén inscritos, así como sus maestros y coreógrafos registrados.",
      },
      {
        icon: ShieldCheck,
        text: "Levitate se reserva el derecho de impedir que un competidor participe si considera que no está en condiciones de hacerlo de manera segura.",
      },
      {
        icon: LockKeyhole,
        text: "Levitate no se hace responsable por pérdidas o robo de cualquier objeto.",
      },
    ],
  },
  {
    id: "musica",
    number: "02",
    title: "Música",
    icon: Music2,
    rules: [
      {
        icon: Music2,
        text: "La música deberá enviarse vía correo electrónico a musica.levitate@gmail.com 15 días antes del evento, en formato MP3.",
      },
      {
        icon: FileText,
        text: "El archivo debe nombrarse así: Nombre de la coreografía - Academia/Escuela - Género Modalidad - Categoría - División.",
      },
      {
        icon: IdCard,
        text: "Asegúrese de llevar su música en un USB el día del evento, a manera de respaldo.",
      },
      {
        icon: UserRound,
        text: "Un representante del grupo será responsable de la música durante la competencia y deberá permanecer en la cabina de sonido durante toda la presentación de su equipo.",
      },
      {
        icon: ShieldCheck,
        text: "La música no podrá incluir palabras altisonantes u ofensivas, ya que debe ser aceptable para público familiar.",
      },
    ],
  },
  {
    id: "coreografia-vestimenta-maquillaje",
    number: "03",
    title: "Coreografía, vestimenta y maquillaje",
    icon: Shirt,
    rules: [
      {
        icon: AlertTriangle,
        text: "Coreografía, vestimenta y/o música inapropiada puede afectar la impresión general de los jurados y/o el puntaje de la rutina.",
      },
      {
        icon: Star,
        text: "Toda coreografía debiera ser apropiada para la edad de los participantes.",
      },
      {
        icon: Shirt,
        text: "Toda vestimenta y maquillaje debiera ser apropiado y aceptable para ser visto por toda la familia.",
      },
    ],
  },
  {
    id: "accesorios-props",
    number: "04",
    title: "Accesorios / props",
    icon: VenetianMask,
    rules: [],
  },
  {
    id: "backstage",
    number: "05",
    title: "Backstage",
    icon: Theater,
    rules: [
      {
        icon: UserRound,
        text: "Un asistente, máximo dos por academia/escuela, será permitido en la zona de calentamiento por equipo para ayudar en los cambios de vestuario de bailarines que se presenten.",
      },
      {
        icon: Shield,
        text: "En esta zona está prohibido el ingreso de familiares o amigos.",
      },
      {
        icon: Star,
        text: "Cualquier bailarín puede competir en más de una división y/o categoría, siempre que cumpla con las restricciones de edad de todas las divisiones en las que compite.",
      },
      {
        icon: IdCard,
        text: "Costo de brazalete para maestro extra: $250.",
      },
    ],
  },
  {
    id: "penalidades",
    number: "06",
    title: "Penalidades",
    icon: AlertTriangle,
    intro: "Las penalidades pueden darse basadas en lo siguiente:",
    note: "Nota: Otras penalidades, tales como ropa inapropiada, pueden reflejarse en el puntaje global de la rutina.",
    rules: [
      {
        icon: ShieldCheck,
        text: "Por falta de seguridad: descalificación.",
      },
      {
        icon: HandHeart,
        text: "Por falta de respeto de cualquier miembro de la escuela o academia participante: descalificación.",
      },
      {
        icon: BadgeX,
        text: "Por división incorrecta: -3 puntos.",
      },
      {
        icon: Clock3,
        text: "Por rutinas fuera del tiempo límite: -6 puntos, equivalente a 2 puntos por juez.",
      },
    ],
  },
  {
    id: "privacidad-terminos",
    number: "07",
    title: "Aviso de privacidad y términos y condiciones",
    icon: Shield,
    rules: [
      {
        icon: Camera,
        text: "Levitate se reserva el derecho de publicar y compartir cualquier información recopilada durante sus eventos, incluidos fotos, videos, nombres, estudios y ubicaciones.",
      },
      {
        icon: UserRound,
        text: "La participación en una competencia requiere que otros vean y juzguen el desempeño del participante, por lo que ciertas actividades de difusión son necesarias.",
      },
      {
        icon: FileText,
        text: "Al momento del registro se debe firmar la aceptación de los términos y condiciones de Levitate.",
      },
      {
        icon: ShieldCheck,
        text: "Cada participante deberá llevar firmada una carta responsiva por sus padres en caso de ser menor de edad, o por sí mismo si es mayor.",
      },
      {
        icon: BadgeX,
        text: "No se permitirá la participación de ningún participante, sin excepción, sin dicha carta en original.",
      },
    ],
  },
];

export function RegulationsPage() {
  const [activeTabId, setActiveTabId] = useState(regulationTabs[0].id);
  const activeTab = regulationTabs.find((tab) => tab.id === activeTabId) ?? regulationTabs[0];
  const ActivePanelIcon = activeTab.icon;
  const [titleLead, ...titleAccentParts] = activeTab.title.split(" ");
  const titleAccent = titleAccentParts.length > 0 ? titleAccentParts.join(" ") : titleLead;

  return (
    <main className="regulations-page">
      <LevitateHeader activeLabel="Modalidades" useRootLinks />

      <section className="regulations-shell" aria-label="Reglamentos Levitate">
        <aside className="regulations-sidebar" aria-label="Secciones del reglamento">
          <div className="regulations-sidebar__brand">
            <span>Levitate</span>
            <small>Reglamento oficial</small>
          </div>

          <nav className="regulations-tabs" aria-label="Tabs de reglamento">
            {regulationTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = tab.id === activeTab.id;

              return (
                <button
                  aria-controls="regulations-panel"
                  aria-selected={isActive}
                  className={isActive ? "is-active" : ""}
                  id={`regulations-tab-${tab.id}`}
                  key={tab.id}
                  onClick={() => setActiveTabId(tab.id)}
                  role="tab"
                  type="button"
                >
                  <Icon aria-hidden="true" size={30} strokeWidth={1.8} />
                  <span>
                    {tab.number}. {tab.title}
                  </span>
                </button>
              );
            })}
          </nav>

          <a className="regulations-download" href="#regulations-panel">
            <FileText aria-hidden="true" size={42} strokeWidth={1.5} />
            <strong>Descarga el reglamento completo</strong>
            <span>Consulta todos los detalles, lineamientos y especificaciones para que tu experiencia en LevitateMX sea perfecta.</span>
            <Download aria-hidden="true" size={32} strokeWidth={1.7} />
          </a>
        </aside>

        <article
          aria-labelledby={`regulations-tab-${activeTab.id}`}
          className="regulations-panel"
          id="regulations-panel"
          role="tabpanel"
        >
          <header className="regulations-panel__header">
            <span>{activeTab.number}</span>
            <h1>
              {titleAccentParts.length > 0 ? `${titleLead} ` : null}
              <strong>{titleAccent}</strong>
            </h1>
            <ActivePanelIcon aria-hidden="true" size={78} strokeWidth={1.25} />
          </header>

          {activeTab.rules.length > 0 ? (
            <>
              {activeTab.intro ? <p className="regulations-panel__intro">{activeTab.intro}</p> : null}
              <div className="regulations-rule-grid">
                {activeTab.rules.map((rule, index) => {
                  const Icon = rule.icon;

                  return (
                    <section className="regulations-rule" key={`${activeTab.id}-${index}`}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <Icon aria-hidden="true" size={28} strokeWidth={1.7} />
                      <p>{rule.text}</p>
                    </section>
                  );
                })}
              </div>
              {activeTab.note ? <p className="regulations-note">{activeTab.note}</p> : null}
            </>
          ) : (
            <div className="regulations-empty">
              <ClipboardList aria-hidden="true" size={48} strokeWidth={1.4} />
              <h2>Contenido listo para cargar</h2>
              <p>Esta sección queda preparada para incorporar los lineamientos específicos de la tab.</p>
            </div>
          )}
        </article>
      </section>
    </main>
  );
}
