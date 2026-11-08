import { useState } from 'react';
import { CalendarDays, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { getConfig } from '@/lib/data-store';
import { evidenceToday } from '@/lib/evidence-requests';
import { setMinistrySubmissionWindow, submissionDeadline } from '@/lib/submission-policy';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import WidgetShell from './WidgetShell';

function initialCalendar() {
  try {
    const policy = submissionDeadline(getConfig());
    return { start: policy.start, end: policy.end, configured: policy.source === 'ministry', error: '' };
  } catch (error) {
    return { start: '', end: '', configured: false, error: error instanceof Error ? error.message : 'Could not read ministry submission dates.' };
  }
}
export default function MinistrySubmissionSettings() {
  const auth = useAuth();
  const [initial] = useState(initialCalendar);
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const [saved, setSaved] = useState(initial.configured);
  const [error, setError] = useState(initial.error);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await setMinistrySubmissionWindow(start, end, { id: auth.viewAs?.userId ?? auth.user?.id ?? '', email: auth.user?.email ?? '', role: auth.userRole ?? '' });
      setSaved(true); setError(''); toast.success('Submission window saved. New candidate evidence requests now use these dates.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save submission dates.'); }
    finally { setBusy(false); }
  };
  return <WidgetShell title="Ministry submission calendar" icon={CalendarDays} accent="indigo" description="Set the candidate evidence submission dates once. New payment reviews and escalations receive this deadline automatically." bodyClassName="space-y-4">
    {error && <p role="alert" className="text-sm text-destructive">{error} Enter a corrected window below.</p>}
    <p className="text-sm text-muted-foreground">Dates use Ethiopia time. {error ? 'No valid calendar is confirmed.' : saved ? 'A ministry / superadmin window is configured.' : 'Until saved, new requests use today through seven days from today.'} Existing issued requests keep their original deadline, so late evidence does not silently become on time.</p>
    <div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="submission-start">Submission opens</Label><Input id="submission-start" type="date" value={start} max={end || undefined} onChange={e => { setStart(e.target.value); setSaved(false); }} /></div><div><Label htmlFor="submission-end">Every candidate submission due</Label><Input id="submission-end" type="date" min={start > evidenceToday() ? start : evidenceToday()} value={end} onChange={e => { setEnd(e.target.value); setSaved(false); }} /></div></div>
    {end && end < evidenceToday() && <p role="alert" className="text-sm text-destructive">This window has expired. Set a new deadline; the previous deadline is not extended automatically.</p>}
    <Button disabled={busy} onClick={() => void save()}><Save className="mr-2 h-4 w-4" />{busy ? 'Saving…' : 'Save submission calendar · audit logged'}</Button>
  </WidgetShell>;
}
