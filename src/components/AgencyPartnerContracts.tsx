import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { FeatureCardTitle as CardTitle } from '@/components/FeatureInfo';
import { api } from '@/lib/api';
import { normalizePartnerships, partnersForForeignAgency, partnersForLocalAgency } from '@/lib/agency-partnerships';
import { useAuth } from '@/lib/auth-context';
import type { AppConfig } from '@/lib/types';

const AgencyPartnerContracts: React.FC = () => {
  const { userLocalAgencyId, userForeignAgencyId } = useAuth();
  const { data: config, isLoading } = useQuery<AppConfig>({ queryKey: ['agency-partnership-config'], queryFn: api.getAppConfig });
  const foreignView = !!userForeignAgencyId && !userLocalAgencyId;
  const allPartnerships = normalizePartnerships(config?.agencyPartnerships);
  const partnerships = foreignView ? partnersForForeignAgency(allPartnerships, userForeignAgencyId ?? '') : partnersForLocalAgency(allPartnerships, userLocalAgencyId ?? '');

  return <Card>
    <CardHeader><CardTitle className="text-base">{foreignView ? 'Local' : 'Foreign'} partner contracts</CardTitle></CardHeader>
    <CardContent>
      {isLoading ? <p className="text-sm text-muted-foreground">Loading agreements...</p> : partnerships.length ? <ul className="divide-y">
        {partnerships.map(partnership => {
          const agency = foreignView ? config?.localAgencies.find(item => item.id === partnership.local_agency_id) : config?.foreignAgencies.find(item => item.id === partnership.foreign_agency_id);
          return <li key={`${partnership.local_agency_id}-${partnership.foreign_agency_id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
            <div><p className="font-medium">{agency?.name ?? 'Partner agency'}</p><p className="text-xs text-muted-foreground">{partnership.agreement_reference || 'Agreement reference not set'}</p></div>
            <Badge variant={partnership.status === 'active' ? 'default' : 'outline'}>{partnership.status}</Badge>
          </li>;
        })}
      </ul> : <p className="text-sm text-muted-foreground">No partner agreements are linked to this agency.</p>}
    </CardContent>
  </Card>;
};

export default AgencyPartnerContracts;
