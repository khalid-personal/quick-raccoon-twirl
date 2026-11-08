import { Check, DollarSign, LayoutDashboard, ListChecks, ShieldCheck, Sparkles, Users2, Wallet } from 'lucide-react';
import type { CSSProperties } from 'react';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';

const sections = [
  { value: 'overview', label: 'Command', icon: LayoutDashboard, tone: 'border-sky-500/40 text-sky-700 dark:text-sky-300 bg-sky-500/5 hover:bg-sky-500/15 data-[state=active]:bg-sky-500/20 data-[state=active]:border-sky-500' },
  { value: 'portfolio', label: 'Portfolio', icon: Users2, tone: 'border-violet-500/40 text-violet-700 dark:text-violet-300 bg-violet-500/5 hover:bg-violet-500/15 data-[state=active]:bg-violet-500/20 data-[state=active]:border-violet-500' },
  { value: 'finance', label: 'Finance', icon: Wallet, tone: 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-500/5 hover:bg-emerald-500/15 data-[state=active]:bg-emerald-500/20 data-[state=active]:border-emerald-500' },
  { value: 'compliance', label: 'Compliance', icon: ShieldCheck, tone: 'border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-500/5 hover:bg-amber-500/15 data-[state=active]:bg-amber-500/20 data-[state=active]:border-amber-500' },
  { value: 'candidates', label: 'Candidates', icon: ListChecks, tone: 'border-rose-500/40 text-rose-700 dark:text-rose-300 bg-rose-500/5 hover:bg-rose-500/15 data-[state=active]:bg-rose-500/20 data-[state=active]:border-rose-500' },
];

export default function ControlRoomTabs() {
  return <TabsList aria-label="Control room sections" className="grid h-auto w-full grid-cols-2 gap-3 rounded-none border-b bg-transparent p-0 pb-4 sm:grid-cols-3 xl:grid-cols-5">
    {sections.map(({ value, label, icon: Icon, tone }, index) => <TabsTrigger key={value} value={value} aria-label={label} style={{ '--section-delay': `${index * -1.1}s` } as CSSProperties} className={`control-nav-shine group relative min-h-24 justify-start gap-4 overflow-hidden whitespace-normal rounded-2xl border-2 px-5 py-5 text-xl font-bold shadow-sm transition-all duration-200 motion-safe:hover:-translate-y-1 motion-safe:hover:scale-[1.02] hover:shadow-lg motion-reduce:transition-none data-[state=active]:shadow-md ${tone}`}>
      <span aria-hidden="true" className="control-nav-icon relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-current/15 bg-current/5">
        <Icon className="h-8 w-8" />
        <span className="control-nav-signal absolute -right-1 -top-1 rounded-full bg-card p-1 shadow-sm">{value === 'finance' ? <DollarSign className="h-4 w-4" /> : value === 'compliance' || value === 'candidates' ? <Check className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}</span>
      </span><span className="relative z-10 text-left"><span className="block">{label}</span><span className="mt-1 block text-xs font-medium opacity-75">{value === 'overview' ? 'Live operations' : value === 'portfolio' ? 'People & journeys' : value === 'finance' ? 'Money & receipts' : value === 'compliance' ? 'Trust & verification' : 'Profiles & stages'}</span></span>
    </TabsTrigger>)}
  </TabsList>;
}
