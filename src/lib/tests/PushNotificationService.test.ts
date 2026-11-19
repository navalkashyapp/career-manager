import { describe, it, expect, beforeAll } from 'vitest';
import { PushNotificationService } from '../services/PushNotificationService';

describe('PushNotificationService', () => {
  beforeAll(() => {
    PushNotificationService.initialize();
  });

  it('initializes VAPID keys and exposes a valid public key', () => {
    const pubKey = PushNotificationService.getPublicKey();
    expect(pubKey).toBeDefined();
    expect(typeof pubKey).toBe('string');
    expect(pubKey.length).toBeGreaterThan(20);
  });

  it('rejects subscription registration if neither subscription nor token is provided', async () => {
    await expect(
      PushNotificationService.registerSubscription('test-user', {} as any),
    ).rejects.toThrow('Either web push subscription or fcm token must be provided');
  });

  it('rejects unregister when userId or identifier is missing', async () => {
    const result = await PushNotificationService.unregisterSubscription('', '');
    expect(result).toBe(false);
  });
});
