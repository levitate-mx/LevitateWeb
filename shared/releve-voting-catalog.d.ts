export type ReleveVotingCandidate = {
  id: string;
  academy: string;
  choreography: string;
  participantName: string;
  participantDisplayName: string;
  photo: string | null;
  photoPosition: string;
};

export const releveVotingCandidates: readonly ReleveVotingCandidate[];
