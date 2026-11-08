import type { CandidateSummary } from '@/lib/types';
import { summarizeCandidateListStatuses, type CandidateListStatus } from '@/lib/candidate-list-status';

interface Props { candidates: CandidateSummary[]; active: CandidateListStatus | null; onSelect: (status: CandidateListStatus | null) => void; }
export default function CandidateStatusSummary({ candidates, active, onSelect }: Props) {
  const counts = summarizeCandidateListStatuses(candidates);
  const statuses = [
    { key: 'inProgress', label: 'In progress', description: 'Registration started', color: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-300' },
    { key: 'pendingQr', label: 'Pending ministry QR', description: 'Local checks complete', color: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-300' },
    { key: 'completed', label: 'Completed', description: 'Workflow or ministry cleared', color: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300' },
    { key: 'failed', label: 'Failed', description: 'Blocked or ministry failure', color: 'bg-rose-500', text: 'text-rose-700 dark:text-rose-300' },
  ] as const;
  return <section aria-label="Candidate status summary" className="space-y-3 rounded-xl border bg-card p-4">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{statuses.map(status => <button type="button" key={status.key} aria-pressed={active === status.key} onClick={() => onSelect(active === status.key ? null : status.key)} className={`rounded-lg border p-3 text-left hover:bg-accent ${active === status.key ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'bg-muted/40'}`}>
      <p className="text-xs font-medium text-muted-foreground">{status.label}</p><p className={`mt-1 text-2xl font-semibold tabular-nums ${status.text}`}>{counts[status.key].toLocaleString()}</p><p className="text-[11px] text-muted-foreground">{status.description}</p>
    </button>)}</div>
    <div className="h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${counts.total} candidates. ${statuses.map(status => `${status.label}: ${counts[status.key]}`).join(', ')}`}>
      {counts.total > 0 && <div className="flex h-full w-full">{statuses.map(status => counts[status.key] > 0 && <span key={status.key} title={`${status.label}: ${counts[status.key]}`} className={status.color} style={{ width: `${counts[status.key] / counts.total * 100}%` }} />)}</div>}
    </div>
    <p className="text-xs text-muted-foreground">Click a total to filter the candidate list; click it again to clear. Pending means awaiting an official ministry QR after local checks, not starting registration.</p>
  </section>;
}
