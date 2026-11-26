/**
 * Safe Screen Wake Lock API wrapper for Landscape Music-Stand Mode.
 * Prevents phones/tablets from dimming or locking while placed on a music stand.
 */

interface WakeLockSentinelLike {
  released: boolean;
  release: () => Promise<void>;
}

type NavigatorWithWakeLock = Omit<Navigator, 'wakeLock'> & {
  wakeLock?: {
    request: (type: 'screen') => Promise<WakeLockSentinelLike>;
  };
};

export interface WakeLockController {
  isSupported: boolean;
  isActive: () => boolean;
  acquire: () => Promise<boolean>;
  release: () => Promise<void>;
}

export function isWakeLockSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'wakeLock' in navigator &&
    typeof (navigator as NavigatorWithWakeLock).wakeLock?.request === 'function'
  );
}

export function createWakeLockController(): WakeLockController {
  let sentinel: WakeLockSentinelLike | null = null;

  const acquire = async (): Promise<boolean> => {
    if (!isWakeLockSupported()) return false;
    try {
      const nav = navigator as NavigatorWithWakeLock;
      sentinel = (await nav.wakeLock?.request('screen')) ?? null;
      return Boolean(sentinel && !sentinel.released);
    } catch {
      sentinel = null;
      return false;
    }
  };

  const release = async (): Promise<void> => {
    if (!sentinel) return;
    try {
      await sentinel.release();
    } catch {
      // ignore release errors on backgrounded tabs
    }
    sentinel = null;
  };

  return {
    isSupported: isWakeLockSupported(),
    isActive: () => Boolean(sentinel && !sentinel.released),
    acquire,
    release,
  };
}
