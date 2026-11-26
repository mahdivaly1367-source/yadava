import type {
  Accidental,
  InstrumentId,
  KoronMode,
  NoteLetter,
  PersianNoteSpec,
} from '../types/music';
import { toPersianDigits } from '../utils/persian';

export const NOTE_SEMITONES: Record<NoteLetter, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

export const NOTE_NAMES_FA: Record<NoteLetter, string> = {
  C: 'دو',
  D: 'ر',
  E: 'می',
  F: 'فا',
  G: 'سل',
  A: 'لا',
  B: 'سی',
};

export const ACCIDENTAL_LABELS_FA: Record<Accidental, string> = {
  natural: '',
  koron: 'کُرُن',
  sori: 'سُری',
  flat: 'بِمُل',
  sharp: 'دیِز',
};

export const ACCIDENTAL_SYMBOLS: Record<Accidental, string> = {
  natural: '',
  koron: 'p', // rendered as true Persian Koron SVG glyph on staff
  sori: '>',  // rendered as true Persian Sori SVG glyph on staff
  flat: '♭',
  sharp: '♯',
};

export function getAccidentalCents(accidental: Accidental, koronMode: KoronMode = 'standard_50'): number {
  switch (accidental) {
    case 'natural':
      return 0;
    case 'koron':
      return koronMode === 'traditional_56' ? -56 : -50;
    case 'sori':
      return 50;
    case 'flat':
      return -100;
    case 'sharp':
      return 100;
  }
}

export function noteToCentsFromC0(note: PersianNoteSpec, koronMode: KoronMode = 'standard_50'): number {
  return note.octave * 1200 + NOTE_SEMITONES[note.letter] * 100 + getAccidentalCents(note.accidental, koronMode);
}

/**
 * Computes exact frequency (Hz) for a Persian microtonal note with sub-cent A4 calibration.
 * A4 = octave 4, letter A (semitone 9) => 4*1200 + 900 = 5700 cents from C0.
 */
export function noteToFrequency(
  note: PersianNoteSpec,
  a4Hz = 440,
  koronMode: KoronMode = 'standard_50'
): number {
  const centsFromC0 = noteToCentsFromC0(note, koronMode);
  const a4CentsFromC0 = 4 * 1200 + 900;
  return a4Hz * Math.pow(2, (centsFromC0 - a4CentsFromC0) / 1200);
}

export function formatNoteFa(note: PersianNoteSpec, includeOctave = false): string {
  const base = NOTE_NAMES_FA[note.letter];
  const acc = ACCIDENTAL_LABELS_FA[note.accidental];
  const core = acc ? `${base} ${acc}` : base;
  return includeOctave ? `${core} ${toPersianDigits(note.octave)}` : core;
}

export function formatNoteShort(note: PersianNoteSpec): string {
  const sym =
    note.accidental === 'koron'
      ? '𝄳'
      : note.accidental === 'sori'
      ? '𝄲'
      : note.accidental === 'flat'
      ? '♭'
      : note.accidental === 'sharp'
      ? '♯'
      : '';
  return `${NOTE_NAMES_FA[note.letter]}${sym}`;
}

export function isSamePitchClass(a: PersianNoteSpec, b: PersianNoteSpec): boolean {
  return a.letter === b.letter && a.accidental === b.accidental;
}

export function isSameNote(a: PersianNoteSpec, b: PersianNoteSpec): boolean {
  return a.letter === b.letter && a.accidental === b.accidental && a.octave === b.octave;
}

/**
 * Canonical 24 microtonal Persian pitch classes in one octave (matching standard Iranian notation).
 */
export const PERSIAN_OCTAVE_PITCH_CLASSES: Array<{ letter: NoteLetter; accidental: Accidental }> = [
  { letter: 'C', accidental: 'natural' },
  { letter: 'C', accidental: 'sori' },
  { letter: 'D', accidental: 'flat' },
  { letter: 'D', accidental: 'koron' },
  { letter: 'D', accidental: 'natural' },
  { letter: 'D', accidental: 'sori' },
  { letter: 'E', accidental: 'flat' },
  { letter: 'E', accidental: 'koron' },
  { letter: 'E', accidental: 'natural' },
  { letter: 'F', accidental: 'natural' },
  { letter: 'F', accidental: 'sori' },
  { letter: 'F', accidental: 'sharp' },
  { letter: 'G', accidental: 'koron' },
  { letter: 'G', accidental: 'natural' },
  { letter: 'G', accidental: 'sori' },
  { letter: 'A', accidental: 'flat' },
  { letter: 'A', accidental: 'koron' },
  { letter: 'A', accidental: 'natural' },
  { letter: 'A', accidental: 'sori' },
  { letter: 'B', accidental: 'flat' },
  { letter: 'B', accidental: 'koron' },
  { letter: 'B', accidental: 'natural' },
];

