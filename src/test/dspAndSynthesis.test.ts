import { describe, expect, it } from 'vitest';
import {
  detectPitchYin,
  evaluateForoud,
  extractHarmonics,
  OctaveContinuityFilter,
  TahrirDetector,
} from '../audio/dsp';
import { synthesizeKarplusStrongSamples } from '../audio/karplusStrong';
import { computeTapTempoBpm, IRANIAN_METERS } from '../audio/metronome';
import { analyzePcmSamples } from '../audio/recordingAnalyzer';
import { noteToFrequency } from '../data/musicTheory';
import { ALL_GUSHEHS } from '../data/radifData';
import type { InstrumentId } from '../types/music';

function makeSine(freqHz: number, sampleRate: number, length: number): Float32Array {
  const buf = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    buf[i] = 0.6 * Math.sin((2 * Math.PI * freqHz * i) / sampleRate);
  }
  return buf;
}

describe('Deterministic DSP Engine (YIN, Octave Filter, Tahrir ~6Hz, Foroud, Harmonics)', () => {
  it('detects microtonal A-Koron (-50¢ and -56¢) pitch accurately via YIN', () => {
    const sr = 44100;
    const ak50 = noteToFrequency({ letter: 'A', accidental: 'koron', octave: 4 }, 440, 'standard_50');
    const res50 = detectPitchYin(makeSine(ak50, sr, 2048), sr);
    expect(res50.frequency).not.toBeNull();
    expect(Math.abs(1200 * Math.log2((res50.frequency ?? 1) / ak50))).toBeLessThan(2);

    const ak56 = noteToFrequency({ letter: 'A', accidental: 'koron', octave: 4 }, 440, 'traditional_56');
    const res56 = detectPitchYin(makeSine(ak56, sr, 2048), sr);
    expect(res56.frequency).not.toBeNull();
    expect(Math.abs(1200 * Math.log2((res56.frequency ?? 1) / ak56))).toBeLessThan(2);
  });

  it('suppresses spurious 2x and 0.5x octave jumps with OctaveContinuityFilter', () => {
    const filter = new OctaveContinuityFilter(7);
    expect(filter.filter(392)).toBeCloseTo(392, 1);
    expect(filter.filter(393)).toBeCloseTo(393, 1);
    expect(filter.filter(391)).toBeCloseTo(391, 1);
    // Isolated harmonic lock jumping up an octave (784 Hz)
    expect(filter.filter(784)).toBeCloseTo(392, 1);
    // Isolated sub-octave drop (196 Hz)
    expect(filter.filter(196)).toBeCloseTo(392, 1);
  });

  it('automatically detects ~6 Hz Persian Tahrir oscillation and rejects steady notes', () => {
    const detector = new TahrirDetector(900);
    // 1. Steady pitch -> no Tahrir
    let state = { detected: false, rateHz: 0, depthCents: 0 };
    for (let i = 0; i < 30; i++) {
      state = detector.push(440, i * 25);
    }
    expect(state.detected).toBe(false);

    // 2. 6 Hz Tahrir oscillation with ±55 cents excursion
    detector.reset();
    for (let i = 0; i < 36; i++) {
      const tMs = i * 25;
      const cents = 55 * Math.sin(2 * Math.PI * 6.0 * (tMs / 1000));
      const freq = 440 * Math.pow(2, cents / 1200);
      state = detector.push(freq, tMs);
    }
    expect(state.detected).toBe(true);
    expect(state.rateHz).toBeGreaterThanOrEqual(4.5);
    expect(state.rateHz).toBeLessThanOrEqual(7.8);
  });

  it('evaluates Foroud cadence accuracy cleanly', () => {
    const targetIst = { letter: 'G' as const, accidental: 'natural' as const, octave: 4 };
    const g4 = noteToFrequency(targetIst, 440, 'standard_50');

    const perfectScore = evaluateForoud([g4, g4 * 1.001, g4 * 0.999, g4, g4], targetIst);
    expect(perfectScore).toBeGreaterThanOrEqual(95);

    const offScore = evaluateForoud([g4 * 1.05, g4 * 1.06, g4 * 1.055], targetIst);
    expect(offScore).toBeLessThan(40);
  });

  it('extracts fundamental and harmonic peaks from FFT dB bins', () => {
    const fftSize = 4096;
    const sampleRate = 44100;
    const binHz = sampleRate / fftSize;
    const bins = new Float32Array(fftSize / 2).fill(-95);
    const f0 = 220;
    for (let h = 1; h <= 5; h++) {
      const idx = Math.round((f0 * h) / binHz);
      bins[idx] = -10 - h * 6;
    }
    const harmonics = extractHarmonics(bins, sampleRate, fftSize, f0, 5);
    expect(harmonics).toHaveLength(5);
    expect(harmonics[0].harmonicNumber).toBe(1);
    expect(Math.abs(harmonics[0].frequencyHz - 220)).toBeLessThan(15);
    expect(harmonics[0].magnitudeDb).toBeCloseTo(-16, 1);
  });
});

