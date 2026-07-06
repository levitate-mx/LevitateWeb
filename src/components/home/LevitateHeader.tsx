import { useEffect, useRef, useState } from "react";
import type { CSSProperties, MouseEvent, PointerEvent } from "react";
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
      { label: "Estado de México", href: "/sedes/estado-de-mexico" },
      { label: "Veracruz", href: "/sedes" },
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
          { label: "Géneros", href: "/modalidades/levitate-motion/generos" },
          { label: "Evaluación", href: "/evaluaciones" },
          { label: "Reglamento", href: regulationsPdfHref, download: true },
        ],
      },
      {
        label: "Levitate Aerial",
        href: "/modalidades/levitate-aerial/evaluacion",
        children: [
          { label: "Niveles", href: "/modalidades/levitate-aerial/evaluacion" },
          { label: "Evaluación", href: "/modalidades/levitate-aerial/evaluacion" },
          { label: "Reglamento", href: regulationsPdfHref, download: true },
        ],
      },
    ],
  },
  {
    label: "Inscripciones",
    href: "/inscripciones",
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

const capsuleNavItems: PillMenuSection[] = [
  {
    title: "Menú",
  },
  {
    title: "Inicio",
    href: "#inicio",
  },
  {
    title: "Convocatoria",
    href: "#convocatorias",
  },
  {
    title: "Inscripciones",
    href: "/inscripciones",
  },
];

const pillMenuSections: PillMenuSection[] = [
  {
    title: "Convocatoria",
    links: [
      { label: "Estado de México", href: "/sedes/estado-de-mexico" },
      { label: "Veracruz", href: "/sedes" },
    ],
  },
  {
    title: "Modalidades",
    links: [
      { label: "Levitate Motion", href: "/modalidades/levitate-motion/generos" },
      { label: "Levitate Aerial", href: "/modalidades/levitate-aerial/evaluacion" },
    ],
  },
  {
    title: "Workshops",
    href: "/workshops",
  },
  {
    title: "Premiación",
    href: "/premiacion",
  },
  {
    title: "Salón de la fama",
    href: "/salon-de-la-fama/mvps",
  },
  {
    title: "Tienda Oficial",
    links: [
      { label: "Taquilla", href: "/tienda#boletos" },
      { label: "Galería Oficial", href: "/tienda#foto-video" },
    ],
  },
];

export function LevitateHeader({ activeLabel = "Inicio", useRootLinks = false, variant = "classic" }: LevitateHeaderProps) {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [renderedMenu, setRenderedMenu] = useState<string | null>(null);
  const [isMenuClosing, setIsMenuClosing] = useState(false);
  const [isPillMenuOpen, setIsPillMenuOpen] = useState(false);
  const [activePillSection, setActivePillSection] = useState<string | null>(null);
  const [isLoginMenuOpen, setIsLoginMenuOpen] = useState(false);
  const [isScrollCompact, setIsScrollCompact] = useState(false);
  const [isPastHero, setIsPastHero] = useState(false);
  const capsuleMenuRef = useRef<HTMLDivElement>(null);
  const loginMenuRef = useRef<HTMLDivElement>(null);
  const pillMenuRef = useRef<HTMLDivElement>(null);
  const pillSubmenuRef = useRef<HTMLElement>(null);
  const pillMenuSectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const scrollFrameRef = useRef<number | null>(null);
  const renderedNavItem = navItems.find((item) => item.label === renderedMenu && item.children);
  const selectedPillSection = pillMenuSections.find((section) => section.title === activePillSection && section.links);
  const [pillSubmenuLayout, setPillSubmenuLayout] = useState<{ left: number; reach: number; top: number } | null>(null);
  const pillMenuStyle = selectedPillSection && pillSubmenuLayout
    ? ({
        "--levitate-pill-submenu-left": `${pillSubmenuLayout.left}px`,
        "--levitate-pill-submenu-reach": `${pillSubmenuLayout.reach}px`,
        "--levitate-pill-submenu-top": `${pillSubmenuLayout.top}px`,
      } as CSSProperties)
    : undefined;
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

    const closeOnOutsideClick = (event: globalThis.PointerEvent) => {
      if (
        event.target instanceof Node &&
        !capsuleMenuRef.current?.contains(event.target) &&
        !pillMenuRef.current?.contains(event.target) &&
        !pillSubmenuRef.current?.contains(event.target)
      ) {
        setIsPillMenuOpen(false);
        setActivePillSection(null);
      }
    };

    window.addEventListener("keydown", closePillMenu);
    window.addEventListener("pointerdown", closeOnOutsideClick);

    return () => {
      window.removeEventListener("keydown", closePillMenu);
      window.removeEventListener("pointerdown", closeOnOutsideClick);
    };
  }, [isPillMenuOpen]);

  useEffect(() => {
    if (!isPillMenuOpen || !selectedPillSection) {
      setPillSubmenuLayout(null);
      return;
    }

    const updatePillSubmenuLayout = () => {
      const menu = pillMenuRef.current;
      const activeSection = pillMenuSectionRefs.current[selectedPillSection.title];
      const activeHeading = activeSection?.querySelector<HTMLElement>(".levitate-pill-menu__heading");

      if (!menu || !activeHeading) {
        return;
      }

      const menuRect = menu.getBoundingClientRect();
      const headingRect = activeHeading.getBoundingClientRect();

      setPillSubmenuLayout({
        left: Math.round(menuRect.right - 28),
        reach: Math.round(Math.max(headingRect.bottom - menuRect.top, 148)),
        top: Math.round(menuRect.top + 2),
      });
    };

    updatePillSubmenuLayout();
    window.addEventListener("resize", updatePillSubmenuLayout);
    window.addEventListener("scroll", updatePillSubmenuLayout, { passive: true });

    return () => {
      window.removeEventListener("resize", updatePillSubmenuLayout);
      window.removeEventListener("scroll", updatePillSubmenuLayout);
    };
  }, [isPillMenuOpen, selectedPillSection]);

  useEffect(() => {
    if (!isLoginMenuOpen) {
      return;
    }

    const closeLoginMenu = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsLoginMenuOpen(false);
      }
    };

    const closeOnOutsideClick = (event: globalThis.PointerEvent) => {
      if (event.target instanceof Node && !loginMenuRef.current?.contains(event.target)) {
        setIsLoginMenuOpen(false);
      }
    };

    window.addEventListener("keydown", closeLoginMenu);
    window.addEventListener("pointerdown", closeOnOutsideClick);

    return () => {
      window.removeEventListener("keydown", closeLoginMenu);
      window.removeEventListener("pointerdown", closeOnOutsideClick);
    };
  }, [isLoginMenuOpen]);

  useEffect(() => {
    if (variant !== "pill") {
      return;
    }

    let lastScrollY = window.scrollY;
    let isTicking = false;

    const updateNavState = () => {
      const currentScrollY = Math.max(window.scrollY, 0);
      const delta = currentScrollY - lastScrollY;
      const pastHero = currentScrollY > window.innerHeight * 0.72;

      setIsPastHero(pastHero);

      if (currentScrollY <= 12) {
        setIsScrollCompact(false);
        setIsPastHero(false);
        lastScrollY = currentScrollY;
        isTicking = false;
        return;
      }

      if (Math.abs(delta) >= 7) {
        if (delta > 0) {
          setIsScrollCompact(true);
          setIsPillMenuOpen(false);
          setActivePillSection(null);
          setIsLoginMenuOpen(false);
        } else {
          setIsScrollCompact(false);
        }

        lastScrollY = currentScrollY;
      }

      isTicking = false;
    };

    const handleScroll = () => {
      if (isTicking) {
        return;
      }

      isTicking = true;
      scrollFrameRef.current = window.requestAnimationFrame(updateNavState);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);

      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
      }
    };
  }, [variant]);

  const handleNavPointer = (event: MouseEvent<HTMLElement> | PointerEvent<HTMLElement>) => {
    const link = (event.target as HTMLElement).closest<HTMLAnchorElement>("[data-nav-label]");
    const item = navItems.find((navItem) => navItem.label === link?.dataset.navLabel);
    setActivePillSection(null);
    setIsLoginMenuOpen(false);
    setActiveMenu(item?.children ? item.label : null);
  };

  const closeCapsuleSubmenu = () => {
    setIsPillMenuOpen(false);
    setActivePillSection(null);
    setIsLoginMenuOpen(false);
  };

  const openPillMenu = (sectionTitle: string | null = null) => {
    setActiveMenu(null);
    setIsLoginMenuOpen(false);
    setIsPillMenuOpen(true);
    setActivePillSection(sectionTitle);
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

  const renderCapsuleNavItem = (item: PillMenuSection) => {
    const isOpen = item.title === "Menú" ? isPillMenuOpen : activePillSection === item.title;
    const hasSubmenu = Boolean(item.links?.length);
    const submenuId = `levitate-capsule-submenu-${item.title.toLowerCase().replace(/\s+/g, "-")}`;
    const itemClassName = `levitate-nav__capsule-item${isOpen ? " is-open" : ""}`;
    const controlClassName =
      item.title === "Menú"
        ? `levitate-nav__menu-trigger${isOpen ? " is-active" : ""}`
        : `levitate-nav__link${item.title === activeLabel ? " is-active" : ""}${isOpen ? " is-open" : ""}`;

    return (
      <div className={itemClassName} key={item.title}>
        {item.title === "Menú" ? (
          <button
            aria-controls="levitate-pill-menu"
            aria-expanded={isPillMenuOpen}
            className={controlClassName}
            onClick={() => {
              if (isPillMenuOpen) {
                closePillMenu();
              } else {
                openPillMenu();
              }
            }}
            type="button"
          >
            <Grip aria-hidden="true" size={17} strokeWidth={2.25} />
            <span>{item.title}</span>
          </button>
        ) : hasSubmenu ? (
          <button
            aria-controls={submenuId}
            aria-expanded={isOpen}
            className={controlClassName}
            onClick={() => {
              setActiveMenu(null);
              setIsLoginMenuOpen(false);
              setActivePillSection((current) => (current === item.title ? null : item.title));
            }}
            type="button"
          >
            {item.title === "Menú" ? <Grip aria-hidden="true" size={17} strokeWidth={2.25} /> : null}
            <span>{item.title}</span>
          </button>
        ) : (
          <a
            className={controlClassName}
            href={resolveHref(item.href ?? "#inicio", useRootLinks)}
            onClick={closeCapsuleSubmenu}
          >
            {item.title}
          </a>
        )}

        {isOpen && item.links ? (
          <div className="levitate-nav__submenu-flow" id={submenuId} aria-label={`${item.title} submenu`}>
            {item.links.map((link) => (
              <a href={resolveHref(link.href, useRootLinks)} key={link.label} onClick={closeCapsuleSubmenu}>
                {link.label}
              </a>
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  if (variant === "pill") {
    const pillHeader = (
      <div className="levitate-menu-shell levitate-menu-shell--pill">
        <header
          className={`levitate-nav levitate-nav--pill${isScrollCompact ? " is-scroll-compact" : ""}${
            isPastHero ? " is-past-hero" : ""
          }`}
        >
          <div className="levitate-nav__group levitate-nav__group--primary" ref={capsuleMenuRef}>
            <nav className="levitate-nav__capsule" aria-label="Navegación principal">
              {capsuleNavItems.map(renderCapsuleNavItem)}
            </nav>
          </div>

          <Logo useRootLinks={useRootLinks} />

          <div className="levitate-nav__login-wrap" ref={loginMenuRef}>
            <button
              aria-controls="levitate-login-menu"
              aria-expanded={isLoginMenuOpen}
              aria-label="Iniciar sesión"
              className="levitate-nav__login"
              onClick={() => {
                setActiveMenu(null);
                setActivePillSection(null);
                setIsLoginMenuOpen((current) => !current);
              }}
              type="button"
            >
              <UserRound aria-hidden="true" size={20} strokeWidth={2.25} />
            </button>

            {isLoginMenuOpen ? (
              <div className="levitate-login-menu" id="levitate-login-menu" role="menu">
                <a href="/login?tipo=academia" onClick={() => setIsLoginMenuOpen(false)} role="menuitem">
                  Academia
                </a>
                <a href="/login?tipo=alumno" onClick={() => setIsLoginMenuOpen(false)} role="menuitem">
                  Alumno
                </a>
              </div>
            ) : null}
          </div>
        </header>

        {isPillMenuOpen ? (
          <>
          <div
            className={`levitate-pill-menu${selectedPillSection ? " has-submenu" : ""}`}
            id="levitate-pill-menu"
            ref={pillMenuRef}
          >
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
                  <section
                    className={activePillSection === section.title ? "has-active-submenu" : undefined}
                    key={section.title}
                    ref={(node) => {
                      pillMenuSectionRefs.current[section.title] = node;
                    }}
                  >
                    {section.links ? (
                      <button
                        aria-controls={`levitate-pill-submenu-${section.title.toLowerCase().replace(/\s+/g, "-")}`}
                        aria-expanded={activePillSection === section.title}
                        className={`levitate-pill-menu__heading${activePillSection === section.title ? " is-active" : ""}`}
                        onClick={() => setActivePillSection((current) => (current === section.title ? null : section.title))}
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

                    {activePillSection === section.title && section.links ? (
                      <aside
                        className="levitate-pill-menu__submenu levitate-pill-menu__submenu--inline"
                        aria-label={`${section.title} submenu`}
                      >
                        {section.links.map((link) => (
                          <a href={resolveHref(link.href, useRootLinks)} key={link.label} onClick={closePillMenu}>
                            {link.label}
                          </a>
                        ))}
                      </aside>
                    ) : null}
                  </section>
                ))}
              </div>

              <aside className="levitate-pill-menu__contact" aria-label="Contacto">
                <strong>
                  Levitate MX<sup>®</sup>
                </strong>
                <a className="levitate-pill-menu__email" href="mailto:info.levitatemx@gmail.com">
                  info.levitatemx@gmail.com
                </a>
                <div className="levitate-pill-menu__contact-links">
                  <a
                    className="levitate-pill-menu__social-button"
                    href="https://wa.me/+5217774920775"
                    aria-label="WhatsApp Levitate MX"
                  >
                    <img src="/assets/icons/whatsapp.png" alt="" aria-hidden="true" />
                  </a>
                  <a
                    className="levitate-pill-menu__social-button"
                    href="https://www.facebook.com/mx.levitate"
                    aria-label="Facebook Levitate MX"
                  >
                    <img src="/assets/icons/facebook.png" alt="" aria-hidden="true" />
                  </a>
                  <a
                    className="levitate-pill-menu__social-button"
                    href="https://www.instagram.com/levitate.mx/"
                    aria-label="Instagram Levitate MX"
                  >
                    <img src="/assets/icons/instagram.png" alt="" aria-hidden="true" />
                  </a>
                </div>
              </aside>
            </div>
          </div>

          {selectedPillSection ? (
            <aside
              className="levitate-pill-menu__submenu levitate-pill-menu__submenu--side"
              id={`levitate-pill-submenu-${selectedPillSection.title.toLowerCase().replace(/\s+/g, "-")}`}
              aria-label={`${selectedPillSection.title} submenu`}
              ref={pillSubmenuRef}
              style={pillMenuStyle}
            >
              {selectedPillSection.links?.map((link) => (
                <a href={resolveHref(link.href, useRootLinks)} key={link.label} onClick={closePillMenu}>
                  {link.label}
                </a>
              ))}
            </aside>
          ) : null}
          </>
        ) : null}
      </div>
    );

    const pillHeaderPortal = <div className="levitate-home-redesign levitate-home-nav-portal">{pillHeader}</div>;

    return typeof document !== "undefined" ? createPortal(pillHeaderPortal, document.body) : pillHeaderPortal;
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
