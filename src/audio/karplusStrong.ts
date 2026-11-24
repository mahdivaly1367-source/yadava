import { noteToFrequency } from '../data/musicTheory';
import type {
  InstrumentId,
  KoronMode,
  MelodyNote,
  OrnamentType,
  PersianNoteSpec,
} from '../types/music';
import { getAudioContext } from './audioContext';

export interface KarplusSynthOptions {
  frequency: number;
  sampleRate: number;
  durationSec: number;
  instrument: InstrumentId;
  ornament?: OrnamentType;
  velocity?: number;
}

/**
 * Deterministic pseudo-random generator (xorshift32) so Karplus-Strong excitation noise
 * is fast, reproducible in tests, and 100% client-side deterministic.
 */
function createPrng(seed: number): () => number {
  let state = seed >>> 0 || 0x12345678;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) / 0xffffffff) * 2 - 1;
  };
}

/**
 * Generates a pure Karplus-Strong physical-modeled waveform for one of the four
 * reference Persian instruments: Tar, Setar, Santur, Ney.
 */
export function synthesizeKarplusStrongSamples(opts: KarplusSynthOptions): Float32Array {
  const {
    frequency,
    sampleRate,
    durationSec,
    instrument,
    ornament,
    velocity = 0.85,
  } = opts;

  const safeFreq = Math.max(55, Math.min(2600, frequency));
  const totalSamples = Math.max(64, Math.floor(sampleRate * Math.max(0.08, durationSec)));
  const output = new Float32Array(totalSamples);
  const rand = createPrng(Math.round(safeFreq * 100) ^ totalSamples);

  if (instrument === 'ney') {
    // Breathy Persian Ney waveguide-inspired tube model:
    // Smooth air-jet excitation + subtle breath turbulence + resonant bore harmonics + natural tahrir/vibrato
    const vibratoRate = ornament === 'tahrir' ? 6.1 : 4.8;
    const vibratoDepth = ornament === 'tahrir' ? 0.032 : 0.008;
    let phase = 0;
    let lpNoise = 0;

    for (let i = 0; i < totalSamples; i++) {
      const t = i / sampleRate;
      const envAttack = Math.min(1, t / 0.065);
      const envRelease = Math.min(1, Math.max(0, (durationSec - t) / 0.09));
      const env = envAttack * envRelease;

      const modFreq = safeFreq * (1 + vibratoDepth * Math.sin(2 * Math.PI * vibratoRate * t) * Math.min(1, t * 5));
      phase += (2 * Math.PI * modFreq) / sampleRate;

      // Fundamental + warm odd-weighted bamboo bore harmonics
      const bore =
        0.72 * Math.sin(phase) +
        0.19 * Math.sin(2 * phase + 0.2) +
        0.11 * Math.sin(3 * phase) +
        0.04 * Math.sin(4 * phase);

      // Filtered breath chiffon noise
      const white = rand();
      lpNoise = 0.82 * lpNoise + 0.18 * white;
      const breath = (white - lpNoise) * 0.14 * (0.4 + 0.6 * Math.exp(-t * 4));

      // Tahrir amplitude pulsing for authentic vocal/ney inflection
      const tahrirAmp = ornament === 'tahrir' ? 0.82 + 0.18 * Math.sin(2 * Math.PI * 6.1 * t) : 1;

      output[i] = (bore + breath) * env * velocity * 0.65 * tahrirAmp;
    }
    return output;
  }

  // Plucked / Hammered Karplus-Strong waveguide (Tar, Setar, Santur)
  const exactDelay = sampleRate / safeFreq;
  const delayLen = Math.max(4, Math.floor(exactDelay));
  const frac = exactDelay - delayLen;

  // Instrument-specific physical parameters
  const params =
    instrument === 'tar'
      ? { decay: 0.9955, brightness: 0.54, detuneCents: 3.5, pickPos: 0.24, bodyMix: 0.22 }
      : instrument === 'setar'
      ? { decay: 0.9942, brightness: 0.42, detuneCents: 1.5, pickPos: 0.34, bodyMix: 0.16 }
      : // santur: hammered multi-string metallic ring
        { decay: 0.9972, brightness: 0.68, detuneCents: 5.5, pickPos: 0.18, bodyMix: 0.28 };

  // Build primary delay line (and secondary sympathetic/chorus string for Tar double-course & Santur triple-string)
  const buildPluckedVoice = (voiceFreq: number, seedOffset: number, gain: number): Float32Array => {
    const vRand = createPrng(Math.round(voiceFreq * 100) + seedOffset);
    const vExact = sampleRate / Math.max(55, voiceFreq);
    const vLen = Math.max(4, Math.floor(vExact));
    const vFrac = vExact - vLen;
    const ring = new Float32Array(vLen);

    // Excitation burst shaped by pluck/hammer position comb filter
    const pickDelay = Math.max(1, Math.floor(vLen * params.pickPos));
    const rawNoise = new Float32Array(vLen);
    let smooth = 0;
    for (let i = 0; i < vLen; i++) {
      const w = vRand();
      // Santur hammer has smoother impulse, Tar plectrum (mezrab) is brighter
      smooth = (1 - params.brightness) * smooth + params.brightness * w;
      rawNoise[i] = smooth;
    }
    for (let i = 0; i < vLen; i++) {
      const comb = i >= pickDelay ? rawNoise[i] - 0.65 * rawNoise[i - pickDelay] : rawNoise[i];
      ring[i] = comb * gain;
    }

    const voiceOut = new Float32Array(totalSamples);
    let ptr = 0;
    let prevSample = 0;
    let apPrevIn = 0;
    let apPrevOut = 0;
    const apCoeff = (1 - vFrac) / (1 + vFrac);

    for (let i = 0; i < totalSamples; i++) {
      const curr = ring[ptr];
      const nextPtr = (ptr + 1) % vLen;
      const next = ring[nextPtr];

      // One-pole lowpass string damping filter
      const damped = params.decay * (params.brightness * curr + (1 - params.brightness) * next);

      // First-order all-pass fractional delay interpolation for exact microtonal Koron/Sori intonation!
      const apOut = apCoeff * (damped - apPrevOut) + apPrevIn;
      apPrevIn = damped;
      apPrevOut = apOut;

      ring[ptr] = apOut;

      // Subtle body warmth resonance
      const warm = 0.78 * curr + 0.22 * prevSample;
      prevSample = warm;
      voiceOut[i] = warm;

      ptr = nextPtr;
    }

    return voiceOut;
  };

  const primary = buildPluckedVoice(safeFreq, 17, 0.8);
  const detuneRatio = Math.pow(2, params.detuneCents / 1200);
  const secondary = buildPluckedVoice(safeFreq * detuneRatio, 97, instrument === 'setar' ? 0.25 : 0.42);
  const third =
    instrument === 'santur'
      ? buildPluckedVoice(safeFreq / detuneRatio, 211, 0.34)
      : null;

  // Ornament dynamics (riz tremolo / tahrir / dorab micro-envelopes)
  const fadeSamples = Math.min(Math.floor(sampleRate * 0.04), Math.floor(totalSamples / 4));

  for (let i = 0; i < totalSamples; i++) {
    let sample = primary[i] + secondary[i] + (third ? third[i] : 0);

    // Subtle ornament modulation
    const t = i / sampleRate;
    if (ornament === 'riz') {
      sample *= 0.72 + 0.28 * Math.abs(Math.sin(Math.PI * 11 * t));
    } else if (ornament === 'tahrir') {
      sample *= 0.8 + 0.2 * Math.sin(2 * Math.PI * 6.0 * t);
    }

    // Smooth release tail to prevent clicks
    if (i > totalSamples - fadeSamples) {
      sample *= (totalSamples - i) / fadeSamples;
    }

    // Soft tanh limiter to guarantee [-1, 1] cleanliness
    output[i] = Math.tanh(sample * velocity * (1 + params.bodyMix));
  }

  // Silence lint check for unused delayLen/frac used only in reference calculation
  void delayLen;
  void frac;

  return output;
}

