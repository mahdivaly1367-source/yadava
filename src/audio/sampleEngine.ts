import {
  deleteCustomInstrumentSample,
  loadAllCustomInstrumentSamples,
  prepareAndCalibrateUserSample,
  saveCustomInstrumentSample,
  type StoredCustomSample,
} from '../services/customSampleDb';
import type {
  AcousticSculptSettings,
  CustomInstrumentSampleMeta,
  InstrumentId,
  OrnamentType,
  PercussionInstrument,
  SanturMalletType,
  SoundEngineMode,
} from '../types/music';
import { getReverbInputNode } from './hallReverb';
import { getInstrumentBodyBus, PERSIAN_BODY_IR_SPECS } from './instrumentBodyIR';

export interface SampleZoneMeta {
  file: string;
  concertNote: string;
  measuredHz: number;
  durationSec: number;
  loopStartSec?: number;
  loopEndSec?: number;
}

export interface MelodicBankManifest {
  license: string;
  source: string;
  sustained: boolean;
  zones: SampleZoneMeta[];
}

export interface PercussionBankManifest {
  license: string;
  source: string;
  strokes: Record<string, string[]>;
}

export interface SampleBankManifest {
  version: string;
  sampleRate: number;
  percussion: Record<PercussionInstrument, PercussionBankManifest>;
  melodicBanks: Record<string, MelodicBankManifest>;
}

/**
 * Primary real-sample bank mapping for each of the 7 Persian melodic instruments.
 */
export const INSTRUMENT_TO_SAMPLE_BANK: Record<InstrumentId, string> = {
  tar: 'tar_plectrum',
  setar: 'lute',
  tanbur: 'lute',
  santur: 'santur',
  oud: 'oud',
  kamancheh: 'kamancheh',
  ney: 'ney',
};

/**
 * Secondary real-sample bank used for multi-layer acoustic realism:
 * - Tar layers crisp plectrum steel strings (`tar_plectrum`) with wooden neck-body resonance (`lute`)
 * - Kamancheh switches seamlessly to real detached short bow strokes (`kamancheh_stac`) on fast passages
 */
export const INSTRUMENT_SECONDARY_BANK: Partial<Record<InstrumentId, string>> = {
  tar: 'lute',
  kamancheh: 'kamancheh_stac',
};

export interface SampleCreditInfo {
  id: string;
  titleFa: string;
  instrumentsFa: string;
  source: string;
  license: string;
  url: string;
}

export const REAL_SAMPLE_CREDITS: SampleCreditInfo[] = [
  {
    id: 'zarbsaz-tombak',
    titleFa: 'سمپل‌های واقعی تنبک استودیویی (۱۱ ضربه چرخشی)',
    instrumentsFa: 'تنبک اصیل ایرانی (تُم، بَک، بشکن، ریز)',
    source:
      'sinak/zarbsaz — برگرفته از ضبط زنده «Tombak, Alireza.mp3» (sonsbcnintercultural, Freesound #256123)',
    license: 'CC BY 3.0',
    url: 'https://github.com/sinak/zarbsaz',
  },
  {
    id: 'vcsl-acoustic',
    titleFa: 'بانک آکوستیک ورسلیان (VCSL — ۵ بانک کوردوفون، دف و بادی چوبی)',
    instrumentsFa: 'تار (سیم مضرابی)، سه‌تار، سنتور، عود، تنبور، نی هفت‌بند و دف',
    source: 'Versilian Community Sample Library (Versilian Studios LLC / sgossner/VCSL)',
    license: 'CC0 1.0 (مالکیت عمومی)',
    url: 'https://github.com/sgossner/VCSL',
  },
  {
    id: 'sfz-erhu',
    titleFa: 'سمپل‌های زهی آرشه‌ای با کاسه پوستی (کشیده + استاکاتو کوتاه)',
    instrumentsFa: 'کمانچه ایرانی (آرشه کشیده آواز و ضربه‌های کوتاه چهارمضراب)',
    source: 'sfzinstruments/aliexpress-erhu (ضبط استودیویی نزدیک‌میکروفون)',
    license: 'CC0 1.0 (مالکیت عمومی)',
    url: 'https://github.com/sfzinstruments/aliexpress-erhu',
  },
];

export interface MasterStudioPreset {
  id: string;
  nameFa: string;
  subtitleFa: string;
  patch: Partial<AcousticSculptSettings>;
}

export const MASTER_STUDIO_PRESETS: MasterStudioPreset[] = [
  {
    id: 'studio_balanced',
    nameFa: 'استودیویی متعادل',
    subtitleFa: 'توازن ایده‌آل بدنه کانولوشن، وضوح نت و کوک دقیق',
    patch: {
      engineMode: 'hybrid_studio',
      bodyWarmth: 0.64,
      attackCrispness: 0.58,
      sympatheticShimmer: 0.48,
      bodyConvolverMix: 0.68,
      neyBreathiness: 0.62,
      vibratoExpression: 0.52,
      santurMallet: 'felt',
      legatoMalesh: true,
      humanizeMicroCents: true,
    },
  },
  {
    id: 'intimate_majlesi',
    nameFa: 'مجلسی گرم و مخملین',
    subtitleFa: 'رزونانس عمیق چوب توت و گردو، مضراب نمدی نرم و حس صمیمی',
    patch: {
      engineMode: 'hybrid_studio',
      bodyWarmth: 0.82,
      attackCrispness: 0.42,
      sympatheticShimmer: 0.62,
      bodyConvolverMix: 0.82,
      neyBreathiness: 0.76,
      vibratoExpression: 0.64,
      santurMallet: 'felt',
      legatoMalesh: true,
      humanizeMicroCents: true,
    },
  },
  {
    id: 'concert_radiant',
    nameFa: 'تالار کنسرت درخشان',
    subtitleFa: 'مضراب چوبی سنتور، تیزی مضراب تار و شفافیت بالای آرشه',
    patch: {
      engineMode: 'hybrid_studio',
      bodyWarmth: 0.56,
      attackCrispness: 0.82,
      sympatheticShimmer: 0.68,
      bodyConvolverMix: 0.62,
      neyBreathiness: 0.48,
      vibratoExpression: 0.46,
      santurMallet: 'wood',
      legatoMalesh: true,
      humanizeMicroCents: true,
    },
  },
  {
    id: 'authentic_avaz',
    nameFa: 'آواز اصیل و مالش زنده',
    subtitleFa: 'نَفَس غنی نی، مالش نرم کمانچه و عود، و ویبراتوی طبیعی انتهای نت',
    patch: {
      engineMode: 'hybrid_studio',
      bodyWarmth: 0.72,
      attackCrispness: 0.5,
      sympatheticShimmer: 0.52,
      bodyConvolverMix: 0.74,
      neyBreathiness: 0.86,
      vibratoExpression: 0.78,
      santurMallet: 'felt',
      legatoMalesh: true,
      humanizeMicroCents: true,
    },
  },
];

