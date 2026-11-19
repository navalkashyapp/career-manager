import * as webpushModule from 'web-push';
import { adminDb, adminMessaging } from '../firebaseAdmin';
import * as fs from 'fs';
import * as path from 'path';

const webpush = (webpushModule as any).default || webpushModule;

export interface PushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

export interface WebPushSubscription {
  endpoint: string;
  expirationTime?: number | null;
  keys: PushSubscriptionKeys;
}

export interface StoredSubscription {
  id: string;
  type: 'web-push' | 'fcm';
  endpoint?: string;
  keys?: PushSubscriptionKeys;
  token?: string;
  userAgent?: string;
  createdAt: number;
  lastActiveAt: number;
}

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  data?: Record<string, any>;
}

export class PushNotificationService {
  private static vapidKeys: { publicKey: string; privateKey: string } | null = null;
  private static isInitialized = false;

  /**
   * Initializes VAPID keys from environment or persistent file and configures web-push.
   */
  public static initialize(): void {
    if (this.isInitialized) return;

    let pubKey = process.env.VAPID_PUBLIC_KEY;
    let privKey = process.env.VAPID_PRIVATE_KEY;

    const keyFilePath = path.resolve(process.cwd(), 'vapid-keys.json');

    // Read existing file if keys are not set in environment
    if (!pubKey || !privKey) {
      if (fs.existsSync(keyFilePath)) {
        try {
          const content = JSON.parse(fs.readFileSync(keyFilePath, 'utf8'));
          pubKey = content.publicKey;
          privKey = content.privateKey;
        } catch (e) {
          console.warn('[PushNotificationService] Failed to read vapid-keys.json:', e);
        }
      }
    }

    // Auto-generate if still missing and persist so keys stay identical across reboots
    if (!pubKey || !privKey) {
      console.log('[PushNotificationService] Generating persistent VAPID keys for Web Push...');
      const generated = webpush.generateVAPIDKeys();
      pubKey = generated.publicKey;
      privKey = generated.privateKey;
      try {
        fs.writeFileSync(keyFilePath, JSON.stringify(generated, null, 2), 'utf8');
        console.log(`[PushNotificationService] Saved persistent VAPID keys to ${keyFilePath}`);
      } catch (err: any) {
        console.warn('[PushNotificationService] Could not persist vapid-keys.json:', err.message);
      }
    }

    if (!pubKey || !privKey) {
      throw new Error('[PushNotificationService] Failed to resolve VAPID keys');
    }

    this.vapidKeys = { publicKey: pubKey, privateKey: privKey };

    const subject = process.env.VAPID_SUBJECT || 'mailto:navalkashyaap@gmail.com';
    webpush.setVapidDetails(subject, pubKey, privKey);
    this.isInitialized = true;
    console.log('[PushNotificationService] Push Notification Service ready.');
  }

  /**
   * Returns the public VAPID key for clients to subscribe to browser push manager.
   */
  public static getPublicKey(): string {
    if (!this.isInitialized) {
      this.initialize();
    }
    return this.vapidKeys?.publicKey || '';
  }

  /**
   * Registers a web push subscription or FCM token for a given user.
   */
  public static async registerSubscription(
    userId: string,
    data: {
      subscription?: WebPushSubscription;
      token?: string;
      userAgent?: string;
    },
  ): Promise<{ success: boolean; id: string }> {
    if (!userId) throw new Error('userId is required');
    if (!data.subscription && !data.token) {
      throw new Error('Either web push subscription or fcm token must be provided');
    }

    const subCol = adminDb.collection('users').doc(userId).collection('push_subscriptions');
    let subId = '';
    let record: StoredSubscription;

    if (data.subscription && data.subscription.endpoint) {
      subId = Buffer.from(data.subscription.endpoint).toString('base64url').slice(0, 64);
      record = {
        id: subId,
        type: 'web-push',
        endpoint: data.subscription.endpoint,
        keys: data.subscription.keys,
        userAgent: data.userAgent || 'Web Browser',
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
      };
    } else if (data.token) {
      subId = Buffer.from(data.token).toString('base64url').slice(0, 64);
      record = {
        id: subId,
        type: 'fcm',
        token: data.token,
        userAgent: data.userAgent || 'Web Browser',
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
      };
    } else {
      throw new Error('Invalid subscription payload');
    }

    await subCol.doc(subId).set(record, { merge: true });
    console.log(
      `[PushNotificationService] Saved ${record.type} subscription (${subId}) for user: ${userId}`,
    );
    return { success: true, id: subId };
  }

