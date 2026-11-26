import {
  formatNoteFa,
  getSantur27Bridges,
  noteToCentsFromC0,
} from '../data/musicTheory';
import { SYSTEM_BY_ID } from '../data/radifData';
import type { KoronMode, PersianNoteSpec } from '../types/music';

export interface SanturBridgeShift {
  position: number; // 1..9 from bottom khark to top khark
  courseLabelFa: string;
  registerFa: 'سیم‌های زرد (بم)' | 'سیم‌های سفید (میانی)' | 'پشت خرک (زیر)';
  fromNote: PersianNoteSpec;
  toNote: PersianNoteSpec;
  deltaCents: number;
  direction: 'none' | 'right_higher' | 'left_lower';
  instructionFa: string;
}

export interface SanturRetunePlan {
  fromDastgahId: string;
  toDastgahId: string;
  fromNameFa: string;
  toNameFa: string;
  shifts: SanturBridgeShift[];
  changedCount: number;
  summaryFa: string;
}

/**
 * Computes exact bridge-by-bridge khark shift instructions to retune a 9-khark Persian Santur
 * from one Dastgah to another (e.g. Shur -> Homayun, Shur -> Segah, Homayun -> Esfahan).
 * On a standard Santur: moving a bridge to the LEFT raises pitch on white/yellow courses?
 * Note: On the yellow (right-side) bridges, shortening vibrating string (shifting LEFT toward center)
 * raises pitch; on white (left-side) bridges, shifting RIGHT shortens the left segment and raises pitch.
 * We clearly specify higher (زیرتر / کوتاه‌کردن سیم) vs lower (بم‌تر / بلندکردن سیم) to prevent any confusion.
 */
export function computeSanturRetunePlan(
  fromDastgahId: string,
  toDastgahId: string,
  koronMode: KoronMode = 'standard_50'
): SanturRetunePlan {
  const fromBridges = getSantur27Bridges(fromDastgahId);
  const toBridges = getSantur27Bridges(toDastgahId);

  const shifts: SanturBridgeShift[] = [];
  for (let i = 0; i < Math.min(fromBridges.length, toBridges.length); i++) {
    const a = fromBridges[i];
    const b = toBridges[i];
    const deltaCents = Math.round(
      noteToCentsFromC0(b.note, koronMode) - noteToCentsFromC0(a.note, koronMode)
    );

    if (Math.abs(deltaCents) < 10) continue;

    const absCents = Math.abs(deltaCents);
    const intervalLabel =
      absCents >= 85 && absCents <= 115
        ? 'نیم‌پرده'
        : absCents >= 35 && absCents <= 68
          ? 'ربع‌پرده'
          : `${absCents} سنت`;

    const direction = deltaCents > 0 ? 'right_higher' : 'left_lower';
    const registerFa =
      a.register === 'zard'
        ? 'سیم‌های زرد (بم)'
        : a.register === 'sefid'
          ? 'سیم‌های سفید (میانی)'
          : 'پشت خرک (زیر)';

    // Practical Persian santur phrasing
    const moveHint =
      deltaCents > 0
        ? `کوتاه‌تر کردن طول سیم (${intervalLabel} زیرتر)`
        : `بلندتر کردن طول سیم (${intervalLabel} بم‌تر)`;

    shifts.push({
      position: a.bridgeNumberInRegister,
      courseLabelFa: `خرک ${a.bridgeNumberInRegister} (${a.register === 'zard' ? 'زرد' : a.register === 'sefid' ? 'سفید' : 'پشت خرک'})`,
      registerFa,
      fromNote: a.note,
      toNote: b.note,
      deltaCents,
      direction,
      instructionFa: `تغییر از ${formatNoteFa(a.note)} به ${formatNoteFa(b.note)} — ${moveHint}`,
    });
  }

  const fromNameFa = SYSTEM_BY_ID[fromDastgahId]?.nameFa ?? fromDastgahId;
  const toNameFa = SYSTEM_BY_ID[toDastgahId]?.nameFa ?? toDastgahId;

  const summaryFa =
    shifts.length === 0
      ? `کوک خرک‌های ${fromNameFa} و ${toNameFa} کاملاً یکسان است؛ نیازی به جابه‌جایی خرک نیست.`
      : `برای تبدیل کوک سنتور از ${fromNameFa} به ${toNameFa}، مجموعاً ${shifts.length} خرک باید جابه‌جا شوند.`;

  return {
    fromDastgahId,
    toDastgahId,
    fromNameFa,
    toNameFa,
    shifts,
    changedCount: shifts.length,
    summaryFa,
  };
}

