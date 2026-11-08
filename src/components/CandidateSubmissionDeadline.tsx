import { useEffect, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { getConfig } from '@/lib/data-store';
import { submissionDeadline } from '@/lib/submission-policy';

export default function CandidateSubmissionDeadline() {
  const [, refresh] = useState(0);
  useEffect(() => {
    const update = () => refresh(value => value + 1);
    const interval = window.setInterval(update, 60_000);
    window.addEventListener('supabase-data-changed', update); window.addEventListener('storage', update);
    return () => { window.clearInterval(interval); window.removeEventListener('supabase-data-changed', update); window.removeEventListener('storage', update); };
  }, []);
  let deadline: ReturnType<typeof submissionDeadline>;
  try { deadline = submissionDeadline(getConfig()); }
  catch (error) { return <p role="alert" className="rounded-xl border border-destructive/30 p-3 text-sm text-destructive">{error instanceof Error ? error.message : 'Could not read ministry submission dates.'}</p>; }
  return <section className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 ${deadline.status === 'expired' ? 'border-rose-500/30 bg-rose-500/10' : 'border-indigo-500/25 bg-indigo-500/5'}`} aria-label="Candidate submission deadline">
    <div><h3 className="flex items-center gap-2 text-base font-semibold"><CalendarClock className="h-5 w-5" />{deadline.source === 'ministry' ? 'Ministry submission window' : 'New submission · seven-day default'}</h3><p className="mt-1 text-sm text-muted-foreground">{deadline.start} through {deadline.end} · Ethiopia time · {deadline.status === 'expired' ? 'Window expired — ministry must set a new window' : deadline.status === 'scheduled' ? 'Opens on the start date' : 'Submission window open'}</p></div>
    <div className="text-right"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">New submissions due</p><p className="text-xl font-bold tabular-nums">{deadline.end}</p></div>
    <p className="w-full text-xs text-muted-foreground">Applies to every new candidate submission. Already issued evidence requests retain their recorded deadlines.</p>
  </section>;
}
