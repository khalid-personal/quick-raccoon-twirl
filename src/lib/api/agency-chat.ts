import { v4 as uuidv4 } from 'uuid';
import { getAgencyMessages, getAgencyThreads, getCandidates, getLocalAgencies, getForeignAgencies, saveAgencyMessages, saveAgencyThreads } from '../data-store';
import type { AgencyChatMessage, AgencyChatThread } from '../types';

const summarize = (localId: string, foreignId: string): AgencyChatThread => {
  const messages = getAgencyMessages().filter(message => message.local_agency_id === localId && message.foreign_agency_id === foreignId).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const last = messages.at(-1) ?? null;
  return {
    id: `${localId}:${foreignId}`,
    local_agency_id: localId,
    foreign_agency_id: foreignId,
    last_message: last,
    unread_count_local: messages.filter(message => !message.is_read_by_local_agency && message.sender !== 'local-agency').length,
    unread_count_foreign: messages.filter(message => !message.is_read_by_foreign_agency && message.sender !== 'foreign-agency').length,
  };
};

export const getAgencyThreadsForLocal = async (localId: string): Promise<AgencyChatThread[]> => {
  const pairs = new Set(getAgencyThreads().filter(thread => thread.local_agency_id === localId).map(thread => thread.foreign_agency_id));
  getAgencyMessages().filter(message => message.local_agency_id === localId).forEach(message => pairs.add(message.foreign_agency_id));
  getCandidates().filter(candidate => candidate.local_agency_id === localId && candidate.foreign_agency_id).forEach(candidate => pairs.add(candidate.foreign_agency_id!));
  return [...pairs].map(foreignId => summarize(localId, foreignId)).sort((a, b) => (b.last_message?.timestamp ?? '').localeCompare(a.last_message?.timestamp ?? ''));
};

export const getAgencyThreadsForForeign = async (foreignId: string): Promise<AgencyChatThread[]> => {
  const pairs = new Set(getAgencyThreads().filter(thread => thread.foreign_agency_id === foreignId).map(thread => thread.local_agency_id));
  getAgencyMessages().filter(message => message.foreign_agency_id === foreignId).forEach(message => pairs.add(message.local_agency_id));
  getCandidates().filter(candidate => candidate.foreign_agency_id === foreignId && candidate.local_agency_id).forEach(candidate => pairs.add(candidate.local_agency_id!));
  return [...pairs].map(localId => summarize(localId, foreignId)).sort((a, b) => (b.last_message?.timestamp ?? '').localeCompare(a.last_message?.timestamp ?? ''));
};

export const getAgencyMessagesForThread = async (localId: string, foreignId: string): Promise<AgencyChatMessage[]> =>
  getAgencyMessages().filter(message => message.local_agency_id === localId && message.foreign_agency_id === foreignId).sort((a, b) => a.timestamp.localeCompare(b.timestamp));

export const sendAgencyMessage = async (input: Omit<AgencyChatMessage, 'id' | 'timestamp' | 'is_read_by_local_agency' | 'is_read_by_foreign_agency'>): Promise<AgencyChatMessage> => {
  const message: AgencyChatMessage = { ...input, id: uuidv4(), timestamp: new Date().toISOString(), is_read_by_local_agency: input.sender === 'local-agency', is_read_by_foreign_agency: input.sender === 'foreign-agency' };
  saveAgencyMessages([...getAgencyMessages(), message]);
  const threads = getAgencyThreads().filter(thread => !(thread.local_agency_id === input.local_agency_id && thread.foreign_agency_id === input.foreign_agency_id));
  threads.push(summarize(input.local_agency_id, input.foreign_agency_id));
  saveAgencyThreads(threads);
  return message;
};

export const markAgencyThreadRead = async (localId: string, foreignId: string, side: 'local' | 'foreign'): Promise<void> => {
  const messages = getAgencyMessages().map(message => message.local_agency_id !== localId || message.foreign_agency_id !== foreignId
    ? message
    : { ...message, ...(side === 'local' ? { is_read_by_local_agency: true } : { is_read_by_foreign_agency: true }) });
  saveAgencyMessages(messages);
};

export const getLocalAgencyName = (id: string) => getLocalAgencies().find(agency => agency.id === id)?.name;
export const getForeignAgencyName = (id: string) => getForeignAgencies().find(agency => agency.id === id)?.name;
