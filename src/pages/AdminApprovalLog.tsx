import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ApprovalLog } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ScrollText, CheckCircle, XCircle, RefreshCw, UserCog, Settings, FileText } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Navigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const getActionIcon = (action: ApprovalLog['action']) => {
    switch (action) {
        case 'Approved':
            return <CheckCircle className="h-4 w-4 text-green-600" />;
        case 'Rejected':
            return <XCircle className="h-4 w-4 text-red-600" />;
        case 'Updated':
            return <RefreshCw className="h-4 w-4 text-blue-600" />;
        case 'Created':
            return <FileText className="h-4 w-4 text-blue-600" />;
        default:
            return <ScrollText className="h-4 w-4 text-gray-600" />;
    }
};

const getTargetIcon = (targetType: ApprovalLog['target_type']) => {
    switch (targetType) {
        case 'StaffUser':
            return <UserCog className="h-4 w-4 text-purple-600" />;
        case 'Config':
            return <Settings className="h-4 w-4 text-yellow-600" />;
        default:
            return <ScrollText className="h-4 w-4 text-gray-600" />;
    }
};

const AdminApprovalLog: React.FC = () => {
  const { userRole, isLoading: isAuthLoading } = useAuth();
  
  // Role check and redirect
  if (isAuthLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (userRole !== 'admin') {
    // Only Superadmin can view system logs
    return <Navigate to="/admin" replace />;
  }
  
  const { data: logs = [], isLoading, refetch } = useQuery<ApprovalLog[]>({
    queryKey: ['approvalLogs'],
    queryFn: api.getApprovalLogsHistory,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-2">
        <div className="flex items-center space-x-3">
            <ScrollText className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">System Approval & Change Log</h1>
        </div>
        <Button onClick={() => refetch()} variant="outline" disabled={isLoading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} /> Refresh
        </Button>
      </div>
      <p className="text-muted-foreground">A chronological record of critical system actions, including staff user approvals and configuration changes.</p>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity ({logs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <p className="text-center text-muted-foreground p-8">No system logs found.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Timestamp</TableHead>
                    <TableHead className="w-[150px]">Action</TableHead>
                    <TableHead className="w-[150px]">Target Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-[180px]">Actor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(log.timestamp), 'MMM d, yyyy HH:mm')}
                      </TableCell>
                      <TableCell>
                        <Badge 
                            className={cn(
                                "flex items-center justify-center space-x-1 font-semibold",
                                log.action === 'Approved' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                log.action === 'Rejected' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                                log.action === 'Created' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                                'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                            )}
                        >
                            {getActionIcon(log.action)}
                            <span>{log.action}</span>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="flex items-center space-x-1">
                            {getTargetIcon(log.target_type)}
                            <span>{log.target_type}</span>
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm max-w-xs">{log.description}</TableCell>
                      <TableCell className="text-sm font-medium">
                        {log.actor_email.split('@')[0]}
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

export default AdminApprovalLog;