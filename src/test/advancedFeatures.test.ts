import { describe, expect, it } from 'vitest';
import { computeDroneFrequencies } from '../audio/drone';
import { GROOVE_BY_ID, IRANIAN_GROOVES } from '../audio/percussion';
import { midiNoteToFrequency, parseRawMidiMessage } from '../audio/webMidi';
import {
  buildAssignmentShareUrl,
  decodeAssignmentInput,
  encodeAssignmentCode,
} from '../core/assignments';
import {
  buildJalaliPracticeHeatmap,
  computeStreakWithFreeze,
  evaluateWeeklyChallenges,
} from '../core/challenges';
import {
  evaluateDictationAttempt,
  generateDastgahExercise,
  generateDictationExercise,
  generateIntervalExercise,
  PERSIAN_INTERVAL_SPECS,
} from '../core/earTraining';
import {
  buildRecordingTimeline,
  compareRecordings,
} from '../core/recordingComparison';
import {
  TRANSPOSITION_PRESETS,
  transposeGusheh,
  transposeNoteBySemitones,
} from '../core/transposition';
import { createWaitModeState, evaluateWaitModeStep } from '../core/waitMode';
import { noteToFrequency } from '../data/musicTheory';
import { getPoetryForGusheh } from '../data/persianPoetry';
import { ALL_GUSHEHS, RADIF_SYSTEMS } from '../data/radifData';
import {
  getGushehTraditionComparison,
  RADIF_TRADITIONS,
} from '../data/radifTraditions';
import { createEmptyUserState } from '../services/sessionStore';
import type { SavedRecordingMeta, TeacherAssignment } from '../types/music';
import {
  buildPrintableSheetHtml,
  encodeMonoPcmToWav,
  generateGushehMusicXml,
  generateMicrotonalMidiBytes,
  synthesizeGushehToWav,
} from '../utils/exporters';
import { gregorianToJalali } from '../utils/jalali';

