import React, { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Navigate, Link } from 'react-router-dom';
import { Loader2, Building, LogOut, Search, Filter, ArrowUp, ArrowDown, CheckCircle, DollarSign } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { CandidateSummary, CandidateSortField, SortDirection, ALL_STAGES, ForeignAgency, LocalAgency } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import ProgressIndicator from '@/components/ProgressIndicator';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const statusColors: Record<CandidateSummary['overall_status'], string> = {
  'Completed': 'bg-green-500 hover:bg-green-600 text-white',
  'In Progress': 'bg-blue-500 hover:bg-blue-600 text-white',
  'Blocked': 'bg-red-500 hover:bg-red-600 text-white',
  'Pending': 'bg-yellow-500 hover:bg-yellow-600 text-white',
};

const RELEVANT_AGENCY_STAGES = ['job_matching', 'contract_signing', 'visa_processing', 'pdo', 'flight_departure'];

interface SortableHeaderProps {
  field: CandidateSortField;
  currentSort: CandidateSortField;
  currentDirection: SortDirection;
  label: string;
  onSort: (field: CandidateSortField) => void;
  className?: string;
}

const SortableHeader: React.FC<SortableHeaderProps> = ({ field, currentSort, currentDirection, label, onSort, className }) => {
  const isCurrent = currentSort === field;
  const Icon = isCurrent ? (currentDirection === 'asc' ? ArrowUp : ArrowDown) : null;

  return (
    <TableHead 
      className={cn("cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors", className)}
      onClick={() => onSort(field)}
    >
      <div className="flex items-center space-x-1">
        <span>{label}</span>
        {Icon && <Icon className="h-3 w-3" />}
      </div>
    </TableHead>
  );
};

