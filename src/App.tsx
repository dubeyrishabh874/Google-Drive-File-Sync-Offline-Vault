import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { User } from 'firebase/auth';
import { initAuth, getAccessToken, googleSignIn } from './lib/auth';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DropZone } from './components/DropZone';
import { UploadQueueBar } from './components/UploadQueueBar';
import { CategoryFolderView } from './components/CategoryFolderView';
import { OfflineVaultModal } from './components/OfflineVaultModal';
import { NotificationModal } from './components/NotificationModal';
import { DeviceSyncStatus } from './components/DeviceSyncStatus';
import type { FileMetadata, AppNotification, ExtractedFile, FileCategory } from './types';
import {
  getAllFilesMetadata,
  saveFileMetadata,
  deleteFileMetadata,
  saveEncryptedFile,
  getEncryptedFile,
  deleteEncryptedFile,
  getAllEncryptedFiles,
  addToSyncQueue,
  getSyncQueue,
  removeFromSyncQueue,
  addLogEntry,
} from './lib/indexedDb';
import {
  encryptFile,
  decryptFile,
  getOrCreateDeviceVaultKey,
} from './lib/crypto';
import {
  getTargetFolderForCategory,
  uploadFileMultipart,
  deleteDriveFile,
} from './lib/driveApi';
import {
  sendPushNotification,
  subscribeToNotifications,
  getNotificationHistory,
} from './lib/notifications';
import { formatBytes, formatSpeed } from './lib/fileCategorizer';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [hasToken, setHasToken] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [uploadQueue, setUploadQueue] = useState<FileMetadata[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [encryptedVaultCount, setEncryptedVaultCount] = useState<number>(0);
  const [isVaultUnlocked, setIsVaultUnlocked] = useState<boolean>(true);
  const [vaultPasscode, setVaultPasscode] = useState<string>(getOrCreateDeviceVaultKey());
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState<number>(0);
  const [isVaultModalOpen, setIsVaultModalOpen] = useState<boolean>(false);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | undefined>(undefined);
  const [selectedCategory, setSelectedCategory] = useState<FileCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  // Keep references to active upload abort controllers or buffers
  const inMemoryBlobCache = useRef<Map<string, Blob>>(new Map());

  // Listen to online / offline network events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      sendPushNotification('Network Restored', 'Back online. Ready to sync with Google Drive.', 'info');
    };
    const handleOffline = () => {
      setIsOnline(false);
      sendPushNotification('Offline Mode Active', 'No active internet connection. Offline encrypted vault is active.', 'warning');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Initialize Auth
  useEffect(() => {
    const unsubscribeAuth = initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setHasToken(!!token);
      },
      () => {
        setUser(null);
        setHasToken(false);
      }
    );

    return () => unsubscribeAuth();
  }, []);

  // Load existing metadata and encrypted files on mount
  const refreshStorage = useCallback(async () => {
    try {
      const storedFiles = await getAllFilesMetadata();
      setFiles(storedFiles);

      const encrypted = await getAllEncryptedFiles();
      setEncryptedVaultCount(encrypted.length);
    } catch (err) {
      console.error('Failed to load local metadata:', err);
    }
  }, []);

  useEffect(() => {
    refreshStorage();
    setNotifications(getNotificationHistory());

    const unsubscribeNotifs = subscribeToNotifications((notif) => {
      setNotifications((prev) => [notif, ...prev.slice(0, 49)]);
      setUnreadNotifications((prev) => prev + 1);
    });

    return () => unsubscribeNotifs();
  }, [refreshStorage]);

  // Compute category file counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: files.length };
    files.forEach((f) => {
      counts[f.category] = (counts[f.category] || 0) + 1;
    });
    return counts;
  }, [files]);

  // Compute total storage bytes
  const totalStorageBytes = useMemo(() => {
    return files.reduce((acc, f) => acc + f.size, 0);
  }, [files]);

  // Process a single file upload to Google Drive or local offline storage
  const processFileUpload = async (
    fileBlob: Blob,
    metadata: FileMetadata,
    options: { autoCategorize: boolean; encryptOffline: boolean }
  ) => {
    const token = getAccessToken();

    // Step 1: Encrypt locally if requested
    if (options.encryptOffline) {
      try {
        setUploadQueue((prev) =>
          prev.map((item) =>
            item.id === metadata.id ? { ...item, status: 'encrypting', progress: 10 } : item
          )
        );

        const currentKey = vaultPasscode || getOrCreateDeviceVaultKey();
        const { encryptedBlob, iv, salt } = await encryptFile(fileBlob, currentKey);

        await saveEncryptedFile({
          id: metadata.id,
          name: metadata.name,
          size: metadata.size,
          type: metadata.type,
          category: metadata.category,
          createdAt: Date.now(),
          iv,
          salt,
          encryptedData: encryptedBlob,
        });

        metadata.isEncryptedOffline = true;
        metadata.offlineStoredAt = Date.now();
        await saveFileMetadata(metadata);
        setEncryptedVaultCount((prev) => prev + 1);
      } catch (err) {
        console.warn('Offline encryption failed:', err);
      }
    }

    // Step 2: Upload to Google Drive if connected and online
    if (isOnline && token) {
      try {
        setUploadQueue((prev) =>
          prev.map((item) =>
            item.id === metadata.id ? { ...item, status: 'uploading', progress: 20 } : item
          )
        );

        // Get target Drive category folder
        const { categoryFolderId, categoryFolderName } = await getTargetFolderForCategory(
          token,
          metadata.category
        );

        metadata.driveFolderId = categoryFolderId;
        metadata.driveFolderName = categoryFolderName;

        // Perform multipart upload with real-time speed & byte reporting
        const driveResult = await uploadFileMultipart(
          token,
          fileBlob,
          metadata.name,
          categoryFolderId,
          metadata.type,
          (percent, loaded, total, speed) => {
            const speedFormatted = speed > 0 ? `${formatBytes(speed)}/s` : '';
            setUploadQueue((prev) =>
              prev.map((item) =>
                item.id === metadata.id
                  ? {
                      ...item,
                      progress: percent,
                      bytesUploaded: loaded,
                      uploadSpeed: speedFormatted,
                    }
                  : item
              )
            );
          }
        );

        metadata.driveFileId = driveResult.id;
        metadata.driveWebViewLink = driveResult.webViewLink;
        metadata.status = 'synced';
        metadata.progress = 100;
        metadata.bytesUploaded = metadata.size;
        metadata.syncedAt = Date.now();

        await saveFileMetadata(metadata);
        await removeFromSyncQueue(metadata.id);

        setUploadQueue((prev) =>
          prev.map((item) =>
            item.id === metadata.id ? { ...item, ...metadata, status: 'synced', progress: 100 } : item
          )
        );

        // Send Push Notification
        sendPushNotification(
          'Upload Successful',
          `"${metadata.name}" has been synchronized to Google Drive in folder "${categoryFolderName}".`,
          'success',
          metadata.driveWebViewLink
        );

        await addLogEntry({
          id: 'log_' + Date.now() + Math.random().toString(36).substring(2, 6),
          timestamp: Date.now(),
          filename: metadata.name,
          category: metadata.category,
          action: 'upload_drive',
          status: 'success',
          message: `Uploaded to folder "${categoryFolderName}" on Google Drive.`,
          driveFileId: driveResult.id,
        });

        setLastSyncTime(Date.now());
      } catch (err: any) {
        console.error('Drive upload error:', err);
        metadata.status = 'failed';
        metadata.errorMessage = err.message || 'Upload failed';
        await saveFileMetadata(metadata);
        await addToSyncQueue(metadata.id, fileBlob, metadata);

        setUploadQueue((prev) =>
          prev.map((item) =>
            item.id === metadata.id ? { ...item, status: 'failed', errorMessage: err.message } : item
          )
        );

        sendPushNotification(
          'Upload Failed',
          `Failed to upload "${metadata.name}". Saved to offline sync queue.`,
          'error'
        );
      }
    } else {
      // Offline mode: store in local offline queue
      metadata.status = 'offline_saved';
      metadata.progress = 100;
      await saveFileMetadata(metadata);
      await addToSyncQueue(metadata.id, fileBlob, metadata);

      setUploadQueue((prev) =>
        prev.map((item) =>
          item.id === metadata.id ? { ...item, status: 'offline_saved', progress: 100 } : item
        )
      );

      sendPushNotification(
        'Saved to Offline Vault',
        `"${metadata.name}" is stored locally in encrypted storage. Will sync to Drive once online.`,
        'info'
      );
    }

    // Refresh main files view
    await refreshStorage();
  };

  // Handle files selected via Drag & Drop or picker
  const handleFilesSelected = async (
    extracted: ExtractedFile[],
    options: { autoCategorize: boolean; encryptOffline: boolean }
  ) => {
    if (extracted.length === 0) return;

    setIsSyncing(true);
    const newItems: FileMetadata[] = [];

    for (const item of extracted) {
      const fileId = 'file_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      const metadata: FileMetadata = {
        id: fileId,
        name: item.file.name,
        size: item.file.size,
        type: item.file.type || 'application/octet-stream',
        extension: item.file.name.split('.').pop() || '',
        category: item.category,
        lastModified: item.file.lastModified || Date.now(),
        relativePath: item.relativePath,
        status: 'queued',
        progress: 0,
        bytesUploaded: 0,
        isEncryptedOffline: false,
      };

      inMemoryBlobCache.current.set(fileId, item.file);
      newItems.push(metadata);
    }

    setUploadQueue((prev) => [...newItems, ...prev]);

    // Process sequentially or in batches
    for (let i = 0; i < newItems.length; i++) {
      const meta = newItems[i];
      const blob = inMemoryBlobCache.current.get(meta.id) || extracted[i].file;
      await processFileUpload(blob, meta, options);
    }

    setIsSyncing(false);
  };

  // Retry failed upload
  const handleRetryUpload = async (id: string) => {
    const item = uploadQueue.find((q) => q.id === id) || files.find((f) => f.id === id);
    if (!item) return;

    let blob = inMemoryBlobCache.current.get(id);
    if (!blob && item.isEncryptedOffline) {
      const encrypted = await getEncryptedFile(id);
      if (encrypted) {
        const keyToUse = vaultPasscode || getOrCreateDeviceVaultKey();
        blob = await decryptFile(
          encrypted.encryptedData,
          encrypted.iv,
          encrypted.salt,
          keyToUse,
          encrypted.type
        );
      }
    }

    if (blob) {
      setIsSyncing(true);
      await processFileUpload(blob, { ...item, status: 'queued' }, {
        autoCategorize: true,
        encryptOffline: false,
      });
      setIsSyncing(false);
    }
  };

  // Cancel / remove from queue
  const handleCancelQueueItem = (id: string) => {
    setUploadQueue((prev) => prev.filter((item) => item.id !== id));
    inMemoryBlobCache.current.delete(id);
  };

  // Clear completed from queue
  const handleClearCompletedQueue = () => {
    setUploadQueue((prev) =>
      prev.filter((item) => item.status === 'uploading' || item.status === 'queued')
    );
  };

  // Download / Export file
  const handleDownloadFile = async (file: FileMetadata) => {
    try {
      let blob = inMemoryBlobCache.current.get(file.id);

      // Check encrypted offline vault
      if (!blob && file.isEncryptedOffline) {
        const encrypted = await getEncryptedFile(file.id);
        if (encrypted) {
          const keyToUse = vaultPasscode || getOrCreateDeviceVaultKey();
          blob = await decryptFile(
            encrypted.encryptedData,
            encrypted.iv,
            encrypted.salt,
            keyToUse,
            file.type
          );
        }
      }

      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else if (file.driveWebViewLink) {
        window.open(file.driveWebViewLink, '_blank');
      } else {
        alert('File content not found in local cache. Open from Google Drive.');
      }
    } catch (err) {
      console.error('Download error:', err);
      alert('Failed to export file.');
    }
  };

  // Delete file
  const handleDeleteFile = async (file: FileMetadata) => {
    if (!confirm(`Are you sure you want to delete "${file.name}"?`)) return;

    try {
      // 1. Delete from Drive if token and driveFileId exists
      const token = getAccessToken();
      if (token && file.driveFileId) {
        try {
          await deleteDriveFile(token, file.driveFileId);
        } catch (e) {
          console.warn('Drive deletion error:', e);
        }
      }

      // 2. Delete local metadata
      await deleteFileMetadata(file.id);

      // 3. Delete encrypted copy if present
      if (file.isEncryptedOffline) {
        await deleteEncryptedFile(file.id);
      }

      // 4. Remove from queue
      setUploadQueue((prev) => prev.filter((item) => item.id !== file.id));
      inMemoryBlobCache.current.delete(file.id);

      await refreshStorage();
      sendPushNotification('File Deleted', `"${file.name}" was removed.`, 'info');
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  // Sync a single offline file to Drive
  const handleSyncFileToDrive = async (file: FileMetadata) => {
    let token = getAccessToken();
    if (!token) {
      try {
        const res = await googleSignIn();
        token = res?.accessToken || null;
        if (res?.user) setUser(res.user);
        if (token) setHasToken(true);
      } catch (e) {
        return;
      }
    }

    if (!token) return;

    let blob = inMemoryBlobCache.current.get(file.id);
    if (!blob && file.isEncryptedOffline) {
      const encrypted = await getEncryptedFile(file.id);
      if (encrypted) {
        const keyToUse = vaultPasscode || getOrCreateDeviceVaultKey();
        blob = await decryptFile(
          encrypted.encryptedData,
          encrypted.iv,
          encrypted.salt,
          keyToUse,
          file.type
        );
      }
    }

    if (blob) {
      setUploadQueue((prev) => [file, ...prev.filter((i) => i.id !== file.id)]);
      setIsSyncing(true);
      await processFileUpload(blob, file, { autoCategorize: true, encryptOffline: false });
      setIsSyncing(false);
    }
  };

  // Sync all pending offline files to Drive
  const handleSyncAllToDrive = async () => {
    let token = getAccessToken();
    if (!token) {
      try {
        const res = await googleSignIn();
        token = res?.accessToken || null;
        if (res?.user) setUser(res.user);
        if (token) setHasToken(true);
      } catch (e) {
        return;
      }
    }

    if (!token) return;

    const offlineQueue = await getSyncQueue();
    const unsyncedFiles = files.filter((f) => f.status !== 'synced');

    if (offlineQueue.length === 0 && unsyncedFiles.length === 0) {
      sendPushNotification('All Synced', 'All files are up to date on Google Drive.', 'info');
      return;
    }

    setIsSyncing(true);
    sendPushNotification('Syncing Vault', `Beginning sync of ${unsyncedFiles.length} files to Drive...`, 'info');

    for (const item of unsyncedFiles) {
      let blob = inMemoryBlobCache.current.get(item.id);
      if (!blob && item.isEncryptedOffline) {
        const encrypted = await getEncryptedFile(item.id);
        if (encrypted) {
          const keyToUse = vaultPasscode || getOrCreateDeviceVaultKey();
          blob = await decryptFile(
            encrypted.encryptedData,
            encrypted.iv,
            encrypted.salt,
            keyToUse,
            item.type
          );
        }
      }

      if (blob) {
        await processFileUpload(blob, item, { autoCategorize: true, encryptOffline: false });
      }
    }

    setIsSyncing(false);
  };

  const handleOpenUploadDialog = () => {
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    if (fileInput) fileInput.click();
  };

  return (
    <div className="flex h-screen w-full bg-[#F5F5F5] font-sans text-[#1A1A1A] overflow-hidden">
      {/* Desktop Left Sidebar */}
      <div className="hidden md:flex h-full shrink-0">
        <Sidebar
          user={user}
          hasToken={hasToken}
          isOnline={isOnline}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          categoryCounts={categoryCounts}
          encryptedVaultCount={encryptedVaultCount}
          isVaultUnlocked={isVaultUnlocked}
          onToggleVaultModal={() => setIsVaultModalOpen(true)}
          totalStorageBytes={totalStorageBytes}
          syncQueueCount={files.filter((f) => f.status !== 'synced').length}
          onManualSyncTrigger={handleSyncAllToDrive}
          isSyncing={isSyncing}
        />
      </div>

      {/* Mobile Sidebar Overlay Drawer */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
          <div className="relative z-10 w-64 h-full bg-white">
            <Sidebar
              user={user}
              hasToken={hasToken}
              isOnline={isOnline}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              categoryCounts={categoryCounts}
              encryptedVaultCount={encryptedVaultCount}
              isVaultUnlocked={isVaultUnlocked}
              onToggleVaultModal={() => setIsVaultModalOpen(true)}
              totalStorageBytes={totalStorageBytes}
              syncQueueCount={files.filter((f) => f.status !== 'synced').length}
              onManualSyncTrigger={handleSyncAllToDrive}
              isSyncing={isSyncing}
              onCloseMobileSidebar={() => setIsMobileSidebarOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Main Workspace Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* High Density Header */}
        <Header
          user={user}
          hasToken={hasToken}
          isOnline={isOnline}
          isSyncing={isSyncing}
          syncQueueCount={files.filter((f) => f.status !== 'synced').length}
          encryptedVaultCount={encryptedVaultCount}
          isVaultUnlocked={isVaultUnlocked}
          selectedCategory={selectedCategory}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onOpenUploadDialog={handleOpenUploadDialog}
          onToggleVaultModal={() => setIsVaultModalOpen(true)}
          onToggleNotificationModal={() => {
            setIsNotificationModalOpen(true);
            setUnreadNotifications(0);
          }}
          onManualSyncTrigger={handleSyncAllToDrive}
          unreadNotifications={unreadNotifications}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen((prev) => !prev)}
        />

        {/* High Density Scrollable Section */}
        <section className="flex-1 p-6 sm:p-8 overflow-y-auto space-y-6">
          {/* Device Sync Status */}
          <DeviceSyncStatus
            isOnline={isOnline}
            userEmail={user?.email}
            syncQueueCount={files.filter((f) => f.status !== 'synced').length}
            offlineEncryptedCount={encryptedVaultCount}
            totalSyncedCount={files.filter((f) => f.status === 'synced').length}
            lastSyncTime={lastSyncTime}
          />

          {/* High-Density Drag & Drop Area */}
          <DropZone
            onFilesSelected={handleFilesSelected}
            isOnline={isOnline}
            hasDriveToken={hasToken}
            disabled={false}
          />

          {/* Real-time Progress & Upload Queue */}
          <UploadQueueBar
            queue={uploadQueue}
            isSyncing={isSyncing}
            onRetry={handleRetryUpload}
            onCancel={handleCancelQueueItem}
            onClearCompleted={handleClearCompletedQueue}
          />

          {/* High Density File Data Table */}
          <CategoryFolderView
            files={files}
            selectedCategory={selectedCategory}
            searchQuery={searchQuery}
            onDownloadFile={handleDownloadFile}
            onDeleteFile={handleDeleteFile}
            onSyncFileToDrive={handleSyncFileToDrive}
            onOpenVault={() => setIsVaultModalOpen(true)}
            isOnline={isOnline}
            hasDriveToken={hasToken}
          />
        </section>

        {/* High Density Dark Status Footer */}
        <footer className="h-12 bg-[#1A1A1A] text-white flex items-center justify-between px-6 sm:px-8 text-[11px] shrink-0 border-t border-[#111]">
          <div className="flex items-center gap-4 sm:gap-6 text-neutral-300">
            <span className="hidden sm:inline">
              Real-time Sync: <strong className="text-white font-medium">{isOnline ? 'Active' : 'Paused'}</strong>
            </span>
            <span className="hidden md:inline">
              Encryption: <strong className="text-white font-medium">AES-256-GCM</strong>
            </span>
            <span>
              Total Storage: <strong className="text-white font-mono">{formatBytes(totalStorageBytes)}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                isOnline ? 'bg-[#00FF00] shadow-[0_0_8px_#00FF00]' : 'bg-[#FFA500] shadow-[0_0_8px_#FFA500]'
              }`}
            />
            <span className="font-medium">{isOnline ? 'System Online' : 'Offline Mode'}</span>
          </div>
        </footer>
      </main>

      {/* Offline Encrypted Vault Modal */}
      <OfflineVaultModal
        isOpen={isVaultModalOpen}
        onClose={() => setIsVaultModalOpen(false)}
        isUnlocked={isVaultUnlocked}
        onUnlockSuccess={(passcode) => {
          setVaultPasscode(passcode);
          setIsVaultUnlocked(true);
        }}
        onLockVault={() => setIsVaultUnlocked(false)}
        onSyncAllToDrive={handleSyncAllToDrive}
        isOnline={isOnline}
        hasDriveToken={hasToken}
      />

      {/* Notifications Modal */}
      <NotificationModal
        isOpen={isNotificationModalOpen}
        onClose={() => setIsNotificationModalOpen(false)}
        notifications={notifications}
        onClear={() => setNotifications([])}
      />
    </div>
  );
}