export interface DetectedNoteMatch {
  note: PersianNoteSpec;
  labelFa: string;
  centsOffset: number;
  targetFrequency: number;
}

/**
 * Maps an arbitrary frequency (Hz) to the closest Persian microtonal note and exact cent deviation.
 * If preferredScale is provided, slightly prefers in-scale spelling when equidistant (enharmonic disambiguation).
 */
export function frequencyToPersianNote(
  freqHz: number,
  a4Hz = 440,
  koronMode: KoronMode = 'standard_50',
  preferredScale?: PersianNoteSpec[]
): DetectedNoteMatch {
  const a4Cents = 4 * 1200 + 900;
  const inputCents = a4Cents + 1200 * Math.log2(freqHz / a4Hz);
  const approxOctave = Math.floor(inputCents / 1200);

  let bestNote: PersianNoteSpec = { letter: 'A', accidental: 'natural', octave: 4 };
  let bestDiff = Infinity;
  let bestScore = Infinity;

  for (let oct = Math.max(1, approxOctave - 1); oct <= Math.min(7, approxOctave + 1); oct++) {
    for (const pc of PERSIAN_OCTAVE_PITCH_CLASSES) {
      const candidate: PersianNoteSpec = { ...pc, octave: oct };
      const candCents = noteToCentsFromC0(candidate, koronMode);
      const diff = inputCents - candCents;
      const absDiff = Math.abs(diff);

      // Gentle bias (-4 cents tie-breaker) toward notes belonging to the active gusheh's scale
      const inScale = preferredScale?.some((s) => isSamePitchClass(s, candidate)) ?? false;
      const score = absDiff - (inScale ? 4 : 0);

      if (score < bestScore) {
        bestScore = score;
        bestDiff = diff;
        bestNote = candidate;
      }
    }
  }

  return {
    note: bestNote,
    labelFa: formatNoteFa(bestNote, true),
    centsOffset: Math.max(-50, Math.min(50, Math.round(bestDiff * 10) / 10)),
    targetFrequency: noteToFrequency(bestNote, a4Hz, koronMode),
  };
}

/**
 * Staff diatonic vertical position relative to C4 (Middle C = 0).
 */
const DIATONIC_INDEX: Record<NoteLetter, number> = {
  C: 0,
  D: 1,
  E: 2,
  F: 3,
  G: 4,
  A: 5,
  B: 6,
};

export function noteToStaffStep(note: PersianNoteSpec): number {
  return (note.octave - 4) * 7 + DIATONIC_INDEX[note.letter];
}

/**
 * Authentic 24-fret Persian Tar / Setar neck layout (pardeh positions in cents above open string).
 * Index 0 is open string (دست‌باز), indices 1..24 are the 24 frets (۲۴ پرده).
 */
export function getTar24FretCents(koronMode: KoronMode = 'standard_50'): number[] {
  const k = koronMode === 'traditional_56' ? 56 : 50;
  return [
    0,          // 0: دست‌باز
    100,        // 1: نیم‌پرده (بمل دوم)
    200 - k,    // 2: کُرُن دوم
    200,        // 3: پرده دوم (بزرگ)
    300,        // 4: سوم کوچک
    400 - k,    // 5: سوم کُرُن
    400,        // 6: سوم بزرگ
    500,        // 7: چهارم درست
    550,        // 8: چهارم سُری
    600,        // 9: چهارم افزوده
    700,        // 10: پنجم درست
    800,        // 11: ششم کوچک
    900 - k,    // 12: ششم کُرُن
    900,        // 13: ششم بزرگ
    1000,       // 14: هفتم کوچک
    1100 - k,   // 15: هفتم کُرُن
    1100,       // 16: هفتم بزرگ
    1200,       // 17: اکتاو (هنگام)
    1300,       // 18: نهم کوچک
    1400 - k,   // 19: نهم کُرُن
    1400,       // 20: نهم بزرگ
    1500,       // 21: دهم کوچک
    1600 - k,   // 22: دهم کُرُن
    1600,       // 23: دهم بزرگ
    1700,       // 24: یازدهم درست
  ];
}

