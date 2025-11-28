"use client";

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AuthorizationCode } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Key, Plus, Trash2, Copy, CheckCheck, CalendarDays, Users, Building, Filter, Landmark } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { Navigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface AppConfig {
    countryOptions: string[];
    cocAgencies: string[];
    foreignAgencies: string[];
}

const LocalAgencyAuthorizationCodes: React.FC = () => {
  const { userRole, user, isLoading: isAuthLoading, userCocAgency } = useAuth();
  const queryClient = useQueryClient();
  
  const actorId = user?.id || 'unknown-local-agency';
  const actorEmail = user?.email || 'unknown-local-agency@agency.com';

  // Role check and redirect
  if (isAuthLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (userRole !== 'local-agency' || !userCocAgency) {
    toast.error("Access Denied: You must be a Local Agency user to view authorization codes.");
    return <Navigate to="/local-agency" replace />;
  }

  const { data: authCodes = [], isLoading, refetch } = useQuery<AuthorizationCode[]>({
    queryKey: ['authorizationCodes'],
    queryFn: api.getAuthorizationCodes,
  });
  
  const { data: config, isLoading: isLoadingConfig } = useQuery<AppConfig>({
    queryKey: ['appConfig'],
    queryFn: api.getAppConfig,
    initialData: { countryOptions: [], cocAgencies: [], foreignAgencies: [] },
  });
  const cocAgencies = config.cocAgencies;
  const foreignAgencies = config.foreignAgencies;

  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.info("Authorization code copied to clipboard!");
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Filter codes to only show those relevant to the logged-in local agency
  const filteredCodes = authCodes.filter(code => {
    return code.coc_agency_name === userCocAgency;
  });

  if (isLoading || isLoadingConfig) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3 border-b pb-2">
        <Key className="h-8 w-8 text-green-600" />
        <h1 className="text-3xl font-bold">My Agency's Authorization Codes</h1>
      </div>
      <p className="text-muted-foreground">View authorization codes linked to your local agency ({userCocAgency}). These codes can be used by staff to register new accounts associated with your agency.</p>

      <Card>
        <CardHeader>
          <CardTitle>Existing Authorization Codes ({filteredCodes.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredCodes.length === 0 ? (
            <p className="text-center text-muted-foreground p-8">No authorization codes found for your agency.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Foreign Agency</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead>Expires At</TableHead>
                    <TableHead>Uses</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCodes.map((code) => {
                    const isExpired = code.expires_at && new Date(code.expires_at) < new Date();
                    const isMaxedOut = code.max_uses !== undefined && code.usage_count >= code.max_uses;
                    const status = isExpired ? 'Expired' : isMaxedOut ? 'Maxed Out' : code.is_active ? 'Active' : 'Inactive';
                    const statusColor = isExpired || isMaxedOut || !code.is_active ? 'bg-red-500' : 'bg-green-500';

                    return (
                      <TableRow key={code.code}>
                        <TableCell className="font-mono text-sm">{code.code.substring(0, 8)}...</TableCell>
                        <TableCell>{code.foreign_agency_name || 'N/A'}</TableCell>
                        <TableCell>{code.created_by_admin_id.substring(0, 4)}...</TableCell>
                        <TableCell>{format(new Date(code.created_at), 'PPP')}</TableCell>
                        <TableCell>
                          {code.expires_at ? format(new Date(code.expires_at), 'PPP') : 'Never'}
                        </TableCell>
                        <TableCell>{code.usage_count} {code.max_uses ? `/ ${code.max_uses}` : ''}</TableCell>
                        <TableCell>
                          <Badge className={statusColor}>{status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleCopyCode(code.code)}
                            title="Copy Code"
                          >
                            {copiedCode === code.code ? <CheckCheck className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LocalAgencyAuthorizationCodes;