describe('Karplus-Strong Physical Modeling Synthesis, Metronome & Recording Analyzer', () => {
  it('synthesizes clean finite waveforms for all 7 Persian instruments (Tar, Setar, Santur, Ney, Kamancheh, Oud, Tanbur)', () => {
    const instruments: InstrumentId[] = [
      'tar',
      'setar',
      'santur',
      'ney',
      'kamancheh',
      'oud',
      'tanbur',
    ];
    const sr = 22050;
    const targetHz = 392.0; // G4

    for (const inst of instruments) {
      const samples = synthesizeKarplusStrongSamples({
        frequency: targetHz,
        sampleRate: sr,
        durationSec: 0.45,
        instrument: inst,
      });
      expect(samples.length).toBeGreaterThan(2000);
      let maxAbs = 0;
      for (let i = 0; i < samples.length; i++) {
        expect(Number.isFinite(samples[i])).toBe(true);
        const a = Math.abs(samples[i]);
        if (a > maxAbs) maxAbs = a;
      }
      expect(maxAbs).toBeGreaterThan(0.05);
      expect(maxAbs).toBeLessThanOrEqual(1.0);
    }
  });

  it('maintains sub-2-cent pitch accuracy with zero octave jumps across all 7 Persian instruments (including Koron)', () => {
    const instruments: InstrumentId[] = [
      'tar',
      'setar',
      'santur',
      'ney',
      'kamancheh',
      'oud',
      'tanbur',
    ];
    const sr = 44100;
    const notes = [
      { letter: 'D' as const, accidental: 'natural' as const, octave: 3 },
      { letter: 'E' as const, accidental: 'koron' as const, octave: 4 },
      { letter: 'G' as const, accidental: 'natural' as const, octave: 4 },
      { letter: 'A' as const, accidental: 'koron' as const, octave: 4 },
      { letter: 'C' as const, accidental: 'natural' as const, octave: 5 },
      { letter: 'G' as const, accidental: 'natural' as const, octave: 5 },
    ];

    for (const inst of instruments) {
      for (const note of notes) {
        const targetHz = noteToFrequency(note, 440, 'traditional_56');
        const samples = synthesizeKarplusStrongSamples({
          frequency: targetHz,
          sampleRate: sr,
          durationSec: 0.65,
          instrument: inst,
        });
        const steadyWindow = samples.subarray(8820, 8820 + 4096);
        const yin = detectPitchYin(steadyWindow, sr, { rmsThreshold: 0.001 });
        expect(yin.frequency).not.toBeNull();
        const errCents = Math.abs(1200 * Math.log2((yin.frequency ?? 1) / targetHz));
        expect(errCents).toBeLessThan(2.0);
      }
    }
  });

  it('supports all 6 Iranian meters and accurate Tap Tempo calculation', () => {
    expect(Object.keys(IRANIAN_METERS)).toEqual(['2/4', '3/4', '4/4', '5/8', '6/8', '7/8']);
    expect(IRANIAN_METERS['5/8'].pulsesPerBar).toBe(5);
    expect(IRANIAN_METERS['7/8'].pulsesPerBar).toBe(7);

    // 500ms intervals => 120 BPM
    expect(computeTapTempoBpm([1000, 1500, 2000, 2500])).toBe(120);
    expect(computeTapTempoBpm([1000])).toBeNull();
  });

  it('analyzes recorded PCM samples deterministically for loudness, envelope, and pitch accuracy', () => {
    const sr = 44100;
    const g4 = noteToFrequency({ letter: 'G', accidental: 'natural', octave: 4 }, 440, 'standard_50');
    const pcm = makeSine(g4, sr, sr); // 1 second pure G4
    const analysis = analyzePcmSamples(pcm, sr, ALL_GUSHEHS[0].scale, 440, 'standard_50');
    expect(analysis.durationSeconds).toBeCloseTo(1.0, 1);
    expect(analysis.rmsDb).toBeGreaterThan(-12);
    expect(analysis.envelope).toHaveLength(48);
    expect(analysis.avgAccuracy).toBeGreaterThanOrEqual(92);
  });
});
