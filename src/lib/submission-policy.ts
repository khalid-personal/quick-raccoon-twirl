import { getConfig, saveConfig } from './data-store';
import { recordApprovalLog } from './api/log-management';
import { evidenceToday, validEvidenceDate } from './evidence-requests';
import type { AppConfig } from './types';

export function submissionDeadline(config: Pick<AppConfig, 'ministrySubmissionWindow'>, now = new Date()) {
  const today = evidenceToday(now);
  const window = config.ministrySubmissionWindow;
  if (window && (!validEvidenceDate(window.startsOn) || !validEvidenceDate(window.endsOn) || window.startsOn > window.endsOn)) throw new Error('The ministry submission window is invalid. Ask the superadmin to correct Settings.');
  const start = window?.startsOn ?? today;
  const end = window?.endsOn ?? evidenceToday(new Date(now.getTime() + 7 * 86_400_000));
  return { start, end, source: window ? 'ministry' as const : 'default' as const,
    status: end < today ? 'expired' as const : start > today ? 'scheduled' as const : 'open' as const };
}
export function validateSubmissionDates(start: string, end: string) {
  if (!validEvidenceDate(start) || !validEvidenceDate(end) || start > end) throw new Error('Choose valid submission dates with the start on or before the deadline.');
}
export function submissionCountdown(config: Pick<AppConfig, 'ministrySubmissionWindow'>, now = new Date()) {
  const policy = submissionDeadline(config, now);
  const target = policy.status === 'scheduled' ? Date.parse(`${policy.start}T00:00:00+03:00`) : Date.parse(`${policy.end}T00:00:00+03:00`) + 86_400_000;
  const totalSeconds = Math.max(0, Math.ceil((target - now.getTime()) / 1000));
  return { ...policy, days: Math.floor(totalSeconds / 86_400), hours: Math.floor(totalSeconds % 86_400 / 3600),
    minutes: Math.floor(totalSeconds % 3600 / 60), seconds: totalSeconds % 60 };
}
export async function setMinistrySubmissionWindow(start: string, end: string, actor: { id: string; email: string; role: string }, now = new Date()) {
  if (actor.role !== 'superadmin' || !actor.id || !actor.email) throw new Error('Only a signed-in superadmin can set ministry submission dates.');
  validateSubmissionDates(start, end);
  if (end < evidenceToday(now)) throw new Error('The new submission deadline cannot be in the past.');
  const prior = getConfig().ministrySubmissionWindow;
  await recordApprovalLog(actor.id, actor.email, 'Config', 'ministry-submission-window', 'Updated',
    `Ministry submission dates changed from ${prior ? `${prior.startsOn} through ${prior.endsOn}` : 'seven-day default'} to ${start} through ${end}. Existing requests keep their original deadlines unless explicitly reissued.`);
  const current = getConfig();
  saveConfig({ ...current, ministrySubmissionWindow: { startsOn: start, endsOn: end } });
  window.dispatchEvent(new Event('supabase-data-changed'));
  return { startsOn: start, endsOn: end };
}
