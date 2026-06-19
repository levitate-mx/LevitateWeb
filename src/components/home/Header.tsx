import { ArrowRight, Menu, X } from "lucide-react";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { megaMenuItems, navLinks } from "../../data/homeContent";
import { Button } from "../ui/Button";

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMegaOpen, setIsMegaOpen] = useState(false);
  const [activeMegaIndex, setActiveMegaIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => {
      setIsScrolled(window.scrollY > 18);

      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollable > 0 ? Math.min(window.scrollY / scrollable, 1) : 0;
      document.documentElement.style.setProperty("--page-progress", progress.toFixed(4));
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle("menu-open", isMenuOpen);

    if (!isMenuOpen) return;

    const focusable = menuRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    focusable?.[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
        setIsMegaOpen(false);
        toggleRef.current?.focus();
      }

      if (event.key !== "Tab" || !focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.classList.remove("menu-open");
    };
  }, [isMenuOpen]);

  useEffect(() => {
    if (!isMegaOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMegaOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isMegaOpen]);

  const closeMenu = () => {
    setIsMenuOpen(false);
    setIsMegaOpen(false);
  };

  return (
    <header
      className={`site-header ${isScrolled ? "is-scrolled" : ""} ${isMegaOpen ? "is-mega-open" : ""}`}
      onMouseLeave={() => setIsMegaOpen(false)}
    >
      <a className="brand" href="/#inicio" aria-label="Levitate MX inicio" onClick={closeMenu}>
        <span className="brand__mark" aria-hidden="true">
          L
        </span>
        <span className="brand__text">Levitate MX</span>
      </a>

      <nav className="header-nav" aria-label="Navegacion principal">
        {navLinks.map((link, index) => (
          <a
            href={link.href}
            key={link.label}
            className="header-nav__link"
            style={{ animationDelay: `${220 + index * 55}ms` }}
          >
            {link.label}
          </a>
        ))}
        <button
          type="button"
          className="header-nav__link header-nav__button"
          aria-expanded={isMegaOpen}
          aria-controls="mega-menu"
          style={{ animationDelay: `${220 + navLinks.length * 55}ms` }}
          onClick={() => setIsMegaOpen((current) => !current)}
          onFocus={() => setIsMegaOpen(true)}
          onMouseEnter={() => setIsMegaOpen(true)}
        >
          Explorar
        </button>
      </nav>

      <div className="header-actions">
        <button
          ref={toggleRef}
          className="menu-toggle"
          type="button"
          aria-label={isMenuOpen ? "Cerrar menu" : "Abrir menu"}
          aria-controls="mobile-menu"
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen((current) => !current)}
        >
          {isMenuOpen ? <X aria-hidden="true" size={24} /> : <Menu aria-hidden="true" size={24} />}
        </button>
      </div>

      <div
        ref={menuRef}
        id="mobile-menu"
        className={`mobile-menu ${isMenuOpen ? "is-open" : ""}`}
        aria-hidden={!isMenuOpen}
      >
        <nav className="mobile-menu__nav" aria-label="Navegacion movil">
          {navLinks
            .filter((link) => link.label === "Inicio")
            .map((link) => (
            <a
              href={link.href}
              key={link.label}
              onClick={closeMenu}
              style={{ "--mobile-delay": "120ms" } as CSSProperties}
              tabIndex={isMenuOpen ? 0 : -1}
            >
              {link.label}
            </a>
          ))}
          {megaMenuItems.map((link, index) => (
            <a
              href={link.href}
              key={link.label}
              onClick={closeMenu}
              style={{ "--mobile-delay": `${190 + index * 70}ms` } as CSSProperties}
              tabIndex={isMenuOpen ? 0 : -1}
            >
              {link.label}
            </a>
          ))}
        </nav>
        <Button href="/#eventos" onClick={closeMenu} tabIndex={isMenuOpen ? 0 : -1}>
          Ver sedes
        </Button>
      </div>

      <div id="mega-menu" className="mega-menu" aria-hidden={!isMegaOpen}>
        <div className="mega-menu__inner">
          <div className="mega-menu__copy">
            <span>Explorar Levitate</span>
            <p>Competencia, formación, comunidad y sedes en una experiencia escénica.</p>
          </div>
          <nav className="mega-menu__links" aria-label="Explorar Levitate">
            {megaMenuItems.map((item, index) => (
              <a
                href={item.href}
                key={item.label}
                className={index === activeMegaIndex ? "is-active" : ""}
                tabIndex={isMegaOpen ? 0 : -1}
                onFocus={() => setActiveMegaIndex(index)}
                onMouseEnter={() => setActiveMegaIndex(index)}
                onClick={closeMenu}
              >
                <span>{item.label}</span>
                <ArrowRight aria-hidden="true" size={22} />
              </a>
            ))}
          </nav>
          <div className="mega-menu__preview" aria-hidden="true">
            {megaMenuItems.map((item, index) => (
              <img
                src={item.image}
                alt=""
                key={item.label}
                className={index === activeMegaIndex ? "is-active" : ""}
              />
            ))}
            <div>
              <span>{megaMenuItems[activeMegaIndex].label}</span>
              <p>{megaMenuItems[activeMegaIndex].description}</p>
            </div>
          </div>
        </div>
      </div>

      <span className="scroll-progress" aria-hidden="true" />
    </header>
  );
}
