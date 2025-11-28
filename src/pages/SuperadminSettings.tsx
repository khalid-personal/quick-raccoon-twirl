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
  const { userRole, isLoading: isAuthLoading, user } = useAuth();
  const queryClient = useQueryClient();
  
  const actorId = user?.id || 'unknown';
  const actorEmail = user?.email || 'unknown@agency.com';
  
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
  
  const { data: config, isLoading } = useQuery({
    queryKey: ['appConfig'],
    queryFn: api.getAppConfig,
  });
  
  const [countryOptions, setCountryOptions] = useState<string[]>([]);
  const [newCountry, setNewCountry] = useState('');

  useEffect(() => {
    if (config) {
      // Filter out 'Other' as it's a special case not meant for direct editing here
      setCountryOptions(config.countryOptions.filter(c => c !== 'Other'));
    }
  }, [config]);

  const mutation = useMutation({
    mutationFn: (updatedCountries: string[]) => {
      // Re-add 'Other' before saving to maintain the required structure
      const finalConfig = { 
        countryOptions: [...updatedCountries, 'Other'],
        cocAgencies: config?.cocAgencies || [],
        foreignAgencies: config?.foreignAgencies || []
      };
      // Pass actor details for logging
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

  const handleSave = () => {
    if (countryOptions.length === 0) {
        toast.error("The country list cannot be empty.");
        return;
    }
    mutation.mutate(countryOptions);
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
          
          <Button 
            onClick={handleSave} 
            disabled={mutation.isPending}
            className="w-full"
          >
            {mutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Country List
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default SuperadminSettings;