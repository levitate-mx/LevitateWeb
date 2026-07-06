import {
  LevitateAuthRoute,
  LevitateRegistrationEntryRoute,
  LevitateRegistrationRoute,
  LevitateStudentRegistrationRoute,
} from "./components/admin";
import { HallOfFamePage } from "./components/hall-of-fame/HallOfFamePage";
import { HomePage } from "./components/home/HomePage";
import { InscripcionesPage } from "./components/inscripciones/InscripcionesPage";
import { MotionGenresPage } from "./components/modalities/MotionGenresPage";
import {
  PassportAdminPage,
  PassportCertificatePage,
  PassportClaimPage,
  PassportOverviewPage,
  PassportStationPage,
} from "./components/passport/PassportPages";
import { PremiationPage } from "./components/premiation/PremiationPage";
import { RulesPage } from "./components/rules/RulesPage";
import { SedesPage } from "./components/sedes/SedesPage";
import { ShopPage } from "./components/shop/ShopPage";
import { VenuePage } from "./components/venue/VenuePage";
import { WorkshopsPage } from "./components/workshops/WorkshopsPage";
import { getVenueBySlug } from "./data/venueContent";

export default function App() {
  const evaluationsMatch = window.location.pathname.match(/^\/evaluaciones\/?$/);
  const aerialEvaluationsMatch = window.location.pathname.match(/^\/modalidades\/levitate-aerial\/evaluacion\/?$/);
  const adminMediaMatch = window.location.pathname.match(/^\/admin\/imagenes\/?$/);
  const loginMatch = window.location.pathname.match(/^\/login\/?$/);
  const hallOfFameMvpsMatch = window.location.pathname.match(/^\/salon-de-la-fama\/mvps\/?$/);
  const inscripcionesMatch = window.location.pathname.match(/^\/inscripciones\/?$/);
  const premiationMatch = window.location.pathname.match(/^\/premiacion\/?$/);
  const registrationMatch = window.location.pathname.match(/^\/registro\/?$/);
  const academyRegistrationMatch = window.location.pathname.match(/^\/registro\/academias\/?$/);
  const studentRegistrationMatch = window.location.pathname.match(/^\/registro\/alumnos\/?$/);
  const motionGenresMatch = window.location.pathname.match(/^\/modalidades\/levitate-motion\/generos\/?$/);
  const passportAdminMatch = window.location.pathname.match(/^\/admin\/(?:pasaporte-colibri|passports)\/?$/);
  const passportCertificateMatch = window.location.pathname.match(/^\/passport\/certificate\/?$/);
  const passportClaimMatch = window.location.pathname.match(/^\/passport\/claim\/?$/);
  const passportMatch = window.location.pathname.match(/^\/passport\/?$/);
  const passportStationMatch = window.location.pathname.match(/^\/e\/([^/]+)\/station\/([^/]+)\/?$/);
  const sedesMatch = window.location.pathname.match(/^\/sedes\/?$/);
  const shopMatch = window.location.pathname.match(/^\/tienda\/?$/);
  const workshopsMatch = window.location.pathname.match(/^\/workshops\/?$/);
  const venueMatch = window.location.pathname.match(/^\/sedes\/([^/]+)\/?$/);
  const loginType = new URLSearchParams(window.location.search).get("tipo");

  if (adminMediaMatch) {
    return <LevitateRegistrationRoute />;
  }

  if (registrationMatch) {
    return <LevitateRegistrationEntryRoute />;
  }

  if (academyRegistrationMatch) {
    return <LevitateRegistrationRoute />;
  }

  if (studentRegistrationMatch) {
    return <LevitateStudentRegistrationRoute />;
  }

  if (loginMatch) {
    if (loginType === "alumno") {
      return <LevitateStudentRegistrationRoute />;
    }

    if (loginType === "academia") {
      return <LevitateRegistrationRoute />;
    }

    return <LevitateAuthRoute />;
  }

  if (hallOfFameMvpsMatch) {
    return <HallOfFamePage />;
  }

  if (inscripcionesMatch) {
    return <InscripcionesPage />;
  }

  if (premiationMatch) {
    return <PremiationPage />;
  }

  if (motionGenresMatch) {
    return <MotionGenresPage />;
  }

  if (passportAdminMatch) {
    return <PassportAdminPage />;
  }

  if (passportClaimMatch) {
    return <PassportClaimPage token={new URLSearchParams(window.location.search).get("token")} />;
  }

  if (passportCertificateMatch) {
    return <PassportCertificatePage />;
  }

  if (passportMatch) {
    return <PassportOverviewPage />;
  }

  if (passportStationMatch) {
    return <PassportStationPage eventSlug={passportStationMatch[1]} stationSlug={passportStationMatch[2]} />;
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

  if (shopMatch) {
    return <ShopPage />;
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
