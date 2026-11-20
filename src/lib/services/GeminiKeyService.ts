import { adminDb } from '../firebaseAdmin';

export interface GeminiSecretsDoc {
  apiKeys: string[];
  primaryKey?: string;
  secondaryKey?: string;
  ownerEmail?: string;
  ownerUid?: string;
  updatedAt?: string;
}

export interface GeminiKeyMetadata {
  keyCount: number;
  maskedKeys: string[];
  updatedAt?: string;
  source: 'firestore' | 'environment' | 'none';
  ownerUid: string;
}

export class GeminiKeyService {
  public static readonly DEFAULT_USER_ID = 'lExn412lD1fJYkwR3egFNqZyo4w2';
  private static readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

  private static cache = new Map<string, { keys: string[]; fetchedAt: number }>();

  /**
   * Retrieves Gemini API keys from Firestore for the given user, using in-memory cache.
   * If not cached or expired, fetches fresh keys from Firestore `users/{userId}/secrets/gemini`.
   */
  public static async getApiKeys(userId?: string): Promise<string[]> {
    const uid = userId || this.DEFAULT_USER_ID;
    const now = Date.now();

    const cached = this.cache.get(uid);
    if (cached && now - cached.fetchedAt < this.CACHE_TTL_MS && cached.keys.length > 0) {
      return cached.keys;
    }

    try {
      const docRef = adminDb.collection('users').doc(uid).collection('secrets').doc('gemini');
      const snap = await docRef.get();

      if (snap.exists) {
        const data = snap.data() as GeminiSecretsDoc;
        const keys = Array.isArray(data?.apiKeys)
          ? data.apiKeys.filter((k) => typeof k === 'string' && k.trim().length > 0)
          : [];

        if (keys.length > 0) {
          this.cache.set(uid, { keys, fetchedAt: now });
          return keys;
        }
      }

      // If user doc not found and uid is not default, try fallback to default owner's keys
      if (uid !== this.DEFAULT_USER_ID) {
        const fallbackKeys = await this.getApiKeys(this.DEFAULT_USER_ID);
        if (fallbackKeys.length > 0) {
          return fallbackKeys;
        }
      }
    } catch (err: any) {
      console.error(
        `[GeminiKeyService] ⚠️ Error reading Gemini keys from Firestore for ${uid}:`,
        err.message,
      );
    }

    // Graceful fallback to environment variables if Firestore is unreachable or empty
    const envKeys = [
      process.env.GEMINI_API_KEY_1,
      process.env.GEMINI_API_KEY_2,
      process.env.GEMINI_API_KEY,
    ].filter(Boolean) as string[];

    const uniqueEnvKeys = Array.from(new Set(envKeys));
    if (uniqueEnvKeys.length > 0) {
      this.cache.set(uid, { keys: uniqueEnvKeys, fetchedAt: now });
      return uniqueEnvKeys;
    }

    return [];
  }

  /**
   * Retrieves metadata about the Gemini API keys without exposing plaintext keys.
   */
  public static async getKeyMetadata(userId?: string): Promise<GeminiKeyMetadata> {
    const uid = userId || this.DEFAULT_USER_ID;

    try {
      const docRef = adminDb.collection('users').doc(uid).collection('secrets').doc('gemini');
      const snap = await docRef.get();

      if (snap.exists) {
        const data = snap.data() as GeminiSecretsDoc;
        const keys = Array.isArray(data?.apiKeys)
          ? data.apiKeys.filter((k) => typeof k === 'string' && k.trim().length > 0)
          : [];

        if (keys.length > 0) {
          const maskedKeys = keys.map((k) =>
            k.length > 8 ? `${k.slice(0, 8)}...${k.slice(-4)}` : '****',
          );
          return {
            keyCount: keys.length,
            maskedKeys,
            updatedAt: data?.updatedAt,
            source: 'firestore',
            ownerUid: uid,
          };
        }
      }
    } catch (err: any) {
      console.error(
        `[GeminiKeyService] ⚠️ Error reading Gemini key metadata from Firestore for ${uid}:`,
        err.message,
      );
    }

    // Fallback: check environment keys
    const envKeys = [
      process.env.GEMINI_API_KEY_1,
      process.env.GEMINI_API_KEY_2,
      process.env.GEMINI_API_KEY,
    ].filter(Boolean) as string[];

    const uniqueEnvKeys = Array.from(new Set(envKeys));
    if (uniqueEnvKeys.length > 0) {
      const maskedKeys = uniqueEnvKeys.map((k) =>
        k.length > 8 ? `${k.slice(0, 8)}...${k.slice(-4)}` : '****',
      );
      return {
        keyCount: uniqueEnvKeys.length,
        maskedKeys,
        source: 'environment',
        ownerUid: uid,
      };
    }

    return {
      keyCount: 0,
      maskedKeys: [],
      source: 'none',
      ownerUid: uid,
    };
  }

  /**
   * Securely saves new Gemini API keys to Firestore under `users/{userId}/secrets/gemini`.
   */
  public static async setApiKeys(userId: string, keys: string[]): Promise<void> {
    const uid = userId || this.DEFAULT_USER_ID;
    const cleanKeys = Array.from(
      new Set(keys.filter((k) => typeof k === 'string' && k.trim().length > 0)),
    );

    if (cleanKeys.length === 0) {
      throw new Error('At least one valid Gemini API key must be provided.');
    }

    const docRef = adminDb.collection('users').doc(uid).collection('secrets').doc('gemini');
    await docRef.set(
      {
        apiKeys: cleanKeys,
        primaryKey: cleanKeys[0] || '',
        secondaryKey: cleanKeys[1] || '',
        ownerUid: uid,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );

    // Invalidate and update cache immediately
    this.cache.set(uid, { keys: cleanKeys, fetchedAt: Date.now() });
  }

  /**
   * Removes custom Gemini API keys from Firestore for the given user, reverting to environment defaults.
   */
  public static async deleteApiKeys(userId?: string): Promise<void> {
    const uid = userId || this.DEFAULT_USER_ID;
    const docRef = adminDb.collection('users').doc(uid).collection('secrets').doc('gemini');
    await docRef.delete();
    this.cache.delete(uid);
  }

  /**
   * Tests a Gemini API key by making a lightweight test request.
   */
  public static async verifyKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 10) {
      return { valid: false, error: 'Invalid API key format. Key must be at least 10 characters.' };
    }

    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
      await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: 'Ping',
      });
      return { valid: true };
    } catch (err: any) {
      const msg = err.message || '';
      // If 429 quota reached, the key is recognized as authentic by Google
      if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
        return { valid: true };
      }
      return { valid: false, error: msg || 'Failed to authenticate with Gemini API.' };
    }
  }

  /**
   * Clears the in-memory cache for a user or all users.
   */
  public static clearCache(userId?: string): void {
    if (userId) {
      this.cache.delete(userId);
    } else {
      this.cache.clear();
    }
  }
}
