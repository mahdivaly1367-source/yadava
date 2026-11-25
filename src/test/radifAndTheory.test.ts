import { describe, expect, it } from 'vitest';
import {
  fretCentsToLinearRatio,
  frequencyToPersianNote,
  getRecommendedTuning,
  getSantur27Bridges,
  getTar24FretCents,
  noteToFrequency,
} from '../data/musicTheory';
import {
  ALL_GUSHEHS,
  FREE_DASTGAH_IDS,
  FREE_GUSHEHS,
  isDastgahUnlocked,
  RADIF_SYSTEMS,
} from '../data/radifData';

describe('Radif Data Coverage & Freemium Partition', () => {
  it('contains exactly 12 Iranian modal systems (7 Dastgahs + 5 Avazes)', () => {
    expect(RADIF_SYSTEMS).toHaveLength(12);
    const dastgahs = RADIF_SYSTEMS.filter((s) => s.category === 'dastgah');
    const avazes = RADIF_SYSTEMS.filter((s) => s.category === 'avaz');
    expect(dastgahs).toHaveLength(7);
    expect(avazes).toHaveLength(5);
  });

  it('contains exactly 173 unique Gushehs across all 12 systems', () => {
    expect(ALL_GUSHEHS).toHaveLength(173);
    const uniqueIds = new Set(ALL_GUSHEHS.map((g) => g.id));
    expect(uniqueIds.size).toBe(173);

    for (const g of ALL_GUSHEHS) {
      expect(g.melody.length).toBeGreaterThanOrEqual(5);
      expect(g.scale.length).toBeGreaterThanOrEqual(7);
      expect(g.practiceLoop.endIndex).toBeGreaterThan(g.practiceLoop.startIndex);
    }
  });

  it('grants free forever access strictly to Shur, Abu-Ata, and Mahur totaling exactly 43 Gushehs', () => {
    const freeSystems = RADIF_SYSTEMS.filter((s) => s.isFree);
    expect(freeSystems.map((s) => s.id)).toEqual([...FREE_DASTGAH_IDS]);
    expect(FREE_GUSHEHS).toHaveLength(43);

    expect(isDastgahUnlocked('shur', false)).toBe(true);
    expect(isDastgahUnlocked('abuata', false)).toBe(true);
    expect(isDastgahUnlocked('mahur', false)).toBe(true);
    expect(isDastgahUnlocked('homayun', false)).toBe(false);
    expect(isDastgahUnlocked('chahargah', false)).toBe(false);
    expect(isDastgahUnlocked('homayun', true)).toBe(true);
    expect(isDastgahUnlocked('rast_panjgah', true)).toBe(true);
  });
});

