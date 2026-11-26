import type { UserLearningState } from '../types/music';
import { getTodayDateKey } from '../utils/persian';

export const GUEST_OWNER_UID = 'guest';

const STATE_STORAGE_PREFIX = 'navanegar_user_state::';

export function createEmptyUserState(
  ownerUid: string,
  displayName?: string,
  now = Date.now()
): UserLearningState {
  const safeUid = ownerUid.trim() || GUEST_OWNER_UID;
  return {
    ownerUid: safeUid,
    displayName: displayName || (safeUid === GUEST_OWNER_UID ? 'هنرجوی مهمان' : 'هنرجوی نوانگار'),
    level: 'beginner',
    totalPracticeMinutes: 0,
    streakDays: 0,
    streakFreezesRemaining: 2,
    frozenDateKeys: [],
    earTrainingStats: {
      totalAnswered: 0,
      totalCorrect: 0,
      bestStreak: 0,
      completedSessions: 0,
    },
    completedChallengeIds: [],
    completedPathStepIds: [],
    bestBreathSeconds: 0,
    averageAccuracy: 0,
    weakIntervals: ['koron', 'foroud'],
    badges: [],
    placementCompleted: false,
    srsCards: {},
    sessions: [],
    recordings: [],
    lastPlacement: null,
    dailyCompletedSteps: [],
    dailyPlanDateKey: getTodayDateKey(now),
    updatedAt: now,
  };
}

export function stateStorageKey(ownerUid: string): string {
  return `${STATE_STORAGE_PREFIX}${ownerUid.trim() || GUEST_OWNER_UID}`;
}

export function loadScopedUserState(
  ownerUid: string,
  displayName?: string
): UserLearningState {
  const safeUid = ownerUid.trim() || GUEST_OWNER_UID;
  const fallback = createEmptyUserState(safeUid, displayName);
  if (typeof window === 'undefined' || !window.localStorage) {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(stateStorageKey(safeUid));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<UserLearningState>;
    // Enforce strict ownerUid matching — never hydrate mismatched user records
    if (parsed.ownerUid !== safeUid) {
      return fallback;
    }
    const today = getTodayDateKey();
    return {
      ...fallback,
      ...parsed,
      ownerUid: safeUid,
      displayName: displayName || parsed.displayName || fallback.displayName,
      dailyCompletedSteps:
        parsed.dailyPlanDateKey === today && Array.isArray(parsed.dailyCompletedSteps)
          ? parsed.dailyCompletedSteps
          : [],
      dailyPlanDateKey: today,
      // Recordings belonging to another owner are stripped defensively
      recordings: Array.isArray(parsed.recordings)
        ? parsed.recordings.filter((r) => r.ownerUid === safeUid)
        : [],
    };
  } catch {
    return fallback;
  }
}

export function saveScopedUserState(state: UserLearningState): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(stateStorageKey(state.ownerUid), JSON.stringify(state));
  } catch {
    // Storage quota exceeded — state remains valid in memory
  }
}

/**
 * Tracks all Blob Object URLs created during the active user session and revokes
 * EVERY one of them immediately on sign-out or account switch (A -> B).
 */
export class ObjectUrlRegistry {
  private readonly urls = new Set<string>();

  create(blob: Blob): string {
    const url = URL.createObjectURL(blob);
    this.urls.add(url);
    return url;
  }

  revoke(url: string): void {
    if (this.urls.has(url)) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
      this.urls.delete(url);
    }
  }

  revokeAll(): number {
    const count = this.urls.size;
    for (const url of this.urls) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
    }
    this.urls.clear();
    return count;
  }

  get activeCount(): number {
    return this.urls.size;
  }
}

/**
 * Atomic session epoch & AbortController coordinator.
 * Switching ownerUid (Guest -> A, A -> B, A -> Guest) immediately increments epoch
 * and aborts any pending network/sync tasks belonging to the previous account.
 */
export class SessionLifecycleController {
  private epoch = 0;
  private activeOwnerUid: string = GUEST_OWNER_UID;
  private abortController = new AbortController();
  public readonly objectUrls = new ObjectUrlRegistry();

  get ownerUid(): string {
    return this.activeOwnerUid;
  }

  get currentEpoch(): number {
    return this.epoch;
  }

  get signal(): AbortSignal {
    return this.abortController.signal;
  }

  isCurrent(ownerUid: string, capturedEpoch: number): boolean {
    return this.activeOwnerUid === ownerUid && this.epoch === capturedEpoch;
  }

  /**
   * Atomically transitions session ownership, aborting all pending sync operations
   * and revoking every Blob Object URL from the previous account.
   */
  switchOwner(nextOwnerUid: string): {
    previousOwnerUid: string;
    nextOwnerUid: string;
    epoch: number;
    revokedUrls: number;
    signal: AbortSignal;
  } {
    const safeNext = nextOwnerUid.trim() || GUEST_OWNER_UID;
    const previousOwnerUid = this.activeOwnerUid;

    // 1. Abort all in-flight async sync operations immediately
    this.abortController.abort();
    this.abortController = new AbortController();

    // 2. Revoke every ObjectURL immediately so audio blobs cannot leak across users
    const revokedUrls = this.objectUrls.revokeAll();

    // 3. Advance atomic session epoch & owner
    this.epoch += 1;
    this.activeOwnerUid = safeNext;

    return {
      previousOwnerUid,
      nextOwnerUid: safeNext,
      epoch: this.epoch,
      revokedUrls,
      signal: this.abortController.signal,
    };
  }
}
