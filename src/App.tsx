import { LevitateAuthRoute, LevitateRegistrationRoute } from "./components/admin";
import { HomePage } from "./components/home/HomePage";
import { MotionGenresPage } from "./components/modalities/MotionGenresPage";
import { PremiationPage } from "./components/premiation/PremiationPage";
import { RegulationsPage } from "./components/regulations/RegulationsPage";
import { RulesPage } from "./components/rules/RulesPage";
import { SedesPage } from "./components/sedes/SedesPage";
import { VenuePage } from "./components/venue/VenuePage";
import { WorkshopsPage } from "./components/workshops/WorkshopsPage";
import { getVenueBySlug } from "./data/venueContent";

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
    return <LevitateRegistrationRoute />;
  }

  if (registrationMatch) {
    return <LevitateRegistrationRoute />;
  }

  if (loginMatch) {
    return <LevitateAuthRoute />;
  }

  if (premiationMatch) {
    return <PremiationPage />;
  }

  if (motionGenresMatch) {
    return <MotionGenresPage />;
  }

  if (regulationsMatch) {
    return <RegulationsPage />;
  }

  if (evaluationsMatch) {
    return <RulesPage />;
  }

  if (aerialEvaluationsMatch) {
    return <RulesPage modality="aerial" />;
  }

  if (sedesMatch) {
    return <SedesPage />;
  }

  if (workshopsMatch) {
    return <WorkshopsPage />;
  }

  if (venueMatch) {
    const venueSlug = venueMatch[1];

    if (venueSlug === "ciudad-de-mexico" || venueSlug === "cdmx") {
      return <SedesPage venueKey="cdmx" />;
    }

    if (venueSlug === "puebla" || venueSlug === "monterrey") {
      return <SedesPage venueKey="puebla" />;
    }

    if (venueSlug === "estado-de-mexico" || venueSlug === "edomex" || venueSlug === "silo-dallas") {
      return <SedesPage venueKey="edomex" />;
    }

    return <VenuePage venue={getVenueBySlug(venueMatch[1])} />;
  }

  return <HomePage />;
}
