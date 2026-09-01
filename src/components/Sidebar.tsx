import React from 'react';
import {
  HardDrive,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  Archive,
  FileCode,
  Film,
  Lock,
  Unlock,
  Cloud,
  CloudOff,
  Bell,
  RefreshCw,
  LogOut,
  LogIn,
  ShieldCheck,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import type { FileCategory } from '../types';
import { googleSignIn, logout } from '../lib/auth';
import { formatBytes } from '../lib/fileCategorizer';

interface SidebarProps {
  user: User | null;
  hasToken: boolean;
  isOnline: boolean;
  selectedCategory: FileCategory | 'all';
  onSelectCategory: (category: FileCategory | 'all') => void;
  categoryCounts: Record<string, number>;
  encryptedVaultCount: number;
  isVaultUnlocked: boolean;
  onToggleVaultModal: () => void;
  totalStorageBytes: number;
  syncQueueCount: number;
  onManualSyncTrigger: () => void;
  isSyncing: boolean;
  onCloseMobileSidebar?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  user,
  hasToken,
  isOnline,
  selectedCategory,
  onSelectCategory,
  categoryCounts,
  encryptedVaultCount,
  isVaultUnlocked,
  onToggleVaultModal,
  totalStorageBytes,
  syncQueueCount,
  onManualSyncTrigger,
  isSyncing,
  onCloseMobileSidebar,
}) => {
  const categories: { key: FileCategory | 'all'; label: string; icon: any }[] = [
    { key: 'all', label: 'All Files', icon: HardDrive },
    { key: 'documents', label: 'Documents & PDFs', icon: FileText },
    { key: 'spreadsheets', label: 'Spreadsheets', icon: FileSpreadsheet },
    { key: 'images', label: 'Images', icon: ImageIcon },
    { key: 'archives', label: 'Archives / ZIP', icon: Archive },
    { key: 'code', label: 'Code & Data', icon: FileCode },
    { key: 'media', label: 'Media & Audio', icon: Film },
  ];

  const [isAuthenticating, setIsAuthenticating] = React.useState(false);

  const handleCategoryClick = (key: FileCategory | 'all') => {
    onSelectCategory(key);
    if (onCloseMobileSidebar) onCloseMobileSidebar();
  };

  const handleAuth = async () => {
    if (isAuthenticating) return;
    setIsAuthenticating(true);
    try {
      if (user) {
        await logout();
      } else {
        await googleSignIn();
      }
    } catch (err) {
      console.warn('Authentication handled:', err);
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Approximate Google Drive free tier (15 GB) display
  const maxStorage = 15 * 1024 * 1024 * 1024; // 15GB
  const storagePercent = Math.min(100, Math.max(2, Math.round((totalStorageBytes / maxStorage) * 100)));

  return (
    <aside className="w-64 bg-white border-r border-[#E5E5E5] flex flex-col h-full shrink-0 select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-[#E5E5E5]">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 bg-[#1A1A1A] rounded flex items-center justify-center shrink-0">
            <div className="w-4 h-4 border-2 border-white rounded-sm"></div>
          </div>
          <div className="flex flex-col">
            <span className="font-bold tracking-tight text-lg text-[#1A1A1A] leading-none">VaultSync</span>
            <span className="text-[10px] text-[#999] tracking-wider uppercase font-semibold mt-1">Google Drive & Vault</span>
          </div>
        </div>

        {/* User Card */}
        {user ? (
          <div className="flex items-center justify-between bg-[#F9F9F9] p-2.5 rounded-lg border border-[#E5E5E5]">
            <div className="flex items-center gap-2.5 min-w-0">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  className="w-8 h-8 rounded-full border border-[#E5E5E5] shrink-0 object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-8 h-8 bg-[#D1D1D1] text-[#1A1A1A] font-bold text-xs rounded-full flex items-center justify-center shrink-0">
                  {user.displayName ? user.displayName.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-[#1A1A1A] truncate">{user.displayName || 'Connected User'}</span>
                <span className="text-[10px] text-[#666] truncate">{user.email}</span>
              </div>
            </div>
            <button
              onClick={handleAuth}
              title="Sign Out"
              className="p-1 rounded text-[#999] hover:text-[#1A1A1A] hover:bg-[#EAEAEA] transition-colors ml-1"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={handleAuth}
            disabled={isAuthenticating}
            className="w-full flex items-center justify-center gap-2 bg-[#F9F9F9] hover:bg-[#F0F0F0] disabled:opacity-50 p-2.5 rounded-lg border border-[#E5E5E5] text-xs font-medium text-[#1A1A1A] transition-colors"
          >
            {isAuthenticating ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <LogIn className="w-3.5 h-3.5" />
            )}
            <span>{isAuthenticating ? 'Connecting...' : 'Connect Google Drive'}</span>
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        <div className="text-[10px] uppercase tracking-widest text-[#999] px-3 mb-2 font-bold">
          Categories
        </div>

        {categories.map((cat) => {
          const isActive = selectedCategory === cat.key;
          const count = categoryCounts[cat.key] || 0;
          const Icon = cat.icon;

          return (
            <button
              key={cat.key}
              onClick={() => handleCategoryClick(cat.key)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded text-sm transition-colors ${
                isActive
                  ? 'bg-[#F0F0F0] text-[#1A1A1A] font-semibold'
                  : 'text-[#666] hover:bg-[#F9F9F9] hover:text-[#1A1A1A] font-normal'
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#1A1A1A]' : 'text-[#888]'}`} />
                <span className="truncate">{cat.label}</span>
              </div>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                  isActive ? 'bg-[#E0E0E0] text-[#1A1A1A] font-bold' : 'text-[#999] bg-[#F9F9F9]'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}

        {/* Security & Vault Section */}
        <div className="pt-5">
          <div className="text-[10px] uppercase tracking-widest text-[#999] px-3 mb-2 font-bold">
            Security & Vault
          </div>

          {/* Offline Mode Status Card */}
          <div className="flex items-center justify-between px-3 py-2 bg-[#F9F9F9] border border-[#E5E5E5] rounded text-xs mb-2">
            <span className="flex items-center gap-2 text-[#666]">
              {isOnline ? (
                <Cloud className="w-3.5 h-3.5 text-[#1A1A1A]" />
              ) : (
                <CloudOff className="w-3.5 h-3.5 text-[#666]" />
              )}
              <span>{isOnline ? 'Online Sync Active' : 'Offline Mode'}</span>
            </span>
            <div className={`w-7 h-3.5 rounded-full relative transition-colors ${isOnline ? 'bg-[#1A1A1A]' : 'bg-[#D1D1D1]'}`}>
              <div className={`absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full transition-all ${isOnline ? 'right-0.5' : 'left-0.5'}`} />
            </div>
          </div>

          {/* Encrypted Offline Vault Button */}
          <button
            onClick={onToggleVaultModal}
            className="w-full flex items-center justify-between px-3 py-2 bg-[#F9F9F9] hover:bg-[#F0F0F0] border border-[#E5E5E5] rounded text-xs text-[#1A1A1A] transition-colors"
          >
            <span className="flex items-center gap-2">
              {isVaultUnlocked ? (
                <Unlock className="w-3.5 h-3.5 text-[#1A1A1A]" />
              ) : (
                <Lock className="w-3.5 h-3.5 text-[#666]" />
              )}
              <span className="font-medium">Encrypted Vault</span>
            </span>
            <span className="text-[10px] bg-[#E0E0E0] text-[#1A1A1A] px-1.5 py-0.5 rounded font-mono font-medium">
              {encryptedVaultCount} items
            </span>
          </button>
        </div>
      </nav>

      {/* Storage Footer */}
      <div className="p-4 border-t border-[#E5E5E5] bg-white">
        <div className="bg-[#F9F9F9] rounded-lg p-3 border border-[#E5E5E5]">
          <div className="flex justify-between items-center text-[10px] text-[#666] mb-1.5 font-medium">
            <span>Drive Vault Storage</span>
            <span className="font-mono text-[#1A1A1A] font-semibold">{formatBytes(totalStorageBytes)}</span>
          </div>
          <div className="w-full h-1.5 bg-[#E5E5E5] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#1A1A1A] rounded-full transition-all duration-300"
              style={{ width: `${storagePercent}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-[9px] text-[#999] mt-1.5">
            <span>Local & Drive</span>
            <span>{syncQueueCount > 0 ? `${syncQueueCount} pending` : 'All Synced'}</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
