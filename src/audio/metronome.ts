import type { IranianMeter, Subdivision } from '../types/music';
import { getAudioContext } from './audioContext';

export interface MeterDefinition {
  meter: IranianMeter;
  labelFa: string;
  categoryFa: string;
  pulsesPerBar: number;
  accentPattern: Array<'tom' | 'bak' | 'pelang'>; // Tom=strong, Pelang=secondary, Bak=light
  baseUnitFactor: number; // 1 for quarter-note meters, 0.5 for eighth-note meters
}

export const IRANIAN_METERS: Record<IranianMeter, MeterDefinition> = {
  '2/4': {
    meter: '2/4',
    labelFa: '۲/۴ ساده',
    categoryFa: 'ساده (چهارمضراب / رِنگ دوضربی)',
    pulsesPerBar: 2,
    accentPattern: ['tom', 'bak'],
    baseUnitFactor: 1,
  },
  '3/4': {
    meter: '3/4',
    labelFa: '۳/۴ ساده',
    categoryFa: 'ساده (تصنیف سه‌ضربی)',
    pulsesPerBar: 3,
    accentPattern: ['tom', 'bak', 'bak'],
    baseUnitFactor: 1,
  },
  '4/4': {
    meter: '4/4',
    labelFa: '۴/۴ ساده',
    categoryFa: 'ساده (پیش‌درآمد)',
    pulsesPerBar: 4,
    accentPattern: ['tom', 'bak', 'pelang', 'bak'],
    baseUnitFactor: 1,
  },
  '5/8': {
    meter: '5/8',
    labelFa: '۵/۸ لنگ (۳+۲)',
    categoryFa: 'لنگ ایرانی',
    pulsesPerBar: 5,
    accentPattern: ['tom', 'bak', 'bak', 'pelang', 'bak'],
    baseUnitFactor: 0.5,
  },
  '6/8': {
    meter: '6/8',
    labelFa: '۶/۸ ترکیبی (۳+۳)',
    categoryFa: 'ترکیبی (رِنگ / کرشمه / ضربی)',
    pulsesPerBar: 6,
    accentPattern: ['tom', 'bak', 'bak', 'pelang', 'bak', 'bak'],
    baseUnitFactor: 0.5,
  },
  '7/8': {
    meter: '7/8',
    labelFa: '۷/۸ لنگ (۳+۲+۲)',
    categoryFa: 'لنگ (تصنیف‌های کردی و کلاسیک)',
    pulsesPerBar: 7,
    accentPattern: ['tom', 'bak', 'bak', 'pelang', 'bak', 'pelang', 'bak'],
    baseUnitFactor: 0.5,
  },
};

export interface MetronomeTickInfo {
  pulseIndex: number; // 0..pulsesPerBar-1
  subIndex: number;   // 0..subdivision-1
  accent: 'tom' | 'bak' | 'pelang' | 'sub';
}

/**
 * Computes BPM from an array of tap timestamps (ms).
 */
export function computeTapTempoBpm(timestampsMs: number[]): number | null {
  if (timestampsMs.length < 2) return null;
  const recent = timestampsMs.slice(-6);
  const intervals: number[] = [];
  for (let i = 1; i < recent.length; i++) {
    const dt = recent[i] - recent[i - 1];
    if (dt >= 220 && dt <= 2000) {
      intervals.push(dt);
    }
  }
  if (intervals.length === 0) return null;
  const avgMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  return Math.max(40, Math.min(220, Math.round(60000 / avgMs)));
}

/**
 * Synthesizes an authentic Tonbak-inspired Tom / Pelang / Bak percussion hit directly on Web Audio timeline.
 */