const SETTINGS_STORAGE_KEY = 'navanegar_acoustic_sculpt_v25';

export const DEFAULT_ACOUSTIC_SCULPT: AcousticSculptSettings = {
  engineMode: 'hybrid_studio',
  bodyWarmth: 0.64,
  attackCrispness: 0.58,
  sympatheticShimmer: 0.48,
  bodyConvolverMix: 0.68,
  neyBreathiness: 0.62,
  vibratoExpression: 0.52,
  santurMallet: 'felt',
  legatoMalesh: true,
  humanizeMicroCents: true,
};

let sculptSettings: AcousticSculptSettings = loadSculptSettings();

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0.5));
}

function loadSculptSettings(): AcousticSculptSettings {
  try {
    if (typeof localStorage === 'undefined') return { ...DEFAULT_ACOUSTIC_SCULPT };
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_ACOUSTIC_SCULPT };
    const parsed = JSON.parse(raw) as Partial<AcousticSculptSettings>;
    const mode: SoundEngineMode =
      parsed.engineMode === 'acoustic_samples' ||
      parsed.engineMode === 'physical_v2' ||
      parsed.engineMode === 'hybrid_studio'
        ? parsed.engineMode
        : DEFAULT_ACOUSTIC_SCULPT.engineMode;
    const mallet: SanturMalletType = parsed.santurMallet === 'wood' ? 'wood' : 'felt';
    return {
      engineMode: mode,
      bodyWarmth: clamp01(parsed.bodyWarmth ?? DEFAULT_ACOUSTIC_SCULPT.bodyWarmth),
      attackCrispness: clamp01(parsed.attackCrispness ?? DEFAULT_ACOUSTIC_SCULPT.attackCrispness),
      sympatheticShimmer: clamp01(
        parsed.sympatheticShimmer ?? DEFAULT_ACOUSTIC_SCULPT.sympatheticShimmer
      ),
      bodyConvolverMix: clamp01(
        parsed.bodyConvolverMix ?? DEFAULT_ACOUSTIC_SCULPT.bodyConvolverMix
      ),
      neyBreathiness: clamp01(parsed.neyBreathiness ?? DEFAULT_ACOUSTIC_SCULPT.neyBreathiness),
      vibratoExpression: clamp01(
        parsed.vibratoExpression ?? DEFAULT_ACOUSTIC_SCULPT.vibratoExpression
      ),
      santurMallet: mallet,
      legatoMalesh:
        typeof parsed.legatoMalesh === 'boolean'
          ? parsed.legatoMalesh
          : DEFAULT_ACOUSTIC_SCULPT.legatoMalesh,
      humanizeMicroCents:
        typeof parsed.humanizeMicroCents === 'boolean'
          ? parsed.humanizeMicroCents
          : DEFAULT_ACOUSTIC_SCULPT.humanizeMicroCents,
    };
  } catch {
    return { ...DEFAULT_ACOUSTIC_SCULPT };
  }
}

export function getAcousticSculptSettings(): AcousticSculptSettings {
  return { ...sculptSettings };
}

export function setAcousticSculptSettings(
  patch: Partial<AcousticSculptSettings>
): AcousticSculptSettings {
  sculptSettings = {
    engineMode: patch.engineMode ?? sculptSettings.engineMode,
    bodyWarmth:
      patch.bodyWarmth !== undefined ? clamp01(patch.bodyWarmth) : sculptSettings.bodyWarmth,
    attackCrispness:
      patch.attackCrispness !== undefined
        ? clamp01(patch.attackCrispness)
        : sculptSettings.attackCrispness,
    sympatheticShimmer:
      patch.sympatheticShimmer !== undefined
        ? clamp01(patch.sympatheticShimmer)
        : sculptSettings.sympatheticShimmer,
    bodyConvolverMix:
      patch.bodyConvolverMix !== undefined
        ? clamp01(patch.bodyConvolverMix)
        : sculptSettings.bodyConvolverMix,
    neyBreathiness:
      patch.neyBreathiness !== undefined
        ? clamp01(patch.neyBreathiness)
        : sculptSettings.neyBreathiness,
    vibratoExpression:
      patch.vibratoExpression !== undefined
        ? clamp01(patch.vibratoExpression)
        : sculptSettings.vibratoExpression,
    santurMallet:
      patch.santurMallet === 'wood' || patch.santurMallet === 'felt'
        ? patch.santurMallet
        : sculptSettings.santurMallet,
    legatoMalesh:
      patch.legatoMalesh !== undefined ? patch.legatoMalesh : sculptSettings.legatoMalesh,
    humanizeMicroCents:
      patch.humanizeMicroCents !== undefined
        ? patch.humanizeMicroCents
        : sculptSettings.humanizeMicroCents,
  };
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(sculptSettings));
    }
  } catch {
    // ignore storage quota errors
  }
  return { ...sculptSettings };
}

export function getSoundEngineMode(): SoundEngineMode {
  return sculptSettings.engineMode;
}

export function setSoundEngineMode(mode: SoundEngineMode): void {
  setAcousticSculptSettings({ engineMode: mode });
}

interface PersianBodyAcousticProfile {
  bodyPeak1Hz: number;
  bodyPeak1GainDb: number;
  bodyPeak1Q: number;
  bodyPeak2Hz: number;
  bodyPeak2GainDb: number;
  bodyPeak2Q: number;
  highpassHz: number;
  lowpassHz: number;
  shelfHz: number;
  shelfGainDb: number;
  attackSec: number;
  releaseSec: number;
  dualCourseChorus: boolean;
  courseDetuneCents: number;
  courseDelaySec: number;
  courseMix: number;
  transientType: 'mezrab' | 'mallet' | 'breath' | 'rosin' | 'none';
  transientCenterHz: number;
  transientLevel: number;
  supportsMalesh: boolean;
  maleshDurSec: number;
  vibratoRateHz: number;
  vibratoMaxCents: number;
  gainTrim: number;
}

/**
 * Refined v2.5 Persian Acoustic Body Profiles (working in tandem with the 12-14 mode Body IR Convolver).
 */