/**
 * Logarithmic physical fret ratio along vibrating string length [0..1]
 * following x(c) = 1 - 2^(-c / 1200).
 */
export function fretCentsToLinearRatio(cents: number, maxCents = 1700): number {
  const maxRatio = 1 - Math.pow(2, -maxCents / 1200);
  const ratio = 1 - Math.pow(2, -cents / 1200);
  return ratio / maxRatio;
}

export interface InstrumentStringTuning {
  id: string;
  labelFa: string;
  note: PersianNoteSpec;
}

export interface RecommendedTuning {
  dastgahId: string;
  instrument: InstrumentId;
  titleFa: string;
  noteSummaryFa: string;
  strings: InstrumentStringTuning[];
}

/**
 * Authentic standard Iranian tunings (کوک استاندارد) per Dastgah & Instrument.
 */
export function getRecommendedTuning(dastgahId: string, instrument: InstrumentId): RecommendedTuning {
  if (instrument === 'ney') {
    const neyMap: Record<string, { title: string; base: PersianNoteSpec }> = {
      shur: { title: 'نی کوک سل (شور سل)', base: { letter: 'G', accidental: 'natural', octave: 4 } },
      abuata: { title: 'نی کوک سل (ابوعطا)', base: { letter: 'A', accidental: 'koron', octave: 4 } },
      bayat_tork: { title: 'نی کوک سل (بیات ترک)', base: { letter: 'B', accidental: 'flat', octave: 4 } },
      afshari: { title: 'نی کوک سل (افشاری)', base: { letter: 'C', accidental: 'natural', octave: 5 } },
      dashti: { title: 'نی کوک سل (دشتی)', base: { letter: 'D', accidental: 'natural', octave: 5 } },
      mahur: { title: 'نی کوک دو (ماهور دو)', base: { letter: 'C', accidental: 'natural', octave: 5 } },
      homayun: { title: 'نی کوک سل (همایون سل)', base: { letter: 'G', accidental: 'natural', octave: 4 } },
      bayat_esfahan: { title: 'نی کوک دو (بیات اصفهان)', base: { letter: 'C', accidental: 'natural', octave: 5 } },
      segah: { title: 'نی کوک می کُرُن (سه‌گاه)', base: { letter: 'E', accidental: 'koron', octave: 4 } },
      chahargah: { title: 'نی کوک دو (چهارگاه دو)', base: { letter: 'C', accidental: 'natural', octave: 4 } },
      nava: { title: 'نی کوک سل (نوا سل)', base: { letter: 'G', accidental: 'natural', octave: 4 } },
      rast_panjgah: { title: 'نی کوک فا (راست‌پنجگاه)', base: { letter: 'F', accidental: 'natural', octave: 4 } },
    };
    const info = neyMap[dastgahId] ?? neyMap.shur;
    return {
      dastgahId,
      instrument,
      titleFa: info.title,
      noteSummaryFa: `نت پایه ${formatNoteFa(info.base, true)} — دم بم، غیث و پس‌غیث`,
      strings: [
        { id: 'ney-bam', labelFa: 'بم (پایه)', note: { ...info.base, octave: Math.max(3, info.base.octave - 1) } },
        { id: 'ney-owj', labelFa: 'میانی (شاهد)', note: info.base },
        { id: 'ney-ghays', labelFa: 'غیث (پنجم)', note: { letter: 'D', accidental: 'natural', octave: 5 } },
        { id: 'ney-pas', labelFa: 'اکتاو (اوج)', note: { ...info.base, octave: info.base.octave + 1 } },
      ],
    };
  }

  if (instrument === 'santur') {
    const isMahur = dastgahId === 'mahur' || dastgahId === 'rast_panjgah';
    const isHomayun = dastgahId === 'homayun' || dastgahId === 'bayat_esfahan';
    const isChahargah = dastgahId === 'chahargah';
    const isSegah = dastgahId === 'segah';
    const isNava = dastgahId === 'nava';

    const titleFa = isMahur
      ? 'کوک سنتور ماهور / راست‌پنجگاه (می و لا بکار)'
      : isHomayun
      ? 'کوک سنتور همایون / اصفهان (می بمل، لا کُرُن، سی بکار)'
      : isChahargah
      ? 'کوک سنتور چهارگاه دو (ر کُرُن، می بکار، لا کُرُن، سی بکار)'
      : isSegah
      ? 'کوک سنتور سه‌گاه (می کُرُن، لا کُرُن، سی بمل)'
      : isNava
      ? 'کوک سنتور نوا سُل (می کُرُن، لا بکار، سی بمل)'
      : 'کوک سنتور شور سُل (می بمل، لا کُرُن، سی بمل)';

    const eAcc: Accidental =
      isMahur || isChahargah
        ? 'natural'
        : isSegah || isNava
        ? 'koron'
        : 'flat';
    const aAcc: Accidental = isMahur || isNava ? 'natural' : 'koron';
    const bAcc: Accidental =
      dastgahId === 'mahur' || isHomayun || isChahargah ? 'natural' : 'flat';

    return {
      dastgahId,
      instrument,
      titleFa,
      noteSummaryFa: 'خرک‌های کلیدی زرد (بم) و سفید (میانی) منطبق بر گام دستگاه',
      strings: [
        { id: 's-1', labelFa: 'خرک ۱ زرد', note: { letter: 'E', accidental: eAcc, octave: 3 } },
        { id: 's-3', labelFa: 'خرک ۳ زرد (شاهد)', note: { letter: 'G', accidental: 'natural', octave: 3 } },
        { id: 's-4', labelFa: 'خرک ۴ زرد', note: { letter: 'A', accidental: aAcc, octave: 3 } },
        { id: 's-5', labelFa: 'خرک ۵ زرد', note: { letter: 'B', accidental: bAcc, octave: 3 } },
        { id: 's-w1', labelFa: 'خرک ۱ سفید', note: { letter: 'E', accidental: eAcc, octave: 4 } },
        { id: 's-w3', labelFa: 'خرک ۳ سفید', note: { letter: 'G', accidental: 'natural', octave: 4 } },
      ],
    };
  }

  if (instrument === 'kamancheh') {
    const isMahur = dastgahId === 'mahur' || dastgahId === 'rast_panjgah' || dastgahId === 'chahargah';
    const isSegah = dastgahId === 'segah';
    return {
      dastgahId,
      instrument,
      titleFa: isMahur
        ? 'کوک کمانچه ماهور / چهارگاه (می – لا – ر – سُل)'
        : isSegah
        ? 'کوک کمانچه سه‌گاه (می کُرُن – لا کُرُن – ر – سُل)'
        : 'کوک کمانچه استاندارد شور / همایون (می – لا – ر – سُل)',
      noteSummaryFa: 'چهار سیم آرشه‌ای کمانچه با کوک چهارم و پنجم درست',
      strings: [
        { id: 'kam-1', labelFa: 'سیم اول (زیر)', note: { letter: 'E', accidental: isSegah ? 'koron' : 'natural', octave: 5 } },
        { id: 'kam-2', labelFa: 'سیم دوم', note: { letter: 'A', accidental: isSegah ? 'koron' : 'natural', octave: 4 } },
        { id: 'kam-3', labelFa: 'سیم سوم', note: { letter: 'D', accidental: 'natural', octave: 4 } },
        { id: 'kam-4', labelFa: 'سیم چهارم (بم)', note: { letter: 'G', accidental: 'natural', octave: 3 } },
      ],
    };
  }

  if (instrument === 'oud') {
    const isHomayun = dastgahId === 'homayun' || dastgahId === 'bayat_esfahan';
    return {
      dastgahId,
      instrument,
      titleFa: isHomayun
        ? 'کوک عود (بربت) همایون / اصفهان (دو – سُل – ر – لا – سُل بم)'
        : 'کوک عود (بربت) استاندارد ایرانی (دو – سُل – ر – لا – فا)',
      noteSummaryFa: '۵ جفت‌سیم بم و میانی بربت با طنین گرم کاسه چوبی',
      strings: [
        { id: 'oud-1', labelFa: 'جفت‌سیم ۱ (دو)', note: { letter: 'C', accidental: 'natural', octave: 4 } },
        { id: 'oud-2', labelFa: 'جفت‌سیم ۲ (سُل)', note: { letter: 'G', accidental: 'natural', octave: 3 } },
        { id: 'oud-3', labelFa: 'جفت‌سیم ۳ (ر)', note: { letter: 'D', accidental: 'natural', octave: 3 } },
        { id: 'oud-4', labelFa: 'جفت‌سیم ۴ (لا)', note: { letter: 'A', accidental: 'natural', octave: 2 } },
        { id: 'oud-5', labelFa: 'سیم ۵ بم', note: { letter: isHomayun ? 'G' : 'F', accidental: 'natural', octave: 2 } },
      ],
    };
  }

  if (instrument === 'tanbur') {
    const isShaykhAmiri = dastgahId === 'mahur' || dastgahId === 'rast_panjgah' || dastgahId === 'nava';
    return {
      dastgahId,
      instrument,
      titleFa: isShaykhAmiri
        ? 'کوک تنبور شیخ‌امیری (دو – دو – سُل / فاصله چهارم)'
        : 'کوک تنبور طرز (دو – دو – فا / فاصله پنجم مقامی)',
      noteSummaryFa: 'دو سیم زیر جفت (هم‌کوک) و یک سیم واخوان بم مقامی',
      strings: [
        { id: 'tan-1', labelFa: 'سیم ۱ زیر (جفت)', note: { letter: 'C', accidental: 'natural', octave: 4 } },
        { id: 'tan-2', labelFa: 'سیم ۲ زیر (جفت)', note: { letter: 'C', accidental: 'natural', octave: 4 } },
        {
          id: 'tan-3',
          labelFa: 'سیم ۳ واخوان (بم)',
          note: { letter: isShaykhAmiri ? 'G' : 'F', accidental: 'natural', octave: 3 },
        },
      ],
    };
  }

  // Tar and Setar (4 courses: سفید، زرد، زیر/زنگ، بم)
  const presets: Record<string, { title: string; notes: [PersianNoteSpec, PersianNoteSpec, PersianNoteSpec, PersianNoteSpec] }> = {
    shur: {
      title: 'کوک دو – سل – دو – دو (کوک استاندارد شور)',
      notes: [
        { letter: 'C', accidental: 'natural', octave: 4 },
        { letter: 'G', accidental: 'natural', octave: 3 },
        { letter: 'C', accidental: 'natural', octave: 4 },
        { letter: 'C', accidental: 'natural', octave: 3 },
      ],
    },
    mahur: {
      title: 'کوک دو – سل – ر – دو (کوک استاندارد ماهور)',
      notes: [
        { letter: 'C', accidental: 'natural', octave: 4 },
        { letter: 'G', accidental: 'natural', octave: 3 },
        { letter: 'D', accidental: 'natural', octave: 4 },
        { letter: 'C', accidental: 'natural', octave: 3 },
      ],
    },
    homayun: {
      title: 'کوک دو – سل – دو – لا کُرُن (کوک همایون)',
      notes: [
        { letter: 'C', accidental: 'natural', octave: 4 },
        { letter: 'G', accidental: 'natural', octave: 3 },
        { letter: 'C', accidental: 'natural', octave: 4 },
        { letter: 'A', accidental: 'koron', octave: 2 },
      ],
    },
    bayat_esfahan: {
      title: 'کوک دو – سل – دو – سل (کوک بیات اصفهان)',
      notes: [
        { letter: 'C', accidental: 'natural', octave: 4 },
        { letter: 'G', accidental: 'natural', octave: 3 },
        { letter: 'C', accidental: 'natural', octave: 4 },
        { letter: 'G', accidental: 'natural', octave: 2 },
      ],
    },
    segah: {
      title: 'کوک دو – سل – دو – می کُرُن (کوک سه‌گاه)',
      notes: [
        { letter: 'C', accidental: 'natural', octave: 4 },
        { letter: 'G', accidental: 'natural', octave: 3 },
        { letter: 'C', accidental: 'natural', octave: 4 },
        { letter: 'E', accidental: 'koron', octave: 3 },
      ],
    },
    chahargah: {
      title: 'کوک دو – سل – دو – دو (کوک چهارگاه)',
      notes: [
        { letter: 'C', accidental: 'natural', octave: 4 },
        { letter: 'G', accidental: 'natural', octave: 3 },
        { letter: 'C', accidental: 'natural', octave: 4 },
        { letter: 'C', accidental: 'natural', octave: 3 },
      ],
    },
    nava: {
      title: 'کوک ر – سل – دو – سل (کوک نوا)',
      notes: [
        { letter: 'D', accidental: 'natural', octave: 4 },
        { letter: 'G', accidental: 'natural', octave: 3 },
        { letter: 'C', accidental: 'natural', octave: 4 },
        { letter: 'G', accidental: 'natural', octave: 2 },
      ],
    },
    rast_panjgah: {
      title: 'کوک دو – فا – دو – فا (کوک راست‌پنجگاه)',
      notes: [
        { letter: 'C', accidental: 'natural', octave: 4 },
        { letter: 'F', accidental: 'natural', octave: 3 },
        { letter: 'C', accidental: 'natural', octave: 4 },
        { letter: 'F', accidental: 'natural', octave: 2 },
      ],
    },
  };

  const p = presets[dastgahId] ?? presets.shur;
  const labels =
    instrument === 'setar'
      ? ['سیم اول (سفید)', 'سیم دوم (زرد)', 'سیم سوم (زنگ/واخوان)', 'سیم چهارم (بم)']
      : ['جفت سیم اول (سفید)', 'جفت سیم دوم (زرد)', 'سیم زیر (واخوان)', 'سیم بم'];

  return {
    dastgahId,
    instrument,
    titleFa: p.title,
    noteSummaryFa: p.notes.map((n) => formatNoteFa(n)).join(' — '),
    strings: p.notes.map((note, idx) => ({
      id: `course-${idx + 1}`,
      labelFa: labels[idx],
      note,
    })),
  };
}

