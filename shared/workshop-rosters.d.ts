export type WorkshopRosterSession = { label: string; start: string };
export function buildWorkshopRosters<Row extends { name: string; academyName: string; workshops: string[] }>(rows: Row[], sessions?: WorkshopRosterSession[]): { label: string; worksheetName: string; participants: Row[] }[];