function triggerTonbakHit(
  ctx: AudioContext,
  when: number,
  accent: 'tom' | 'bak' | 'pelang' | 'sub',
  volume = 0.75
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  if (accent === 'tom') {
    // Deep resonant Tonbak Tom
    osc.type = 'sine';
    osc.frequency.setValueAtTime(165, when);
    osc.frequency.exponentialRampToValueAtTime(86, when + 0.09);
    gain.gain.setValueAtTime(0.001, when);
    gain.gain.linearRampToValueAtTime(volume, when + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.001, when + 0.14);
  } else if (accent === 'pelang') {
    // Mid-rim secondary accent
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(420, when);
    osc.frequency.exponentialRampToValueAtTime(250, when + 0.055);
    gain.gain.setValueAtTime(0.001, when);
    gain.gain.linearRampToValueAtTime(volume * 0.72, when + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.001, when + 0.085);
  } else if (accent === 'bak') {
    // Crisp rim Bak
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(680, when);
    osc.frequency.exponentialRampToValueAtTime(420, when + 0.035);
    gain.gain.setValueAtTime(0.001, when);
    gain.gain.linearRampToValueAtTime(volume * 0.5, when + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.001, when + 0.055);
  } else {
    // Subdivision tick (ریزتقسیم)
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1180, when);
    gain.gain.setValueAtTime(0.001, when);
    gain.gain.linearRampToValueAtTime(volume * 0.25, when + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.001, when + 0.03);
  }

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(when);
  osc.stop(when + 0.16);
}

/**
 * High-precision Web Audio API Lookahead Metronome Scheduler (Chris Wilson pattern)
 * with zero drift and full Iranian meter + subdivision support.
 */
export class PrecisionMetronome {
  private bpm = 96;
  private meter: IranianMeter = '6/8';
  private subdivision: Subdivision = 1;
  private isRunning = false;
  private nextNoteTime = 0;
  private currentStep = 0;
  private timerId: number | null = null;
  private onTick: ((tick: MetronomeTickInfo) => void) | null = null;

  private readonly lookaheadMs = 25;
  private readonly scheduleAheadSec = 0.1;

  configure(opts: {
    bpm?: number;
    meter?: IranianMeter;
    subdivision?: Subdivision;
    onTick?: (tick: MetronomeTickInfo) => void;
  }): void {
    if (opts.bpm !== undefined) {
      this.bpm = Math.max(40, Math.min(220, opts.bpm));
    }
    if (opts.meter !== undefined) {
      this.meter = opts.meter;
    }
    if (opts.subdivision !== undefined) {
      this.subdivision = opts.subdivision;
    }
    if (opts.onTick !== undefined) {
      this.onTick = opts.onTick;
    }
  }

  start(): void {
    if (this.isRunning) return;
    const ctx = getAudioContext();
    this.isRunning = true;
    this.currentStep = 0;
    this.nextNoteTime = ctx.currentTime + 0.04;
    this.timerId = window.setInterval(() => this.scheduler(), this.lookaheadMs);
  }

  stop(): void {
    this.isRunning = false;
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  get running(): boolean {
    return this.isRunning;
  }

  private scheduler(): void {
    if (!this.isRunning) return;
    const ctx = getAudioContext();
    const def = IRANIAN_METERS[this.meter];
    const totalStepsPerBar = def.pulsesPerBar * this.subdivision;

    while (this.nextNoteTime < ctx.currentTime + this.scheduleAheadSec) {
      const stepInBar = this.currentStep % totalStepsPerBar;
      const pulseIndex = Math.floor(stepInBar / this.subdivision);
      const subIndex = stepInBar % this.subdivision;
      const accent: MetronomeTickInfo['accent'] =
        subIndex === 0 ? def.accentPattern[pulseIndex] ?? 'bak' : 'sub';

      triggerTonbakHit(ctx, this.nextNoteTime, accent);

      const delayMs = Math.max(0, (this.nextNoteTime - ctx.currentTime) * 1000);
      const tickInfo: MetronomeTickInfo = { pulseIndex, subIndex, accent };
      window.setTimeout(() => {
        if (this.isRunning) {
          this.onTick?.(tickInfo);
        }
      }, delayMs);

      const secondsPerPulse = (60 / this.bpm) * def.baseUnitFactor;
      this.nextNoteTime += secondsPerPulse / this.subdivision;
      this.currentStep += 1;
    }
  }
}
