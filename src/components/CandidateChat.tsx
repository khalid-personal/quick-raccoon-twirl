import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Send, Loader2, MessageSquare, User, Shield, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ChatMessage } from '@/lib/types';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface CandidateChatProps {
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
}

const ChatBubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
    const isCandidate = message.sender === 'candidate';
    
    return (
        <div className={cn(
            "flex mb-4",
            isCandidate ? "justify-end" : "justify-start"
        )}>
            <div className={cn(
                "max-w-[80%] p-3 rounded-lg shadow-md",
                isCandidate 
                    ? "bg-primary text-primary-foreground rounded-br-none" 
                    : "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100 rounded-tl-none"
            )}>
                <div className={cn(
                    "text-xs font-semibold mb-1 flex items-center",
                    isCandidate ? "justify-end" : "justify-start"
                )}>
                    {isCandidate ? (
                        <>
                            You <User className="h-3 w-3 ml-1" />
                        </>
                    ) : (
                        <>
                            <Shield className="h-3 w-3 mr-1" /> Admin Team
                        </>
                    )}
                </div>
                <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                <div className={cn(
                    "text-xs mt-1 flex items-center",
                    isCandidate ? "justify-end text-primary-foreground/80" : "justify-start text-gray-500 dark:text-gray-400"
                )}>
                    {format(new Date(message.timestamp), 'h:mm a')}
                    
                    {/* Read Receipt for Candidate's messages (Admin read status) */}
                    {isCandidate && (
                        <span className="ml-1 flex items-center">
                            <CheckCheck 
                                className={cn("h-3 w-3", message.is_read_by_admin ? "text-green-300" : "text-primary-foreground/60")} 
                                title={message.is_read_by_admin ? "Read by Admin" : "Delivered"}
                            />
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

const CandidateChat: React.FC<CandidateChatProps> = ({ candidateId, candidateName, candidateEmail }) => {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['candidateChatHistory', candidateId],
    queryFn: () => api.getCandidateChatHistory(candidateId),
    refetchInterval: 5000, // Poll for new admin messages
  });
  
  // Mark admin messages as read by candidate when history loads
  useEffect(() => {
      if (messages.length > 0) {
          // Use a timeout to ensure the messages are rendered before marking as read,
          // and to prevent an infinite loop of fetching/marking/refetching immediately.
          const timeoutId = setTimeout(() => {
              api.markCandidateMessagesRead(candidateId, 'candidate');
              // Invalidate to update the read receipts on the screen
              queryClient.invalidateQueries({ queryKey: ['candidateChatHistory', candidateId] });
          }, 500); 
          
          return () => clearTimeout(timeoutId);
      }
  }, [messages.length, candidateId, queryClient]);

  // Scroll to bottom when messages update
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const mutation = useMutation({
    mutationFn: (msg: string) => api.sendChatMessage(candidateId, 'candidate', candidateName, msg),
    onSuccess: () => {
      toast.success("Message sent successfully.");
      setMessage('');
      queryClient.invalidateQueries({ queryKey: ['candidateChatHistory', candidateId] });
    },
    onError: (error) => {
      toast.error(`Failed to send message: ${(error as Error).message}`);
    },
  });

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedMessage = message.trim();

    if (!trimmedMessage) {
      toast.error("Message cannot be empty.");
      return;
    }
    
    mutation.mutate(trimmedMessage);
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center text-xl">
          <MessageSquare className="h-5 w-5 mr-2 text-primary" />
          Secure Chat with Admin Team
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col flex-grow p-4 pt-0">
        
        {/* Chat History Area */}
        <div className="flex-grow overflow-y-auto p-3 border rounded-lg bg-gray-50 dark:bg-gray-800 mb-4 max-h-[400px]">
          {isLoading ? (
            <div className="flex justify-center items-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : messages.length === 0 ? (
            <p className="text-center text-muted-foreground pt-10">Start a conversation with the Admin team.</p>
          ) : (
            messages.map(msg => <ChatBubble key={msg.id} message={msg} />)
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Message Input Form */}
        <form onSubmit={handleSendMessage} className="space-y-3 flex-shrink-0">
          <Textarea
            placeholder="Type your question or concern here..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            disabled={mutation.isPending}
          />
          <Button type="submit" className="w-full" disabled={mutation.isPending || !message.trim()}>
            {mutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Send Message
          </Button>
        </form>
        <p className="text-xs text-muted-foreground mt-3 text-center">
          Your email ({candidateEmail}) is used for identification.
        </p>
      </CardContent>
    </Card>
  );
};

export default CandidateChat;