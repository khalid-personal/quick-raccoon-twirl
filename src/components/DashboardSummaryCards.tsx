import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { DashboardSummary, CandidateSummary } from '@/lib/types';

interface SummaryCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  colorClass: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ title, value, icon, colorClass }) => (
  <Card className="hover:shadow-lg transition-shadow">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <div className={colorClass}>{icon}</div>
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      <p className="text-xs text-muted-foreground">Candidates</p>
    </CardContent>
  </Card>
);

interface DashboardSummaryCardsProps {
  onStatusSelect: (status: DashboardSummary['total'] | 'Pending' | 'In Progress' | 'Completed' | 'Blocked' | '') => void;
  selectedStatus: string;
}

const DashboardSummaryCards: React.FC<DashboardSummaryCardsProps> = ({ onStatusSelect, selectedStatus }) => {
  const { data: summary, isLoading } = useQuery<DashboardSummary>({
    queryKey: ['dashboardSummary'],
    queryFn: api.getDashboardSummary,
    initialData: { total: 0, pending: 0, in_progress: 0, completed: 0, blocked: 0 },
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i} className="h-[100px] flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </Card>
        ))}
      </div>
    );
  }
  
  const cards = [
    {
      title: "Total Candidates",
      value: summary.total,
      icon: <Users className="h-4 w-4" />,
      colorClass: "text-primary",
      statusKey: '',
    },
    {
      title: "Pending Start",
      value: summary.pending,
      icon: <Clock className="h-4 w-4" />,
      colorClass: "text-yellow-600",
      statusKey: 'Pending',
    },
    {
      title: "In Progress",
      value: summary.in_progress,
      icon: <Loader2 className="h-4 w-4 animate-spin" />,
      colorClass: "text-blue-600",
      statusKey: 'In Progress',
    },
    {
      title: "Completed / Issued",
      value: summary.completed,
      icon: <CheckCircle className="h-4 w-4" />,
      colorClass: "text-green-600",
      statusKey: 'Completed',
    },
    {
      title: "Blocked / Failed",
      value: summary.blocked,
      icon: <XCircle className="h-4 w-4" />,
      colorClass: "text-red-600",
      statusKey: 'Blocked',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => (
        <div 
          key={card.title} 
          onClick={() => onStatusSelect(card.statusKey as CandidateSummary['overall_status'] | '')}
          className={
            `cursor-pointer rounded-lg transition-all duration-150 
            ${selectedStatus === card.statusKey ? 'ring-2 ring-offset-2 ring-primary' : 'hover:ring-1 hover:ring-gray-300'}`
          }
        >
          <SummaryCard 
            title={card.title} 
            value={card.value} 
            icon={card.icon} 
            colorClass={card.colorClass} 
          />
        </div>
      ))}
    </div>
  );
};

export default DashboardSummaryCards;