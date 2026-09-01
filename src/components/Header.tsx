import React from 'react';
import {
  Cloud,
  CloudOff,
  Bell,
  RefreshCw,
  Search,
  Plus,
  Menu,
  HardDrive,
  CheckCircle2,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import type { FileCategory } from '../types';
import {
  requestPushNotificationPermission,
  getPushPermissionState,
  isPushNotificationSupported,
} from '../lib/notifications';

interface HeaderProps {
  user: User | null;
  hasToken: boolean;
  isOnline: boolean;
  isSyncing: boolean;
  syncQueueCount: number;
  encryptedVaultCount: number;
  isVaultUnlocked: boolean;
  selectedCategory: FileCategory | 'all';
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenUploadDialog: () => void;
  onToggleVaultModal: () => void;
  onToggleNotificationModal: () => void;
  onManualSyncTrigger: () => void;
  unreadNotifications: number;
  onToggleMobileSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  hasToken,
  isOnline,
  isSyncing,
  syncQueueCount,
  selectedCategory,
  searchQuery,
  onSearchChange,
  onOpenUploadDialog,
  onToggleNotificationModal,
  onManualSyncTrigger,
  unreadNotifications,
  onToggleMobileSidebar,
}) => {
  const getCategoryLabel = (category: FileCategory | 'all') => {
    switch (category) {
      case 'documents':
        return 'Documents & PDFs';
      case 'spreadsheets':
        return 'Spreadsheets';
      case 'images':
        return 'Images';
      case 'archives':
        return 'Archives / ZIP';
      case 'code':
        return 'Code & Data';
      case 'media':
        return 'Media & Audio';
      default:
        return 'All Files';
    }
  };

  return (
    <header className="h-16 border-b border-[#E5E5E5] bg-white flex items-center justify-between px-4 sm:px-8 shrink-0 z-30">
      {/* Breadcrumb / Left Section */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          onClick={onToggleMobileSidebar}
          className="p-1.5 rounded-md hover:bg-[#F0F0F0] text-[#666] md:hidden"
          title="Toggle Navigation Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-xs sm:text-sm truncate">
          <span className="text-[#999] hidden sm:inline">Google Drive</span>
          <span className="text-[#999] hidden sm:inline">/</span>
          <span className="font-semibold text-[#1A1A1A] truncate">{getCategoryLabel(selectedCategory)}</span>
        </div>
      </div>

      {/* Right Controls: Search, Sync, Notifications & Primary Upload Button */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Search Input */}
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-[#999] absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search files..."
            className="bg-[#F9F9F9] border border-[#E5E5E5] pl-8 pr-3 py-1.5 rounded text-xs text-[#1A1A1A] placeholder-[#999] focus:outline-none focus:border-[#1A1A1A] w-32 sm:w-48 md:w-56 transition-all"
          />
        </div>

        {/* Sync Trigger Button */}
        {user && hasToken && isOnline && (
          <button
            onClick={onManualSyncTrigger}
            disabled={isSyncing}
            title="Sync pending files to Google Drive"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F0F0F0] hover:bg-[#E5E5E5] border border-[#E5E5E5] rounded text-xs font-medium text-[#1A1A1A] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">
              {isSyncing ? 'Syncing...' : syncQueueCount > 0 ? `Sync (${syncQueueCount})` : 'Sync'}
            </span>
          </button>
        )}

        {/* Notifications Button */}
        <button
          onClick={onToggleNotificationModal}
          title="View notifications"
          className="relative p-2 bg-[#F9F9F9] hover:bg-[#F0F0F0] border border-[#E5E5E5] rounded text-[#666] hover:text-[#1A1A1A] transition-colors"
        >
          <Bell className="w-3.5 h-3.5" />
          {unreadNotifications > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-[#1A1A1A] rounded-full" />
          )}
        </button>

        {/* Primary Action Button: + Upload New */}
        <button
          onClick={onOpenUploadDialog}
          className="flex items-center gap-1.5 bg-[#1A1A1A] hover:bg-[#333333] text-white px-3.5 sm:px-4 py-1.5 rounded text-xs font-medium transition-colors shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Upload New</span>
        </button>
      </div>
    </header>
  );
};
