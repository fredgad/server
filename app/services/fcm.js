import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let initialized = false;

const loadCredential = () => {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    const json = Buffer.from(
      process.env.FIREBASE_SERVICE_ACCOUNT_BASE64,
      'base64'
    ).toString('utf8');
    return JSON.parse(json);
  }

  const explicitPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    path.resolve(process.cwd(), 'firebase-service-account.json');

  if (fs.existsSync(explicitPath)) {
    return JSON.parse(fs.readFileSync(explicitPath, 'utf-8'));
  }

  const localPath = path.resolve(
    __dirname,
    '../../firebase-service-account.json'
  );
  if (fs.existsSync(localPath)) {
    return JSON.parse(fs.readFileSync(localPath, 'utf-8'));
  }

  return null;
};

export const initFirebaseAdmin = () => {
  if (initialized) return true;
  const cred = loadCredential();
  if (!cred) {
    console.warn(
      '⚠️ Firebase service account not found. Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT_BASE64.'
    );
    return false;
  }

  admin.initializeApp({
    credential: admin.credential.cert(cred),
  });
  initialized = true;
  console.log('✅ Firebase Admin initialized');
  return true;
};

export const sendFcm = async ({ token, title, body, data = {} }) => {
  if (!initialized && !initFirebaseAdmin()) {
    throw new Error('Firebase Admin not initialized');
  }

  const payload = {
    token,
    notification: { title, body },
    data: Object.entries(data).reduce((acc, [k, v]) => {
      acc[k] = v == null ? '' : String(v);
      return acc;
    }, {}),
  };

  return admin.messaging().send(payload);
};
