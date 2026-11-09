import type { Candidate, CandidateStage } from './types';
import { DASHBOARD_PALETTE } from './dashboard-palette';

const DAY = 86_400_000;

export const LIFECYCLE = ['Registration', 'Medical', 'Training', 'Visa & travel', 'Working abroad', 'Returned home', 'Reapplying'] as const;
export type Lifecycle = (typeof LIFECYCLE)[number];

export const LIFECYCLE_COLOR: Record<Lifecycle, string> = {
  Registration: DASHBOARD_PALETTE.slate, Medical: DASHBOARD_PALETTE.teal, Training: DASHBOARD_PALETTE.forest, 'Visa & travel': DASHBOARD_PALETTE.amber,
  'Working abroad': DASHBOARD_PALETTE.sage, 'Returned home': '#9a7952', Reapplying: DASHBOARD_PALETTE.rose,
};

export const classifyLifecycle = (candidate: Candidate, stages: CandidateStage[]): Lifecycle => {
  if (candidate.return_status === 'returned') return 'Returned home';
  if (candidate.employment_history?.some(journey => journey.reapplied_at) && !candidate.arrival) return 'Reapplying';
  if (candidate.arrival) return 'Working abroad';
  const status = (id: number) => stages.find(stage => stage.stage_id === id)?.status ?? 'Pending';
  if (status(4) !== 'Pending') return 'Visa & travel';
  if (status(3) !== 'Pending') return 'Training';
  if (status(2) !== 'Pending') return 'Medical';
  return 'Registration';
};

export const TENURE_BUCKETS = ['Under 3 months', '3 to 6 months', '6 to 12 months', '1 to 2 years', 'Over 2 years'] as const;

export const tenureBucket = (arrivedAt: string, now = Date.now()): (typeof TENURE_BUCKETS)[number] => {
  const months = (now - Date.parse(arrivedAt)) / DAY / 30.44;
  return months < 3 ? TENURE_BUCKETS[0] : months < 6 ? TENURE_BUCKETS[1] : months < 12 ? TENURE_BUCKETS[2] : months < 24 ? TENURE_BUCKETS[3] : TENURE_BUCKETS[4];
};

export const tally = <T,>(items: T[], key: (item: T) => string | undefined): Array<{ name: string; value: number }> => {
  const counts = new Map<string, number>();
  items.forEach(item => { const k = key(item); if (k) counts.set(k, (counts.get(k) ?? 0) + 1); });
  return [...counts.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
};

export const ageOf = (dob: string, now = Date.now()) => Math.floor((now - Date.parse(dob)) / DAY / 365.25);
