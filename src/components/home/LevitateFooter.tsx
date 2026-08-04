type LevitateFooterProps = {
  useRootLinks?: boolean;
};

const contactEmail = "info.levitatemx@gmail.com";

const socialLinks = [
  { label: "Instagram", href: "https://www.instagram.com/levitate.mx/" },
  { label: "Facebook", href: "https://www.facebook.com/mx.levitate/" },
  { label: "WhatsApp", href: "https://whatsapp.com/channel/0029Vb92P9iBvvsmXv0crE0L" },
];

export function LevitateFooter(_props: LevitateFooterProps) {
  return (
    <footer className="levitate-footer" aria-label="Contacto Levitate">
      <div className="levitate-footer__inner">
        <p className="levitate-footer__brand">
          LevitateMX<sup>®</sup>
        </p>

        <a className="levitate-footer__contact" href={`mailto:${contactEmail}`}>{contactEmail}</a>

        <nav className="levitate-footer__socials" aria-label="Síguenos">
          <span>Síguenos</span>
          {socialLinks.map((link) => (
            <a href={link.href} key={link.label} rel="noreferrer" target="_blank">
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
