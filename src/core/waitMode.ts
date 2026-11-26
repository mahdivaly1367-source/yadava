import { noteToFrequency } from '../data/musicTheory';
import type { KoronMode, MelodyNote } from '../types/music';

export interface WaitModeState {
  enabled: boolean;
  startIndex: number;
  endIndex: number;
  currentIndex: number;
  toleranceCents: number;
  requiredHoldMs: number;
  holdStartedAtMs: number | null;
  holdProgress: number; // 0..1
  completedSteps: number;
  totalSteps: number;
  isComplete: boolean;
  lastErrorCents: number | null;
}

export function createWaitModeState(
  startIndex: number,
  endIndex: number,
  toleranceCents = 22,
  requiredHoldMs = 220
): WaitModeState {
  const safeStart = Math.max(0, startIndex);
  const safeEnd = Math.max(safeStart, endIndex);
  return {
    enabled: false,
    startIndex: safeStart,
    endIndex: safeEnd,
    currentIndex: safeStart,
    toleranceCents,
    requiredHoldMs,
    holdStartedAtMs: null,
    holdProgress: 0,
    completedSteps: 0,
    totalSteps: safeEnd - safeStart + 1,
    isComplete: false,
    lastErrorCents: null,
  };
}

/**
 * Pure deterministic Wait Mode ("صبر کن تا درست بنوازی") evaluator.
 * Advances step-by-step only when the learner sustains the target Persian note
 * (exact octave or octave-equivalent pitch class within `toleranceCents`) for `requiredHoldMs`.
 */
export function evaluateWaitModeStep(
  state: WaitModeState,
  melody: MelodyNote[],
  detectedFreqHz: number | null,
  nowMs: number,
  a4Hz = 440,
  koronMode: KoronMode = 'standard_50'
): { nextState: WaitModeState; advanced: boolean; completedLoop: boolean } {
  if (!state.enabled || state.isComplete || melody.length === 0) {
    return { nextState: state, advanced: false, completedLoop: false };
  }

  const targetNote = melody[state.currentIndex];
  if (!targetNote) {
    return { nextState: { ...state, isComplete: true }, advanced: false, completedLoop: true };
  }

  if (detectedFreqHz === null || !Number.isFinite(detectedFreqHz) || detectedFreqHz <= 0) {
    return {
      nextState: {
        ...state,
        holdStartedAtMs: null,
        holdProgress: 0,
        lastErrorCents: null,
      },
      advanced: false,
      completedLoop: false,
    };
  }

  const targetFreq = noteToFrequency(targetNote, a4Hz, koronMode);
  // Allow octave-folded pitch matching so singers of any vocal range can pass cleanly
  let centsDiff = 1200 * Math.log2(detectedFreqHz / targetFreq);
  centsDiff = ((centsDiff + 600) % 1200 + 1200) % 1200 - 600;
  const roundedErr = Math.round(centsDiff * 10) / 10;

  if (Math.abs(centsDiff) <= state.toleranceCents) {
    const startedAt = state.holdStartedAtMs ?? nowMs;
    const heldMs = Math.max(0, nowMs - startedAt);
    const progress = Math.min(1, heldMs / Math.max(1, state.requiredHoldMs));

    if (heldMs >= state.requiredHoldMs) {
      const nextIdx = state.currentIndex + 1;
      const done = nextIdx > state.endIndex;
      return {
        nextState: {
          ...state,
          currentIndex: done ? state.endIndex : nextIdx,
          holdStartedAtMs: null,
          holdProgress: 0,
          completedSteps: state.completedSteps + 1,
          isComplete: done,
          lastErrorCents: roundedErr,
        },
        advanced: true,
        completedLoop: done,
      };
    }

    return {
      nextState: {
        ...state,
        holdStartedAtMs: startedAt,
        holdProgress: progress,
        lastErrorCents: roundedErr,
      },
      advanced: false,
      completedLoop: false,
    };
  }

  return {
    nextState: {
      ...state,
      holdStartedAtMs: null,
      holdProgress: 0,
      lastErrorCents: roundedErr,
    },
    advanced: false,
    completedLoop: false,
  };
}
