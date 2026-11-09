import { Plane } from 'lucide-react';
import type { Candidate } from '@/lib/types';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';

export default function FlightDetailsDialog({ candidate, open, onOpenChange }: { candidate: Candidate; open: boolean; onOpenChange: (open: boolean) => void }) {
  const flight = candidate.flight;
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent>
    <DialogHeader><DialogTitle className="flex items-center gap-2"><Plane />Ministry flight record</DialogTitle><DialogDescription>{candidate.first_name} {candidate.last_name} · read-only ministry update</DialogDescription></DialogHeader>
    <dl className="ministry-stage-summary grid gap-4 sm:grid-cols-2">
      <div><dt>Flight number</dt><dd>{flight?.flight_number || 'Awaiting ministry reference'}</dd></div>
      <div><dt>Ticket reference</dt><dd>{flight?.ticket_number || 'Awaiting ministry reference'}</dd></div>
      <div><dt>Route</dt><dd>{flight ? `${flight.departure_airport} → ${flight.arrival_airport}` : 'Awaiting ministry route'}</dd></div>
      <div><dt>Departure</dt><dd>{flight?.departure_time ? new Date(flight.departure_time).toLocaleString() : 'Awaiting ministry date'}</dd></div>
    </dl><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Close record</Button></DialogFooter>
  </DialogContent></Dialog>;
}
