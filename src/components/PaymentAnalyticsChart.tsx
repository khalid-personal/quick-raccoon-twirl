import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PaymentAnalytics, TimeFilter } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Loader2, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';

interface PaymentAnalyticsChartProps {
    timeFilter: TimeFilter; // NEW PROP
}

const PaymentAnalyticsChart: React.FC<PaymentAnalyticsChartProps> = ({ timeFilter }) => {
  const { data: analytics, isLoading } = useQuery<PaymentAnalytics>({
    queryKey: ['paymentAnalytics', timeFilter], // ADD timeFilter to query key
    queryFn: () => api.getPaymentAnalytics(timeFilter), // PASS timeFilter
    initialData: { totalFeesDue: 0, totalFeesPaid: 0, stages: [] },
  });

  if (isLoading) {
    return (
      <Card className="h-[400px] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </Card>
    );
  }
  
  const chartData = analytics.stages.map(item => ({
    name: item.stageTitle.split(' ')[0], // Use first word for brevity
    Paid: item.feesPaid,
    Unpaid: item.feesDue - item.feesPaid,
  }));
  
  const totalUnpaid = analytics.totalFeesDue - analytics.totalFeesPaid;
  
  const paidPercentage = analytics.totalFeesDue > 0 
    ? Math.round((analytics.totalFeesPaid / analytics.totalFeesDue) * 100) 
    : 0;
    
  const formatCurrency = (value: number) => `${value.toLocaleString()} ETB`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
            <div className="flex items-center text-2xl font-bold">
                <DollarSign className="h-6 w-6 mr-2 text-primary" />
                Financial Overview
            </div>
            <div className="text-sm font-medium text-muted-foreground">
                Overall Paid: <span className="font-bold text-primary text-lg">{paidPercentage}%</span>
            </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="p-4 border rounded-xl shadow-sm bg-green-50 dark:bg-green-900/20">
                <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-muted-foreground">Total Fees Paid</p>
                    <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <p className="text-2xl font-bold text-green-700 dark:text-green-400 mt-1">{formatCurrency(analytics.totalFeesPaid)}</p>
            </div>
            <div className="p-4 border rounded-xl shadow-sm bg-red-50 dark:bg-red-900/20">
                <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-muted-foreground">Total Fees Unpaid</p>
                    <TrendingDown className="h-5 w-5 text-red-600" />
                </div>
                <p className="text-2xl font-bold text-red-700 dark:text-red-400 mt-1">{formatCurrency(totalUnpaid)}</p>
            </div>
            <div className="p-4 border rounded-xl shadow-sm bg-gray-50 dark:bg-gray-800">
                <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-muted-foreground">Total Fees Due</p>
                    <DollarSign className="h-5 w-5 text-primary" />
                </div>
                <p className="text-2xl font-bold text-foreground mt-1">{formatCurrency(analytics.totalFeesDue)}</p>
            </div>
        </div>
        
        {/* Bar Chart */}
        <h3 className="text-lg font-semibold mb-4 border-b pb-2">Fees Distribution by Stage</h3>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 10, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-gray-200 dark:stroke-gray-700" />
              <XAxis dataKey="name" stroke="hsl(var(--foreground))" tickLine={false} axisLine={false} />
              <YAxis 
                stroke="hsl(var(--foreground))" 
                tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip 
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '0.5rem',
                    padding: '0.5rem'
                }}
                labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
              />
              <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px' }} />
              <Bar 
                dataKey="Paid" 
                stackId="a" 
                fill="hsl(142.1 76.2% 36.3%)" // A nice green
                name="Paid (ETB)" 
                radius={[4, 4, 0, 0]}
              />
              <Bar 
                dataKey="Unpaid" 
                stackId="a" 
                fill="hsl(0 84.2% 60.2%)" // A clear red
                name="Unpaid (ETB)" 
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-muted-foreground mt-4 text-center">
          Chart shows the total monetary value of paid vs unpaid fees per stage.
        </p>
      </CardContent>
    </Card>
  );
};

export default PaymentAnalyticsChart;