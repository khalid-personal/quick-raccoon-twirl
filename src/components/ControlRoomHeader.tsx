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
  <header className="relative isolate overflow-hidden rounded-2xl bg-gradient-to-br from-[#123b36] via-[#174b43] to-[#1d5a4f] text-white shadow-lg">
    <div aria-hidden="true" className="absolute -right-10 -top-20 h-72 w-72 rounded-full border-[36px] border-white/[0.04]" />
    <div aria-hidden="true" className="absolute bottom-0 right-[28%] top-0 hidden w-px bg-white/10 xl:block" />
    <div className="relative flex flex-col gap-5 p-5 sm:p-7 xl:flex-row xl:items-end xl:justify-between">
      <div className="max-w-2xl">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-lime-200">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/10"><Icon className="h-3.5 w-3.5" /></span>
          {scope}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/75">{description}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs text-white/65">Snapshot · {new Date().toLocaleDateString('en-ET', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
        {actions}
      </div>
    </div>
  </header>
);

export default ControlRoomHeader;
