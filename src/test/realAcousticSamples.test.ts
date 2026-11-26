import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { detectPitchYin } from '../audio/dsp';
import {
  applyOfflineBodyColor,
  buildInstrumentBodyIR,
  PERSIAN_BODY_IR_SPECS,
} from '../audio/instrumentBodyIR';
import {
  DEFAULT_ACOUSTIC_SCULPT,
  getAcousticSculptSettings,
  INSTRUMENT_SECONDARY_BANK,
  INSTRUMENT_TO_SAMPLE_BANK,
  MASTER_STUDIO_PRESETS,
  PERSIAN_BODY_PROFILES,
  REAL_SAMPLE_CREDITS,
  selectBestSampleZone,
  setAcousticSculptSettings,
  type SampleBankManifest,
} from '../audio/sampleEngine';
import { noteToFrequency } from '../data/musicTheory';
import { prepareAndCalibrateUserSample } from '../services/customSampleDb';
import type { InstrumentId } from '../types/music';

const SAMPLES_DIR = path.resolve(process.cwd(), 'public/samples');

function readWavHeaderAndPeak(filePath: string): {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  numSamples: number;
  peak: number;
  rms: number;
} {
  const buf = fs.readFileSync(filePath);
  expect(buf.subarray(0, 4).toString('ascii')).toBe('RIFF');
  expect(buf.subarray(8, 12).toString('ascii')).toBe('WAVE');
  const channels = buf.readUInt16LE(22);
  const sampleRate = buf.readUInt32LE(24);
  const bitsPerSample = buf.readUInt16LE(34);
  const dataSize = buf.readUInt32LE(40);
  const numSamples = Math.floor(dataSize / 2);

  let peak = 0;
  let sumSq = 0;
  for (let i = 0; i < numSamples; i++) {
    const v = buf.readInt16LE(44 + i * 2) / 32768;
    const a = Math.abs(v);
    if (a > peak) peak = a;
    sumSq += v * v;
  }
  return {
    sampleRate,
    channels,
    bitsPerSample,
    numSamples,
    peak,
    rms: Math.sqrt(sumSq / Math.max(1, numSamples)),
  };
}

