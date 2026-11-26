import { NOTE_SEMITONES } from '../data/musicTheory';
import type {
  CustomTemperamentProfile,
  NoteLetter,
  PersianNoteSpec,
} from '../types/music';

const STORAGE_KEY_PREFIX = 'navanegar_temperament::';

export const BUILTIN_TEMPERAMENT_PROFILES: CustomTemperamentProfile[] = [
  {
    id: 'vaziri_24tet',
    nameFa: 'نظام ۲۴ ربع‌پرده وزیری (استاندارد)',
    schoolFa: 'مکتب علینقی وزیری',
    descriptionFa: 'کُرُن دقیقاً ۵۰ سنت بم‌تر و سُری ۵۰ سنت زیرتر — استاندارد آموزشگاه‌ها و کتاب‌های معاصر.',
    koronCents: -50,
    soriCents: 50,
    noteOffsetsCents: { C: 0, D: 0, E: 0, F: 0, G: 0, A: 0, B: 0 },
  },
  {
    id: 'farhat_traditional',
    nameFa: 'کوک سنتی هرمز فرهت (فاصله خنثی)',
    schoolFa: 'پژوهش هرمز فرهت و ردیف قدما',
    descriptionFa: 'کُرُن ۵۶ سنت بم‌تر برای دوم خنثی شور و سه‌گاه با رنگ آوازی اصیل و گرم‌تر.',
    koronCents: -56,
    soriCents: 48,
    noteOffsetsCents: { C: 0, D: 2, E: -4, F: -2, G: 2, A: -6, B: -4 },
  },
  {
    id: 'talaei_mirza',
    nameFa: 'مکتب میرزاعبدالله / داریوش طلایی',
    schoolFa: 'کوک تحلیلی تار و سه‌تار',
    descriptionFa: 'لا کُرُن اندکی پایین‌تر (-۶۲¢) و می کُرُن متعادل (-۵۰¢) مطابق پرده‌بندی تار سنتی.',
    koronCents: -58,
    soriCents: 52,
    noteOffsetsCents: { C: 0, D: 2, E: 2, F: 0, G: 2, A: -4, B: -2 },
  },
  {
    id: 'esfahan_soft',
    nameFa: 'مکتب آواز اصفهان (کُرُن ملایم)',
    schoolFa: 'مکتب آوازی اصفهان',
    descriptionFa: 'کُرُن ملایم (-۴۵¢) با گرایش لطیف‌تر در همایون، بیات اصفهان و آوازهای تغزلی.',
    koronCents: -45,
    soriCents: 46,
    noteOffsetsCents: { C: 0, D: 0, E: 3, F: 0, G: 0, A: 4, B: 2 },
  },
];

/**
 * Computes exact frequency (Hz) for a Persian note under a CustomTemperamentProfile
 * (combining custom Koron/Sori cent values + per-letter cent fine offsets).
 */
export function noteToCustomTemperamentFrequency(
  note: PersianNoteSpec,
  profile: CustomTemperamentProfile,
  a4Hz = 440
): number {
  let accCents = 0;
  if (note.accidental === 'koron') accCents = profile.koronCents;
  else if (note.accidental === 'sori') accCents = profile.soriCents;
  else if (note.accidental === 'flat') accCents = -100;
  else if (note.accidental === 'sharp') accCents = 100;

  const letterFine = profile.noteOffsetsCents[note.letter] ?? 0;
  const totalCentsFromC0 =
    note.octave * 1200 + NOTE_SEMITONES[note.letter] * 100 + accCents + letterFine;
  const a4CentsFromC0 = 4 * 1200 + 900;
  return a4Hz * Math.pow(2, (totalCentsFromC0 - a4CentsFromC0) / 1200);
}

/**
 * Returns cent difference between two temperament profiles for a given note (for A/B listening).
 */
export function compareTemperamentCents(
  note: PersianNoteSpec,
  profileA: CustomTemperamentProfile,
  profileB: CustomTemperamentProfile,
  a4Hz = 440
): number {
  const fA = noteToCustomTemperamentFrequency(note, profileA, a4Hz);
  const fB = noteToCustomTemperamentFrequency(note, profileB, a4Hz);
  return Math.round(1200 * Math.log2(fB / fA) * 10) / 10;
}

export function loadScopedTemperament(ownerUid: string): CustomTemperamentProfile {
  const fallback = BUILTIN_TEMPERAMENT_PROFILES[0];
  if (typeof window === 'undefined' || !window.localStorage) return fallback;
  try {
    const raw = window.localStorage.getItem(`${STORAGE_KEY_PREFIX}${ownerUid || 'guest'}`);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<CustomTemperamentProfile>;
    if (typeof parsed.koronCents !== 'number' || typeof parsed.soriCents !== 'number') {
      return fallback;
    }
    return {
      ...fallback,
      ...parsed,
      noteOffsetsCents: {
        ...fallback.noteOffsetsCents,
        ...(parsed.noteOffsetsCents ?? {}),
      } as Record<NoteLetter, number>,
    };
  } catch {
    return fallback;
  }
}

export function saveScopedTemperament(
  ownerUid: string,
  profile: CustomTemperamentProfile
): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(
      `${STORAGE_KEY_PREFIX}${ownerUid || 'guest'}`,
      JSON.stringify(profile)
    );
  } catch {
    // ignore quota errors
  }
}
