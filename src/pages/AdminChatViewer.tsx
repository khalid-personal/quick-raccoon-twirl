import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, Loader2, User, ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Navigate, Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const AdminChatViewer: React.FC = () => {
  const { userRole, isLoading: isAuthLoading } = useAuth();
  
  const { data: inboxSummary = [], isLoading } = useQuery({
    queryKey: ['adminInboxSummary'],
    queryFn: api.getAdminInboxSummary,
    refetchInterval: 10000, // Poll for new messages
  });
  
  // Role check and redirect
  if (isAuthLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (userRole !== 'admin' && userRole !== 'staff') {
    return <Navigate to="/admin" replace />;
  }
  
  const unreadCount = inboxSummary.filter(m => m.sender === 'candidate' && !m.is_read_by_admin).length;

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3 border-b pb-2">
        <MessageSquare className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">Candidate Inbox ({unreadCount} Unread)</h1>
      </div>
      <p className="text-muted-foreground">View the latest message from each candidate. Click to view the full conversation and reply.</p>

      <Card>
        <CardHeader>
          <CardTitle>Conversations</CardTitle>
        </CardHeader>
        <CardContent>
          {inboxSummary.length === 0 ? (
            <p className="text-center text-muted-foreground p-8">No messages found.</p>
          ) : (
            <div className="space-y-2">
              {inboxSummary.map((msg) => {
                const isUnread = msg.sender === 'candidate' && !msg.is_read_by_admin;
                const candidateName = msg.sender === 'candidate' ? msg.sender_name : msg.sender_name.split('@')[0];
                
                return (
                  <Link 
                    key={msg.candidate_id} 
                    to={`/admin/candidate/${msg.candidate_id}?tab=chat`}
                    className={cn(
                      "flex items-center justify-between p-4 border rounded-lg transition-all hover:shadow-md",
                      isUnread ? 'bg-blue-50 dark:bg-blue-950 border-blue-300' : 'bg-white dark:bg-gray-900 border-gray-200'
                    )}
                  >
                    <div className="flex items-center space-x-4 min-w-0 flex-grow">
                      <User className="h-5 w-5 text-primary flex-shrink-0" />
                      <div className="min-w-0 flex-grow">
                        <div className="flex items-center space-x-2">
                            <span className="font-semibold text-lg truncate">{candidateName}</span>
                            <Badge variant="secondary" className="text-xs font-mono flex-shrink-0">{msg.trackingCode || 'N/A'}</Badge>
                            {isUnread && <Badge className="bg-red-500 hover:bg-red-600 text-white flex-shrink-0">New</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground truncate mt-1">
                            {msg.sender === 'candidate' ? 'Candidate: ' : 'Admin: '}
                            {msg.message}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3 flex-shrink-0 ml-4">
                        <span className="text-xs text-muted-foreground">
                            {format(new Date(msg.timestamp), 'MMM d, h:mm a')}
                        </span>
                        <ArrowRight className="h-4 w-4 text-gray-500" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminChatViewer;