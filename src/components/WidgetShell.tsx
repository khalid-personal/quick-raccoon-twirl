import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import FeatureInfo from './FeatureInfo';

export type WidgetAccent = 'indigo' | 'emerald' | 'amber' | 'rose' | 'sky' | 'violet';
const WidgetShell: React.FC<{
  title: string; description?: string; icon: LucideIcon; accent: WidgetAccent; actions?: React.ReactNode; children: React.ReactNode; className?: string; bodyClassName?: string;
}> = ({ title, description, icon: Icon, accent, actions, children, className, bodyClassName }) => (
  <section className={cn('portal-card flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm', className)}>
    <header className="portal-widget-heading flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
      <div className="flex items-start gap-3">
        <span data-accent={accent} className="portal-widget-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"><Icon className="h-5 w-5" /></span>
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
