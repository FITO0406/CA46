// Files must be structured-cloned, not JSON encoded: object URLs do not survive reloads.
const DATABASE = 'ca46-creator-drafts';
const STORE = 'drafts';
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('No se pudo abrir el guardado de borradores.'));
  });
}

export async function readCreatorDraft<T>(key: string): Promise<T | null> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const request = store.get(key);
      let value: T | null = null;
      request.onsuccess = () => {
        const entry = request.result;
        if (entry && Date.now() - entry.savedAt < RETENTION_MS) value = entry.value;
        else if (entry) store.delete(key);
      };
      tx.oncomplete = () => resolve(value);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}

export async function writeCreatorDraft<T>(key: string, value: T): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ savedAt: Date.now(), value }, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}
