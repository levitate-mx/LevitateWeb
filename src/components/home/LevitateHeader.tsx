import { useEffect, useState } from "react";
import type { MouseEvent, PointerEvent } from "react";
import { createPortal } from "react-dom";
import { Download, Grip, UserRound, X } from "lucide-react";

type NavItem = {
  label: string;
  href: string;
  children?: NavItem[];
  download?: boolean;
};

type PillMenuLink = {
  label: string;
  href: string;
};

type PillMenuSection = {
  title: string;
  href?: string;
  links?: PillMenuLink[];
};

const regulationsPdfHref = "/assets/reglamento-levitate.pdf";

const navItems: NavItem[] = [
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
          { label: "Evaluación", href: "/evaluaciones" },
          { label: "Reglamento", href: regulationsPdfHref, download: true },
        ],
      },
      {
        label: "Levitate Aerial",
        href: "#categorías",
        children: [
          { label: "Clasificación", href: "#categorías" },
          { label: "Evaluación", href: "/modalidades/levitate-aerial/evaluacion" },
          { label: "Seguridad", href: "#seguridad" },
          { label: "Reglamento", href: regulationsPdfHref, download: true },
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
  },
  { label: "Contacto", href: "#contacto" },
];

function resolveHref(href: string, useRootLinks: boolean) {
  if (!useRootLinks || href.startsWith("/")) {
    return href;
  }

  return `/${href}`;
}

export function Logo({ useRootLinks = false }: { useRootLinks?: boolean }) {
  return (
    <a className="levitate-logo" href={useRootLinks ? "/#inicio" : "#inicio"} aria-label="Levitate MX inicio">
      <img src="/assets/levitate-logo-mx.png" alt="" aria-hidden="true" />
    </a>
  );
}

type LevitateHeaderProps = {
  activeLabel?: string;
  useRootLinks?: boolean;
  variant?: "classic" | "pill";
};

const pillNavItems = navItems.filter((item) => ["Inicio", "Convocatoria", "Tienda"].includes(item.label));

const pillMenuSections: PillMenuSection[] = [
  {
    title: "Convocatoria",
    links: [
      { label: "Levitate Motion", href: "/modalidades/levitate-motion/generos" },
      { label: "Levitate Aerial", href: "/modalidades/levitate-aerial/evaluacion" },
      { label: "Sedes", href: "/sedes" },
      { label: "Workshops", href: "/workshops" },
      { label: "Premiación", href: "/premiacion" },
    ],
  },
  {
    title: "Tienda",
    href: "/tienda",
  },
  {
    title: "Salón de la fama",
    href: "/salon-de-la-fama/mvps",
  },
];

