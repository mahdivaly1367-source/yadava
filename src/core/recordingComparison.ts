import type { SavedRecordingMeta } from '../types/music';

export interface RecordingComparisonSummary {
  earlier: SavedRecordingMeta;
  later: SavedRecordingMeta;
  accuracyDelta: number; // positive = improved
  estimatedCentsErrorEarlier: number;
  estimatedCentsErrorLater: number;
  centsErrorReduction: number; // positive = lower error (better!)
  rmsDeltaDb: number;
  envelopeStabilityEarlier: number; // 0..100
  envelopeStabilityLater: number;   // 0..100
  stabilityDelta: number;
  verdictFa: string;
}

function estimateCentsFromAccuracy(acc: number): number {
  return Math.max(1, Math.round(((100 - Math.min(100, Math.max(0, acc))) / 100) * 50 * 10) / 10);
}

function computeEnvelopeStability(envelope: number[]): number {
  if (!envelope || envelope.length < 3) return 70;
  const mean = envelope.reduce((a, b) => a + b, 0) / envelope.length;
  if (mean <= 0.001) return 50;
  const variance =
    envelope.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / envelope.length;
  const cv = Math.sqrt(variance) / mean;
  return Math.max(20, Math.min(100, Math.round(100 - cv * 48)));
}

/**
 * Compares an earlier recording against a later recording (Before vs After)
 * so learners see measurable cent-error reduction and envelope/breath stability gain.
 */
export function compareRecordings(
  recA: SavedRecordingMeta,
  recB: SavedRecordingMeta
): RecordingComparisonSummary {
  const [earlier, later] = recA.createdAt <= recB.createdAt ? [recA, recB] : [recB, recA];

  const accuracyDelta = Math.round((later.avgAccuracy - earlier.avgAccuracy) * 10) / 10;
  const errEarlier = estimateCentsFromAccuracy(earlier.avgAccuracy);
  const errLater = estimateCentsFromAccuracy(later.avgAccuracy);
  const centsErrorReduction = Math.round((errEarlier - errLater) * 10) / 10;
  const rmsDeltaDb = Math.round((later.rmsDb - earlier.rmsDb) * 10) / 10;

  const stabEarlier = computeEnvelopeStability(earlier.envelope);
  const stabLater = computeEnvelopeStability(later.envelope);
  const stabilityDelta = stabLater - stabEarlier;

  let verdictFa = 'روند تمرین پایدار است؛ با تکرار حلقه A–B دقت ربع‌پرده بیشتر هم می‌شود.';
  if (accuracyDelta >= 5) {
    verdictFa = `پیشرفت چشمگیر! دقت کوک شما ${accuracyDelta}٪ افزایش یافته و خطای سنت ${Math.abs(centsErrorReduction)} سنت کاهش پیدا کرده است.`;
  } else if (accuracyDelta > 0) {
    verdictFa = `بهبود مثبت در اجرای جدیدتر (+${accuracyDelta}٪ دقت کوک و کاهش خطای کوک).`;
  } else if (accuracyDelta < -3) {
    verdictFa =
      'اجرای جدیدتر اندکی نوسان بیشتری داشت؛ پیشنهاد می‌شود سرعت را به ۸۰٪ کاهش داده و با واخوان (Drone) تمرین کنید.';
  }

  return {
    earlier,
    later,
    accuracyDelta,
    estimatedCentsErrorEarlier: errEarlier,
    estimatedCentsErrorLater: errLater,
    centsErrorReduction,
    rmsDeltaDb,
    envelopeStabilityEarlier: stabEarlier,
    envelopeStabilityLater: stabLater,
    stabilityDelta,
    verdictFa,
  };
}

export interface ProgressTimelinePoint {
  id: string;
  title: string;
  createdAt: number;
  avgAccuracy: number;
  estimatedCentsError: number;
}

export function buildRecordingTimeline(
  recordings: SavedRecordingMeta[],
  gushehId?: string
): ProgressTimelinePoint[] {
  const filtered = gushehId
    ? recordings.filter((r) => r.gushehId === gushehId)
    : recordings;
  return [...filtered]
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((r) => ({
      id: r.id,
      title: r.title,
      createdAt: r.createdAt,
      avgAccuracy: r.avgAccuracy,
      estimatedCentsError: estimateCentsFromAccuracy(r.avgAccuracy),
    }));
}
