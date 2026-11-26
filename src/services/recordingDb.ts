const DB_NAME = 'navanegar_recordings_db';
const DB_VERSION = 1;
const STORE_NAME = 'audio_blobs';

export function buildRecordingKey(ownerUid: string, id: string): string {
  const safeOwner = ownerUid.trim() || 'guest';
  return `${safeOwner}::${id}`;
}

export function isKeyOwnedBy(key: string, ownerUid: string): boolean {
  const safeOwner = ownerUid.trim() || 'guest';
  return key.startsWith(`${safeOwner}::`);
}

// Memory fallback for test environments without native IndexedDB
const memoryStore = new Map<string, Blob>();

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined' && indexedDB !== null;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB'));
  });
}

export async function saveRecordingBlob(
  ownerUid: string,
  id: string,
  blob: Blob
): Promise<string> {
  const key = buildRecordingKey(ownerUid, id);
  if (!hasIndexedDb()) {
    memoryStore.set(key, blob);
    return key;
  }

  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(blob, key);
    tx.oncomplete = () => {
      db.close();
      resolve(key);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('IndexedDB write failed'));
    };
  });
}

export async function getRecordingBlob(
  ownerUid: string,
  id: string
): Promise<Blob | null> {
  const key = buildRecordingKey(ownerUid, id);
  if (!hasIndexedDb()) {
    return memoryStore.get(key) ?? null;
  }

  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => {
      db.close();
      resolve((req.result as Blob | undefined) ?? null);
    };
    req.onerror = () => {
      db.close();
      reject(req.error ?? new Error('IndexedDB read failed'));
    };
  });
}

export async function deleteRecordingBlob(
  ownerUid: string,
  id: string
): Promise<void> {
  const key = buildRecordingKey(ownerUid, id);
  if (!hasIndexedDb()) {
    memoryStore.delete(key);
    return;
  }

  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(key);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('IndexedDB delete failed'));
    };
  });
}

/**
 * Lists strictly the recording IDs belonging to `ownerUid` (never leaks other users or guest keys).
 */
export async function listRecordingIdsForOwner(ownerUid: string): Promise<string[]> {
  const prefix = `${ownerUid.trim() || 'guest'}::`;

  if (!hasIndexedDb()) {
    return Array.from(memoryStore.keys())
      .filter((k) => k.startsWith(prefix))
      .map((k) => k.slice(prefix.length));
  }

  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAllKeys();
    req.onsuccess = () => {
      db.close();
      const keys = (req.result as IDBValidKey[])
        .map((k) => String(k))
        .filter((k) => k.startsWith(prefix))
        .map((k) => k.slice(prefix.length));
      resolve(keys);
    };
    req.onerror = () => {
      db.close();
      reject(req.error ?? new Error('IndexedDB list failed'));
    };
  });
}

/**
 * Clears memory fallback store (used in unit tests).
 */
export function __resetMemoryRecordingStore(): void {
  memoryStore.clear();
}
