import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { CheckCircle2, Cloud, Folder, RefreshCw } from "lucide-react";
import { requestRegistrationApi } from "./registrationApi";
import "./MediaDriveConnectionPanel.css";

export type MediaDriveConnection = {
  status: "connected" | "missing_configuration" | "error";
  credentialsPresent: boolean;
  validated: boolean;
  authType?: string;
  account?: { displayName: string; emailAddress: string };
  storage?: Record<string, string | null>;
  checkedAt: string;
  message: string;
  folder: {
    id: string;
    name: string;
    driveId: string | null;
    status: "ready" | "error";
    validated: boolean;
    canAddChildren: boolean;
    message?: string;
  } | null;
};

type MediaDriveConnectionPayload = { connection: MediaDriveConnection };

function readConnection(payload: MediaDriveConnectionPayload): MediaDriveConnection {
  const connection = payload?.connection;
  if (!connection || !["connected", "missing_configuration", "error"].includes(connection.status)
    || typeof connection.validated !== "boolean" || typeof connection.credentialsPresent !== "boolean"
    || (connection.status === "connected" && !connection.validated)
    || (connection.folder !== null && (!connection.folder || typeof connection.folder.id !== "string"
      || !connection.folder.id.trim() || typeof connection.folder.name !== "string"
      || !["ready", "error"].includes(connection.folder.status) || typeof connection.folder.validated !== "boolean"
      || typeof connection.folder.canAddChildren !== "boolean"))) {
    throw new Error("No se pudo leer el estado de Drive. Comprueba la conexión de nuevo.");
  }
  return connection;
}

export function MediaDriveConnectionPanel() {
  const [connection, setConnection] = useState<MediaDriveConnection | null>(null);
  const [folderInput, setFolderInput] = useState("");
  const [operation, setOperation] = useState<"check" | "folder" | null>("check");
  const [error, setError] = useState("");
  const [checkFailed, setCheckFailed] = useState(false);
  const [notice, setNotice] = useState("");
  const activeRequest = useRef<AbortController | null>(null);
  const formId = useId();

  const request = async (folder?: string) => {
    if (activeRequest.current) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    setOperation(folder === undefined ? "check" : "folder");
    setError("");
    setCheckFailed(false);
    setNotice("");
    try {
      const payload = await requestRegistrationApi<MediaDriveConnectionPayload>(
        `/api/registration/admin/media-drive/${folder === undefined ? "connection" : "folder"}`,
        folder === undefined
          ? { signal: controller.signal }
          : { method: "POST", body: JSON.stringify({ folder }), signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      const nextConnection = readConnection(payload);
      setConnection(nextConnection);
      if (nextConnection.folder?.status === "error") {
        setFolderInput((current) => current || nextConnection.folder!.id);
      }
      if (folder !== undefined && nextConnection.status === "connected" && nextConnection.folder?.status === "ready"
        && nextConnection.folder.validated) {
        setFolderInput("");
        setNotice("Carpeta verificada y vinculada.");
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setError(error instanceof Error ? error.message : "No se pudo comprobar Drive. Intenta de nuevo.");
        setCheckFailed(folder === undefined);
      }
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        if (!controller.signal.aborted) setOperation(null);
      }
    }
  };

  useEffect(() => {
    void request();
    return () => {
      activeRequest.current?.abort();
      activeRequest.current = null;
    };
  }, []);

  const submitFolder = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const folder = folderInput.trim();
    if (operation || connection?.status !== "connected") return;
    if (!folder) {
      setError("Pega el enlace o ID de una carpeta de Drive.");
      return;
    }
    void request(folder);
  };

  const connected = connection?.status === "connected";
  const folderReady = connection?.folder?.status === "ready" && connection.folder.validated;
  const statusTitle = checkFailed ? "No se pudo comprobar Drive"
    : !connection ? "Comprobando conexión..."
      : connected ? "Drive conectado"
        : connection.status === "missing_configuration" ? "Falta configurar Drive"
          : "No se pudo conectar con Drive";
  const statusDescription = connection?.status === "missing_configuration"
    ? "Completa la conexión de Drive en el servidor y vuelve a comprobarla."
    : connection?.status === "error" ? connection.message || "Revisa la conexión de Drive e intenta de nuevo."
      : "Vincula la carpeta donde organizarás las fotos y los videos del evento.";

  return (
    <section className="media-drive-connection" aria-label="Conexión de foto y video con Drive" aria-busy={Boolean(operation)}>
      <header className="media-drive-connection__header">
        <div className="media-drive-connection__heading">
          <Cloud aria-hidden="true" size={23} />
          <div>
            <h2>Drive para foto y video</h2>
            <p>{statusDescription}</p>
          </div>
        </div>
        <button disabled={Boolean(operation)} onClick={() => void request()} type="button">
          <RefreshCw aria-hidden="true" size={16} />
          {operation === "check" ? "Comprobando..." : "Comprobar conexión"}
        </button>
      </header>

      <div className="media-drive-connection__status" role="status" aria-live="polite">
        <span className={`media-drive-connection__badge${connected && !checkFailed ? " is-connected" : ""}`}>
          {connected && !checkFailed ? <CheckCircle2 aria-hidden="true" size={15} /> : null}
          {statusTitle}
        </span>
        {connected && !connection.folder ? <span>Carpeta pendiente</span> : null}
        {connection?.folder ? (
          <span className="media-drive-connection__folder">
            <Folder aria-hidden="true" size={16} />
            {folderReady ? "Carpeta vinculada:" : "Carpeta por verificar:"} <strong>{connection.folder.name || connection.folder.id}</strong>
          </span>
        ) : null}
        {folderReady && !connection?.folder?.canAddChildren ? <span>Acceso de lectura</span> : null}
      </div>

      {connected && connection.account?.emailAddress ? (
        <p className="media-drive-connection__account">
          Cuenta conectada: <strong>{connection.account.displayName || connection.account.emailAddress}</strong>
          {connection.account.displayName ? <span>{connection.account.emailAddress}</span> : null}
          <span>La cuenta conectada debe tener acceso a la carpeta.</span>
        </p>
      ) : null}

      {connected && connection.folder && !folderReady ? (
        <p className="media-drive-connection__error" role="alert">
          {connection.folder.message || "No se pudo verificar el acceso a la carpeta. Revisa sus permisos o elige otra carpeta."}
        </p>
      ) : null}

      {error ? <p className="media-drive-connection__error" role="alert">{error}</p> : null}
      {notice ? <p className="media-drive-connection__notice" role="status">{notice}</p> : null}

      {connected ? (
        <form className="media-drive-connection__form" onSubmit={submitFolder}>
          <label htmlFor={`${formId}-folder`}>
            {connection.folder ? "Verificar esta carpeta o vincular otra" : "Carpeta de foto y video"}
            <input
              autoComplete="off"
              disabled={Boolean(operation)}
              id={`${formId}-folder`}
              onChange={(event) => { setFolderInput(event.target.value); setError(""); setNotice(""); }}
              placeholder="Pega el enlace o ID de la carpeta"
              type="text"
              value={folderInput}
            />
          </label>
          <button disabled={Boolean(operation) || !folderInput.trim()} type="submit">
            {operation === "folder" ? "Verificando carpeta..." : "Verificar y vincular carpeta"}
          </button>
          <p>Vincular la carpeta no publica ni importa sus archivos.</p>
        </form>
      ) : null}
    </section>
  );
}
