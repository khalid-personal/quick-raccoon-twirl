import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import CandidateCheckpoint from './CandidateCheckpoint';
import { Send, Loader2, MessageSquare, User, Shield, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ChatMessage, CandidateDetail, Document } from '@/lib/types';
import { ChatDocumentPicker, ChatDocumentTags } from './ChatDocumentContext';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';

interface AdminChatViewerProps {
  candidate: CandidateDetail;
}

const ChatBubble: React.FC<{ message: ChatMessage; documents: Document[] }> = ({ message, documents }) => {
    const isAdminOrStaff = message.sender === 'admin' || message.sender === 'staff';
    
    return (
        <div className={cn(
            "flex mb-4",
            isAdminOrStaff ? "justify-end" : "justify-start"
        )}>
            <div className={cn(
                "max-w-[80%] p-3 rounded-lg shadow-md",
                isAdminOrStaff 
                    ? "bg-blue-600 text-white rounded-br-none" 
                    : "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100 rounded-tl-none"
            )}>
                <div className={cn(
                    "text-xs font-semibold mb-1 flex items-center",
                    isAdminOrStaff ? "justify-end" : "justify-start"
                )}>
                    {isAdminOrStaff ? (
                        <>
                            You ({message.sender_name.split('@')[0]}) <Shield className="h-3 w-3 ml-1" />
                        </>
                    ) : (
                        <>
                            <User className="h-3 w-3 mr-1" /> {message.sender_name}
                        </>
                    )}
                </div>
                <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                <ChatDocumentTags message={message} documents={documents} />
                <div className={cn(
                    "text-xs mt-1 flex items-center",
                    isAdminOrStaff ? "justify-end text-blue-100/80" : "justify-start text-gray-500 dark:text-gray-400"
                )}>
                    {format(new Date(message.timestamp), 'MMM d, h:mm a')}
                    
                    {/* Read Receipt for Admin/Staff messages (Candidate read status) */}
                    {isAdminOrStaff && (
                        <span className="ml-1 flex items-center">
                            <CheckCheck 
                                className={cn("h-3 w-3", message.is_read_by_candidate ? "text-green-300" : "text-blue-100/60")} 
                            />
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

const AdminChatViewer: React.FC<AdminChatViewerProps> = ({ candidate }) => {
  const { userRole, user } = useAuth();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [documentIds, setDocumentIds] = useState<string[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const senderName = user?.email || userRole || 'Admin';

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['candidateChatHistory', candidate.id],
    queryFn: () => api.getCandidateChatHistory(candidate.id),
    refetchInterval: 5000, // Poll for new candidate messages
  });
  const { data: documents = [] } = useQuery({ queryKey: ['candidateChatDocuments', candidate.id], queryFn: () => api.getCandidateChatDocuments(candidate.id), refetchInterval: 5000 });
  useEffect(() => { setDocumentIds([]); setMessage(''); }, [candidate.id]);
  
  // Mark candidate messages as read by admin when history loads
  useEffect(() => {
      if (messages.length > 0) {
          // Use a timeout to ensure the messages are rendered before marking as read,
          // and to prevent an infinite loop of fetching/marking/refetching immediately.
          const timeoutId = setTimeout(() => {
              api.markCandidateMessagesRead(candidate.id, 'admin');
              queryClient.invalidateQueries({ queryKey: ['candidateChatHistory', candidate.id] });
              queryClient.invalidateQueries({ queryKey: ['adminInboxSummary'] }); // Update inbox count
          }, 500);
          
          return () => clearTimeout(timeoutId);
      }
  }, [messages.length, candidate.id, queryClient]);

  // Scroll to bottom when messages update
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const mutation = useMutation({
    mutationFn: (input: { text: string; documentIds: string[] }) => api.sendChatMessage(candidate.id, userRole === 'staff' ? 'staff' : 'admin', senderName, input.text, input.documentIds),
    onSuccess: () => {
      toast.success("Reply sent successfully.");
      setMessage('');
      setDocumentIds([]);
      queryClient.invalidateQueries({ queryKey: ['candidateChatHistory', candidate.id] });
      queryClient.invalidateQueries({ queryKey: ['adminInboxSummary'] });
    },
    onError: (error) => {
      toast.error(`Failed to send reply: ${(error as Error).message}`);
    },
  });

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedMessage = message.trim();

    if (!trimmedMessage && !documentIds.length) {
      toast.error("Message cannot be empty.");
      return;
    }
    
    mutation.mutate({ text: trimmedMessage, documentIds });
  };

  return (
    <Card className="flex h-full flex-col overflow-hidden rounded-3xl border-cyan-500/25">
      <CandidateCheckpoint eyebrow="Messages with the candidate" title="Conversation History" description={`Read messages, reply and attach documents. Replying as: ${senderName}.`} icon={MessageSquare} />
      <CardContent className="flex flex-grow flex-col p-5 sm:p-7">
        
        {/* Chat History Area */}
        <div className="flex-grow overflow-y-auto p-3 border rounded-lg bg-gray-50 dark:bg-gray-800 mb-4 max-h-[500px]">
          {isLoading ? (
            <div className="flex justify-center items-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : messages.length === 0 ? (
            <p className="text-center text-muted-foreground pt-10">No conversation history yet.</p>
          ) : (
            messages.map(msg => <ChatBubble key={msg.id} message={msg} documents={documents} />)
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Message Input Form */}
        <form onSubmit={handleSendMessage} className="space-y-3 flex-shrink-0">
          <ChatDocumentPicker documents={documents} selected={documentIds} onChange={setDocumentIds} disabled={mutation.isPending} />
          <Textarea
            placeholder="Type your reply here..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            disabled={mutation.isPending}
          />
          <Button type="submit" className="w-full" disabled={mutation.isPending || (!message.trim() && !documentIds.length)}>
            {mutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Send Reply
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default AdminChatViewer;