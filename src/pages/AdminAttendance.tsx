import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AttendanceRecord } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'; // NEW IMPORT
import { Loader2, Clock, LogIn, LogOut, CalendarDays, User, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { Navigate } from 'react-router-dom';
import { format, isValid } from 'date-fns';
import { Badge } from '@/components/ui/badge';

const AdminAttendance: React.FC = () => {
  const { userRole, user, isLoading: isAuthLoading } = useAuth();
  const queryClient = useQueryClient();
  
  const staffId = user?.id;
  const staffEmail = user?.email;

  // Role check and redirect
  if (isAuthLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (userRole === 'candidate' || !staffId || !staffEmail) {
    toast.error("Access Denied: Only staff and admin users can access attendance.");
    return <Navigate to="/admin" replace />;
  }

  // Fetch current user's attendance history
  const { data: myAttendance = [], isLoading: isLoadingMyAttendance, refetch: refetchMyAttendance } = useQuery<AttendanceRecord[]>({
    queryKey: ['myAttendance', staffId],
    queryFn: () => api.getStaffAttendanceHistory(staffId),
    enabled: !!staffId,
    refetchInterval: 30000, // Refresh every 30 seconds to update current status
  });

  // Determine current check-in status
  const currentCheckIn = myAttendance.find(record => !record.check_out_time);
  const isCheckedIn = !!currentCheckIn;

  const checkInMutation = useMutation({
    mutationFn: () => api.checkIn(staffId!, staffEmail!),
    onSuccess: () => {
      toast.success("Successfully checked in!");
      refetchMyAttendance();
    },
    onError: (error) => {
      toast.error(`Check-in failed: ${(error as Error).message}`);
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: () => api.checkOut(staffId!, staffEmail!),
    onSuccess: () => {
      toast.success("Successfully checked out!");
      refetchMyAttendance();
    },
    onError: (error) => {
      toast.error(`Check-out failed: ${(error as Error).message}`);
    },
  });

  // Admin-specific: Fetch all attendance records
  const { data: allAttendance = [], isLoading: isLoadingAllAttendance } = useQuery<AttendanceRecord[]>({
    queryKey: ['allAttendanceRecords'],
    queryFn: api.getAllAttendanceRecords,
    enabled: userRole === 'admin', // Only fetch for admin
  });

  const formatTime = (isoString?: string) => {
    if (!isoString) return 'N/A';
    const date = new Date(isoString);
    return isValid(date) ? format(date, 'MMM d, yyyy h:mm:ss a') : 'Invalid Date';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3 border-b pb-2">
        <CalendarDays className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">Attendance Management</h1>
      </div>
      <p className="text-muted-foreground">Manage your daily check-in and check-out. Admins can view all staff attendance records.</p>

      <Card>
        <CardHeader>
          <CardTitle>My Attendance</CardTitle>
          <p className="text-sm text-muted-foreground">Logged in as: <span className="font-semibold">{staffEmail}</span></p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-4">
            {isCheckedIn ? (
              <Button 
                onClick={() => checkOutMutation.mutate()} 
                disabled={checkOutMutation.isPending}
                variant="destructive"
              >
                {checkOutMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <LogOut className="h-4 w-4 mr-2" />}
                Check Out
              </Button>
            ) : (
              <Button 
                onClick={() => checkInMutation.mutate()} 
                disabled={checkInMutation.isPending}
              >
                {checkInMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <LogIn className="h-4 w-4 mr-2" />}
                Check In
              </Button>
            )}
            {isCheckedIn && (
              <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                Currently Checked In since {formatTime(currentCheckIn?.check_in_time)}
              </Badge>
            )}
          </div>

          <h3 className="text-lg font-semibold mt-6 border-t pt-4">My Attendance History</h3>
          {isLoadingMyAttendance ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : myAttendance.length === 0 ? (
            <p className="text-center text-muted-foreground p-4">No attendance records found.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Check-in Time</TableHead>
                    <TableHead>Check-out Time</TableHead>
                    <TableHead>Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myAttendance.map((record) => {
                    const checkInDate = new Date(record.check_in_time);
                    const checkOutDate = record.check_out_time ? new Date(record.check_out_time) : null;
                    let duration = 'N/A';
                    if (checkOutDate && isValid(checkInDate) && isValid(checkOutDate)) {
                      const diffMs = checkOutDate.getTime() - checkInDate.getTime();
                      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                      const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                      duration = `${diffHours}h ${diffMinutes}m`;
                    }

                    return (
                      <TableRow key={record.id}>
                        <TableCell>{formatTime(record.check_in_time)}</TableCell>
                        <TableCell>{formatTime(record.check_out_time)}</TableCell>
                        <TableCell>{duration}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {userRole === 'admin' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
                <Users className="h-5 w-5 mr-2" /> All Staff Attendance Records
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingAllAttendance ? (
              <div className="flex justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : allAttendance.length === 0 ? (
              <p className="text-center text-muted-foreground p-4">No staff attendance records found.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff Email</TableHead>
                      <TableHead>Check-in Time</TableHead>
                      <TableHead>Check-out Time</TableHead>
                      <TableHead>Duration</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allAttendance.map((record) => {
                      const checkInDate = new Date(record.check_in_time);
                      const checkOutDate = record.check_out_time ? new Date(record.check_out_time) : null;
                      let duration = 'N/A';
                      if (checkOutDate && isValid(checkInDate) && isValid(checkOutDate)) {
                        const diffMs = checkOutDate.getTime() - checkInDate.getTime();
                        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                        const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                        duration = `${diffHours}h ${diffMinutes}m`;
                      }

                      return (
                        <TableRow key={record.id}>
                          <TableCell className="font-medium">{record.staff_email}</TableCell>
                          <TableCell>{formatTime(record.check_in_time)}</TableCell>
                          <TableCell>{formatTime(record.check_out_time)}</TableCell>
                          <TableCell>{duration}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminAttendance;