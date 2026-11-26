import {
  formatNoteFa,
  getTar24FretCents,
  noteToFrequency,
} from '../data/musicTheory';
import type { KoronMode, PersianNoteSpec } from '../types/music';

export type TarStringCourseId = 'sefid' | 'zard' | 'bam';

export interface TarFingeringSuggestion {
  note: PersianNoteSpec;
  noteLabelFa: string;
  courseId: TarStringCourseId;
  courseLabelFa: string;
  fretIndex: number; // 0 = open string (دست‌باز), 1..24 = pardeh
  fretCents: number;
  fingerCode: '۰' | '۱' | '۲' | '۳' | 'ش';
  fingerLabelFa: string;
  positionFa: string;
}

interface OpenCourseSpec {
  id: TarStringCourseId;
  labelFa: string;
  openNote: PersianNoteSpec;
  preferredMaxCents: number;
}

const TAR_SETAR_COURSES: OpenCourseSpec[] = [
  {
    id: 'sefid',
    labelFa: 'سیم سفید (اول)',
    openNote: { letter: 'C', accidental: 'natural', octave: 4 },
    preferredMaxCents: 1650,
  },
  {
    id: 'zard',
    labelFa: 'سیم زرد (دوم)',
    openNote: { letter: 'G', accidental: 'natural', octave: 3 },
    preferredMaxCents: 950,
  },
  {
    id: 'bam',
    labelFa: 'سیم بم (واخوان)',
    openNote: { letter: 'C', accidental: 'natural', octave: 3 },
    preferredMaxCents: 750,
  },
];

function fingerForFret(fretIndex: number): {
  code: '۰' | '۱' | '۲' | '۳' | 'ش';
  labelFa: string;
  positionFa: string;
} {
  if (fretIndex === 0) {
    return { code: '۰', labelFa: 'دست‌باز (آزاد)', positionFa: 'پوزیسیون اول' };
  }
  if (fretIndex <= 3) {
    return { code: '۱', labelFa: 'انگشت ۱ (اشاره)', positionFa: 'پوزیسیون اول' };
  }
  if (fretIndex <= 6) {
    return { code: '۲', labelFa: 'انگشت ۲ (میانی)', positionFa: 'پوزیسیون اول' };
  }
  if (fretIndex <= 9) {
    return { code: '۳', labelFa: 'انگشت ۳ (انگشتری)', positionFa: 'پوزیسیون اول' };
  }
  if (fretIndex <= 12) {
    return { code: '۱', labelFa: 'انگشت ۱ (انتقال میانی)', positionFa: 'پوزیسیون دوم' };
  }
  if (fretIndex <= 15) {
    return { code: '۲', labelFa: 'انگشت ۲ (پرده میانی)', positionFa: 'پوزیسیون دوم' };
  }
  if (fretIndex <= 18) {
    return { code: '۳', labelFa: 'انگشت ۳ (اکتاو)', positionFa: 'پوزیسیون سوم' };
  }
  return { code: 'ش', labelFa: 'انگشت ۳ / شست (اوج دسته)', positionFa: 'پوزیسیون اوج' };
}

/**
 * Computes ergonomic Persian Tar / Setar string-course and finger assignments
 * for a given note using the authentic 24-fret logarithmic Persian fretboard.
 */
export function recommendTarSetarFingering(
  note: PersianNoteSpec,
  a4Hz: number = 440,
  koronMode: KoronMode = 'standard_50'
): TarFingeringSuggestion {
  const fretCentsTable = getTar24FretCents(koronMode);
  const targetHz = noteToFrequency(note, a4Hz, koronMode);

  let bestScore = Infinity;
  let bestCourse = TAR_SETAR_COURSES[0];
  let bestFret = 0;
  let bestFretCents = 0;

  for (const course of TAR_SETAR_COURSES) {
    const openHz = noteToFrequency(course.openNote, a4Hz, koronMode);
    const centsAboveOpen = 1200 * Math.log2(targetHz / openHz);

    // Note must be reachable on or above this open string (within ~1.5 octaves)
    if (centsAboveOpen < -25 || centsAboveOpen > 1760) continue;

    // Find nearest authentic Persian fret on this course
    let nearestFret = 0;
    let nearestDiff = Infinity;
    for (let f = 0; f < fretCentsTable.length; f++) {
      const diff = Math.abs(fretCentsTable[f] - centsAboveOpen);
      if (diff < nearestDiff) {
        nearestDiff = diff;
        nearestFret = f;
      }
    }

    // Ergonomic cost: strongly prefer exact fret match, favor سیم سفید for melody >= C4,
    // favor lower hand positions (frets 0..11) to minimize awkward shifts.
    const positionPenalty =
      fretCentsTable[nearestFret] > course.preferredMaxCents ? 40 : 0;
    const shiftPenalty = nearestFret * 1.4;
    const coursePreference =
      course.id === 'sefid' ? 0 : course.id === 'zard' ? 5 : 14;

    const totalCost = nearestDiff * 8 + positionPenalty + shiftPenalty + coursePreference;
    if (totalCost < bestScore) {
      bestScore = totalCost;
      bestCourse = course;
      bestFret = nearestFret;
      bestFretCents = fretCentsTable[nearestFret];
    }
  }

  const finger = fingerForFret(bestFret);
  return {
    note,
    noteLabelFa: formatNoteFa(note, true),
    courseId: bestCourse.id,
    courseLabelFa: bestCourse.labelFa,
    fretIndex: bestFret,
    fretCents: bestFretCents,
    fingerCode: finger.code,
    fingerLabelFa: finger.labelFa,
    positionFa: finger.positionFa,
  };
}

/**
 * Generates a full ergonomic fingering sequence for a Radif melody,
 * optimizing continuity so consecutive notes prefer comfortable hand positions.
 */
export function buildMelodyFingeringGuide(
  notes: PersianNoteSpec[],
  a4Hz: number = 440,
  koronMode: KoronMode = 'standard_50'
): TarFingeringSuggestion[] {
  return notes.map((n) => recommendTarSetarFingering(n, a4Hz, koronMode));
}
