/**
 * Persian Acoustic Space & Hall Reverb Engine (موتور آکوستیک و ریورب تالار ایرانی).
 * Generates authentic early reflections + smooth decaying diffuse tail for:
 *  - dry: اتاق تمرین خشک (Dry Studio)
 *  - warm_studio: استودیو گرم چوبی (Warm Wood Studio)
 *  - vahdat_hall: تالار وحدت تهران (Vahdat Concert Hall)
 *  - persian_dome: گنبد و کاشی‌کاری ایرانی (Isfahan Acoustic Dome)
 */

export type HallReverbPresetId = 'dry' | 'warm_studio' | 'vahdat_hall' | 'persian_dome';

export interface HallReverbPreset {
  id: HallReverbPresetId;
  nameFa: string;
  shortFa: string;
  descriptionFa: string;
  rt60Sec: number;
  wetMix: number;
  preDelayMs: number;
  dampingHz: number;
  earlyReflectionsMs: number[];
}

export const HALL_REVERB_PRESETS: HallReverbPreset[] = [
  {
    id: 'dry',
    nameFa: 'اتاق تمرین خشک',
    shortFa: 'خشک',
    descriptionFa: 'صدای مستقیم و بدون طنین اضافه برای تشخیص دقیق فواصل و تمرین کوک',
    rt60Sec: 0.08,
    wetMix: 0,
    preDelayMs: 0,
    dampingHz: 8000,
    earlyReflectionsMs: [],
  },
  {
    id: 'warm_studio',
    nameFa: 'استودیو گرم چوبی',
    shortFa: 'استودیو گرم',
    descriptionFa: 'طنین طبیعی و صمیمی اتاق چوبی استاندارد ضبط سازهای ایرانی',
    rt60Sec: 0.95,
    wetMix: 0.24,
    preDelayMs: 11,
    dampingHz: 4200,
    earlyReflectionsMs: [11, 19, 29, 43],
  },
  {
    id: 'vahdat_hall',
    nameFa: 'تالار وحدت (کنسرت)',
    shortFa: 'تالار وحدت',
    descriptionFa: 'آکوستیک متعادل و باشکوه سالن کنسرت با انعکاس‌های اولیه شفاف',
    rt60Sec: 1.85,
    wetMix: 0.34,
    preDelayMs: 22,
    dampingHz: 3400,
    earlyReflectionsMs: [22, 37, 54, 71, 95],
  },
  {
    id: 'persian_dome',
    nameFa: 'گنبد و کاشی‌کاری ایرانی',
    shortFa: 'گنبد ایرانی',
    descriptionFa: 'طنین عرفانی و کشیده زیر گنبد کاشی‌کاری برای آواز، نی، تنبور و کمانچه',
    rt60Sec: 2.9,
    wetMix: 0.44,
    preDelayMs: 32,
    dampingHz: 2600,
    earlyReflectionsMs: [32, 58, 86, 118, 152],
  },
];

export const HALL_REVERB_BY_ID: Record<HallReverbPresetId, HallReverbPreset> =
  Object.fromEntries(HALL_REVERB_PRESETS.map((p) => [p.id, p])) as Record<
    HallReverbPresetId,
    HallReverbPreset
  >;

let activePresetId: HallReverbPresetId = 'warm_studio';

export function getActiveHallReverbPreset(): HallReverbPresetId {
  return activePresetId;
}

export function setActiveHallReverbPreset(presetId: HallReverbPresetId): void {
  activePresetId = presetId;
  // Reconfigure live bus if already initialized
  if (busState) {
    configureBusForPreset(busState, presetId);
  }
}

/** Deterministic pseudo-random generator for reproducible impulse responses */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s / 0xffffffff) * 2 - 1;
  };
}

/**
 * Generates a realistic stereo impulse response (left & right Float32Arrays)
 * with authentic early reflections and frequency-damped diffuse late tail.
 */