/**
 * Authentic 14-fret Kurdish/Iranian Tanbur fretboard spec (کوک طرز / شیخ‌امیری / مجنونی).
 */
export interface TanburTuningSpec {
  id: 'tarz' | 'sheikh_amiri' | 'majnuni';
  nameFa: string;
  intervalFa: string;
  upperNote: PersianNoteSpec;
  lowerNote: PersianNoteSpec;
}

export const TANBUR_TUNINGS: TanburTuningSpec[] = [
  {
    id: 'tarz',
    nameFa: 'کوک طرز (پنجم درست)',
    intervalFa: 'دو – سل (فاصله پنجم)',
    upperNote: { letter: 'G', accidental: 'natural', octave: 4 },
    lowerNote: { letter: 'C', accidental: 'natural', octave: 4 },
  },
  {
    id: 'sheikh_amiri',
    nameFa: 'کوک شیخ‌امیری (چهارم درست)',
    intervalFa: 'دو – فا (فاصله چهارم)',
    upperNote: { letter: 'F', accidental: 'natural', octave: 4 },
    lowerNote: { letter: 'C', accidental: 'natural', octave: 4 },
  },
  {
    id: 'majnuni',
    nameFa: 'کوک مجنونی (دوم بزرگ / سحری)',
    intervalFa: 'ر – دو (فاصله دوم)',
    upperNote: { letter: 'D', accidental: 'natural', octave: 4 },
    lowerNote: { letter: 'C', accidental: 'natural', octave: 4 },
  },
];

export const TANBUR_14_FRET_OFFSETS_CENTS: Array<{ fret: number; cents: number; labelFa: string }> = [
  { fret: 0, cents: 0, labelFa: 'دست باز' },
  { fret: 1, cents: 100, labelFa: 'پرده ۱' },
  { fret: 2, cents: 200, labelFa: 'پرده ۲' },
  { fret: 3, cents: 300, labelFa: 'پرده ۳' },
  { fret: 4, cents: 350, labelFa: 'پرده ۴ (کُرُن)' },
  { fret: 5, cents: 400, labelFa: 'پرده ۵' },
  { fret: 6, cents: 500, labelFa: 'پرده ۶ (چهارم)' },
  { fret: 7, cents: 600, labelFa: 'پرده ۷' },
  { fret: 8, cents: 700, labelFa: 'پرده ۸ (پنجم)' },
  { fret: 9, cents: 800, labelFa: 'پرده ۹' },
  { fret: 10, cents: 850, labelFa: 'پرده ۱۰ (کُرُن)' },
  { fret: 11, cents: 900, labelFa: 'پرده ۱۱' },
  { fret: 12, cents: 1000, labelFa: 'پرده ۱۲' },
  { fret: 13, cents: 1100, labelFa: 'پرده ۱۳' },
  { fret: 14, cents: 1200, labelFa: 'پرده ۱۴ (اکتاو)' },
];

/**
 * Authentic Persian Oud (Barbat) 5-course neck tuning map (دو – سل – ر – لا – فا).
 */
export interface OudCourseSpec {
  courseNumber: number;
  labelFa: string;
  openNote: PersianNoteSpec;
  colorHex: string;
}

export const OUD_5_COURSES: OudCourseSpec[] = [
  { courseNumber: 1, labelFa: 'سیم اول (زیر - دو)', openNote: { letter: 'C', accidental: 'natural', octave: 4 }, colorHex: '#2dd4bf' },
  { courseNumber: 2, labelFa: 'سیم دوم (سل)', openNote: { letter: 'G', accidental: 'natural', octave: 3 }, colorHex: '#38bdf8' },
  { courseNumber: 3, labelFa: 'سیم سوم (ر)', openNote: { letter: 'D', accidental: 'natural', octave: 3 }, colorHex: '#fbbf24' },
  { courseNumber: 4, labelFa: 'سیم چهارم (لا)', openNote: { letter: 'A', accidental: 'natural', octave: 2 }, colorHex: '#f97316' },
  { courseNumber: 5, labelFa: 'سیم پنجم (بم - فا)', openNote: { letter: 'F', accidental: 'natural', octave: 2 }, colorHex: '#a78bfa' },
];
