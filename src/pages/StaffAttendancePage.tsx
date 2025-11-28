import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AttendanceRecord } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Clock, CalendarCheck, LogIn, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Navigate } from 'react-router-dom';
import { format, differenceInHours, differenceInMinutes } from 'date-fns';
import StaffAttendanceWidget from '@/components/StaffAttendanceWidget';

const calculateDuration = (checkIn: string, checkOut?: string): string => {
    if (!checkOut) return 'In Progress';
    
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    
    const totalMinutes = differenceInMinutes(end, start);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    return `${hours}h ${minutes}m`;
};

const StaffAttendancePage: React.FC = () => {
  const { user, userRole, isLoading: isAuthLoading } = useAuth();
  
  const staffId = user?.id;
  const isStaff = userRole === 'admin' || userRole === 'staff';

  // Role check and redirect
  if (isAuthLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!isStaff) {
    return <Navigate to="/admin" replace />;
  }
  
  const { data: history = [], isLoading } = useQuery<AttendanceRecord[]>({
    queryKey: ['staffAttendanceHistory', staffId],
    queryFn: () => api.getStaffAttendanceHistory(staffId!),
    enabled: !!staffId,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3 border-b pb-2">
        <CalendarCheck className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">My Attendance</h1>
      </div>
      <p className="text-muted-foreground">Track your daily check-in and check-out times.</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
            <StaffAttendanceWidget />
        </div>
        
        <Card className="lg:col-span-2">
            <CardHeader>
                <CardTitle>Attendance History ({history.length})</CardTitle>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex justify-center p-8">
                        <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                ) : history.length === 0 ? (
                    <p className="text-center text-muted-foreground p-8">No attendance records found.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[150px]">Date</TableHead>
                                    <TableHead>Check In</TableHead>
                                    <TableHead>Check Out</TableHead>
                                    <TableHead className="text-right">Duration</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {history.map((record) => (
                                    <TableRow key={record.id}>
                                        <TableCell className="font-medium">
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
                                                <span className="text-yellow-600 font-semibold">N/A</span>
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
    </div>
  );
};

export default StaffAttendancePage;