import { ArrowRight } from "lucide-react";
import { Logo } from "./LevitateHeader";

const footerColumns = [
  { title: "Enlaces", items: ["Inicio", "Convocatorias", "Categorías", "Workshops", "Premios", "Contacto"] },
  { title: "Sobre Levitate", items: ["Quiénes somos", "Misión y visión", "Comunidad", "Preguntas frecuentes"] },
  { title: "Participa", items: ["Bases", "Evaluaciones", "Requisitos", "Términos y condiciones"] },
  { title: "Síguenos", items: ["Instagram", "Facebook", "TikTok", "YouTube"] },
];

function getFooterHref(item: string, useRootLinks: boolean) {
  if (item === "Evaluaciones") {
    return "/evaluaciones";
  }

  if (item === "Premios") {
    return "/premiacion";
  }

  if (item === "Workshops") {
    return "/workshops";
  }

  if (item === "Categorías") {
    return "/modalidades/levitate-motion/generos";
  }

  const anchors: Record<string, string> = {
    Bases: "#convocatorias",
    Contacto: "#contacto",
    Convocatorias: "#convocatorias",
    Inicio: "#inicio",
    Requisitos: "#convocatorias",
  };

  const href = anchors[item] ?? "#inicio";
  return useRootLinks && href.startsWith("#") ? `/${href}` : href;
}

type LevitateFooterProps = {
  useRootLinks?: boolean;
};

export function LevitateFooter({ useRootLinks = false }: LevitateFooterProps) {
  return (
    <footer id="contacto" className="levitate-footer">
      <div className="levitate-footer__brand">
        <Logo useRootLinks={useRootLinks} />
        <p>Competencia y experiencia artística en México para academias, participantes y amantes del arte.</p>
        <div className="levitate-footer__socials" aria-label="Redes sociales">
          <a href={useRootLinks ? "/#inicio" : "#inicio"} aria-label="Instagram">◎</a>
          <a href={useRootLinks ? "/#inicio" : "#inicio"} aria-label="Facebook">f</a>
          <a href={useRootLinks ? "/#inicio" : "#inicio"} aria-label="TikTok">♪</a>
          <a href={useRootLinks ? "/#inicio" : "#inicio"} aria-label="YouTube">▶</a>
        </div>
      </div>

      {footerColumns.map((column) => (
        <div className="levitate-footer__column" key={column.title}>
          <h3>{column.title}</h3>
          {column.items.map((item) => (
            <a href={getFooterHref(item, useRootLinks)} key={item}>{item}</a>
          ))}
        </div>
      ))}

      <form
        className="levitate-subscribe"
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <h3>Suscríbete</h3>
        <p>Recibe novedades de convocatorias, workshops y más.</p>
        <label>
          <span>Tu correo electrónico</span>
          <input type="email" placeholder="Tu correo electrónico" />
          <button type="submit" aria-label="Enviar correo">
            <ArrowRight aria-hidden="true" size={18} />
          </button>
        </label>
      </form>

      <small>© 2026 LevitateMX. Todos los derechos reservados.</small>
    </footer>
  );
}
