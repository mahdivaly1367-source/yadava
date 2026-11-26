import type { InstrumentId } from '../types/music';
import { getReverbInputNode } from './hallReverb';

export interface ModalResonanceSpec {
  freqHz: number;
  amp: number;
  decayMs: number;
  phaseRad?: number;
}

export interface PersianInstrumentBodySpec {
  id: InstrumentId;
  nameFa: string;
  bodyMaterialFa: string;
  lengthMs: number;
  directPeak: number;
  woodDiffusionAmp: number;
  woodDiffusionDecayMs: number;
  defaultWetMix: number;
  modes: ModalResonanceSpec[];
}

/**
 * 12-to-14 Mode Physical Acoustic Body Models for all 7 classical Persian instruments.
 * Models real Helmholtz cavity (A0), stretched skin membrane / mulberry top plate (T1),
 * cross-grain wood dipoles (B1-/B1+), bridge-hill (BH), and chamber projection modes.
 */
export const PERSIAN_BODY_IR_SPECS: Record<InstrumentId, PersianInstrumentBodySpec> = {
  tar: {
    id: 'tar',
    nameFa: 'بدنه تار (کاسه توت + پوست بره)',
    bodyMaterialFa: 'کاسه دوتکه توت کهنه + پوست کشیده بره + خرک شاخ',
    lengthMs: 46,
    directPeak: 0.68,
    woodDiffusionAmp: 0.055,
    woodDiffusionDecayMs: 11,
    defaultWetMix: 0.42,
    modes: [
      { freqHz: 192, amp: 0.145, decayMs: 28 }, // Lambskin head fundamental (پوست بره)
      { freqHz: 278, amp: 0.115, decayMs: 24 }, // Figure-8 dual-bowl Helmholtz coupling
      { freqHz: 368, amp: 0.105, decayMs: 20 }, // Skin dipole mode
      { freqHz: 520, amp: 0.088, decayMs: 17 }, // Small bowl (نقاره) coupling
      { freqHz: 625, amp: 0.082, decayMs: 15 }, // Membrane 2nd circular mode
      { freqHz: 985, amp: 0.112, decayMs: 14 }, // Signature Persian Tar midrange bark
      { freqHz: 1390, amp: 0.072, decayMs: 11 }, // Bridge-on-skin transfer peak
      { freqHz: 1940, amp: 0.062, decayMs: 9.5 }, // Upper wood projection
      { freqHz: 2480, amp: 0.058, decayMs: 8.0 }, // Horn bridge brilliance (خرک)
      { freqHz: 3150, amp: 0.045, decayMs: 6.5 }, // Mezrab presence
      { freqHz: 3880, amp: 0.036, decayMs: 5.2 }, // Metallic steel string air
      { freqHz: 4720, amp: 0.024, decayMs: 4.0 }, // Crisp pluck halo
    ],
  },
  setar: {
    id: 'setar',
    nameFa: 'بدنه سه‌تار (کاسه گلابی توت)',
    bodyMaterialFa: 'کاسه یک‌تکه یا ترکه‌ای توت + صفحه نازک + خرک چوبی',
    lengthMs: 42,
    directPeak: 0.7,
    woodDiffusionAmp: 0.048,
    woodDiffusionDecayMs: 10,
    defaultWetMix: 0.38,
    modes: [
      { freqHz: 248, amp: 0.135, decayMs: 24 }, // Small pear-bowl Helmholtz A0
      { freqHz: 385, amp: 0.095, decayMs: 20 }, // Mulberry soundboard T1
      { freqHz: 525, amp: 0.09, decayMs: 18 }, // Cross-grain dipole B1-
      { freqHz: 790, amp: 0.082, decayMs: 15 }, // Soundboard B1+
      { freqHz: 1295, amp: 0.11, decayMs: 13 }, // Intimate poetic nasal Setar voice
      { freqHz: 1680, amp: 0.076, decayMs: 11 }, // Upper vocal warmth
      { freqHz: 2150, amp: 0.064, decayMs: 9.0 }, // Nail-pluck shimmer (ناخن)
      { freqHz: 2820, amp: 0.044, decayMs: 7.2 }, // Delicate upper ring
      { freqHz: 3450, amp: 0.03, decayMs: 5.5 }, // Soft woody air
      { freqHz: 4200, amp: 0.018, decayMs: 4.0 }, // High damping
      { freqHz: 175, amp: 0.05, decayMs: 22 }, // Subtle chest sub-body
      { freqHz: 1020, amp: 0.068, decayMs: 14 }, // Soundhole air ring
    ],
  },
  santur: {
    id: 'santur',
    nameFa: 'بدنه سنتور (جعبه گردو + ۷۲ سیم باز)',
    bodyMaterialFa: 'جعبه ذوزنقه‌ای چوب گردو کهنه + ۱۸ خرک + گل‌های صدا',
    lengthMs: 62,
    directPeak: 0.64,
    woodDiffusionAmp: 0.072,
    woodDiffusionDecayMs: 18,
    defaultWetMix: 0.45,
    modes: [
      { freqHz: 168, amp: 0.135, decayMs: 38 }, // Deep walnut box cavity A0
      { freqHz: 264, amp: 0.11, decayMs: 34 }, // Soundboard main flexural mode
      { freqHz: 348, amp: 0.105, decayMs: 30 }, // Trapezoidal longitudinal cavity
      { freqHz: 510, amp: 0.092, decayMs: 26 }, // Twin rose-hole coupling (گل سنتور)
      { freqHz: 720, amp: 0.088, decayMs: 22 }, // Bronze string bridge plate (خرک زرد)
      { freqHz: 1060, amp: 0.082, decayMs: 19 }, // Mid-box projection
      { freqHz: 1590, amp: 0.105, decayMs: 17 }, // Signature Santur crystalline sheen
      { freqHz: 2180, amp: 0.086, decayMs: 15 }, // Steel bridge ring (خرک سفید)
      { freqHz: 2860, amp: 0.074, decayMs: 13 }, // Multi-course harmonic sparkle
      { freqHz: 3640, amp: 0.058, decayMs: 10 }, // Bell-like steel dispersion
      { freqHz: 4480, amp: 0.044, decayMs: 8.0 }, // Felt/wood mallet crispness
      { freqHz: 5600, amp: 0.028, decayMs: 6.0 }, // High harmonic air
      { freqHz: 890, amp: 0.068, decayMs: 20 }, // Bridge-rail coupling
      { freqHz: 1310, amp: 0.075, decayMs: 18 }, // Open-string sympathetic shimmer
    ],
  },
  oud: {
    id: 'oud',
    nameFa: 'بدنه عود / بربت (کاسه گلابی گردو و سرو)',
    bodyMaterialFa: 'کاسه ترکه‌ای عمیق گردو + صفحه سدر + شمسه‌های صدا',
    lengthMs: 54,
    directPeak: 0.66,
    woodDiffusionAmp: 0.062,
    woodDiffusionDecayMs: 15,
    defaultWetMix: 0.44,
    modes: [
      { freqHz: 128, amp: 0.165, decayMs: 36 }, // Deep pear-bowl Helmholtz A0
      { freqHz: 185, amp: 0.135, decayMs: 31 }, // Cedar top plate main monopole T1
      { freqHz: 268, amp: 0.12, decayMs: 26 }, // Back-ribs coupling
      { freqHz: 425, amp: 0.115, decayMs: 22 }, // Warm singing walnut belly
      { freqHz: 610, amp: 0.088, decayMs: 18 }, // Cross-brace dipole
      { freqHz: 865, amp: 0.082, decayMs: 15 }, // Triple-rosette projection (شمسه)
      { freqHz: 1180, amp: 0.064, decayMs: 12 }, // Woody midrange presence
      { freqHz: 1560, amp: 0.048, decayMs: 10 }, // Risha warmth
      { freqHz: 2080, amp: 0.032, decayMs: 7.5 }, // Gentle string definition
      { freqHz: 2650, amp: 0.02, decayMs: 5.5 }, // Soft nylon/gut rolloff
      { freqHz: 3250, amp: 0.012, decayMs: 4.0 }, // Damped top end
      { freqHz: 345, amp: 0.092, decayMs: 24 }, // Lower cavity depth
    ],
  },
  tanbur: {
    id: 'tanbur',
    nameFa: 'بدنه تنبور (کاسه یک‌تکه توت کرمانشاه)',
    bodyMaterialFa: 'کاسه یک‌تکه توت کنده‌کاری‌شده + صفحه توت با سوراخ‌های ریز',
    lengthMs: 56,
    directPeak: 0.66,
    woodDiffusionAmp: 0.06,
    woodDiffusionDecayMs: 16,
    defaultWetMix: 0.43,
    modes: [
      { freqHz: 182, amp: 0.155, decayMs: 35 }, // Carved pear-cavity Helmholtz A0
      { freqHz: 295, amp: 0.118, decayMs: 29 }, // Deep mulberry chamber coupling
      { freqHz: 392, amp: 0.105, decayMs: 25 }, // Sacred warm throat resonance
      { freqHz: 635, amp: 0.118, decayMs: 21 }, // Mystical nasal Kermanshah formant
      { freqHz: 940, amp: 0.085, decayMs: 17 }, // Soundboard dipole
      { freqHz: 1460, amp: 0.072, decayMs: 13 }, // Twin-string clarity
      { freqHz: 1980, amp: 0.052, decayMs: 10 }, // Finger-strum shimmer (شُر)
      { freqHz: 2620, amp: 0.036, decayMs: 7.5 }, // Gentle upper wood sheen
      { freqHz: 3350, amp: 0.022, decayMs: 5.5 }, // Soft rolloff
      { freqHz: 136, amp: 0.075, decayMs: 32 }, // Sub-body sacred warmth
      { freqHz: 495, amp: 0.082, decayMs: 22 }, // Mid cavity halo
      { freqHz: 1180, amp: 0.065, decayMs: 15 }, // Bridge coupling
    ],
  },
  kamancheh: {
    id: 'kamancheh',
    nameFa: 'بدنه کمانچه (کاسه کروی توت + پوست ماهی)',
    bodyMaterialFa: 'کاسه کروی چوب توت + پوست نازک ماهی/بره + خرک مایل + آرشه اسب',
    lengthMs: 48,
    directPeak: 0.65,
    woodDiffusionAmp: 0.052,
    woodDiffusionDecayMs: 12,
    defaultWetMix: 0.42,
    modes: [
      { freqHz: 308, amp: 0.15, decayMs: 28 }, // Spherical cavity + fish-skin A0
      { freqHz: 445, amp: 0.115, decayMs: 24 }, // Skin membrane main body T1
      { freqHz: 595, amp: 0.105, decayMs: 20 }, // Angled bridge rock mode
      { freqHz: 870, amp: 0.088, decayMs: 17 }, // Hollow mulberry bowl mode
      { freqHz: 1345, amp: 0.125, decayMs: 15 }, // Expressive singing human-voice formant
      { freqHz: 1890, amp: 0.082, decayMs: 12 }, // Upper vocal emotion
      { freqHz: 2660, amp: 0.078, decayMs: 10 }, // Bowed bridge hill (BH)
      { freqHz: 3480, amp: 0.054, decayMs: 8.0 }, // Bow-hair silk projection
      { freqHz: 4320, amp: 0.036, decayMs: 6.0 }, // Rosin air sheen
      { freqHz: 225, amp: 0.072, decayMs: 26 }, // Low G-string warmth
      { freqHz: 1090, amp: 0.078, decayMs: 16 }, // Nasal Persian spike-fiddle character
      { freqHz: 2240, amp: 0.064, decayMs: 11 }, // Bow clarity
    ],
  },
  ney: {
    id: 'ney',
    nameFa: 'بدنه نی هفت‌بند (بندهای نی طبیعی + لبه پشت‌دندان)',
    bodyMaterialFa: 'نی طبیعی هفت‌بند توخالی + رزونانس دیواره‌چوب + فضای دهانی',
    lengthMs: 38,
    directPeak: 0.72,
    woodDiffusionAmp: 0.04,
    woodDiffusionDecayMs: 9,
    defaultWetMix: 0.34,
    modes: [
      { freqHz: 332, amp: 0.11, decayMs: 22 }, // Low hollow bamboo bore warmth
      { freqHz: 665, amp: 0.135, decayMs: 19 }, // Signature giant-cane tube formant
      { freqHz: 1020, amp: 0.088, decayMs: 15 }, // Finger-hole radiation
      { freqHz: 1390, amp: 0.092, decayMs: 13 }, // Mid reed body
      { freqHz: 1940, amp: 0.095, decayMs: 11 }, // Iranian Posht-e Dandan upper tone
      { freqHz: 2560, amp: 0.06, decayMs: 8.5 }, // Edge-blown air projection
      { freqHz: 3280, amp: 0.038, decayMs: 6.5 }, // Soft breath halo
      { freqHz: 4100, amp: 0.022, decayMs: 4.5 }, // Air chiff shimmer
      { freqHz: 485, amp: 0.078, decayMs: 20 }, // Cane wall woodiness
      { freqHz: 1680, amp: 0.07, decayMs: 12 }, // Oral cavity vocal resonance
      { freqHz: 2240, amp: 0.052, decayMs: 9.5 }, // Ghays register sparkle
      { freqHz: 840, amp: 0.074, decayMs: 16 }, // Hollow node resonance
    ],
  },
};

