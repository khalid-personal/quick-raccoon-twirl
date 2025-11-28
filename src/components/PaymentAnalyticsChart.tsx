import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PaymentAnalytics } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Loader2, DollarSign } from 'lucide-react';

const PaymentAnalyticsChart: React.FC = () => {
  const { data: analytics, isLoading } = useQuery<PaymentAnalytics>({
    queryKey: ['paymentAnalytics'],
    queryFn: api.getPaymentAnalytics,
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
  
  const paidPercentage = analytics.totalFeesDue > 0 
    ? Math.round((analytics.totalFeesPaid / analytics.totalFeesDue) * 100) 
    : 0;
    
  const formatCurrency = (value: number) => `${value.toLocaleString()} ETB`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
                <DollarSign className="h-5 w-5 mr-2 text-green-600" />
                Payment Analytics
            </div>
            <div className="text-sm font-medium text-muted-foreground">
                Overall Paid: <span className="font-bold text-primary">{paidPercentage}%</span>
            </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="p-3 border rounded-lg bg-green-50 dark:bg-green-950/50">
                <p className="text-sm text-muted-foreground">Total Fees Paid</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(analytics.totalFeesPaid)}</p>
            </div>
            <div className="p-3 border rounded-lg bg-red-50 dark:bg-red-950/50">
                <p className="text-sm text-muted-foreground">Total Fees Unpaid</p>
                <p className="text-xl font-bold text-red-600">{formatCurrency(analytics.totalFeesDue - analytics.totalFeesPaid)}</p>
            </div>
            <div className="p-3 border rounded-lg bg-gray-50 dark:bg-gray-800">
                <p className="text-sm text-muted-foreground">Total Fees Due</p>
                <p className="text-xl font-bold text-primary">{formatCurrency(analytics.totalFeesDue)}</p>
            </div>
        </div>
        
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
              <XAxis dataKey="name" stroke="hsl(var(--foreground))" />
              <YAxis 
                stroke="hsl(var(--foreground))" 
                tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip 
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Legend />
              <Bar dataKey="Paid" stackId="a" fill="hsl(142.1 76.2% 36.3%)" name="Paid (ETB)" /> {/* Green */}
              <Bar dataKey="Unpaid" stackId="a" fill="hsl(0 84.2% 60.2%)" name="Unpaid (ETB)" /> {/* Red */}
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