import { frequencyToPersianNote, noteToFrequency } from '../data/musicTheory';
import type {
  KoronMode,
  PersianNoteSpec,
  RecordedPitchPoint,
} from '../types/music';
import { getAudioContext } from './audioContext';
import { detectPitchYin } from './dsp';

export interface TranscribedPhraseNote {
  id: string;
  startSec: number;
  endSec: number;
  durationSec: number;
  note: PersianNoteSpec;
  labelFa: string;
  freqHz: number;
  avgCentsOffset: number;
}

export interface AudioTranscriptionResult {
  durationSeconds: number;
  envelope: number[];
  notes: TranscribedPhraseNote[];
  pitchContour: RecordedPitchPoint[];
}

/**
 * Pure deterministic offline PCM microtonal transcriber (YIN DSP).
 * Scans decoded mono audio samples, extracts Koron/Sori microtonal notes,
 * and merges stable segments (>= minNoteDurationSec) into a readable Radif transcription.
 */
export function transcribePcmSamplesToPersianNotes(
  samples: Float32Array,
  sampleRate: number,
  options: {
    a4Hz?: number;
    koronMode?: KoronMode;
    targetScale?: PersianNoteSpec[];
    minNoteDurationSec?: number;
  } = {}
): AudioTranscriptionResult {
  const a4Hz = options.a4Hz ?? 440;
  const koronMode = options.koronMode ?? 'traditional_56';
  const minNoteDurationSec = options.minNoteDurationSec ?? 0.14;
  const durationSeconds =
    Math.round((samples.length / Math.max(1, sampleRate)) * 100) / 100;

  // 1. Waveform envelope (80 bars)
  const bars = 80;
  const envelope: number[] = [];
  const step = Math.max(1, Math.floor(samples.length / bars));
  let maxBar = 0.001;
  for (let i = 0; i < bars; i++) {
    const start = i * step;
    const end = Math.min(samples.length, start + step);
    let peak = 0;
    for (let j = start; j < end; j++) {
      const a = Math.abs(samples[j]);
      if (a > peak) peak = a;
    }
    envelope.push(peak);
    if (peak > maxBar) maxBar = peak;
  }
  const normalizedEnvelope = envelope.map(
    (v) => Math.round((v / maxBar) * 100) / 100
  );

  // 2. Frame-by-frame YIN pitch tracking
  const frameSize = 2048;
  const hopSize = Math.max(512, Math.floor(sampleRate * 0.06)); // ~60ms hop
  const frameDurationSec = hopSize / Math.max(1, sampleRate);

  const pitchContour: RecordedPitchPoint[] = [];
  interface ActiveSegment {
    startSec: number;
    endSec: number;
    note: PersianNoteSpec;
    labelFa: string;
    freqSum: number;
    centsSum: number;
    count: number;
  }

  const rawSegments: ActiveSegment[] = [];
  let current: ActiveSegment | null = null;

  const flushCurrent = () => {
    if (current) {
      rawSegments.push(current);
      current = null;
    }
  };

  for (let pos = 0; pos + frameSize <= samples.length; pos += hopSize) {
    const timeSec = Math.round((pos / Math.max(1, sampleRate)) * 100) / 100;
    const slice = samples.subarray(pos, pos + frameSize);
    const yin = detectPitchYin(slice, sampleRate, { rmsThreshold: 0.014 });

    if (yin.frequency !== null && yin.clarity >= 0.72) {
      const match = frequencyToPersianNote(
        yin.frequency,
        a4Hz,
        koronMode,
        options.targetScale
      );

      if (pitchContour.length < 300) {
        pitchContour.push({
          timeSec,
          freqHz: Math.round(yin.frequency * 10) / 10,
          centsOffset: match.centsOffset,
          noteLabelFa: match.labelFa,
        });
      }

      if (
        current &&
        current.note.letter === match.note.letter &&
        current.note.accidental === match.note.accidental &&
        current.note.octave === match.note.octave &&
        timeSec - current.endSec <= frameDurationSec * 2.4
      ) {
        current.endSec = timeSec + frameDurationSec;
        current.freqSum += yin.frequency;
        current.centsSum += match.centsOffset;
        current.count += 1;
      } else {
        flushCurrent();
        current = {
          startSec: timeSec,
          endSec: timeSec + frameDurationSec,
          note: match.note,
          labelFa: match.labelFa,
          freqSum: yin.frequency,
          centsSum: match.centsOffset,
          count: 1,
        };
      }
    } else if (current && timeSec - current.endSec > frameDurationSec * 2) {
      flushCurrent();
    }
  }
  flushCurrent();

  const notes: TranscribedPhraseNote[] = rawSegments
    .filter((seg) => seg.endSec - seg.startSec >= minNoteDurationSec)
    .slice(0, 64)
    .map((seg, idx) => ({
      id: `tr_${idx}_${Math.round(seg.startSec * 100)}`,
      startSec: Math.round(seg.startSec * 100) / 100,
      endSec: Math.round(seg.endSec * 100) / 100,
      durationSec: Math.round((seg.endSec - seg.startSec) * 100) / 100,
      note: seg.note,
      labelFa: seg.labelFa,
      freqHz: Math.round((seg.freqSum / seg.count) * 10) / 10,
      avgCentsOffset: Math.round((seg.centsSum / seg.count) * 10) / 10,
    }));

  return {
    durationSeconds,
    envelope: normalizedEnvelope,
    notes,
    pitchContour,
  };
}

