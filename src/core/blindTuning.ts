import {
  formatNoteFa,
  getRecommendedTuning,
  noteToFrequency,
} from '../data/musicTheory';
import type {
  InstrumentId,
  KoronMode,
  PersianNoteSpec,
} from '../types/music';

export type BlindTuningDifficulty = 'beginner' | 'intermediate' | 'master';

export interface BlindTuningChallenge {
  id: string;
  instrument: InstrumentId;
  dastgahId: string;
  stringLabelFa: string;
  targetNote: PersianNoteSpec;
  targetNoteFa: string;
  targetHz: number;
  /** Hidden initial detune offset in cents (e.g. -28¢ or +34¢) */
  initialDetuneCents: number;
  difficulty: BlindTuningDifficulty;
  toleranceCents: number;
}

export interface BlindTuningOutcome {
  residualCents: number; // positive = still sharp, negative = still flat
  absErrorCents: number;
  passed: boolean;
  accuracyPercent: number;
  rankLabelFa: string;
  feedbackFa: string;
  xpAwarded: number;
}

/**
 * Deterministically creates a Blind Ear-Tuning challenge by taking a real string/bridge
 * of the active instrument & Dastgah and intentionally detuning it by a hidden offset.
 */
export function createBlindTuningChallenge(params: {
  instrument: InstrumentId;
  dastgahId: string;
  a4Hz: number;
  koronMode: KoronMode;
  difficulty: BlindTuningDifficulty;
  roundNumber: number;
}): BlindTuningChallenge {
  const { instrument, dastgahId, a4Hz, koronMode, difficulty, roundNumber } = params;
  const tuning = getRecommendedTuning(dastgahId, instrument);
  const chosen = tuning.strings[roundNumber % Math.max(1, tuning.strings.length)];

  const targetNote: PersianNoteSpec = chosen?.note ?? {
    letter: 'G',
    accidental: 'natural',
    octave: 4,
  };
  const targetHz = noteToFrequency(targetNote, a4Hz, koronMode);

  // Deterministic pseudo-random offset so challenges are varied yet cleanly testable
  const hash =
    (roundNumber * 37 + instrument.length * 19 + dastgahId.length * 13 + 7) % 100;
  const sign = hash % 2 === 0 ? 1 : -1;

  const [minOffset, maxOffset, tolerance] =
    difficulty === 'beginner'
      ? [22, 42, 8]
      : difficulty === 'intermediate'
      ? [14, 30, 5]
      : [8, 22, 2.5];

  const mag = minOffset + (hash % (maxOffset - minOffset + 1));
  const initialDetuneCents = sign * mag;

  return {
    id: `blind_${instrument}_${dastgahId}_${difficulty}_${roundNumber}`,
    instrument,
    dastgahId,
    stringLabelFa: chosen?.labelFa ?? 'سیم شاهد',
    targetNote,
    targetNoteFa: formatNoteFa(targetNote, true),
    targetHz,
    initialDetuneCents,
    difficulty,
    toleranceCents: tolerance,
  };
}

/**
 * Returns the live frequency (Hz) of the virtual detuned string given the user's peg adjustment (in cents).
 */
export function computeDetunedStringHz(
  challenge: BlindTuningChallenge,
  userPegOffsetCents: number
): number {
  const netCents = challenge.initialDetuneCents + userPegOffsetCents;
  return challenge.targetHz * Math.pow(2, netCents / 1200);
}

/**
 * Grades the student's blind ear-tuning submission without ever exposing the answer beforehand.
 */
export function evaluateBlindTuning(
  challenge: BlindTuningChallenge,
  userPegOffsetCents: number
): BlindTuningOutcome {
  const residualCents = Number(
    (challenge.initialDetuneCents + userPegOffsetCents).toFixed(1)
  );
  const absErrorCents = Math.abs(residualCents);
  const passed = absErrorCents <= challenge.toleranceCents;
  const accuracyPercent = Math.max(
    0,
    Math.min(100, Math.round(100 - absErrorCents * 2.8))
  );

  let rankLabelFa: string;
  let feedbackFa: string;
  if (absErrorCents <= 2.0) {
    rankLabelFa = 'گوش استادانه (هم‌کوک مطلق)';
    feedbackFa = `شگفت‌انگیز! خطای کوک شما تنها ${absErrorCents.toFixed(1)} سنت بود — در حد گوش کوک‌کننده حرفه‌ای کنسرواتوار.`;
  } else if (passed) {
    rankLabelFa = 'کوک دقیق و پذیرفته‌شده';
    feedbackFa = `آفرین! سیم را با دقت ${absErrorCents.toFixed(1)} سنت کوک کردید (حد مجاز این سطح: ±${challenge.toleranceCents} سنت).`;
  } else {
    const dirFa = residualCents > 0 ? 'تیز (زیرتر)' : 'بم (پایین‌تر)';
    rankLabelFa = 'نیاز به تمرین بیشتر گوش';
    feedbackFa = `سیم همچنان ${absErrorCents.toFixed(1)} سنت ${dirFa} از نت مرجع «${challenge.targetNoteFa}» بود. به ضربان (Beating) دو صدا هنگام هم‌زمان شنیدن دقت کنید.`;
  }

  return {
    residualCents,
    absErrorCents,
    passed,
    accuracyPercent,
    rankLabelFa,
    feedbackFa,
    xpAwarded: absErrorCents <= 2.0 ? 35 : passed ? 20 : 5,
  };
}
