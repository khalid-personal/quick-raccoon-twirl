import { getIntegrityOverrides, getStaffUsers, saveIntegrityOverrides } from './data-store';
import { isDemoMode } from './demo-mode';
import { recordApprovalLog } from './api/log-management';
import type { Finding } from './integrity';
import type { IntegrityOverride } from './types';

export const MIN_OVERRIDE_REASON = 15;
type Actor = { id: string; email: string };

const requireSuperadmin = (actor: Actor) => {
  const approved = getStaffUsers().some(user => user.id === actor.id && user.is_approved && user.role === 'superadmin');
  if (!approved && !(isDemoMode() && actor.id === 'demo-superadmin')) throw new Error('Only a superadmin can change integrity overrides.');
};

export const overrideFinding = async (finding: Finding, reason: string, actor: Actor): Promise<IntegrityOverride> => {
  requireSuperadmin(actor);
  if (reason.trim().length < MIN_OVERRIDE_REASON) throw new Error(`Provide at least ${MIN_OVERRIDE_REASON} characters for the reason.`);
  const overrides = getIntegrityOverrides();
  const entry: IntegrityOverride = { id: finding.id, finding_id: finding.id, rule: finding.rule, severity: finding.severity, title: finding.title, reason: reason.trim(), overridden_by_id: actor.id, overridden_by_email: actor.email, overridden_at: new Date().toISOString() };
  saveIntegrityOverrides([...overrides.filter(item => item.finding_id !== finding.id), entry]);
  await recordApprovalLog(actor.id, actor.email, 'IntegrityOverride', finding.id, 'Approved', `Integrity flag overridden: ${finding.title}. Reason: ${entry.reason}`);
  return entry;
};

export const revokeOverride = async (id: string, actor: Actor): Promise<void> => {
  requireSuperadmin(actor);
  const overrides = getIntegrityOverrides();
  const entry = overrides.find(item => item.id === id && !item.revoked_at);
  if (!entry) throw new Error('Active override not found.');
  saveIntegrityOverrides(overrides.map(item => item.id === id ? { ...item, revoked_at: new Date().toISOString(), revoked_by_email: actor.email } : item));
  await recordApprovalLog(actor.id, actor.email, 'IntegrityOverride', id, 'Updated', `Integrity override revoked: ${entry.title}.`);
};
