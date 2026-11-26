import type {
  Accidental,
  Gusheh,
  IranianMeter,
  MelodyNote,
  NoteLetter,
  OrnamentType,
} from '../types/music';

export interface CustomPersianScore {
  id: string;
  titleFa: string;
  dastgahId: string;
  meter: IranianMeter;
  bpm: number;
  notes: MelodyNote[];
  updatedAtIso: string;
}

const STORAGE_KEY = 'navanegar_custom_scores_v1';

const LETTERS_ORDERED: NoteLetter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

export const ACCIDENTAL_CYCLE: Accidental[] = ['natural', 'koron', 'flat', 'sori', 'sharp'];

export const DURATION_OPTIONS: Array<{ beats: number; labelFa: string; symbol: string }> = [
  { beats: 0.5, labelFa: 'چنگ (۰.۵)', symbol: '♪' },
  { beats: 1, labelFa: 'سیاه (۱)', symbol: '♩' },
  { beats: 1.5, labelFa: 'سیاه نقطه‌دار (۱.۵)', symbol: '♩.' },
  { beats: 2, labelFa: 'سفید (۲)', symbol: '𝅗𝅥' },
  { beats: 3, labelFa: 'سفید نقطه‌دار (۳)', symbol: '𝅗𝅥.' },
];

export const ORNAMENT_OPTIONS: Array<{ id: OrnamentType | 'none'; labelFa: string }> = [
  { id: 'none', labelFa: 'ساده' },
  { id: 'eshareh', labelFa: 'اشاره' },
  { id: 'tekieh', labelFa: 'تکیه' },
  { id: 'dorab', labelFa: 'دراب' },
  { id: 'riz', labelFa: 'ریز' },
  { id: 'tahrir', labelFa: 'تحریر' },
];

/**
 * Steps a Persian note diatonically up (+1) or down (-1) within C3..C6.
 */
export function stepNoteDiatonic(note: MelodyNote, delta: 1 | -1): MelodyNote {
  const idx = LETTERS_ORDERED.indexOf(note.letter);
  let nextIdx = idx + delta;
  let octave = note.octave;
  if (nextIdx >= LETTERS_ORDERED.length) {
    nextIdx = 0;
    octave = Math.min(6, octave + 1);
  } else if (nextIdx < 0) {
    nextIdx = LETTERS_ORDERED.length - 1;
    octave = Math.max(3, octave - 1);
  }
  return {
    ...note,
    letter: LETTERS_ORDERED[nextIdx],
    octave,
  };
}

/**
 * Creates a fresh editable score seeded from an existing Gusheh.
 */
export function createScoreFromGusheh(gusheh: Gusheh): CustomPersianScore {
  return {
    id: `score-${Date.now()}`,
    titleFa: `بازنویسی ${gusheh.nameFa}`,
    dastgahId: gusheh.dastgahId,
    meter: gusheh.practiceLoop.meter,
    bpm: gusheh.practiceLoop.defaultBpm,
    notes: gusheh.melody.map((n) => ({ ...n })),
    updatedAtIso: new Date().toISOString(),
  };
}

/**
 * Converts a user-authored CustomPersianScore into a full Gusheh object
 * compatible with PersianStaffNotation, Audio Playback, MusicXML, MIDI, WAV & Printable Sheet.
 */
export function customScoreToGusheh(score: CustomPersianScore): Gusheh {
  const safeNotes: MelodyNote[] =
    score.notes.length > 0
      ? score.notes
      : [{ letter: 'G', accidental: 'natural', octave: 4, durationBeats: 1 }];

  // Deduplicate unique pitch classes for modal scale display
  const seen = new Set<string>();
  const scale = safeNotes.filter((n) => {
    const key = `${n.letter}_${n.accidental}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const ornaments = Array.from(
    new Set(safeNotes.map((n) => n.ornament).filter((o): o is OrnamentType => Boolean(o)))
  );

  return {
    id: score.id,
    dastgahId: score.dastgahId,
    order: 99,
    nameFa: score.titleFa.trim() || 'قطعه ساخته‌شده کاربر',
    nameEn: 'User Microtonal Composition',
    role: 'miani',
    difficulty: 1,
    shahed: safeNotes[Math.min(2, safeNotes.length - 1)],
    ist: safeNotes[safeNotes.length - 1],
    aghaz: safeNotes[0],
    scale: scale.length > 0 ? scale : safeNotes.slice(0, 7),
    ornaments,
    melody: safeNotes,
    practiceLoop: {
      startIndex: 0,
      endIndex: Math.max(0, safeNotes.length - 1),
      defaultBpm: score.bpm,
      meter: score.meter,
    },
    modulations: [],
    descriptionFa: 'قطعه یا تمرین ربع‌پرده ساخته‌شده در ویرایشگر نت نوانگار',
  };
}

export function loadSavedCustomScores(): CustomPersianScore[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function persistCustomScore(score: CustomPersianScore): CustomPersianScore[] {
  const existing = loadSavedCustomScores().filter((s) => s.id !== score.id);
  const updated = [{ ...score, updatedAtIso: new Date().toISOString() }, ...existing].slice(0, 20);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore storage quota errors
    }
  }
  return updated;
}

export function deleteSavedCustomScore(scoreId: string): CustomPersianScore[] {
  const updated = loadSavedCustomScores().filter((s) => s.id !== scoreId);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  }
  return updated;
}
