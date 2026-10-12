type RegistrationApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
  };
};

export class RegistrationApiError extends Error {
  code: string;
  status: number;

  constructor(message: string, status: number, code = "request_error") {
    super(message);
    this.name = "RegistrationApiError";
    this.status = status;
    this.code = code;
  }
}

export async function requestRegistrationApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);

  if (options.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(path, {
    ...options,
    credentials: "same-origin",
    headers,
  });
  const payload: unknown = await response.json().catch((error: unknown) => {
    if (error instanceof Error && error.name === "AbortError") throw error;
    return null;
  });
  const isObject = payload !== null && typeof payload === "object" && !Array.isArray(payload);
  const errorBody = isObject ? payload as RegistrationApiErrorBody : null;

  if (!response.ok) {
    const serverMessage = errorBody?.error?.message;
    const fallbackMessage = response.status >= 500
      ? "El servidor no pudo responder. Actualiza los datos antes de volver a intentar."
      : "No se pudo completar la solicitud.";
    throw new RegistrationApiError(
      typeof serverMessage === "string" && serverMessage.trim() ? serverMessage : fallbackMessage,
      response.status,
      errorBody?.error?.code,
    );
  }

  if (!isObject) {
    throw new RegistrationApiError(
      "No se pudo leer la respuesta del servidor. Actualiza los datos antes de volver a intentar.",
      response.status,
      "invalid_response",
    );
  }

  return payload as T;
}