export const PERSIAN_BODY_PROFILES: Record<InstrumentId, PersianBodyAcousticProfile> = {
  tar: {
    bodyPeak1Hz: 194,
    bodyPeak1GainDb: 3.4, // Stretched lambskin drumhead thump (پوست بره)
    bodyPeak1Q: 2.2,
    bodyPeak2Hz: 985,
    bodyPeak2GainDb: 3.8, // Signature Persian Tar midrange bark
    bodyPeak2Q: 2.4,
    highpassHz: 95,
    lowpassHz: 6100,
    shelfHz: 3300,
    shelfGainDb: 2.2,
    attackSec: 0.0018,
    releaseSec: 0.14,
    dualCourseChorus: true, // Double-course paired steel strings (سیم جفت)
    courseDetuneCents: 1.05,
    courseDelaySec: 0.0019,
    courseMix: 0.44,
    transientType: 'mezrab',
    transientCenterHz: 3050,
    transientLevel: 0.17,
    supportsMalesh: false,
    maleshDurSec: 0,
    vibratoRateHz: 0,
    vibratoMaxCents: 0,
    gainTrim: 0.9,
  },
  setar: {
    bodyPeak1Hz: 252,
    bodyPeak1GainDb: 2.9, // Delicate hollow mulberry wood warmth
    bodyPeak1Q: 2.0,
    bodyPeak2Hz: 1320,
    bodyPeak2GainDb: 3.4, // Intimate poetic nasal Setar formant
    bodyPeak2Q: 2.6,
    highpassHz: 115,
    lowpassHz: 4850,
    shelfHz: 2700,
    shelfGainDb: 0.7,
    attackSec: 0.0032,
    releaseSec: 0.2,
    dualCourseChorus: true, // Sympathetic Moshtagh string glow (سیم مشتاق)
    courseDetuneCents: 0.8,
    courseDelaySec: 0.0028,
    courseMix: 0.28,
    transientType: 'mezrab',
    transientCenterHz: 2300,
    transientLevel: 0.09,
    supportsMalesh: true, // Subtle fingertip fret bend (مالش)
    maleshDurSec: 0.038,
    vibratoRateHz: 0,
    vibratoMaxCents: 0,
    gainTrim: 0.9,
  },
  santur: {
    bodyPeak1Hz: 178,
    bodyPeak1GainDb: 3.0, // Trapezoidal walnut soundbox Helmholtz resonance
    bodyPeak1Q: 1.9,
    bodyPeak2Hz: 1620,
    bodyPeak2GainDb: 3.2, // Shimmering quad-course bridge-plate brilliance
    bodyPeak2Q: 2.1,
    highpassHz: 100,
    lowpassHz: 7400,
    shelfHz: 3800,
    shelfGainDb: 2.2,
    attackSec: 0.0028, // Softened for felt mallet; dynamically tightened to 0.0009s for wood mallet
    releaseSec: 0.26,
    dualCourseChorus: true, // Quad-course concert Santur chorus
    courseDetuneCents: 1.2,
    courseDelaySec: 0.0015,
    courseMix: 0.5,
    transientType: 'mallet',
    transientCenterHz: 3400,
    transientLevel: 0.14,
    supportsMalesh: false,
    maleshDurSec: 0,
    vibratoRateHz: 0,
    vibratoMaxCents: 0,
    gainTrim: 0.9,
  },
  ney: {
    bodyPeak1Hz: 665,
    bodyPeak1GainDb: 3.6, // Hollow seven-node giant-cane tube resonance
    bodyPeak1Q: 2.1,
    bodyPeak2Hz: 1940,
    bodyPeak2GainDb: 2.6, // Iranian Posht-e Dandan upper reed overtone
    bodyPeak2Q: 2.5,
    highpassHz: 135,
    lowpassHz: 4550,
    shelfHz: 2900,
    shelfGainDb: -1.4,
    attackSec: 0.046,
    releaseSec: 0.18,
    dualCourseChorus: false,
    courseDetuneCents: 0,
    courseDelaySec: 0,
    courseMix: 0,
    transientType: 'breath', // Register-adaptive Iranian Posht-e Dandan breath-chiff
    transientCenterHz: 1850,
    transientLevel: 0.17,
    supportsMalesh: true, // Expressive lip/breath glide
    maleshDurSec: 0.055,
    vibratoRateHz: 4.7,
    vibratoMaxCents: 11,
    gainTrim: 0.88,
  },
  kamancheh: {
    bodyPeak1Hz: 335,
    bodyPeak1GainDb: 3.8, // Fish-skin membrane & spherical mulberry bowl
    bodyPeak1Q: 2.2,
    bodyPeak2Hz: 1360,
    bodyPeak2GainDb: 3.4, // Singing human vocal Kamancheh formant
    bodyPeak2Q: 2.6,
    highpassHz: 115,
    lowpassHz: 5600,
    shelfHz: 3500,
    shelfGainDb: 1.4,
    attackSec: 0.044,
    releaseSec: 0.18,
    dualCourseChorus: false,
    courseDetuneCents: 0,
    courseDelaySec: 0,
    courseMix: 0,
    transientType: 'rosin',
    transientCenterHz: 2700,
    transientLevel: 0.09,
    supportsMalesh: true, // Signature Persian bowed fingerboard slide (مالش کمانچه)
    maleshDurSec: 0.064,
    vibratoRateHz: 5.3,
    vibratoMaxCents: 14,
    gainTrim: 0.9,
  },
  oud: {
    bodyPeak1Hz: 134,
    bodyPeak1GainDb: 4.4, // Deep ribbed walnut pear-shell cavity
    bodyPeak1Q: 1.7,
    bodyPeak2Hz: 420,
    bodyPeak2GainDb: 3.2, // Warm singing cedar belly
    bodyPeak2Q: 1.7,
    highpassHz: 72,
    lowpassHz: 3400, // Mellow eagle-feather risha warmth
    shelfHz: 2350,
    shelfGainDb: -2.4,
    attackSec: 0.0032,
    releaseSec: 0.18,
    dualCourseChorus: true, // Double-course warm nylon/gut fullness
    courseDetuneCents: 0.9,
    courseDelaySec: 0.0026,
    courseMix: 0.38,
    transientType: 'mezrab',
    transientCenterHz: 1680,
    transientLevel: 0.08,
    supportsMalesh: true, // Fretless Oud finger glide
    maleshDurSec: 0.048,
    vibratoRateHz: 0,
    vibratoMaxCents: 0,
    gainTrim: 0.95,
  },
  tanbur: {
    bodyPeak1Hz: 184,
    bodyPeak1GainDb: 4.2, // Sacred Kermanshah carved mulberry pear body
    bodyPeak1Q: 1.9,
    bodyPeak2Hz: 630,
    bodyPeak2GainDb: 3.5, // Mystical nasal chest formant
    bodyPeak2Q: 2.1,
    highpassHz: 82,
    lowpassHz: 4100,
    shelfHz: 2650,
    shelfGainDb: -0.9,
    attackSec: 0.0024,
    releaseSec: 0.22,
    dualCourseChorus: true, // Sacred twin-unison melody strings
    courseDetuneCents: 1.05,
    courseDelaySec: 0.0022,
    courseMix: 0.46,
    transientType: 'mezrab',
    transientCenterHz: 2100,
    transientLevel: 0.1,
    supportsMalesh: false,
    maleshDurSec: 0,
    vibratoRateHz: 0,
    vibratoMaxCents: 0,
    gainTrim: 0.94,
  },
};