  /**
   * Removes a subscription by ID, endpoint, or token.
   */
  public static async unregisterSubscription(
    userId: string,
    idOrIdentifier: string,
  ): Promise<boolean> {
    if (!userId || !idOrIdentifier) return false;
    const subCol = adminDb.collection('users').doc(userId).collection('push_subscriptions');

    const docRef = subCol.doc(idOrIdentifier);
    const docSnap = await docRef.get();
    if (docSnap.exists) {
      await docRef.delete();
      return true;
    }

    const endpointSnap = await subCol.where('endpoint', '==', idOrIdentifier).get();
    for (const doc of endpointSnap.docs) {
      await doc.ref.delete();
    }

    const tokenSnap = await subCol.where('token', '==', idOrIdentifier).get();
    for (const doc of tokenSnap.docs) {
      await doc.ref.delete();
    }

    return true;
  }

  /**
   * Retrieves active subscriptions count and metadata for a user.
   */
  public static async getSubscriptionStatus(userId: string): Promise<{
    count: number;
    subscriptions: Array<{ id: string; type: string; userAgent?: string; lastActiveAt: number }>;
  }> {
    const subCol = adminDb.collection('users').doc(userId).collection('push_subscriptions');
    const snap = await subCol.get();
    const subscriptions = snap.docs.map((doc) => {
      const data = doc.data() as StoredSubscription;
      return {
        id: doc.id,
        type: data.type,
        userAgent: data.userAgent,
        lastActiveAt: data.lastActiveAt,
      };
    });
    return { count: subscriptions.length, subscriptions };
  }

  /**
   * Sends a push notification to all active devices/browsers of a specific user.
   */
  public static async sendNotificationToUser(
    userId: string,
    payload: NotificationPayload,
  ): Promise<{ sent: number; failed: number }> {
    if (!this.isInitialized) {
      this.initialize();
    }

    const subCol = adminDb.collection('users').doc(userId).collection('push_subscriptions');
    const snapshot = await subCol.get();

    if (snapshot.empty) {
      console.log(`[PushNotificationService] User ${userId} has no active push subscriptions.`);
      return { sent: 0, failed: 0 };
    }

    let sent = 0;
    let failed = 0;

    for (const doc of snapshot.docs) {
      const sub = doc.data() as StoredSubscription;
      try {
        if (sub.type === 'web-push' && sub.endpoint && sub.keys) {
          const pushSubscription = {
            endpoint: sub.endpoint,
            keys: sub.keys,
          };
          const pushPayload = JSON.stringify({
            title: payload.title,
            body: payload.body,
            icon: payload.icon || '/favicon.ico',
            badge: payload.badge || '/favicon.ico',
            url: payload.url || '/',
            data: payload.data || {},
          });
          await webpush.sendNotification(pushSubscription, pushPayload);
          sent++;
          await doc.ref.update({ lastActiveAt: Date.now() });
        } else if (sub.type === 'fcm' && sub.token) {
          const stringifiedData: Record<string, string> = {};
          if (payload.data) {
            for (const [k, v] of Object.entries(payload.data)) {
              stringifiedData[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
            }
          }

          await adminMessaging.send({
            token: sub.token,
            notification: {
              title: payload.title,
              body: payload.body,
            },
            webpush: {
              notification: {
                title: payload.title,
                body: payload.body,
                icon: payload.icon || '/favicon.ico',
              },
              fcmOptions: {
                link: payload.url || '/',
              },
            },
            data: stringifiedData,
          });
          sent++;
          await doc.ref.update({ lastActiveAt: Date.now() });
        }
      } catch (err: any) {
        failed++;
        console.warn(`[PushNotificationService] Failed to send push to ${doc.id}:`, err.message);

        // Prune invalid or unsubscribed clients
        const isDead =
          err.statusCode === 404 ||
          err.statusCode === 410 ||
          err.code === 'messaging/registration-token-not-registered' ||
          err.code === 'messaging/invalid-registration-token';

        if (isDead) {
          console.log(`[PushNotificationService] Removing expired subscription ${doc.id}`);
          await doc.ref.delete().catch(() => {});
        }
      }
    }

    console.log(
      `[PushNotificationService] Push results for user ${userId} -> Sent: ${sent}, Failed: ${failed}`,
    );
    return { sent, failed };
  }

  /**
   * Helper that formats and dispatches the daily import completion notification.
   */
  public static async sendDailyImportNotification(
    userId: string,
    stats: { total: number; success: number; failed: number },
  ): Promise<{ sent: number; failed: number }> {
    const title = '🎯 Daily Job Import Complete';
    const body =
      stats.total === 1
        ? `Finished importing 1 job (${stats.success} added to Target lane${stats.failed > 0 ? ', 1 failed' : ''}).`
        : `Finished importing ${stats.total} jobs (${stats.success} added to Target lane${stats.failed > 0 ? `, ${stats.failed} failed` : ''}).`;

    return this.sendNotificationToUser(userId, {
      title,
      body,
      url: '/',
      data: {
        type: 'DAILY_IMPORT_COMPLETE',
        total: stats.total,
        success: stats.success,
        failed: stats.failed,
        timestamp: Date.now(),
      },
    });
  }
}
