import type {
  IranianGrooveId,
  IranianMeter,
  PercussionInstrument,
} from '../types/music';
import { getAudioContext } from './audioContext';

export type StrokeType = 'tom' | 'bak' | 'pelang' | 'riz' | 'chain' | 'rest';

export interface IranianGrooveSpec {
  id: IranianGrooveId;
  nameFa: string;
  meter: IranianMeter;
  defaultBpm: number;
  stepSubdivision: number; // steps per beat (usually 2 for 8th/16th feel)
  descriptionFa: string;
  steps: StrokeType[];
}

export const STROKE_LABELS_FA: Record<StrokeType, string> = {
  tom: 'تُم',
  bak: 'بَک',
  pelang: 'بشکن',
  riz: 'ریز',
  chain: 'حلقه',
  rest: 'سکوت',
};

/**
 * 8 Authentic Iranian Percussion Grooves for Tombak & Daf (ضربی‌ساز و هم‌نواز تنبک و دف)
 */
export const IRANIAN_GROOVES: IranianGrooveSpec[] = [
  {
    id: 'chaharmezrab_6_8',
    nameFa: 'چهارمضراب (۶/۸)',
    meter: '6/8',
    defaultBpm: 112,
    stepSubdivision: 2,
    descriptionFa: 'الگوی پرانرژی چهارمضراب با تُم‌های سنگین سرضرب و ریزهای ظریف میانی',
    steps: ['tom', 'bak', 'pelang', 'bak', 'riz', 'bak'],
  },
  {
    id: 'reng_sangin_6_8',
    nameFa: 'رِنگ سنگین (۶/۸)',
    meter: '6/8',
    defaultBpm: 92,
    stepSubdivision: 2,
    descriptionFa: 'ریتم کلاسیک رنگ‌های ردیف (تُم – بَک – سکوت – تُم – بَک – بشکن)',
    steps: ['tom', 'rest', 'bak', 'tom', 'bak', 'pelang'],
  },
  {
    id: 'reng_shad_6_8',
    nameFa: 'رِنگ شاد و تند (۶/۸)',
    meter: '6/8',
    defaultBpm: 132,
    stepSubdivision: 2,
    descriptionFa: 'ریتم شاد ضربی و رنگ شیش‌وهشت ایرانی همراه با حلقه‌های دف',
    steps: ['tom', 'bak', 'tom', 'chain', 'bak', 'pelang'],
  },
  {
    id: 'pishdaramad_4_4',
    nameFa: 'پیش‌درآمد (۴/۴)',
    meter: '4/4',
    defaultBpm: 76,
    stepSubdivision: 2,
    descriptionFa: 'ریتم باوقار پیش‌درآمدهای استاد درویش‌خان و صبا در چهار ضربی',
    steps: ['tom', 'rest', 'bak', 'pelang', 'tom', 'bak', 'riz', 'bak'],
  },
  {
    id: 'kereshmeh_3_4',
    nameFa: 'کرشمه (۳/۴)',
    meter: '3/4',
    defaultBpm: 88,
    stepSubdivision: 2,
    descriptionFa: 'ضرب‌آهنگ سیال گوشه کرشمه در سه ضربی اصیل ایرانی',
    steps: ['tom', 'bak', 'pelang', 'tom', 'riz', 'bak'],
  },
  {
    id: 'saghinameh_2_4',
    nameFa: 'ساقی‌نامه / ضربی (۲/۴)',
    meter: '2/4',
    defaultBpm: 98,
    stepSubdivision: 2,
    descriptionFa: 'الگوی دو ضربی ساقی‌نامه، صوفی‌نامه و تصنیف‌های کلاسیک',
    steps: ['tom', 'pelang', 'bak', 'riz'],
  },
  {
    id: 'lang_5_8',
    nameFa: 'لنگ پنج ضربی (۵/۸)',
    meter: '5/8',
    defaultBpm: 118,
    stepSubdivision: 1,
    descriptionFa: 'ریتم لنگ ۲+۳ ایرانی (تُم – بَک | تُم – بَک – بشکن)',
    steps: ['tom', 'bak', 'tom', 'pelang', 'bak'],
  },
  {
    id: 'lang_7_8',
    nameFa: 'لنگ هفت ضربی (۷/۸)',
    meter: '7/8',
    defaultBpm: 122,
    stepSubdivision: 1,
    descriptionFa: 'ریتم لنگ ۳+۲+۲ برای رنگ‌های لنگ و قطعات مقامی',
    steps: ['tom', 'rest', 'bak', 'tom', 'bak', 'pelang', 'chain'],
  },
];

export const GROOVE_BY_ID: Record<IranianGrooveId, IranianGrooveSpec> = Object.fromEntries(
  IRANIAN_GROOVES.map((g) => [g.id, g])
) as Record<IranianGrooveId, IranianGrooveSpec>;

/**
 * Pure Web Audio physical-inspired synthesis of authentic Tombak and Daf strokes:
 * - tom: resonant goblet/frame skin pitch drop
 * - bak: sharp edge rim click/snap
 * - pelang: crisp finger-snap accent
 * - riz: rapid 3-hit finger roll
 * - chain: Daf metallic ring shimmer (or subtle rim scrape on Tombak)
 */
