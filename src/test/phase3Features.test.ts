import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { expandNoteWithOrnaments } from '../audio/ornamentEngine';
import {
  computeDetunedStringHz,
  createBlindTuningChallenge,
  evaluateBlindTuning,
} from '../core/blindTuning';
import {
  evaluateImprovisedResponse,
  generateModalCallPhrase,
} from '../core/callResponse';
import {
  buildMelodyFingeringGuide,
  recommendTarSetarFingering,
} from '../core/fingeringGuide';
import {
  alignPoetryToGusheh,
  syllabifyPersianVerse,
} from '../core/prosodySyllables';
import { createWakeLockController } from '../core/wakeLock';
import { getRecommendedTuning, noteToFrequency } from '../data/musicTheory';
import { ALL_GUSHEHS } from '../data/radifData';
import {
  generateNotesMicrotonalMidiBytes,
  generateNotesMusicXml,
} from '../utils/exporters';

describe('Phase 3 Conservatory Features (Ornaments, 7 Instruments, Fingering, Call & Response, Prosody, Blind Tuning, MusicXML/MIDI, Android Assets)', () => {
  const shurDaramad = ALL_GUSHEHS[0];

  it('expands real Persian ornaments (eshareh, tekieh, dorab, multi-stroke riz, tahrir, kamancheh malesh) inside the modal scale', () => {
    const g4 = noteToFrequency({ letter: 'G', accidental: 'natural', octave: 4 }, 440, 'standard_50');
    const f4 = noteToFrequency({ letter: 'F', accidental: 'natural', octave: 4 }, 440, 'standard_50');

    const eshareh = expandNoteWithOrnaments({
      baseFreqHz: g4,
      durationSec: 0.7,
      instrument: 'tar',
      ornament: 'eshareh',
      scale: shurDaramad.scale,
    });
    expect(eshareh).toHaveLength(2);
    expect(eshareh[0].frequencyHz).toBeGreaterThan(g4);
    expect(eshareh[1].frequencyHz).toBeCloseTo(g4, 3);

    const dorab = expandNoteWithOrnaments({
      baseFreqHz: g4,
      durationSec: 0.8,
      instrument: 'santur',
      ornament: 'dorab',
      scale: shurDaramad.scale,
    });
    expect(dorab).toHaveLength(4);

    const riz = expandNoteWithOrnaments({
      baseFreqHz: g4,
      durationSec: 0.75,
      instrument: 'tar',
      ornament: 'riz',
      scale: shurDaramad.scale,
    });
    expect(riz.length).toBeGreaterThanOrEqual(4);
    expect(riz[1].offsetSec).toBeGreaterThan(riz[0].offsetSec);

    // Kamancheh automatic Malesh glissando when stepping from F4 to G4
    const malesh = expandNoteWithOrnaments({
      baseFreqHz: g4,
      durationSec: 0.7,
      instrument: 'kamancheh',
      prevFreqHz: f4,
      scale: shurDaramad.scale,
    });
    expect(malesh[0].slideFromHz).toBeCloseTo(f4, 2);
  });

  it('provides authentic tunings for Kamancheh, Oud (Barbat), and Tanbur', () => {
    const kam = getRecommendedTuning('shur', 'kamancheh');
    expect(kam.strings).toHaveLength(4);
    expect(kam.titleFa).toContain('کمانچه');

    const oud = getRecommendedTuning('homayun', 'oud');
    expect(oud.strings).toHaveLength(5);
    expect(oud.titleFa).toContain('عود');

    const tanbur = getRecommendedTuning('mahur', 'tanbur');
    expect(tanbur.strings).toHaveLength(3);
    expect(tanbur.titleFa).toContain('تنبور');
  });

  it('recommends ergonomic Tar/Setar string courses and finger numbers across a Gusheh', () => {
    const openC4 = recommendTarSetarFingering({ letter: 'C', accidental: 'natural', octave: 4 });
    expect(openC4.courseId).toBe('sefid');
    expect(openC4.fretIndex).toBe(0);
    expect(openC4.fingerCode).toBe('۰');

    const aKoron4 = recommendTarSetarFingering({ letter: 'A', accidental: 'koron', octave: 4 });
    expect(aKoron4.fretIndex).toBeGreaterThan(0);
    expect(['۱', '۲', '۳', 'ش']).toContain(aKoron4.fingerCode);

    const guide = buildMelodyFingeringGuide(shurDaramad.melody);
    expect(guide).toHaveLength(shurDaramad.melody.length);
  });

  it('generates modal Call phrases and grades improvised Responses accurately', () => {
    const call = generateModalCallPhrase(shurDaramad, 0);
    expect(call.notes.length).toBeGreaterThanOrEqual(3);

    // Build an authentic in-scale Shur response emphasizing Shahed and landing on Ist
    const goodFreqs = [
      shurDaramad.scale[1],
      shurDaramad.scale[2],
      shurDaramad.shahed,
      shurDaramad.shahed,
      shurDaramad.scale[3],
      shurDaramad.scale[2],
      shurDaramad.ist,
      shurDaramad.ist,
      shurDaramad.ist,
    ].map((n) => noteToFrequency(n, 440, 'standard_50'));

    const goodEval = evaluateImprovisedResponse(goodFreqs, shurDaramad, 440, 'standard_50');
    expect(goodEval.overallScore).toBeGreaterThanOrEqual(80);
    expect(goodEval.scaleAdherencePercent).toBeGreaterThanOrEqual(90);
    expect(goodEval.foroudCadencePercent).toBeGreaterThanOrEqual(90);

    // Out-of-scale random frequencies ending far from Ist
    const badFreqs = [455, 456, 457, 458, 575, 576, 577, 578];
    const badEval = evaluateImprovisedResponse(badFreqs, shurDaramad, 440, 'standard_50');
    expect(badEval.overallScore).toBeLessThan(goodEval.overallScore);
  });

  it('aligns classical Ghazal & custom Persian verses syllable-by-syllable with breath and Tahrir markers', () => {
    const classicAligned = alignPoetryToGusheh(shurDaramad);
    expect(classicAligned.slots).toHaveLength(shurDaramad.melody.length);
    expect(classicAligned.slots.some((s) => s.isBreathPoint)).toBe(true);

    const customSyls = syllabifyPersianVerse('بیا تا گل برافشانیم و می در ساغر اندازیم');
    expect(customSyls.length).toBeGreaterThanOrEqual(8);

    const customAligned = alignPoetryToGusheh(
      shurDaramad,
      'بیا تا گل برافشانیم و می در ساغر اندازیم'
    );
    expect(customAligned.poetFa).toContain('هنرجو');
    expect(customAligned.slots).toHaveLength(shurDaramad.melody.length);
  });

  it('creates hidden Blind Ear-Tuning challenges and evaluates exact residual cents', () => {
    const challenge = createBlindTuningChallenge({
      instrument: 'tar',
      dastgahId: 'shur',
      a4Hz: 440,
      koronMode: 'standard_50',
      difficulty: 'master',
      roundNumber: 2,
    });
    expect(Math.abs(challenge.initialDetuneCents)).toBeGreaterThanOrEqual(8);

    // Exact compensation => 0.0¢ residual => passed with master rank!
    const exactOffset = -challenge.initialDetuneCents;
    const tunedHz = computeDetunedStringHz(challenge, exactOffset);
    expect(tunedHz).toBeCloseTo(challenge.targetHz, 4);

    const perfectOutcome = evaluateBlindTuning(challenge, exactOffset);
    expect(perfectOutcome.passed).toBe(true);
    expect(perfectOutcome.absErrorCents).toBe(0);

    const unadjustedOutcome = evaluateBlindTuning(challenge, 0);
    expect(unadjustedOutcome.passed).toBe(false);
  });

  it('exports arbitrary transcribed microtonal notes to valid MusicXML 4.0 and binary MIDI', () => {
    const notes = [
      { letter: 'G' as const, accidental: 'natural' as const, octave: 4, durationBeats: 1 },
      { letter: 'A' as const, accidental: 'koron' as const, octave: 4, durationBeats: 1.5 },
      { letter: 'B' as const, accidental: 'flat' as const, octave: 4, durationBeats: 1 },
    ];
    const xml = generateNotesMusicXml('تست نت‌نگاری', notes, 'standard_50');
    expect(xml).toContain('<score-partwise');
    expect(xml).toContain('<alter>-0.5</alter>');
    expect(xml).toContain('<accidental>quarter-flat</accidental>');

    const midi = generateNotesMicrotonalMidiBytes(notes, 96, 'standard_50');
    // Standard MIDI header "MThd"
    expect(midi[0]).toBe(0x4d);
    expect(midi[1]).toBe(0x54);
    expect(midi[2]).toBe(0x68);
    expect(midi[3]).toBe(0x64);
    expect(midi.length).toBeGreaterThan(32);
  });

  it('initializes Screen Wake Lock controller gracefully even in headless test environments', async () => {
    const ctrl = createWakeLockController();
    expect(typeof ctrl.acquire).toBe('function');
    await expect(ctrl.release()).resolves.toBeUndefined();
  });

  it('includes valid custom Navanegar Iranian PNG Adaptive Icons and Splash Screens across all Android buckets', () => {
    const resDir = path.resolve(process.cwd(), 'android/app/src/main/res');
    const requiredPngs = [
      'mipmap-mdpi/ic_launcher.png',
      'mipmap-hdpi/ic_launcher.png',
      'mipmap-xhdpi/ic_launcher.png',
      'mipmap-xxhdpi/ic_launcher.png',
      'mipmap-xxxhdpi/ic_launcher.png',
      'mipmap-xxxhdpi/ic_launcher_round.png',
      'mipmap-xxxhdpi/ic_launcher_foreground.png',
      'drawable/splash.png',
      'drawable-port-xxhdpi/splash.png',
      'drawable-land-xxhdpi/splash.png',
    ];
    for (const rel of requiredPngs) {
      const full = path.join(resDir, rel);
      expect(fs.existsSync(full)).toBe(true);
      const buf = fs.readFileSync(full);
      // Verify real PNG magic header 89 50 4E 47
      expect(buf[0]).toBe(0x89);
      expect(buf[1]).toBe(0x50);
      expect(buf[2]).toBe(0x4e);
      expect(buf[3]).toBe(0x47);
      expect(buf.length).toBeGreaterThan(400);
    }
  });
});
