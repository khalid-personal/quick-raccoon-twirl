import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Send, Loader2, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

interface CandidateChatProps {
  trackingCode: string;
}

const CandidateChat: React.FC<CandidateChatProps> = ({ trackingCode }) => {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedMessage = message.trim();

    if (!trimmedMessage) {
      toast.error("Message cannot be empty.");
      return;
    }

    setIsSending(true);
    
    // --- MOCK API CALL ---
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    console.log(`[CANDIDATE CHAT] Message from ${trackingCode}: ${trimmedMessage}`);
    // --- END MOCK API CALL ---

    toast.success("Message sent to the Admin team successfully. They will respond shortly.");
    setMessage('');
    setIsSending(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center text-xl">
          <MessageSquare className="h-5 w-5 mr-2 text-primary" />
          Contact Admin Team
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSendMessage} className="space-y-4">
          <Textarea
            placeholder="Type your question or concern here..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            disabled={isSending}
          />
          <Button type="submit" className="w-full" disabled={isSending || !message.trim()}>
            {isSending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Send Message
          </Button>
        </form>
        <p className="text-xs text-muted-foreground mt-3 text-center">
          This is a one-way communication channel for urgent inquiries.
        </p>
      </CardContent>
    </Card>
  );
};

export default CandidateChat;