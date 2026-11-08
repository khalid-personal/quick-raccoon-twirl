import type { Candidate, Payment } from './types';

export interface ActorIdentity {
  id: string;
  email?: string;
  name?: string;
  agencyId?: string;
}

const localNames = [
  ['Tigist Alemu', 'Meron Tadesse', 'Yared Kebede', 'Selam Hailu'],
  ['Dawit Mengistu', 'Dagim Negash', 'Hanna Tilahun', 'Biniam Wolde'],
  ['Rahel Worku', 'Liya Assefa', 'Natnael Bogale', 'Ruth Demissie'],
  ['Henok Teshome', 'Samson Girma', 'Eden Eshetu', 'Kaleb Haile'],
];
const foreignNames = [
  ['Layla Nasser', 'Amal Faris', 'Faisal Karim'],
  ['Mariam Zayed', 'Noor Khalil', 'Tariq Hamdan'],
  ['Huda Mansour', 'Salma Rashid', 'Rashid Nabil'],
  ['Rania Haddad', 'Dina Sami', 'Omar Salim'],
];
const localDomains = ['habesha-overseas', 'abay-manpower', 'riftvalley', 'lalibela-workforce'];
const foreignDomains = ['riyadhgulf', 'emiratestalent', 'dohamanpower', 'levantworkforce'];

// IDs, not role labels or email guesses, anchor fictional identities across saved perspectives.
export const demoActorIdentity = (id: string): ActorIdentity | undefined => {
  if (['demo-superadmin', 'demo-super-1'].includes(id)) return { id, name: 'superadmin1', email: 'superadmin1@dawm.test' };
  const legacy = /^demo-staff-([1-4])$/.exec(id);
  const match = /^demo-usr-([lf])([1-4])-(mgr|s[1-3])$/.exec(id);
  if (legacy) {
    const identity = demoActorIdentity(`demo-usr-l1-${legacy[1] === '4' ? 'mgr' : `s${legacy[1]}`}`);
    return identity && { ...identity, id };
  }
  if (!match) return undefined;
  const [, kind, agencyNumber, position] = match;
  const index = Number(agencyNumber) - 1;
  const name = (kind === 'l' ? localNames : foreignNames)[index][position === 'mgr' ? 0 : Number(position.slice(1))];
  if (!name) return undefined;
  const domain = (kind === 'l' ? localDomains : foreignDomains)[index];
  return { id, name, email: `${name.toLowerCase().replace(/ /g, '.')}@${domain}.example.test`, agencyId: `demo-${kind === 'l' ? 'local' : 'foreign'}-${agencyNumber}` };
};

export const isSafeDemoEmail = (email?: string): boolean =>
  !email || /\.test$/i.test(email) || /^(dev\.(staff|superadmin)|meron\.staff|yared\.staff|self\.approver)@dawm\.local$/i.test(email);

export const resolveActorIdentity = (id: string, email?: string, candidates: Candidate[] = []): ActorIdentity => {
  const fictional = demoActorIdentity(id);
  if (fictional && isSafeDemoEmail(email)) return fictional;
  const candidate = candidates.find(item => item.id === id && item.id.startsWith('demo-'));
  if (candidate && isSafeDemoEmail(email)) return {
    id, name: `${candidate.first_name} ${candidate.last_name}`, email: candidate.email ?? `${candidate.tracking_code.toLowerCase()}@candidates.dawm.test`, agencyId: candidate.local_agency_id,
  };
  return { id, email };
};

export const actorDisplayName = (id: string, email?: string, candidates: Candidate[] = []): string => {
  const identity = resolveActorIdentity(id, email, candidates);
  return identity.name ?? identity.email ?? identity.id;
};

export const paymentCandidateSummary = (payment: Pick<Payment, 'candidate_ids'>, candidates: Candidate[]): string =>
  payment.candidate_ids.map(id => {
    const candidate = candidates.find(item => item.id === id);
    return candidate ? `${candidate.first_name} ${candidate.last_name} (${candidate.tracking_code})` : id;
  }).join(', ');

export const demoAgencyManager = (agencyId?: string): ActorIdentity | undefined => {
  const match = /^demo-(local|foreign)-([1-4])$/.exec(agencyId ?? '');
  return match ? demoActorIdentity(`demo-usr-${match[1] === 'local' ? 'l' : 'f'}${match[2]}-mgr`) : undefined;
};
