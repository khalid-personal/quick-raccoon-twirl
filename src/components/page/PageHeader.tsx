import React from 'react';
import FeatureInfo from '@/components/FeatureInfo';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({ title, description, actions }) => <header className="portal-page-header flex flex-wrap items-start justify-between gap-4 rounded-2xl border p-5 md:p-6">
  <div className="min-w-0 max-w-3xl space-y-2"><p className="portal-command-eyebrow">DAWM · Connected workforce</p><div className="flex items-center gap-2"><h1 className="text-3xl font-bold tracking-tight md:text-4xl">{title}</h1><FeatureInfo title={title} description={description} /></div>
  {description && <p className="text-base leading-relaxed text-muted-foreground">{description.split(/(?<=[.!?])\s+/)[0]}</p>}</div>
  {actions}
</header>;

export default PageHeader;
