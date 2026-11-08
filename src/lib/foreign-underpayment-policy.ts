import { getConfig, saveConfig } from './data-store';
import { evidenceToday, validEvidenceDate } from './evidence-requests';
import { recordApprovalLog } from './api/log-management';
import type { AgencyResolutionCase, ResolutionActor } from './agency-resolution';
import type { AppConfig } from './types';

export function foreignUnderpaymentCycle(config: Pick<AppConfig, 'foreignUnderpaymentRenewal'>, now = new Date()) {
  const policy = config.foreignUnderpaymentRenewal;
  if (policy && (!validEvidenceDate(policy.renewsOn) || policy.cycleStartsOn !== undefined && (!validEvidenceDate(policy.cycleStartsOn) || policy.cycleStartsOn > policy.renewsOn))) {
    throw new Error('The ministry underpayment renewal calendar is invalid. Correct Settings; no chances were silently reset.');
  }
  const renewed = !!policy && evidenceToday(now) >= policy.renewsOn;
  return { startsOn: renewed ? policy!.renewsOn : policy?.cycleStartsOn, renewsOn: policy?.renewsOn, renewed };
}

export function foreignUnderpaymentStatus(agencyId: string, cases: AgencyResolutionCase[], config: Pick<AppConfig, 'foreignUnderpaymentRenewal'>, now = new Date()) {
  const cycle = foreignUnderpaymentCycle(config, now);
  const countedPayments = new Set<string>();
  for (const record of cases) {
    if (record.issue.source !== 'foreign' || record.issue.agencyType !== 'foreign' || record.issue.agencyId !== agencyId || record.issue.kind !== 'underpayment') continue;
    if (record.events.some(event => ['verified-underpayment-warning', 'verified-underpayment-pause', 'suspend'].includes(event.action)
      && (!cycle.startsOn || evidenceToday(new Date(event.at)) >= cycle.startsOn))) countedPayments.add(record.issue.paymentId);
  }
  return { ...cycle, used: countedPayments.size, remaining: Math.max(0, 3 - countedPayments.size), countedPayments };
}

export async function setForeignUnderpaymentRenewal(renewsOn: string, actor: ResolutionActor, now = new Date()) {
  if (actor.role !== 'superadmin' || !actor.id || !actor.email) throw new Error('Only a signed-in ministry / superadmin can set the renewal date.');
  if (!validEvidenceDate(renewsOn) || renewsOn < evidenceToday(now)) throw new Error('Choose a valid renewal date today or in the future.');
  const config = getConfig();
  const cycle = foreignUnderpaymentCycle(config, now);
  await recordApprovalLog(actor.id, actor.email, 'Config', 'foreign-underpayment-renewal', 'Updated',
    `Foreign agency underpayment chances renew on ${renewsOn} at midnight Ethiopia time. Previous date: ${cycle.renewsOn ?? 'not set'}. Three distinct verified underpayments per cycle; existing pauses require an explicit ministry release. Releases do not reset used chances.`);
  if (JSON.stringify(getConfig().foreignUnderpaymentRenewal) !== JSON.stringify(config.foreignUnderpaymentRenewal)) throw new Error('The renewal date changed while saving. Reload before continuing.');
  saveConfig({ ...getConfig(), foreignUnderpaymentRenewal: { renewsOn, cycleStartsOn: cycle.startsOn } });
  window.dispatchEvent(new Event('supabase-data-changed'));
}
