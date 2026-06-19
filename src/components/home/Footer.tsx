import { Camera, Music2, Play } from "lucide-react";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <a className="brand" href="#inicio" aria-label="Levitate MX inicio">
          <span className="brand__mark" aria-hidden="true">
            L
          </span>
          <span className="brand__text">Levitate MX</span>
        </a>

        <p>© 2025 Levitate MX. Todos los derechos reservados.</p>

        <nav className="footer-links" aria-label="Legal">
          <a href="#terminos">Términos y condiciones</a>
          <a href="#privacidad">Aviso de privacidad</a>
        </nav>

        <div className="social-links" aria-label="Redes sociales">
          <a href="#instagram" aria-label="Instagram">
            <Camera aria-hidden="true" size={18} />
          </a>
          <a href="#youtube" aria-label="YouTube">
            <Play aria-hidden="true" size={18} />
          </a>
          <a href="#tiktok" aria-label="TikTok">
            <Music2 aria-hidden="true" size={18} />
          </a>
        </div>
      </div>
    </footer>
  );
}
