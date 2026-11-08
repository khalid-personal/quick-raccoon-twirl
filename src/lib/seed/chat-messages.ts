import { v4 as uuidv4 } from 'uuid';
import { ChatMessage } from '../types';
import { SEED_CANDIDATES } from './candidates'; // Import specific candidates for linking

export const SEED_CHAT_MESSAGES: ChatMessage[] = [
    {
        id: uuidv4(),
        candidate_id: SEED_CANDIDATES[0].id,
        sender: 'candidate',
        sender_name: 'Aster Bekele',
        message: "I paid the initial medical fee yesterday, but the status hasn't updated yet. Can you check?",
        timestamp: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        is_read_by_admin: false,
        is_read_by_candidate: true,
    },
    {
        id: uuidv4(),
        candidate_id: SEED_CANDIDATES[0].id,
        sender: 'admin',
        sender_name: 'admin@agency.com',
        message: "Hello Aster, we have confirmed your payment. The status will update shortly. Thank you!",
        timestamp: new Date(Date.now() - 1800000).toISOString(), // 30 minutes ago
        is_read_by_admin: true,
        is_read_by_candidate: false,
    },
    {
        id: uuidv4(),
        candidate_id: SEED_CANDIDATES[1].id,
        sender: 'candidate',
        sender_name: 'Jane Smith',
        message: "When is the next CoC training session scheduled? I need to book my travel.",
        timestamp: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        is_read_by_admin: true,
        is_read_by_candidate: true,
    },
];