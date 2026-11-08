import { ArrowRight, ShieldCheck, ShieldAlert, Sparkles } from 'lucide-react';
import type { Severity } from '@/lib/integrity';
import { getIntegrityScoreLevel } from '@/lib/integrity';
import { getConfig } from '@/lib/data-store';
import { Button } from './ui/button';

export default function IntegrityScore({ score, counts, candidateCount, onReview }: { score: number; counts: Record<Severity, number>; candidateCount: number; onReview?: () => void }) {
  const level = getIntegrityScoreLevel(score, getConfig().integrityScoreThresholds);
  const tone = level === 'green' ? 'text-emerald-600 dark:text-emerald-400' : level === 'yellow' ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400';
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const label = level === 'green' ? 'On track' : level === 'yellow' ? 'Needs review' : 'Priority review';
  const urgent = counts.critical + counts.high;
  return <section aria-label="Record check score overview" className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-card via-card to-primary/10 p-5 shadow-lg shadow-primary/5 md:p-6">
    <div aria-hidden className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full bg-primary/5 blur-2xl" />
    <div className="relative flex flex-wrap items-center gap-6">
      <div className={`relative grid h-40 w-40 shrink-0 place-items-center ${tone}`}>
        <svg viewBox="0 0 160 160" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden><circle cx="80" cy="80" r="69" fill="none" stroke="currentColor" strokeWidth="11" opacity=".1" /><circle cx="80" cy="80" r="69" fill="none" stroke="currentColor" strokeWidth="11" strokeLinecap="round" strokeDasharray="433.54" strokeDashoffset={433.54 * (1 - score / 100)} className="transition-[stroke-dashoffset] duration-700 motion-reduce:transition-none" /></svg>
        <div className="text-center"><p className="font-heading text-5xl font-extrabold tabular-nums">{score}</p><p className="mt-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">out of 100</p></div>
      </div>
      <div className="min-w-0 flex-1 space-y-3"><div className={`flex items-center gap-2 text-sm font-semibold ${tone}`}>{urgent ? <ShieldAlert className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}{label}</div><h2 className="text-2xl font-bold md:text-3xl">Record check score</h2><p className="max-w-xl text-sm leading-relaxed text-muted-foreground">A higher score means fewer warnings. {candidateCount.toLocaleString()} candidate records checked. Warnings highlight missing or conflicting information; they do not prove wrongdoing.{urgent > 0 ? ` ${urgent} urgent issues still need attention, even with a high score.` : ''}</p>
        <div className="flex flex-wrap gap-2"><span className="rounded-lg border bg-background/80 px-3 py-2 text-sm"><strong>{total}</strong> records to review</span><span className={`rounded-lg border px-3 py-2 text-sm ${urgent ? 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'}`}><strong>{urgent}</strong> urgent issues</span></div>
        {onReview && <Button onClick={onReview} className="group">{total ? 'Review issues' : 'View checked records'}<ArrowRight className="transition-transform motion-safe:group-hover:translate-x-1" /></Button>}
        {!total && <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300"><Sparkles className="h-4 w-4" />No current warnings</p>}
      </div>
    </div>
  </section>;
}
