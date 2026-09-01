import type { AppNotification } from '../types';

let notificationListeners: ((notification: AppNotification) => void)[] = [];
const notificationHistory: AppNotification[] = [];

// Clean subtle audio tone using Web Audio API
export function playNotificationChime(type: 'success' | 'warning' | 'error' | 'info' = 'success') {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    // Grayscale / minimalist aesthetic: subtle crisp tones
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    if (type === 'success') {
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === 'error') {
      osc.frequency.setValueAtTime(330, now); // E4
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.15); // A3
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    } else {
      osc.frequency.setValueAtTime(659.25, now); // E5
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    }
  } catch (e) {
    // Audio may be blocked before first user gesture, safe to ignore
  }
}

export async function requestPushNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    return 'denied';
  }
  return await Notification.requestPermission();
}

export function isPushNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getPushPermissionState(): NotificationPermission {
  if (!isPushNotificationSupported()) return 'denied';
  return Notification.permission;
}

export function sendPushNotification(
  title: string,
  body: string,
  type: 'success' | 'warning' | 'error' | 'info' = 'success',
  link?: string
) {
  // 1. Play minimalist tone
  playNotificationChime(type);

  // 2. Dispatch in-app notification
  const newNotif: AppNotification = {
    id: 'notif_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
    title,
    body,
    timestamp: Date.now(),
    type,
    read: false,
    link,
  };

  notificationHistory.unshift(newNotif);
  if (notificationHistory.length > 50) {
    notificationHistory.pop();
  }

  notificationListeners.forEach((listener) => listener(newNotif));

  // 3. Web Push API Notification if permitted
  if (isPushNotificationSupported() && Notification.permission === 'granted') {
    try {
      const notif = new Notification(title, {
        body,
        icon: '/favicon.ico',
        tag: 'gdrive-sync-' + Date.now(),
      });

      if (link) {
        notif.onclick = () => {
          window.open(link, '_blank');
        };
      }
    } catch (e) {
      console.warn('Push notification failed:', e);
    }
  }
}

export function subscribeToNotifications(callback: (notif: AppNotification) => void): () => void {
  notificationListeners.push(callback);
  return () => {
    notificationListeners = notificationListeners.filter((cb) => cb !== callback);
  };
}

export function getNotificationHistory(): AppNotification[] {
  return [...notificationHistory];
}
