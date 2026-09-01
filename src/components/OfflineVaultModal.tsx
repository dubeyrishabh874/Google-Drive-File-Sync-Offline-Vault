import React, { useState, useEffect } from 'react';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Lock,
  Unlock,
  Key,
  Download,
  Trash2,
  UploadCloud,
  X,
  Eye,
  FileText,
  FileCheck,
  RefreshCw,
  HardDrive,
  Info,
} from 'lucide-react';
import type { EncryptedPayload, FileMetadata } from '../types';
import {
  getAllEncryptedFiles,
  deleteEncryptedFile,
  getEncryptedFile,
  saveFileMetadata,
} from '../lib/indexedDb';
import {
  decryptFile,
  getOrCreateDeviceVaultKey,
} from '../lib/crypto';
import { formatBytes } from '../lib/fileCategorizer';

interface OfflineVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  isUnlocked: boolean;
  onUnlockSuccess: (passcode: string) => void;
  onLockVault: () => void;
  onSyncAllToDrive: () => void;
  isOnline: boolean;
  hasDriveToken: boolean;
}

export const OfflineVaultModal: React.FC<OfflineVaultModalProps> = ({
  isOpen,
  onClose,
  isUnlocked,
  onUnlockSuccess,
  onLockVault,
  onSyncAllToDrive,
  isOnline,
  hasDriveToken,
}) => {
  const [passcodeInput, setPasscodeInput] = useState('');
  const [encryptedFiles, setEncryptedFiles] = useState<EncryptedPayload[]>([]);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState<string | null>(null);
  const [previewMimeType, setPreviewMimeType] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activePasscode, setActivePasscode] = useState<string>('');
  const [vaultKeyType, setVaultKeyType] = useState<'device' | 'custom'>('device');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadVaultFiles();
      // Default to device key if not customized
      const storedDeviceKey = getOrCreateDeviceVaultKey();
      if (!activePasscode) {
        setActivePasscode(storedDeviceKey);
        onUnlockSuccess(storedDeviceKey);
      }
    }
  }, [isOpen]);

  const loadVaultFiles = async () => {
    try {
      const files = await getAllEncryptedFiles();
      setEncryptedFiles(files);
    } catch (e) {
      console.error('Failed to load encrypted files:', e);
    }
  };

  const handleUnlockWithCustomPasscode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcodeInput.trim()) {
      setErrorMsg('Please enter a passcode');
      return;
    }
    setErrorMsg('');
    setActivePasscode(passcodeInput.trim());
    onUnlockSuccess(passcodeInput.trim());
  };

  const handleDownloadDecrypted = async (file: EncryptedPayload) => {
    try {
      setIsLoading(true);
      const keyToUse = activePasscode || getOrCreateDeviceVaultKey();
      const decryptedBlob = await decryptFile(
        file.encryptedData,
        file.iv,
        file.salt,
        keyToUse,
        file.type
      );

      const url = URL.createObjectURL(decryptedBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err: any) {
      console.error('Decryption error:', err);
      alert('Decryption failed. Please verify your vault passcode.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreviewDecrypted = async (file: EncryptedPayload) => {
    try {
      setIsLoading(true);
      const keyToUse = activePasscode || getOrCreateDeviceVaultKey();
      const decryptedBlob = await decryptFile(
        file.encryptedData,
        file.iv,
        file.salt,
        keyToUse,
        file.type
      );

      const url = URL.createObjectURL(decryptedBlob);
      setPreviewBlobUrl(url);
      setPreviewFileName(file.name);
      setPreviewMimeType(file.type);
    } catch (err) {
      alert('Failed to decrypt and preview this file.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteEncrypted = async (id: string, name: string) => {
    if (!confirm(`Delete encrypted file "${name}" from local storage?`)) return;
    try {
      await deleteEncryptedFile(id);
      await loadVaultFiles();
    } catch (e) {
      console.error('Failed to delete encrypted file:', e);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-white border border-[#E5E5E5] rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-[#E5E5E5] flex items-center justify-between bg-[#F9F9F9]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#1A1A1A] flex items-center justify-center text-white">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-[#1A1A1A]">
                  Encrypted Offline Vault
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#E0E0E0] text-[#1A1A1A] font-medium">
                  AES-256-GCM
                </span>
              </div>
              <p className="text-xs text-[#666]">
                Zero-knowledge local storage protected with Web Crypto API PBKDF2
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#666] hover:text-[#1A1A1A] hover:bg-[#EAEAEA] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* Key Management Info */}
          <div className="p-4 rounded-xl bg-[#F9F9F9] border border-[#E5E5E5] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Key className="w-4 h-4 text-[#1A1A1A] mt-0.5 shrink-0" />
              <div>
                <h4 className="text-xs font-semibold text-[#1A1A1A]">Vault Security Status</h4>
                <p className="text-[11px] text-[#666] mt-0.5">
                  Device Hardware Key is active for automatic offline synchronization and local caching.
                </p>
              </div>
            </div>

            {/* Sync All Button */}
            {isOnline && hasDriveToken && encryptedFiles.length > 0 && (
              <button
                onClick={() => {
                  onSyncAllToDrive();
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1A1A1A] hover:bg-[#333] text-white text-xs font-medium shrink-0 transition-colors"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Sync Vault to Drive</span>
              </button>
            )}
          </div>

          {/* Preview Section if active */}
          {previewBlobUrl && (
            <div className="p-4 rounded-xl border border-[#E5E5E5] bg-white space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-[#1A1A1A] truncate">
                  Decrypted Preview: {previewFileName}
                </span>
                <button
                  onClick={() => {
                    URL.revokeObjectURL(previewBlobUrl);
                    setPreviewBlobUrl(null);
                  }}
                  className="text-xs text-[#666] hover:text-[#1A1A1A]"
                >
                  Close Preview
                </button>
              </div>
              <div className="max-h-64 overflow-auto rounded bg-[#F9F9F9] p-3 border border-[#E5E5E5] flex items-center justify-center">
                {previewMimeType?.startsWith('image/') ? (
                  <img
                    src={previewBlobUrl}
                    alt={previewFileName || 'Preview'}
                    className="max-h-60 max-w-full rounded object-contain"
                  />
                ) : (
                  <div className="text-center py-6 text-xs text-[#666]">
                    Preview ready. Click Download to save decrypted file.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Encrypted Files List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-xs text-[#1A1A1A] uppercase tracking-wider">
                Encrypted Files ({encryptedFiles.length})
              </h4>
              <span className="text-[11px] text-[#999]">
                Total: {formatBytes(encryptedFiles.reduce((acc, f) => acc + f.size, 0))}
              </span>
            </div>

            {encryptedFiles.length === 0 ? (
              <div className="p-8 rounded-xl border border-[#E5E5E5] bg-[#F9F9F9] text-center text-xs text-[#999]">
                No encrypted files stored in local vault.
              </div>
            ) : (
              <div className="space-y-2">
                {encryptedFiles.map((file) => (
                  <div
                    key={file.id}
                    className="p-3 rounded-lg border border-[#E5E5E5] bg-[#F9F9F9] hover:bg-white flex items-center justify-between gap-3 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded bg-white border border-[#E5E5E5] flex items-center justify-center text-[#1A1A1A] shrink-0">
                        <Lock className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-[#1A1A1A] truncate text-xs">{file.name}</p>
                        <div className="flex items-center gap-2 text-[10px] text-[#999] font-mono mt-0.5">
                          <span>{formatBytes(file.size)}</span>
                          <span>•</span>
                          <span>{new Date(file.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handlePreviewDecrypted(file)}
                        disabled={isLoading}
                        title="Decrypt & Preview"
                        className="p-1.5 rounded hover:bg-[#EAEAEA] text-[#666] hover:text-[#1A1A1A] transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDownloadDecrypted(file)}
                        disabled={isLoading}
                        title="Decrypt & Download"
                        className="p-1.5 rounded hover:bg-[#EAEAEA] text-[#666] hover:text-[#1A1A1A] transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDeleteEncrypted(file.id, file.name)}
                        title="Delete from Vault"
                        className="p-1.5 rounded hover:bg-[#EAEAEA] text-[#999] hover:text-[#1A1A1A] transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#E5E5E5] bg-[#F9F9F9] flex items-center justify-between text-xs text-[#666]">
          <span>AES-GCM 256-bit Key • Web Crypto API</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-white hover:bg-[#F0F0F0] border border-[#E5E5E5] text-[#1A1A1A] font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
