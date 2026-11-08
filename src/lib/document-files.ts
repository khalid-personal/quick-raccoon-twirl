import { isDemoMode } from './demo-mode';

const key = (id: string) => `${isDemoMode() ? 'demo' : 'live'}:${id}`;
const openDatabase = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  if (!window.indexedDB) { reject(new Error('This browser cannot store document files. Use a browser with IndexedDB enabled.')); return; }
  const request = window.indexedDB.open('dawm-document-files', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('files');
  request.onerror = () => reject(request.error ?? new Error('Document storage could not be opened.'));
  request.onsuccess = () => resolve(request.result);
});
async function transact<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('files', mode);
    const request = action(transaction.objectStore('files'));
    transaction.oncomplete = () => { database.close(); resolve(request.result); };
    transaction.onabort = () => { database.close(); reject(transaction.error ?? request.error ?? new Error('Document storage failed.')); };
    transaction.onerror = () => { database.close(); reject(transaction.error ?? request.error ?? new Error('Document storage failed.')); };
  });
}
export async function saveDocumentFile(id: string, file: Blob): Promise<void> { await transact('readwrite', store => store.put(file, key(id))); }
export async function getDocumentFile(id: string): Promise<Blob | undefined> { return transact('readonly', store => store.get(key(id))); }
export async function deleteDocumentFile(id: string): Promise<void> { await transact('readwrite', store => store.delete(key(id))); }

export const blobDataUrl = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read document.'));
  reader.onerror = () => reject(reader.error ?? new Error('Could not read document.'));
  reader.readAsDataURL(blob);
});
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename;
  document.body.append(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}
