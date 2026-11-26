import { noteToFrequency } from '../data/musicTheory';
import type {
  DroneTimbre,
  DroneVoicing,
  KoronMode,
  PersianNoteSpec,
} from '../types/music';
import { getAudioContext } from './audioContext';

export interface DroneConfig {
  baseNote: PersianNoteSpec;
  shahedNote: PersianNoteSpec;
  voicing: DroneVoicing;
  timbre: DroneTimbre;
  volume: number; // 0..1
  a4Hz: number;
  koronMode: KoronMode;
}

/**
 * Pure helper computing exact drone voice frequencies (Hz) tuned to base / 5th / shahed
 * in an unobtrusive warm register (shifted down an octave when needed so it never masks vocals/instruments).
 */
export function computeDroneFrequencies(config: DroneConfig): number[] {
  let baseHz = noteToFrequency(config.baseNote, config.a4Hz, config.koronMode);
  while (baseHz > 230) baseHz /= 2;
  while (baseHz < 75) baseHz *= 2;

  if (config.voicing === 'base') {
    return [baseHz, baseHz * 2];
  }
  if (config.voicing === 'base_fifth') {
    // Pure Just 3:2 fifth for maximum acoustic warmth without beating
    return [baseHz, baseHz * 1.5, baseHz * 2];
  }

  let shahedHz = noteToFrequency(config.shahedNote, config.a4Hz, config.koronMode);
  while (shahedHz > baseHz * 2.2) shahedHz /= 2;
  while (shahedHz < baseHz * 0.95) shahedHz *= 2;

  if (Math.abs(shahedHz - baseHz) < 3) {
    return [baseHz, baseHz * 1.5, baseHz * 2];
  }
  return [baseHz, shahedHz, baseHz * 2];
}

/**
 * Continuous polyphonic Web Audio Persian Drone / Shahi Companion (واخوان هوشمند).
 * Synthesizes warm resonant sustained tones tailored for Tanbur/Tar, Ney, or Kamancheh timbres.
 */
export class PersianDroneEngine {
  private running = false;
  private config: DroneConfig | null = null;
  private masterGain: GainNode | null = null;
  private oscillators: OscillatorNode[] = [];
  private lfo: OscillatorNode | null = null;

  get isRunning(): boolean {
    return this.running;
  }

  start(config: DroneConfig): void {
    this.stop();
    this.config = config;
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.0001, now);
    masterGain.gain.exponentialRampToValueAtTime(
      Math.max(0.01, Math.min(0.45, config.volume * 0.32)),
      now + 0.45
    );

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value =
      config.timbre === 'tanbur' ? 880 : config.timbre === 'kamancheh' ? 1280 : 620;
    filter.Q.value = config.timbre === 'kamancheh' ? 1.8 : 1.0;

    // Warm wooden acoustic body formant filter for realistic Persian drone timbre
    const bodyFormant = ctx.createBiquadFilter();
    bodyFormant.type = 'peaking';
    bodyFormant.frequency.value =
      config.timbre === 'tanbur' ? 280 : config.timbre === 'kamancheh' ? 480 : 640;
    bodyFormant.Q.value = 1.4;
    bodyFormant.gain.value = 3.8;

    // Gentle acoustic breath modulation (0.18 Hz slow filter shimmer so drone sounds alive & organic)
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 0.18;
    lfoGain.gain.value = config.timbre === 'ney' ? 95 : 150;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start(now);

    filter.connect(bodyFormant);
    bodyFormant.connect(masterGain);
    masterGain.connect(ctx.destination);

    const freqs = computeDroneFrequencies(config);
    const oscs: OscillatorNode[] = [];

    freqs.forEach((freq, idx) => {
      const voiceGain = ctx.createGain();
      voiceGain.gain.value = idx === 0 ? 0.52 : idx === 1 ? 0.28 : 0.16;

      // Symmetrically balanced (-0.75¢ / +0.75¢) so drone pitch center is dead-on 0.0¢!
      const spread = Math.pow(2, 0.75 / 1200);

      const oscMain = ctx.createOscillator();
      oscMain.type =
        config.timbre === 'tanbur'
          ? 'sawtooth'
          : config.timbre === 'kamancheh'
          ? 'sawtooth'
          : 'triangle';
      oscMain.frequency.setValueAtTime(freq / spread, now);

      const oscChorus = ctx.createOscillator();
      oscChorus.type = config.timbre === 'ney' ? 'sine' : 'triangle';
      oscChorus.frequency.setValueAtTime(freq * spread, now);

      oscMain.connect(voiceGain);
      oscChorus.connect(voiceGain);
      voiceGain.connect(filter);

      oscMain.start(now);
      oscChorus.start(now);
      oscs.push(oscMain, oscChorus);
    });

    this.masterGain = masterGain;
    this.oscillators = oscs;
    this.lfo = lfo;
    this.running = true;
  }

  update(nextConfig: DroneConfig): void {
    const prev = this.config;
    this.config = nextConfig;
    if (!this.running) return;

    // If only volume changed, smoothly ramp gain without restarting oscillators
    if (
      prev &&
      prev.timbre === nextConfig.timbre &&
      prev.voicing === nextConfig.voicing &&
      prev.a4Hz === nextConfig.a4Hz &&
      prev.koronMode === nextConfig.koronMode &&
      prev.baseNote.letter === nextConfig.baseNote.letter &&
      prev.baseNote.accidental === nextConfig.baseNote.accidental &&
      prev.baseNote.octave === nextConfig.baseNote.octave &&
      prev.shahedNote.letter === nextConfig.shahedNote.letter &&
      prev.shahedNote.accidental === nextConfig.shahedNote.accidental &&
      prev.shahedNote.octave === nextConfig.shahedNote.octave &&
      this.masterGain
    ) {
      const ctx = getAudioContext();
      this.masterGain.gain.setTargetAtTime(
        Math.max(0.005, Math.min(0.45, nextConfig.volume * 0.32)),
        ctx.currentTime,
        0.08
      );
      return;
    }

    // Retune smoothly by restarting with updated pitches/timbre
    this.start(nextConfig);
  }

  stop(): void {
    if (!this.running && this.oscillators.length === 0) return;
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    if (this.masterGain) {
      try {
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setTargetAtTime(0.0001, now, 0.05);
      } catch {
        // ignore
      }
    }

    const oldOscs = this.oscillators;
    const oldLfo = this.lfo;
    this.oscillators = [];
    this.lfo = null;
    this.masterGain = null;
    this.running = false;

    window.setTimeout(() => {
      for (const osc of oldOscs) {
        try {
          osc.stop();
          osc.disconnect();
        } catch {
          // ignore
        }
      }
      if (oldLfo) {
        try {
          oldLfo.stop();
          oldLfo.disconnect();
        } catch {
          // ignore
        }
      }
    }, 180);
  }
}
