import { describe, expect, it } from 'vitest';
import { estimateFlight } from '../flight-tracking';
import type { FlightDetails } from '../types';

const base: FlightDetails = { flight_number: 'ET472', departure_airport: 'ADD', arrival_airport: 'RUH', departure_time: '2026-08-01T10:00:00Z' };

describe('flight estimate', () => {
  it('is scheduled before departure, airborne in between and landed afterwards', () => {
    const before = estimateFlight(base, Date.parse('2026-08-01T09:00:00Z'))!;
    expect(before.phase).toBe('scheduled');
    expect(before.progress).toBe(0);
    const mid = estimateFlight(base, Date.parse('2026-08-01T11:30:00Z'))!;
    expect(mid.phase).toBe('in-flight');
    expect(mid.progress).toBeGreaterThan(0);
    expect(mid.progress).toBeLessThan(1);
    expect(mid.position.lat).toBeGreaterThan(8.9);
    const after = estimateFlight(base, Date.parse('2026-08-02T00:00:00Z'))!;
    expect(after.phase).toBe('landed');
    expect(after.position.lat).toBeCloseTo(24.9576, 2);
  });

  it('uses an explicit arrival time and rejects unknown airports', () => {
    const explicit = estimateFlight({ ...base, arrival_time: '2026-08-01T12:00:00Z' }, Date.parse('2026-08-01T11:00:00Z'))!;
    expect(explicit.progress).toBeCloseTo(0.5, 2);
    expect(estimateFlight({ ...base, arrival_airport: 'XXX' })).toBeNull();
  });
});
