import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { CandidateSummary } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, PlusCircle, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import NewCandidateForm from '@/components/NewCandidateForm';
import ProgressIndicator from '@/components/ProgressIndicator';
import DashboardSummaryCards from '@/components/DashboardSummaryCards';
import { Badge } from '@/components/ui/badge';

const statusColors: Record<CandidateSummary['overall_status'], string> = {
  'Completed': 'bg-green-500 hover:bg-green-600 text-white',
  'In Progress': 'bg-blue-500 hover:bg-blue-600 text-white',
  'Blocked': 'bg-red-500 hover:bg-red-600 text-white',
  'Pending': 'bg-yellow-500 hover:bg-yellow-600 text-white',
};

const AdminDashboard: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentQuery, setCurrentQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<CandidateSummary['overall_status'] | ''>('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: candidates, isLoading, refetch } = useQuery<CandidateSummary[]>({
    queryKey: ['adminCandidates', currentQuery, filterStatus],
    queryFn: () => api.searchCandidates(currentQuery, filterStatus || undefined),
    initialData: [],
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
    setCurrentQuery(''); // Clear search query when filtering by status
    setSearchQuery('');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Candidate Management</h1>
        
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
      
      <DashboardSummaryCards onStatusSelect={handleStatusSelect} selectedStatus={filterStatus} />

      <Card>
        <CardHeader>
          <CardTitle>Search Candidates</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex space-x-2">
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Results ({candidates.length}) {filterStatus && `(Filtered by ${filterStatus})`}</CardTitle>
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
                    <TableHead>Name</TableHead>
                    <TableHead>Tracking Code</TableHead>
                    <TableHead>Passport</TableHead>
                    <TableHead>Origin</TableHead>
                    <TableHead className="w-[150px]">Progress</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Minor</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {candidates.map((candidate) => (
                    <TableRow key={candidate.id}>
                      <TableCell className="font-medium">{candidate.first_name} {candidate.last_name}</TableCell>
                      <TableCell>{candidate.tracking_code}</TableCell>
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
                      <TableCell>{candidate.is_minor ? 'Yes' : 'No'}</TableCell>
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