/**
 * Plays a single Persian note using Karplus-Strong physical synthesis through
 * an instrument-specific resonant body BiquadFilter chain.
 */
export function playPersianNote(
  note: PersianNoteSpec,
  options: {
    instrument: InstrumentId;
    durationSec?: number;
    a4Hz?: number;
    koronMode?: KoronMode;
    ornament?: OrnamentType;
    velocity?: number;
    startTimeOffsetSec?: number;
  }
): { stop: () => void; frequency: number } {
  const ctx = getAudioContext();
  const a4Hz = options.a4Hz ?? 440;
  const koronMode = options.koronMode ?? 'standard_50';
  const durationSec = options.durationSec ?? 0.9;
  const freq = noteToFrequency(note, a4Hz, koronMode);
  const now = ctx.currentTime + (options.startTimeOffsetSec ?? 0.005);

  const activeSources: AudioBufferSourceNode[] = [];

  const scheduleVoice = (voiceFreq: number, dur: number, when: number, vel: number, orn?: OrnamentType) => {
    const samples = synthesizeKarplusStrongSamples({
      frequency: voiceFreq,
      sampleRate: ctx.sampleRate,
      durationSec: dur,
      instrument: options.instrument,
      ornament: orn,
      velocity: vel,
    });
    const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
    buffer.copyToChannel(new Float32Array(samples), 0);

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    // Resonant acoustic body filter tailored to each Persian instrument
    const bodyFilter = ctx.createBiquadFilter();
    if (options.instrument === 'tar') {
      bodyFilter.type = 'peaking';
      bodyFilter.frequency.value = 1150;
      bodyFilter.Q.value = 1.4;
      bodyFilter.gain.value = 4.5;
    } else if (options.instrument === 'setar') {
      bodyFilter.type = 'peaking';
      bodyFilter.frequency.value = 780;
      bodyFilter.Q.value = 1.1;
      bodyFilter.gain.value = 3.2;
    } else if (options.instrument === 'santur') {
      bodyFilter.type = 'highshelf';
      bodyFilter.frequency.value = 1800;
      bodyFilter.gain.value = 3.0;
    } else {
      bodyFilter.type = 'bandpass';
      bodyFilter.frequency.value = Math.max(300, Math.min(2400, voiceFreq * 1.35));
      bodyFilter.Q.value = 0.85;
    }

    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.72;

    src.connect(bodyFilter);
    bodyFilter.connect(masterGain);
    masterGain.connect(ctx.destination);
    src.start(when);
    activeSources.push(src);
  };

  // Ornament pre-attacks (Eshareh grace note, Tekieh upper accent, Dorab fast triplet)
  if (options.ornament === 'eshareh') {
    scheduleVoice(freq * Math.pow(2, 150 / 1200), 0.11, now, (options.velocity ?? 0.85) * 0.6);
    scheduleVoice(freq, durationSec, now + 0.065, options.velocity ?? 0.85);
  } else if (options.ornament === 'tekieh') {
    scheduleVoice(freq, durationSec * 0.45, now, options.velocity ?? 0.85);
    scheduleVoice(freq * Math.pow(2, 200 / 1200), 0.12, now + 0.09, (options.velocity ?? 0.85) * 0.72);
    scheduleVoice(freq, durationSec * 0.7, now + 0.16, (options.velocity ?? 0.85) * 0.85);
  } else if (options.ornament === 'dorab') {
    scheduleVoice(freq * Math.pow(2, 200 / 1200), 0.12, now, 0.72);
    scheduleVoice(freq, 0.14, now + 0.07, 0.82);
    scheduleVoice(freq, durationSec, now + 0.14, options.velocity ?? 0.9);
  } else {
    scheduleVoice(freq, durationSec, now, options.velocity ?? 0.85, options.ornament);
  }

  return {
    frequency: freq,
    stop: () => {
      for (const s of activeSources) {
        try {
          s.stop();
        } catch {
          // already finished
        }
      }
    },
  };
}

