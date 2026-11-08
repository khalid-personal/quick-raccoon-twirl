import { ArrowUpRight, ChartNoAxesCombined, Files, Fingerprint, UsersRound, WalletCards } from 'lucide-react';
import type { CSSProperties } from 'react';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';

const sections = [
  { value: 'overview', label: 'Overview', detail: 'Today’s work', icon: ChartNoAxesCombined, color: '#38bdf8' },
  { value: 'portfolio', label: 'Workforce', detail: 'People & journeys', icon: UsersRound, color: '#a78bfa' },
  { value: 'finance', label: 'Payments', detail: 'Money & receipts', icon: WalletCards, color: '#34d399' },
  { value: 'compliance', label: 'Document checks', detail: 'Contracts & deadlines', icon: Files, color: '#fbbf24' },
  { value: 'candidates', label: 'Candidates', detail: 'Profiles & next steps', icon: Fingerprint, color: '#fb7185' },
];

export default function ControlRoomTabs() {
  return <TabsList aria-label="Dashboard sections" className="dashboard-navigation grid h-auto w-full grid-cols-1 gap-1.5 rounded-[1.5rem] border border-white/10 bg-[#101827] p-2 shadow-[0_16px_40px_-22px_#020617] sm:grid-cols-2 lg:grid-cols-5">
    {sections.map(({ value, label, detail, icon: Icon, color }, index) => <TabsTrigger key={value} value={value} aria-label={label} style={{ '--nav-color': color, '--section-delay': `${index * -1.1}s` } as CSSProperties} className="dashboard-nav-item group relative min-h-[104px] min-w-0 flex-col items-start justify-center gap-3 overflow-hidden whitespace-normal rounded-[1.1rem] border border-transparent px-5 py-4 text-white/70 transition-colors hover:bg-white/5 hover:text-white focus-visible:ring-white/70 data-[state=active]:bg-white/[0.07] data-[state=active]:text-white data-[state=active]:shadow-none motion-reduce:transition-none">
      <span aria-hidden="true" className="flex w-full items-center justify-between">
        <Icon className="dashboard-nav-glyph h-6 w-6" strokeWidth={1.5} />
        <span className="dashboard-nav-indicator h-1.5 w-1.5 rounded-full bg-white/20 transition-colors" />
      </span>
      <span className="flex w-full items-center justify-between gap-2 text-left"><span className="min-w-0"><span className="block text-[15px] font-semibold tracking-tight">{label}</span><span className="mt-1 block text-[11px] font-normal text-white/50">{detail}</span></span><ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-60 group-data-[state=active]:opacity-100" /></span>
    </TabsTrigger>)}
  </TabsList>;
}
