import React from 'react';
import { Bell, CheckCircle2, AlertCircle, Info, X, Trash2, Volume2 } from 'lucide-react';
import type { AppNotification } from '../types';
import { playNotificationChime } from '../lib/notifications';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  onClear: () => void;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  isOpen,
  onClose,
  notifications,
  onClear,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white border border-[#E5E5E5] rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="p-4 border-b border-[#E5E5E5] flex items-center justify-between bg-[#F9F9F9]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#1A1A1A] flex items-center justify-center text-white">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-[#1A1A1A]">
                Sync Notifications & Alerts
              </h3>
              <p className="text-xs text-[#666]">
                Upload completions & device sync logs
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => playNotificationChime('success')}
              title="Test chime"
              className="p-1.5 rounded text-[#666] hover:text-[#1A1A1A] hover:bg-[#EAEAEA] transition-colors"
            >
              <Volume2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#666] hover:text-[#1A1A1A] hover:bg-[#EAEAEA] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="p-4 overflow-y-auto space-y-2.5 flex-1 text-xs">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-[#999]">
              No notifications yet. Upload files to receive real-time alerts.
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                className="p-3 rounded-lg bg-[#F9F9F9] border border-[#E5E5E5] flex items-start gap-3"
              >
                <div className="mt-0.5">
                  {notif.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-[#1A1A1A]" />
                  ) : notif.type === 'error' ? (
                    <AlertCircle className="w-4 h-4 text-[#666]" />
                  ) : (
                    <Info className="w-4 h-4 text-[#666]" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-[#1A1A1A]">{notif.title}</p>
                    <span className="text-[10px] text-[#999] font-mono">
                      {new Date(notif.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-[#666] mt-0.5">{notif.body}</p>
                  {notif.link && (
                    <a
                      href={notif.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#1A1A1A] underline text-[11px] mt-1 inline-block font-medium"
                    >
                      Open in Google Drive →
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="p-3 border-t border-[#E5E5E5] bg-[#F9F9F9] flex items-center justify-between">
            <button
              onClick={onClear}
              className="text-xs text-[#666] hover:text-[#1A1A1A] flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear all</span>
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1 bg-white border border-[#E5E5E5] rounded text-xs text-[#1A1A1A] hover:bg-[#F0F0F0] font-medium"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
