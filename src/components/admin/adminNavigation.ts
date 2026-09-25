export const adminSectionPaths = {
  dashboard: "/admin/dashboard",
  followup: "/admin/seguimiento",
  communications: "/admin/comunicacion",
  academies: "/admin/academias",
  registrations: "/admin/inscripciones/participantes",
  choreographers: "/admin/coreografos",
  choreographies: "/admin/coreografias",
  payments: "/admin/inscripciones",
  tickets: "/admin/boletos",
  media: "/admin/foto-video",
  program: "/admin/programa",
} as const;

export type AdminSection = keyof typeof adminSectionPaths;

export function getAdminSectionFromPath(path: string): AdminSection | null {
  const normalized = path.replace(/\/$/, "");
  if (normalized === "/admin") return "dashboard";
  return (
    (Object.keys(adminSectionPaths) as AdminSection[]).find(
      (section) => adminSectionPaths[section] === normalized,
    ) ?? null
  );
}

export function normalizeAdminSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .trim();
}
