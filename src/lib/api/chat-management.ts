import { v4 as uuidv4 } from 'uuid';
import { ChatMessage, ChatSender } from '../types';
import { getChatMessages, saveChatMessages, getCandidates } from '../data-store';

// GET /api/chat/candidate/:candidateId
export const getCandidateChatHistory = async (candidateId: string): Promise<ChatMessage[]> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const messages = getChatMessages().filter(m => m.candidate_id === candidateId);
    
    // NOTE: Read marking is now handled explicitly by the UI component (AdminChatViewer/CandidateChat)
    
    return messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
};

// GET /api/chat/admin/inbox
export const getAdminInboxSummary = async (): Promise<ChatMessage[]> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const messages = getChatMessages();
    const candidates = getCandidates();
    
    // Find the latest unread message for each candidate
    const unreadMessages = messages
        .filter(m => m.sender === 'candidate' && !m.is_read_by_admin)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()); // Sort newest first

    const latestUnreadMap = new Map<string, ChatMessage>();
    
    for (const msg of unreadMessages) {
        if (!latestUnreadMap.has(msg.candidate_id)) {
            latestUnreadMap.set(msg.candidate_id, msg);
        }
    }
    
    // Include all candidates who have sent a message, even if read, showing the latest message
    const allCandidateIds = new Set(messages.map(m => m.candidate_id));
    const inboxSummary: ChatMessage[] = [];
    
    allCandidateIds.forEach(candidateId => {
        const candidateMessages = messages
            .filter(m => m.candidate_id === candidateId)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            
        if (candidateMessages.length > 0) {
            const latestMessage = candidateMessages[0];
            const associatedCandidate = candidates.find(c => c.id === candidateId);
            inboxSummary.push({
                ...latestMessage,
                candidate: associatedCandidate, // Attach the candidate object
            });
        }
    });
    
    // Sort the final summary by the latest message timestamp
    return inboxSummary.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};

// POST /api/chat/send
export const sendChatMessage = async (
    candidateId: string,
    sender: ChatSender,
    senderName: string,
    message: string
): Promise<ChatMessage> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const allMessages = getChatMessages();
    const candidate = getCandidates().find(c => c.id === candidateId);

    if (!candidate) throw new Error("Candidate not found.");

    const isCandidate = sender === 'candidate';
    
    const newMessage: ChatMessage = {
        id: uuidv4(),
        candidate_id: candidateId,
        sender: sender,
        sender_name: senderName,
        message: message,
        timestamp: new Date().toISOString(),
        is_read_by_admin: !isCandidate, // Admin messages are read by admin immediately
        is_read_by_candidate: isCandidate, // Candidate messages are read by candidate immediately
    };

    allMessages.push(newMessage);
    saveChatMessages(allMessages);
    return newMessage;
};

// PATCH /api/chat/mark-read
export const markCandidateMessagesRead = async (candidateId: string, senderType: 'admin' | 'candidate'): Promise<void> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const allMessages = getChatMessages();
    
    let changed = false;
    
    const updatedMessages = allMessages.map(m => {
        if (m.candidate_id === candidateId) {
            if (senderType === 'admin' && m.sender === 'candidate' && !m.is_read_by_admin) {
                changed = true;
                return { ...m, is_read_by_admin: true };
            }
            if (senderType === 'candidate' && (m.sender === 'admin' || m.sender === 'staff') && !m.is_read_by_candidate) {
                changed = true;
                return { ...m, is_read_by_candidate: true };
            }
        }
        return m;
    });
    
    if (changed) {
        saveChatMessages(updatedMessages);
    }
};