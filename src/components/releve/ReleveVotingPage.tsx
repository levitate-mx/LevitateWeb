import { ReleveVotingPreview } from "../admin/ReleveVotingPreview";
import "./ReleveVotingPage.css";

export function ReleveVotingPage() {
  return (
    <div className="releve-voting-page">
      <title>Votación Relevé | Levitate MX</title>
      <meta name="robots" content="noindex, nofollow" />
      <header className="releve-voting-page__bar">
        <a className="releve-voting-page__brand" href="/" aria-label="Levitate MX · Inicio">
          <img src="/assets/levitate-logo-mx.png" alt="Levitate MX" />
        </a>
      </header>
      <main className="releve-voting-page__content">
        <header className="releve-voting-page__heading">
          <p>EL PÚBLICO ELIGE</p>
          <h1>Votación <span>Relevé.</span></h1>
        </header>
        <div className="releve-voting-page__preview">
          <ReleveVotingPreview standalone />
        </div>
      </main>
    </div>
  );
}
