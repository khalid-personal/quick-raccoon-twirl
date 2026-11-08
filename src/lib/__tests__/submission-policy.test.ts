// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { getApprovalLogs, getConfig } from '../data-store';
import { updateAppConfig } from '../api/config-management';
import { setMinistrySubmissionWindow, submissionCountdown, submissionDeadline, validateSubmissionDates } from '../submission-policy';

const now = new Date('2026-11-07T22:00:00Z'); // Already November 8 in Ethiopia.
const actor = { id: 'ministry-admin', email: 'ministry@example.test', role: 'superadmin' };
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); sessionStorage.setItem('dawm_demo_session', '1'); });
describe('ministry submission calendar', () => {
  it('counts down to the whole deadline day in Ethiopia and reports scheduled/expired windows', () => {
    const config = { ministrySubmissionWindow: { startsOn: '2026-11-07', endsOn: '2026-11-08' } };
    expect(submissionCountdown(config, new Date('2026-11-08T23:59:58+03:00'))).toMatchObject({ days: 0, hours: 0, minutes: 0, seconds: 2, status: 'open' });
    expect(submissionCountdown(config, new Date('2026-11-09T00:00:00+03:00'))).toMatchObject({ seconds: 0, status: 'expired' });
    expect(submissionCountdown(config, new Date('2026-11-06T23:59:58+03:00'))).toMatchObject({ seconds: 2, status: 'scheduled' });
  });
  it('defaults every new request to current Ethiopia date plus seven days', () => {
    expect(submissionDeadline({}, now)).toEqual({ start: '2026-11-08', end: '2026-11-15', status: 'open', source: 'default' });
  });
  it('honors scheduled, open and expired windows without hiding overdue submissions', () => {
    expect(submissionDeadline({ ministrySubmissionWindow: { startsOn: '2026-11-10', endsOn: '2026-11-20' } }, now).status).toBe('scheduled');
    expect(submissionDeadline({ ministrySubmissionWindow: { startsOn: '2026-11-01', endsOn: '2026-11-08' } }, now).status).toBe('open');
    expect(submissionDeadline({ ministrySubmissionWindow: { startsOn: '2026-11-01', endsOn: '2026-11-07' } }, now)).toMatchObject({ status: 'expired', end: '2026-11-07' });
  });
  it('rejects invalid dates, reversed windows, unauthorized edits and past new deadlines', async () => {
    expect(() => validateSubmissionDates('2026-02-30', '2026-03-01')).toThrow('valid');
    expect(() => validateSubmissionDates('2026-11-10', '2026-11-09')).toThrow('valid');
    expect(() => submissionDeadline({ ministrySubmissionWindow: { startsOn: 'broken', endsOn: '2026-11-20' } }, now)).toThrow('invalid');
    await expect(setMinistrySubmissionWindow('2026-11-08', '2026-11-15', { ...actor, role: 'staff' }, now)).rejects.toThrow('superadmin');
    await expect(setMinistrySubmissionWindow('2026-11-01', '2026-11-07', actor, now)).rejects.toThrow('past');
  });
  it('persists and audits ministry dates; ordinary settings saves cannot discard or override them', async () => {
    await setMinistrySubmissionWindow('2026-11-08', '2026-11-15', actor, now);
    expect(getConfig().ministrySubmissionWindow).toEqual({ startsOn: '2026-11-08', endsOn: '2026-11-15' });
    expect(getApprovalLogs().some(log => log.description.includes('Ministry submission dates changed'))).toBe(true);
    await updateAppConfig({ ...getConfig(), ministrySubmissionWindow: { startsOn: '1900-01-01', endsOn: '1900-01-02' }, stageFees: { 1: 500 } }, actor.id, actor.email);
    expect(getConfig().ministrySubmissionWindow?.endsOn).toBe('2026-11-15');
  });
});