export function generateHallImpulseResponse(
  presetId: HallReverbPresetId,
  sampleRate: number
): { left: Float32Array; right: Float32Array } {
  const preset = HALL_REVERB_BY_ID[presetId];
  const length = Math.max(64, Math.floor(Math.max(0.15, preset.rt60Sec) * sampleRate));
  const left = new Float32Array(length);
  const right = new Float32Array(length);

  if (preset.wetMix <= 0) {
    left[0] = 1;
    right[0] = 1;
    return { left, right };
  }

  const randL = lcg(0x5a7e1234 + length);
  const randR = lcg(0x9b3c4321 + length);

  // Early reflections (distinct spatial taps)
  preset.earlyReflectionsMs.forEach((ms, idx) => {
    const sampleIdxL = Math.min(length - 1, Math.floor((ms / 1000) * sampleRate));
    const sampleIdxR = Math.min(
      length - 1,
      Math.floor(((ms + (idx % 2 === 0 ? 3.5 : -2.5)) / 1000) * sampleRate)
    );
    const amp = 0.55 * Math.pow(0.76, idx);
    left[sampleIdxL] += amp * (idx % 2 === 0 ? 1 : -0.9);
    right[sampleIdxR] += amp * (idx % 2 === 0 ? -0.9 : 1);
  });

  // Diffuse exponentially decaying late tail with one-pole HF air damping
  const preDelaySamples = Math.floor((preset.preDelayMs / 1000) * sampleRate);
  const tau = preset.rt60Sec / 6.907755; // ln(1000) = 6.9077
  const rc = 1 / (2 * Math.PI * preset.dampingHz);
  const dt = 1 / sampleRate;
  const alpha = dt / (rc + dt);

  let lpL = 0;
  let lpR = 0;

  for (let i = preDelaySamples; i < length; i++) {
    const t = (i - preDelaySamples) / sampleRate;
    const env = Math.exp(-t / tau);
    lpL += alpha * (randL() * env - lpL);
    lpR += alpha * (randR() * env - lpR);
    // Gentle Persian dome shimmer modulation for persian_dome
    const domeMod =
      presetId === 'persian_dome' ? 1 + 0.12 * Math.sin(2 * Math.PI * 1.4 * t) : 1;
    left[i] += lpL * 0.42 * domeMod;
    right[i] += lpR * 0.42 * domeMod;
  }

  return { left, right };
}

interface ReverbBusState {
  ctx: AudioContext;
  input: GainNode;
  dryGain: GainNode;
  wetGain: GainNode;
  convolver: ConvolverNode;
  irCache: Map<HallReverbPresetId, AudioBuffer>;
}

let busState: ReverbBusState | null = null;

function buildIrAudioBuffer(ctx: AudioContext, presetId: HallReverbPresetId): AudioBuffer {
  const { left, right } = generateHallImpulseResponse(presetId, ctx.sampleRate);
  const buffer = ctx.createBuffer(2, left.length, ctx.sampleRate);
  buffer.getChannelData(0).set(left);
  buffer.getChannelData(1).set(right);
  return buffer;
}

function configureBusForPreset(bus: ReverbBusState, presetId: HallReverbPresetId): void {
  const preset = HALL_REVERB_BY_ID[presetId];
  const now = bus.ctx.currentTime;
  bus.dryGain.gain.setTargetAtTime(1 - preset.wetMix * 0.35, now, 0.02);
  bus.wetGain.gain.setTargetAtTime(preset.wetMix, now, 0.02);

  if (preset.wetMix > 0) {
    let ir = bus.irCache.get(presetId);
    if (!ir) {
      ir = buildIrAudioBuffer(bus.ctx, presetId);
      bus.irCache.set(presetId, ir);
    }
    bus.convolver.buffer = ir;
  }
}

/**
 * Returns the global Web Audio destination input node routed through
 * the active Persian Hall Reverb preset (or directly to ctx.destination if Convolver unsupported).
 */
