import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import CandidateCheckpoint from './CandidateCheckpoint';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Send, Loader2, MessageSquare, Phone, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { CandidateDetail } from '@/lib/types';
import { Label } from '@/components/ui/label';

interface NotificationSenderProps {
  candidate: CandidateDetail;
}

const NotificationSender: React.FC<NotificationSenderProps> = ({ candidate }) => {
  const [message, setMessage] = useState('');
  const [channel, setChannel] = useState<'sms' | 'whatsapp'>('sms');
  const [isSending, setIsSending] = useState(false);
  
  const recipient = candidate.phone_number || candidate.email;

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedMessage = message.trim();

    if (!trimmedMessage) {
      toast.error("Message cannot be empty.");
      return;
    }
    
    if (!recipient) {
        toast.error("Cannot send notification: Candidate is missing a phone number or email.");
        return;
    }

    setIsSending(true);
    
    try {
        // Mock API call to send notification
        await api.sendNotification(channel, recipient, trimmedMessage);
        
        toast.success(`Notification sent successfully via ${channel.toUpperCase()} to ${recipient}.`);
        setMessage('');
    } catch (error) {
        toast.error(`Failed to send notification: ${(error as Error).message}`);
    } finally {
        setIsSending(false);
    }
  };

  return (
    <Card className="overflow-hidden rounded-3xl border-cyan-500/25">
      <CandidateCheckpoint eyebrow="Contact the candidate" title="Send a notification" description={`Choose how to contact the candidate. Recipient: ${candidate.phone_number || candidate.email || 'Not recorded'}. Demo notifications are for practice only.`} icon={Phone} />
      <CardContent className="p-5 sm:p-7">
        <form onSubmit={handleSendNotification} className="space-y-4">
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
                <Label htmlFor="channel">Channel</Label>
                <Select
                    value={channel}
                    onValueChange={(value: 'sms' | 'whatsapp') => setChannel(value)}
                    disabled={isSending}
                >
                    <SelectTrigger id="channel">
                        <SelectValue placeholder="Select Channel" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="sms">
                            <div className="flex items-center"><MessageSquare className="h-4 w-4 mr-2" /> SMS</div>
                        </SelectItem>
                        <SelectItem value="whatsapp">
                            <div className="flex items-center"><MessageCircle className="h-4 w-4 mr-2" /> WhatsApp (practice)</div>
                        </SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-2">
                <Label>Tracking Code</Label>
                <div className="p-2 border rounded-md bg-gray-100 dark:bg-gray-800 font-mono text-sm h-10 flex items-center">
                    {candidate.tracking_code}
                </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="message">Message Content</Label>
            <Textarea
              id="message"
              placeholder="Enter message content..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              disabled={isSending}
            />
          </div>
          
          <Button type="submit" className="w-full" disabled={isSending || !message.trim() || !recipient}>
            {isSending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Send Notification
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default NotificationSender;