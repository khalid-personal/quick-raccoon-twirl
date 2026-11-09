import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import AnimatedNumber from '@/components/AnimatedNumber';

export interface StatCardItem {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
}

const StatCards: React.FC<{ items: StatCardItem[] }> = ({ items }) => (
  <div className={`grid grid-cols-2 gap-3 ${items.length === 5 ? 'xl:grid-cols-5' : items.length >= 4 ? 'md:grid-cols-4' : items.length === 3 ? 'md:grid-cols-3' : ''}`}>
    {items.map(item => {
      const content = <CardContent className="flex items-center justify-between gap-3 p-4">
          <div>
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className="text-2xl font-semibold tabular-nums">{typeof item.value === 'number' ? <AnimatedNumber value={item.value} /> : item.value}</p>
          </div>
          {item.icon}
        </CardContent>;
      return <Card key={item.label} className={`portal-kpi hover-lift ${item.active ? 'border-primary bg-primary/5' : ''}`}>
        {item.onClick ? <button type="button" onClick={item.onClick} aria-pressed={!!item.active} className="w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{content}</button> : content}
      </Card>;
    })}
  </div>
);

export default StatCards;
