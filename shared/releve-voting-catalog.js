// Public gallery approved through the supplied photos, in attachment order.
// Mariana's place stays visible until her photo is supplied.
export const releveVotingCandidates = Object.freeze([
  { id: "estrella-mistica", academy: "Trepando el Trapo", choreography: "ESTRELLA MÍSTICA", participantName: "Damián Moreno Genaro", photo: "/assets/releve-voting/estrella-mistica.webp", photoPosition: "50% 62%" },
  { id: "queen-of-cosmic-fever", academy: "Vertical Telas", choreography: "QUEEN OF COSMIC FEVER", participantName: "Pámela Michelle Gaitan Girón", photo: "/assets/releve-voting/queen-of-cosmic-fever.webp", photoPosition: "50% 55%" },
  { id: "damar", academy: "CAO’S Tlalpan", choreography: "CON AMOR", participantName: "Dhamar García", photo: "/assets/releve-voting/damar.webp", photoPosition: "50% 100%" },
  { id: "hazel", academy: "Vol’Air Dance Studio", choreography: "GUARDIANA DEL MAR", participantName: "Hazel Brenes Pla", photo: "/assets/releve-voting/hazel.webp", photoPosition: "50% 48%" },
  { id: "mariana", academy: "CREA", choreography: "Reloj de los 70s y 80s", participantName: "Mariana Álvarez Dorado", photo: null, photoPosition: "50% 50%" },
].map(candidate => Object.freeze(candidate)));