function getSamplesBaseUrl(): string {
  const base =
    typeof import.meta !== 'undefined' && import.meta.env && typeof import.meta.env.BASE_URL === 'string'
      ? import.meta.env.BASE_URL
      : '/';
  const normalized = base.endsWith('/') ? base : `${base}/`;
  return `${normalized}samples/`;
}

/**
 * Pure zone selector: chooses the closest multi-sample zone in log-frequency (cents) space
 * to minimize pitch-shift ratio and eliminate formant/chipmunk artifacts.
 */
export function selectBestSampleZone(
  zones: SampleZoneMeta[],
  targetHz: number
): { zone: SampleZoneMeta; playbackRate: number; shiftCents: number } | null {
  if (!zones || zones.length === 0 || !Number.isFinite(targetHz) || targetHz <= 20) {
    return null;
  }
  let best = zones[0];
  let bestAbsCents = Infinity;

  for (const z of zones) {
    if (!z.measuredHz || z.measuredHz <= 20) continue;
    const absCents = Math.abs(1200 * Math.log2(targetHz / z.measuredHz));
    if (absCents < bestAbsCents) {
      bestAbsCents = absCents;
      best = z;
    }
  }

  const playbackRate = targetHz / best.measuredHz;
  const shiftCents = 1200 * Math.log2(playbackRate);
  return {
    zone: best,
    playbackRate: Math.max(0.25, Math.min(4.0, playbackRate)),
    shiftCents,
  };
}

