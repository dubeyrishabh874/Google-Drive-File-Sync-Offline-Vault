import React from 'react';
import {
  Loader2,
  CheckCircle,
  AlertCircle,
  Shield,
  Cloud,
  X,
  RotateCw,
  Folder,
  Trash2,
} from 'lucide-react';
import type { FileMetadata } from '../types';
import { formatBytes } from '../lib/fileCategorizer';

interface UploadQueueBarProps {
  queue: FileMetadata[];
  isSyncing: boolean;
  onRetry: (id: string) => void;
  onCancel: (id: string) => void;
  onClearCompleted: () => void;
}

export const UploadQueueBar: React.FC<UploadQueueBarProps> = ({
  queue,
  isSyncing,
  onRetry,
  onCancel,
  onClearCompleted,
}) => {
  if (queue.length === 0) return null;

  const totalBytes = queue.reduce((acc, f) => acc + f.size, 0);
  const loadedBytes = queue.reduce((acc, f) => acc + (f.bytesUploaded || 0), 0);
  const overallPercent =
    totalBytes > 0 ? Math.min(100, Math.round((loadedBytes / totalBytes) * 100)) : 0;

  const activeCount = queue.filter(
    (f) => f.status === 'uploading' || f.status === 'encrypting' || f.status === 'queued'
  ).length;
  const syncedCount = queue.filter((f) => f.status === 'synced' || f.status === 'offline_saved').length;
  const failedCount = queue.filter((f) => f.status === 'failed').length;

  // Compute active speed from current uploading file
  const activeUploadingFile = queue.find((f) => f.status === 'uploading' && f.uploadSpeed);
  const currentSpeed = activeUploadingFile?.uploadSpeed || '';

  return (
    <div className="w-full rounded-xl border border-[#E5E5E5] bg-white p-4 sm:p-5 shadow-xs">
      {/* Header Info */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          {activeCount > 0 ? (
            <div className="w-6 h-6 rounded bg-[#F0F0F0] border border-[#E5E5E5] flex items-center justify-center">
              <Loader2 className="w-3.5 h-3.5 text-[#1A1A1A] animate-spin" />
            </div>
          ) : (
            <div className="w-6 h-6 rounded bg-[#1A1A1A] flex items-center justify-center">
              <CheckCircle className="w-3.5 h-3.5 text-white" />
            </div>
          )}
          <div>
            <h4 className="text-sm font-semibold text-[#1A1A1A] flex items-center gap-2">
              <span>Sync & Upload Queue</span>
              <span className="text-xs font-normal text-[#666]">
                ({syncedCount}/{queue.length} completed)
              </span>
            </h4>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-[#666]">
          {currentSpeed && (
            <span className="font-mono text-[#1A1A1A] bg-[#F0F0F0] px-2 py-0.5 rounded border border-[#E5E5E5] text-[11px] font-semibold">
              {currentSpeed}
            </span>
          )}
          <span>
            {formatBytes(loadedBytes)} / {formatBytes(totalBytes)}
          </span>
          {syncedCount > 0 && activeCount === 0 && (
            <button
              onClick={onClearCompleted}
              className="text-xs text-[#666] hover:text-[#1A1A1A] flex items-center gap-1 transition-colors ml-2 font-medium"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear Completed</span>
            </button>
          )}
        </div>
      </div>

      {/* Global Progress Bar */}
      <div className="w-full h-1.5 rounded-full bg-[#E5E5E5] overflow-hidden mb-3">
        <div
          className="h-full bg-[#1A1A1A] transition-all duration-300 rounded-full"
          style={{ width: `${overallPercent}%` }}
        />
      </div>

      {/* Compact Active Items List */}
      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
        {queue.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between p-2.5 rounded-lg bg-[#F9F9F9] border border-[#E5E5E5] text-xs gap-3"
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-6 h-6 rounded bg-white border border-[#E5E5E5] flex items-center justify-center shrink-0">
                {item.status === 'uploading' ? (
                  <Loader2 className="w-3 h-3 text-[#1A1A1A] animate-spin" />
                ) : item.status === 'synced' ? (
                  <CheckCircle className="w-3 h-3 text-[#1A1A1A]" />
                ) : item.status === 'failed' ? (
                  <AlertCircle className="w-3 h-3 text-[#999]" />
                ) : (
                  <Shield className="w-3 h-3 text-[#666]" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-[#1A1A1A] truncate">{item.name}</p>
                  <span className="text-[10px] text-[#999] shrink-0 font-mono">
                    {formatBytes(item.size)}
                  </span>
                </div>
                {item.status === 'uploading' && (
                  <div className="w-full flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1 bg-[#E5E5E5] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#1A1A1A] transition-all"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-[#666] shrink-0">
                      {item.progress}%
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {item.status === 'failed' && (
                <button
                  onClick={() => onRetry(item.id)}
                  title="Retry upload"
                  className="p-1 rounded hover:bg-[#EAEAEA] text-[#1A1A1A]"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => onCancel(item.id)}
                title="Remove from queue"
                className="p-1 rounded hover:bg-[#EAEAEA] text-[#999] hover:text-[#1A1A1A]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
