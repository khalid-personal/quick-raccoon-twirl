import type { Candidate } from './types';

const DAY = 86_400_000;
export const MONTH_DAYS = 30.44;

export type ExpiryBand = 'urgent' | 'soon' | 'upcoming';

export interface ExpiringContract {
  candidate: Candidate;
  endsAt: string;
  daysLeft: number;
  monthsLeft: number;
  band: ExpiryBand;
  lastReminderAt?: string;
}

// Working candidates whose contract ends within `maxMonths`; ended or returned contracts are excluded.
export const getExpiringContracts = (candidates: Candidate[], now = Date.now(), maxMonths = 6): ExpiringContract[] =>
  candidates.flatMap(candidate => {
    if (!candidate.contract_end_date || !candidate.arrival || candidate.return_status === 'returned') return [];
    const daysLeft = (Date.parse(candidate.contract_end_date) - now) / DAY;
    if (!Number.isFinite(daysLeft) || daysLeft < 0 || daysLeft > maxMonths * MONTH_DAYS) return [];
    const band: ExpiryBand = daysLeft <= MONTH_DAYS ? 'urgent' : daysLeft <= 3 * MONTH_DAYS ? 'soon' : 'upcoming';
    const lastReminderAt = [...(candidate.contract_reminders ?? [])].sort((a, b) => b.sent_at.localeCompare(a.sent_at))[0]?.sent_at;
    return [{ candidate, endsAt: candidate.contract_end_date, daysLeft: Math.ceil(daysLeft), monthsLeft: Math.round((daysLeft / MONTH_DAYS) * 10) / 10, band, lastReminderAt }];
  }).sort((a, b) => a.daysLeft - b.daysLeft);

// Digits only, with Ethiopian local numbers (09…) expanded to +251; returns null when it cannot be a WhatsApp number.
export const whatsappDigits = (phone?: string): string | null => {
  let digits = (phone ?? '').replace(/[^\d]/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  else if (/^0\d{9}$/.test(digits)) digits = `251${digits.slice(1)}`;
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
};

export const buildWhatsAppUrl = (phone: string, text: string): string | null => {
  const digits = whatsappDigits(phone);
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : null;
};

export const reminderMessage = (item: ExpiringContract, agencyName?: string): string => {
  const { candidate } = item;
  const when = new Date(item.endsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const employer = candidate.employer?.company ? ` with ${candidate.employer.company}` : '';
  return `Hello ${candidate.first_name}, this is a reminder from ${agencyName ?? 'your agency'}: your work contract${employer} ends on ${when} (about ${Math.max(1, Math.round(item.monthsLeft))} month${Math.round(item.monthsLeft) <= 1 ? '' : 's'} from now). Please contact us to discuss renewal or your return home.`;
};
