import { supabase } from './supabase';
import { isDemoMode } from './demo-mode';
import { isSupabaseDataMode } from './supabase-sync';
import { AIRPORTS } from './airports';
import { greatCircleKm, greatCirclePoint } from './world-map';
import type { FlightDetails } from './types';

export type FlightPhase = 'scheduled' | 'in-flight' | 'landed' | 'cancelled' | 'unknown';

export interface FlightSnapshot {
  phase: FlightPhase;
  progress: number; // 0..1 along the route
  position: { lat: number; lon: number };
  altitudeM?: number;
  speedKmh?: number;
  departureMs: number;
  arrivalMs: number;
  source: 'live' | 'schedule';
  note?: string;
}

const CRUISE_KMH = 800;

export const scheduledArrivalMs = (flight: FlightDetails): number | null => {
  const departure = AIRPORTS[flight.departure_airport];
  const arrival = AIRPORTS[flight.arrival_airport];
  const departMs = Date.parse(flight.departure_time);
  if (!departure || !arrival || !Number.isFinite(departMs)) return null;
  const explicit = flight.arrival_time ? Date.parse(flight.arrival_time) : NaN;
  if (Number.isFinite(explicit) && explicit > departMs) return explicit;
  return departMs + (greatCircleKm(departure, arrival) / CRUISE_KMH + 0.5) * 3_600_000;
};

// Position along the great circle implied by the schedule; used when no live feed is configured.
export const estimateFlight = (flight: FlightDetails, now = Date.now()): FlightSnapshot | null => {
  const departure = AIRPORTS[flight.departure_airport];
  const arrival = AIRPORTS[flight.arrival_airport];
  const arrivalMs = scheduledArrivalMs(flight);
  const departureMs = Date.parse(flight.departure_time);
  if (!departure || !arrival || arrivalMs === null) return null;
  const progress = Math.min(1, Math.max(0, (now - departureMs) / (arrivalMs - departureMs)));
  const phase: FlightPhase = now < departureMs ? 'scheduled' : now >= arrivalMs ? 'landed' : 'in-flight';
  return {
    phase, progress, departureMs, arrivalMs, source: 'schedule',
    position: greatCirclePoint(departure, arrival, progress),
    note: 'Estimated from the scheduled times. Connect a flight data provider for live positions.',
  };
};

interface LiveResponse {
  mode?: 'live' | 'sandbox';
  status?: string;
  position?: { lat: number; lon: number; altitude_m?: number; speed_kmh?: number };
  estimated_arrival?: string;
  error?: string;
}

const fetchLive = async (flight: FlightDetails): Promise<LiveResponse | null> => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  try {
    const response = await fetch('/api/integrations/flight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'track', flight_number: flight.flight_number, date: flight.departure_time.slice(0, 10) }),
    });
    return response.ok ? (await response.json()) as LiveResponse : null;
  } catch {
    return null;
  }
};

export const trackFlight = async (flight: FlightDetails): Promise<FlightSnapshot | null> => {
  const estimate = estimateFlight(flight);
  if (isDemoMode() || !isSupabaseDataMode()) return estimate;
  const live = await fetchLive(flight);
  if (!estimate || live?.mode !== 'live') return estimate;
  const phase: FlightPhase = live.status === 'active' ? 'in-flight' : live.status === 'landed' ? 'landed' : live.status === 'cancelled' ? 'cancelled' : live.status === 'scheduled' ? 'scheduled' : estimate.phase;
  if (!live.position) return { ...estimate, phase, note: 'The provider has no live position for this flight yet; showing the scheduled estimate.' };
  const arrival = live.estimated_arrival ? Date.parse(live.estimated_arrival) : NaN;
  return {
    ...estimate, phase, source: 'live', position: { lat: live.position.lat, lon: live.position.lon },
    altitudeM: live.position.altitude_m, speedKmh: live.position.speed_kmh,
    arrivalMs: Number.isFinite(arrival) ? arrival : estimate.arrivalMs, note: undefined,
  };
};
