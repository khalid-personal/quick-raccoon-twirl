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
import { CocFacility, ForeignAgency, LocalAgency } from '@/lib/types'; // NEW IMPORT
import { v4 as uuidv4 } from 'uuid'; // NEW IMPORT

interface AppConfig {
    countryOptions: string[];
    cocFacilities: CocFacility[];
    foreignAgencies: ForeignAgency[];
    localAgencies: LocalAgency[];
}

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

  const { data: config, isLoading } = useQuery<AppConfig>({
    queryKey: ['appConfig'],
    queryFn: api.getAppConfig,
  });
  
  const [countryOptions, setCountryOptions] = useState<string[]>([]);
  const [newCountry, setNewCountry] = useState('');
  
  const [cocFacilities, setCocFacilities] = useState<CocFacility[]>([]); // Changed to array of objects
  const [newCocFacilityName, setNewCocFacilityName] = useState(''); // For new facility name

  const [foreignAgencies, setForeignAgencies] = useState<ForeignAgency[]>([]); // Changed to array of objects
  const [newForeignAgencyName, setNewForeignAgencyName] = useState(''); // For new agency name

  const [localAgencies, setLocalAgencies] = useState<LocalAgency[]>([]); // Changed to array of objects
  const [newLocalAgencyName, setNewLocalAgencyName] = useState(''); // For new agency name

  useEffect(() => {
    if (config) {
      // Filter out 'Other' as it's a special case not meant for direct editing here
      setCountryOptions(config.countryOptions.filter(c => c !== 'Other'));
      setCocFacilities(config.cocFacilities);
      setForeignAgencies(config.foreignAgencies);
      setLocalAgencies(config.localAgencies);
    }
  }, [config]);

  const mutation = useMutation({
    mutationFn: (updatedConfig: AppConfig) => { // Updated type
      // Re-add 'Other' to country options before saving
      const finalCountryOptions = [...updatedConfig.countryOptions, 'Other'];
      const finalConfig = { 
          ...updatedConfig,
          countryOptions: finalCountryOptions, 
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
  
  const handleAddCocFacility = () => { // NEW FUNCTION
    const trimmedName = newCocFacilityName.trim();
    if (!trimmedName) return;
    
    if (cocFacilities.some(f => f.name === trimmedName)) {
        toast.warning("This COC facility is already in the list.");
        return;
    }
    
    setCocFacilities([...cocFacilities, { id: uuidv4(), name: trimmedName, created_at: new Date().toISOString() }]);
    setNewCocFacilityName('');
  };

  const handleRemoveCocFacility = (idToRemove: string) => { // NEW FUNCTION
    setCocFacilities(cocFacilities.filter(f => f.id !== idToRemove));
  };
  
  const handleAddForeignAgency = () => { // NEW FUNCTION
    const trimmedName = newForeignAgencyName.trim();
    if (!trimmedName) return;
    
    if (foreignAgencies.some(a => a.name === trimmedName)) {
        toast.warning("This Foreign Employment Agency is already in the list.");
        return;
    }
    
    setForeignAgencies([...foreignAgencies, { id: uuidv4(), name: trimmedName, created_at: new Date().toISOString() }]);
    setNewForeignAgencyName('');
  };

  const handleRemoveForeignAgency = (idToRemove: string) => { // NEW FUNCTION
    setForeignAgencies(foreignAgencies.filter(a => a.id !== idToRemove));
  };

  const handleAddLocalAgency = () => { // NEW FUNCTION
    const trimmedName = newLocalAgencyName.trim();
    if (!trimmedName) return;
    
    if (localAgencies.some(a => a.name === trimmedName)) {
        toast.warning("This Local Agency is already in the list.");
        return;
    }
    
    setLocalAgencies([...localAgencies, { id: uuidv4(), name: trimmedName, created_at: new Date().toISOString() }]);
    setNewLocalAgencyName('');
  };

  const handleRemoveLocalAgency = (idToRemove: string) => { // NEW FUNCTION
    setLocalAgencies(localAgencies.filter(a => a.id !== idToRemove));
  };

  const handleSave = () => {
    if (countryOptions.length === 0) {
        toast.error("The country list cannot be empty.");
        return;
    }
    if (cocFacilities.length === 0) {
        toast.error("The COC facility list cannot be empty.");
        return;
    }
    // Foreign agencies and Local agencies can be empty, as they are optional for candidates/users
    
    mutation.mutate({ countryOptions, cocFacilities, foreignAgencies, localAgencies }); // Updated payload
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
          <CardTitle>COC Training Facilities</CardTitle> {/* Updated Title */}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Current COC Facilities</Label> {/* Updated Label */}
            <div className="space-y-2">
              {cocFacilities.map((facility) => (
                <div key={facility.id} className="flex items-center justify-between p-2 border rounded-md bg-gray-50 dark:bg-gray-800">
                  <span>{facility.name}</span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => handleRemoveCocFacility(facility.id)}
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
              placeholder="Add new COC facility"
              value={newCocFacilityName}
              onChange={(e) => setNewCocFacilityName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddCocFacility();
                }
              }}
              disabled={mutation.isPending}
            />
            <Button onClick={handleAddCocFacility} type="button" disabled={mutation.isPending || !newCocFacilityName.trim()}>
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
                <div key={agency.id} className="flex items-center justify-between p-2 border rounded-md bg-gray-50 dark:bg-gray-800">
                  <span>{agency.name}</span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => handleRemoveForeignAgency(agency.id)}
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
              value={newForeignAgencyName}
              onChange={(e) => setNewForeignAgencyName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddForeignAgency();
                }
              }}
              disabled={mutation.isPending}
            />
            <Button onClick={handleAddForeignAgency} type="button" disabled={mutation.isPending || !newForeignAgencyName.trim()}>
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Local Agencies</CardTitle> {/* Updated Title */}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Current Local Agencies</Label> {/* Updated Label */}
            <div className="space-y-2">
              {localAgencies.map((agency) => (
                <div key={agency.id} className="flex items-center justify-between p-2 border rounded-md bg-gray-50 dark:bg-gray-800">
                  <span>{agency.name}</span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => handleRemoveLocalAgency(agency.id)}
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
              value={newLocalAgencyName}
              onChange={(e) => setNewLocalAgencyName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddLocalAgency();
                }
              }}
              disabled={mutation.isPending}
            />
            <Button onClick={handleAddLocalAgency} type="button" disabled={mutation.isPending || !newLocalAgencyName.trim()}>
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