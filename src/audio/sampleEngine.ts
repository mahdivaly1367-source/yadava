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
  SoundEngineMode,
} from '../types/music';
import { getReverbInputNode } from './hallReverb';

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

export const INSTRUMENT_TO_SAMPLE_BANK: Record<InstrumentId, string> = {
  tar: 'lute',
  setar: 'lute',
  tanbur: 'lute',
  santur: 'santur',
  oud: 'oud',
  kamancheh: 'kamancheh',
  ney: 'ney',
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
    source: 'sinak/zarbsaz — برگرفته از ضبط زنده «Tombak, Alireza.mp3» (sonsbcnintercultural, Freesound #256123)',
    license: 'CC BY 3.0',
    url: 'https://github.com/sinak/zarbsaz',
  },
  {
    id: 'vcsl-acoustic',
    titleFa: 'بانک آکوستیک ورسلیان (VCSL — کوردوفون، دف و بادی چوبی)',
    instrumentsFa: 'دف، سنتور، تار، سه‌تار، عود، تنبور و نی هفت‌بند',
    source: 'Versilian Community Sample Library (Versilian Studios LLC / sgossner/VCSL)',
    license: 'CC0 1.0 (مالکیت عمومی)',
    url: 'https://github.com/sgossner/VCSL',
  },
  {
    id: 'sfz-erhu',
    titleFa: 'سمپل‌های زهی آرشه‌ای با کاسه پوستی (Spike-Fiddle)',
    instrumentsFa: 'کمانچه ایرانی (آرشه‌ای با پوست کشیده‌شده)',
    source: 'sfzinstruments/aliexpress-erhu (ضبط استودیویی نزدیک‌میکروفون)',
    license: 'CC0 1.0 (مالکیت عمومی)',
    url: 'https://github.com/sfzinstruments/aliexpress-erhu',
  },
];

const SETTINGS_STORAGE_KEY = 'navanegar_acoustic_sculpt_v2';

export const DEFAULT_ACOUSTIC_SCULPT: AcousticSculptSettings = {
  engineMode: 'hybrid_studio',
  bodyWarmth: 0.62,
  attackCrispness: 0.58,
  sympatheticShimmer: 0.45,
  humanizeMicroCents: true,
};

let sculptSettings: AcousticSculptSettings = loadSculptSettings();

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
    return {
      engineMode: mode,
      bodyWarmth: clamp01(parsed.bodyWarmth ?? DEFAULT_ACOUSTIC_SCULPT.bodyWarmth),
      attackCrispness: clamp01(parsed.attackCrispness ?? DEFAULT_ACOUSTIC_SCULPT.attackCrispness),
      sympatheticShimmer: clamp01(
        parsed.sympatheticShimmer ?? DEFAULT_ACOUSTIC_SCULPT.sympatheticShimmer
      ),
      humanizeMicroCents:
        typeof parsed.humanizeMicroCents === 'boolean'
          ? parsed.humanizeMicroCents
          : DEFAULT_ACOUSTIC_SCULPT.humanizeMicroCents,
    };
  } catch {
    return { ...DEFAULT_ACOUSTIC_SCULPT };
  }
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0.5));
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
  gainTrim: number;
}

/**
 * Hand-crafted Persian Acoustic Body Formant Profiles for all 7 melodic instruments.
 * Sculpts real studio multi-samples into unmistakable authentic Persian acoustic voices.
 */
