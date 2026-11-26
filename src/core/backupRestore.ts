import type {
  CustomTemperamentProfile,
  UserLearningState,
} from '../types/music';
import {
  BUILTIN_TEMPERAMENT_PROFILES,
  loadScopedTemperament,
  saveScopedTemperament,
} from './temperament';

export interface NavanegarBackupPayloadV2 {
  schema: 'navanegar.backup.v2';
  exportedAt: number;
  appVersion: '1.0.0';
  userState: UserLearningState;
  temperament: CustomTemperamentProfile;
  customGroovesJson?: string | null;
}

export const CUSTOM_GROOVES_STORAGE_PREFIX = 'navanegar_custom_grooves::';

/**
 * Exports the active scoped account's entire offline progress (sessions, SM-2 cards,
 * ear training stats, streak freezes, learning path progress, custom temperament & grooves).
 */
export function buildFullOfflineBackupJson(
  userState: UserLearningState
): string {
  const temperament = loadScopedTemperament(userState.ownerUid);
  let customGroovesJson: string | null = null;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      customGroovesJson = window.localStorage.getItem(
        `${CUSTOM_GROOVES_STORAGE_PREFIX}${userState.ownerUid}`
      );
    } catch {
      customGroovesJson = null;
    }
  }

  const payload: NavanegarBackupPayloadV2 = {
    schema: 'navanegar.backup.v2',
    exportedAt: Date.now(),
    appVersion: '1.0.0',
    userState,
    temperament,
    customGroovesJson,
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * Validates and safely imports a JSON backup file into the CURRENT active `targetOwnerUid`,
 * rewriting all ownerUid references defensively so cross-user data leaks are impossible!
 */
export function parseAndSanitizeBackupJson(
  rawJson: string,
  targetOwnerUid: string
): {
  ok: true;
  userState: UserLearningState;
  temperament: CustomTemperamentProfile;
  customGroovesJson: string | null;
  summaryFa: string;
} | { ok: false; errorFa: string } {
  try {
    const parsed = JSON.parse(rawJson) as Partial<NavanegarBackupPayloadV2>;
    if (parsed.schema !== 'navanegar.backup.v2' || !parsed.userState) {
      return {
        ok: false,
        errorFa: 'قالب فایل پشتیبان معتبر نیست (فایل باید از نسخه پشتیبان نوانگار باشد).',
      };
    }

    const src = parsed.userState;
    if (!Array.isArray(src.sessions) || typeof src.srsCards !== 'object') {
      return {
        ok: false,
        errorFa: 'ساختار داده‌های تمرین در فایل پشتیبان ناقص است.',
      };
    }

    const safeUid = targetOwnerUid.trim() || 'guest';
    const sanitizedState: UserLearningState = {
      ...src,
      ownerUid: safeUid,
      recordings: Array.isArray(src.recordings)
        ? src.recordings.map((r) => ({
            ...r,
            ownerUid: safeUid,
            hasLocalAudio: false, // binary blobs live in IndexedDB on original device
          }))
        : [],
      updatedAt: Date.now(),
    };

    const temperament: CustomTemperamentProfile =
      parsed.temperament && typeof parsed.temperament.koronCents === 'number'
        ? parsed.temperament
        : BUILTIN_TEMPERAMENT_PROFILES[0];

    saveScopedTemperament(safeUid, temperament);

    const customGroovesJson =
      typeof parsed.customGroovesJson === 'string' ? parsed.customGroovesJson : null;
    if (
      customGroovesJson &&
      typeof window !== 'undefined' &&
      window.localStorage
    ) {
      try {
        window.localStorage.setItem(
          `${CUSTOM_GROOVES_STORAGE_PREFIX}${safeUid}`,
          customGroovesJson
        );
      } catch {
        // ignore quota errors
      }
    }

    return {
      ok: true,
      userState: sanitizedState,
      temperament,
      customGroovesJson,
      summaryFa: `پشتیبان با موفقیت بازیابی شد (${sanitizedState.sessions.length} جلسه تمرین، ${Object.keys(sanitizedState.srsCards).length} کارت SM-2 و تنظیمات کوک).`,
    };
  } catch {
    return {
      ok: false,
      errorFa: 'خواندن فایل JSON با خطا مواجه شد. مطمئن شوید فایل سالم است.',
    };
  }
}
