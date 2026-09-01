export type FileCategory = 
  | 'documents'
  | 'images'
  | 'spreadsheets'
  | 'archives'
  | 'code'
  | 'media'
  | 'other';

export type SyncStatus = 
  | 'queued'
  | 'encrypting'
  | 'uploading'
  | 'synced'
  | 'offline_saved'
  | 'failed'
  | 'paused';

export interface FileMetadata {
  id: string;
  name: string;
  size: number;
  type: string;
  extension: string;
  category: FileCategory;
  lastModified: number;
  relativePath?: string;
  driveFileId?: string;
  driveFolderId?: string;
  driveFolderName?: string;
  driveWebViewLink?: string;
  status: SyncStatus;
  progress: number; // 0 to 100
  bytesUploaded: number;
  uploadSpeed?: string; // e.g. "1.2 MB/s"
  errorMessage?: string;
  isEncryptedOffline: boolean;
  offlineStoredAt?: number;
  syncedAt?: number;
  sha256Hash?: string;
}

export interface EncryptedPayload {
  id: string;
  name: string;
  size: number;
  type: string;
  category: FileCategory;
  createdAt: number;
  iv: string; // base64
  salt: string; // base64
  encryptedData: Blob; // encrypted blob stored in IndexedDB
}

export interface SyncLogEntry {
  id: string;
  timestamp: number;
  filename: string;
  category: FileCategory;
  action: 'upload_drive' | 'encrypt_offline' | 'sync_offline_to_drive' | 'delete' | 'error';
  status: 'success' | 'failed' | 'info';
  message: string;
  driveFileId?: string;
}

export interface DriveFolderInfo {
  id: string;
  name: string;
  category: FileCategory;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  timestamp: number;
  type: 'success' | 'warning' | 'error' | 'info';
  read: boolean;
  link?: string;
}

export interface ExtractedFile {
  file: File;
  relativePath: string;
  category: FileCategory;
}
