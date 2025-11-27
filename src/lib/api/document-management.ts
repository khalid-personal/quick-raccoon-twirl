import { v4 as uuidv4 } from 'uuid';
import { Document } from '../types';
import { getDocuments, saveDocuments, getCandidates } from '../data-store';

// POST /api/admin/candidate/:id/upload
export const uploadDocument = async (
    candidateId: string,
    stageId: number,
    file: File
): Promise<Document> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const documents = getDocuments();
    const candidate = getCandidates().find(c => c.id === candidateId);

    if (!candidate) throw new Error("Candidate not found.");

    const newDoc: Document = {
        id: uuidv4(),
        candidate_id: candidateId,
        stage_id: stageId,
        file_name: file.name,
        file_type: file.type,
        storage_key: `docs/${candidate.tracking_code}/${file.name}`,
        uploaded_at: new Date().toISOString(),
        public_url: '/placeholder.svg',
    };

    documents.push(newDoc);
    saveDocuments(documents);
    return newDoc;
};

// DELETE /api/admin/document/:id
export const deleteDocument = async (documentId: string): Promise<{ success: boolean }> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    let documents = getDocuments();
    const initialLength = documents.length;

    documents = documents.filter(doc => doc.id !== documentId);

    if (documents.length === initialLength) {
        throw new Error("Document not found.");
    }

    saveDocuments(documents);
    return { success: true };
};