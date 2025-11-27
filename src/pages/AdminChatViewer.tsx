import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, Loader2, User } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Navigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

// Mock data structure for chat messages
interface ChatMessage {
    id: string;
    trackingCode: string;
    candidateName: string;
    message: string;
    timestamp: string;
    isRead: boolean;
}

// Mock API call to fetch messages
const useMockChatMessages = () => {
    // This hook simulates fetching persistent chat data.
    // In a real app, this would be a useQuery call.
    const mockMessages: ChatMessage[] = [
        {
            id: 'msg1',
            trackingCode: 'TRK-ET-0001',
            candidateName: 'Aster Bekele',
            message: "I paid the initial medical fee yesterday, but the status hasn't updated yet. Can you check?",
            timestamp: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
            isRead: false,
        },
        {
            id: 'msg2',
            trackingCode: 'TRK-DJ-0003',
            candidateName: 'Fatima Ali',
            message: "When is the next CoC training session scheduled? I need to book my travel.",
            timestamp: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
            isRead: true,
        },
        {
            id: 'msg3',
            trackingCode: 'TRK-ET-0002',
            candidateName: 'Mariam Tesfaye',
            message: "My passport is expiring next month. Should I renew it now or wait for the visa stage?",
            timestamp: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
            isRead: true,
        },
    ];
    
    return { data: mockMessages, isLoading: false };
};

const AdminChatViewer: React.FC = () => {
  const { userRole, isLoading: isAuthLoading } = useAuth();
  const { data: messages, isLoading } = useMockChatMessages();
  
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
        <h1 className="text-3xl font-bold">Candidate Messages ({messages.filter(m => !m.isRead).length} Unread)</h1>
      </div>
      <p className="text-muted-foreground">View and manage urgent inquiries sent by candidates via the public tracking portal.</p>

      <Card>
        <CardHeader>
          <CardTitle>Inbox</CardTitle>
        </CardHeader>
        <CardContent>
          {messages.length === 0 ? (
            <p className="text-center text-muted-foreground p-8">No new messages.</p>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => (
                <div 
                  key={msg.id} 
                  className={`p-4 border rounded-lg transition-all ${!msg.isRead ? 'bg-blue-50 dark:bg-blue-950 border-blue-300' : 'bg-white dark:bg-gray-900 border-gray-200'}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-lg">{msg.candidateName}</span>
                      <Badge variant="secondary" className="text-xs font-mono">{msg.trackingCode}</Badge>
                      {!msg.isRead && <Badge className="bg-red-500 hover:bg-red-600 text-white">New</Badge>}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(msg.timestamp), 'MMM d, h:mm a')}
                    </span>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{msg.message}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminChatViewer;