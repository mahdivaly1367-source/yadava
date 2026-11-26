import { noteToFrequency } from '../data/musicTheory';
import type {
  DroneVoicing,
  Gusheh,
  InstrumentId,
  IranianGrooveId,
  KoronMode,
  PercussionInstrument,
} from '../types/music';
import { computeDroneFrequencies } from './drone';
import { applyOfflineHallReverb, type HallReverbPresetId } from './hallReverb';
import { synthesizeKarplusStrongSamples } from './karplusStrong';
import { expandNoteWithOrnaments } from './ornamentEngine';
import { IRANIAN_GROOVES, type StrokeType } from './percussion';

export interface EnsembleMixdownOptions {
  gusheh: Gusheh;
  instrument: InstrumentId;
  a4Hz: number;
  koronMode: KoronMode;
  bpm: number;
  enableOrnaments: boolean;
  reverbPreset: HallReverbPresetId;
  // Track volumes 0..1 (0 = muted)
  melodyVolume: number;
  droneVolume: number;
  droneVoicing: DroneVoicing;
  percussionVolume: number;
  percussionInstrument: PercussionInstrument;
  grooveId: IranianGrooveId;
  recordingVolume: number;
  recordingPcm?: Float32Array | null;
  recordingSampleRate?: number;
  sampleRate?: number;
}

export interface EnsembleMixdownResult {
  wavBlob: Blob;
  wavBytes: Uint8Array;
  durationSec: number;
  sampleRate: number;
  peakLevel: number;
}

/**
 * Deterministic offline PCM synthesizer for a single Iranian Tombak / Daf stroke.
 */
function synthesizeOfflineStroke(
  stroke: StrokeType,
  instrument: PercussionInstrument,
  sampleRate: number
): Float32Array {
  if (stroke === 'rest') return new Float32Array(0);
  const durSec = stroke === 'tom' ? 0.24 : stroke === 'riz' ? 0.16 : 0.13;
  const len = Math.floor(durSec * sampleRate);
  const out = new Float32Array(len);
  const isDaf = instrument === 'daf';
  let seed = 0x13572468 + len;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return (seed / 0xffffffff) * 2 - 1;
  };

  for (let i = 0; i < len; i++) {
    const t = i / sampleRate;
    if (stroke === 'tom') {
      const f0 = isDaf ? 78 : 112;
      const pitchDrop = f0 * (1 + 0.55 * Math.exp(-t * 36));
      const env = Math.exp(-t * (isDaf ? 11 : 15));
      const body = Math.sin(2 * Math.PI * pitchDrop * t) * env * 0.85;
      const skin = rand() * Math.exp(-t * 65) * 0.18;
      out[i] = body + skin;
    } else if (stroke === 'bak') {
      const f = isDaf ? 290 : 380;
      const env = Math.exp(-t * 32);
      out[i] = (Math.sin(2 * Math.PI * f * t) * 0.45 + rand() * 0.42) * env;
    } else if (stroke === 'pelang') {
      const env = Math.exp(-t * 48);
      out[i] = (Math.sin(2 * Math.PI * 680 * t) * 0.35 + rand() * 0.55) * env;
    } else if (stroke === 'riz') {
      const roll = 0.5 + 0.5 * Math.sin(2 * Math.PI * 32 * t);
      const env = Math.exp(-t * 16) * roll;
      out[i] = (Math.sin(2 * Math.PI * 330 * t) * 0.28 + rand() * 0.45) * env;
    } else if (stroke === 'chain') {
      const env = Math.exp(-t * 22);
      const jingle =
        Math.sin(2 * Math.PI * 3200 * t) * 0.22 +
        Math.sin(2 * Math.PI * 4650 * t) * 0.18 +
        rand() * 0.35;
      out[i] = jingle * env;
    }
  }
  return out;
}

/**
 * Encodes stereo Float32Arrays (-1..1) into a standard 16-bit PCM Stereo WAV Blob.
 */
export function encodeStereoPcmToWavBytes(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number
): Uint8Array {
  const numFrames = Math.min(left.length, right.length);
  const numChannels = 2;
  const bytesPerSample = 2;
  const dataBytes = numFrames * numChannels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataBytes, true);

  let pos = 44;
  for (let i = 0; i < numFrames; i++) {
    const l = Math.max(-1, Math.min(1, left[i]));
    const r = Math.max(-1, Math.min(1, right[i]));
    view.setInt16(pos, l < 0 ? l * 0x8000 : l * 0x7fff, true);
    pos += 2;
    view.setInt16(pos, r < 0 ? r * 0x8000 : r * 0x7fff, true);
    pos += 2;
  }

  return new Uint8Array(buffer);
}

export function encodeStereoPcmToWavBlob(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number
): Blob {
  const bytes = encodeStereoPcmToWavBytes(left, right, sampleRate);
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new Blob([buf], { type: 'audio/wav' });
}

/**
 * Renders a studio-quality multi-track Persian ensemble mixdown combining:
 * 1) Reference Gusheh (7 instruments + real Persian ornaments)
 * 2) Continuous Persian Drone (base / fifth / shahed)
 * 3) Synchronized Tombak / Daf rhythm groove
 * 4) Optional Student Recorded Audio track
 * 5) Persian Hall Reverb + Stereo Mastering Limiter -> 16-bit Stereo WAV
 */
