import { LevitateAuthRoute, LevitateRegistrationRoute } from "./components/admin";
import { HomePage } from "./components/home/HomePage";
import { MotionGenresPage } from "./components/modalities/MotionGenresPage";
import { PremiationPage } from "./components/premiation/PremiationPage";
import { RulesPage } from "./components/rules/RulesPage";
import { SedesPage } from "./components/sedes/SedesPage";
import { VenuePage } from "./components/venue/VenuePage";
import { WorkshopsPage } from "./components/workshops/WorkshopsPage";
import { getVenueBySlug } from "./data/venueContent";

export default function App() {
  const evaluationsMatch = window.location.pathname.match(/^\/evaluaciones\/?$/);
  const legacyRulesMatch = window.location.pathname.match(/^\/reglamento\/?$/);
  const loginMatch = window.location.pathname.match(/^\/login\/?$/);
  const premiationMatch = window.location.pathname.match(/^\/premiacion\/?$/);
  const registrationMatch = window.location.pathname.match(/^\/registro\/?$/);
  const motionGenresMatch = window.location.pathname.match(/^\/modalidades\/levitate-motion\/generos\/?$/);
  const sedesMatch = window.location.pathname.match(/^\/sedes\/?$/);
  const workshopsMatch = window.location.pathname.match(/^\/workshops\/?$/);
  const venueMatch = window.location.pathname.match(/^\/sedes\/([^/]+)\/?$/);

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

  if (evaluationsMatch || legacyRulesMatch) {
    return <RulesPage />;
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