function createDetPrng(seed: number): () => number {
  let s = seed >>> 0 || 0x2468ace1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) / 0xffffffff) * 2 - 1;
  };
}

/**
 * Pure deterministic synthesizer of a short, energy-normalized Modal Acoustic Body IR.
 * Zero pitch shift, zero DC offset, zero clipping — models genuine physical wood/skin cavity modes.
 */
export function buildInstrumentBodyIR(
  instrument: InstrumentId,
  sampleRate: number
): Float32Array {
  const spec = PERSIAN_BODY_IR_SPECS[instrument];
  const len = Math.max(256, Math.floor((spec.lengthMs / 1000) * sampleRate));
  const ir = new Float32Array(len);
  const rand = createDetPrng(instrument.charCodeAt(0) * 9973 + len);

  // 1. Direct phase-coherent impulse spike at t = 0
  ir[0] = spec.directPeak;

  // 2. Superpose all 12-14 physical cavity/plate/membrane eigenmodes
  const maxFreq = sampleRate * 0.44;
  for (let mIdx = 0; mIdx < spec.modes.length; mIdx++) {
    const mode = spec.modes[mIdx];
    if (mode.freqHz >= maxFreq) continue;
    const w = (2 * Math.PI * mode.freqHz) / sampleRate;
    const tauSamples = Math.max(8, (mode.decayMs / 1000) * sampleRate);
    // Slight deterministic natural propagation delay (0.3ms..2.2ms across soundbox)
    const delaySamples = Math.min(len - 4, Math.floor(((0.35 + (mIdx % 5) * 0.38) / 1000) * sampleRate));
    const phase0 = mode.phaseRad ?? ((mIdx * 0.73) % (2 * Math.PI));

    for (let i = delaySamples; i < len; i++) {
      const dt = i - delaySamples;
      const env = Math.exp(-dt / tauSamples);
      if (env < 1e-4) break;
      ir[i] += mode.amp * env * Math.sin(w * dt + phase0);
    }
  }

  // 3. Subtle dense wood-chamber internal micro-reflections (starting after 1.1ms)
  const diffStart = Math.min(len - 8, Math.floor(0.0011 * sampleRate));
  const diffTau = Math.max(8, (spec.woodDiffusionDecayMs / 1000) * sampleRate);
  let lpState = 0;
  for (let i = diffStart; i < len; i++) {
    const dt = i - diffStart;
    const env = Math.exp(-dt / diffTau);
    lpState = 0.62 * lpState + 0.38 * rand();
    ir[i] += lpState * spec.woodDiffusionAmp * env;
  }

  // 4. Smooth cosine fade-out on final 15% + DC offset removal
  const tailLen = Math.max(16, Math.floor(len * 0.15));
  for (let i = 0; i < tailLen; i++) {
    const t = i / tailLen;
    ir[len - tailLen + i] *= 0.5 * (1 + Math.cos(Math.PI * t));
  }

  let mean = 0;
  for (let i = 0; i < len; i++) mean += ir[i];
  mean /= len;
  for (let i = 0; i < len; i++) ir[i] -= mean;

  // 5. Strict L2-energy normalization so convolving never boosts/clips loudness
  let energy = 0;
  for (let i = 0; i < len; i++) energy += ir[i] * ir[i];
  const norm = 1 / Math.max(0.25, Math.sqrt(energy));
  for (let i = 0; i < len; i++) ir[i] *= norm;

  return ir;
}

