import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeminiKeyService } from '../services/GeminiKeyService';
import { adminDb } from '../firebaseAdmin';

describe('GeminiKeyService', () => {
  const TEST_UID = 'test-owner-uid';

  beforeEach(() => {
    vi.restoreAllMocks();
    GeminiKeyService.clearCache();
  });

  it('fetches keys from Firestore and caches in memory', async () => {
    const mockData = {
      apiKeys: ['key-alpha', 'key-beta'],
      primaryKey: 'key-alpha',
      ownerUid: TEST_UID,
    };

    const getSpy = vi.fn().mockResolvedValue({
      exists: true,
      data: () => mockData,
    });

    vi.spyOn(adminDb, 'collection').mockReturnValue({
      doc: vi.fn().mockReturnValue({
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({
            get: getSpy,
          }),
        }),
      }),
    } as any);

    // First call: hits Firestore
    const keys1 = await GeminiKeyService.getApiKeys(TEST_UID);
    expect(keys1).toEqual(['key-alpha', 'key-beta']);
    expect(getSpy).toHaveBeenCalledTimes(1);

    // Second call: hits in-memory cache, Firestore get is not called again
    const keys2 = await GeminiKeyService.getApiKeys(TEST_UID);
    expect(keys2).toEqual(['key-alpha', 'key-beta']);
    expect(getSpy).toHaveBeenCalledTimes(1);
  });

  it('saves new keys to Firestore and updates in-memory cache', async () => {
    const setSpy = vi.fn().mockResolvedValue({});

    vi.spyOn(adminDb, 'collection').mockReturnValue({
      doc: vi.fn().mockReturnValue({
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({
            set: setSpy,
          }),
        }),
      }),
    } as any);

    await GeminiKeyService.setApiKeys(TEST_UID, ['new-key-1', 'new-key-2']);
    expect(setSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKeys: ['new-key-1', 'new-key-2'],
        primaryKey: 'new-key-1',
        ownerUid: TEST_UID,
      }),
      { merge: true },
    );

    // Cache should immediately reflect new keys without Firestore get
    const cached = await GeminiKeyService.getApiKeys(TEST_UID);
    expect(cached).toEqual(['new-key-1', 'new-key-2']);
  });

  it('throws an error if no valid keys are provided to setApiKeys', async () => {
    await expect(GeminiKeyService.setApiKeys(TEST_UID, [])).rejects.toThrow(
      'At least one valid Gemini API key must be provided.',
    );
  });

  it('returns key metadata with masked keys', async () => {
    const mockData = {
      apiKeys: ['AIzaSyABC123456789XYZ', 'AIzaSyDEF987654321UVW'],
      updatedAt: '2026-11-20T00:00:00.000Z',
    };

    vi.spyOn(adminDb, 'collection').mockReturnValue({
      doc: vi.fn().mockReturnValue({
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({
              exists: true,
              data: () => mockData,
            }),
          }),
        }),
      }),
    } as any);

    const meta = await GeminiKeyService.getKeyMetadata(TEST_UID);
    expect(meta.keyCount).toBe(2);
    expect(meta.source).toBe('firestore');
    expect(meta.maskedKeys[0]).toBe('AIzaSyAB...9XYZ');
    expect(meta.updatedAt).toBe('2026-11-20T00:00:00.000Z');
  });

  it('deletes keys and clears cache', async () => {
    const deleteSpy = vi.fn().mockResolvedValue({});

    vi.spyOn(adminDb, 'collection').mockReturnValue({
      doc: vi.fn().mockReturnValue({
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({
            delete: deleteSpy,
          }),
        }),
      }),
    } as any);

    await GeminiKeyService.deleteApiKeys(TEST_UID);
    expect(deleteSpy).toHaveBeenCalled();
  });

  it('rejects short or empty keys during verifyKey', async () => {
    const result = await GeminiKeyService.verifyKey('short');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid API key format');
  });
});
