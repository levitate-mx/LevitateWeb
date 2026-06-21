import { type ReactNode } from "react";
import { LevitateAuthRoute, LevitateRegistrationRoute } from "./components/admin";
import { HomePage } from "./components/home/HomePage";
import { MediaOverrideRuntime } from "./components/media/MediaOverrideRuntime";
import { MotionGenresPage } from "./components/modalities/MotionGenresPage";
import { PremiationPage } from "./components/premiation/PremiationPage";
import { RegulationsPage } from "./components/regulations/RegulationsPage";
import { RulesPage } from "./components/rules/RulesPage";
import { SedesPage } from "./components/sedes/SedesPage";
import { VenuePage } from "./components/venue/VenuePage";
import { WorkshopsPage } from "./components/workshops/WorkshopsPage";
import { getVenueBySlug } from "./data/venueContent";

function withMediaRuntime(page: ReactNode) {
  return (
    <>
      <MediaOverrideRuntime />
      {page}
    </>
  );
}

export default function App() {
  const evaluationsMatch = window.location.pathname.match(/^\/evaluaciones\/?$/);
  const aerialEvaluationsMatch = window.location.pathname.match(/^\/modalidades\/levitate-aerial\/evaluacion\/?$/);
  const adminMediaMatch = window.location.pathname.match(/^\/admin\/imagenes\/?$/);
  const regulationsMatch = window.location.pathname.match(/^\/reglamentos?\/?$/);
  const loginMatch = window.location.pathname.match(/^\/login\/?$/);
  const premiationMatch = window.location.pathname.match(/^\/premiacion\/?$/);
  const registrationMatch = window.location.pathname.match(/^\/registro\/?$/);
  const motionGenresMatch = window.location.pathname.match(/^\/modalidades\/levitate-motion\/generos\/?$/);
  const sedesMatch = window.location.pathname.match(/^\/sedes\/?$/);
  const workshopsMatch = window.location.pathname.match(/^\/workshops\/?$/);
  const venueMatch = window.location.pathname.match(/^\/sedes\/([^/]+)\/?$/);

  if (adminMediaMatch) {
    return withMediaRuntime(<LevitateRegistrationRoute initialScreen="media" />);
  }

  if (registrationMatch) {
    return withMediaRuntime(<LevitateRegistrationRoute />);
  }

  if (loginMatch) {
    return withMediaRuntime(<LevitateAuthRoute />);
  }

  if (premiationMatch) {
    return withMediaRuntime(<PremiationPage />);
  }

  if (motionGenresMatch) {
    return withMediaRuntime(<MotionGenresPage />);
  }

  if (regulationsMatch) {
    return withMediaRuntime(<RegulationsPage />);
  }

  if (evaluationsMatch) {
    return withMediaRuntime(<RulesPage />);
  }

  if (aerialEvaluationsMatch) {
    return withMediaRuntime(<RulesPage modality="aerial" />);
  }

  if (sedesMatch) {
    return withMediaRuntime(<SedesPage />);
  }

  if (workshopsMatch) {
    return withMediaRuntime(<WorkshopsPage />);
  }

  if (venueMatch) {
    const venueSlug = venueMatch[1];

    if (venueSlug === "ciudad-de-mexico" || venueSlug === "cdmx") {
      return withMediaRuntime(<SedesPage venueKey="cdmx" />);
    }

    if (venueSlug === "puebla" || venueSlug === "monterrey") {
      return withMediaRuntime(<SedesPage venueKey="puebla" />);
    }

    if (venueSlug === "estado-de-mexico" || venueSlug === "edomex" || venueSlug === "silo-dallas") {
      return withMediaRuntime(<SedesPage venueKey="edomex" />);
    }

    return withMediaRuntime(<VenuePage venue={getVenueBySlug(venueMatch[1])} />);
  }

  return withMediaRuntime(<HomePage />);
}