/**
 * Plays a raw frequency in Hz directly through the Karplus-Strong synthesizer
 * (used by the Custom Microtonal Temperament Editor for A/B cent comparisons).
 */
export function playFrequencyTone(
  frequencyHz: number,
  options: {
    instrument: InstrumentId;
    durationSec?: number;
    velocity?: number;
  }
): { stop: () => void } {
  const ctx = getAudioContext();
  const dur = options.durationSec ?? 0.9;
  const samples = synthesizeKarplusStrongSamples({
    frequency: frequencyHz,
    sampleRate: ctx.sampleRate,
    durationSec: dur,
    instrument: options.instrument,
    velocity: options.velocity ?? 0.82,
  });
  const buf = ctx.createBuffer(1, samples.length, ctx.sampleRate);
  buf.getChannelData(0).set(samples);

  const src = ctx.createBufferSource();
  src.buffer = buf;
  const gain = ctx.createGain();
  gain.gain.value = 0.72;
  src.connect(gain);
  gain.connect(ctx.destination);
  src.start(ctx.currentTime + 0.01);

  return {
    stop: () => {
      try {
        src.stop();
      } catch {
        // already stopped
      }
    },
  };
}

export interface PhrasePlaybackHandle {
  stop: () => void;
}

/**
 * Plays a melodic phrase (or A-B loop slice) with speed control that changes tempo
 * WITHOUT altering pitch (because synthesis regenerates exact Hz per note).
 */
