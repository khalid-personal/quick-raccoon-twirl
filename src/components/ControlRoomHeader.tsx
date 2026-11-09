import React from 'react';
import { Activity } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface ControlRoomHeaderProps {
  scope: string;
  description: string;
  title?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
}

const ControlRoomHeader: React.FC<ControlRoomHeaderProps> = ({ scope, description, title = 'Dashboard', icon: Icon = Activity, actions }) => (
  <header className="portal-dashboard-hero relative overflow-hidden rounded-2xl border">
    <div className="relative flex flex-col gap-5 p-5 sm:p-7 xl:flex-row xl:items-end xl:justify-between">
      <div className="max-w-2xl">
        <p className="portal-dashboard-scope flex items-center gap-2 font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg"><Icon className="h-4 w-4" /></span>
          {scope}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        <p className="portal-dashboard-description mt-2 max-w-xl text-sm leading-relaxed">{description}</p>
      </div>
      <div className="flex flex-col items-start gap-3 xl:items-end">
        <span className="portal-dashboard-date text-xs">Today · {new Date().toLocaleDateString('en-ET', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
        <div className="portal-dashboard-actions flex flex-wrap items-center gap-2">{actions}</div>
      </div>
    </div>
  </header>
);

export default ControlRoomHeader;
