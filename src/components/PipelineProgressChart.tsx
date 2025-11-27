import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, PipelineDistribution } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Loader2 } from 'lucide-react';

const PipelineProgressChart: React.FC = () => {
  const { data: distribution, isLoading } = useQuery<PipelineDistribution[]>({
    queryKey: ['pipelineDistribution'],
    queryFn: api.getPipelineDistribution,
    initialData: [],
  });

  if (isLoading) {
    return (
      <Card className="h-[400px] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </Card>
    );
  }
  
  // Format data for Recharts: use ordinal index for X-axis, and shorten stage titles
  const chartData = distribution
    .sort((a, b) => a.ordinal - b.ordinal)
    .map(item => ({
      name: item.stageTitle.split(' ')[0], // Use first word for brevity
      Pending: item.pendingCount,
      'In Progress': item.inProgressCount,
      Blocked: item.blockedCount,
    }));
    
  const totalCandidates = chartData.reduce((sum, item) => sum + item.Pending + item['In Progress'] + item.Blocked, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pipeline Distribution ({totalCandidates} Active Candidates)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              layout="vertical"
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
              <XAxis type="number" stroke="hsl(var(--foreground))" />
              <YAxis dataKey="name" type="category" stroke="hsl(var(--foreground))" width={100} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Legend />
              <Bar dataKey="Pending" stackId="a" fill="hsl(var(--muted-foreground))" name="Pending" />
              <Bar dataKey="In Progress" stackId="a" fill="hsl(var(--primary))" name="In Progress" />
              <Bar dataKey="Blocked" stackId="a" fill="hsl(var(--destructive))" name="Blocked/Failed" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-muted-foreground mt-4 text-center">
          Chart shows the number of candidates currently blocked or waiting at each stage.
        </p>
      </CardContent>
    </Card>
  );
};

export default PipelineProgressChart;