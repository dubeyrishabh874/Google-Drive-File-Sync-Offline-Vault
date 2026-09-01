import React from 'react';
import {
  Laptop,
  CheckCircle2,
  Cloud,
  CloudOff,
  Shield,
  Activity,
  HardDrive,
  Clock,
} from 'lucide-react';

interface DeviceSyncStatusProps {
  isOnline: boolean;
  userEmail?: string | null;
  syncQueueCount: number;
  offlineEncryptedCount: number;
  totalSyncedCount: number;
  lastSyncTime?: number;
}

export const DeviceSyncStatus: React.FC<DeviceSyncStatusProps> = ({
  isOnline,
  userEmail,
  syncQueueCount,
  offlineEncryptedCount,
  totalSyncedCount,
  lastSyncTime,
}) => {
  return (
    <div className="w-full rounded-xl border border-[#E5E5E5] bg-white p-3.5 sm:p-4 text-xs shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Device & Account Node */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#F9F9F9] border border-[#E5E5E5] flex items-center justify-center text-[#1A1A1A]">
            <Laptop className="w-4 h-4 text-[#1A1A1A]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[#1A1A1A]">Connected Workspace</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#F0F0F0] border border-[#E5E5E5] text-[#1A1A1A] font-medium">
                Active Node
              </span>
            </div>
            <p className="text-[11px] text-[#666]">
              {userEmail ? `Authenticated as ${userEmail}` : 'Local-First Offline Node (Sign in for Drive Sync)'}
            </p>
          </div>
        </div>

        {/* Real-time Status Metric Nodes */}
        <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-[#666]">
          {/* Connection */}
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                isOnline ? 'bg-[#1A1A1A]' : 'bg-[#D1D1D1]'
              }`}
            />
            <span className="text-xs">{isOnline ? 'Cloud Sync Online' : 'Offline Vault Active'}</span>
          </div>

          {/* Sync status */}
          <div className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-[#999]" />
            <span>
              Queue: <strong className="text-[#1A1A1A] font-semibold">{syncQueueCount}</strong> pending
            </span>
          </div>

          {/* Encrypted Vault */}
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-[#999]" />
            <span>
              Vault: <strong className="text-[#1A1A1A] font-semibold">{offlineEncryptedCount}</strong> encrypted
            </span>
          </div>

          {/* Last sync time */}
          {lastSyncTime && (
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#999]" />
              <span>
                Last sync: {new Date(lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
