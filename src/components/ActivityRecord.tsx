import { CheckCircle2, Clock3, FileText } from 'lucide-react';
import { getCandidates, getLocalAgencies, getPayments } from '@/lib/data-store';
import { actorDisplayName } from '@/lib/demo-identities';
import { presentActivity } from '@/lib/activity-presentation';
import { Badge } from './ui/badge';

export default function ActivityRecord({ activity }: { activity: {
  timestamp: string; description: string; action: string; actor?: string; actor_id?: string; actor_email?: string; target_id?: string;
} }) {
  const candidates = getCandidates();
  const info = presentActivity(activity.description, activity.action, {
    candidates, agencies: getLocalAgencies(), payment: getPayments().find(payment => payment.id === activity.target_id),
  });
  const actor = activity.actor ?? actorDisplayName(activity.actor_id ?? '', activity.actor_email, candidates);
  return <article className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
    <div className="flex items-start gap-3 border-b bg-gradient-to-r from-primary/10 to-transparent p-4">
      <span className="rounded-xl bg-primary/10 p-2 text-primary"><FileText className="h-5 w-5" aria-hidden="true" /></span>
      <div className="min-w-0 flex-1"><h3 className="font-semibold">{info.title}</h3><p className="mt-1 text-xs text-muted-foreground">{actor} · {new Date(activity.timestamp).toLocaleString()}</p></div>
      {info.practice && <Badge variant="outline">Practice record</Badge>}
    </div>
    <div className="space-y-3 p-4">
      <p className="text-sm leading-relaxed">{info.summary}</p>
      {!!info.facts.length && <dl className="grid gap-3 rounded-xl bg-muted/35 p-3 sm:grid-cols-2">{info.facts.map(fact => <div key={fact.label}><dt className="text-xs text-muted-foreground">{fact.label}</dt><dd className="mt-1 break-words text-sm font-medium">{fact.value}</dd></div>)}</dl>}
      {info.warning && <p role="status" className="text-sm text-amber-700 dark:text-amber-300">{info.warning}</p>}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{info.practice ? <Clock3 className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}{info.practice ? 'For practice only. No official clearance is granted.' : 'Saved in the activity history.'}</div>
      <details className="rounded-xl border p-3"><summary className="cursor-pointer text-xs font-medium text-muted-foreground">Original audit record (technical details)</summary><p className="mt-3 whitespace-pre-wrap break-all text-xs text-muted-foreground">{activity.description}</p></details>
    </div>
  </article>;
}
