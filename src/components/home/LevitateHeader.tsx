import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type NavItem = {
  label: string;
  href: string;
  children?: NavItem[];
};

const navItems = [
  { label: "Inicio", href: "#inicio" },
  {
    label: "Convocatoria",
    href: "#convocatorias",
    children: [
      {
        label: "Sedes",
        href: "/sedes",
        children: [
          { label: "Ciudad de México", href: "/sedes/ciudad-de-mexico" },
          { label: "Puebla", href: "/sedes/puebla" },
          { label: "Estado de México", href: "/sedes/estado-de-mexico" },
        ],
      },
      { label: "Workshops", href: "/workshops" },
      { label: "Premiación", href: "/premiacion" },
    ],
  },
  {
    label: "Modalidades",
    href: "/modalidades/levitate-motion/generos",
    children: [
      {
        label: "Levitate Motion",
        href: "/modalidades/levitate-motion/generos",
        children: [
          { label: "Clasificación", href: "/modalidades/levitate-motion/generos" },
          { label: "Reglamento", href: "/reglamentos" },
          { label: "Evaluación", href: "/evaluaciones" },
        ],
      },
      {
        label: "Levitate Aerial",
        href: "#categorías",
        children: [
          { label: "Clasificación", href: "#categorías" },
          { label: "Reglamento", href: "/reglamentos" },
          { label: "Seguridad", href: "#seguridad" },
          { label: "Evaluación", href: "/modalidades/levitate-aerial/evaluacion" },
        ],
      },
    ],
  },
  {
    label: "Tienda",
    href: "/tienda",
  },
  {
    label: "Salón de la fama",
    href: "/salon-de-la-fama/mvps",
    children: [
      { label: "MVPs", href: "/salon-de-la-fama/mvps" },
      { label: "Becados", href: "#becados" },
    ],
  },
  { label: "Contacto", href: "#contacto" },
] satisfies NavItem[];

function resolveHref(href: string, useRootLinks: boolean) {
  if (!useRootLinks || href.startsWith("/")) {
    return href;
  }

  return `/${href}`;
}

export function Logo({ useRootLinks = false }: { useRootLinks?: boolean }) {
  return (
    <a className="levitate-logo" href={useRootLinks ? "/#inicio" : "#inicio"} aria-label="Levitate MX inicio">
      <span>Levitate</span>
      <small>MX</small>
    </a>
  );
}

type LevitateHeaderProps = {
  activeLabel?: string;
  useRootLinks?: boolean;
};

export function LevitateHeader({ activeLabel = "Inicio", useRootLinks = false }: LevitateHeaderProps) {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [renderedMenu, setRenderedMenu] = useState<string | null>(null);
  const [isMenuClosing, setIsMenuClosing] = useState(false);
  const renderedNavItem = navItems.find((item) => item.label === renderedMenu && item.children);
  const dropdown = renderedNavItem ? (
    <div
      aria-hidden={isMenuClosing}
      aria-label={`${renderedNavItem.label} submenu`}
      className={`levitate-nav__dropdown ${isMenuClosing ? "is-closing" : "is-open"}`}
      onFocus={() => setActiveMenu(renderedNavItem.label)}
      onMouseEnter={() => setActiveMenu(renderedNavItem.label)}
      onMouseLeave={() => setActiveMenu(null)}
      onPointerEnter={() => setActiveMenu(renderedNavItem.label)}
      onPointerLeave={() => setActiveMenu(null)}
    >
      <div className="levitate-nav__dropdown-visual" aria-hidden="true" />
      <div className="levitate-nav__dropdown-list">
        {renderedNavItem.children?.map((child) => (
          <div className="levitate-nav__dropdown-item" key={child.label}>
            <a className="levitate-nav__dropdown-main" href={resolveHref(child.href, useRootLinks)}>
              {child.label}
            </a>
            {child.children ? (
              <div className="levitate-nav__dropdown-sublist" aria-label={`${child.label} submenu`}>
                {child.children.map((nestedChild) => (
                  <a href={resolveHref(nestedChild.href, useRootLinks)} key={nestedChild.label}>
                    {nestedChild.label}
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  ) : null;

  useEffect(() => {
    if (activeMenu) {
      setRenderedMenu(activeMenu);
      setIsMenuClosing(false);
      return;
    }

    if (!renderedMenu) {
      return;
    }

    setIsMenuClosing(true);
    const closeTimer = window.setTimeout(() => {
      setRenderedMenu(null);
      setIsMenuClosing(false);
    }, 280);

    return () => window.clearTimeout(closeTimer);
  }, [activeMenu, renderedMenu]);

  useEffect(() => {
    if (!activeMenu) {
      return;
    }

    const closeMenu = () => setActiveMenu(null);
    const listenerOptions = { passive: true, capture: true };

    window.addEventListener("wheel", closeMenu, listenerOptions);
    window.addEventListener("touchmove", closeMenu, listenerOptions);
    window.addEventListener("scroll", closeMenu, { passive: true });

    return () => {
      window.removeEventListener("wheel", closeMenu, listenerOptions);
      window.removeEventListener("touchmove", closeMenu, listenerOptions);
      window.removeEventListener("scroll", closeMenu);
    };
  }, [activeMenu]);

  return (
    <div className="levitate-menu-shell">
      <header className="levitate-nav">
        <Logo useRootLinks={useRootLinks} />
        <nav
          aria-label="Navegación principal"
          onMouseMove={(event) => {
            const link = (event.target as HTMLElement).closest<HTMLAnchorElement>("[data-nav-label]");
            const item = navItems.find((navItem) => navItem.label === link?.dataset.navLabel);
            setActiveMenu(item?.children ? item.label : null);
          }}
          onPointerMove={(event) => {
            const link = (event.target as HTMLElement).closest<HTMLAnchorElement>("[data-nav-label]");
            const item = navItems.find((navItem) => navItem.label === link?.dataset.navLabel);
            setActiveMenu(item?.children ? item.label : null);
          }}
        >
          {navItems.map((item) => (
            <div className={`levitate-nav__item${activeMenu === item.label ? " is-open" : ""}`} key={item.label}>
              <a
                aria-expanded={item.children ? activeMenu === item.label : undefined}
                aria-haspopup={item.children ? "true" : undefined}
                className={`levitate-nav__link${item.label === activeLabel ? " is-active" : ""}`}
                data-nav-label={item.label}
                href={resolveHref(item.href, useRootLinks)}
                onBlur={(event) => {
                  if (!event.currentTarget.parentElement?.contains(event.relatedTarget)) {
                    setActiveMenu(null);
                  }
                }}
                onClick={(event) => {
                  if (item.children) {
                    event.preventDefault();
                    setActiveMenu((current) => (current === item.label ? null : item.label));
                  }
                }}
                onFocus={() => {
                  if (item.children) {
                    setActiveMenu(item.label);
                  }
                }}
                onMouseEnter={() => {
                  if (item.children) {
                    setActiveMenu(item.label);
                  } else {
                    setActiveMenu(null);
                  }
                }}
                onMouseOver={() => {
                  if (item.children) {
                    setActiveMenu(item.label);
                  }
                }}
                onPointerEnter={() => {
                  if (item.children) {
                    setActiveMenu(item.label);
                  } else {
                    setActiveMenu(null);
                  }
                }}
              >
                {item.label}
              </a>
            </div>
          ))}
        </nav>
      </header>

      {dropdown && typeof document !== "undefined" ? createPortal(dropdown, document.body) : null}
    </div>
  );
}