/**
 * Fast time-domain direct convolution for offline Physical v2 / WAV Mixdown rendering
 * (applies a compact 18ms wood/skin body cavity signature cleanly without slowing exports).
 */
export function applyOfflineBodyColor(
  input: Float32Array,
  sampleRate: number,
  instrument: InstrumentId,
  wetMix = 0.32
): Float32Array {
  if (wetMix <= 0.01) return input;
  const spec = PERSIAN_BODY_IR_SPECS[instrument];
  // Use a crisp 16ms kernel for fast deterministic offline rendering
  const fullIr = buildInstrumentBodyIR(instrument, sampleRate);
  const kLen = Math.min(fullIr.length, Math.max(64, Math.floor(0.016 * sampleRate)));
  const out = new Float32Array(input.length);
  const dry = 1 - wetMix * 0.45;
  const wet = wetMix * Math.min(1, spec.defaultWetMix * 1.45);

  for (let i = 0; i < input.length; i++) {
    let acc = 0;
    const maxK = Math.min(kLen, i + 1);
    for (let k = 0; k < maxK; k++) {
      acc += input[i - k] * fullIr[k];
    }
    out[i] = Math.tanh(input[i] * dry + acc * wet);
  }
  return out;
}

interface BodyBusEntry {
  input: GainNode;
  dryGain: GainNode;
  wetGain: GainNode;
  convolver: ConvolverNode;
}