export function renderEnsembleMixdownWav(options: EnsembleMixdownOptions): EnsembleMixdownResult {
  const sampleRate = options.sampleRate ?? 22050;
  const beatSec = 60 / Math.max(40, Math.min(180, options.bpm));
  const melodyTotalSec = options.gusheh.melody.reduce(
    (acc, n) => acc + n.durationBeats * beatSec,
    0
  );
  const recSec =
    options.recordingPcm && options.recordingSampleRate
      ? options.recordingPcm.length / options.recordingSampleRate
      : 0;
  const contentDurationSec = Math.max(melodyTotalSec + 0.6, recSec);
  const totalSamples = Math.max(sampleRate, Math.ceil(contentDurationSec * sampleRate));
  const monoBus = new Float32Array(totalSamples);

  // 1. Reference Gusheh Track
  if (options.melodyVolume > 0.005) {
    let cursorSec = 0.08;
    let prevHz: number | undefined;
    for (const note of options.gusheh.melody) {
      const baseHz = noteToFrequency(note, options.a4Hz, options.koronMode);
      const durSec = Math.max(0.24, note.durationBeats * beatSec);
      const events = options.enableOrnaments
        ? expandNoteWithOrnaments({
            baseFreqHz: baseHz,
            durationSec: durSec,
            instrument: options.instrument,
            ornament: note.ornament,
            prevFreqHz: prevHz,
            scale: options.gusheh.scale,
            a4Hz: options.a4Hz,
            koronMode: options.koronMode,
          })
        : [{ offsetSec: 0, durationSec: durSec, frequencyHz: baseHz, velocity: 0.92 }];

      for (const ev of events) {
        const pcm = synthesizeKarplusStrongSamples({
          frequency: ev.frequencyHz,
          sampleRate,
          durationSec: Math.min(2.4, ev.durationSec + 0.16),
          instrument: options.instrument,
          slideFromHz: ev.slideFromHz,
        });
        const startIdx = Math.floor((cursorSec + ev.offsetSec) * sampleRate);
        const gain = ev.velocity * options.melodyVolume * 0.72;
        for (let i = 0; i < pcm.length && startIdx + i < totalSamples; i++) {
          if (startIdx + i >= 0) monoBus[startIdx + i] += pcm[i] * gain;
        }
      }
      prevHz = baseHz;
      cursorSec += durSec;
    }
  }

  // 2. Continuous Warm Persian Drone Track
  if (options.droneVolume > 0.005) {
    const freqs = computeDroneFrequencies({
      baseNote: options.gusheh.ist,
      shahedNote: options.gusheh.shahed,
      voicing: options.droneVoicing,
      timbre: 'tanbur',
      volume: options.droneVolume,
      a4Hz: options.a4Hz,
      koronMode: options.koronMode,
    });
    const fadeSamples = Math.floor(0.45 * sampleRate);
    const voiceScale = (options.droneVolume * 0.22) / Math.max(1, freqs.length);

    for (let i = 0; i < totalSamples; i++) {
      const t = i / sampleRate;
      let env = 1;
      if (i < fadeSamples) env = i / fadeSamples;
      else if (i > totalSamples - fadeSamples) env = (totalSamples - i) / fadeSamples;
      let s = 0;
      for (const f of freqs) {
        s +=
          Math.sin(2 * Math.PI * f * t) * 0.65 +
          Math.sin(2 * Math.PI * f * 2 * t) * 0.22 +
          Math.sin(2 * Math.PI * f * 3 * t) * 0.09;
      }
      monoBus[i] += s * voiceScale * env;
    }
  }

  // 3. Synchronized Tombak / Daf Percussion Track
  if (options.percussionVolume > 0.005) {
    const groove =
      IRANIAN_GROOVES.find((g) => g.id === options.grooveId) ?? IRANIAN_GROOVES[0];
    const stepSec = beatSec / Math.max(1, groove.stepSubdivision);
    const strokeCache = new Map<StrokeType, Float32Array>();
    let stepIdx = 0;
    for (let t = 0.08; t < contentDurationSec - 0.1; t += stepSec) {
      const st = groove.steps[stepIdx % groove.steps.length];
      stepIdx++;
      if (st === 'rest') continue;
      let pcm = strokeCache.get(st);
      if (!pcm) {
        pcm = synthesizeOfflineStroke(st, options.percussionInstrument, sampleRate);
        strokeCache.set(st, pcm);
      }
      const startIdx = Math.floor(t * sampleRate);
      const gain = options.percussionVolume * 0.55;
      for (let i = 0; i < pcm.length && startIdx + i < totalSamples; i++) {
        monoBus[startIdx + i] += pcm[i] * gain;
      }
    }
  }

  // 4. Optional Student Recording Track (linear resampling into mixdown rate)
  if (
    options.recordingVolume > 0.005 &&
    options.recordingPcm &&
    options.recordingPcm.length > 0 &&
    options.recordingSampleRate
  ) {
    const ratio = options.recordingSampleRate / sampleRate;
    const rec = options.recordingPcm;
    const gain = options.recordingVolume * 0.85;
    for (let i = 0; i < totalSamples; i++) {
      const srcPos = i * ratio;
      const idx = Math.floor(srcPos);
      if (idx >= rec.length - 1) break;
      const frac = srcPos - idx;
      const sample = rec[idx] * (1 - frac) + rec[idx + 1] * frac;
      monoBus[i] += sample * gain;
    }
  }

  // 5. Apply Persian Hall Reverb (stereo output)
  const { left, right } = applyOfflineHallReverb(monoBus, sampleRate, options.reverbPreset);

  // Soft-tanh mastering limiter
  let peakLevel = 0;
  for (let i = 0; i < left.length; i++) {
    left[i] = Math.tanh(left[i] * 1.05) * 0.94;
    right[i] = Math.tanh(right[i] * 1.05) * 0.94;
    const p = Math.max(Math.abs(left[i]), Math.abs(right[i]));
    if (p > peakLevel) peakLevel = p;
  }

  const wavBytes = encodeStereoPcmToWavBytes(left, right, sampleRate);
  const buf = wavBytes.buffer.slice(wavBytes.byteOffset, wavBytes.byteOffset + wavBytes.byteLength) as ArrayBuffer;
  const wavBlob = new Blob([buf], { type: 'audio/wav' });
  return {
    wavBlob,
    wavBytes,
    durationSec: Number((left.length / sampleRate).toFixed(2)),
    sampleRate,
    peakLevel: Number(peakLevel.toFixed(3)),
  };
}
