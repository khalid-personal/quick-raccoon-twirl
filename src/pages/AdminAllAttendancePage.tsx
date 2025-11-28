import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AttendanceRecord } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, CalendarCheck, LogIn, LogOut, RefreshCw } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Navigate } from 'react-router-dom';
import { format, differenceInHours, differenceInMinutes } from 'date-fns';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const calculateDuration = (checkIn: string, checkOut?: string): string => {
    if (!checkOut) return 'In Progress';
    
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    
    const totalMinutes = differenceInMinutes(end, start);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    return `${hours}h ${minutes}m`;
};

const AdminAllAttendancePage: React.FC = () => {
  const { user, userRole, isLoading: isAuthLoading } = useAuth();
  
  // Role check and redirect
  if (isAuthLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  // Only the specific Superadmin (admin@agency.com) can view all attendance history
  if (userRole !== 'admin' || user?.email !== 'admin@agency.com') {
    return <Navigate to="/admin" replace />;
  }
  
  const { data: allHistory = [], isLoading, refetch } = useQuery<AttendanceRecord[]>({
    queryKey: ['allAttendanceHistory'],
    queryFn: api.getAllAttendanceHistory,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-2">
        <div className="flex items-center space-x-3">
            <CalendarCheck className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">All Staff Attendance History</h1>
        </div>
        <Button onClick={() => refetch()} variant="outline" disabled={isLoading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} /> Refresh
        </Button>
      </div>
      <p className="text-muted-foreground">Overview of check-in and check-out times for all registered staff members.</p>

      <Card>
        <CardHeader>
          <CardTitle>Attendance Records ({allHistory.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : allHistory.length === 0 ? (
            <p className="text-center text-muted-foreground p-8">No attendance records found.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Staff Email</TableHead>
                    <TableHead className="w-[150px]">Date</TableHead>
                    <TableHead>Check In</TableHead>
                    <TableHead>Check Out</TableHead>
                    <TableHead className="text-right">Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allHistory.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{record.staff_email}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(record.check_in_time), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="flex items-center">
                        <LogIn className="h-4 w-4 mr-2 text-green-600" />
                        {format(new Date(record.check_in_time), 'h:mm:ss a')}
                      </TableCell>
                      <TableCell>
                        {record.check_out_time ? (
                            <span className="flex items-center">
                                <LogOut className="h-4 w-4 mr-2 text-red-600" />
                                {format(new Date(record.check_out_time), 'h:mm:ss a')}
                            </span>
                        ) : (
                            <span className="text-yellow-600 font-semibold">In Progress</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {calculateDuration(record.check_in_time, record.check_out_time)}
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

export default AdminAllAttendancePage;