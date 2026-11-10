type JudgePortraitSource = {
  name: string;
  photo_data?: string | null;
};

// These are the portraits published in the Estado de México jury lineup.
// Match full identities so Daniel Herrera and Daniel Montalvo stay distinct.
const publishedPortraits = new Map([
  ["danielherrera", "/assets/daniel-herrera.jpg"],
  ["renatapinal", "/assets/renata-pinal.jpg"],
  ["anakarenrojas", "/assets/ana-karen-rojas.jpg"],
  ["danielmontalvo", "/assets/daniel-montalvo.jpg"],
  ["ivonnerobles", "/assets/ivonne-robles.jpg"],
  ["jorgediazdeleon", "/assets/jorge-diaz-de-leon.png"],
  ["jorgediaz", "/assets/jorge-diaz-de-leon.png"],
]);

export function resolveJudgePortrait(judge: JudgePortraitSource): string | undefined {
  const identity = judge.name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  // Eva's portrait is pending; do not show a legacy photo of someone else.
  if (identity === "eva" || identity === "evacarrillo") return undefined;
  return publishedPortraits.get(identity) || judge.photo_data?.trim() || undefined;
}
