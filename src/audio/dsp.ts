import { frequencyToPersianNote, noteToFrequency } from '../data/musicTheory';
import type {
  HarmonicPeak,
  KoronMode,
  PersianNoteSpec,
  PitchAnalysisFrame,
} from '../types/music';

export interface YinResult {
  frequency: number | null;
  clarity: number;
  rms: number;
}

/**
 * Deterministic YIN Pitch Detection Algorithm (de Cheveigné & Kawahara, 2002)
 * with Cumulative Mean Normalized Difference Function (CMNDF) and parabolic interpolation.
 */
export function detectPitchYin(
  buffer: Float32Array,
  sampleRate: number,
  options?: {
    minFreq?: number;
    maxFreq?: number;
    threshold?: number;
    rmsThreshold?: number;
  }
): YinResult {
  const minFreq = options?.minFreq ?? 70;
  const maxFreq = options?.maxFreq ?? 1400;
  const threshold = options?.threshold ?? 0.16;
  const rmsThreshold = options?.rmsThreshold ?? 0.01;

  const size = buffer.length;
  let sumSq = 0;
  for (let i = 0; i < size; i++) {
    sumSq += buffer[i] * buffer[i];
  }
  const rms = Math.sqrt(sumSq / size);
  if (rms < rmsThreshold) {
    return { frequency: null, clarity: 0, rms };
  }

  const minTau = Math.max(2, Math.floor(sampleRate / maxFreq));
  const maxTau = Math.min(Math.floor(size / 2) - 1, Math.ceil(sampleRate / minFreq));
  if (maxTau <= minTau) {
    return { frequency: null, clarity: 0, rms };
  }

  const diff = new Float32Array(maxTau + 1);
  const cmndf = new Float32Array(maxTau + 1);
  cmndf[0] = 1;

  let runningSum = 0;
  for (let tau = 1; tau <= maxTau; tau++) {
    let acc = 0;
    const limit = size - tau;
    for (let i = 0; i < limit; i++) {
      const delta = buffer[i] - buffer[i + tau];
      acc += delta * delta;
    }
    diff[tau] = acc;
    runningSum += acc;
    cmndf[tau] = runningSum > 0 ? (acc * tau) / runningSum : 1;
  }

  // Absolute threshold search for first local minimum below threshold
  let tauEstimate = -1;
  for (let tau = minTau; tau <= maxTau; tau++) {
    if (cmndf[tau] < threshold) {
      while (tau + 1 <= maxTau && cmndf[tau + 1] < cmndf[tau]) {
        tau++;
      }
      tauEstimate = tau;
      break;
    }
  }

  // Fallback to global minimum if clarity is still reasonable (< 0.28)
  if (tauEstimate === -1) {
    let bestVal = 1;
    let bestIdx = -1;
    for (let tau = minTau; tau <= maxTau; tau++) {
      if (cmndf[tau] < bestVal) {
        bestVal = cmndf[tau];
        bestIdx = tau;
      }
    }
    if (bestIdx === -1 || bestVal > 0.28) {
      return { frequency: null, clarity: Math.max(0, 1 - bestVal), rms };
    }
    tauEstimate = bestIdx;
  }

  // Parabolic interpolation around tauEstimate for sub-cent precision
  let betterTau = tauEstimate;
  if (tauEstimate > 1 && tauEstimate < maxTau) {
    const s0 = cmndf[tauEstimate - 1];
    const s1 = cmndf[tauEstimate];
    const s2 = cmndf[tauEstimate + 1];
    const denom = 2 * s1 - s2 - s0;
    if (Math.abs(denom) > 1e-9) {
      betterTau = tauEstimate + (s2 - s0) / (2 * denom);
    }
  }

  const frequency = sampleRate / betterTau;
  const clarity = Math.max(0, Math.min(1, 1 - cmndf[tauEstimate]));

  if (!Number.isFinite(frequency) || frequency < minFreq || frequency > maxFreq) {
    return { frequency: null, clarity: 0, rms };
  }

  return { frequency, clarity, rms };
}

/**
 * Suppresses transient octave-flip errors (2x or 0.5x harmonic locks) by comparing
 * against a rolling median window of recent pitch readings.
 */
export class OctaveContinuityFilter {
  private readonly history: number[] = [];
  private readonly maxHistory: number;

  constructor(maxHistory = 7) {
    this.maxHistory = maxHistory;
  }

  reset(): void {
    this.history.length = 0;
  }

  filter(rawFreq: number | null): number | null {
    if (rawFreq === null) {
      return null;
    }

    if (this.history.length < 3) {
      this.push(rawFreq);
      return rawFreq;
    }

    const sorted = [...this.history].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const ratio = rawFreq / median;

    let corrected = rawFreq;
    // Detect isolated 2x octave jump up or 0.5x jump down
    if (ratio > 1.88 && ratio < 2.12) {
      corrected = rawFreq / 2;
    } else if (ratio > 0.47 && ratio < 0.53) {
      corrected = rawFreq * 2;
    }

    this.push(corrected);
    return corrected;
  }

  private push(freq: number): void {
    this.history.push(freq);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }
}

