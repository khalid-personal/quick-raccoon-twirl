import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import FeatureInfo from './FeatureInfo';

const ACCENTS = {
  indigo: { line: 'from-indigo-500 to-violet-500', chip: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300' },
  emerald: { line: 'from-emerald-500 to-teal-500', chip: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' },
  amber: { line: 'from-amber-500 to-orange-500', chip: 'bg-amber-500/10 text-amber-600 dark:text-amber-300' },
  rose: { line: 'from-rose-500 to-pink-500', chip: 'bg-rose-500/10 text-rose-600 dark:text-rose-300' },
  sky: { line: 'from-sky-500 to-cyan-500', chip: 'bg-sky-500/10 text-sky-600 dark:text-sky-300' },
  violet: { line: 'from-violet-500 to-fuchsia-500', chip: 'bg-violet-500/10 text-violet-600 dark:text-violet-300' },
} as const;

export type WidgetAccent = keyof typeof ACCENTS;

// Each dashboard widget gets its own icon, accent colour and header so tiles read as separate instruments.
const WidgetShell: React.FC<{
  title: string; description?: string; icon: LucideIcon; accent: WidgetAccent; actions?: React.ReactNode; children: React.ReactNode; className?: string; bodyClassName?: string;
}> = ({ title, description, icon: Icon, accent, actions, children, className, bodyClassName }) => (
  <section className={cn('portal-card flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm', className)}>
    <div className={cn('h-1 w-full bg-gradient-to-r', ACCENTS[accent].line)} />
    <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4">
      <div className="flex items-start gap-3">
        <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ring-current/10', ACCENTS[accent].chip)}><Icon className="h-5 w-5" /></span>
        <div>
          <div className="flex items-center gap-1"><h3 className="text-lg font-bold leading-tight">{title}</h3><FeatureInfo title={title} description={description} /></div>
          {description && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions}
    </header>
    <div className={cn('flex-1 px-5 pb-5 pt-4', bodyClassName)}>{children}</div>
  </section>
);

export default WidgetShell;