export function LevitateHeader({ activeLabel = "Inicio", useRootLinks = false, variant = "classic" }: LevitateHeaderProps) {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [renderedMenu, setRenderedMenu] = useState<string | null>(null);
  const [isMenuClosing, setIsMenuClosing] = useState(false);
  const [isPillMenuOpen, setIsPillMenuOpen] = useState(false);
  const [activePillSection, setActivePillSection] = useState<string | null>(null);
  const renderedNavItem = navItems.find((item) => item.label === renderedMenu && item.children);
  const selectedPillSection = pillMenuSections.find((section) => section.title === activePillSection && section.links);
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
                  <a
                    className={nestedChild.download ? "is-download" : undefined}
                    download={nestedChild.download ? true : undefined}
                    href={resolveHref(nestedChild.href, useRootLinks)}
                    key={nestedChild.label}
                  >
                    <span>{nestedChild.label}</span>
                    {nestedChild.download ? <Download aria-hidden="true" size={14} strokeWidth={2.2} /> : null}
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

  useEffect(() => {
    if (!isPillMenuOpen) {
      return;
    }

    const closePillMenu = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsPillMenuOpen(false);
        setActivePillSection(null);
      }
    };

    window.addEventListener("keydown", closePillMenu);
    return () => window.removeEventListener("keydown", closePillMenu);
  }, [isPillMenuOpen]);

  const handleNavPointer = (event: MouseEvent<HTMLElement> | PointerEvent<HTMLElement>) => {
    const link = (event.target as HTMLElement).closest<HTMLAnchorElement>("[data-nav-label]");
    const item = navItems.find((navItem) => navItem.label === link?.dataset.navLabel);
    setIsPillMenuOpen(false);
    setActivePillSection(null);
    setActiveMenu(item?.children ? item.label : null);
  };

  const closePillMenu = () => {
    setIsPillMenuOpen(false);
    setActivePillSection(null);
  };

  const renderNavItem = (item: NavItem) => (
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
  );

  const renderPillNavItem = (item: NavItem) => (
    <div className="levitate-nav__item" key={item.label}>
      <a
        className={`levitate-nav__link${item.label === activeLabel ? " is-active" : ""}`}
        href={resolveHref(item.href, useRootLinks)}
        onClick={() => setActiveMenu(null)}
      >
        {item.label}
      </a>
    </div>
  );

  if (variant === "pill") {
    return (
      <div className="levitate-menu-shell levitate-menu-shell--pill">
        <header className="levitate-nav levitate-nav--pill">
          <div className="levitate-nav__group levitate-nav__group--primary">
            <button
              aria-controls="levitate-pill-menu"
              aria-expanded={isPillMenuOpen}
              className="levitate-nav__menu-trigger"
              onClick={() => {
                setActiveMenu(null);
                setIsPillMenuOpen((current) => {
                  const nextState = !current;

                  if (!nextState) {
                    setActivePillSection(null);
                  }

                  return nextState;
                });
              }}
              type="button"
            >
              <Grip aria-hidden="true" size={17} strokeWidth={2.25} />
              <span>Menú</span>
            </button>
            <nav aria-label="Navegación principal">
              {pillNavItems.map(renderPillNavItem)}
            </nav>
          </div>

          <Logo useRootLinks={useRootLinks} />

          <a className="levitate-nav__login" href="/login" aria-label="Iniciar sesión">
            <UserRound aria-hidden="true" size={20} strokeWidth={2.25} />
          </a>
        </header>

        {isPillMenuOpen ? (
          <div className={`levitate-pill-menu${selectedPillSection ? " has-submenu" : ""}`} id="levitate-pill-menu">
            <button
              aria-label="Cerrar menú"
              className="levitate-pill-menu__close"
              onClick={closePillMenu}
              type="button"
            >
              <X aria-hidden="true" size={24} strokeWidth={2.2} />
            </button>

            <div className="levitate-pill-menu__content">
              <div className="levitate-pill-menu__links">
                {pillMenuSections.map((section) => (
                  <section key={section.title}>
                    {section.links ? (
                      <button
                        aria-controls="levitate-pill-submenu"
                        aria-expanded={activePillSection === section.title}
                        className={`levitate-pill-menu__heading${activePillSection === section.title ? " is-active" : ""}`}
                        onClick={() => setActivePillSection(section.title)}
                        type="button"
                      >
                        <strong>{section.title}</strong>
                      </button>
                    ) : (
                      <a
                        className="levitate-pill-menu__heading"
                        href={resolveHref(section.href ?? "#inicio", useRootLinks)}
                        onClick={closePillMenu}
                      >
                        <strong>{section.title}</strong>
                      </a>
                    )}
                  </section>
                ))}
              </div>

              {selectedPillSection?.links ? (
                <aside className="levitate-pill-menu__submenu" id="levitate-pill-submenu" aria-label={`${selectedPillSection.title} submenu`}>
                  {selectedPillSection.links.map((link) => (
                    <a href={resolveHref(link.href, useRootLinks)} key={link.label} onClick={closePillMenu}>
                      {link.label}
                    </a>
                  ))}
                </aside>
              ) : null}

              <aside className="levitate-pill-menu__contact" aria-label="Contacto">
                <strong>Levitate MX</strong>
                <a className="levitate-pill-menu__email" href="mailto:info.levitatemx@gmail.com">
                  info.levitatemx@gmail.com
                </a>
                <div className="levitate-pill-menu__contact-links">
                  <a href="https://wa.me/5217774920775">WhatsApp</a>
                  <a href="https://www.facebook.com/levitate.mx" aria-label="Facebook Levitate MX">
                    FB
                  </a>
                  <a href="https://www.instagram.com/levitate.mx" aria-label="Instagram Levitate MX">
                    IG
                  </a>
                  <span>@levitate.mx</span>
                </div>
              </aside>
            </div>
          </div>
        ) : null}

      </div>
    );
  }

  return (
    <div className="levitate-menu-shell">
      <header className="levitate-nav">
        <Logo useRootLinks={useRootLinks} />
        <nav
          aria-label="Navegación principal"
          onMouseMove={handleNavPointer}
          onPointerMove={handleNavPointer}
        >
          {navItems.map(renderNavItem)}
        </nav>
      </header>

      {dropdown && typeof document !== "undefined" ? createPortal(dropdown, document.body) : null}
    </div>
  );
}
