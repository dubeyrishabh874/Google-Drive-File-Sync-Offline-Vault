import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { FileMetadata, EncryptedPayload, SyncLogEntry } from '../types';

interface VaultDB extends DBSchema {
  encrypted_files: {
    key: string;
    value: EncryptedPayload;
  };
  file_metadata: {
    key: string;
    value: FileMetadata;
    indexes: {
      'by-category': string;
      'by-status': string;
      'by-driveId': string;
    };
  };
  sync_queue: {
    key: string;
    value: {
      id: string;
      fileBlob: Blob;
      metadata: FileMetadata;
      addedAt: number;
    };
  };
  activity_logs: {
    key: string;
    value: SyncLogEntry;
    indexes: {
      'by-timestamp': number;
    };
  };
  app_settings: {
    key: string;
    value: any;
  };
}

const DB_NAME = 'gdrive_vault_storage_v1';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<VaultDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<VaultDB>> {
  if (!dbPromise) {
    dbPromise = openDB<VaultDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Encrypted blobs
        if (!db.objectStoreNames.contains('encrypted_files')) {
          db.createObjectStore('encrypted_files', { keyPath: 'id' });
        }

        // File metadata
        if (!db.objectStoreNames.contains('file_metadata')) {
          const fileMetaStore = db.createObjectStore('file_metadata', { keyPath: 'id' });
          fileMetaStore.createIndex('by-category', 'category');
          fileMetaStore.createIndex('by-status', 'status');
          fileMetaStore.createIndex('by-driveId', 'driveFileId');
        }

        // Offline sync queue
        if (!db.objectStoreNames.contains('sync_queue')) {
          db.createObjectStore('sync_queue', { keyPath: 'id' });
        }

        // Activity logs
        if (!db.objectStoreNames.contains('activity_logs')) {
          const logStore = db.createObjectStore('activity_logs', { keyPath: 'id' });
          logStore.createIndex('by-timestamp', 'timestamp');
        }

        // Settings
        if (!db.objectStoreNames.contains('app_settings')) {
          db.createObjectStore('app_settings');
        }
      },
    });
  }
  return dbPromise;
}

// Encrypted files operations
export async function saveEncryptedFile(payload: EncryptedPayload): Promise<void> {
  const db = await getDb();
  await db.put('encrypted_files', payload);
}

export async function getEncryptedFile(id: string): Promise<EncryptedPayload | undefined> {
  const db = await getDb();
  return db.get('encrypted_files', id);
}

export async function deleteEncryptedFile(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('encrypted_files', id);
}

export async function getAllEncryptedFiles(): Promise<EncryptedPayload[]> {
  const db = await getDb();
  return db.getAll('encrypted_files');
}

// Metadata operations
export async function saveFileMetadata(meta: FileMetadata): Promise<void> {
  const db = await getDb();
  await db.put('file_metadata', meta);
}

export async function getFileMetadata(id: string): Promise<FileMetadata | undefined> {
  const db = await getDb();
  return db.get('file_metadata', id);
}

export async function getAllFilesMetadata(): Promise<FileMetadata[]> {
  const db = await getDb();
  return db.getAll('file_metadata');
}

export async function deleteFileMetadata(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('file_metadata', id);
}

// Sync Queue operations (for offline-first uploads)
export async function addToSyncQueue(id: string, fileBlob: Blob, metadata: FileMetadata): Promise<void> {
  const db = await getDb();
  await db.put('sync_queue', {
    id,
    fileBlob,
    metadata,
    addedAt: Date.now(),
  });
}

export async function getSyncQueue(): Promise<{ id: string; fileBlob: Blob; metadata: FileMetadata; addedAt: number }[]> {
  const db = await getDb();
  return db.getAll('sync_queue');
}

export async function removeFromSyncQueue(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('sync_queue', id);
}

// Activity logs operations
export async function addLogEntry(entry: SyncLogEntry): Promise<void> {
  const db = await getDb();
  await db.put('activity_logs', entry);
}

export async function getAllLogs(): Promise<SyncLogEntry[]> {
  const db = await getDb();
  const logs = await db.getAll('activity_logs');
  return logs.sort((a, b) => b.timestamp - a.timestamp);
}

export async function clearAllLogs(): Promise<void> {
  const db = await getDb();
  await db.clear('activity_logs');
}

// App Settings
export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  const db = await getDb();
  const val = await db.get('app_settings', key);
  return val !== undefined ? val : defaultValue;
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  const db = await getDb();
  await db.put('app_settings', value, key);
}