describe('Advanced Studio Features (All 13 Capabilities)', () => {
  it('1. Drone / Shahi Companion computes warm register frequencies tuned to base, 5th & shahed', () => {
    const shur = ALL_GUSHEHS[0];
    const baseAndFifth = computeDroneFrequencies({
      baseNote: shur.ist,
      shahedNote: shur.shahed,
      voicing: 'base_fifth',
      timbre: 'tanbur',
      volume: 0.6,
      a4Hz: 440,
      koronMode: 'standard_50',
    });
    expect(baseAndFifth).toHaveLength(3);
    // Pure Just 3:2 fifth ratio
    expect(baseAndFifth[1] / baseAndFifth[0]).toBeCloseTo(1.5, 4);
    expect(baseAndFifth[2] / baseAndFifth[0]).toBeCloseTo(2.0, 4);
    expect(baseAndFifth[0]).toBeGreaterThanOrEqual(75);
    expect(baseAndFifth[0]).toBeLessThanOrEqual(230);
  });

  it('3. Microtonal Ear Training Lab generates interval, dastgah & dictation exercises deterministically', () => {
    expect(PERSIAN_INTERVAL_SPECS.length).toBeGreaterThanOrEqual(6);
    const exInt = generateIntervalExercise(1);
    expect(exInt.options.some((o) => o.id === exInt.correctOptionId)).toBe(true);

    const exFree = generateDastgahExercise(2, false);
    expect(exFree.options.length).toBeGreaterThanOrEqual(3);

    const dict = generateDictationExercise(0);
    const perfect = evaluateDictationAttempt(dict.notes, dict.notes);
    expect(perfect.isExact).toBe(true);
    expect(perfect.scorePercent).toBe(100);
  });

  it('4. Wait Mode holds on wrong pitch and advances automatically once target note is held within tolerance', () => {
    const gusheh = ALL_GUSHEHS[0];
    const targetHz = noteToFrequency(gusheh.melody[0], 440, 'standard_50');

    const state = {
      ...createWaitModeState(0, 1, 20, 200),
      enabled: true,
    };

    // Way off pitch (+150 cents) -> must NOT advance
    const offRes = evaluateWaitModeStep(state, gusheh.melody, targetHz * 1.09, 1000);
    expect(offRes.advanced).toBe(false);
    expect(offRes.nextState.holdStartedAtMs).toBeNull();

    // Right pitch at t=1100 -> begins holding
    const startHold = evaluateWaitModeStep(offRes.nextState, gusheh.melody, targetHz, 1100);
    expect(startHold.advanced).toBe(false);
    expect(startHold.nextState.holdStartedAtMs).toBe(1100);

    // Still holding at t=1320 (>200ms) -> advances to note index 1!
    const doneHold = evaluateWaitModeStep(startHold.nextState, gusheh.melody, targetHz, 1320);
    expect(doneHold.advanced).toBe(true);
    expect(doneHold.nextState.currentIndex).toBe(1);
    expect(doneHold.nextState.completedSteps).toBe(1);
  });

  it('5. Radif Repertoire Traditions cover all 4 masters with side-by-side comparison', () => {
    expect(RADIF_TRADITIONS.map((t) => t.id)).toEqual([
      'mirza_abdollah',
      'mahmoud_karimi',
      'saba',
      'davami',
    ]);
    const comp = getGushehTraditionComparison(ALL_GUSHEHS[0]);
    expect(comp).toHaveLength(4);
    expect(comp.every((c) => c.phrasingFa.length > 20)).toBe(true);
  });

  it('6. Poetry & Aruz prosody alignment covers every single Dastgah & Avaz with marked syllables', () => {
    for (const sys of RADIF_SYSTEMS) {
      const poetry = getPoetryForGusheh(sys.gushehs[0]);
      expect(poetry.poetFa.length).toBeGreaterThan(2);
      expect(poetry.aruzPatternFa.length).toBeGreaterThan(5);
      expect(poetry.syllables.length).toBeGreaterThanOrEqual(8);
      expect(poetry.syllables.some((s) => s.tahrir)).toBe(true);
    }
  });

  it('7. Tombak & Daf percussion engine includes 8 authentic Iranian rhythmic grooves', () => {
    expect(IRANIAN_GROOVES).toHaveLength(8);
    expect(GROOVE_BY_ID.chaharmezrab_6_8.steps).toContain('tom');
    expect(GROOVE_BY_ID.lang_5_8.steps).toHaveLength(5);
    expect(GROOVE_BY_ID.lang_7_8.steps).toHaveLength(7);
  });

  it('8. Smart Tuning & Vocal Transposition preserves Koron microtones accurately across semitone shifts', () => {
    expect(TRANSPOSITION_PRESETS.some((p) => p.id === 'chap_kuk' && p.semitones === 5)).toBe(true);
    const aKoron = { letter: 'A' as const, accidental: 'koron' as const, octave: 4 };
    const shiftedUp5 = transposeNoteBySemitones(aKoron, 5);
    const origHz = noteToFrequency(aKoron, 440, 'standard_50');
    const shiftedHz = noteToFrequency(shiftedUp5, 440, 'standard_50');
    // +5 semitones exact ratio = 2^(5/12)
    expect(shiftedHz / origHz).toBeCloseTo(Math.pow(2, 5 / 12), 2);

    const transposedGusheh = transposeGusheh(ALL_GUSHEHS[0], -5);
    expect(transposedGusheh.melody).toHaveLength(ALL_GUSHEHS[0].melody.length);
  });

  it('9. Before/After Recording Comparison computes accuracy improvement and cent-error reduction', () => {
    const baseRec: SavedRecordingMeta = {
      id: 'rec_old',
      ownerUid: 'u1',
      ownerName: 'مهدی',
      gushehId: 'shur-daramad-1',
      dastgahId: 'shur',
      instrument: 'tar',
      title: 'ضبط اول',
      durationSeconds: 32,
      avgAccuracy: 72,
      rmsDb: -18,
      envelope: [0.2, 0.9, 0.3, 0.8, 0.25],
      isPublic: false,
      hasLocalAudio: true,
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_000_000,
    };
    const newerRec: SavedRecordingMeta = {
      ...baseRec,
      id: 'rec_new',
      title: 'ضبط جدید',
      avgAccuracy: 90,
      rmsDb: -14,
      envelope: [0.6, 0.65, 0.62, 0.64, 0.61],
      createdAt: 1_702_000_000_000,
      updatedAt: 1_702_000_000_000,
    };

    const cmp = compareRecordings(newerRec, baseRec);
    expect(cmp.earlier.id).toBe('rec_old');
    expect(cmp.later.id).toBe('rec_new');
    expect(cmp.accuracyDelta).toBe(18);
    expect(cmp.centsErrorReduction).toBeGreaterThan(0);
    expect(cmp.stabilityDelta).toBeGreaterThan(0);

    const timeline = buildRecordingTimeline([newerRec, baseRec]);
    expect(timeline[0].id).toBe('rec_old');
    expect(timeline[1].id).toBe('rec_new');
  });

  it('10. Exporters produce valid MusicXML, Microtonal MIDI (MThd/MTrk), RIFF WAVE PCM & Printable Sheet', () => {
    const shur = ALL_GUSHEHS[0];
    const xml = generateGushehMusicXml(shur, 'standard_50');
    expect(xml).toContain('<score-partwise version="4.0">');
    expect(xml).toContain('quarter-flat');

    const midi = generateMicrotonalMidiBytes(shur, 84, 'standard_50');
    expect(String.fromCharCode(midi[0], midi[1], midi[2], midi[3])).toBe('MThd');
    expect(midi.length).toBeGreaterThan(40);

    const wav = encodeMonoPcmToWav(new Float32Array([0, 0.5, -0.5, 0]), 22050);
    expect(String.fromCharCode(wav[0], wav[1], wav[2], wav[3])).toBe('RIFF');
    expect(String.fromCharCode(wav[8], wav[9], wav[10], wav[11])).toBe('WAVE');

    const renderedWav = synthesizeGushehToWav(shur, 'tar', 120, 440, 'standard_50', 8000);
    expect(renderedWav.byteLength).toBeGreaterThan(2000);

    const sheet = buildPrintableSheetHtml(shur, 'traditional_56');
    expect(sheet).toContain('dir="rtl"');
    expect(sheet).toContain(shur.nameFa);
  });

  it('11. Teacher Assignment offline codec round-trips Persian text & URL hash without a backend', () => {
    const asg: TeacherAssignment = {
      version: 1,
      id: 'asg_test1',
      titleFa: 'تکلیف تثبیت کُرُن شور',
      teacherName: 'استاد کیهان',
      gushehId: ALL_GUSHEHS[0].id,
      traditionId: 'mahmoud_karimi',
      instrument: 'setar',
      speedPercent: 75,
      loopStart: 0,
      loopEnd: 4,
      transposeSemitones: -5,
      koronMode: 'traditional_56',
      targetAccuracyPercent: 88,
      requireWaitMode: true,
      notesFa: 'با واخوان روشن تمرین شود',
      createdAt: 1_750_000_000_000,
    };

    const code = encodeAssignmentCode(asg);
    expect(code.startsWith('NVN1-')).toBe(true);
    const decodedFromCode = decodeAssignmentInput(code);
    expect(decodedFromCode).toEqual(asg);

    const url = buildAssignmentShareUrl(asg, 'https://navanegar.ir/');
    expect(url).toContain('#assignment=NVN1-');
    const decodedFromUrl = decodeAssignmentInput(url);
    expect(decodedFromUrl?.titleFa).toBe(asg.titleFa);
    expect(decodedFromUrl?.transposeSemitones).toBe(-5);
    expect(decodedFromUrl?.requireWaitMode).toBe(true);
  });

  it('12. Jalali calendar conversion, 84-day practice heatmap, Weekly Challenges & Streak Freeze work accurately', () => {
    // Nowruz check: 2025-03-21 == 1404/01/01
    expect(gregorianToJalali(2025, 3, 21)).toEqual({ jy: 1404, jm: 1, jd: 1 });

    const now = new Date('2026-11-24T12:00:00Z').getTime();
    const state = createEmptyUserState('u_jalali');
    state.sessions = [
      {
        id: 's1',
        gushehId: 'shur-daramad-1',
        dastgahId: 'shur',
        instrument: 'tar',
        durationSeconds: 900,
        accuracyPercent: 90,
        foroudScore: 89,
        tahrirDetected: true,
        avgCentsError: 5,
        completedAt: now,
      },
      {
        id: 's2',
        gushehId: 'shur-daramad-1',
        dastgahId: 'shur',
        instrument: 'tar',
        durationSeconds: 600,
        accuracyPercent: 85,
        foroudScore: 86,
        tahrirDetected: false,
        avgCentsError: 7,
        completedAt: now - 2 * 86_400_000, // 2 days ago (yesterday missed -> covered by Streak Freeze!)
      },
    ];

    const heatmap = buildJalaliPracticeHeatmap(state.sessions, [], now, 84);
    expect(heatmap).toHaveLength(84);
    expect(heatmap[heatmap.length - 1].minutes).toBe(15);

    const streakWithShield = computeStreakWithFreeze(state.sessions, [], 2, now);
    expect(streakWithShield.streakDays).toBe(3); // Today + Frozen Yesterday + 2 Days Ago
    expect(streakWithShield.protectedMissedDays).toBe(1);

    const challenges = evaluateWeeklyChallenges(state, now);
    expect(challenges).toHaveLength(4);
    expect(challenges.find((c) => c.id === 'wk_foroud_mastery')?.completed).toBe(true);
  });

  it('13. Web MIDI parser decodes Note On/Off and microtonal Pitch Bend (-50¢ Koron) accurately', () => {
    // A4 (MIDI 69) with -50 cents pitch bend => 440 * 2^(-50/1200)
    const aKoronFreq = midiNoteToFrequency(69, -50, 440);
    expect(aKoronFreq).toBeCloseTo(440 * Math.pow(2, -50 / 1200), 3);

    // Pitch bend -50¢ on ±200¢ range => 8192 - 2048 = 6144 => MSB=48, LSB=0
    const pbParsed = parseRawMidiMessage(new Uint8Array([0xe0, 0x00, 48]), 0, 440, 'standard_50');
    expect(pbParsed.kind).toBe('pitch_bend');
    if (pbParsed.kind === 'pitch_bend') {
      expect(pbParsed.pitchBendCents).toBeCloseTo(-50, 1);
      const noteParsed = parseRawMidiMessage(
        new Uint8Array([0x90, 69, 100]),
        pbParsed.pitchBendCents,
        440,
        'standard_50'
      );
      expect(noteParsed.kind).toBe('note');
      if (noteParsed.kind === 'note') {
        expect(noteParsed.event.note.letter).toBe('A');
        expect(noteParsed.event.note.accidental).toBe('koron');
      }
    }
  });
});
