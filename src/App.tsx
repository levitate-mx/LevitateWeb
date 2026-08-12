import {
  LevitateAuthRoute,
  LevitateRegistrationAdminPaymentsRoute,
  LevitateRegistrationEntryRoute,
  LevitateRegistrationRoute,
  LevitateStudentRegistrationRoute,
} from "./components/admin";
import { HallOfFamePage } from "./components/hall-of-fame/HallOfFamePage";
import { HomePage } from "./components/home/HomePage";
import { InscripcionesConsultaPage, InscripcionesPage } from "./components/inscripciones/InscripcionesPage";
import { MotionGenresPage } from "./components/modalities/MotionGenresPage";
import {
  PassportAdminPage,
  PassportCertificatePage,
  PassportClaimPage,
  PassportOverviewPage,
  PassportStationPage,
} from "./components/passport/PassportPages";
import { HospedajePage } from "./components/hospedaje/HospedajePage";
import { PremiationPage } from "./components/premiation/PremiationPage";
import { RelevePage } from "./components/releve/RelevePage";
import { RulesPage } from "./components/rules/RulesPage";
import { SedesPage } from "./components/sedes/SedesPage";
import { ShopPage } from "./components/shop/ShopPage";
import { WorkshopsPage } from "./components/workshops/WorkshopsPage";

export default function App() {
  const searchParams = new URLSearchParams(window.location.search);
  const evaluationsMatch = window.location.pathname.match(/^\/evaluaciones\/?$/);
  const aerialEvaluationsMatch = window.location.pathname.match(/^\/modalidades\/levitate-aerial\/evaluacion\/?$/);
  const adminMediaMatch = window.location.pathname.match(/^\/admin\/imagenes\/?$/);
  const loginMatch = window.location.pathname.match(/^\/login\/?$/);
  const hallOfFameMvpsMatch = window.location.pathname.match(/^\/salon-de-la-fama\/mvps\/?$/);
  const hospedajeMatch = window.location.pathname.match(/^\/hospedaje\/?$/);
  const inscripcionesConsultaMatch = window.location.pathname.match(/^\/inscripciones\/consulta-curp\/?$/);
  const inscripcionesMatch = window.location.pathname.match(/^\/inscripciones\/?$/);
  const registrationAdminDashboardMatch = window.location.pathname.match(/^\/admin(?:\/dashboard)?\/?$/);
  const registrationAdminAcademiesMatch = window.location.pathname.match(/^\/admin\/academias\/?$/);
  const registrationAdminChoreographersMatch = window.location.pathname.match(/^\/admin\/coreografos\/?$/);
  const registrationAdminPaymentsMatch = window.location.pathname.match(/^\/admin\/inscripciones\/?$/);
  const registrationAdminParticipantsMatch = window.location.pathname.match(/^\/admin\/inscripciones\/participantes\/?$/);
  const registrationAdminTicketsMatch = window.location.pathname.match(/^\/admin\/boletos\/?$/);
  const registrationAdminProgramMatch = window.location.pathname.match(/^\/admin\/programa\/?$/);
  const registrationAdminPhotoVideoMatch = window.location.pathname.match(/^\/admin\/foto-video\/?$/);
  const premiationMatch = window.location.pathname.match(/^\/premiacion\/?$/);
  const releveMatch = window.location.pathname.match(/^\/(?:releve|premio-releve|modalidades\/(?:releve|levitate-releve))\/?$/);
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
  const shopTicketsMatch = window.location.pathname.match(/^\/(?:taquilla|tienda\/(?:boletos|taquilla))\/?$/);
  const shopMediaMatch = window.location.pathname.match(/^\/(?:foto-video|fotografia-video|fotografia-y-video|tienda\/(?:foto-video|fotografia-video|fotografia-y-video))\/?$/);
  const shopMatch = window.location.pathname.match(/^\/tienda\/?$/);
  const workshopsMatch = window.location.pathname.match(/^\/workshops\/?$/);
  const venueMatch = window.location.pathname.match(/^\/sedes\/([^/]+)\/?$/);
  const loginType = searchParams.get("tipo");

  if (adminMediaMatch) {
    return <LevitateRegistrationRoute />;
  }

  if (registrationAdminDashboardMatch) {
    return <LevitateRegistrationAdminPaymentsRoute initialSection="dashboard" />;
  }

  if (registrationAdminAcademiesMatch) {
    return <LevitateRegistrationAdminPaymentsRoute initialSection="academies" />;
  }

  if (registrationAdminChoreographersMatch) {
    return <LevitateRegistrationAdminPaymentsRoute initialSection="choreographers" />;
  }

  if (registrationAdminPaymentsMatch) {
    return <LevitateRegistrationAdminPaymentsRoute />;
  }

  if (registrationAdminParticipantsMatch) {
    return <LevitateRegistrationAdminPaymentsRoute initialSection="registrations" />;
  }

  if (registrationAdminTicketsMatch) {
    return <LevitateRegistrationAdminPaymentsRoute initialSection="tickets" />;
  }

  if (registrationAdminProgramMatch) {
    return <LevitateRegistrationAdminPaymentsRoute initialSection="program" />;
  }

  if (registrationAdminPhotoVideoMatch) {
    return <LevitateRegistrationAdminPaymentsRoute initialSection="media" />;
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

  if (hospedajeMatch) {
    return <HospedajePage />;
  }

  if (inscripcionesConsultaMatch) {
    return <InscripcionesConsultaPage />;
  }

  if (inscripcionesMatch) {
    return <InscripcionesPage />;
  }

  if (premiationMatch) {
    return <PremiationPage />;
  }

  if (releveMatch) {
    return <RelevePage />;
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

  if (shopTicketsMatch) {
    return <ShopPage initialMode="tickets" />;
  }

  if (shopMediaMatch) {
    return <ShopPage initialMode="media" />;
  }

  if (shopMatch) {
    return <ShopPage />;
  }

  if (workshopsMatch) {
    return <WorkshopsPage />;
  }

  if (venueMatch) {
    const venueSlug = venueMatch[1];

    if (venueSlug === "estado-de-mexico" || venueSlug === "edomex") {
      return <SedesPage venueKey="edomex" />;
    }

    if (venueSlug === "veracruz") {
      return <SedesPage venueKey="veracruz" />;
    }

    return <HomePage />;
  }

  return <HomePage />;
}
