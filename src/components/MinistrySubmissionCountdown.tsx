import { useEffect, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { getConfig } from '@/lib/data-store';
import { submissionCountdown } from '@/lib/submission-policy';

export default function MinistrySubmissionCountdown() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const refresh = () => setNow(new Date());
    const timer = window.setInterval(refresh, 1000);
    window.addEventListener('supabase-data-changed', refresh); window.addEventListener('storage', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('supabase-data-changed', refresh); window.removeEventListener('storage', refresh); };
  }, []);
  let countdown: ReturnType<typeof submissionCountdown>;
  try { countdown = submissionCountdown(getConfig(), now); }
  catch (error) { return <p role="alert" className="max-w-sm text-sm text-destructive">{error instanceof Error ? error.message : 'Submission countdown unavailable.'}</p>; }
  const pad = (value: number) => String(value).padStart(2, '0');
  return <section aria-label="Ministry submission countdown" className={`min-w-64 rounded-xl border px-4 py-3 ${countdown.status === 'expired' ? 'border-rose-500/30 bg-rose-500/10' : 'border-indigo-500/30 bg-indigo-500/10'}`}>
    <h2 className="flex items-center gap-2 text-sm font-semibold"><CalendarClock className="h-4 w-4" />{countdown.source === 'ministry' ? 'Ministry tracker' : 'Submission tracker · default'}</h2>
    <p className="mt-1 text-2xl font-bold tabular-nums" role="timer" aria-label={countdown.status === 'expired' ? 'Submission window overdue' : countdown.status === 'scheduled' ? 'Time until submissions open' : 'Time until submission deadline'}>
      {countdown.status === 'expired' ? 'Window overdue' : `${countdown.days}d ${pad(countdown.hours)}h ${pad(countdown.minutes)}m ${pad(countdown.seconds)}s`}
    </p>
    <p className="mt-1 text-xs text-muted-foreground">{countdown.status === 'scheduled' ? `Opens ${countdown.start}` : `Due ${countdown.end} · end of day`} · Ethiopia time</p>
  </section>;
}
