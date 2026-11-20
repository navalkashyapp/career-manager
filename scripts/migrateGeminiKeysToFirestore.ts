import { adminDb } from '../src/lib/firebaseAdmin';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const TARGET_UID = 'lExn412lD1fJYkwR3egFNqZyo4w2';
const TARGET_EMAIL = 'kashyapnaval35@gmail.com';

async function migrateKeys() {
  console.log(
    `[Migration] Starting Gemini API keys migration to Firestore for user: ${TARGET_UID}...`,
  );

  const rawKeys = [
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY,
  ].filter(Boolean) as string[];

  // Deduplicate keys preserving order
  const uniqueKeys = Array.from(new Set(rawKeys));

  if (uniqueKeys.length === 0) {
    throw new Error('No Gemini API keys found in environment to migrate!');
  }

  console.log(`[Migration] Found ${uniqueKeys.length} unique Gemini API keys in environment.`);

  const docRef = adminDb.collection('users').doc(TARGET_UID).collection('secrets').doc('gemini');

  const payload = {
    apiKeys: uniqueKeys,
    primaryKey: uniqueKeys[0] || '',
    secondaryKey: uniqueKeys[1] || '',
    ownerEmail: TARGET_EMAIL,
    ownerUid: TARGET_UID,
    updatedAt: new Date().toISOString(),
    migratedFromEnv: true,
  };

  await docRef.set(payload, { merge: true });
  console.log(
    `[Migration] Successfully wrote keys to Firestore path: users/${TARGET_UID}/secrets/gemini`,
  );

  // Verify
  const verifiedDoc = await docRef.get();
  if (!verifiedDoc.exists) {
    throw new Error('Verification failed: Document does not exist after write!');
  }

  const data = verifiedDoc.data();
  console.log('[Migration] Verification succeeded! Data stored in Firestore:');
  console.log({
    ownerEmail: data?.ownerEmail,
    ownerUid: data?.ownerUid,
    keyCount: data?.apiKeys?.length,
    maskedKeys: data?.apiKeys?.map((k: string) => `${k.slice(0, 8)}...${k.slice(-4)}`),
    updatedAt: data?.updatedAt,
  });
}

migrateKeys()
  .then(() => {
    console.log('[Migration] Done!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('[Migration] Failed:', err);
    process.exit(1);
  });
