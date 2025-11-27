import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { CandidateSummary, CandidateSortField, SortDirection } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, PlusCircle, Loader2, Filter, ArrowUp, ArrowDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import NewCandidateForm from '@/components/NewCandidateForm';
import ProgressIndicator from '@/components/ProgressIndicator';
import DashboardSummaryCards from '@/components/DashboardSummaryCards';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/lib/auth';
import PipelineProgressChart from '@/components/PipelineProgressChart';
import { cn } from '@/lib/utils';

const statusColors: Record<CandidateSummary['overall_status'], string> = {
  'Completed': 'bg-green-500 hover:bg-green-600 text-white',
  'In Progress': 'bg-blue-500 hover:bg-blue-600 text-white',
  'Blocked': 'bg-red-500 hover:bg-red-600 text-white',
  'Pending': 'bg-yellow-500 hover:bg-yellow-600 text-white',
};

const ALL_BATCHES_FILTER = 'ALL_BATCHES_FILTER'; // Non-empty string constant for 'All Batches'

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

const AdminDashboard: React.FC = () => {
  const { userRole } = useAuth();
  const isSuperAdmin = userRole === 'admin';
  
  const [searchQuery, setSearchQuery] = useState('');
  const [currentQuery, setCurrentQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<CandidateSummary['overall_status'] | ''>('');
  const [filterBatch, setFilterBatch] = useState<string>(ALL_BATCHES_FILTER);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Sorting state
  const [sortBy, setSortBy] = useState<CandidateSortField>('tracking_code');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const effectiveFilterBatch = filterBatch === ALL_BATCHES_FILTER ? undefined : filterBatch;

  const { data: candidates, isLoading, refetch } = useQuery<CandidateSummary[]>({
    queryKey: ['adminCandidates', currentQuery, filterStatus, effectiveFilterBatch, sortBy, sortDirection],
    queryFn: () => api.searchCandidates(
      currentQuery, 
      filterStatus || undefined, 
      effectiveFilterBatch,
      sortBy,
      sortDirection
    ),
    initialData: [],
  });
  
  const { data: activeBatches = [], isLoading: isLoadingBatches } = useQuery<string[]>({
    queryKey: ['activeBatches'],
    queryFn: api.getBatches,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentQuery(searchQuery);
  };
  
  const handleCandidateCreated = () => {
      refetch();
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b pb-4 mb-4">
        <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">
          Candidate Pipeline
        </h1>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="h-4 w-4 mr-2" /> Add New Candidate
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Create New Candidate Record</DialogTitle>
            </DialogHeader>
            <NewCandidateForm 
              onSuccess={handleCandidateCreated} 
              onClose={() => setIsDialogOpen(false)} 
            />
          </DialogContent>
        </Dialog>
      </div>
      
      {/* Superadmin Pipeline Chart */}
      {isSuperAdmin && (
        <PipelineProgressChart />
      )}
      
      <DashboardSummaryCards onStatusSelect={handleStatusSelect} selectedStatus={filterStatus} />

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
          <CardTitle>Results ({candidates.length}) {filterStatus && `(Status: ${filterStatus})`} {effectiveFilterBatch && `(Batch: ${effectiveFilterBatch})`}</CardTitle>
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
                    <TableHead>Batch</TableHead>
                    <TableHead>Passport</TableHead>
                    <SortableHeader 
                      field="country_of_origin" 
                      currentSort={sortBy} 
                      currentDirection={sortDirection} 
                      label="Origin" 
                      onSort={handleSort} 
                    />
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
                    <SortableHeader 
                      field="marital_status" 
                      currentSort={sortBy} 
                      currentDirection={sortDirection} 
                      label="Marital Status" 
                      onSort={handleSort} 
                    />
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {candidates.map((candidate) => (
                    <TableRow key={candidate.id}>
                      <TableCell className="font-medium">{candidate.first_name} {candidate.last_name}</TableCell>
                      <TableCell>{candidate.tracking_code}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {candidate.batch_name || 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell>{candidate.passport_number}</TableCell>
                      <TableCell>{candidate.country_of_origin}</TableCell>
                      <TableCell>
                        <ProgressIndicator percent={candidate.progress_percent} className="w-full" />
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[candidate.overall_status]}>
                          {candidate.overall_status}
                        </Badge>
                      </TableCell>
                      <TableCell>{candidate.marital_status}</TableCell>
                      <TableCell className="text-right">
                        <Link to={`/admin/candidate/${candidate.id}`}>
                          <Button variant="outline" size="sm">View/Edit</Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;