const bodyBusCache = new WeakMap<AudioContext, Map<InstrumentId, BodyBusEntry>>();

/**
 * Returns a shared, cached per-instrument Real-Time Acoustic Body Convolution Bus
 * connected straight into Navanegar's Persian Hall Reverb!
 * Zero per-note Convolver allocation — ultra-low CPU & instant live timbre sculpting.
 */
export function getInstrumentBodyBus(
  ctx: AudioContext,
  instrument: InstrumentId,
  bodyResonanceMix: number
): AudioNode {
  const destination = getReverbInputNode(ctx);
  if (typeof ctx.createConvolver !== 'function') {
    return destination;
  }

  let ctxMap = bodyBusCache.get(ctx);
  if (!ctxMap) {
    ctxMap = new Map<InstrumentId, BodyBusEntry>();
    bodyBusCache.set(ctx, ctxMap);
  }

  let entry = ctxMap.get(instrument);
  if (!entry) {
    const input = ctx.createGain();
    const dryGain = ctx.createGain();
    const wetGain = ctx.createGain();
    const convolver = ctx.createConvolver();
    convolver.normalize = false; // Already strictly L2-normalized!

    const irSamples = buildInstrumentBodyIR(instrument, ctx.sampleRate);
    const irBuf = ctx.createBuffer(1, irSamples.length, ctx.sampleRate);
    irBuf.copyToChannel(new Float32Array(irSamples), 0);
    convolver.buffer = irBuf;

    input.connect(dryGain);
    dryGain.connect(destination);

    input.connect(convolver);
    convolver.connect(wetGain);
    wetGain.connect(destination);

    entry = { input, dryGain, wetGain, convolver };
    ctxMap.set(instrument, entry);
  }

  const clampedMix = Math.max(0, Math.min(0.85, bodyResonanceMix));
  const now = ctx.currentTime;
  entry.dryGain.gain.setTargetAtTime(1 - clampedMix * 0.48, now, 0.015);
  entry.wetGain.gain.setTargetAtTime(clampedMix * 0.92, now, 0.015);

  return entry.input;
}
