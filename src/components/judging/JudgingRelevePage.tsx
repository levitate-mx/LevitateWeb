import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { ReleveVotingPreview } from "../admin/ReleveVotingPreview";
import { RegistrationApiError, requestRegistrationApi } from "../admin/registrationApi";
import { getRegistrationHomePath, judgingAdminPath, judgingReportPath, judgingRelevePath } from "../admin/registrationAccess";
import type { RegistrationRole } from "../admin/registrationAccess";
import "./JudgingRelevePage.css";

type JudgingSession = { user: { name: string; role: RegistrationRole } };

export function JudgingRelevePage() {
  const [session, setSession] = useState<JudgingSession | null>(null);
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    requestRegistrationApi<JudgingSession>("/api/registration/me", { signal: controller.signal })
      .then((current) => {
        if (controller.signal.aborted) return;
        if (current.user.role !== "admin" && current.user.role !== "judging_admin") {
          location.replace(getRegistrationHomePath(current.user.role));
          return;
        }
        setSession(current);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        if (reason instanceof RegistrationApiError && reason.status === 401) {
          location.replace("/login");
          return;
        }
        setError(reason instanceof Error ? reason.message : "No se pudo validar el acceso a Relevé.");
      });
    return () => controller.abort();
  }, []);

  async function logout() {
    setLoggingOut(true);
    setError("");
    try {
      await requestRegistrationApi("/api/registration/auth/logout", { method: "POST" });
      location.replace("/login");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo cerrar la sesión.");
      setLoggingOut(false);
    }
  }

  if (!session) {
    return (
      <main className="judging-releve-page judging-releve-page--loading" aria-busy={!error}>
        {error ? <><p role="alert">{error}</p><a href="/login">Iniciar sesión</a></> : <p>Validando acceso a Relevé…</p>}
      </main>
    );
  }

  return (
    <div className="judging-releve-page">
      <header className="judging-releve-page__bar">
        <a className="judging-releve-page__brand" href={judgingAdminPath} aria-label="Inicio de jueceo">
          <img src="/assets/levitate-logo-mx.png" alt="Levitate MX" />
        </a>
        <nav aria-label="Espacio de jueceo">
          <a href={judgingAdminPath}>Jueceo</a>
          <a href={judgingReportPath}>Dictamen final</a>
          <a href={judgingRelevePath} aria-current="page">Votación Relevé</a>
        </nav>
        <button type="button" onClick={() => void logout()} disabled={loggingOut}>
          <LogOut size={18} aria-hidden="true" />
          {loggingOut ? "Cerrando…" : "Cerrar sesión"}
        </button>
      </header>
      <main className="judging-releve-page__content">
        <header className="judging-releve-page__heading">
          <p>ESPACIO DE JUECEO</p>
          <h1>Votación <span>Relevé.</span></h1>
        </header>
        {error ? <p className="judging-releve-page__error" role="alert">{error}</p> : null}
        <div className="judging-releve-page__preview">
          <ReleveVotingPreview />
        </div>
      </main>
    </div>
  );
}
