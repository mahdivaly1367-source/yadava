export interface BreathLabMetrics {
  isSustaining: boolean;
  currentSustainSec: number;
  bestSustainSec: number;
  currentDb: number;
  dynamicStabilityPercent: number; // 0..100 (100 = rock-steady breath/bow pressure)
  tahrirRateHz: number;
  tahrirZoneStatus: 'idle' | 'too_slow' | 'ideal' | 'too_fast';
  tahrirFeedbackFa: string;
}

export const TAHRIR_IDEAL_MIN_HZ = 5.5;
export const TAHRIR_IDEAL_MAX_HZ = 6.8;

/**
 * Deterministic Long-Tone Breath, Dynamic Stability (dBFS) & Tahrir Rate Tracker.
 * Designed for Persian vocalists (آواز), Ney, and Kamancheh players.
 */
export class BreathLongToneTracker {
  private sustainStartMs: number | null = null;
  private bestSec: number;
  private readonly dbWindow: number[] = [];
  private readonly maxWindowSamples: number;

  constructor(initialBestSec = 0, maxWindowSamples = 45) {
    this.bestSec = Math.max(0, initialBestSec);
    this.maxWindowSamples = maxWindowSamples;
  }

  reset(keepBest = true): void {
    this.sustainStartMs = null;
    this.dbWindow.length = 0;
    if (!keepBest) this.bestSec = 0;
  }

  update(params: {
    rms: number;
    tahrirRateHz: number;
    nowMs: number;
    thresholdDb?: number;
  }): BreathLabMetrics {
    const thresholdDb = params.thresholdDb ?? -42;
    const currentDb = Math.max(
      -96,
      Math.min(0, Math.round(20 * Math.log10(Math.max(1e-5, params.rms)) * 10) / 10)
    );
    const isActive = currentDb > thresholdDb;

    let currentSustainSec = 0;
    if (isActive) {
      if (this.sustainStartMs === null) {
        this.sustainStartMs = params.nowMs;
        this.dbWindow.length = 0;
      }
      currentSustainSec =
        Math.round(((params.nowMs - this.sustainStartMs) / 1000) * 10) / 10;
      if (currentSustainSec > this.bestSec) {
        this.bestSec = currentSustainSec;
      }
      this.dbWindow.push(currentDb);
      if (this.dbWindow.length > this.maxWindowSamples) {
        this.dbWindow.shift();
      }
    } else {
      this.sustainStartMs = null;
    }

    // Dynamic stability: low dB standard deviation => steady diaphragm/bow pressure!
    let dynamicStabilityPercent = 0;
    if (this.dbWindow.length >= 4) {
      const mean = this.dbWindow.reduce((a, b) => a + b, 0) / this.dbWindow.length;
      const variance =
        this.dbWindow.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) /
        this.dbWindow.length;
      const stdDevDb = Math.sqrt(variance);
      // 0 dB stdDev -> 100%, 10 dB stdDev -> ~20%
      dynamicStabilityPercent = Math.max(
        10,
        Math.min(100, Math.round(100 - stdDevDb * 8))
      );
    }

    // Tahrir oscillation zone evaluation (authentic Iranian vocal/ney tahrir: 5.5 - 6.8 Hz)
    const rate = Math.round(params.tahrirRateHz * 10) / 10;
    let tahrirZoneStatus: BreathLabMetrics['tahrirZoneStatus'] = 'idle';
    let tahrirFeedbackFa = 'در انتظار تحریر پیوسته (محدوده طلایی ۵.۵ تا ۶.۸ هرتز)';
    if (rate >= 2.5) {
      if (rate < TAHRIR_IDEAL_MIN_HZ) {
        tahrirZoneStatus = 'too_slow';
        tahrirFeedbackFa = `نرخ تحریر (${rate} Hz) اندکی کند است؛ سرعت غلت حنجره/نفس را کمی افزایش دهید.`;
      } else if (rate <= TAHRIR_IDEAL_MAX_HZ) {
        tahrirZoneStatus = 'ideal';
        tahrirFeedbackFa = `عالی! نرخ تحریر (${rate} Hz) دقیقاً در محدوده استاندارد آواز اصیل ایرانی است.`;
      } else {
        tahrirZoneStatus = 'too_fast';
        tahrirFeedbackFa = `نرخ تحریر (${rate} Hz) کمی تند (لرزشی) است؛ نفس را آرام‌تر و عمیق‌تر کنید.`;
      }
    }

    return {
      isSustaining: isActive,
      currentSustainSec,
      bestSustainSec: Math.round(this.bestSec * 10) / 10,
      currentDb,
      dynamicStabilityPercent,
      tahrirRateHz: rate,
      tahrirZoneStatus,
      tahrirFeedbackFa,
    };
  }
}
