import { ChartNoAxesCombined, Files, Fingerprint, UsersRound, WalletCards } from 'lucide-react';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { navigationAccent } from '@/components/ui/navigation-rail';

const sections = [
  { value: 'overview', label: 'Overview', detail: 'Today’s work', icon: ChartNoAxesCombined, color: '#38bdf8' },
  { value: 'portfolio', label: 'Workforce', detail: 'People & journeys', icon: UsersRound, color: '#a78bfa' },
  { value: 'finance', label: 'Payments', detail: 'Money & receipts', icon: WalletCards, color: '#34d399' },
  { value: 'compliance', label: 'Document checks', detail: 'Contracts & deadlines', icon: Files, color: '#fbbf24' },
  { value: 'candidates', label: 'Candidates', detail: 'Profiles & next steps', icon: Fingerprint, color: '#fb7185' },
];

export default function ControlRoomTabs() {
  return <TabsList aria-label="Dashboard sections" className="dashboard-navigation navigation-rail-featured">
    {sections.map(({ value, label, detail, icon: Icon, color }) => <TabsTrigger key={value} value={value} aria-label={label} style={navigationAccent(color)} className="dashboard-nav-item min-h-[104px] motion-reduce:transition-none">
      <Icon aria-hidden="true" className="dashboard-nav-glyph" strokeWidth={1.5} />
      <span className="min-w-0 text-left"><span className="block text-[15px] font-semibold tracking-tight">{label}</span><span className="navigation-rail-detail">{detail}</span></span>
    </TabsTrigger>)}
  </TabsList>;
}