interface PitchSamplePoint {
  timeMs: number;
  cents: number;
}

export interface TahrirDetectionState {
  detected: boolean;
  rateHz: number;
  depthCents: number;
}

/**
 * Deterministic Persian Tahrir Detector:
 * Tracks pitch contour over a rolling 900ms window, removes mean pitch,
 * and identifies periodic vocal/instrumental oscillations centered around ~6 Hz
 * (4.2 Hz – 8.5 Hz band) with authentic excursion depth (35 – 280 cents).
 */
export class TahrirDetector {
  private readonly points: PitchSamplePoint[] = [];
  private readonly windowMs: number;

  constructor(windowMs = 900) {
    this.windowMs = windowMs;
  }

  reset(): void {
    this.points.length = 0;
  }

  push(frequencyHz: number | null, timeMs: number): TahrirDetectionState {
    // Prune stale points
    while (this.points.length > 0 && timeMs - this.points[0].timeMs > this.windowMs) {
      this.points.shift();
    }

    if (frequencyHz !== null && frequencyHz > 50) {
      const cents = 1200 * Math.log2(frequencyHz / 440);
      this.points.push({ timeMs, cents });
    }

    return this.analyze();
  }

  analyze(): TahrirDetectionState {
    if (this.points.length < 10) {
      return { detected: false, rateHz: 0, depthCents: 0 };
    }

    const spanSec = (this.points[this.points.length - 1].timeMs - this.points[0].timeMs) / 1000;
    if (spanSec < 0.32) {
      return { detected: false, rateHz: 0, depthCents: 0 };
    }

    let mean = 0;
    for (const p of this.points) mean += p.cents;
    mean /= this.points.length;

    const centered = this.points.map((p) => p.cents - mean);
    let minVal = Infinity;
    let maxVal = -Infinity;
    for (const v of centered) {
      if (v < minVal) minVal = v;
      if (v > maxVal) maxVal = v;
    }
    const depthCents = maxVal - minVal;

    // Count upward zero-crossings with hysteresis to estimate oscillation frequency
    let crossings = 0;
    let lastSign = centered[0] >= 0 ? 1 : -1;
    for (let i = 1; i < centered.length; i++) {
      const v = centered[i];
      if (lastSign < 0 && v > 8) {
        crossings += 1;
        lastSign = 1;
      } else if (lastSign > 0 && v < -8) {
        lastSign = -1;
      }
    }

    const rateHz = Math.round((crossings / spanSec) * 10) / 10;
    const detected =
      crossings >= 2 &&
      rateHz >= 4.2 &&
      rateHz <= 8.5 &&
      depthCents >= 35 &&
      depthCents <= 280;

    return { detected, rateHz, depthCents: Math.round(depthCents) };
  }
}

/**
 * Evaluates Foroud (cadence resolution) quality (0..100%) based on how closely and stably
 * recent detected pitches land on the gusheh's target Ist / Shahed note (modulo octave).
 */
export function evaluateForoud(
  recentFrequencies: number[],
  targetIst: PersianNoteSpec,
  a4Hz = 440,
  koronMode: KoronMode = 'standard_50'
): number {
  const valid = recentFrequencies.filter((f) => Number.isFinite(f) && f > 50);
  if (valid.length === 0) return 0;

  const targetFreq = noteToFrequency(targetIst, a4Hz, koronMode);
  let totalScore = 0;
  let errorSum = 0;

  for (const f of valid) {
    // Wrap cents diff to closest octave (-600..+600)
    let diffCents = 1200 * Math.log2(f / targetFreq);
    diffCents = ((diffCents + 600) % 1200 + 1200) % 1200 - 600;
    const absErr = Math.abs(diffCents);
    errorSum += absErr;
    // Perfect within ±8 cents; decays gracefully up to ±60 cents
    const frameScore = absErr <= 8 ? 100 : Math.max(0, 100 - ((absErr - 8) / 52) * 100);
    totalScore += frameScore;
  }

  const avgScore = totalScore / valid.length;
  const meanErr = errorSum / valid.length;
  // Reward stability when resolving on the cadence note
  const stabilityBonus = meanErr < 15 && valid.length >= 4 ? 5 : 0;
  return Math.max(0, Math.min(100, Math.round(avgScore + stabilityBonus)));
}

/**
 * Extracts fundamental (f0) and harmonic peaks (2f0..5f0) from Web Audio FFT dB bins.
 */
export function extractHarmonics(
  freqDataDb: Float32Array,
  sampleRate: number,
  fftSize: number,
  fundamentalHz: number | null,
  maxHarmonics = 5
): HarmonicPeak[] {
  if (!fundamentalHz || fundamentalHz < 55) return [];
  const binHz = sampleRate / fftSize;
  const peaks: HarmonicPeak[] = [];

  for (let h = 1; h <= maxHarmonics; h++) {
    const expectedHz = fundamentalHz * h;
    if (expectedHz >= sampleRate / 2 - binHz) break;
    const centerBin = Math.round(expectedHz / binHz);
    const searchRadius = Math.max(1, Math.round((expectedHz * 0.03) / binHz));

    let bestBin = centerBin;
    let bestDb = -160;
    const start = Math.max(1, centerBin - searchRadius);
    const end = Math.min(freqDataDb.length - 1, centerBin + searchRadius);

    for (let b = start; b <= end; b++) {
      if (freqDataDb[b] > bestDb) {
        bestDb = freqDataDb[b];
        bestBin = b;
      }
    }

    peaks.push({
      harmonicNumber: h,
      frequencyHz: Math.round(bestBin * binHz * 10) / 10,
      magnitudeDb: Math.round(bestDb * 10) / 10,
    });
  }

  return peaks;
}

