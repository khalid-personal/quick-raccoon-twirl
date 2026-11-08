import { WORLD_COUNTRIES } from './countries';
import type { Candidate } from './types';

export const nextTrackingCode = (country: string, candidates: Pick<Candidate, 'tracking_code'>[]): string => {
  const normalized = country.trim().toLowerCase();
  const region = WORLD_COUNTRIES.find(item => item.name.toLowerCase() === normalized || item.code.toLowerCase() === normalized);
  if (!region) throw new Error('Select a recognized country of origin before generating a tracking code.');
  const prefix = `TRK-${region.code}-`;
  const numbers = candidates.map(candidate => candidate.tracking_code.trim().toUpperCase())
    .filter(code => code.startsWith(prefix) && /^\d+$/.test(code.slice(prefix.length)))
    .map(code => Number(code.slice(prefix.length)));
  const next = Math.max(0, ...numbers) + 1;
  if (!Number.isSafeInteger(next)) throw new Error('The tracking number sequence is exhausted.');
  return `${prefix}${String(next).padStart(4, '0')}`;
};
