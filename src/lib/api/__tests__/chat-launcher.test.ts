// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { candidateChatInbox } from '../chat-launcher';
import { generateDemoDataset } from '../../demo-dataset';
import type { ApiPrincipal } from '../auth';
import type { ChatMessage } from '../../types';

const data = generateDemoDataset(Date.parse('2026-11-08'));
const a = { ...data.candidates[0], local_agency_id: 'local-a', foreign_agency_id: 'foreign-a', assigned_staff_id: 'staff-a' };
const b = { ...data.candidates[1], local_agency_id: 'local-b', foreign_agency_id: 'foreign-b', assigned_staff_id: 'staff-a', profile_shares: [] };
const principal = (role: ApiPrincipal['role']): ApiPrincipal => ({ id: 'staff-a', role, candidateId: a.id, localAgencyId: 'local-a', foreignAgencyId: 'foreign-a' });
const message: ChatMessage = { id: 'incoming', candidate_id: a.id, sender: 'candidate', sender_name: 'Candidate',
  message: 'Please check my document', timestamp: '2026-11-08T10:00:00Z', is_read_by_admin: false, is_read_by_candidate: true };

it('scopes candidates to own record, local agency, assigned staff and foreign agency', () => {
  for (const role of ['candidate', 'local-agency', 'staff', 'agency', 'foreign-agency', 'foreign-agency-staff'] as const) {
    expect(candidateChatInbox(principal(role), [a, b], [], []).candidates.map(candidate => candidate.id)).toEqual([a.id]);
  }
  for (const role of ['viewer', 'auditor'] as const) expect(candidateChatInbox(principal(role), [a, b], [], []).candidates).toEqual([]);
  expect(candidateChatInbox({ ...principal('admin'), localAgencyId: null }, [a, b], [], []).candidates).toHaveLength(2);
});
it('counts all unread incoming messages even when the latest message is a staff reply', () => {
  const messages = [message, { ...message, id: 'reply', sender: 'admin' as const, sender_name: 'Agency team', message: 'We are checking', timestamp: '2026-11-08T11:00:00Z', is_read_by_candidate: false }];
  const inbox = candidateChatInbox(principal('local-agency'), [a, b], [], messages);
  expect(inbox.unread).toBe(1);
  expect(inbox.threads[0].candidate.first_name).toBe(a.first_name);
  expect(inbox.threads[0].latest.sender_name).toBe('Agency team');
  expect(candidateChatInbox(principal('candidate'), [a, b], [], messages).unread).toBe(1);
  expect(messages[0].id).toBe('incoming');
});