export type FourthOrderFilterMode = 'bypass' | 'lowpass' | 'bandpass';

export interface FourthOrderFilterChain {
  input: AudioNode;
  output: AudioNode;
  configure: (mode: FourthOrderFilterMode, cutoffHz: number, bandwidthQ?: number) => void;
  disconnect: () => void;
}

/**
 * Builds a true 4th-order Butterworth filter chain (24 dB/octave) by cascading two
 * 2nd-order BiquadFilterNodes with Butterworth Q factors (0.5412 and 1.3066).
 */
export function createFourthOrderFilterChain(ctx: AudioContext): FourthOrderFilterChain {
  const stage1 = ctx.createBiquadFilter();
  const stage2 = ctx.createBiquadFilter();
  stage1.connect(stage2);

  const configure = (mode: FourthOrderFilterMode, cutoffHz: number, bandwidthQ = 1.1) => {
    const safeFreq = Math.max(80, Math.min(ctx.sampleRate * 0.45, cutoffHz));
    if (mode === 'bypass') {
      stage1.type = 'allpass';
      stage2.type = 'allpass';
      stage1.frequency.setValueAtTime(1000, ctx.currentTime);
      stage2.frequency.setValueAtTime(1000, ctx.currentTime);
    } else if (mode === 'lowpass') {
      stage1.type = 'lowpass';
      stage2.type = 'lowpass';
      stage1.frequency.setValueAtTime(safeFreq, ctx.currentTime);
      stage2.frequency.setValueAtTime(safeFreq, ctx.currentTime);
      // 4th-order Butterworth pole Q values
      stage1.Q.setValueAtTime(0.5412, ctx.currentTime);
      stage2.Q.setValueAtTime(1.3066, ctx.currentTime);
    } else {
      stage1.type = 'bandpass';
      stage2.type = 'bandpass';
      stage1.frequency.setValueAtTime(safeFreq, ctx.currentTime);
      stage2.frequency.setValueAtTime(safeFreq, ctx.currentTime);
      stage1.Q.setValueAtTime(Math.max(0.5, bandwidthQ), ctx.currentTime);
      stage2.Q.setValueAtTime(Math.max(0.5, bandwidthQ), ctx.currentTime);
    }
  };

  configure('lowpass', 1800, 1.0);

  return {
    input: stage1,
    output: stage2,
    configure,
    disconnect: () => {
      try {
        stage1.disconnect();
        stage2.disconnect();
      } catch {
        // already disconnected
      }
    },
  };
}

/**
 * Full single-frame DSP pipeline helper combining YIN + Octave filter + Persian microtonal mapping
 * + Tahrir detection + Foroud scoring.
 */
export function analyzePitchFrame(params: {
  timeDomainBuffer: Float32Array;
  sampleRate: number;
  nowMs: number;
  a4Hz: number;
  koronMode: KoronMode;
  targetScale: PersianNoteSpec[];
  targetIst: PersianNoteSpec;
  octaveFilter: OctaveContinuityFilter;
  tahrirDetector: TahrirDetector;
  recentForoudFreqs: number[];
}): PitchAnalysisFrame {
  const yin = detectPitchYin(params.timeDomainBuffer, params.sampleRate);
  const stableFreq = params.octaveFilter.filter(yin.frequency);
  const tahrir = params.tahrirDetector.push(stableFreq, params.nowMs);

  if (stableFreq !== null) {
    params.recentForoudFreqs.push(stableFreq);
    if (params.recentForoudFreqs.length > 14) {
      params.recentForoudFreqs.shift();
    }
  }

  const foroudScore = evaluateForoud(
    params.recentForoudFreqs,
    params.targetIst,
    params.a4Hz,
    params.koronMode
  );

  if (stableFreq === null) {
    return {
      frequency: null,
      clarity: yin.clarity,
      rms: yin.rms,
      note: null,
      noteLabelFa: 'در انتظار صدا...',
      centsOffset: 0,
      tahrirDetected: tahrir.detected,
      tahrirRateHz: tahrir.rateHz,
      foroudScore,
    };
  }

  const matched = frequencyToPersianNote(
    stableFreq,
    params.a4Hz,
    params.koronMode,
    params.targetScale
  );

  return {
    frequency: Math.round(stableFreq * 10) / 10,
    clarity: yin.clarity,
    rms: yin.rms,
    note: matched.note,
    noteLabelFa: matched.labelFa,
    centsOffset: matched.centsOffset,
    tahrirDetected: tahrir.detected,
    tahrirRateHz: tahrir.rateHz,
    foroudScore,
  };
}
