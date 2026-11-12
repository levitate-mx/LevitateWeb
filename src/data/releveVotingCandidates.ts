export type ReleveVotingCandidate = {
  id: string;
  name: string;
  photo: string | null;
  photoPosition: string;
};

// Public gallery approved through the supplied photos, in attachment order.
// Mariana's place stays visible until her photo is supplied.
export const releveVotingCandidates: readonly ReleveVotingCandidate[] = [
  { id: "estrella-mistica", name: "ESTRELLA MÍSTICA", photo: "/assets/releve-voting/estrella-mistica.webp", photoPosition: "50% 62%" },
  { id: "queen-of-cosmic-fever", name: "QUEEN OF COSMIC FEVER", photo: "/assets/releve-voting/queen-of-cosmic-fever.webp", photoPosition: "50% 55%" },
  { id: "damar", name: "Damar", photo: "/assets/releve-voting/damar.webp", photoPosition: "50% 100%" },
  { id: "hazel", name: "Hazel", photo: "/assets/releve-voting/hazel.webp", photoPosition: "50% 48%" },
  { id: "mariana", name: "Mariana", photo: null, photoPosition: "50% 50%" },
];