describe('Real Studio Acoustic Sample Bank v2.5, 14-Mode Body IR Convolution & Microtonal Engine', () => {
  const manifestPath = path.join(SAMPLES_DIR, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as SampleBankManifest;

  it('ships a compact (< 3.5 MB) valid 22.05kHz 16-bit mono real studio sample bank with all 54 WAVs intact', () => {
    expect(manifest.sampleRate).toBe(22050);

    let fileCount = 0;
    let totalBytes = 0;

    // Verify Tombak & Daf percussion WAVs
    for (const percId of ['tombak', 'daf'] as const) {
      const bank = manifest.percussion[percId];
      expect(bank).toBeDefined();
      for (const stroke of ['tom', 'bak', 'pelang', 'riz'] as const) {
        const files = bank.strokes[stroke];
        expect(files.length).toBeGreaterThanOrEqual(1);
        for (const rel of files) {
          const full = path.join(SAMPLES_DIR, rel);
          expect(fs.existsSync(full)).toBe(true);
          totalBytes += fs.statSync(full).size;
          const info = readWavHeaderAndPeak(full);
          expect(info.sampleRate).toBe(22050);
          expect(info.channels).toBe(1);
          expect(info.bitsPerSample).toBe(16);
          expect(info.peak).toBeGreaterThan(0.5);
          expect(info.peak).toBeLessThanOrEqual(0.99);
          expect(info.rms).toBeGreaterThan(0.01);
          fileCount++;
        }
      }
    }

    // Verify all 7 melodic multi-sample banks (incl. tar_plectrum & kamancheh_stac)
    expect(Object.keys(manifest.melodicBanks)).toEqual(
      expect.arrayContaining([
        'kamancheh',
        'kamancheh_stac',
        'tar_plectrum',
        'santur',
        'lute',
        'oud',
        'ney',
      ])
    );

    for (const bank of Object.values(manifest.melodicBanks)) {
      expect(bank.zones.length).toBeGreaterThanOrEqual(4);
      for (const z of bank.zones) {
        const full = path.join(SAMPLES_DIR, z.file);
        expect(fs.existsSync(full)).toBe(true);
        totalBytes += fs.statSync(full).size;
        const info = readWavHeaderAndPeak(full);
        expect(info.sampleRate).toBe(22050);
        expect(info.channels).toBe(1);
        expect(info.bitsPerSample).toBe(16);
        expect(info.peak).toBeGreaterThan(0.5);
        expect(info.peak).toBeLessThanOrEqual(0.99);
        expect(z.measuredHz).toBeGreaterThan(100);
        expect(z.measuredHz).toBeLessThan(1500);
        if (bank.sustained) {
          expect(z.loopStartSec).toBeDefined();
          expect(z.loopEndSec).toBeDefined();
          expect((z.loopEndSec ?? 0) - (z.loopStartSec ?? 0)).toBeGreaterThan(0.4);
        }
        fileCount++;
      }
    }

    expect(fileCount).toBe(54);
    expect(totalBytes).toBeLessThan(3.5 * 1024 * 1024);
  });

  it('maps all 7 Persian melodic instruments + secondary layers & achieves < 0.01c microtonal rate precision on Koron/Sori', () => {
    const allInst: InstrumentId[] = [
      'tar',
      'setar',
      'santur',
      'ney',
      'kamancheh',
      'oud',
      'tanbur',
    ];
    const testNotes = [
      { letter: 'E' as const, accidental: 'koron' as const, octave: 4 },
      { letter: 'G' as const, accidental: 'natural' as const, octave: 4 },
      { letter: 'A' as const, accidental: 'koron' as const, octave: 4 },
      { letter: 'F' as const, accidental: 'sori' as const, octave: 4 },
      { letter: 'C' as const, accidental: 'natural' as const, octave: 5 },
    ];

    for (const inst of allInst) {
      const bankId = INSTRUMENT_TO_SAMPLE_BANK[inst];
      const bank = manifest.melodicBanks[bankId];
      expect(bank).toBeDefined();
      expect(PERSIAN_BODY_PROFILES[inst]).toBeDefined();

      const secId = INSTRUMENT_SECONDARY_BANK[inst];
      if (secId) {
        expect(manifest.melodicBanks[secId]).toBeDefined();
      }

      for (const note of testNotes) {
        const targetHz = noteToFrequency(note, 440, 'traditional_56');
        const sel = selectBestSampleZone(bank.zones, targetHz);
        expect(sel).not.toBeNull();
        const effectiveHz = (sel?.zone.measuredHz ?? 1) * (sel?.playbackRate ?? 1);
        const errCents = Math.abs(1200 * Math.log2(effectiveHz / targetHz));
        expect(errCents).toBeLessThan(0.01);
        expect(Math.abs(sel?.shiftCents ?? 9999)).toBeLessThan(650);
      }
    }
  });

  it('builds strictly L2-normalized, zero-DC, pitch-preserving 12-14 mode Persian Body IRs for all 7 instruments', () => {
    const allInst: InstrumentId[] = [
      'tar',
      'setar',
      'santur',
      'ney',
      'kamancheh',
      'oud',
      'tanbur',
    ];
    const sr = 22050;
    const akHz = noteToFrequency(
      { letter: 'A', accidental: 'koron', octave: 4 },
      440,
      'traditional_56'
    );
    const sine = new Float32Array(8192);
    for (let i = 0; i < sine.length; i++) {
      sine[i] = 0.55 * Math.sin((2 * Math.PI * akHz * i) / sr);
    }

    for (const inst of allInst) {
      const spec = PERSIAN_BODY_IR_SPECS[inst];
      expect(spec.modes.length).toBeGreaterThanOrEqual(12);

      const ir = buildInstrumentBodyIR(inst, sr);
      expect(ir.length).toBeGreaterThan(500);

      let energy = 0;
      let sum = 0;
      for (let i = 0; i < ir.length; i++) {
        expect(Number.isFinite(ir[i])).toBe(true);
        energy += ir[i] * ir[i];
        sum += ir[i];
      }
      expect(Math.abs(Math.sqrt(energy) - 1)).toBeLessThan(0.02);
      expect(Math.abs(sum / ir.length)).toBeLessThan(0.001);

      // Verify offline body convolution introduces ZERO pitch drift (< 0.8c)
      const convolved = applyOfflineBodyColor(sine, sr, inst, 0.45);
      const yin = detectPitchYin(convolved.subarray(2048, 2048 + 4096), sr, {
        rmsThreshold: 0.002,
      });
      expect(yin.frequency).not.toBeNull();
      const driftCents = Math.abs(1200 * Math.log2((yin.frequency ?? 1) / akHz));
      expect(driftCents).toBeLessThan(0.8);
    }
  });

  it('automatically trims silence, removes DC offset, normalizes & YIN-calibrates user-uploaded real samples (< 1.5c error)', () => {
    const sr = 22050;
    const targetHz = noteToFrequency(
      { letter: 'A', accidental: 'koron', octave: 4 },
      440,
      'traditional_56'
    );
    const silentLead = Math.floor(sr * 0.09);
    const toneLen = Math.floor(sr * 0.85);
    const raw = new Float32Array(silentLead + toneLen);

    for (let i = 0; i < silentLead; i++) {
      raw[i] = 0.08;
    }
    for (let i = 0; i < toneLen; i++) {
      const t = i / sr;
      const env = Math.min(1, t / 0.015) * Math.exp(-t * 1.4);
      raw[silentLead + i] =
        0.08 +
        env *
          (0.45 * Math.sin(2 * Math.PI * targetHz * t) +
            0.18 * Math.sin(4 * Math.PI * targetHz * t) +
            0.09 * Math.sin(6 * Math.PI * targetHz * t));
    }

    const res = prepareAndCalibrateUserSample(raw, sr);
    expect(res.durationSec).toBeLessThan(0.88);
    expect(res.durationSec).toBeGreaterThan(0.75);

    const errCents = Math.abs(1200 * Math.log2(res.measuredHz / targetHz));
    expect(errCents).toBeLessThan(1.5);

    let maxAbs = 0;
    for (let i = 0; i < res.pcm.length; i++) {
      const a = Math.abs(res.pcm[i]);
      if (a > maxAbs) maxAbs = a;
    }
    expect(maxAbs).toBeGreaterThan(0.8);
    expect(maxAbs).toBeLessThanOrEqual(0.86);
  });

  it('persists and clamps all v2.5 AcousticSculptSettings, Master Studio Presets & open-license attributions', () => {
    expect(MASTER_STUDIO_PRESETS).toHaveLength(4);

    const next = setAcousticSculptSettings({
      engineMode: 'acoustic_samples',
      bodyWarmth: 1.5,
      attackCrispness: -0.3,
      sympatheticShimmer: 0.72,
      bodyConvolverMix: 1.25,
      neyBreathiness: -0.2,
      vibratoExpression: 0.85,
      santurMallet: 'wood',
      legatoMalesh: false,
      humanizeMicroCents: false,
    });
    expect(next.engineMode).toBe('acoustic_samples');
    expect(next.bodyWarmth).toBe(1);
    expect(next.attackCrispness).toBe(0);
    expect(next.bodyConvolverMix).toBe(1);
    expect(next.neyBreathiness).toBe(0);
    expect(next.vibratoExpression).toBeCloseTo(0.85, 2);
    expect(next.santurMallet).toBe('wood');
    expect(next.legatoMalesh).toBe(false);
    expect(getAcousticSculptSettings().santurMallet).toBe('wood');

    setAcousticSculptSettings({ ...DEFAULT_ACOUSTIC_SCULPT });
    expect(getAcousticSculptSettings().engineMode).toBe('hybrid_studio');
    expect(getAcousticSculptSettings().santurMallet).toBe('felt');

    expect(REAL_SAMPLE_CREDITS).toHaveLength(3);
    expect(REAL_SAMPLE_CREDITS.some((c) => c.license === 'CC BY 3.0')).toBe(true);
    expect(REAL_SAMPLE_CREDITS.some((c) => c.license.includes('CC0 1.0'))).toBe(true);
  });
});
