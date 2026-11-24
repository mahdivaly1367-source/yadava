import { describe, expect, it } from 'vitest';
import {
  synthesizeDemoPhraseWavBlob,
  transcribePcmSamplesToPersianNotes,
} from '../audio/audioSlowdowner';
import { analyzePcmSamples } from '../audio/recordingAnalyzer';
import {
  buildFullOfflineBackupJson,
  parseAndSanitizeBackupJson,
} from '../core/backupRestore';
import { BreathLongToneTracker } from '../core/breathLab';
import {
  FOOT_PEDAL_PRESETS,
  resolveFootPedalAction,
} from '../core/footPedal';
import { evaluateHandsFreeCycle } from '../core/handsFree';
import {
  BUILTIN_TEMPERAMENT_PROFILES,
  compareTemperamentCents,
  loadScopedTemperament,
  noteToCustomTemperamentFrequency,
  saveScopedTemperament,
} from '../core/temperament';
import { AUDIO_GLOSSARY_TERMS } from '../data/audioGlossary';
import { CLASSICAL_PIECES } from '../data/classicalPieces';
import {
  evaluateLearningPathProgress,
  GUIDED_LEARNING_PATHS,
} from '../data/learningPaths';
import { GUSHEH_BY_ID } from '../data/radifData';
import { createEmptyUserState } from '../services/sessionStore';
import type { PersianNoteSpec } from '../types/music';