export function getReverbInputNode(ctx: AudioContext): AudioNode {
  if (typeof ctx.createConvolver !== 'function') {
    return ctx.destination;
  }
  if (!busState || busState.ctx !== ctx) {
    const input = ctx.createGain();
    const dryGain = ctx.createGain();
    const wetGain = ctx.createGain();
    const convolver = ctx.createConvolver();

    input.connect(dryGain);
    dryGain.connect(ctx.destination);

    input.connect(convolver);
    convolver.connect(wetGain);
    wetGain.connect(ctx.destination);

    busState = {
      ctx,
      input,
      dryGain,
      wetGain,
      convolver,
      irCache: new Map(),
    };
    configureBusForPreset(busState, activePresetId);
  }
  return busState.input;
}

/**
 * Fast, authentic offline Schroeder/Moorer stereo reverb for WAV & Mixdown exports
 * (runs in milliseconds without requiring real-time AudioContext).
 */
export function applyOfflineHallReverb(
  monoInput: Float32Array,
  sampleRate: number,
  presetId: HallReverbPresetId
): { left: Float32Array; right: Float32Array } {
  const preset = HALL_REVERB_BY_ID[presetId];
  const tailSec = preset.wetMix > 0 ? Math.min(2.2, preset.rt60Sec * 0.75) : 0;
  const outLen = monoInput.length + Math.floor(tailSec * sampleRate);
  const left = new Float32Array(outLen);
  const right = new Float32Array(outLen);

  // Copy dry signal
  const dryScale = 1 - preset.wetMix * 0.3;
  for (let i = 0; i < monoInput.length; i++) {
    left[i] = monoInput[i] * dryScale;
    right[i] = monoInput[i] * dryScale;
  }

  if (preset.wetMix <= 0) {
    return { left, right };
  }

  // 4 prime parallel comb filters per stereo channel with HF damping
  const combDelaysL = [0.0297, 0.0371, 0.0411, 0.0437].map((s) => Math.max(8, Math.floor(s * sampleRate)));
  const combDelaysR = [0.0313, 0.0389, 0.0423, 0.0451].map((s) => Math.max(8, Math.floor(s * sampleRate)));

  const renderChannel = (delays: number[], target: Float32Array) => {
    const wetAcc = new Float32Array(outLen);
    for (const d of delays) {
      const feedback = Math.pow(0.001, d / (Math.max(0.25, preset.rt60Sec) * sampleRate));
      const buf = new Float32Array(d);
      let idx = 0;
      let damp = 0;
      const dampCoeff = presetId === 'persian_dome' ? 0.42 : 0.3;

      for (let i = 0; i < outLen; i++) {
        const x = i < monoInput.length ? monoInput[i] : 0;
        const y = buf[idx];
        damp = y * (1 - dampCoeff) + damp * dampCoeff;
        buf[idx] = x + damp * Math.min(0.95, feedback);
        wetAcc[i] += y * 0.25;
        idx++;
        if (idx >= d) idx = 0;
      }
    }

    // Add early reflections + wet sum
    for (const ms of preset.earlyReflectionsMs) {
      const shift = Math.floor((ms / 1000) * sampleRate);
      for (let i = 0; i < monoInput.length && i + shift < outLen; i++) {
        wetAcc[i + shift] += monoInput[i] * 0.12;
      }
    }

    for (let i = 0; i < outLen; i++) {
      target[i] += wetAcc[i] * preset.wetMix;
    }
  };

  renderChannel(combDelaysL, left);
  renderChannel(combDelaysR, right);

  // Soft ceiling normalization so reverb never clips
  let peak = 0;
  for (let i = 0; i < outLen; i++) {
    const p = Math.max(Math.abs(left[i]), Math.abs(right[i]));
    if (p > peak) peak = p;
  }
  if (peak > 0.96) {
    const s = 0.96 / peak;
    for (let i = 0; i < outLen; i++) {
      left[i] *= s;
      right[i] *= s;
    }
  }

  return { left, right };
}
