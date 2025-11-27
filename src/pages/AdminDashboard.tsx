import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Candidate } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, PlusCircle, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

const AdminDashboard: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentQuery, setCurrentQuery] = useState('');

  const { data: candidates, isLoading, refetch } = useQuery({
    queryKey: ['adminCandidates', currentQuery],
    queryFn: () => api.searchCandidates(currentQuery),
    initialData: [],
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentQuery(searchQuery);
  };
  
  // Mock function for creating a new candidate (Admin requirement)
  const handleCreateCandidate = async () => {
      try {
          const newCandidate = await api.createCandidate({
              first_name: 'New',
              last_name: 'Candidate',
              tracking_code: `TRK-NEW-${Math.floor(Math.random() * 1000)}`,
              country_of_origin: 'Kenya',
              passport_number: `P${Math.floor(Math.random() * 1000000)}`,
              is_minor: false,
          });
          toast.success(`Candidate ${newCandidate.tracking_code} created successfully.`);
          refetch();
      } catch (error) {
          toast.error((error as Error).message);
      }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Candidate Management</h1>
        <Button onClick={handleCreateCandidate}>
          <PlusCircle className="h-4 w-4 mr-2" /> Add New Candidate (Mock)
        </Button>
      </div>

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
          <CardTitle>Results ({candidates.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : candidates.length === 0 ? (
            <p className="text-center text-muted-foreground p-8">No candidates found matching your query.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Tracking Code</TableHead>
                    <TableHead>Passport</TableHead>
                    <TableHead>Origin</TableHead>
                    <TableHead>Minor</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {candidates.map((candidate) => (
                    <TableRow key={candidate.id}>
                      <TableCell className="font-medium">{candidate.first_name} {candidate.last_name}</TableCell>
                      <TableCell>{candidate.tracking_code}</TableCell>
                      <TableCell>{candidate.passport_number || 'N/A'}</TableCell>
                      <TableCell>{candidate.country_of_origin}</TableCell>
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