import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PipelineDistribution, TimeFilter } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Loader2 } from 'lucide-react';

interface PipelineProgressChartProps {
    timeFilter: TimeFilter; // NEW PROP
    foreignAgencyFilter?: string; // NEW PROP
}

const PipelineProgressChart: React.FC<PipelineProgressChartProps> = ({ timeFilter, foreignAgencyFilter }) => {
  const { data: distribution, isLoading } = useQuery<PipelineDistribution[]>({
    queryKey: ['pipelineDistribution', timeFilter, foreignAgencyFilter], // ADD foreignAgencyFilter to query key
    queryFn: () => api.getPipelineDistribution(timeFilter, foreignAgencyFilter), // PASS foreignAgencyFilter
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
              {/* Cleaned up grid: only vertical lines, solid stroke */}
              <CartesianGrid horizontal={false} stroke="hsl(var(--border))" />
              <XAxis type="number" stroke="hsl(var(--foreground))" axisLine={false} tickLine={false} />
              <YAxis dataKey="name" type="category" stroke="hsl(var(--foreground))" width={120} axisLine={false} tickLine={false} />
              <Tooltip 
                contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '0.5rem',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}
                labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
              />
              <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px' }} />
              
              {/* Updated Colors and added radius for a softer look */}
              <Bar 
                dataKey="Pending" 
                stackId="a" 
                fill="hsl(48 96% 89%)" // Light Yellow/Orange
                name="Pending" 
                radius={[0, 4, 4, 0]}
              />
              <Bar 
                dataKey="In Progress" 
                stackId="a" 
                fill="hsl(217.2 91.2% 59.8%)" // Vibrant Blue
                name="In Progress" 
                radius={[0, 4, 4, 0]}
              />
              <Bar 
                dataKey="Blocked" 
                stackId="a" 
                fill="hsl(0 84.2% 60.2%)" // Destructive Red
                name="Blocked/Failed" 
                radius={[0, 4, 4, 0]}
              />
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