export function triggerPersianStroke(
  ctx: AudioContext,
  when: number,
  stroke: StrokeType,
  instrument: PercussionInstrument,
  volume = 0.75
): void {
  if (stroke === 'rest') return;

  const master = ctx.createGain();
  master.gain.value = Math.max(0.05, Math.min(1, volume));
  master.connect(ctx.destination);

  const playNoiseBurst = (startAt: number, durSec: number, centerHz: number, q: number, level: number) => {
    const len = Math.max(64, Math.floor(ctx.sampleRate * durSec));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.28));
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = centerHz;
    filter.Q.value = q;

    const g = ctx.createGain();
    g.gain.setValueAtTime(level, startAt);
    g.gain.exponentialRampToValueAtTime(0.0008, startAt + durSec);

    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(startAt);
  };

  if (stroke === 'tom') {
    // Deep goblet membrane resonance (Tombak ~105Hz -> 72Hz; Daf ~88Hz -> 62Hz)
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    const startHz = instrument === 'daf' ? 115 : 142;
    const settleHz = instrument === 'daf' ? 62 : 76;
    osc.frequency.setValueAtTime(startHz, when);
    osc.frequency.exponentialRampToValueAtTime(settleHz, when + 0.085);

    g.gain.setValueAtTime(0.95, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + (instrument === 'daf' ? 0.26 : 0.21));

    osc.connect(g);
    g.connect(master);
    osc.start(when);
    osc.stop(when + 0.28);

    // Soft palm thump transient
    playNoiseBurst(when, 0.04, instrument === 'daf' ? 320 : 480, 1.2, 0.35);

    // Subtle chain resonance on Daf Tom
    if (instrument === 'daf') {
      playNoiseBurst(when + 0.012, 0.14, 5400, 3.2, 0.14);
    }
    return;
  }

  if (stroke === 'bak') {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(instrument === 'daf' ? 460 : 540, when);
    osc.frequency.exponentialRampToValueAtTime(220, when + 0.04);
    g.gain.setValueAtTime(0.5, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.06);
    osc.connect(g);
    g.connect(master);
    osc.start(when);
    osc.stop(when + 0.07);

    playNoiseBurst(when, 0.055, instrument === 'daf' ? 2100 : 2500, 1.8, 0.65);
    return;
  }

  if (stroke === 'pelang') {
    playNoiseBurst(when, 0.038, 3400, 2.6, 0.72);
    return;
  }

  if (stroke === 'riz') {
    // 3 rapid micro-strokes simulating Persian finger roll (ریز)
    playNoiseBurst(when, 0.03, 2700, 2.2, 0.42);
    playNoiseBurst(when + 0.038, 0.03, 3000, 2.3, 0.48);
    playNoiseBurst(when + 0.076, 0.036, 2500, 2.0, 0.56);
    return;
  }

  if (stroke === 'chain') {
    // Daf metallic rings / zanjir shimmer
    playNoiseBurst(when, 0.16, 6200, 2.8, instrument === 'daf' ? 0.52 : 0.25);
    playNoiseBurst(when + 0.02, 0.14, 8400, 4.0, instrument === 'daf' ? 0.32 : 0.15);
  }
}

export class IranianPercussionEngine {
  private timerId: number | null = null;
  private stepIdx = 0;
  private nextStepTime = 0;
  private groove: IranianGrooveSpec = IRANIAN_GROOVES[0];
  private instrument: PercussionInstrument = 'tombak';
  private bpm = 112;
  private volume = 0.75;
  private onStep?: (stepIndex: number, stroke: StrokeType) => void;

  get isRunning(): boolean {
    return this.timerId !== null;
  }

  configure(opts: {
    grooveId: IranianGrooveId;
    instrument: PercussionInstrument;
    bpm: number;
    volume: number;
    onStep?: (stepIndex: number, stroke: StrokeType) => void;
  }): void {
    this.groove = GROOVE_BY_ID[opts.grooveId] ?? IRANIAN_GROOVES[0];
    this.instrument = opts.instrument;
    this.bpm = Math.max(45, Math.min(200, opts.bpm));
    this.volume = Math.max(0, Math.min(1, opts.volume));
    this.onStep = opts.onStep;
  }

  start(): void {
    if (this.timerId !== null) return;
    const ctx = getAudioContext();
    this.stepIdx = 0;
    this.nextStepTime = ctx.currentTime + 0.05;

    const scheduleAheadSec = 0.12;
    const tick = () => {
      const audioCtx = getAudioContext();
      while (this.nextStepTime < audioCtx.currentTime + scheduleAheadSec) {
        const idx = this.stepIdx % this.groove.steps.length;
        const stroke = this.groove.steps[idx];
        triggerPersianStroke(audioCtx, this.nextStepTime, stroke, this.instrument, this.volume);

        const delayMs = Math.max(0, (this.nextStepTime - audioCtx.currentTime) * 1000);
        const cb = this.onStep;
        window.setTimeout(() => cb?.(idx, stroke), delayMs);

        const stepSec = 60 / this.bpm / this.groove.stepSubdivision;
        this.nextStepTime += stepSec;
        this.stepIdx = (idx + 1) % this.groove.steps.length;
      }
    };

    tick();
    this.timerId = window.setInterval(tick, 25);
  }

  stop(): void {
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
  }
}
