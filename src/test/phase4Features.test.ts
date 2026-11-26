import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  applyOfflineHallReverb,
  generateHallImpulseResponse,
  HALL_REVERB_PRESETS,
} from '../audio/hallReverb';
import { renderEnsembleMixdownWav } from '../audio/mixdownEngine';
import {
  generateDastgahQuizQuestion,
  recordDastgahQuizResult,
} from '../core/dastgahQuiz';
import {
  computeSanturRetunePlan,
  OUD_5_COURSES,
  TANBUR_14_FRET_OFFSETS_CENTS,
  TANBUR_TUNINGS,
} from '../core/santurRetuneGuide';
import {
  createScoreFromGusheh,
  customScoreToGusheh,
  stepNoteDiatonic,
} from '../core/scoreEditor';
import { compareRadifTraditions } from '../core/traditionComparison';
import { ALL_GUSHEHS } from '../data/radifData';
import { generatePrintableSheetHtml } from '../utils/printableSheet';

describe('Phase 4 Studio Features (Score Editor, A/B Traditions, Tanbur/Oud/Santur Retuning, Mixdown, Hall Reverb, Dastgah Quiz, A4 Print, Pages Deploy)', () => {
  const shurDaramad = ALL_GUSHEHS[0];

  it('generates valid stereo Hall Reverb impulse responses and clean non-clipping offline reverb across all 4 presets', () => {
    const impulse = new Float32Array(2205);
    impulse[0] = 0.9;
    impulse[10] = -0.5;

    for (const preset of HALL_REVERB_PRESETS) {
      const ir = generateHallImpulseResponse(preset.id, 22050);
      expect(ir.left.length).toBeGreaterThan(32);
      expect(ir.right.length).toBe(ir.left.length);

      const wet = applyOfflineHallReverb(impulse, 22050, preset.id);
      expect(wet.left.length).toBeGreaterThanOrEqual(impulse.length);
      for (let i = 0; i < wet.left.length; i++) {
        expect(Number.isFinite(wet.left[i])).toBe(true);
        expect(Math.abs(wet.left[i])).toBeLessThanOrEqual(1.0);
        expect(Math.abs(wet.right[i])).toBeLessThanOrEqual(1.0);
      }
    }
  });

  it('renders a valid 16-bit Stereo WAV multi-track ensemble mixdown (Instrument + Drone + Tombak + Recording + Reverb)', async () => {
    const studentPcm = new Float32Array(4410);
    for (let i = 0; i < studentPcm.length; i++) {
      studentPcm[i] = Math.sin((2 * Math.PI * 392 * i) / 22050) * 0.25;
    }

    const mix = renderEnsembleMixdownWav({
      gusheh: shurDaramad,
      instrument: 'tar',
      a4Hz: 440,
      koronMode: 'standard_50',
      bpm: 108,
      enableOrnaments: true,
      reverbPreset: 'vahdat_hall',
      melodyVolume: 0.8,
      droneVolume: 0.4,
      droneVoicing: 'base_fifth',
      percussionVolume: 0.5,
      percussionInstrument: 'tombak',
      grooveId: 'chaharmezrab_6_8',
      recordingVolume: 0.7,
      recordingPcm: studentPcm,
      recordingSampleRate: 22050,
      sampleRate: 11025, // fast test render rate
    });

    expect(mix.wavBlob.type).toBe('audio/wav');
    expect(mix.durationSec).toBeGreaterThan(1);
    expect(mix.peakLevel).toBeGreaterThan(0.05);
    expect(mix.peakLevel).toBeLessThanOrEqual(1.0);

    const bytes = mix.wavBytes;
    // RIFF....WAVE header
    expect(String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3])).toBe('RIFF');
    expect(String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11])).toBe('WAVE');
  });

  it('supports interactive microtonal score editing, diatonic stepping, and Gusheh conversion', () => {
    const score = createScoreFromGusheh(shurDaramad);
    expect(score.notes.length).toBe(shurDaramad.melody.length);

    const steppedUp = stepNoteDiatonic(
      { letter: 'B', accidental: 'natural', octave: 4, durationBeats: 1 },
      1
    );
    expect(steppedUp.letter).toBe('C');
    expect(steppedUp.octave).toBe(5);

    const steppedDown = stepNoteDiatonic(
      { letter: 'C', accidental: 'koron', octave: 4, durationBeats: 1 },
      -1
    );
    expect(steppedDown.letter).toBe('B');
    expect(steppedDown.octave).toBe(3);

    const converted = customScoreToGusheh(score);
    expect(converted.melody.length).toBe(score.notes.length);
    expect(converted.scale.length).toBeGreaterThan(0);
  });

  it('compares Radif traditions (A/B) accurately between instrumental and vocal lineages', () => {
    const report = compareRadifTraditions(shurDaramad, 'mirza_abdollah', 'mahmoud_karimi');
    expect(report.variantA.recommendedBpm).toBeGreaterThan(report.variantB.recommendedBpm);
    expect(report.variantA.recommendedKoronMode).toBe('standard_50');
    expect(report.variantB.recommendedKoronMode).toBe('traditional_56');
    expect(report.ornamentDiffCount).toBeGreaterThan(0);
    expect(report.keyDifferencesFa.length).toBeGreaterThanOrEqual(3);
  });

  it('computes authentic Santur bridge retuning plans and includes Tanbur 14-fret & Oud 5-course specs', () => {
    const samePlan = computeSanturRetunePlan('shur', 'shur');
    expect(samePlan.changedCount).toBe(0);

    const shurToHomayun = computeSanturRetunePlan('shur', 'homayun');
    expect(shurToHomayun.changedCount).toBeGreaterThan(0);
    expect(shurToHomayun.shifts[0].instructionFa).toContain('تغییر از');

    const shurToMahur = computeSanturRetunePlan('shur', 'mahur');
    expect(shurToMahur.changedCount).toBeGreaterThan(0);

    expect(TANBUR_TUNINGS).toHaveLength(3);
    expect(TANBUR_14_FRET_OFFSETS_CENTS).toHaveLength(15);
    expect(OUD_5_COURSES).toHaveLength(5);
  });

  it('generates Dastgah & Signature Gusheh ear-recognition exam questions and records mastery stats', () => {
    const qDastgah = generateDastgahQuizQuestion('dastgah', 42);
    expect(qDastgah.options).toHaveLength(4);
    expect(qDastgah.options.some((o) => o.id === qDastgah.correctOptionId)).toBe(true);
    expect(qDastgah.hintFa.length).toBeGreaterThan(5);

    const qGusheh = generateDastgahQuizQuestion('gusheh', 77);
    expect(qGusheh.options).toHaveLength(4);
    expect(qGusheh.options.some((o) => o.id === qGusheh.correctOptionId)).toBe(true);

    const updated = recordDastgahQuizResult('shur', true);
    expect(updated.shur.attempts).toBeGreaterThanOrEqual(1);
    expect(updated.shur.correct).toBeGreaterThanOrEqual(1);
  });

  it('generates print-ready A4 Persian Sheet Music HTML with embedded SVG microtonal staff and Teacher Notes', () => {
    const html = generatePrintableSheetHtml({
      gusheh: shurDaramad,
      instrument: 'tar',
      koronMode: 'traditional_56',
      a4Hz: 440,
      teacherNoteFa: 'تمرین مضراب راست و چپ با تاکید بر کرن درجه دوم',
    });
    expect(html).toContain('@page { size: A4 portrait');
    expect(html).toContain('<svg');
    expect(html).toContain(shurDaramad.nameFa);
    expect(html).toContain('تمرین مضراب راست و چپ');
    expect(html).toContain('یادداشت استاد');
  });

  it('includes a valid GitHub Pages auto-deployment workflow', () => {
    const wfPath = path.resolve(process.cwd(), '.github/workflows/deploy-pages.yml');
    expect(fs.existsSync(wfPath)).toBe(true);
    const content = fs.readFileSync(wfPath, 'utf-8');
    expect(content).toContain('VITE_BASE_PATH');
    expect(content).toContain('actions/deploy-pages@v4');
  });
});
