import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  type Firestore,
} from 'firebase/firestore';

export const NAMED_FIRESTORE_DB_ID =
  (import.meta.env.VITE_FIREBASE_DATABASE_ID as string | undefined) || 'navanegar-db';

interface FirebaseRuntimeConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

function readFirebaseConfig(): FirebaseRuntimeConfig | null {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined;
  if (!apiKey || !projectId) {
    return null;
  }
  return {
    apiKey,
    authDomain:
      (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined) ||
      `${projectId}.firebaseapp.com`,
    projectId,
    storageBucket:
      (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined) ||
      `${projectId}.firebasestorage.app`,
    messagingSenderId:
      (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined) || '',
    appId: (import.meta.env.VITE_FIREBASE_APP_ID as string | undefined) || '',
  };
}

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;
let cachedDb: Firestore | null = null;

export function isFirebaseConfigured(): boolean {
  return readFirebaseConfig() !== null;
}

export function getFirebaseServices(): {
  app: FirebaseApp | null;
  auth: Auth | null;
  db: Firestore | null;
} {
  const cfg = readFirebaseConfig();
  if (!cfg) {
    return { app: null, auth: null, db: null };
  }

  if (!cachedApp) {
    cachedApp = getApps().length > 0 ? getApps()[0] : initializeApp(cfg);
  }

  if (!cachedAuth) {
    cachedAuth = getAuth(cachedApp);
  }

  if (!cachedDb) {
    try {
      // Named Firestore database with experimentalForceLongPolling enabled for
      // maximum reliability behind Iranian mobile networks, proxies, and Android WebView.
      cachedDb = initializeFirestore(
        cachedApp,
        {
          experimentalForceLongPolling: true,
        },
        NAMED_FIRESTORE_DB_ID
      );
    } catch {
      // Fallback if already initialized in HMR
      cachedDb = getFirestore(cachedApp, NAMED_FIRESTORE_DB_ID);
    }
  }

  return { app: cachedApp, auth: cachedAuth, db: cachedDb };
}

export interface HandledFirestoreError {
  code: string;
  isOffline: boolean;
  isPermissionDenied: boolean;
  messageFa: string;
  context: string;
}

/**
 * Unified Firestore error handler.
 * Specifically detects network `unavailable` errors so CommunityView and sync hooks
 * display a clear Persian offline notice without ever crashing the application.
 */
export function handleFirestoreError(err: unknown, context: string): HandledFirestoreError {
  const errObj = err as { code?: string; message?: string } | null;
  const rawCode = String(errObj?.code ?? 'unknown').toLowerCase();
  const rawMessage = String(errObj?.message ?? '').toLowerCase();

  const isOffline =
    rawCode.includes('unavailable') ||
    rawCode.includes('network-request-failed') ||
    rawMessage.includes('client is offline') ||
    rawMessage.includes('failed to get document') ||
    (typeof navigator !== 'undefined' && navigator.onLine === false);

  const isPermissionDenied =
    rawCode.includes('permission-denied') || rawCode.includes('unauthenticated');

  let messageFa = 'خطا در ارتباط با فضای ابری نوانگار. حالت آفلاین همچنان فعال است.';
  if (isOffline) {
    messageFa =
      'اتصال اینترنت یا سرور ابری در دسترس نیست (unavailable). ابزارهای تمرین، تیونر، مترونوم و ردیف به‌صورت کامل آفلاین کار می‌کنند.';
  } else if (rawCode.includes('permission-denied')) {
    messageFa = 'دسترسی امنیتی به این داده مجاز نیست. لطفاً وضعیت ورود حساب خود را بررسی کنید.';
  } else if (rawCode.includes('unauthenticated')) {
    messageFa = 'برای انجام این عملیات ابتدا وارد حساب کاربری خود شوید.';
  } else if (rawCode.includes('failed-precondition')) {
    messageFa = 'شرایط همگام‌سازی این عملیات برقرار نیست؛ لطفاً دوباره تلاش کنید.';
  } else if (rawCode.includes('not-found')) {
    messageFa = 'مورد درخواستی در پایگاه داده یافت نشد.';
  }

  return {
    code: isOffline ? 'unavailable' : rawCode,
    isOffline,
    isPermissionDenied,
    messageFa,
    context,
  };
}

/**
 * Signs in with Google:
 * - On Capacitor Android: uses native `@capacitor-firebase/authentication` (`rgcfaIncludeGoogle = true`)
 *   and bridges the returned `idToken` into Firebase Web Auth via `GoogleAuthProvider.credential(idToken)`.
 * - On Web: uses Firebase `signInWithPopup(auth, GoogleAuthProvider)`.
 */
export async function signInWithGoogleUnified(): Promise<User> {
  const { auth } = getFirebaseServices();
  if (!auth) {
    throw new Error(
      'پیکربندی ابری Firebase هنوز تنظیم نشده است. می‌توانید از حالت مهمان یا حساب آزمایشی محلی استفاده کنید.'
    );
  }

  if (Capacitor.isNativePlatform()) {
    const result = await FirebaseAuthentication.signInWithGoogle();
    const idToken = result.credential?.idToken;
    if (!idToken) {
      throw new Error('توکن احراز هویت گوگل از سرویس بومی اندروید دریافت نشد.');
    }
    const credential = GoogleAuthProvider.credential(idToken);
    const userCred = await signInWithCredential(auth, credential);
    return userCred.user;
  }

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const userCred = await signInWithPopup(auth, provider);
  return userCred.user;
}

export async function signOutUnified(): Promise<void> {
  const { auth } = getFirebaseServices();
  if (Capacitor.isNativePlatform()) {
    try {
      await FirebaseAuthentication.signOut();
    } catch {
      // ignore if native session already cleared
    }
  }
  if (auth) {
    await signOut(auth);
  }
}
