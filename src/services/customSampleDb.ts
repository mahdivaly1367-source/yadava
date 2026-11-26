import { detectPitchYin } from '../audio/dsp';
import type { CustomInstrumentSampleMeta, InstrumentId } from '../types/music';

const DB_NAME = 'navanegar-custom-samples-db';
const DB_VERSION = 1;
const STORE_NAME = 'customSamples';

export interface StoredCustomSample {
  meta: CustomInstrumentSampleMeta;
  pcm: Float32Array;
}

const memoryFallback = new Map<InstrumentId, StoredCustomSample>();

function openCustomSampleDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'instrument' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Pure deterministic PCM preprocessor for user-uploaded real acoustic instrument recordings:
 * - Removes DC offset
 * - Trims leading dead silence (retaining 3ms attack preroll)
 * - Caps length to 3.0 seconds with smooth cosine tail fade
 * - Peak-normalizes to -1.5 dBFS (0.84)
 * - Measures true concert pitch via multi-window median YIN
 */
export function prepareAndCalibrateUserSample(
  rawPcm: Float32Array,
  sampleRate: number,
  overrideHz?: number
): { pcm: Float32Array; measuredHz: number; durationSec: number } {
  const n = rawPcm.length;
  if (n < 256) {
    throw new Error('فایل صوتی بسیار کوتاه است (حداقل ۰.۲ ثانیه صدا لازم است).');
  }

  let sum = 0;
  for (let i = 0; i < n; i++) sum += rawPcm[i];
  const mean = sum / n;

  let peak = 0;
  const centered = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const v = rawPcm[i] - mean;
    centered[i] = v;
    const a = Math.abs(v);
    if (a > peak) peak = a;
  }
  if (peak < 1e-4) {
    throw new Error('سطح صدای فایل بسیار ضعیف یا کاملاً ساکت است.');
  }

  // Trim leading silence
  const onsetThresh = peak * 0.015;
  let startIdx = 0;
  for (let i = 0; i < n; i++) {
    if (Math.abs(centered[i]) >= onsetThresh) {
      startIdx = Math.max(0, i - Math.floor(sampleRate * 0.003));
      break;
    }
  }

  const maxLen = Math.min(n - startIdx, Math.floor(sampleRate * 3.0));
  const out = new Float32Array(maxLen);
  const gain = 0.84 / peak;
  for (let i = 0; i < maxLen; i++) {
    out[i] = centered[startIdx + i] * gain;
  }

  // Anti-click 2ms fade-in + 45ms cosine fade-out
  const fadeIn = Math.min(out.length, Math.floor(sampleRate * 0.002));
  for (let i = 0; i < fadeIn; i++) {
    out[i] *= i / Math.max(1, fadeIn);
  }
  const fadeOut = Math.min(Math.floor(out.length / 3), Math.floor(sampleRate * 0.045));
  for (let i = 0; i < fadeOut; i++) {
    const t = i / Math.max(1, fadeOut);
    out[out.length - fadeOut + i] *= 0.5 * (1 + Math.cos(Math.PI * t));
  }

  // Multi-window median YIN pitch estimation across steady-state core
  let measuredHz = overrideHz && Number.isFinite(overrideHz) && overrideHz > 55 && overrideHz < 2200
    ? overrideHz
    : 0;

  if (!measuredHz) {
    const winSize = Math.min(4096, Math.max(1024, Math.floor(out.length / 2)));
    const pitches: number[] = [];
    const offsets = [0.12, 0.24, 0.36, 0.5];
    for (const frac of offsets) {
      const off = Math.min(Math.max(0, Math.floor(out.length * frac)), Math.max(0, out.length - winSize));
      if (off + winSize <= out.length) {
        const res = detectPitchYin(out.subarray(off, off + winSize), sampleRate, {
          rmsThreshold: 0.003,
          minFreq: 65,
          maxFreq: 1800,
        });
        if (res.frequency && res.clarity >= 0.45) {
          pitches.push(res.frequency);
        }
      }
    }
    if (pitches.length === 0) {
      measuredHz = 293.66; // fallback D4 if percussive/ambiguous
    } else {
      pitches.sort((a, b) => a - b);
      measuredHz = pitches[Math.floor(pitches.length / 2)];
    }
  }

  return {
    pcm: out,
    measuredHz: Math.round(measuredHz * 100) / 100,
    durationSec: Math.round((out.length / sampleRate) * 1000) / 1000,
  };
}

export async function saveCustomInstrumentSample(sample: StoredCustomSample): Promise<void> {
  memoryFallback.set(sample.meta.instrument, sample);
  const db = await openCustomSampleDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({
        instrument: sample.meta.instrument,
        meta: sample.meta,
        pcm: sample.pcm.buffer.slice(
          sample.pcm.byteOffset,
          sample.pcm.byteOffset + sample.pcm.byteLength
        ),
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function deleteCustomInstrumentSample(instrument: InstrumentId): Promise<void> {
  memoryFallback.delete(instrument);
  const db = await openCustomSampleDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(instrument);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function loadAllCustomInstrumentSamples(): Promise<Map<InstrumentId, StoredCustomSample>> {
  const result = new Map<InstrumentId, StoredCustomSample>(memoryFallback);
  const db = await openCustomSampleDb();
  if (!db) return result;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => {
        const rows = (req.result ?? []) as Array<{
          instrument: InstrumentId;
          meta: CustomInstrumentSampleMeta;
          pcm: ArrayBuffer;
        }>;
        for (const row of rows) {
          if (row?.meta && row?.pcm) {
            const stored: StoredCustomSample = {
              meta: row.meta,
              pcm: new Float32Array(row.pcm),
            };
            result.set(row.instrument, stored);
            memoryFallback.set(row.instrument, stored);
          }
        }
        resolve(result);
      };
      req.onerror = () => resolve(result);
    } catch {
      resolve(result);
    }
  });
}