export function playGushehPhrase(
  melody: MelodyNote[],
  options: {
    instrument: InstrumentId;
    bpm: number;
    speedMultiplier: number; // e.g., 0.5x to 1.5x without pitch change
    a4Hz: number;
    koronMode: KoronMode;
    startIndex: number;
    endIndex: number;
    loop: boolean;
    onNoteStart?: (noteIndex: number, note: MelodyNote) => void;
    onComplete?: () => void;
  }
): PhrasePlaybackHandle {
  let cancelled = false;
  let activeStoppers: Array<() => void> = [];
  let timerIds: number[] = [];

  const safeStart = Math.max(0, Math.min(melody.length - 1, options.startIndex));
  const safeEnd = Math.max(safeStart, Math.min(melody.length - 1, options.endIndex));

  const effectiveBpm = Math.max(30, Math.min(260, options.bpm * options.speedMultiplier));
  const beatSec = 60 / effectiveBpm;

  const clearScheduled = () => {
    for (const id of timerIds) window.clearTimeout(id);
    timerIds = [];
    for (const fn of activeStoppers) fn();
    activeStoppers = [];
  };

  const runPass = () => {
    if (cancelled) return;
    let offsetMs = 0;

    for (let idx = safeStart; idx <= safeEnd; idx++) {
      const note = melody[idx];
      const durSec = Math.max(0.18, note.durationBeats * beatSec);
      const triggerAt = offsetMs;

      const tId = window.setTimeout(() => {
        if (cancelled) return;
        options.onNoteStart?.(idx, note);
        const handle = playPersianNote(note, {
          instrument: options.instrument,
          durationSec: durSec * 1.15,
          a4Hz: options.a4Hz,
          koronMode: options.koronMode,
          ornament: note.ornament,
        });
        activeStoppers.push(handle.stop);
      }, triggerAt);

      timerIds.push(tId);
      offsetMs += durSec * 1000;
    }

    const endTimer = window.setTimeout(() => {
      if (cancelled) return;
      if (options.loop) {
        activeStoppers = [];
        runPass();
      } else {
        options.onComplete?.();
      }
    }, offsetMs + 140);

    timerIds.push(endTimer);
  };

  runPass();

  return {
    stop: () => {
      cancelled = true;
      clearScheduled();
    },
  };
}
