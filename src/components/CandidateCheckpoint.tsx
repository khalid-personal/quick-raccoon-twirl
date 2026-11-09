import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { FeatureCardTitle } from './FeatureInfo';

export default function CandidateCheckpoint({ eyebrow, title, description, icon: Icon, metric, metricLabel, actions }: {
  eyebrow: string; title: string; description: string; icon: LucideIcon;
  metric?: ReactNode; metricLabel?: string; actions?: ReactNode;
}) {
  return <header className="flex flex-wrap items-start justify-between gap-5 rounded-t-3xl border-b border-primary/15 bg-gradient-to-br from-primary/10 via-transparent to-accent p-5 sm:p-7" data-candidate-checkpoint={title}>
    <div className="flex max-w-2xl items-start gap-4">
      <span className="control-nav-icon flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary"><Icon className="h-8 w-8" /></span>
      <div className="min-w-0"><p className="mb-1 text-xs font-semibold uppercase tracking-widest text-primary">{eyebrow}</p><FeatureCardTitle className="text-2xl font-bold sm:text-3xl">{title}</FeatureCardTitle><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p></div>
    </div>
    {(metric !== undefined || actions) && <div className="flex flex-wrap items-center gap-3">
      {metric !== undefined && <div className="rounded-2xl border border-primary/20 bg-background/70 px-5 py-4"><p className="text-3xl font-bold tabular-nums">{metric}</p><p className="mt-1 text-sm font-semibold text-muted-foreground">{metricLabel}</p></div>}
      {actions}
    </div>}
  </header>;
}
