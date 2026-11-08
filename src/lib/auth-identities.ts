import type { User } from '@supabase/supabase-js';
import type { ViewAsTarget } from './auth-context';
import type { Candidate, StaffUser } from './types';
import { demoActorIdentity, demoAgencyManager, resolveActorIdentity } from './demo-identities';

export const demoSessionUser = (): User => {
  const identity = demoActorIdentity('demo-superadmin')!;
  return { id: identity.id, email: identity.email, app_metadata: {}, user_metadata: { full_name: identity.name },
    aud: 'authenticated', created_at: new Date().toISOString() } as User;
};

// Live impersonation remains a perspective, never an authenticated-account replacement.
export const effectiveAuthUser = (
  actualUser: User | null, target: ViewAsTarget | null, demo: boolean, candidates: Candidate[], staff: StaffUser[],
): User | null => {
  if (!demo || !target || !actualUser) return actualUser;
  const candidate = target.role === 'candidate'
    ? candidates.find(item => target.userId ? item.id === target.userId : item.tracking_code === target.trackingCode) : undefined;
  const manager = demoAgencyManager(target.localAgencyId ?? target.foreignAgencyId);
  const id = target.userId ?? candidate?.id ?? manager?.id;
  if (!id) return actualUser;
  const stored = staff.find(item => item.id === id);
  const identity = resolveActorIdentity(id, stored?.email, candidates);
  return { ...actualUser, id, email: identity.email ?? stored?.email,
    user_metadata: { full_name: identity.name ?? stored?.email ?? target.label } };
};
