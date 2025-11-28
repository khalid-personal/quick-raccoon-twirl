import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Clock, LogIn, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useAddisAbabaTime } from '@/hooks/use-addis-ababa-time';

const StaffAttendanceWidget: React.FC = () => {
  const { user, userRole } = useAuth();
  const queryClient = useQueryClient();
  const addisAbabaTime = useAddisAbabaTime();
  
  const staffId = user?.id;
  const staffEmail = user?.email;
  
  const isStaff = userRole === 'admin' || userRole === 'staff';

  const { data: currentStatus, isLoading } = useQuery({
    queryKey: ['staffAttendanceStatus', staffId],
    queryFn: () => api.getStaffAttendanceStatus(staffId!),
    enabled: isStaff && !!staffId,
    refetchInterval: 60000, // Check status every minute
  });
  
  const isCheckedIn = !!currentStatus;
  const currentRecordId = currentStatus?.id;

  const checkInMutation = useMutation({
    mutationFn: () => api.checkInStaff(staffId!, staffEmail!),
    onSuccess: () => {
      toast.success("Checked In successfully. Welcome!");
      queryClient.invalidateQueries({ queryKey: ['staffAttendanceStatus', staffId] });
      queryClient.invalidateQueries({ queryKey: ['staffAttendanceHistory', staffId] });
    },
    onError: (error) => {
      toast.error(`Check-in failed: ${(error as Error).message}`);
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: () => api.checkOutStaff(currentRecordId!),
    onSuccess: () => {
      toast.success("Checked Out successfully. Have a good rest!");
      queryClient.invalidateQueries({ queryKey: ['staffAttendanceStatus', staffId] });
      queryClient.invalidateQueries({ queryKey: ['staffAttendanceHistory', staffId] });
    },
    onError: (error) => {
      toast.error(`Check-out failed: ${(error as Error).message}`);
    },
  });
  
  if (!isStaff) return null;

  const isMutating = checkInMutation.isPending || checkOutMutation.isPending;

  return (
    <Card className="w-full">
      <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center">
          <Clock className="h-5 w-5 mr-2 text-primary" />
          Attendance
        </CardTitle>
        <span className="text-xs text-muted-foreground">{addisAbabaTime}</span>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        {isLoading ? (
          <div className="flex justify-center items-center h-10">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : isCheckedIn ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-green-600 dark:text-green-400 flex items-center">
              <LogIn className="h-4 w-4 mr-2" />
              You are currently checked in.
            </p>
            <p className="text-xs text-muted-foreground">
              Since: {format(new Date(currentStatus.check_in_time), 'MMM d, h:mm a')}
            </p>
            <Button 
              onClick={() => checkOutMutation.mutate()} 
              disabled={isMutating}
              variant="destructive"
              className="w-full"
            >
              {isMutating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <LogOut className="h-4 w-4 mr-2" />}
              Check Out
            </Button>
          </div>
        ) : (
          <Button 
            onClick={() => checkInMutation.mutate()} 
            disabled={isMutating}
            className="w-full"
          >
            {isMutating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <LogIn className="h-4 w-4 mr-2" />}
            Check In Now
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default StaffAttendanceWidget;