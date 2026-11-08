import React, { useEffect, useState } from 'react';
import { Database } from 'lucide-react';
import { getCandidates, isSeedDisabled } from '@/lib/data-store';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { FeatureCardTitle as CardTitle } from '@/components/FeatureInfo';
import { Badge } from '@/components/ui/badge';
import IntegrityDemoScenarios from '@/components/IntegrityDemoScenarios';

const DemoDataCard: React.FC = () => {
  const [candidateCount, setCandidateCount] = useState(0);
  const [seedDisabled, setSeedDisabled] = useState(false);

  useEffect(() => {
    const refresh = () => {
      setCandidateCount(getCandidates().length);
      setSeedDisabled(isSeedDisabled());
    };
    refresh();
    window.addEventListener('supabase-data-changed', refresh);
    return () => window.removeEventListener('supabase-data-changed', refresh);
  }, []);

  return <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0">
      <CardTitle className="flex items-center gap-2 text-base"><Database className="h-4 w-4" />Demo data</CardTitle>
      <Badge variant={seedDisabled ? 'outline' : 'secondary'}>{seedDisabled ? 'Reseeding disabled' : 'Seed data enabled'}</Badge>
    </CardHeader>
    <CardContent><p className="text-sm text-muted-foreground">{candidateCount.toLocaleString()} candidate records are currently stored in this browser.</p>
      <IntegrityDemoScenarios />
    </CardContent>
  </Card>;
};

export default DemoDataCard;