describe('Microtonal Persian Music Theory (Koron -50¢ / -56¢ & Sori +50¢)', () => {
  it('computes exact frequencies for A4, Koron standard (-50¢), Koron traditional (-56¢), and Sori (+50¢)', () => {
    const a4 = noteToFrequency({ letter: 'A', accidental: 'natural', octave: 4 }, 440, 'standard_50');
    expect(a4).toBeCloseTo(440.0, 5);

    const aKoron50 = noteToFrequency({ letter: 'A', accidental: 'koron', octave: 4 }, 440, 'standard_50');
    expect(aKoron50).toBeCloseTo(440 * Math.pow(2, -50 / 1200), 4);

    const aKoron56 = noteToFrequency({ letter: 'A', accidental: 'koron', octave: 4 }, 440, 'traditional_56');
    expect(aKoron56).toBeCloseTo(440 * Math.pow(2, -56 / 1200), 4);
    expect(aKoron56).toBeLessThan(aKoron50);

    const fSori = noteToFrequency({ letter: 'F', accidental: 'sori', octave: 4 }, 440, 'standard_50');
    const fNat = noteToFrequency({ letter: 'F', accidental: 'natural', octave: 4 }, 440, 'standard_50');
    const centsDiff = 1200 * Math.log2(fSori / fNat);
    expect(centsDiff).toBeCloseTo(50, 4);
  });

  it('supports sub-cent A4 calibration and reverse frequency-to-note detection', () => {
    const calibratedA4 = 432.4;
    const freqAk4 = noteToFrequency(
      { letter: 'A', accidental: 'koron', octave: 4 },
      calibratedA4,
      'traditional_56'
    );
    const detected = frequencyToPersianNote(freqAk4, calibratedA4, 'traditional_56');
    expect(detected.note.letter).toBe('A');
    expect(detected.note.accidental).toBe('koron');
    expect(Math.abs(detected.centsOffset)).toBeLessThanOrEqual(0.5);
  });

  it('models 24 logarithmic Tar/Setar frets, 27 Santur bridges, and Dastgah-specific tunings', () => {
    const frets = getTar24FretCents('standard_50');
    expect(frets).toHaveLength(25); // open string (0) + 24 frets
    const r1 = fretCentsToLinearRatio(frets[1]);
    const r12 = fretCentsToLinearRatio(frets[17]); // octave (1200¢)
    const r24 = fretCentsToLinearRatio(frets[24]);
    expect(r1).toBeGreaterThan(0);
    expect(r12).toBeGreaterThan(r1);
    expect(r24).toBeCloseTo(1.0, 5);

    const bridges = getSantur27Bridges('shur');
    expect(bridges).toHaveLength(27);
    expect(bridges.filter((b) => b.register === 'zard')).toHaveLength(9);
    expect(bridges.filter((b) => b.register === 'sefid')).toHaveLength(9);
    expect(bridges.filter((b) => b.register === 'posht')).toHaveLength(9);

    const tarShur = getRecommendedTuning('shur', 'tar');
    expect(tarShur.strings).toHaveLength(4);
    const tarMahur = getRecommendedTuning('mahur', 'tar');
    expect(tarMahur.titleFa).toContain('ماهور');
  });

  it('enforces authentic Iranian modal scales (Nava vs Shur) and exact Santur 27-bridge accidentals per Dastgah', () => {
    const nava = RADIF_SYSTEMS.find((s) => s.id === 'nava');
    expect(nava).toBeDefined();
    const navaScale = nava!.gushehs[0].scale;
    // Authentic Nava of G: A4 must be natural (distinct from Shur's A4 koron) and E5 must be koron
    expect(navaScale.find((s) => s.letter === 'A')?.accidental).toBe('natural');
    expect(navaScale.find((s) => s.letter === 'E')?.accidental).toBe('koron');

    // Homayun Santur bridges: F natural, Eb, A koron, B natural (no out-of-scale F#)
    const homayunBridges = getSantur27Bridges('homayun');
    expect(homayunBridges.find((b) => b.note.letter === 'F')?.note.accidental).toBe('natural');
    expect(homayunBridges.find((b) => b.note.letter === 'E')?.note.accidental).toBe('flat');
    expect(homayunBridges.find((b) => b.note.letter === 'A')?.note.accidental).toBe('koron');
    expect(homayunBridges.find((b) => b.note.letter === 'B')?.note.accidental).toBe('natural');

    // Chahargah Santur bridges: D koron, E natural, A koron, B natural
    const chahargahBridges = getSantur27Bridges('chahargah');
    expect(chahargahBridges.find((b) => b.note.letter === 'D')?.note.accidental).toBe('koron');
    expect(chahargahBridges.find((b) => b.note.letter === 'E')?.note.accidental).toBe('natural');
    expect(chahargahBridges.find((b) => b.note.letter === 'A')?.note.accidental).toBe('koron');
    expect(chahargahBridges.find((b) => b.note.letter === 'B')?.note.accidental).toBe('natural');

    // Nava Santur bridges: E koron, A natural, B flat
    const navaBridges = getSantur27Bridges('nava');
    expect(navaBridges.find((b) => b.note.letter === 'E')?.note.accidental).toBe('koron');
    expect(navaBridges.find((b) => b.note.letter === 'A')?.note.accidental).toBe('natural');
    expect(navaBridges.find((b) => b.note.letter === 'B')?.note.accidental).toBe('flat');
  });
});
