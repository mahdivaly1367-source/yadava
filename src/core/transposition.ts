import {
  getAccidentalCents,
  NOTE_SEMITONES,
  noteToCentsFromC0,
  PERSIAN_OCTAVE_PITCH_CLASSES,
} from '../data/musicTheory';
import type {
  Gusheh,
  KoronMode,
  MelodyNote,
  PersianNoteSpec,
  VocalRangePresetId,
} from '../types/music';

export interface TranspositionPreset {
  id: VocalRangePresetId;
  category: 'tuning' | 'vocal';
  labelFa: string;
  subtitleFa: string;
  semitones: number;
}

export const TRANSPOSITION_PRESETS: TranspositionPreset[] = [
  {
    id: 'rast_kuk',
    category: 'tuning',
    labelFa: 'راست‌کوک (استاندارد)',
    subtitleFa: 'کوک مرجع ردیف (۰ نیم‌پرده)',
    semitones: 0,
  },
  {
    id: 'chap_kuk',
    category: 'tuning',
    labelFa: 'چپ‌کوک (فا / +۵)',
    subtitleFa: 'انتقال چهارم درست به بالا برای ساز و آواز چپ‌کوک',
    semitones: 5,
  },
  {
    id: 'shur_sol',
    category: 'tuning',
    labelFa: 'کوک شور سُل',
    subtitleFa: 'پایه سُل (کوک رایج تار و سنتور)',
    semitones: 0,
  },
  {
    id: 'shur_re',
    category: 'tuning',
    labelFa: 'کوک شور رِ (-۵)',
    subtitleFa: 'انتقال به رِ (رایج در ویولن، کمانچه و آواز بم)',
    semitones: -5,
  },
  {
    id: 'shur_la',
    category: 'tuning',
    labelFa: 'کوک شور لا (+۲)',
    subtitleFa: 'انتقال یک پرده بالاتر (شور لا / سه‌تار)',
    semitones: 2,
  },
  {
    id: 'soprano',
    category: 'vocal',
    labelFa: 'بازه سوپرانو (+۵)',
    subtitleFa: 'مناسب صدای زیر بانوان (چپ‌کوک)',
    semitones: 5,
  },
  {
    id: 'alto',
    category: 'vocal',
    labelFa: 'بازه آلتو (+۲)',
    subtitleFa: 'مناسب صدای میانی بانوان',
    semitones: 2,
  },
  {
    id: 'tenor',
    category: 'vocal',
    labelFa: 'بازه تنور (۰)',
    subtitleFa: 'مناسب صدای اوج آقایان (راست‌کوک)',
    semitones: 0,
  },
  {
    id: 'baritone',
    category: 'vocal',
    labelFa: 'بازه باریتون (-۴)',
    subtitleFa: 'مناسب صدای گرم و بم آقایان',
    semitones: -4,
  },
];

/**
 * Transposes a Persian microtonal note by an integer number of semitones (-12..+12)
 * while preserving exact Koron (-50¢/-56¢) and Sori (+50¢) microtonal identity!
 */
export function transposeNoteBySemitones(
  note: PersianNoteSpec,
  semitones: number,
  koronMode: KoronMode = 'standard_50'
): PersianNoteSpec {
  const safeSemi = Math.max(-12, Math.min(12, Math.round(semitones)));
  if (safeSemi === 0) return { ...note };

  // Compute exact target cents from C0 using standard 50¢ step grid so Koron stays Koron/Sori cleanly
  const targetCents = noteToCentsFromC0(note, 'standard_50') + safeSemi * 100;
  const approxOctave = Math.floor(targetCents / 1200);

  let best: PersianNoteSpec = { ...note };
  let bestErr = Infinity;

  const preferMicrotonal = note.accidental === 'koron' || note.accidental === 'sori';

  for (let oct = Math.max(1, approxOctave - 1); oct <= Math.min(7, approxOctave + 1); oct++) {
    for (const pc of PERSIAN_OCTAVE_PITCH_CLASSES) {
      const cand: PersianNoteSpec = { ...pc, octave: oct };
      const candCents =
        cand.octave * 1200 +
        NOTE_SEMITONES[cand.letter] * 100 +
        getAccidentalCents(cand.accidental, 'standard_50');
      const err = Math.abs(candCents - targetCents);

      // Prefer koron spelling over sori when transposing a koron note (matches Iranian music notation practice)
      let tiePenalty = 0;
      if (preferMicrotonal && note.accidental === 'koron' && cand.accidental === 'sori') {
        tiePenalty = 1;
      } else if (preferMicrotonal && note.accidental === 'sori' && cand.accidental === 'koron') {
        tiePenalty = 1;
      }

      if (err + tiePenalty < bestErr) {
        bestErr = err + tiePenalty;
        best = cand;
      }
    }
  }

  void koronMode;
  return best;
}

export function transposeMelodyNote(
  note: MelodyNote,
  semitones: number,
  koronMode: KoronMode = 'standard_50'
): MelodyNote {
  if (semitones === 0) return { ...note };
  const shifted = transposeNoteBySemitones(note, semitones, koronMode);
  return {
    ...note,
    letter: shifted.letter,
    accidental: shifted.accidental,
    octave: shifted.octave,
  };
}

/**
 * Produces a fully transposed copy of a Gusheh (shahed, ist, aghaz, moteghayer, scale, melody)
 * so notation, Karplus-Strong synthesis, drone, pitch contour, wait mode, and bridge canvas all stay 100% synced!
 */
export function transposeGusheh(
  gusheh: Gusheh,
  semitones: number,
  koronMode: KoronMode = 'standard_50'
): Gusheh {
  const safeSemi = Math.max(-12, Math.min(12, Math.round(semitones)));
  if (safeSemi === 0) return gusheh;

  return {
    ...gusheh,
    shahed: transposeNoteBySemitones(gusheh.shahed, safeSemi, koronMode),
    ist: transposeNoteBySemitones(gusheh.ist, safeSemi, koronMode),
    aghaz: transposeNoteBySemitones(gusheh.aghaz, safeSemi, koronMode),
    moteghayer: gusheh.moteghayer
      ? transposeNoteBySemitones(gusheh.moteghayer, safeSemi, koronMode)
      : undefined,
    scale: gusheh.scale.map((n) => transposeNoteBySemitones(n, safeSemi, koronMode)),
    melody: gusheh.melody.map((m) => transposeMelodyNote(m, safeSemi, koronMode)),
  };
}

export function formatSemitoneShiftFa(semitones: number): string {
  if (semitones === 0) return 'بدون انتقال (راست‌کوک)';
  const sign = semitones > 0 ? '+' : '';
  return `${sign}${semitones} نیم‌پرده`;
}
