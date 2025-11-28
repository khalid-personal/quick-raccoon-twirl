import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { CandidateSummary, CandidateSortField, SortDirection, TimeFilter } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Loader2, Filter, ArrowUp, ArrowDown, Building, Link as LinkIcon, UserPlus } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import ProgressIndicator from '@/components/ProgressIndicator';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const statusColors: Record<CandidateSummary['overall_status'], string> = {
  'Completed': 'bg-green-500 hover:bg-green-600 text-white',
  'In Progress': 'bg-blue-500 hover:bg-blue-600 text-white',
  'Blocked': 'bg-red-500 hover:bg-red-600 text-white',
  'Pending': 'bg-yellow-500 hover:bg-yellow-600 text-white',
};

const ALL_BATCHES_FILTER = 'ALL_BATCHES_FILTER';
const ALL_STATUS_FILTER = 'ALL_STATUS_FILTER';

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

const AgencyStagedCandidates: React.FC = () => {
  const { userRole, user, isLoading: isAuthLoading, userForeignAgency } = useAuth();
  const queryClient = useQueryClient();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [currentQuery, setCurrentQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<CandidateSummary['overall_status'] | ''>(ALL_STATUS_FILTER);
  const [filterBatch, setFilterBatch] = useState<string>(ALL_BATCHES_FILTER);
  
  // Sorting state
  const [sortBy, setSortBy] = useState<CandidateSortField>('tracking_code');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const effectiveFilterBatch = filterBatch === ALL_BATCHES_FILTER ? undefined : filterBatch;
  const effectiveFilterStatus = filterStatus === ALL_STATUS_FILTER ? undefined : filterStatus;

  // Ensure only candidates relevant to this agency are fetched
  const foreignAgencyFilter = userForeignAgency;
  const actorId = user?.id || 'unknown';
  const actorEmail = user?.email || 'unknown@agency.com';

  const { data: candidates = [], isLoading, refetch } = useQuery<CandidateSummary[]>({
    queryKey: ['agencyCandidates', currentQuery, effectiveFilterStatus, effectiveFilterBatch, sortBy, sortDirection, foreignAgencyFilter],
    queryFn: () => api.searchCandidates(
      currentQuery, 
      effectiveFilterStatus, 
      effectiveFilterBatch,
      sortBy,
      sortDirection,
      'All', // Agencies typically view all time candidates
      foreignAgencyFilter // Crucial filter for agency view
    ),
    enabled: !!foreignAgencyFilter, // Only fetch if agency is known
    initialData: [],
  });
  
  const { data: activeBatches = [], isLoading: isLoadingBatches } = useQuery<string[]>({
    queryKey: ['activeBatches'],
    queryFn: api.getBatches,
  });

  const matchCandidateMutation = useMutation({
    mutationFn: ({ candidateId, agencyName }: { candidateId: string, agencyName: string }) => 
      api.matchCandidateToAgency(candidateId, agencyName, actorId, actorEmail),
    onSuccess: (updatedCandidate) => {
      toast.success(`Candidate ${updatedCandidate.tracking_code} successfully matched to your agency.`);
      queryClient.invalidateQueries({ queryKey: ['agencyCandidates'] }); // Refetch candidates for this agency
      queryClient.invalidateQueries({ queryKey: ['adminCandidates'] }); // Also update admin view
    },
    onError: (error) => {
      toast.error(`Failed to match candidate: ${(error as Error).message}`);
    },
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
  
  const handleBatchSelect = (batch: string) => {
    setFilterBatch(batch);
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
  
  if (isAuthLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (userRole !== 'agency' || !foreignAgencyFilter) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-2">
        <div className="flex items-center space-x-3">
            <Building className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold">Staged Candidates for {foreignAgencyFilter}</h1>
        </div>
        <Button onClick={() => refetch()} variant="outline" disabled={isLoading}>
            <Loader2 className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} /> Refresh
        </Button>
      </div>
      <p className="text-muted-foreground">
        View candidates available for matching or already matched to your agency.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Search & Filter Candidates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
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
                  <SelectItem value={ALL_STATUS_FILTER}>All Statuses</SelectItem>
                  {['Pending', 'In Progress', 'Completed', 'Blocked'].map(status => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-full md:w-60">
              <Select
                value={filterBatch}
                onValueChange={handleBatchSelect}
                disabled={isLoadingBatches}
              >
                <SelectTrigger>
                  <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Filter by Batch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_BATCHES_FILTER}>All Batches</SelectItem>
                  {activeBatches.map(batch => (
                    <SelectItem key={batch} value={batch}>
                      {batch}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Candidates ({candidates.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : candidates.length === 0 ? (
            <p className="text-center text-muted-foreground p-8">No candidates found matching your criteria.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
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
                    <TableHead>COC Agency</TableHead>
                    <TableHead>Foreign Agency</TableHead>
                    <SortableHeader 
                      field="progress_percent" 
                      currentSort={sortBy} 
                      currentDirection={sortDirection} 
                      label="Progress" 
                      onSort={handleSort} 
                      className="w-[150px]"
                    />
                    <SortableHeader 
                      field="overall_status" 
                      currentSort={sortBy} 
                      currentDirection={sortDirection} 
                      label="Status" 
                      onSort={handleSort} 
                    />
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {candidates.map((candidate) => {
                    const isMatchedToThisAgency = candidate.foreign_agency === foreignAgencyFilter;
                    const isUnmatched = !candidate.foreign_agency;

                    return (
                      <TableRow key={candidate.id}>
                        <TableCell className="font-medium">
                          <Link 
                            to={`/track/${candidate.tracking_code}`} 
                            className="hover:text-primary hover:underline transition-colors"
                          >
                            {candidate.first_name} {candidate.last_name}
                          </Link>
                        </TableCell>
                        <TableCell>{candidate.tracking_code}</TableCell>
                        <TableCell>{candidate.passport_number}</TableCell>
                        <TableCell>{candidate.coc_agency || 'N/A'}</TableCell>
                        <TableCell>
                          {candidate.foreign_agency ? (
                            <Badge variant="secondary" className="flex items-center space-x-1">
                              <LinkIcon className="h-3 w-3" /> <span>{candidate.foreign_agency}</span>
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">Unassigned</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <ProgressIndicator percent={candidate.progress_percent} className="w-full" />
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[candidate.overall_status]}>
                            {candidate.overall_status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {isUnmatched ? (
                            <Button 
                              variant="default" 
                              size="sm" 
                              onClick={() => matchCandidateMutation.mutate({ candidateId: candidate.id, agencyName: foreignAgencyFilter })}
                              disabled={matchCandidateMutation.isPending}
                            >
                              {matchCandidateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4 mr-2" />}
                              Match
                            </Button>
                          ) : isMatchedToThisAgency ? (
                            <Badge variant="outline" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                              Matched
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              Other Agency
                            </Badge>
                          )}
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

export default AgencyStagedCandidates;