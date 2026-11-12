export type RegistrationRole = "academy" | "admin" | "judge" | "judging_admin";

export const judgingAdminPath = "/jueceo/admin";
export const judgingReportPath = `${judgingAdminPath}?view=report`;
export const releveVotingPath = "/votacion-releve";

export function getRegistrationHomePath(role?: RegistrationRole): string {
  if (role === "judging_admin") return judgingAdminPath;
  if (role === "judge") return "/jueceo/app/";
  if (role === "admin") return "/admin/dashboard";
  return "/registro/academias";
}
