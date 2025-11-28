import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/lib/auth';
import { Navigate } from 'react-router-dom';

const SuperadminSettings: React.FC = () => {
  const { userRole, user, isLoading: isAuthLoading } = useAuth();
  const queryClient = useQueryClient();
  
  // Role check and redirect
  if (isAuthLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (userRole !== 'admin') {
    toast.error("Access Denied: You must be a Superadmin to view settings.");
    return <Navigate to="/admin" replace />;
  }
  
  const actorId = user?.id || 'unknown-admin';
  const actorEmail = user?.email || 'unknown-admin@agency.com';

  const { data: config, isLoading } = useQuery({
    queryKey: ['appConfig'],
    queryFn: api.getAppConfig,
  });
  
  const [countryOptions, setCountryOptions] = useState<string[]>([]);
  const [newCountry, setNewCountry] = useState('');
  
  const [cocAgencies, setCocAgencies] = useState<string[]>([]);
  const [newCocAgency, setNewCocAgency] = useState('');

  const [foreignAgencies, setForeignAgencies] = useState<string[]>([]);
  const [newForeignAgency, setNewForeignAgency] = useState('');

  const [localAgencies, setLocalAgencies] = useState<string[]>([]); // NEW STATE
  const [newLocalAgency, setNewLocalAgency] = useState(''); // NEW STATE

  useEffect(() => {
    if (config) {
      // Filter out 'Other' as it's a special case not meant for direct editing here
      setCountryOptions(config.countryOptions.filter(c => c !== 'Other'));
      setCocAgencies(config.cocAgencies);
      setForeignAgencies(config.foreignAgencies);
      setLocalAgencies(config.localAgencies); // NEW
    }
  }, [config]);

  const mutation = useMutation({
    mutationFn: (updatedConfig: { countryOptions: string[], cocAgencies: string[], foreignAgencies: string[], localAgencies: string[] }) => {
      // Re-add 'Other' to country options before saving
      const finalCountryOptions = [...updatedConfig.countryOptions, 'Other'];
      const finalConfig = { 
          countryOptions: finalCountryOptions, 
          cocAgencies: updatedConfig.cocAgencies,
          foreignAgencies: updatedConfig.foreignAgencies,
          localAgencies: updatedConfig.localAgencies, // NEW
      };
      return api.updateAppConfig(finalConfig, actorId, actorEmail);
    },
    onSuccess: () => {
      toast.success("Application settings updated successfully.");
      queryClient.invalidateQueries({ queryKey: ['appConfig'] });
    },
    onError: (error) => {
      toast.error(`Failed to save settings: ${(error as Error).message}`);
    },
  });

  const handleAddCountry = () => {
    const trimmedCountry = newCountry.trim();
    if (!trimmedCountry) return;
    
    if (countryOptions.includes(trimmedCountry)) {
        toast.warning("This country is already in the list.");
        return;
    }
    
    setCountryOptions([...countryOptions, trimmedCountry]);
    setNewCountry('');
  };

  const handleRemoveCountry = (countryToRemove: string) => {
    setCountryOptions(countryOptions.filter(c => c !== countryToRemove));
  };
  
  const handleAddCocAgency = () => {
    const trimmedAgency = newCocAgency.trim();
    if (!trimmedAgency) return;
    
    if (cocAgencies.includes(trimmedAgency)) {
        toast.warning("This COC agency is already in the list.");
        return;
    }
    
    setCocAgencies([...cocAgencies, trimmedAgency]);
    setNewCocAgency('');
  };

  const handleRemoveCocAgency = (agencyToRemove: string) => {
    setCocAgencies(cocAgencies.filter(a => a !== agencyToRemove));
  };
  
  const handleAddForeignAgency = () => {
    const trimmedAgency = newForeignAgency.trim();
    if (!trimmedAgency) return;
    
    if (foreignAgencies.includes(trimmedAgency)) {
        toast.warning("This Foreign Employment Agency is already in the list.");
        return;
    }
    
    setForeignAgencies([...foreignAgencies, trimmedAgency]);
    setNewForeignAgency('');
  };

  const handleRemoveForeignAgency = (agencyToRemove: string) => {
    setForeignAgencies(foreignAgencies.filter(a => a !== agencyToRemove));
  };

  const handleAddLocalAgency = () => { // NEW FUNCTION
    const trimmedAgency = newLocalAgency.trim();
    if (!trimmedAgency) return;
    
    if (localAgencies.includes(trimmedAgency)) {
        toast.warning("This Local Agency is already in the list.");
        return;
    }
    
    setLocalAgencies([...localAgencies, trimmedAgency]);
    setNewLocalAgency('');
  };

  const handleRemoveLocalAgency = (agencyToRemove: string) => { // NEW FUNCTION
    setLocalAgencies(localAgencies.filter(a => a !== agencyToRemove));
  };

  const handleSave = () => {
    if (countryOptions.length === 0) {
        toast.error("The country list cannot be empty.");
        return;
    }
    if (cocAgencies.length === 0) {
        toast.error("The COC agency list cannot be empty.");
        return;
    }
    // Foreign agencies and Local agencies can be empty, as they are optional for candidates/users
    
    mutation.mutate({ countryOptions, cocAgencies, foreignAgencies, localAgencies });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold border-b pb-2">Superadmin Settings</h1>
      <p className="text-muted-foreground">Manage global application configurations. Only visible to users logged in as <span className="font-mono font-semibold">admin@agency.com</span>.</p>

      <Alert variant="default">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Warning</AlertTitle>
        <AlertDescription>
          Changes here affect all new candidate creation forms immediately. Existing candidates are unaffected.
        </AlertDescription>
      </Alert>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Candidate Country Options</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          
          <div className="space-y-2">
            <Label>Current Countries (excluding 'Other')</Label>
            <div className="space-y-2">
              {countryOptions.map((country) => (
                <div key={country} className="flex items-center justify-between p-2 border rounded-md bg-gray-50 dark:bg-gray-800">
                  <span>{country}</span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => handleRemoveCountry(country)}
                    disabled={mutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex space-x-2 pt-2">
            <Input 
              placeholder="Add new country"
              value={newCountry}
              onChange={(e) => setNewCountry(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddCountry();
                }
              }}
              disabled={mutation.isPending}
            />
            <Button onClick={handleAddCountry} type="button" disabled={mutation.isPending || !newCountry.trim()}>
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>COC Training Agencies</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Current COC Agencies</Label>
            <div className="space-y-2">
              {cocAgencies.map((agency) => (
                <div key={agency} className="flex items-center justify-between p-2 border rounded-md bg-gray-50 dark:bg-gray-800">
                  <span>{agency}</span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => handleRemoveCocAgency(agency)}
                    disabled={mutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex space-x-2 pt-2">
            <Input 
              placeholder="Add new COC agency"
              value={newCocAgency}
              onChange={(e) => setNewCocAgency(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddCocAgency();
                }
              }}
              disabled={mutation.isPending}
            />
            <Button onClick={handleAddCocAgency} type="button" disabled={mutation.isPending || !newCocAgency.trim()}>
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Foreign Employment Agencies</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Current Foreign Agencies</Label>
            <div className="space-y-2">
              {foreignAgencies.map((agency) => (
                <div key={agency} className="flex items-center justify-between p-2 border rounded-md bg-gray-50 dark:bg-gray-800">
                  <span>{agency}</span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => handleRemoveForeignAgency(agency)}
                    disabled={mutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex space-x-2 pt-2">
            <Input 
              placeholder="Add new foreign agency"
              value={newForeignAgency}
              onChange={(e) => setNewForeignAgency(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddForeignAgency();
                }
              }}
              disabled={mutation.isPending}
            />
            <Button onClick={handleAddForeignAgency} type="button" disabled={mutation.isPending || !newForeignAgency.trim()}>
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="max-w-lg"> {/* NEW CARD FOR LOCAL AGENCIES */}
        <CardHeader>
          <CardTitle>Local Agencies (COC)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Current Local Agencies</Label>
            <div className="space-y-2">
              {localAgencies.map((agency) => (
                <div key={agency} className="flex items-center justify-between p-2 border rounded-md bg-gray-50 dark:bg-gray-800">
                  <span>{agency}</span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => handleRemoveLocalAgency(agency)}
                    disabled={mutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex space-x-2 pt-2">
            <Input 
              placeholder="Add new local agency"
              value={newLocalAgency}
              onChange={(e) => setNewLocalAgency(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddLocalAgency();
                }
              }}
              disabled={mutation.isPending}
            />
            <Button onClick={handleAddLocalAgency} type="button" disabled={mutation.isPending || !newLocalAgency.trim()}>
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <Button 
        onClick={handleSave} 
        disabled={mutation.isPending}
        className="w-full max-w-lg"
      >
        {mutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
        Save All Settings
      </Button>
    </div>
  );
};

export default SuperadminSettings;