/**
 * Decodes an uploaded local MP3/WAV/OGG/M4A File or Blob offline using Web Audio API
 * and runs deterministic Persian microtonal transcription.
 */
export async function decodeAndTranscribeAudioBlob(
  blob: Blob,
  options: {
    a4Hz?: number;
    koronMode?: KoronMode;
    targetScale?: PersianNoteSpec[];
  } = {}
): Promise<AudioTranscriptionResult> {
  const ctx = getAudioContext();
  const arrayBuffer = await blob.arrayBuffer();
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
  const mono = audioBuffer.getChannelData(0);
  return transcribePcmSamplesToPersianNotes(mono, audioBuffer.sampleRate, options);
}

/**
 * Synthesizes an offline 16-bit PCM WAV Blob of a Persian Radif phrase (pure sine+harmonic
 * plucked envelope) so users can test the Slowdowner & Transcriber immediately without
 * needing to upload an external MP3.
 */
export function synthesizeDemoPhraseWavBlob(
  notes: PersianNoteSpec[],
  options: { a4Hz?: number; koronMode?: KoronMode; noteDurationSec?: number } = {}
): { blob: Blob; samples: Float32Array; sampleRate: number } {
  const sampleRate = 22050;
  const a4Hz = options.a4Hz ?? 440;
  const koronMode = options.koronMode ?? 'traditional_56';
  const noteSec = options.noteDurationSec ?? 0.65;
  const totalSamples = Math.max(1, Math.floor(notes.length * noteSec * sampleRate));
  const samples = new Float32Array(totalSamples);

  notes.forEach((n, idx) => {
    const freq = noteToFrequency(n, a4Hz, koronMode);
    const startIdx = Math.floor(idx * noteSec * sampleRate);
    const len = Math.floor(noteSec * sampleRate);
    for (let i = 0; i < len && startIdx + i < totalSamples; i++) {
      const t = i / sampleRate;
      const env =
        Math.min(1, t / 0.025) * Math.exp(-t * 2.2) * (i > len - 400 ? (len - i) / 400 : 1);
      // Clean fundamental + warm 2nd & 3rd harmonics (Santur/Tar-like clarity for YIN)
      const val =
        0.72 * Math.sin(2 * Math.PI * freq * t) +
        0.2 * Math.sin(2 * Math.PI * freq * 2 * t) +
        0.08 * Math.sin(2 * Math.PI * freq * 3 * t);
      samples[startIdx + i] = Math.max(-0.95, Math.min(0.95, val * env * 0.78));
    }
  });

  // Encode standard 16-bit PCM mono WAV header + payload
  const wavBuffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(wavBuffer);
  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }

  return {
    blob: new Blob([wavBuffer], { type: 'audio/wav' }),
    samples,
    sampleRate,
  };
}
