import React, { useState, useMemo } from 'react';
import {
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  Archive,
  FileCode,
  Film,
  File,
  ExternalLink,
  Download,
  Trash2,
  UploadCloud,
  CheckCircle2,
  Lock,
  Unlock,
  Shield,
  LayoutGrid,
  List,
  ArrowUpDown,
  Search,
} from 'lucide-react';
import type { FileMetadata, FileCategory } from '../types';
import { formatBytes } from '../lib/fileCategorizer';

interface CategoryFolderViewProps {
  files: FileMetadata[];
  selectedCategory: FileCategory | 'all';
  searchQuery: string;
  onDownloadFile: (file: FileMetadata) => void;
  onDeleteFile: (file: FileMetadata) => void;
  onSyncFileToDrive: (file: FileMetadata) => void;
  onOpenVault: () => void;
  isOnline: boolean;
  hasDriveToken: boolean;
}

export const CategoryFolderView: React.FC<CategoryFolderViewProps> = ({
  files,
  selectedCategory,
  searchQuery,
  onDownloadFile,
  onDeleteFile,
  onSyncFileToDrive,
  onOpenVault,
  isOnline,
  hasDriveToken,
}) => {
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'size'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Filter & Sort files
  const filteredFiles = useMemo(() => {
    return files
      .filter((file) => {
        if (selectedCategory !== 'all' && file.category !== selectedCategory) {
          return false;
        }
        if (
          searchQuery.trim() &&
          !file.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !(file.driveFolderName && file.driveFolderName.toLowerCase().includes(searchQuery.toLowerCase()))
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortBy === 'date') {
          diff = (a.syncedAt || a.lastModified) - (b.syncedAt || b.lastModified);
        } else if (sortBy === 'name') {
          diff = a.name.localeCompare(b.name);
        } else if (sortBy === 'size') {
          diff = a.size - b.size;
        }
        return sortOrder === 'desc' ? -diff : diff;
      });
  }, [files, selectedCategory, searchQuery, sortBy, sortOrder]);

  const getCategoryIcon = (category: FileCategory) => {
    switch (category) {
      case 'documents':
        return <FileText className="w-4 h-4 text-[#1A1A1A]" />;
      case 'spreadsheets':
        return <FileSpreadsheet className="w-4 h-4 text-[#1A1A1A]" />;
      case 'images':
        return <ImageIcon className="w-4 h-4 text-[#1A1A1A]" />;
      case 'archives':
        return <Archive className="w-4 h-4 text-[#1A1A1A]" />;
      case 'code':
        return <FileCode className="w-4 h-4 text-[#1A1A1A]" />;
      case 'media':
        return <Film className="w-4 h-4 text-[#1A1A1A]" />;
      default:
        return <File className="w-4 h-4 text-[#1A1A1A]" />;
    }
  };

  const formatCategoryName = (category: FileCategory) => {
    switch (category) {
      case 'documents':
        return 'Documents';
      case 'spreadsheets':
        return 'Spreadsheets';
      case 'images':
        return 'Images';
      case 'archives':
        return 'Archives';
      case 'code':
        return 'Code';
      case 'media':
        return 'Media';
      default:
        return 'Other';
    }
  };

  return (
    <div className="w-full bg-white border border-[#E5E5E5] rounded-xl overflow-hidden flex flex-col shadow-xs">
      {/* Table Control Header Bar */}
      <div className="flex flex-wrap items-center justify-between px-6 py-3.5 bg-white border-b border-[#E5E5E5] gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[#1A1A1A]">Files & Storage</span>
          <span className="text-[10px] font-mono bg-[#F0F0F0] text-[#666] px-2 py-0.5 rounded">
            {filteredFiles.length} {filteredFiles.length === 1 ? 'file' : 'files'}
          </span>
        </div>

        {/* View mode & Sort controls */}
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center bg-[#F9F9F9] border border-[#E5E5E5] rounded p-0.5">
            <button
              onClick={() => setSortBy('date')}
              className={`px-2 py-1 rounded text-[11px] transition-colors ${
                sortBy === 'date' ? 'bg-[#1A1A1A] text-white font-medium' : 'text-[#666] hover:text-[#1A1A1A]'
              }`}
            >
              Date
            </button>
            <button
              onClick={() => setSortBy('name')}
              className={`px-2 py-1 rounded text-[11px] transition-colors ${
                sortBy === 'name' ? 'bg-[#1A1A1A] text-white font-medium' : 'text-[#666] hover:text-[#1A1A1A]'
              }`}
            >
              Name
            </button>
            <button
              onClick={() => setSortBy('size')}
              className={`px-2 py-1 rounded text-[11px] transition-colors ${
                sortBy === 'size' ? 'bg-[#1A1A1A] text-white font-medium' : 'text-[#666] hover:text-[#1A1A1A]'
              }`}
            >
              Size
            </button>
          </div>

          <button
            onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
            title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
            className="p-1.5 bg-[#F9F9F9] hover:bg-[#F0F0F0] border border-[#E5E5E5] rounded text-[#666] hover:text-[#1A1A1A] transition-colors"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
          </button>

          <div className="flex items-center bg-[#F9F9F9] border border-[#E5E5E5] rounded p-0.5">
            <button
              onClick={() => setViewMode('list')}
              title="List View"
              className={`p-1 rounded transition-colors ${
                viewMode === 'list' ? 'bg-[#1A1A1A] text-white' : 'text-[#666] hover:text-[#1A1A1A]'
              }`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              title="Grid View"
              className={`p-1 rounded transition-colors ${
                viewMode === 'grid' ? 'bg-[#1A1A1A] text-white' : 'text-[#666] hover:text-[#1A1A1A]'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Table / Grid Content */}
      {viewMode === 'list' ? (
        <div className="flex flex-col">
          {/* Table Column Headers */}
          <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-[#F9F9F9] border-b border-[#E5E5E5] text-[10px] uppercase font-bold text-[#999] tracking-wider select-none">
            <div className="col-span-5 sm:col-span-5">File Name</div>
            <div className="col-span-3 sm:col-span-2">Size</div>
            <div className="col-span-4 sm:col-span-3">Sync Status</div>
            <div className="hidden sm:block sm:col-span-2 text-right">Category / Actions</div>
          </div>

          {/* File Rows */}
          {filteredFiles.length === 0 ? (
            <div className="py-16 text-center text-xs text-[#999] flex flex-col items-center justify-center gap-2">
              <UploadCloud className="w-8 h-8 text-[#D1D1D1]" />
              <p className="font-medium text-[#666]">No files found</p>
              <p className="text-[11px] text-[#999]">Drag & drop files above or click Upload New to sync.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#F0F0F0]">
              {filteredFiles.map((file) => {
                const isSynced = file.status === 'synced';
                const isOfflineVault = file.isEncryptedOffline;

                return (
                  <div
                    key={file.id}
                    className="grid grid-cols-12 gap-4 px-6 py-3.5 items-center text-sm hover:bg-[#F9F9F9] transition-colors group"
                  >
                    {/* File Name + Icon */}
                    <div className="col-span-5 sm:col-span-5 flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 bg-[#F0F0F0] rounded flex items-center justify-center shrink-0">
                        {getCategoryIcon(file.category)}
                      </div>
                      <div className="min-w-0 flex flex-col">
                        <span className="font-medium text-[#1A1A1A] truncate text-xs sm:text-sm" title={file.name}>
                          {file.name}
                        </span>
                        {file.relativePath && file.relativePath !== file.name && (
                          <span className="text-[10px] text-[#999] truncate font-mono">
                            {file.relativePath}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Size */}
                    <div className="col-span-3 sm:col-span-2 text-xs text-[#666] font-mono">
                      {formatBytes(file.size)}
                    </div>

                    {/* Sync Status with Indicator */}
                    <div className="col-span-4 sm:col-span-3 flex items-center gap-2 text-xs">
                      {isSynced ? (
                        <>
                          <div className="w-2 h-2 bg-[#1A1A1A] rounded-full shrink-0" />
                          <span className="text-[#1A1A1A] font-medium truncate">Synced</span>
                        </>
                      ) : isOfflineVault ? (
                        <>
                          <div className="w-2 h-2 border border-[#999] rounded-full shrink-0" />
                          <span className="text-[#666] truncate">Offline Vault</span>
                        </>
                      ) : (
                        <>
                          <div className="w-2 h-2 bg-[#D1D1D1] rounded-full shrink-0" />
                          <span className="text-[#999] truncate">Pending</span>
                        </>
                      )}
                    </div>

                    {/* Category & Action Buttons */}
                    <div className="hidden sm:flex sm:col-span-2 items-center justify-end gap-1.5">
                      <span className="text-xs text-[#999] mr-2 group-hover:hidden transition-all">
                        {formatCategoryName(file.category)}
                      </span>

                      <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100">
                        {/* Open Drive link if synced */}
                        {file.driveWebViewLink && (
                          <a
                            href={file.driveWebViewLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Open in Google Drive"
                            className="p-1.5 rounded hover:bg-[#EAEAEA] text-[#666] hover:text-[#1A1A1A] transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}

                        {/* Download / Decrypt */}
                        <button
                          onClick={() => onDownloadFile(file)}
                          title="Export / Download File"
                          className="p-1.5 rounded hover:bg-[#EAEAEA] text-[#666] hover:text-[#1A1A1A] transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>

                        {/* Sync to Drive if offline */}
                        {!isSynced && (
                          <button
                            onClick={() => onSyncFileToDrive(file)}
                            title="Sync to Google Drive now"
                            className="p-1.5 rounded hover:bg-[#EAEAEA] text-[#1A1A1A] transition-colors"
                          >
                            <UploadCloud className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Delete */}
                        <button
                          onClick={() => onDeleteFile(file)}
                          title="Delete File"
                          className="p-1.5 rounded hover:bg-[#EAEAEA] text-[#999] hover:text-[#1A1A1A] transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Grid View */
        <div className="p-6">
          {filteredFiles.length === 0 ? (
            <div className="py-16 text-center text-xs text-[#999] flex flex-col items-center justify-center gap-2">
              <UploadCloud className="w-8 h-8 text-[#D1D1D1]" />
              <p className="font-medium text-[#666]">No files in this category</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredFiles.map((file) => (
                <div
                  key={file.id}
                  className="p-4 rounded-xl border border-[#E5E5E5] bg-[#F9F9F9] hover:bg-white hover:border-[#D1D1D1] transition-all flex flex-col justify-between gap-3 group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="w-9 h-9 bg-white border border-[#E5E5E5] rounded-lg flex items-center justify-center">
                      {getCategoryIcon(file.category)}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {file.status === 'synced' ? (
                        <div className="w-2 h-2 bg-[#1A1A1A] rounded-full" title="Synced" />
                      ) : (
                        <div className="w-2 h-2 border border-[#999] rounded-full" title="Offline" />
                      )}
                    </div>
                  </div>

                  <div>
                    <h5 className="text-xs font-semibold text-[#1A1A1A] truncate" title={file.name}>
                      {file.name}
                    </h5>
                    <p className="text-[10px] text-[#666] font-mono mt-0.5">{formatBytes(file.size)}</p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#E5E5E5] text-[11px] text-[#999]">
                    <span>{formatCategoryName(file.category)}</span>
                    <div className="flex items-center gap-1">
                      {file.driveWebViewLink && (
                        <a
                          href={file.driveWebViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 rounded hover:bg-[#EAEAEA] text-[#666] hover:text-[#1A1A1A]"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      <button
                        onClick={() => onDownloadFile(file)}
                        className="p-1 rounded hover:bg-[#EAEAEA] text-[#666] hover:text-[#1A1A1A]"
                      >
                        <Download className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => onDeleteFile(file)}
                        className="p-1 rounded hover:bg-[#EAEAEA] text-[#999] hover:text-[#1A1A1A]"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
