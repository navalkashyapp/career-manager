import { apiUrl, apiFetch } from '../../config/api';
import { getIdTokenSafe } from '../../store/firebase';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export class PushNotificationClient {
  public static isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    );
  }

  public static getPermission(): NotificationPermission {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'denied';
    }
    return Notification.permission;
  }

  public static async registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (!this.isSupported()) return null;
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;
      return registration;
    } catch (err) {
      console.error('[PushClient] Service worker registration failed:', err);
      return null;
    }
  }

  public static async getVapidPublicKey(): Promise<string> {
    try {
      const res = await apiFetch(apiUrl('/api/career-ops/notifications/vapid-key'));
      if (!res.ok) throw new Error('Failed to fetch VAPID key');
      const data = await res.json();
      return data.vapidPublicKey || '';
    } catch (e) {
      console.warn('[PushClient] Failed to fetch VAPID key:', e);
      return '';
    }
  }

  public static async getCurrentSubscription(): Promise<PushSubscription | null> {
    if (!this.isSupported()) return null;
    try {
      const reg = await navigator.serviceWorker.ready;
      return await reg.pushManager.getSubscription();
    } catch {
      return null;
    }
  }

  public static async subscribe(): Promise<{ success: boolean; error?: string }> {
    if (!this.isSupported()) {
      return { success: false, error: 'Push notifications are not supported by this browser.' };
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        return { success: false, error: 'Notification permission was not granted.' };
      }

      const registration = await this.registerServiceWorker();
      if (!registration) {
        return { success: false, error: 'Failed to initialize service worker.' };
      }

      const vapidPublicKey = await this.getVapidPublicKey();
      if (!vapidPublicKey) {
        return { success: false, error: 'Could not obtain VAPID public key from backend server.' };
      }

      const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey,
        });
      }

      const token = await getIdTokenSafe();
      const res = await apiFetch(apiUrl('/api/career-ops/notifications/subscribe'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          userAgent: navigator.userAgent,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Server rejected push subscription.');
      }

      return { success: true };
    } catch (err: any) {
      console.error('[PushClient] Subscribe error:', err);
      return { success: false, error: err.message || 'Failed to subscribe to push notifications.' };
    }
  }

  public static async unsubscribe(): Promise<{ success: boolean; error?: string }> {
    if (!this.isSupported()) return { success: false, error: 'Unsupported' };

    try {
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.getSubscription();

      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();

        const token = await getIdTokenSafe();
        await apiFetch(apiUrl('/api/career-ops/notifications/unsubscribe'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ endpoint }),
        });
      }

      return { success: true };
    } catch (err: any) {
      console.error('[PushClient] Unsubscribe error:', err);
      return { success: false, error: err.message || 'Failed to unsubscribe.' };
    }
  }

  public static async sendTestNotification(): Promise<{ success: boolean; error?: string }> {
    try {
      const token = await getIdTokenSafe();
      const res = await apiFetch(apiUrl('/api/career-ops/notifications/test'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          title: '🔔 Daily Job Import Notification Test',
          body: 'This is how your daily job import summary will appear when processing finishes!',
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Test notification failed');
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Test push notification failed.' };
    }
  }
}