describe('Phase-2 All 13 Offline Conservatory Features', () => {
  it('1. Offline Audio Slowdowner & Transcriber synthesizes WAV and extracts microtonal Persian notes', () => {
    const shurPhrase: PersianNoteSpec[] = [
      { letter: 'D', accidental: 'natural', octave: 4 },
      { letter: 'E', accidental: 'koron', octave: 4 },
      { letter: 'F', accidental: 'natural', octave: 4 },
      { letter: 'G', accidental: 'natural', octave: 4 },
    ];
    const { blob, samples, sampleRate } = synthesizeDemoPhraseWavBlob(shurPhrase, {
      a4Hz: 440,
      koronMode: 'standard_50',
      noteDurationSec: 0.45,
    });
    expect(blob.size).toBeGreaterThan(1000);
    expect(blob.type).toBe('audio/wav');

    const result = transcribePcmSamplesToPersianNotes(samples, sampleRate, {
      a4Hz: 440,
      koronMode: 'standard_50',
      targetScale: shurPhrase,
    });
    expect(result.durationSeconds).toBeGreaterThan(1.5);
    expect(result.envelope.length).toBe(80);
    expect(result.notes.length).toBeGreaterThanOrEqual(3);
    expect(result.pitchContour.length).toBeGreaterThan(5);
    // Must detect E koron accurately in the transcribed notes
    expect(
      result.notes.some((n) => n.note.letter === 'E' && n.note.accidental === 'koron')
    ).toBe(true);
  });

  it('2. Recording Analyzer generates time-indexed pitchContour for Overlay Replay', () => {
    const sampleRate = 22050;
    const { samples } = synthesizeDemoPhraseWavBlob(
      [
        { letter: 'D', accidental: 'natural', octave: 4 },
        { letter: 'E', accidental: 'koron', octave: 4 },
      ],
      { a4Hz: 440, koronMode: 'standard_50', noteDurationSec: 0.6 }
    );
    const analysis = analyzePcmSamples(
      samples,
      sampleRate,
      [
        { letter: 'D', accidental: 'natural', octave: 4 },
        { letter: 'E', accidental: 'koron', octave: 4 },
      ],
      440,
      'standard_50'
    );
    expect(analysis.pitchContour).toBeDefined();
    expect(analysis.pitchContour!.length).toBeGreaterThan(2);
    expect(analysis.pitchContour![0].freqHz).toBeGreaterThan(200);
    expect(analysis.avgAccuracy).toBeGreaterThanOrEqual(80);
  });

  it('3. Custom Microtonal Temperament Editor computes exact Hz differences & isolates per ownerUid', () => {
    const vaziri = BUILTIN_TEMPERAMENT_PROFILES[0];
    const farhat = BUILTIN_TEMPERAMENT_PROFILES[1];
    const eKoron: PersianNoteSpec = { letter: 'E', accidental: 'koron', octave: 4 };

    const fVaziri = noteToCustomTemperamentFrequency(eKoron, vaziri, 440);
    const fFarhat = noteToCustomTemperamentFrequency(eKoron, farhat, 440);
    const diffCents = compareTemperamentCents(eKoron, vaziri, farhat, 440);

    // Farhat E koron is -56c + (-4c E offset) = -60c vs Vaziri -50c => -10 cents lower!
    expect(fFarhat).toBeLessThan(fVaziri);
    expect(diffCents).toBeCloseTo(-10, 0);

    saveScopedTemperament('user_alpha', farhat);
    saveScopedTemperament('user_beta', vaziri);
    expect(loadScopedTemperament('user_alpha').id).toBe(farhat.id);
    expect(loadScopedTemperament('user_beta').id).toBe(vaziri.id);
  });

  it('4. Breath, Long-Tone & Tahrir Lab measures sustain, dB stability and 5.5–6.8 Hz ideal zone', () => {
    const tracker = new BreathLongToneTracker(0);
    const t0 = 10000;
    tracker.update({ rms: 0.2, tahrirRateHz: 6.1, nowMs: t0 });
    tracker.update({ rms: 0.21, tahrirRateHz: 6.2, nowMs: t0 + 1000 });
    tracker.update({ rms: 0.19, tahrirRateHz: 6.0, nowMs: t0 + 2000 });
    const m = tracker.update({ rms: 0.2, tahrirRateHz: 6.3, nowMs: t0 + 3500 });

    expect(m.isSustaining).toBe(true);
    expect(m.currentSustainSec).toBeCloseTo(3.5, 1);
    expect(m.bestSustainSec).toBeCloseTo(3.5, 1);
    expect(m.dynamicStabilityPercent).toBeGreaterThanOrEqual(85);
    expect(m.tahrirZoneStatus).toBe('ideal');

    const fast = tracker.update({ rms: 0.2, tahrirRateHz: 8.2, nowMs: t0 + 4000 });
    expect(fast.tahrirZoneStatus).toBe('too_fast');
  });

  it('8. Hands-Free Auto-Cycle evaluates accuracy threshold for auto-advance vs repeat', () => {
    const pass = evaluateHandsFreeCycle([84, 88, 91], 82);
    expect(pass.passed).toBe(true);
    expect(pass.action).toBe('advance_next_gusheh');

    const retry = evaluateHandsFreeCycle([65, 70, 74], 82);
    expect(retry.passed).toBe(false);
    expect(retry.action).toBe('repeat_phrase');

    const silent = evaluateHandsFreeCycle([], 82);
    expect(silent.action).toBe('repeat_phrase');
  });

  it('9. Foot Pedal presets map standard AirTurn / PageFlip keys deterministically', () => {
    expect(FOOT_PEDAL_PRESETS.length).toBe(3);
    expect(resolveFootPedalAction('PageDown', 'airturn_page')).toBe('next_gusheh');
    expect(resolveFootPedalAction('PageUp', 'airturn_page')).toBe('prev_gusheh');
    expect(resolveFootPedalAction(' ', 'airturn_page')).toBe('toggle_play');
    expect(resolveFootPedalAction('PageUp', 'play_record')).toBe('toggle_record');
    expect(resolveFootPedalAction('PageDown', 'loop_next')).toBe('repeat_master');
    expect(resolveFootPedalAction('KeyZ', 'airturn_page')).toBeNull();
  });

  it('10. Guided 30-Day Learning Paths reference valid gushehs and track session & manual completions', () => {
    expect(GUIDED_LEARNING_PATHS.length).toBe(3);
    for (const path of GUIDED_LEARNING_PATHS) {
      expect(path.steps.length).toBe(6);
      for (const step of path.steps) {
        expect(GUSHEH_BY_ID[step.gushehId]).toBeDefined();
      }
    }

    const state = createEmptyUserState('student_path');
    state.sessions.push({
      id: 's1',
      gushehId: 'shur_daramad_1',
      dastgahId: 'shur',
      instrument: 'tar',
      durationSeconds: 120,
      accuracyPercent: 85,
      foroudScore: 88,
      tahrirDetected: false,
      avgCentsError: 8,
      completedAt: Date.now(),
    });
    state.completedPathStepIds = ['shur_step_2'];

    const prog = evaluateLearningPathProgress(GUIDED_LEARNING_PATHS[0], state);
    expect(prog.completedCount).toBe(2);
    expect(prog.percent).toBe(33);
    expect(prog.nextStep?.id).toBe('shur_step_3');
  });

  it('11 & 12. Classical Rhythmic Pieces (8 pieces) and Audio Glossary (16 terms) contain valid demo notes', () => {
    expect(CLASSICAL_PIECES.length).toBe(8);
    expect(CLASSICAL_PIECES.filter((p) => !p.isPro).length).toBe(4);
    expect(CLASSICAL_PIECES.filter((p) => p.isPro).length).toBe(4);
    for (const piece of CLASSICAL_PIECES) {
      expect(piece.notes.length).toBeGreaterThanOrEqual(8);
    }

    expect(AUDIO_GLOSSARY_TERMS.length).toBe(16);
    for (const term of AUDIO_GLOSSARY_TERMS) {
      expect(term.demoNotes.length).toBeGreaterThanOrEqual(4);
      expect(term.demoBpm).toBeGreaterThanOrEqual(60);
    }
  });

  it('13. Full Offline Backup JSON export & import enforces strict target ownerUid isolation', () => {
    const sourceState = createEmptyUserState('user_old_owner', 'علی');
    sourceState.totalPracticeMinutes = 95;
    sourceState.completedPathStepIds = ['shur_step_1'];
    sourceState.recordings.push({
      id: 'rec_1',
      ownerUid: 'user_old_owner',
      ownerName: 'علی',
      gushehId: 'daramad_1',
      dastgahId: 'shur',
      instrument: 'tar',
      title: 'تمرین شور',
      durationSeconds: 12,
      avgAccuracy: 88,
      rmsDb: -16,
      envelope: [0.3, 0.7],
      isPublic: false,
      hasLocalAudio: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const json = buildFullOfflineBackupJson(sourceState);
    expect(json).toContain('navanegar.backup.v2');

    // Import into a DIFFERENT active ownerUid -> must rewrite ownerUid safely!
    const imported = parseAndSanitizeBackupJson(json, 'user_new_device');
    expect(imported.ok).toBe(true);
    if (imported.ok) {
      expect(imported.userState.ownerUid).toBe('user_new_device');
      expect(imported.userState.totalPracticeMinutes).toBe(95);
      expect(imported.userState.recordings[0].ownerUid).toBe('user_new_device');
      expect(imported.userState.recordings[0].hasLocalAudio).toBe(false);
    }

    const bad = parseAndSanitizeBackupJson('{"schema":"invalid"}', 'user_new_device');
    expect(bad.ok).toBe(false);
  });
});
