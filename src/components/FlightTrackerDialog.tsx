import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, formatDistanceStrict } from 'date-fns';
import { Plane, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { getCocFacilities } from '@/lib/data-store';
import { AIRPORTS } from '@/lib/airports';
import { facilityCoordinates, findCity } from '@/lib/ethiopia';
import { trackFlight, type FlightPhase } from '@/lib/flight-tracking';
import type { Candidate } from '@/lib/types';
import FlightRouteMap from './FlightRouteMap';

const PHASE_LABEL: Record<FlightPhase, string> = { scheduled: 'Scheduled', 'in-flight': 'In flight', landed: 'Landed', cancelled: 'Cancelled', unknown: 'Unknown' };
const PHASE_CLASS: Record<FlightPhase, string> = {
  scheduled: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  'in-flight': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  landed: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  unknown: 'bg-muted text-muted-foreground',
};

interface Props {
  candidate: Candidate | null;
  onOpenChange: (open: boolean) => void;
  onEditFlight?: (candidate: Candidate) => void;
}

const FlightTrackerDialog: React.FC<Props> = ({ candidate, onOpenChange, onEditFlight }) => {
  const flight = candidate?.flight;
  const { data: snapshot, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ['flightTrack', candidate?.id, flight?.flight_number, flight?.departure_time, flight?.departure_airport, flight?.arrival_airport],
    queryFn: () => trackFlight(flight!),
    enabled: !!flight,
    refetchInterval: 30_000,
  });

  const departure = flight && AIRPORTS[flight.departure_airport];
  const arrival = flight && AIRPORTS[flight.arrival_airport];
  const home = candidate ? findCity(candidate.home_city) : undefined;
  const facility = candidate ? getCocFacilities().find(item => item.id === candidate.coc_facility_id) : undefined;
  const centerPoint = facility ? facilityCoordinates(facility) : null;
  const pct = Math.round((snapshot?.progress ?? 0) * 100);

  return (
    <Dialog open={!!candidate} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Plane className="h-5 w-5" />Flight tracker{candidate ? ` · ${candidate.first_name} ${candidate.last_name}` : ''}</DialogTitle>
          <DialogDescription>Home → CoC center → departure airport → destination.</DialogDescription>
        </DialogHeader>

        {!flight || !departure || !arrival ? (
          <div className="space-y-3 rounded-md border border-dashed p-6 text-center">
            <p className="font-medium">No flight details yet</p>
            <p className="text-sm text-muted-foreground">Add the flight number, airports and departure time to track this candidate in the portal.</p>
            {candidate && onEditFlight && <Button onClick={() => onEditFlight(candidate)}><Settings2 className="mr-2 h-4 w-4" />Add flight details</Button>}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-lg font-semibold">{flight.flight_number}{flight.airline ? ` · ${flight.airline}` : ''}</p>
                <p className="text-sm text-muted-foreground">{departure.city} ({departure.code}) → {arrival.city} ({arrival.code})</p>
              </div>
              <div className="flex items-center gap-2">
                {snapshot && <Badge className={PHASE_CLASS[snapshot.phase]} variant="secondary">{PHASE_LABEL[snapshot.phase]}</Badge>}
                {candidate && onEditFlight && <Button size="sm" variant="outline" onClick={() => onEditFlight(candidate)}><Settings2 className="mr-1 h-4 w-4" />Edit</Button>}
              </div>
            </div>

            {isLoading || !snapshot ? <div className="grid h-[360px] place-items-center rounded-md border text-sm text-muted-foreground">Locating flight…</div> : (
              <FlightRouteMap
                home={home ? { lat: home.lat, lon: home.lon, label: home.name } : undefined}
                center={facility && centerPoint ? { ...centerPoint, label: facility.name } : undefined}
                departure={{ lat: departure.lat, lon: departure.lon, label: `${departure.code}` }}
                arrival={{ lat: arrival.lat, lon: arrival.lon, label: `${arrival.code}` }}
                position={snapshot.position}
                progress={snapshot.progress}
              />
            )}

            {snapshot && (
              <div className="space-y-3">
                <Progress value={pct} aria-label="Flight progress" className="h-2" />
                <dl className="grid gap-3 text-sm sm:grid-cols-4">
                  <div><dt className="text-xs text-muted-foreground">Departs</dt><dd className="font-medium">{format(snapshot.departureMs, 'PPp')}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Arrives</dt><dd className="font-medium">{format(snapshot.arrivalMs, 'PPp')}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">{snapshot.phase === 'scheduled' ? 'Departs in' : snapshot.phase === 'in-flight' ? 'Time remaining' : 'Status'}</dt>
                    <dd className="font-medium">{snapshot.phase === 'scheduled' ? formatDistanceStrict(snapshot.departureMs, Date.now()) : snapshot.phase === 'in-flight' ? formatDistanceStrict(snapshot.arrivalMs, Date.now()) : PHASE_LABEL[snapshot.phase]}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Position</dt><dd className="font-medium tabular-nums">{snapshot.position.lat.toFixed(2)}°, {snapshot.position.lon.toFixed(2)}°{snapshot.altitudeM ? ` · ${Math.round(snapshot.altitudeM).toLocaleString()} m` : ''}</dd></div>
                </dl>
                <p className="text-xs text-muted-foreground">
                  {snapshot.source === 'live' ? 'Live data from the flight provider' : snapshot.note} · Updated {format(dataUpdatedAt || Date.now(), 'p')}, refreshes every 30 seconds.
                </p>
                {flight.note && <p className="rounded-md bg-muted/50 p-3 text-sm">{flight.note}</p>}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default FlightTrackerDialog;