export const PERSIAN_BODY_PROFILES: Record<InstrumentId, PersianBodyAcousticProfile> = {
  tar: {
    bodyPeak1Hz: 195,
    bodyPeak1GainDb: 3.6, // Stretched lambskin membrane resonance (پوست بره)
    bodyPeak1Q: 2.1,
    bodyPeak2Hz: 980,
    bodyPeak2GainDb: 4.2, // Double-bowl mulberry punch & bite
    bodyPeak2Q: 2.3,
    highpassHz: 95,
    lowpassHz: 6200,
    shelfHz: 3400,
    shelfGainDb: 2.4, // Crisp brass/horn mezrab attack
    attackSec: 0.002,
    releaseSec: 0.14,
    dualCourseChorus: true, // Double-course unison strings
    courseDetuneCents: 1.15,
    courseDelaySec: 0.0024,
    courseMix: 0.42,
    transientType: 'mezrab',
    transientCenterHz: 2950,
    transientLevel: 0.18,
    gainTrim: 0.94,
  },
  setar: {
    bodyPeak1Hz: 255,
    bodyPeak1GainDb: 3.0, // Delicate hollow mulberry wood warmth
    bodyPeak1Q: 1.9,
    bodyPeak2Hz: 1360,
    bodyPeak2GainDb: 3.6, // Intimate poetic nasal Setar formant
    bodyPeak2Q: 2.5,
    highpassHz: 115,
    lowpassHz: 4900,
    shelfHz: 2800,
    shelfGainDb: 0.8,
    attackSec: 0.003,
    releaseSec: 0.18,
    dualCourseChorus: true, // Subtle sympathetic Moshtagh string glow
    courseDetuneCents: 0.85,
    courseDelaySec: 0.003,
    courseMix: 0.24,
    transientType: 'mezrab',
    transientCenterHz: 2400,
    transientLevel: 0.1,
    gainTrim: 0.9,
  },
  santur: {
    bodyPeak1Hz: 185,
    bodyPeak1GainDb: 3.2, // Walnut trapezoidal soundbox Helmholtz warmth
    bodyPeak1Q: 1.9,
    bodyPeak2Hz: 1680,
    bodyPeak2GainDb: 3.5, // Shimmering quad-course bronze/steel harp chorus
    bodyPeak2Q: 2.1,
    highpassHz: 105,
    lowpassHz: 7600,
    shelfHz: 3900,
    shelfGainDb: 2.6,
    attackSec: 0.0015,
    releaseSec: 0.24,
    dualCourseChorus: true, // Signature quad-course Santur sparkle
    courseDetuneCents: 1.25,
    courseDelaySec: 0.0016,
    courseMix: 0.48,
    transientType: 'mallet',
    transientCenterHz: 3500,
    transientLevel: 0.16,
    gainTrim: 0.92,
  },
  ney: {
    bodyPeak1Hz: 660,
    bodyPeak1GainDb: 3.8, // Hollow giant-cane tube resonance (نی هفت‌بند)
    bodyPeak1Q: 2.0,
    bodyPeak2Hz: 1920,
    bodyPeak2GainDb: 2.6, // Persian edge-blown upper reed tone
    bodyPeak2Q: 2.4,
    highpassHz: 140,
    lowpassHz: 4600,
    shelfHz: 2900,
    shelfGainDb: -1.4,
    attackSec: 0.042,
    releaseSec: 0.16,
    dualCourseChorus: false,
    courseDetuneCents: 0,
    courseDelaySec: 0,
    courseMix: 0,
    transientType: 'breath', // Authentic Posht-e Dandan air-chiff layer
    transientCenterHz: 1850,
    transientLevel: 0.14,
    gainTrim: 0.88,
  },
  kamancheh: {
    bodyPeak1Hz: 355,
    bodyPeak1GainDb: 4.0, // Fish-skin membrane & spherical mulberry bowl
    bodyPeak1Q: 2.1,
    bodyPeak2Hz: 1400,
    bodyPeak2GainDb: 3.4, // Singing human vocal Kamancheh formant
    bodyPeak2Q: 2.5,
    highpassHz: 120,
    lowpassHz: 5800,
    shelfHz: 3600,
    shelfGainDb: 1.5,
    attackSec: 0.048,
    releaseSec: 0.18,
    dualCourseChorus: false,
    courseDetuneCents: 0,
    courseDelaySec: 0,
    courseMix: 0,
    transientType: 'rosin',
    transientCenterHz: 2650,
    transientLevel: 0.08,
    gainTrim: 0.9,
  },
  oud: {
    bodyPeak1Hz: 142,
    bodyPeak1GainDb: 4.6, // Deep walnut pear-shell cavity (عود / بربت)
    bodyPeak1Q: 1.7,
    bodyPeak2Hz: 420,
    bodyPeak2GainDb: 3.4, // Warm singing wood belly
    bodyPeak2Q: 1.6,
    highpassHz: 75,
    lowpassHz: 3500, // Mellow risha feather-plectrum rolloff
    shelfHz: 2400,
    shelfGainDb: -2.2,
    attackSec: 0.003,
    releaseSec: 0.16,
    dualCourseChorus: true, // Double-course nylon/gut unison fullness
    courseDetuneCents: 0.95,
    courseDelaySec: 0.0028,
    courseMix: 0.36,
    transientType: 'mezrab',
    transientCenterHz: 1750,
    transientLevel: 0.09,
    gainTrim: 0.96,
  },
  tanbur: {
    bodyPeak1Hz: 188,
    bodyPeak1GainDb: 4.4, // Sacred Kermanshah carved mulberry pear body
    bodyPeak1Q: 1.9,
    bodyPeak2Hz: 620,
    bodyPeak2GainDb: 3.6, // Mystical nasal chest formant
    bodyPeak2Q: 2.1,
    highpassHz: 85,
    lowpassHz: 4200,
    shelfHz: 2700,
    shelfGainDb: -0.8,
    attackSec: 0.0025,
    releaseSec: 0.2,
    dualCourseChorus: true, // Sacred twin unison melody strings
    courseDetuneCents: 1.1,
    courseDelaySec: 0.0022,
    courseMix: 0.44,
    transientType: 'mezrab',
    transientCenterHz: 2150,
    transientLevel: 0.11,
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
    // Invalidate decoded cache for this instrument
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

  private getCustomAudioBuffer(ctx: AudioContext, instrument: InstrumentId): {
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
    const bankId = INSTRUMENT_TO_SAMPLE_BANK[instrument];
    const bank = manifest.melodicBanks[bankId];
    if (!bank) return false;

    const results = await Promise.all(
      bank.zones.map((z) => this.fetchAndDecode(ctx, z.file))
    );
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
      return { loadedFiles: this.bufferCache.size, totalFiles: 45, readyBanks: 0 };
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

  /**
   * Attempts to get a decoded round-robin percussion sample synchronously.
   * Triggers background preloading if not yet cached.
   */
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

    // Try any already-decoded variant while loading all in background
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

  /**
   * Plays a microtonally exact note using real studio multi-samples (or user custom sample)
   * with full Persian body sculpting and ornament playbackRate automation.
   * Returns a stop() handle if sample playback succeeded, or null so caller falls back cleanly to Physical v2.
   */
  tryPlayRealSampleNote(opts: {
    ctx: AudioContext;
    frequency: number;
    durationSec: number;
    instrument: InstrumentId;
    volume: number;
    startTime: number;
    ornament?: OrnamentType;
  }): (() => void) | null {
    const mode = sculptSettings.engineMode;
    if (mode === 'physical_v2') return null;

    const { ctx, frequency, durationSec, instrument, volume, startTime, ornament } = opts;

    // 1. Check user custom sample first
    const custom = this.getCustomAudioBuffer(ctx, instrument);
    let buffer: AudioBuffer | null = null;
    let baseRate = 1.0;
    let isSustained = instrument === 'ney' || instrument === 'kamancheh';
    let loopStartSec: number | undefined;
    let loopEndSec: number | undefined;

    if (custom) {
      buffer = custom.buffer;
      baseRate = Math.max(0.25, Math.min(4.0, frequency / custom.measuredHz));
    } else {
      if (!this.manifest) {
        void this.preloadInstrument(ctx, instrument);
        return null;
      }
      const bankId = INSTRUMENT_TO_SAMPLE_BANK[instrument];
      const bank = this.manifest.melodicBanks[bankId];
      if (!bank) return null;

      const selected = selectBestSampleZone(bank.zones, frequency);
      if (!selected) return null;

      buffer = this.bufferCache.get(selected.zone.file) ?? null;
      if (!buffer) {
        // Check if a neighboring zone is already cached while background preloading finishes
        const cachedZones = bank.zones.filter((z) => this.bufferCache.has(z.file));
        if (cachedZones.length === 0) {
          void this.preloadInstrument(ctx, instrument);
          return null;
        }
        const alt = selectBestSampleZone(cachedZones, frequency);
        if (!alt) return null;
        buffer = this.bufferCache.get(alt.zone.file) ?? null;
        if (!buffer) return null;
        baseRate = alt.playbackRate;
        loopStartSec = alt.zone.loopStartSec;
        loopEndSec = alt.zone.loopEndSec;
        void this.preloadInstrument(ctx, instrument);
      } else {
        baseRate = selected.playbackRate;
        loopStartSec = selected.zone.loopStartSec;
        loopEndSec = selected.zone.loopEndSec;
      }
      isSustained = bank.sustained;
    }

    const activeSources: AudioBufferSourceNode[] = [];
    const profile = PERSIAN_BODY_PROFILES[instrument];
    const isHybrid = mode === 'hybrid_studio';

    // Subtle organic round-robin micro-variation (±0.9¢ max -> keeps < ±1.5¢ precision!)
    const rrIdx = (this.roundRobinCounters.get(`mel:${instrument}`) ?? 0) + 1;
    this.roundRobinCounters.set(`mel:${instrument}`, rrIdx);
    const microCents = sculptSettings.humanizeMicroCents
      ? ((rrIdx % 3) - 1) * 0.75
      : 0;
    const rate = baseRate * Math.pow(2, microCents / 1200);

    // Master output chain -> Persian Hall Reverb
    const outGain = ctx.createGain();
    const safeVol = Math.max(0.05, Math.min(1.0, volume)) * profile.gainTrim;
    const attack = isHybrid ? profile.attackSec : Math.min(0.02, profile.attackSec);
    const totalDur = Math.max(0.18, durationSec);
    const release = Math.min(0.28, profile.releaseSec);

    outGain.gain.setValueAtTime(0.0001, startTime);
    outGain.gain.linearRampToValueAtTime(safeVol, startTime + Math.max(0.002, attack));
    if (isSustained) {
      // Natural breath / bow swell on sustained notes
      outGain.gain.linearRampToValueAtTime(
        safeVol * 1.04,
        startTime + Math.min(totalDur * 0.45, 0.35)
      );
      outGain.gain.setValueAtTime(safeVol * 0.94, startTime + Math.max(attack + 0.04, totalDur - release));
      outGain.gain.exponentialRampToValueAtTime(0.0008, startTime + totalDur + 0.06);
    } else {
      // Natural plucked / hammered decay curve
      const sustainEnd = startTime + totalDur;
      outGain.gain.setValueAtTime(safeVol, startTime + Math.min(0.03, totalDur * 0.2));
      outGain.gain.exponentialRampToValueAtTime(
        Math.max(0.015, safeVol * 0.28),
        sustainEnd
      );
      outGain.gain.exponentialRampToValueAtTime(0.0008, sustainEnd + release);
    }

    // Build Persian Acoustic Body Filter Chain
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = profile.highpassHz;

    const peak1 = ctx.createBiquadFilter();
    peak1.type = 'peaking';
    const warmthScale = isHybrid ? 0.55 + sculptSettings.bodyWarmth * 0.9 : 0.25;
    peak1.frequency.value = profile.bodyPeak1Hz;
    peak1.Q.value = profile.bodyPeak1Q;
    peak1.gain.value = profile.bodyPeak1GainDb * warmthScale;

    const peak2 = ctx.createBiquadFilter();
    peak2.type = 'peaking';
    peak2.frequency.value = profile.bodyPeak2Hz;
    peak2.Q.value = profile.bodyPeak2Q;
    peak2.gain.value = profile.bodyPeak2GainDb * warmthScale;

    const shelf = ctx.createBiquadFilter();
    shelf.type = 'highshelf';
    shelf.frequency.value = profile.shelfHz;
    const crispBias = (sculptSettings.attackCrispness - 0.5) * 4.5;
    shelf.gain.value = (isHybrid ? profile.shelfGainDb : profile.shelfGainDb * 0.3) + crispBias;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    // Gentle timbre variation per round-robin stroke (simulates real hand position on string)
    const rrFilterShift = sculptSettings.humanizeMicroCents ? ((rrIdx % 3) - 1) * 260 : 0;
    lp.frequency.value = Math.max(1800, profile.lowpassHz + rrFilterShift + crispBias * 280);

    hp.connect(peak1);
    peak1.connect(peak2);
    peak2.connect(shelf);
    shelf.connect(lp);
    lp.connect(outGain);
    outGain.connect(getReverbInputNode(ctx));

    // Helper to spawn a pitch-automated real-sample voice
    const spawnSampleVoice = (
      voiceStart: number,
      voiceRate: number,
      voiceGainVal: number,
      voiceEnd: number
    ) => {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.setValueAtTime(voiceRate, voiceStart);

      if (isSustained && loopStartSec !== undefined && loopEndSec !== undefined && voiceEnd - voiceStart > 0.9) {
        src.loop = true;
        src.loopStart = loopStartSec;
        src.loopEnd = loopEndSec;
      }

      // Apply authentic Persian ornaments via real-time playbackRate curves!
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
        // Authentic ~5.8 Hz Persian Tahrir oscillation (+75c / -25c break character)
        const steps = Math.max(4, Math.floor((voiceEnd - voiceStart) * 18));
        for (let s = 1; s <= steps; s++) {
          const dt = (s / 18);
          if (voiceStart + dt >= voiceEnd) break;
          const phase = 2 * Math.PI * 5.8 * dt;
          const cents = Math.sin(phase) * 48 + (Math.sin(phase) > 0.72 ? 22 : 0);
          src.playbackRate.setTargetAtTime(
            voiceRate * Math.pow(2, cents / 1200),
            voiceStart + dt,
            0.014
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

    // Handle Dorab (fast 3-stroke ornament) & Riz (rapid alternating tremolo) on real samples!
    if (ornament === 'dorab') {
      spawnSampleVoice(startTime, rate * Math.pow(2, -50 / 1200), 0.72, startTime + 0.12);
      spawnSampleVoice(startTime + 0.065, rate * Math.pow(2, 100 / 1200), 0.78, startTime + 0.19);
      spawnSampleVoice(startTime + 0.13, rate, 1.0, stopAt);
    } else if (ornament === 'riz') {
      const stepSec = 0.072;
      const count = Math.max(3, Math.min(12, Math.floor(totalDur / stepSec)));
      for (let i = 0; i < count; i++) {
        const t = startTime + i * stepSec;
        const altGain = i % 2 === 0 ? 0.92 : 0.74; // Rast / Chap mezrab alternation
        const altRate = rate * Math.pow(2, (i % 2 === 0 ? 0.5 : -0.5) / 1200);
        spawnSampleVoice(t, altRate, altGain, Math.min(stopAt, t + stepSec * 3.2));
      }
    } else {
      // Main studio sample voice
      spawnSampleVoice(startTime, rate, 1.0, stopAt);

      // Hybrid Mode: Double-course unison shimmer (Tar, Santur, Oud, Tanbur, Setar)
      if (isHybrid && profile.dualCourseChorus && sculptSettings.sympatheticShimmer > 0.04) {
        const shimmerAmt = profile.courseMix * (0.35 + sculptSettings.sympatheticShimmer * 0.95);
        const detuneRatio = Math.pow(2, profile.courseDetuneCents / 1200);
        spawnSampleVoice(
          startTime + profile.courseDelaySec,
          rate * detuneRatio,
          shimmerAmt * 0.55,
          stopAt
        );
        // Sympathetic octave/5th halo on high shimmer for Santur/Tanbur/Setar
        if (sculptSettings.sympatheticShimmer > 0.35 && (instrument === 'santur' || instrument === 'tanbur' || instrument === 'setar')) {
          spawnSampleVoice(
            startTime + profile.courseDelaySec * 2.1,
            rate / detuneRatio,
            shimmerAmt * 0.35,
            stopAt
          );
        }
      }
    }

    // Hybrid Mode: Acoustic Articulation Layer (Mezrab pick / Santur mallet / Ney breath chiff / Kamancheh bow rosin)
    if (isHybrid && profile.transientType !== 'none' && sculptSettings.attackCrispness > 0.05) {
      const level = profile.transientLevel * (0.35 + sculptSettings.attackCrispness * 1.15);
      const isContinuous = profile.transientType === 'breath' || profile.transientType === 'rosin';
      const noiseDur = isContinuous ? Math.min(totalDur, 1.4) : 0.022;
      const nLen = Math.max(64, Math.floor(ctx.sampleRate * noiseDur));
      const nBuf = ctx.createBuffer(1, nLen, ctx.sampleRate);
      const ch = nBuf.getChannelData(0);
      let pink = 0;
      for (let i = 0; i < nLen; i++) {
        const white = Math.random() * 2 - 1;
        pink = 0.72 * pink + 0.28 * white;
        const env = isContinuous
          ? Math.min(1, i / (ctx.sampleRate * 0.06)) * Math.exp(-i / (nLen * 1.1))
          : Math.exp(-i / (nLen * 0.25));
        ch[i] = (profile.transientType === 'breath' ? pink : white) * env;
      }

      const nSrc = ctx.createBufferSource();
      nSrc.buffer = nBuf;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value =
        profile.transientType === 'breath'
          ? Math.max(900, Math.min(3400, frequency * 2.8))
          : profile.transientCenterHz;
      bp.Q.value = profile.transientType === 'breath' ? 1.6 : 2.4;

      const ng = ctx.createGain();
      ng.gain.setValueAtTime(level, startTime);
      ng.gain.exponentialRampToValueAtTime(0.0005, startTime + noiseDur);

      nSrc.connect(bp);
      bp.connect(ng);
      ng.connect(outGain);
      nSrc.start(startTime);
      nSrc.stop(startTime + noiseDur + 0.01);
      activeSources.push(nSrc);
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
