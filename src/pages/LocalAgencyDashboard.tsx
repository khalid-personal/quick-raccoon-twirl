"use client";

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Navigate, Link } from 'react-router-dom';
import { Loader2, Building, LogOut, Search, Filter, ArrowUp, ArrowDown, CheckCircle, Landmark } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { CandidateSummary, CandidateSortField, SortDirection, ALL_STAGES } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import ProgressIndicator from '@/components/ProgressIndicator';
import { cn } from '@/lib/utils';

const statusColors: Record<CandidateSummary['overall_status'], string> = {
  'Completed': 'bg-green-500 hover:bg-green-600 text-white',
  'In Progress': 'bg-blue-500 hover:bg-blue-600 text-white',
  'Blocked': 'bg-red-500 hover:bg-red-600 text-white',
  'Pending': 'bg-yellow-500 hover:bg-yellow-600 text-white',
};

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

const LocalAgencyDashboard: React.FC = () => {
  console.log("LocalAgencyDashboard rendered!"); // Debug log
  const { userRole, user, isLoading: isAuthLoading, logout, userCocAgency } = useAuth();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [currentQuery, setCurrentQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<CandidateSummary['overall_status'] | ''>('');
  
  // Sorting state
  const [sortBy, setSortBy] = useState<CandidateSortField>('tracking_code');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  console.log("LocalAgencyDashboard: userCocAgency from useAuth:", userCocAgency); // NEW DEBUG LOG

  const { data: candidates = [], isLoading, refetch } = useQuery<CandidateSummary[]>({
    queryKey: ['localAgencyCandidates', currentQuery, filterStatus, userCocAgency, sortBy, sortDirection],
    queryFn: () => api.searchCandidates(
      currentQuery, 
      filterStatus || undefined, 
      undefined, // No batch filter for local agency dashboard
      sortBy,
      sortDirection,
      'All', // No time filter for local agency dashboard
      undefined, // No foreign agency filter here
      userCocAgency // Filter by the logged-in COC agency
    ),
    enabled: !!userCocAgency, // Only fetch if COC agency is known
    initialData: [],
  });

  console.log("LocalAgencyDashboard candidates:", candidates); // Debug log
  
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

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (userRole !== 'local-agency' || !userCocAgency) {
    return <Navigate to="/login" replace />;
  }
  
  const agencyEmail = user?.email || 'Local Agency';
  const agencyName = userCocAgency; // Use the actual COC agency name

  return (
    <div className="min-h-screen container mx-auto py-12 space-y-8">
      <Card className="border-green-500 shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-3xl flex items-center text-green-600 dark:text-green-400">
            <Landmark className="h-7 w-7 mr-3" />
            {agencyName} Portal Dashboard
          </CardTitle>
          <Button onClick={logout} variant="destructive">
            <LogOut className="h-4 w-4 mr-2" /> Logout
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-lg text-muted-foreground">
            Welcome, {agencyEmail}. This is your dashboard for candidates associated with {agencyName}.
          </p>
          
          <Card>
            <CardHeader>
              <CardTitle>Staged Candidates ({candidates.length})</CardTitle>
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
                <div className="text-center p-8 bg-yellow-50 dark:bg-yellow-950 border-l-4 border-yellow-500 text-yellow-800 dark:text-yellow-200 rounded-md">
                  <p className="font-bold text-lg mb-2">No candidates found!</p>
                  <p className="text-sm">There are no candidates matching your criteria or associated with your agency ({agencyName}).</p>
                </div>
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
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {candidates.map((candidate) => (
                        <TableRow key={candidate.id}>
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
                          <TableCell>
                            <ProgressIndicator percent={candidate.progress_percent} className="w-full" />
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
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
};

export default LocalAgencyDashboard;