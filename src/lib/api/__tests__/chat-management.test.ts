// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { getCandidates, getChatMessages, initializeDataStore, saveDocuments } from '../../data-store';
import { sendChatMessage } from '../chat-management';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChatDocumentTags } from '../../../components/ChatDocumentContext';
import type { ChatMessage, Document } from '../../types';

describe('candidate chat document context', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); initializeDataStore(); });
  it('allows document-only messages with owned document tags and saved file names', async () => {
    const candidate = getCandidates()[0];
    saveDocuments([{ id: 'own-doc', candidate_id: candidate.id, stage_id: 3, file_name: 'coc-certificate.pdf', file_type: 'application/pdf', storage_key: 'docs/coc.pdf', uploaded_at: '2026-01-01', public_url: 'https://example.test/coc.pdf' }]);
    const message = await sendChatMessage(candidate.id, 'candidate', 'Candidate', '', ['own-doc', 'own-doc']);
    expect(message.document_tags).toEqual([{ id: 'own-doc', file_name: 'coc-certificate.pdf', stage_id: 3 }]);
    expect(getChatMessages().find(item => item.id === message.id)).toMatchObject({ document_tags: message.document_tags });
  });
  it('rejects another candidate document and blank messages', async () => {
    const candidate = getCandidates()[0];
    saveDocuments([{ id: 'other-doc', candidate_id: 'other-candidate', file_name: 'private.pdf', file_type: 'application/pdf', storage_key: 'private', uploaded_at: '2026-01-01' }]);
    await expect(sendChatMessage(candidate.id, 'candidate', 'Candidate', 'Look at this', ['other-doc'])).rejects.toThrow(/belong to this candidate/);
    await expect(sendChatMessage(candidate.id, 'candidate', 'Candidate', '   ')).rejects.toThrow(/message or document/);
  });
  it('shows owned document links and keeps context after deletion without rendering unsafe URLs', () => {
    const message = { candidate_id: 'candidate-one', document_tags: [{ id: 'doc', file_name: 'training.pdf', stage_id: 3 }] } as ChatMessage;
    const document = { id: 'doc', candidate_id: 'candidate-one', file_name: 'training.pdf', public_url: 'https://example.test/training.pdf' } as Document;
    const valid = renderToStaticMarkup(createElement(ChatDocumentTags, { message, documents: [document] }));
    expect(valid).toContain('href="https://example.test/training.pdf"');
    const removed = renderToStaticMarkup(createElement(ChatDocumentTags, { message, documents: [] }));
    expect(removed).toContain('training.pdf');
    expect(removed).toContain('Document no longer available');
    const unsafe = renderToStaticMarkup(createElement(ChatDocumentTags, { message, documents: [{ ...document, public_url: 'javascript:alert(1)' }] }));
    expect(unsafe).not.toContain('href=');
    const otherCandidate = renderToStaticMarkup(createElement(ChatDocumentTags, { message, documents: [{ ...document, candidate_id: 'other' }] }));
    expect(otherCandidate).not.toContain('href=');
  });
});