import { ArrowDownRight, Sparkles } from "lucide-react";
import { ReleveVotingPreview } from "../admin/ReleveVotingPreview";
import { LevitateFooter } from "../home/LevitateFooter";
import { LevitateHeader } from "../home/LevitateHeader";
import "./ReleveVotingPage.css";

export function ReleveVotingPage() {
  return (
    <main className="releve-voting-page levitate-home-redesign">
      <title>Votación Relevé | Levitate MX</title>
      <meta name="robots" content="noindex, nofollow" />
      <section className="releve-voting-hero" id="inicio">
        <LevitateHeader activeLabel="" tone="light" useRootLinks variant="pill" />
        <div className="releve-voting-hero__content">
          <div className="releve-voting-hero__copy">
            <p className="releve-voting-page__kicker">Levitate · Votación Relevé</p>
            <h1><span>El público</span><span>elige <em>Relevé.</em></span></h1>
            <p className="releve-voting-hero__description">
              Hay momentos que se quedan contigo. Elige al maestro que te hizo sentir algo y dale tu aplauso.
            </p>
            <a className="releve-voting-hero__button" href="#votacion">Conocer candidatos<ArrowDownRight size={20} aria-hidden="true" /></a>
          </div>
          <aside className="releve-voting-hero__guide" aria-label="Cómo participar">
            <Sparkles size={32} strokeWidth={1.3} aria-hidden="true" />
            <p>La ovación<br />también se elige.</p>
            <ol>
              <li><span>01</span>Elige Motion o Aerial.</li>
              <li><span>02</span>Encuentra a tu favorito.</li>
              <li><span>03</span>Haz que tu aplauso cuente.</li>
            </ol>
            <small>Experiencia de prueba con candidatos de ejemplo. No se registran votos reales.</small>
          </aside>
        </div>
      </section>
      <section className="releve-voting-page__ballot" id="votacion" aria-label="Elige tu favorito de Relevé">
        <ReleveVotingPreview standalone />
      </section>
      <LevitateFooter useRootLinks />
    </main>
  );
}