export interface SanturBridge {
  index: number; // 1..27
  register: 'zard' | 'sefid' | 'posht'; // 1..9 yellow bass, 10..18 white mid, 19..27 high
  bridgeNumberInRegister: number; // 1..9
  note: PersianNoteSpec;
  labelFa: string;
}

/**
 * Generates all 27 authentic bridges (۲۷ خرک سنتور):
 * 9 خرک زرد (بم)، ۹ خرک سفید (میانی)، ۹ پشت‌خرک (زیر) tuned accurately to the selected Dastgah.
 */
export function getSantur27Bridges(dastgahId: string): SanturBridge[] {
  const isMahur = dastgahId === 'mahur';
  const isRast = dastgahId === 'rast_panjgah';
  const isHomayun = dastgahId === 'homayun' || dastgahId === 'bayat_esfahan';
  const isChahargah = dastgahId === 'chahargah';
  const isSegah = dastgahId === 'segah';
  const isNava = dastgahId === 'nava';

  // Exact Dastgah-matched accidentals for every bridge (zero out-of-scale bridges!)
  const eAcc: Accidental =
    isMahur || isRast || isChahargah
      ? 'natural'
      : isSegah || isNava
      ? 'koron'
      : 'flat';
  const aAcc: Accidental = isMahur || isRast || isNava ? 'natural' : 'koron';
  const bAcc: Accidental = isMahur || isHomayun || isChahargah ? 'natural' : 'flat';
  const dAcc: Accidental = isChahargah ? 'koron' : 'natural';

  const scaleLetters: Array<{ letter: NoteLetter; accidental: Accidental; octaveOffset: number }> = [
    { letter: 'E', accidental: eAcc, octaveOffset: 0 },
    { letter: 'F', accidental: 'natural', octaveOffset: 0 },
    { letter: 'G', accidental: 'natural', octaveOffset: 0 },
    { letter: 'A', accidental: aAcc, octaveOffset: 0 },
    { letter: 'B', accidental: bAcc, octaveOffset: 0 },
    { letter: 'C', accidental: 'natural', octaveOffset: 1 },
    { letter: 'D', accidental: dAcc, octaveOffset: 1 },
    { letter: 'E', accidental: eAcc, octaveOffset: 1 },
    { letter: 'F', accidental: 'natural', octaveOffset: 1 },
  ];

  const bridges: SanturBridge[] = [];
  const registers: Array<{ key: 'zard' | 'sefid' | 'posht'; baseOctave: number }> = [
    { key: 'zard', baseOctave: 3 },
    { key: 'sefid', baseOctave: 4 },
    { key: 'posht', baseOctave: 5 },
  ];

  let idx = 1;
  for (const reg of registers) {
    for (let i = 0; i < 9; i++) {
      const s = scaleLetters[i];
      const note: PersianNoteSpec = {
        letter: s.letter,
        accidental: s.accidental,
        octave: reg.baseOctave + s.octaveOffset,
      };
      bridges.push({
        index: idx,
        register: reg.key,
        bridgeNumberInRegister: i + 1,
        note,
        labelFa: formatNoteShort(note),
      });
      idx += 1;
    }
  }
  return bridges;
}
