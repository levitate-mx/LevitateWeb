export type CompetitionMedal = "oro" | "plata" | "bronce" | "participacion";
export function competitionMedalForScore(score: number | null, maximumScore: number): CompetitionMedal | null;
