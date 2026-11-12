import { requestRegistrationApi } from '../admin/registrationApi';
import type { ReleveVotingCandidate } from '../../data/releveVotingCandidates';

export type RelevePoll = { id: string; status: 'open' | 'closed'; voterMode: 'device'; revision: number; configured: boolean };
export type ReleveVoter = { authenticated: boolean; hasVoted: boolean; candidateId: string | null };
export type ReleveVotingState = { poll: RelevePoll; candidates: readonly ReleveVotingCandidate[]; voter: ReleveVoter };
export type ReleveVotingAdminState = { poll: RelevePoll; candidates: (ReleveVotingCandidate & { votes: number })[]; totalVotes: number };
export const getReleveVoting = (signal?: AbortSignal) => requestRegistrationApi<ReleveVotingState>('/api/releve-voting', { signal });
export const connectReleveVoter = (input: { fingerprint: string }) => requestRegistrationApi<{ voter: ReleveVoter }>('/api/releve-voting/session', { method: 'POST', body: JSON.stringify(input) });
export const submitReleveVote = (candidateId: string) => requestRegistrationApi<{ voter: ReleveVoter }>('/api/releve-voting/vote', { method: 'POST', body: JSON.stringify({ candidateId }) });

let device: Promise<string> | null = null;
export function releveDeviceId() {
  // Bundled locally. No fingerprint attributes or telemetry go to a third party.
  device ??= import('@fingerprintjs/fingerprintjs').then(async module => {
    const agent = await module.load({ monitoring: false });
    return (await agent.get()).visitorId;
  }).catch(error => { device = null; throw error; });
  return device;
}