const AgencyDashboard: React.FC = () => {
  const { userRole, user, isLoading: isAuthLoading, logout, userForeignAgencyName } = useAuth(); // Renamed
  const queryClient = useQueryClient();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [currentQuery, setCurrentQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<CandidateSummary['overall_status'] | ''>('');
  
  // Sorting state
  const [sortBy, setSortBy] = useState<CandidateSortField>('tracking_code');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Payment related states
  const [selectedCandidatesForPayment, setSelectedCandidatesForPayment] = useState<CandidateSummary[]>([]);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [paymentProcessingMessage, setPaymentProcessingMessage] = useState('');

  const { data: candidates = [], isLoading, refetch } = useQuery<CandidateSummary[]>({
    queryKey: ['agencyCandidates', currentQuery, filterStatus, userForeignAgencyName, sortBy, sortDirection], // Renamed
    queryFn: () => api.searchCandidates(
      currentQuery, 
      filterStatus || undefined, 
      undefined, // No batch filter for agency dashboard
      sortBy,
      sortDirection,
      'All', // No time filter for agency dashboard
      userForeignAgencyName, // Filter by the logged-in agency name
      undefined // No local agency filter here
    ),
    enabled: !!userForeignAgencyName, // Only fetch if agency is known
    initialData: [],
  });

  const { data: localAgencies = [] } = useQuery<LocalAgency[]>({
    queryKey: ['localAgencies'],
    queryFn: api.getLocalAgencyList,
    initialData: [],
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentQuery(searchQuery);
  };
  
  const handleStatusSelect = (status: CandidateSummary['overall_status'] | '') => {
    setFilterStatus(status);
    setCurrentQuery(''); 
    setSearchQuery('');
  };
  
  const handleSort = (field: CandidateSortField) => {
    if (field === sortBy) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('asc');
    }
  };

  const handleCandidateSelection = (candidate: CandidateSummary, isChecked: boolean) => {
    setSelectedCandidatesForPayment(prev => {
      if (isChecked) {
        // When selecting, ensure all selected candidates belong to the same local agency
        if (prev.length > 0 && prev[0].local_agency_id !== candidate.local_agency_id) {
          toast.error("All selected candidates must belong to the same Local Agency for a single payment.");
          return prev;
        }
        return [...prev, candidate];
      } else {
        return prev.filter(c => c.id !== candidate.id);
      }
    });
  };

  const handleInitiatePayment = () => {
    if (selectedCandidatesForPayment.length === 0) {
      toast.error("Please select at least one candidate to initiate payment.");
      return;
    }
    setIsPaymentDialogOpen(true);
  };

  const paymentMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !user?.email || !userForeignAgencyName) {
        throw new Error("User or foreign agency information missing.");
      }
      const payerForeignAgency = api.getForeignAgencyList().find(fa => fa.name === userForeignAgencyName);
      if (!payerForeignAgency) {
        throw new Error("Foreign agency not found in system.");
      }

      const candidateIds = selectedCandidatesForPayment.map(c => c.id);
      setPaymentProcessingMessage("Initiating payment with gateway...");
      const { checkoutUrl, paymentId } = await api.initiatePayment(
        payerForeignAgency.id,
        candidateIds,
        user.id,
        user.email
      );

      // Simulate redirect to checkout and then webhook callback
      setPaymentProcessingMessage("Redirecting to payment gateway (mock)...");
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate redirect time

      // Mock webhook success/failure
      const paymentSuccess = Math.random() > 0.1; // 90% success rate
      setPaymentProcessingMessage(`Payment gateway responded: ${paymentSuccess ? 'Success' : 'Failure'}. Processing...`);
      await api.processPaymentWebhook(paymentId, paymentSuccess ? 'succeeded' : 'failed');
      
      return paymentSuccess;
    },
    onSuccess: (paymentSuccess) => {
      if (paymentSuccess) {
        toast.success("Payment processed successfully! Candidate statuses updated.");
      } else {
        toast.error("Payment failed. Please try again.");
      }
      setSelectedCandidatesForPayment([]);
      setIsPaymentDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['agencyCandidates'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      queryClient.invalidateQueries({ queryKey: ['paymentAnalytics'] });
      refetch(); // Refetch candidates to update their payment status
    },
    onError: (error) => {
      toast.error(`Payment initiation failed: ${(error as Error).message}`);
      setIsPaymentDialogOpen(false);
    },
  });

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (userRole !== 'agency' || !userForeignAgencyName) { // Renamed
    return <Navigate to="/login" replace />;
  }
  
  const agencyEmail = user?.email || 'Foreign Agency';
  const agencyName = userForeignAgencyName; // Use the actual foreign agency name

  const totalPaymentAmount = selectedCandidatesForPayment.length * 1000; // Mock fee per candidate

  return (
    <div className="min-h-screen container mx-auto py-12 space-y-8">
      <Card className="border-blue-500 shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-3xl flex items-center text-blue-600 dark:text-blue-400">
            <Building className="h-7 w-7 mr-3" />
            {agencyName} Portal Dashboard
          </CardTitle>
          <Button onClick={logout} variant="destructive">
            <LogOut className="h-4 w-4 mr-2" /> Logout
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-lg text-muted-foreground">
            Welcome, {agencyEmail}. This is your restricted view of candidate data matched to your agency.
          </p>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Staged Candidates ({candidates.length})
                <Button 
                  onClick={handleInitiatePayment} 
                  disabled={selectedCandidatesForPayment.length === 0 || paymentMutation.isPending}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {paymentMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <DollarSign className="h-4 w-4 mr-2" />}
                  Dispense & Pay ({selectedCandidatesForPayment.length})
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-4 mb-4">
                <form onSubmit={handleSearch} className="flex space-x-2 flex-grow">
                  <Input
                    placeholder="Search by Name, Passport, or Tracking Code"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-grow"
                  />
                  <Button type="submit">
                    <Search className="h-4 w-4 mr-2" /> Search
                  </Button>
                </form>
                
                <div className="w-full md:w-60">
                  <Select
                    value={filterStatus}
                    onValueChange={handleStatusSelect}
                  >
                    <SelectTrigger>
                      <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                      <SelectValue placeholder="Filter by Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Statuses</SelectItem>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="In Progress">In Progress</SelectItem>
                      <SelectItem value="Completed">Completed</SelectItem>
                      <SelectItem value="Blocked">Blocked</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {isLoading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : candidates.length === 0 ? (
                <p className="text-center text-muted-foreground p-8">No candidates found matching your criteria or agency.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          {/* Select All Checkbox (Optional, for simplicity not implemented here) */}
                        </TableHead>
                        <SortableHeader 
                          field="first_name" 
                          currentSort={sortBy} 
                          currentDirection={sortDirection} 
                          label="Name" 
                          onSort={handleSort} 
                        />
                        <SortableHeader 
                          field="tracking_code" 
                          currentSort={sortBy} 
                          currentDirection={sortDirection} 
                          label="Tracking Code" 
                          onSort={handleSort} 
                        />
                        <TableHead>Passport</TableHead>
                        <SortableHeader 
                          field="country_of_origin" 
                          currentSort={sortBy} 
                          currentDirection={sortDirection} 
                          label="Origin" 
                          onSort={handleSort} 
                        />
                        <TableHead>Local Agency</TableHead> {/* Display Local Agency */}
                        <TableHead>Payment Status</TableHead> {/* Display Payment Status */}
                        <SortableHeader 
                          field="overall_status" 
                          currentSort={sortBy} 
                          currentDirection={sortDirection} 
                          label="Overall Status" 
                          onSort={handleSort} 
                        />
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {candidates.map((candidate) => {
                        const isSelected = selectedCandidatesForPayment.some(c => c.id === candidate.id);
                        const localAgency = localAgencies.find(la => la.id === candidate.local_agency_id);
                        
                        // Only allow selection of candidates that are 'In Progress' and 'unpaid'
                        const isSelectable = candidate.overall_status === 'In Progress' && candidate.payment_status === 'unpaid';

                        return (
                          <TableRow key={candidate.id} className={cn(isSelected && "bg-blue-50/50 dark:bg-blue-950/50")}>
                            <TableCell>
                              <Checkbox 
                                checked={isSelected}
                                onCheckedChange={(checked) => handleCandidateSelection(candidate, checked as boolean)}
                                disabled={!isSelectable || paymentMutation.isPending}
                              />
                            </TableCell>
                            <TableCell className="font-medium">
                              <Link 
                                to={`/admin/candidate/${candidate.id}`} 
                                className="hover:text-primary hover:underline transition-colors"
                              >
                                {candidate.first_name} {candidate.last_name}
                              </Link>
                            </TableCell>
                            <TableCell>{candidate.tracking_code}</TableCell>
                            <TableCell>{candidate.passport_number}</TableCell>
                            <TableCell>{candidate.country_of_origin}</TableCell>
                            <TableCell>{localAgency?.name || 'N/A'}</TableCell> {/* Display Local Agency Name */}
                            <TableCell>
                              <Badge 
                                className={cn(
                                  candidate.payment_status === 'paid' && 'bg-green-500',
                                  candidate.payment_status === 'pending_payment' && 'bg-yellow-500',
                                  candidate.payment_status === 'payment_failed' && 'bg-red-500',
                                  candidate.payment_status === 'unpaid' && 'bg-gray-500',
                                  'text-white'
                                )}
                              >
                                {candidate.payment_status.replace(/_/g, ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={statusColors[candidate.overall_status]}>
                                {candidate.overall_status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Link to={`/admin/candidate/${candidate.id}`}>
                                <Button variant="outline" size="sm">View/Edit</Button>
                              </Link>
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
        </CardContent>
      </Card>

      {/* Payment Confirmation Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Payment for Selected Candidates</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              You are about to initiate a payment for the following candidates:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              {selectedCandidatesForPayment.map(c => (
                <li key={c.id}>
                  {c.first_name} {c.last_name} ({c.tracking_code}) - Local Agency: {localAgencies.find(la => la.id === c.local_agency_id)?.name || 'N/A'}
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between font-bold text-lg border-t pt-4">
              <Label>Total Amount (Mock)</Label>
              <span>{totalPaymentAmount.toLocaleString()} ETB</span>
            </div>
            {paymentMutation.isPending && (
              <div className="flex items-center space-x-2 text-blue-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{paymentProcessingMessage}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsPaymentDialogOpen(false)} 
              disabled={paymentMutation.isPending}
            >
              Cancel
            </Button>
            <Button 
              onClick={() => paymentMutation.mutate()} 
              disabled={paymentMutation.isPending}
            >
              {paymentMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <DollarSign className="h-4 w-4 mr-2" />}
              Confirm & Pay
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AgencyDashboard;