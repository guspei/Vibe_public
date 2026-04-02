import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

interface VibeDB extends DBSchema {
  pdfProjects: {
    key: string;
    value: {
      id: string;
      title: string;
      pdfData: Uint8Array | null;
      thumbnailData: Uint8Array | null;
      modifiedPdfData: Uint8Array | null;
      fields: import('@/lib/types').IPdfTextField[];
      uploadedFonts: import('@/lib/types').IPdfUploadedFont[];
      groupId: string | null;
      sortOrder: number;
      createdAt: string;
      updatedAt: string;
    };
  };
  pdfGroups: {
    key: string;
    value: {
      id: string;
      name: string;
      sortOrder: number;
      createdAt: string;
      updatedAt: string;
    };
  };
  gifProjects: {
    key: string;
    value: {
      id: string;
      title: string;
      frames: import('@/lib/types').IGifFrameStored[];
      settings: import('@/lib/types').IGifSettings;
      gifData: Uint8Array | null;
      createdAt: string;
      updatedAt: string;
    };
  };
  blobs: {
    key: string;
    value: {
      id: string;
      data: Uint8Array;
      type: string;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<VibeDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<VibeDB>> {
  if (!dbPromise) {
    dbPromise = openDB<VibeDB>('vibe-public', 1, {
      upgrade(db) {
        db.createObjectStore('pdfProjects', { keyPath: 'id' });
        db.createObjectStore('pdfGroups', { keyPath: 'id' });
        db.createObjectStore('gifProjects', { keyPath: 'id' });
        db.createObjectStore('blobs', { keyPath: 'id' });
      },
    });
  }
  return dbPromise;
}

// Convert any buffer-like value to a fresh Uint8Array for IndexedDB storage
export function toUint8(data: ArrayBuffer | Uint8Array): Uint8Array {
  if (data instanceof Uint8Array) return new Uint8Array(data);
  return new Uint8Array(data);
}

// Helper to store a blob and return its ID
export async function storeBlob(data: ArrayBuffer | Uint8Array, type: string): Promise<string> {
  const db = await getDB();
  const id = crypto.randomUUID();
  await db.put('blobs', { id, data: toUint8(data), type });
  return id;
}

// Helper to get a blob as object URL
export async function getBlobUrl(id: string): Promise<string | null> {
  const db = await getDB();
  const entry = await db.get('blobs', id);
  if (!entry) return null;
  const blob = new Blob([entry.data.buffer as ArrayBuffer], { type: entry.type });
  return URL.createObjectURL(blob);
}

// Helper to delete a blob
export async function deleteBlob(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('blobs', id);
}
