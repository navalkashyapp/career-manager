import { initializeApp, cert, getApps, applicationDefault } from 'firebase-admin/app';
import type { App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import * as dotenv from 'dotenv';
import path from 'path';

import * as fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

let adminApp: App;

if (!getApps().length) {
  const serviceAccountPath = path.resolve(process.cwd(), 'service-account.json');
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      adminApp = initializeApp({
        credential: cert(serviceAccount),
      });
      console.log('Firebase Admin initialized with FIREBASE_SERVICE_ACCOUNT_KEY env');
    } catch (e) {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', e);
      adminApp = initializeApp({
        credential: applicationDefault(),
        projectId: 'career-manager-8037a',
      });
    }
  } else if (fs.existsSync(serviceAccountPath)) {
    try {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      adminApp = initializeApp({
        credential: cert(serviceAccount),
      });
      console.log('Firebase Admin initialized with service-account.json file');
    } catch (e) {
      console.error('Failed to load service-account.json:', e);
      adminApp = initializeApp({
        credential: applicationDefault(),
        projectId: 'career-manager-8037a',
      });
    }
  } else {
    adminApp = initializeApp({
      credential: applicationDefault(),
      projectId: 'career-manager-8037a',
    });
  }
} else {
  adminApp = getApps()[0];
}

export const adminDb = getFirestore(adminApp);
adminDb.settings({ ignoreUndefinedProperties: true });

export const adminAuth = getAuth(adminApp);

export const adminMessaging = getMessaging(adminApp);
