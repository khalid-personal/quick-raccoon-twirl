import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AuthorizationCode, StaffUser } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Key, Plus, Trash2, Copy, CheckCheck, CalendarDays, Users, Building, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { Navigate } from 'react-router-dom';
import { format, addDays } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface AppConfig {
    countryOptions: string[];
    cocAgencies: string[];
    foreignAgencies: string[];
}

const AdminAuthorizationCodes: React.FC = () => {
  const { userRole, user, isLoading: isAuthLoading } = useAuth();
  const queryClient = useQueryClient();
  
  const actorId = user?.id || 'unknown-admin';
  const actorEmail = user?.email || 'unknown-admin@agency.com';

  const [cocAgencyFilter, setCocAgencyFilter] = useState<string>('All');
  const [foreignAgencyFilter, setForeignAgencyFilter] = useState<string>('All');

  // Role check and redirect
  if (isAuthLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (userRole !== 'admin') {
    toast.error("Access Denied: You must be a Superadmin to manage authorization codes.");
    return <Navigate to="/admin" replace />;
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

  const [newCodeCocAgency, setNewCodeCocAgency] = useState<string>('');
  const [newCodeForeignAgency, setNewCodeForeignAgency] = useState<string>('');
  const [newCodeExpiresInDays, setNewCodeExpiresInDays] = useState<string>('');
  const [newCodeMaxUses, setNewCodeMaxUses] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const generateMutation = useMutation({
    mutationFn: () => {
      const expiresInDays = newCodeExpiresInDays ? parseInt(newCodeExpiresInDays) : undefined;
      const maxUses = newCodeMaxUses ? parseInt(newCodeMaxUses) : undefined;
      
      return api.generateAuthorizationCode(
        newCodeCocAgency === 'None' ? undefined : newCodeCocAgency,
        newCodeForeignAgency === 'None' ? undefined : newCodeForeignAgency,
        actorId,
        actorEmail,
        expiresInDays,
        maxUses
      );
    },
    onSuccess: (newCode) => {
      toast.success(`New authorization code generated: ${newCode.code}`);
      setNewCodeCocAgency('');
      setNewCodeForeignAgency('');
      setNewCodeExpiresInDays('');
      setNewCodeMaxUses('');
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to generate code: ${(error as Error).message}`);
    },
  });
  
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.info("Authorization code copied to clipboard!");
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const filteredCodes = authCodes.filter(code => {
    const matchesCoc = cocAgencyFilter === 'All' || code.coc_agency_name === cocAgencyFilter;
    const matchesForeign = foreignAgencyFilter === 'All' || code.foreign_agency_name === foreignAgencyFilter;
    return matchesCoc && matchesForeign;
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
        <Key className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">Authorization Code Management</h1>
      </div>
      <p className="text-muted-foreground">Generate and manage special codes for staff and agency users to register their accounts. These codes can be linked to specific agencies, expire, or have usage limits.</p>

      <Card>
        <CardHeader>
          <CardTitle>Generate New Authorization Code</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="coc_agency">Link to COC Agency (Optional)</Label>
              <Select
                value={newCodeCocAgency}
                onValueChange={setNewCodeCocAgency}
                disabled={generateMutation.isPending}
              >
                <SelectTrigger id="coc_agency">
                  <SelectValue placeholder="Select COC Agency (Optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="None">None</SelectItem>
                  {cocAgencies.map(agency => (
                    <SelectItem key={agency} value={agency}>
                      {agency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="foreign_agency">Link to Foreign Agency (Optional)</Label>
              <Select
                value={newCodeForeignAgency}
                onValueChange={setNewCodeForeignAgency}
                disabled={generateMutation.isPending}
              >
                <SelectTrigger id="foreign_agency">
                  <SelectValue placeholder="Select Foreign Agency (Optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="None">None</SelectItem>
                  {foreignAgencies.map(agency => (
                    <SelectItem key={agency} value={agency}>
                      {agency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="expires_in_days">Expires In (Days, Optional)</Label>
              <Input
                id="expires_in_days"
                type="number"
                placeholder="e.g., 30"
                value={newCodeExpiresInDays}
                onChange={(e) => setNewCodeExpiresInDays(e.target.value)}
                disabled={generateMutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_uses">Max Uses (Optional)</Label>
              <Input
                id="max_uses"
                type="number"
                placeholder="e.g., 1"
                value={newCodeMaxUses}
                onChange={(e) => setNewCodeMaxUses(e.target.value)}
                disabled={generateMutation.isPending}
              />
            </div>
          </div>

          <Button 
            onClick={() => generateMutation.mutate()} 
            disabled={generateMutation.isPending}
            className="w-full"
          >
            {generateMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            Generate Code
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing Authorization Codes ({filteredCodes.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <Select value={cocAgencyFilter} onValueChange={setCocAgencyFilter}>
                <SelectTrigger>
                  <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Filter by COC Agency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All COC Agencies</SelectItem>
                  {cocAgencies.map(agency => (
                    <SelectItem key={agency} value={agency}>
                      {agency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Select value={foreignAgencyFilter} onValueChange={setForeignAgencyFilter}>
                <SelectTrigger>
                  <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Filter by Foreign Agency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Foreign Agencies</SelectItem>
                  {foreignAgencies.map(agency => (
                    <SelectItem key={agency} value={agency}>
                      {agency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {filteredCodes.length === 0 ? (
            <p className="text-center text-muted-foreground p-8">No authorization codes found.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>COC Agency</TableHead>
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
                        <TableCell>{code.coc_agency_name || 'N/A'}</TableCell>
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
                          {/* Add more actions like deactivate/delete if needed */}
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

export default AdminAuthorizationCodes;