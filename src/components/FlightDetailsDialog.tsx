import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plane } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { AIRPORTS, airportForCity } from '@/lib/airports';
import type { Candidate, FlightDetails } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const toLocalInput = (iso?: string) => {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

const FlightDetailsDialog: React.FC<{ candidate: Candidate; open: boolean; onOpenChange: (open: boolean) => void }> = ({ candidate, open, onOpenChange }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({ airline: '', flight_number: '', ticket_number: '', departure_airport: 'ADD', arrival_airport: '', departure_time: '', arrival_time: '', note: '' });

  React.useEffect(() => {
    if (!open) return;
    const flight = candidate.flight;
    setForm({
      airline: flight?.airline ?? '',
      flight_number: flight?.flight_number ?? '',
      ticket_number: flight?.ticket_number ?? '',
      departure_airport: flight?.departure_airport ?? 'ADD',
      arrival_airport: flight?.arrival_airport ?? airportForCity(candidate.external_status?.destination_city)?.code ?? '',
      departure_time: toLocalInput(flight?.departure_time),
      arrival_time: toLocalInput(flight?.arrival_time),
      note: flight?.note ?? '',
    });
  }, [open, candidate]);

  const set = (key: keyof typeof form) => (value: string) => setForm(current => ({ ...current, [key]: value }));

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const flightNumber = form.flight_number.replace(/\s+/g, '').toUpperCase();
    if (!/^[A-Z0-9]{2}\d{1,4}[A-Z]?$/.test(flightNumber)) return toast.error('Enter a flight number such as ET472.');
    if (!form.arrival_airport || form.arrival_airport === form.departure_airport) return toast.error('Choose different departure and arrival airports.');
    if (!form.departure_time) return toast.error('Enter the departure time.');
    if (form.arrival_time && new Date(form.arrival_time) <= new Date(form.departure_time)) return toast.error('Arrival must be after departure.');
    const flight: FlightDetails = {
      airline: form.airline.trim() || undefined,
      flight_number: flightNumber,
      ticket_number: form.ticket_number.trim() || undefined,
      departure_airport: form.departure_airport,
      arrival_airport: form.arrival_airport,
      departure_time: new Date(form.departure_time).toISOString(),
      arrival_time: form.arrival_time ? new Date(form.arrival_time).toISOString() : undefined,
      note: form.note.trim() || undefined,
      updated_at: new Date().toISOString(),
    };
    setSaving(true);
    try {
      await api.updateCandidateDetails(candidate.id, { flight }, user?.id ?? 'unknown', user?.email ?? 'unknown');
      window.dispatchEvent(new CustomEvent('supabase-data-changed'));
      await queryClient.invalidateQueries();
      toast.success('Flight details saved.');
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the flight details.');
    } finally {
      setSaving(false);
    }
  };

  const airportOptions = Object.values(AIRPORTS);
  const airportSelect = (id: string, value: string, onChange: (value: string) => void) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id}><SelectValue placeholder="Airport" /></SelectTrigger>
      <SelectContent>{airportOptions.map(airport => <SelectItem key={airport.code} value={airport.code}>{airport.code} · {airport.city}</SelectItem>)}</SelectContent>
    </Select>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Plane className="h-5 w-5" />Flight details</DialogTitle>
          <DialogDescription>{candidate.first_name} {candidate.last_name} · these details let the portal track the flight.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="flight-airline">Airline</Label><Input id="flight-airline" value={form.airline} onChange={event => set('airline')(event.target.value)} placeholder="Ethiopian Airlines" /></div>
            <div className="space-y-1.5"><Label htmlFor="flight-number">Flight number *</Label><Input id="flight-number" value={form.flight_number} onChange={event => set('flight_number')(event.target.value)} placeholder="ET472" /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="flight-ticket">Issued ticket number (if issued)</Label><Input id="flight-ticket" value={form.ticket_number} onChange={event => set('ticket_number')(event.target.value)} placeholder="Airline-issued ticket number" /></div>
            <div className="space-y-1.5"><Label htmlFor="flight-from">From *</Label>{airportSelect('flight-from', form.departure_airport, set('departure_airport'))}</div>
            <div className="space-y-1.5"><Label htmlFor="flight-to">To *</Label>{airportSelect('flight-to', form.arrival_airport, set('arrival_airport'))}</div>
            <div className="space-y-1.5"><Label htmlFor="flight-departs">Departure *</Label><Input id="flight-departs" type="datetime-local" value={form.departure_time} onChange={event => set('departure_time')(event.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="flight-arrives">Arrival</Label><Input id="flight-arrives" type="datetime-local" value={form.arrival_time} onChange={event => set('arrival_time')(event.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="flight-note">Note</Label><Textarea id="flight-note" value={form.note} onChange={event => set('note')(event.target.value)} rows={2} placeholder="Pickup arrangements, terminal, escort…" /></div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save flight'}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default FlightDetailsDialog;