class AcousticSampleBankManager {
  private manifest: SampleBankManifest | null = null;
  private manifestPromise: Promise<SampleBankManifest | null> | null = null;
  private bufferCache = new Map<string, AudioBuffer>();
  private inflightLoads = new Map<string, Promise<AudioBuffer | null>>();
  private customSamples = new Map<InstrumentId, StoredCustomSample>();
  private customBuffers = new Map<string, AudioBuffer>();
  private customLoaded = false;
  private roundRobinCounters = new Map<string, number>();
  private listeners = new Set<() => void>();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const fn of this.listeners) {
      try {
        fn();
      } catch {
        // ignore listener errors
      }
    }
  }

  getManifestSync(): SampleBankManifest | null {
    return this.manifest;
  }

  async ensureManifest(): Promise<SampleBankManifest | null> {
    if (this.manifest) return this.manifest;
    if (typeof fetch !== 'function' || typeof window === 'undefined') return null;
    if (!this.manifestPromise) {
      this.manifestPromise = fetch(`${getSamplesBaseUrl()}manifest.json`)
        .then(async (res) => {
          if (!res.ok) return null;
          const data = (await res.json()) as SampleBankManifest;
          this.manifest = data;
          this.emit();
          return data;
        })
        .catch(() => null);
    }
    return this.manifestPromise;
  }

  async ensureCustomSamplesLoaded(): Promise<void> {
    if (this.customLoaded) return;
    this.customLoaded = true;
    const map = await loadAllCustomInstrumentSamples();
    for (const [inst, sample] of map.entries()) {
      this.customSamples.set(inst, sample);
    }
    this.emit();
  }

  getCustomSampleMeta(instrument: InstrumentId): CustomInstrumentSampleMeta | null {
    return this.customSamples.get(instrument)?.meta ?? null;
  }

  getAllCustomSampleMetas(): CustomInstrumentSampleMeta[] {
    return Array.from(this.customSamples.values()).map((s) => s.meta);
  }

  async importCustomInstrumentSample(
    ctx: AudioContext,
    instrument: InstrumentId,
    file: File,
    overrideHz?: number
  ): Promise<CustomInstrumentSampleMeta> {
    const arrayBuf = await file.arrayBuffer();
    const decoded = await ctx.decodeAudioData(arrayBuf.slice(0));
    const numCh = decoded.numberOfChannels;
    const len = decoded.length;
    const mono = new Float32Array(len);
    for (let ch = 0; ch < numCh; ch++) {
      const chData = decoded.getChannelData(ch);
      const scale = 1 / numCh;
      for (let i = 0; i < len; i++) mono[i] += chData[i] * scale;
    }

    const calibrated = prepareAndCalibrateUserSample(mono, decoded.sampleRate, overrideHz);
    const meta: CustomInstrumentSampleMeta = {
      instrument,
      fileName: file.name,
      measuredHz: calibrated.measuredHz,
      durationSec: calibrated.durationSec,
      sampleRate: decoded.sampleRate,
      createdAt: Date.now(),
    };

    const stored: StoredCustomSample = { meta, pcm: calibrated.pcm };
    await saveCustomInstrumentSample(stored);
    this.customSamples.set(instrument, stored);
    for (const key of Array.from(this.customBuffers.keys())) {
      if (key.startsWith(`${instrument}:`)) this.customBuffers.delete(key);
    }
    this.emit();
    return meta;
  }

  async removeCustomInstrumentSample(instrument: InstrumentId): Promise<void> {
    await deleteCustomInstrumentSample(instrument);
    this.customSamples.delete(instrument);
    for (const key of Array.from(this.customBuffers.keys())) {
      if (key.startsWith(`${instrument}:`)) this.customBuffers.delete(key);
    }
    this.emit();
  }

  private getCustomAudioBuffer(
    ctx: AudioContext,
    instrument: InstrumentId
  ): {
    buffer: AudioBuffer;
    measuredHz: number;
  } | null {
    const stored = this.customSamples.get(instrument);
    if (!stored) return null;
    const cacheKey = `${instrument}:${ctx.sampleRate}`;
    let buf = this.customBuffers.get(cacheKey);
    if (!buf) {
      buf = ctx.createBuffer(1, stored.pcm.length, stored.meta.sampleRate);
      buf.copyToChannel(new Float32Array(stored.pcm), 0);
      this.customBuffers.set(cacheKey, buf);
    }
    return { buffer: buf, measuredHz: stored.meta.measuredHz };
  }

  private async fetchAndDecode(ctx: AudioContext, relPath: string): Promise<AudioBuffer | null> {
    const existing = this.bufferCache.get(relPath);
    if (existing) return existing;
    if (typeof fetch !== 'function' || typeof window === 'undefined') return null;

    let pending = this.inflightLoads.get(relPath);
    if (!pending) {
      pending = fetch(`${getSamplesBaseUrl()}${relPath}`)
        .then(async (res) => {
          if (!res.ok) return null;
          const arr = await res.arrayBuffer();
          const decoded = await ctx.decodeAudioData(arr);
          this.bufferCache.set(relPath, decoded);
          return decoded;
        })
        .catch(() => null)
        .finally(() => {
          this.inflightLoads.delete(relPath);
        });
      this.inflightLoads.set(relPath, pending);
    }
    return pending;
  }

  async preloadInstrument(ctx: AudioContext, instrument: InstrumentId): Promise<boolean> {
    await this.ensureCustomSamplesLoaded();
    const manifest = await this.ensureManifest();
    if (!manifest) return false;
    const bankIds = [INSTRUMENT_TO_SAMPLE_BANK[instrument]];
    const secondary = INSTRUMENT_SECONDARY_BANK[instrument];
    if (secondary) bankIds.push(secondary);

    const filesToLoad: string[] = [];
    for (const id of bankIds) {
      const bank = manifest.melodicBanks[id];
      if (bank) {
        for (const z of bank.zones) filesToLoad.push(z.file);
      }
    }
    if (filesToLoad.length === 0) return false;

    const results = await Promise.all(filesToLoad.map((f) => this.fetchAndDecode(ctx, f)));
    this.emit();
    return results.some((r) => r !== null);
  }

  async preloadPercussion(ctx: AudioContext, instrument: PercussionInstrument): Promise<boolean> {
    const manifest = await this.ensureManifest();
    if (!manifest) return false;
    const bank = manifest.percussion[instrument];
    if (!bank) return false;
    const allFiles = Object.values(bank.strokes).flat();
    const results = await Promise.all(allFiles.map((f) => this.fetchAndDecode(ctx, f)));
    this.emit();
    return results.some((r) => r !== null);
  }

  isInstrumentReady(instrument: InstrumentId): boolean {
    if (this.customSamples.has(instrument)) return true;
    if (!this.manifest) return false;
    const bank = this.manifest.melodicBanks[INSTRUMENT_TO_SAMPLE_BANK[instrument]];
    if (!bank || bank.zones.length === 0) return false;
    return bank.zones.some((z) => this.bufferCache.has(z.file));
  }

  getLoadedCounts(): { loadedFiles: number; totalFiles: number; readyBanks: number } {
    if (!this.manifest) {
      return { loadedFiles: this.bufferCache.size, totalFiles: 54, readyBanks: 0 };
    }
    let totalFiles = 0;
    let readyBanks = 0;
    for (const bank of Object.values(this.manifest.melodicBanks)) {
      totalFiles += bank.zones.length;
      if (bank.zones.some((z) => this.bufferCache.has(z.file))) readyBanks++;
    }
    for (const p of Object.values(this.manifest.percussion)) {
      const files = Object.values(p.strokes).flat();
      totalFiles += files.length;
      if (files.some((f) => this.bufferCache.has(f))) readyBanks++;
    }
    return {
      loadedFiles: this.bufferCache.size,
      totalFiles,
      readyBanks,
    };
  }

  getPercussionSampleSync(
    ctx: AudioContext,
    instrument: PercussionInstrument,
    stroke: 'tom' | 'bak' | 'pelang' | 'riz'
  ): AudioBuffer | null {
    if (sculptSettings.engineMode === 'physical_v2') return null;
    if (!this.manifest) {
      void this.preloadPercussion(ctx, instrument);
      return null;
    }
    const bank = this.manifest.percussion[instrument];
    const files = bank?.strokes?.[stroke];
    if (!files || files.length === 0) return null;

    const rrKey = `${instrument}:${stroke}`;
    const idx = (this.roundRobinCounters.get(rrKey) ?? 0) % files.length;
    this.roundRobinCounters.set(rrKey, idx + 1);

    const chosen = files[idx];
    const cached = this.bufferCache.get(chosen);
    if (cached) return cached;

    for (const f of files) {
      const alt = this.bufferCache.get(f);
      if (alt) {
        void this.preloadPercussion(ctx, instrument);
        return alt;
      }
    }
    void this.preloadPercussion(ctx, instrument);
    return null;
  }

  private resolveCachedZoneFromBank(
    bankId: string,
    frequency: number
  ): {
    buffer: AudioBuffer;
    playbackRate: number;
    sustained: boolean;
    loopStartSec?: number;
    loopEndSec?: number;
  } | null {
    const bank = this.manifest?.melodicBanks[bankId];
    if (!bank) return null;
    const selected = selectBestSampleZone(bank.zones, frequency);
    if (!selected) return null;

    const exactBuf = this.bufferCache.get(selected.zone.file);
    if (exactBuf) {
      return {
        buffer: exactBuf,
        playbackRate: selected.playbackRate,
        sustained: bank.sustained,
        loopStartSec: selected.zone.loopStartSec,
        loopEndSec: selected.zone.loopEndSec,
      };
    }

    const cachedZones = bank.zones.filter((z) => this.bufferCache.has(z.file));
    if (cachedZones.length === 0) return null;
    const alt = selectBestSampleZone(cachedZones, frequency);
    if (!alt) return null;
    const altBuf = this.bufferCache.get(alt.zone.file);
    if (!altBuf) return null;
    return {
      buffer: altBuf,
      playbackRate: alt.playbackRate,
      sustained: bank.sustained,
      loopStartSec: alt.zone.loopStartSec,
      loopEndSec: alt.zone.loopEndSec,
    };
  }

  /**
   * Plays a microtonally exact note using Navanegar Acoustic Engine v2.5:
   * - Real YIN-calibrated multi-samples (54 studio WAVs or user's custom instrument sample)
   * - 12-to-14 Mode Physical Acoustic Body Convolution IR per Persian instrument
   * - Automatic Kamancheh short-bow (`stac`) vs sustained (`sus`) switching
   * - Dual-layer Tar steel plectrum + mulberry neck-body fusion + lambskin pitch-drop transient
   * - Register-aware Santur Zard/Sefid + Felt/Wood mallet switching
   * - Register-aware Ney Bam/Ghays/Pas-Ghays breath modeling + delayed natural vibrato
   * - Phrase-connected Persian Malesh (`مالش`) micro-portamento using `prevFreqHz`
   */
  tryPlayRealSampleNote(opts: {
    ctx: AudioContext;
    frequency: number;
    durationSec: number;
    instrument: InstrumentId;
    volume: number;
    startTime: number;
    ornament?: OrnamentType;
    prevFreqHz?: number;
  }): (() => void) | null {
    const mode = sculptSettings.engineMode;
    if (mode === 'physical_v2') return null;

    const {
      ctx,
      frequency,
      durationSec,
      instrument,
      volume,
      startTime,
      ornament,
      prevFreqHz,
    } = opts;

    const isHybrid = mode === 'hybrid_studio';

    // 1. Resolve primary sample buffer (user custom sample overrides studio bank)
    const custom = this.getCustomAudioBuffer(ctx, instrument);
    let buffer: AudioBuffer | null = null;
    let baseRate = 1.0;
    let isSustained = instrument === 'ney' || instrument === 'kamancheh';
    let loopStartSec: number | undefined;
    let loopEndSec: number | undefined;
    let secondaryLayer: { buffer: AudioBuffer; playbackRate: number; mix: number } | null = null;

    if (custom) {
      buffer = custom.buffer;
      baseRate = Math.max(0.25, Math.min(4.0, frequency / custom.measuredHz));
    } else {
      if (!this.manifest) {
        void this.preloadInstrument(ctx, instrument);
        return null;
      }

      // Kamancheh Articulation Intelligence: fast short notes use real `kamancheh_stac` bow strokes!
      const useShortBow =
        instrument === 'kamancheh' &&
        durationSec <= 0.38 &&
        ornament !== 'tahrir' &&
        ornament !== 'riz';

      const primaryBankId = useShortBow
        ? 'kamancheh_stac'
        : INSTRUMENT_TO_SAMPLE_BANK[instrument];

      let resolved = this.resolveCachedZoneFromBank(primaryBankId, frequency);
      if (!resolved && useShortBow) {
        resolved = this.resolveCachedZoneFromBank('kamancheh', frequency);
      }
      if (!resolved && instrument === 'tar') {
        resolved = this.resolveCachedZoneFromBank('lute', frequency);
      }
      if (!resolved) {
        void this.preloadInstrument(ctx, instrument);
        return null;
      }

      buffer = resolved.buffer;
      baseRate = resolved.playbackRate;
      isSustained = resolved.sustained;
      loopStartSec = resolved.loopStartSec;
      loopEndSec = resolved.loopEndSec;

      // Tar Hybrid Fusion: blend real steel plectrum (`tar_plectrum`) with wooden neck-body (`lute`)
      if (isHybrid && instrument === 'tar' && primaryBankId === 'tar_plectrum') {
        const neckBody = this.resolveCachedZoneFromBank('lute', frequency);
        if (neckBody) {
          secondaryLayer = {
            buffer: neckBody.buffer,
            playbackRate: neckBody.playbackRate,
            mix: 0.42 + sculptSettings.bodyWarmth * 0.24,
          };
        }
      }
    }

    const activeSources: AudioBufferSourceNode[] = [];
    const profile = PERSIAN_BODY_PROFILES[instrument];
    const bodySpec = PERSIAN_BODY_IR_SPECS[instrument];

    // Subtle organic round-robin micro-variation (±0.75¢ max -> well within < ±1.5¢ precision)
    const rrIdx = (this.roundRobinCounters.get(`mel:${instrument}`) ?? 0) + 1;
    this.roundRobinCounters.set(`mel:${instrument}`, rrIdx);
    const microCents = sculptSettings.humanizeMicroCents ? ((rrIdx % 3) - 1) * 0.75 : 0;
    const rate = baseRate * Math.pow(2, microCents / 1200);

    // Register-aware physics helpers
    const isSanturSteel = instrument === 'santur' && frequency >= 520; // سیم سفید vs سیم زرد
    const isWoodMallet = instrument === 'santur' && sculptSettings.santurMallet === 'wood';
    const isNeyLowBam = instrument === 'ney' && frequency < 330;
    const isNeyHighPasGhays = instrument === 'ney' && frequency > 660;

    // Velocity-sensitive tone & amplitude response
    const velocity = Math.max(0.15, Math.min(1.0, volume));
    const safeVol = velocity * profile.gainTrim;
    const baseAttack =
      instrument === 'santur'
        ? isWoodMallet
          ? 0.0009
          : 0.0032
        : profile.attackSec;
    const attack = isHybrid ? baseAttack : Math.min(0.02, baseAttack);
    const totalDur = Math.max(0.16, durationSec);
    const release = Math.min(0.3, profile.releaseSec);

    // Output envelope -> 14-Mode Persian Instrument Body Convolution Bus -> Persian Hall Reverb!
    const outGain = ctx.createGain();
    outGain.gain.setValueAtTime(0.0001, startTime);
    outGain.gain.linearRampToValueAtTime(safeVol, startTime + Math.max(0.001, attack));

    if (isSustained) {
      // Natural human breath / bow swell contour
      outGain.gain.linearRampToValueAtTime(
        safeVol * 1.06,
        startTime + Math.min(totalDur * 0.42, 0.34)
      );
      outGain.gain.setValueAtTime(
        safeVol * 0.94,
        startTime + Math.max(attack + 0.04, totalDur - release)
      );
      outGain.gain.exponentialRampToValueAtTime(0.0008, startTime + totalDur + 0.06);
    } else {
      const sustainEnd = startTime + totalDur;
      outGain.gain.setValueAtTime(safeVol, startTime + Math.min(0.028, totalDur * 0.18));
      outGain.gain.exponentialRampToValueAtTime(Math.max(0.015, safeVol * 0.3), sustainEnd);
      outGain.gain.exponentialRampToValueAtTime(0.0008, sustainEnd + release);
    }

    // Build register-aware Persian acoustic EQ stage
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = profile.highpassHz;

    const peak1 = ctx.createBiquadFilter();
    peak1.type = 'peaking';
    const warmthScale = isHybrid ? 0.5 + sculptSettings.bodyWarmth * 0.85 : 0.2;
    peak1.frequency.value = profile.bodyPeak1Hz;
    peak1.Q.value = profile.bodyPeak1Q;
    peak1.gain.value =
      profile.bodyPeak1GainDb *
      warmthScale *
      (instrument === 'santur' && !isSanturSteel ? 1.25 : 1.0);

    const peak2 = ctx.createBiquadFilter();
    peak2.type = 'peaking';
    peak2.frequency.value = isSanturSteel ? 1950 : profile.bodyPeak2Hz;
    peak2.Q.value = profile.bodyPeak2Q;
    peak2.gain.value =
      profile.bodyPeak2GainDb *
      warmthScale *
      (isWoodMallet ? 1.2 : 1.0);

    const shelf = ctx.createBiquadFilter();
    shelf.type = 'highshelf';
    shelf.frequency.value = isWoodMallet ? 3200 : profile.shelfHz;
    const velBrightnessDb = (velocity - 0.72) * 3.8;
    const crispBias = (sculptSettings.attackCrispness - 0.5) * 4.5 + velBrightnessDb;
    const malletBoostDb = instrument === 'santur' ? (isWoodMallet ? 3.2 : -1.2) : 0;
    shelf.gain.value =
      (isHybrid ? profile.shelfGainDb : profile.shelfGainDb * 0.25) + crispBias + malletBoostDb;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    const rrFilterShift = sculptSettings.humanizeMicroCents ? ((rrIdx % 3) - 1) * 240 : 0;
    const registerLpOffset =
      instrument === 'santur'
        ? isWoodMallet
          ? 1200
          : isSanturSteel
            ? 450
            : -950
        : isNeyLowBam
          ? -850
          : isNeyHighPasGhays
            ? 750
            : 0;
    lp.frequency.value = Math.max(
      1700,
      Math.min(10200, profile.lowpassHz + rrFilterShift + registerLpOffset + crispBias * 240)
    );

    hp.connect(peak1);
    peak1.connect(peak2);
    peak2.connect(shelf);
    shelf.connect(lp);
    lp.connect(outGain);

    // Route through 12-to-14 Mode Physical Acoustic Body Convolution Bus in Hybrid mode!
    if (isHybrid && sculptSettings.bodyConvolverMix > 0.03) {
      const effectiveBodyMix = bodySpec.defaultWetMix * (0.35 + sculptSettings.bodyConvolverMix * 1.05);
      outGain.connect(getInstrumentBodyBus(ctx, instrument, effectiveBodyMix));
    } else {
      outGain.connect(getReverbInputNode(ctx));
    }

    // Determine authentic Persian Malesh (`مالش`) portamento start ratio when transitioning from prevFreqHz
    let maleshStartRatio: number | null = null;
    if (
      isHybrid &&
      sculptSettings.legatoMalesh &&
      profile.supportsMalesh &&
      !ornament &&
      typeof prevFreqHz === 'number' &&
      prevFreqHz > 40
    ) {
      const intervalCents = 1200 * Math.log2(frequency / prevFreqHz);
      if (Math.abs(intervalCents) >= 35 && Math.abs(intervalCents) <= 360) {
        // Approach from ~55% of the previous note interval so glide sounds lyrical & never muddy
        maleshStartRatio = Math.pow(2, (-intervalCents * 0.55) / 1200);
      }
    }

    const spawnSampleVoice = (
      voiceBuf: AudioBuffer,
      voiceStart: number,
      voiceRate: number,
      voiceGainVal: number,
      voiceEnd: number,
      allowLoop: boolean
    ) => {
      const src = ctx.createBufferSource();
      src.buffer = voiceBuf;
      src.playbackRate.setValueAtTime(voiceRate, voiceStart);

      if (
        allowLoop &&
        loopStartSec !== undefined &&
        loopEndSec !== undefined &&
        voiceEnd - voiceStart > 0.85
      ) {
        src.loop = true;
        src.loopStart = loopStartSec;
        src.loopEnd = loopEndSec;
      }

      // 1. Tar lambskin membrane transient pitch-drop (+4.2c -> 0c in 18ms on strong plucks!)
      if (isHybrid && instrument === 'tar' && !ornament && velocity > 0.55) {
        const dropCents = 2.5 + (velocity - 0.55) * 5.0;
        src.playbackRate.setValueAtTime(voiceRate * Math.pow(2, dropCents / 1200), voiceStart);
        src.playbackRate.exponentialRampToValueAtTime(voiceRate, voiceStart + 0.018);
      }

      // 2. Authentic Persian Malesh (`مالش`) glide from previous melody note
      if (maleshStartRatio !== null) {
        src.playbackRate.setValueAtTime(voiceRate * maleshStartRatio, voiceStart);
        src.playbackRate.exponentialRampToValueAtTime(
          voiceRate,
          voiceStart + Math.min(profile.maleshDurSec, totalDur * 0.32)
        );
      }

      // 3. Real-time Persian Ornaments (`اشاره`, `تکیه`, `تحریر`)
      if (ornament === 'eshareh') {
        const graceRate = voiceRate * Math.pow(2, 110 / 1200);
        src.playbackRate.setValueAtTime(graceRate, voiceStart);
        src.playbackRate.exponentialRampToValueAtTime(voiceRate, voiceStart + 0.055);
      } else if (ornament === 'tekieh') {
        const flickRate = voiceRate * Math.pow(2, 165 / 1200);
        src.playbackRate.setValueAtTime(voiceRate, voiceStart);
        src.playbackRate.exponentialRampToValueAtTime(flickRate, voiceStart + 0.045);
        src.playbackRate.exponentialRampToValueAtTime(voiceRate, voiceStart + 0.11);
      } else if (ornament === 'tahrir') {
        // Authentic ~5.8 Hz asymmetric Persian Tahrir glottal/bow break
        const steps = Math.max(4, Math.floor((voiceEnd - voiceStart) * 20));
        for (let s = 1; s <= steps; s++) {
          const dt = s / 20;
          if (voiceStart + dt >= voiceEnd) break;
          const phase = 2 * Math.PI * 5.8 * dt;
          const cents = Math.sin(phase) * 46 + (Math.sin(phase) > 0.7 ? 26 : 0);
          src.playbackRate.setTargetAtTime(
            voiceRate * Math.pow(2, cents / 1200),
            voiceStart + dt,
            0.013
          );
        }
      } else if (
        isHybrid &&
        allowLoop &&
        profile.vibratoRateHz > 0 &&
        sculptSettings.vibratoExpression > 0.08 &&
        totalDur >= 0.48
      ) {
        // 4. Delayed organic breath / bow vibrato on sustained Ney & Kamancheh notes
        //    (starts after 230ms so attack & tuning stay dead-center 0.0c!)
        const delaySec = 0.23;
        const maxDepth = profile.vibratoMaxCents * sculptSettings.vibratoExpression;
        const stepSec = 0.032;
        for (let dt = delaySec; dt < totalDur - 0.06; dt += stepSec) {
          const bloom = Math.min(1, (dt - delaySec) / 0.28);
          const cents = Math.sin(2 * Math.PI * profile.vibratoRateHz * (dt - delaySec)) * maxDepth * bloom;
          src.playbackRate.setTargetAtTime(
            voiceRate * Math.pow(2, cents / 1200),
            voiceStart + dt,
            0.016
          );
        }
      }

      const vg = ctx.createGain();
      vg.gain.setValueAtTime(voiceGainVal, voiceStart);
      src.connect(vg);
      vg.connect(hp);
      src.start(voiceStart);
      src.stop(voiceEnd + 0.05);
      activeSources.push(src);
    };

    const stopAt = startTime + totalDur + release;

    // Handle Dorab & Riz ornaments or normal multi-course / multi-layer performance
    if (ornament === 'dorab') {
      spawnSampleVoice(buffer, startTime, rate * Math.pow(2, -50 / 1200), 0.72, startTime + 0.12, false);
      spawnSampleVoice(buffer, startTime + 0.065, rate * Math.pow(2, 100 / 1200), 0.78, startTime + 0.19, false);
      spawnSampleVoice(buffer, startTime + 0.13, rate, 1.0, stopAt, isSustained);
    } else if (ornament === 'riz') {
      const stepSec = 0.068;
      const count = Math.max(3, Math.min(14, Math.floor(totalDur / stepSec)));
      for (let i = 0; i < count; i++) {
        const t = startTime + i * stepSec;
        const altGain = i % 2 === 0 ? 0.92 : 0.74;
        const altRate = rate * Math.pow(2, (i % 2 === 0 ? 0.55 : -0.55) / 1200);
        spawnSampleVoice(buffer, t, altRate, altGain, Math.min(stopAt, t + stepSec * 3.4), false);
      }
    } else {
      // Primary studio sample voice
      spawnSampleVoice(buffer, startTime, rate, secondaryLayer ? 0.76 : 1.0, stopAt, isSustained);

      // Tar Hybrid Wooden Neck-Body Secondary Layer (fuses steel plectrum crispness with carved mulberry punch!)
      if (secondaryLayer) {
        spawnSampleVoice(
          secondaryLayer.buffer,
          startTime + 0.0012,
          secondaryLayer.playbackRate * Math.pow(2, microCents / 1200),
          secondaryLayer.mix,
          stopAt,
          false
        );
      }

      // Double-course / Quad-course & Sympathetic Wa-Khan / Moshtagh Shimmer
      if (isHybrid && profile.dualCourseChorus && sculptSettings.sympatheticShimmer > 0.04) {
        const shimmerAmt = profile.courseMix * (0.35 + sculptSettings.sympatheticShimmer * 0.95);
        const detuneRatio = Math.pow(2, profile.courseDetuneCents / 1200);
        spawnSampleVoice(
          buffer,
          startTime + profile.courseDelaySec,
          rate * detuneRatio,
          shimmerAmt * 0.52,
          stopAt,
          false
        );

        // Quad-course concert Santur third voice + Kermanshah Tanbur cascading Shorr accent!
        if (instrument === 'santur' || instrument === 'tanbur' || instrument === 'setar') {
          const thirdDelay =
            instrument === 'tanbur' && velocity >= 0.85
              ? 0.016 // Authentic subtle Kermanshah Shorr cascading finger strum
              : profile.courseDelaySec * 2.2;
          spawnSampleVoice(
            buffer,
            startTime + thirdDelay,
            rate / detuneRatio,
            shimmerAmt * (isSanturSteel ? 0.44 : 0.32),
            stopAt,
            false
          );
        }

        // Delicate sympathetic octave Moshtagh bloom on Setar & Tanbur
        if ((instrument === 'setar' || instrument === 'tanbur') && sculptSettings.sympatheticShimmer > 0.3) {
          spawnSampleVoice(
            buffer,
            startTime + 0.008,
            Math.min(4.0, rate * 2.0),
            0.09 * sculptSettings.sympatheticShimmer,
            stopAt,
            false
          );
        }
      }
    }

    // Acoustic Articulation Layer (Mezrab snap / Felt or Wood Santur mallet / Register-Adaptive Ney Breath / Kamancheh Rosin)
    if (isHybrid && profile.transientType !== 'none') {
      const isBreath = profile.transientType === 'breath';
      const isRosin = profile.transientType === 'rosin';
      const controlAmt = isBreath ? sculptSettings.neyBreathiness : sculptSettings.attackCrispness;

      if (controlAmt > 0.05) {
        const registerBreathBoost = isNeyLowBam ? 1.38 : isNeyHighPasGhays ? 1.15 : 1.0;
        const malletLevelBoost = instrument === 'santur' ? (isWoodMallet ? 1.45 : 0.72) : 1.0;
        const level =
          profile.transientLevel *
          (0.32 + controlAmt * 1.15) *
          (isBreath ? registerBreathBoost : malletLevelBoost);

        const isContinuous = isBreath || isRosin;
        const noiseDur = isContinuous ? Math.min(totalDur, 1.55) : isWoodMallet ? 0.015 : 0.022;
        const nLen = Math.max(64, Math.floor(ctx.sampleRate * noiseDur));
        const nBuf = ctx.createBuffer(1, nLen, ctx.sampleRate);
        const ch = nBuf.getChannelData(0);
        let pink = 0;
        for (let i = 0; i < nLen; i++) {
          const white = Math.random() * 2 - 1;
          pink = 0.76 * pink + 0.24 * white;
          let env: number;
          if (isBreath) {
            // Strong initial Posht-e Dandan lip-edge chiff settling into velvety continuous air trail
            const t = i / ctx.sampleRate;
            const attackFade = Math.min(1, t / 0.028);
            const chiffBurst = 0.42 + 0.58 * Math.exp(-t * 8.5);
            const endFade = Math.min(1, (nLen - i) / Math.max(1, ctx.sampleRate * 0.08));
            env = attackFade * chiffBurst * endFade;
          } else if (isRosin) {
            // Initial horsehair bow-catch bite settling into subtle silk bow air
            const t = i / ctx.sampleRate;
            env =
              Math.min(1, t / 0.018) *
              (0.32 + 0.68 * Math.exp(-t * 14)) *
              Math.min(1, (nLen - i) / Math.max(1, ctx.sampleRate * 0.06));
          } else {
            env = Math.exp(-i / (nLen * (isWoodMallet ? 0.18 : 0.28)));
          }
          ch[i] = (isBreath ? pink : white) * env;
        }

        const nSrc = ctx.createBufferSource();
        nSrc.buffer = nBuf;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = isBreath
          ? Math.max(850, Math.min(3600, frequency * (isNeyLowBam ? 2.4 : 2.9)))
          : isWoodMallet
            ? 4350
            : profile.transientCenterHz;
        bp.Q.value = isBreath ? 1.5 : isWoodMallet ? 2.1 : 2.5;

        const ng = ctx.createGain();
        ng.gain.setValueAtTime(level * velocity, startTime);
        if (!isContinuous) {
          ng.gain.exponentialRampToValueAtTime(0.0005, startTime + noiseDur);
        }

        nSrc.connect(bp);
        bp.connect(ng);
        ng.connect(outGain);
        nSrc.start(startTime);
        nSrc.stop(startTime + noiseDur + 0.01);
        activeSources.push(nSrc);
      }
    }

    return () => {
      for (const s of activeSources) {
        try {
          s.stop();
        } catch {
          // already finished
        }
      }
    };
  }
}

export const acousticSampleBank = new AcousticSampleBankManager();
