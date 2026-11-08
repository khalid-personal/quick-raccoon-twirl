import { getCandidates, saveCandidates } from './data-store';
import { isDemoMode } from './demo-mode';
import { hydrateFromSupabase, isSupabaseDataMode } from './supabase-sync';
import { supabase } from './supabase';
import type { Candidate, WorkContractRecord } from './types';
import { hasCompleteCandidateIntroduction } from './candidate-introduction';

export type WorkContractAction = 'send' | 'receive';

export const updateWorkContract = async (
  candidateId: string,
  action: WorkContractAction,
  actor: { id: string; email: string },
  contractUrl?: string,
  note?: string,
): Promise<WorkContractRecord> => {
  if (action === 'send') {
    const candidate = getCandidates().find(item => item.id === candidateId);
    if (!candidate) throw new Error('Candidate not found.');
    if (!hasCompleteCandidateIntroduction(candidate)) {
      throw new Error('Complete the candidate gender, introduction, skills, languages, and introduction video before sending a work contract.');
    }
    if (!contractUrl) throw new Error('Enter the secure contract link.');
    let url: URL;
    try { url = new URL(contractUrl); } catch { throw new Error('Enter a valid secure contract link.'); }
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Contract links must use HTTPS and cannot contain credentials.');
  }

  if (isDemoMode() || !isSupabaseDataMode()) {
    const candidates = getCandidates();
    const index = candidates.findIndex(candidate => candidate.id === candidateId);
    if (index < 0) throw new Error('Candidate not found.');
    const current = candidates[index].work_contract_record;
    const now = new Date().toISOString();
    const updated: WorkContractRecord = action === 'send'
      ? { status: 'sent', url: new URL(contractUrl!).toString(), sent_at: now, sent_by: actor.email, note: note?.trim() || undefined }
      : current?.url && current.sent_at
        ? { ...current, status: 'received', received_at: now, received_by: actor.email }
        : (() => { throw new Error('There is no contract awaiting receipt.'); })();
    candidates[index] = {
      ...candidates[index],
      work_contract_record: updated,
      external_status: action === 'receive'
        ? { ...candidates[index].external_status, work_contract: true, updated_at: now }
        : candidates[index].external_status,
      updated_at: now,
    };
    saveCandidates(candidates);
    window.dispatchEvent(new CustomEvent('supabase-data-changed'));
    return updated;
  }

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in required.');
  const response = await fetch('/api/agency/contracts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, candidate_id: candidateId, contract_url: contractUrl, note }),
  });
  const result = await response.json() as { contract?: WorkContractRecord; error?: string };
  if (!response.ok || !result.contract) throw new Error(result.error ?? 'Could not update the contract handoff.');
  await hydrateFromSupabase();
  return result.contract;
};

export const getContractRecord = (candidate: Candidate): WorkContractRecord | undefined => candidate.work_contract_record;
