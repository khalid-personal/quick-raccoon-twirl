import { ChartNoAxesCombined, Files, Fingerprint, UsersRound, WalletCards } from 'lucide-react';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';

const sections = [
  { value: 'overview', label: 'Overview', detail: 'Today’s work', icon: ChartNoAxesCombined },
  { value: 'portfolio', label: 'Workforce', detail: 'People & journeys', icon: UsersRound },
  { value: 'finance', label: 'Payments', detail: 'Money & receipts', icon: WalletCards },
  { value: 'compliance', label: 'Document checks', detail: 'Contracts & deadlines', icon: Files },
  { value: 'candidates', label: 'Candidates', detail: 'Profiles & next steps', icon: Fingerprint },
];

export default function ControlRoomTabs() {
  return <TabsList aria-label="Dashboard sections" className="dashboard-navigation navigation-rail-featured">
    {sections.map(({ value, label, detail, icon: Icon }) => <TabsTrigger key={value} value={value} aria-label={label} className="dashboard-nav-item min-h-[88px] motion-reduce:transition-none">
      <Icon aria-hidden="true" className="dashboard-nav-glyph" strokeWidth={1.5} />
      <span className="min-w-0 text-left"><span className="block text-sm font-semibold tracking-tight">{label}</span><span className="navigation-rail-detail">{detail}</span></span>
    </TabsTrigger>)}
  </TabsList>;
}
