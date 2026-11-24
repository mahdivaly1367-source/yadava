import { formatNoteFa, isSamePitchClass } from '../data/musicTheory';
import { RADIF_SYSTEMS } from '../data/radifData';
import type { PersianNoteSpec } from '../types/music';

export type EarTrainingMode = 'interval' | 'dastgah' | 'dictation';

export interface EarExerciseOption {
  id: string;
  labelFa: string;
}

export interface EarExercise {
  id: string;
  mode: EarTrainingMode;
  promptFa: string;
  hintFa: string;
  notes: PersianNoteSpec[];
  options: EarExerciseOption[];
  correctOptionId: string;
  explanationFa: string;
}

export interface IntervalSpec {
  id: string;
  labelFa: string;
  notes: [PersianNoteSpec, PersianNoteSpec];
  hintFa: string;
  explanationFa: string;
}

export const PERSIAN_INTERVAL_SPECS: IntervalSpec[] = [
  {
    id: 'second_koron',
    labelFa: 'دوم خنثی / کُرُن (۱۵۰ سنت — پایه شور)',
    notes: [
      { letter: 'G', accidental: 'natural', octave: 4 },
      { letter: 'A', accidental: 'koron', octave: 4 },
    ],
    hintFa: 'فاصله میان نت پایه شور (سل) و درجه دوم کُرُن (لا کُرُن)',
    explanationFa: 'دوم خنثی (حدود ۱۴۴ تا ۱۵۰ سنت) امضای اصلی دستگاه شور و آواز ابوعطاست.',
  },
  {
    id: 'neutral_third',
    labelFa: 'سوم خنثی / کُرُن (۳۵۰ سنت — سه‌گاه)',
    notes: [
      { letter: 'C', accidental: 'natural', octave: 4 },
      { letter: 'E', accidental: 'koron', octave: 4 },
    ],
    hintFa: 'نه سوم کوچک است و نه سوم بزرگ — دقیقاً بین آن دو (می کُرُن)',
    explanationFa: 'سوم خنثی (۳۵۰ سنت) ستون اصلی سه‌گاه، چهارگاه و دانگ دوم شور است.',
  },
  {
    id: 'minor_third',
    labelFa: 'سوم کوچک (۳۰۰ سنت — دشتی/اصفهان)',
    notes: [
      { letter: 'G', accidental: 'natural', octave: 4 },
      { letter: 'B', accidental: 'flat', octave: 4 },
    ],
    hintFa: 'فاصله سل تا سی بمل — حسی نرم و حزن‌انگیز بدون ربع‌پرده',
    explanationFa: 'سوم کوچک دقیقاً ۳۰۰ سنت است و در بیات ترک و بیات اصفهان نقشی کلیدی دارد.',
  },
  {
    id: 'major_third',
    labelFa: 'سوم بزرگ (۴۰۰ سنت — ماهور)',
    notes: [
      { letter: 'C', accidental: 'natural', octave: 4 },
      { letter: 'E', accidental: 'natural', octave: 4 },
    ],
    hintFa: 'روشن، شفاف و استوار (دو تا می بکار در درآمد ماهور)',
    explanationFa: 'سوم بزرگ ۴۰۰ سنت است و به دستگاه ماهور و راست‌پنجگاه حس باوقار و روشن می‌دهد.',
  },
  {
    id: 'augmented_second',
    labelFa: 'دوم بیش‌افزوده (۲۵۰ تا ۳۰۰ سنت — همایون)',
    notes: [
      { letter: 'A', accidental: 'koron', octave: 4 },
      { letter: 'B', accidental: 'natural', octave: 4 },
    ],
    hintFa: 'جهش عاطفی و کشش‌دار میان لا کُرُن و سی بکار در همایون و چهارگاه',
    explanationFa: 'فاصله بین درجه دوم کُرُن و سوم بکار، شاخص‌ترین ویژگی همایون و چهارگاه است.',
  },
  {
    id: 'perfect_fifth',
    labelFa: 'پنجم درست (۷۰۰ سنت — شاهد اوج)',
    notes: [
      { letter: 'G', accidental: 'natural', octave: 4 },
      { letter: 'D', accidental: 'natural', octave: 5 },
    ],
    hintFa: 'فاصله‌ای بسیار مطبوع و گشاده (سل تا رِ — نسبت ۳ به ۲)',
    explanationFa: 'پنجم درست (۷۰۰ سنت) محور بسیاری از اوج‌ها مانند دشتی و عشاق است.',
  },
];

export const DICTATION_PAD_NOTES: PersianNoteSpec[] = [
  { letter: 'G', accidental: 'natural', octave: 4 },
  { letter: 'A', accidental: 'koron', octave: 4 },
  { letter: 'B', accidental: 'flat', octave: 4 },
  { letter: 'B', accidental: 'natural', octave: 4 },
  { letter: 'C', accidental: 'natural', octave: 5 },
  { letter: 'D', accidental: 'natural', octave: 5 },
  { letter: 'E', accidental: 'koron', octave: 5 },
];

export function generateIntervalExercise(seedIndex: number): EarExercise {
  const idx = Math.abs(seedIndex) % PERSIAN_INTERVAL_SPECS.length;
  const target = PERSIAN_INTERVAL_SPECS[idx];
  const distractors = PERSIAN_INTERVAL_SPECS.filter((s) => s.id !== target.id);
  const chosen = [
    target,
    distractors[idx % distractors.length],
    distractors[(idx + 2) % distractors.length],
    distractors[(idx + 3) % distractors.length],
  ];
  // Deterministic shuffle based on seedIndex
  chosen.sort((a, b) => ((a.id.charCodeAt(0) + seedIndex * 7) % 19) - ((b.id.charCodeAt(0) + seedIndex * 7) % 19));

  return {
    id: `int_${target.id}_${seedIndex}`,
    mode: 'interval',
    promptFa: 'این فاصله ایرانی را بشنوید و نوع دقیق آن را انتخاب کنید:',
    hintFa: target.hintFa,
    notes: target.notes,
    options: chosen.map((c) => ({ id: c.id, labelFa: c.labelFa })),
    correctOptionId: target.id,
    explanationFa: target.explanationFa,
  };
}

export function generateDastgahExercise(seedIndex: number, isPro: boolean): EarExercise {
  const pool = isPro ? RADIF_SYSTEMS : RADIF_SYSTEMS.filter((s) => s.isFree);
  const idx = Math.abs(seedIndex) % pool.length;
  const target = pool[idx];
  const daramad = target.gushehs[0];
  const others = pool.filter((s) => s.id !== target.id);
  const optionsPool = [target, ...others.slice(0, Math.min(3, others.length))];
  optionsPool.sort(
    (a, b) =>
      ((a.id.charCodeAt(0) + seedIndex * 11) % 23) -
      ((b.id.charCodeAt(0) + seedIndex * 11) % 23)
  );

  return {
    id: `dast_${target.id}_${seedIndex}`,
    mode: 'dastgah',
    promptFa: 'جمله ردیف زیر را بشنوید؛ متعلق به کدام دستگاه یا آواز است؟',
    hintFa: `حال‌وهوا: ${target.moodFa} • نت شاهد: ${formatNoteFa(target.shahed)}`,
    notes: daramad.melody.slice(0, 6).map((m) => ({
      letter: m.letter,
      accidental: m.accidental,
      octave: m.octave,
    })),
    options: optionsPool.map((s) => ({ id: s.id, labelFa: s.nameFa })),
    correctOptionId: target.id,
    explanationFa: `این جمله از «${daramad.nameFa}» در ${target.nameFa} است (${target.summaryFa}).`,
  };
}

export interface DictationExercise {
  id: string;
  titleFa: string;
  notes: PersianNoteSpec[];
  dastgahHintFa: string;
}

const DICTATION_MOTIFS: Array<{ titleFa: string; dastgahHintFa: string; notes: PersianNoteSpec[] }> = [
  {
    titleFa: 'انگیزه کوتاه درآمد شور',
    dastgahHintFa: 'تأکید روی سل – لا کُرُن – سی بمل – سل',
    notes: [
      { letter: 'G', accidental: 'natural', octave: 4 },
      { letter: 'A', accidental: 'koron', octave: 4 },
      { letter: 'B', accidental: 'flat', octave: 4 },
      { letter: 'G', accidental: 'natural', octave: 4 },
    ],
  },
  {
    titleFa: 'جمله سلمک / ابوعطا',
    dastgahHintFa: 'شروع از دو و نشست روی لا کُرُن',
    notes: [
      { letter: 'C', accidental: 'natural', octave: 5 },
      { letter: 'B', accidental: 'flat', octave: 4 },
      { letter: 'A', accidental: 'koron', octave: 4 },
    ],
  },
  {
    titleFa: 'انگیزه درآمد همایون',
    dastgahHintFa: 'فاصله دوم افزوده لا کُرُن تا سی بکار و دو',
    notes: [
      { letter: 'A', accidental: 'koron', octave: 4 },
      { letter: 'B', accidental: 'natural', octave: 4 },
      { letter: 'C', accidental: 'natural', octave: 5 },
      { letter: 'G', accidental: 'natural', octave: 4 },
    ],
  },
  {
    titleFa: 'اوج کوتاه دشتی',
    dastgahHintFa: 'حرکت به رِ و می کُرُن و بازگشت به دو',
    notes: [
      { letter: 'C', accidental: 'natural', octave: 5 },
      { letter: 'D', accidental: 'natural', octave: 5 },
      { letter: 'E', accidental: 'koron', octave: 5 },
      { letter: 'D', accidental: 'natural', octave: 5 },
    ],
  },
];

export function generateDictationExercise(seedIndex: number): DictationExercise {
  const motif = DICTATION_MOTIFS[Math.abs(seedIndex) % DICTATION_MOTIFS.length];
  return {
    id: `dict_${seedIndex}`,
    titleFa: motif.titleFa,
    dastgahHintFa: motif.dastgahHintFa,
    notes: motif.notes,
  };
}

export function evaluateDictationAttempt(
  target: PersianNoteSpec[],
  attempt: PersianNoteSpec[]
): { matchedCount: number; total: number; scorePercent: number; isExact: boolean } {
  const total = target.length;
  let matched = 0;
  for (let i = 0; i < total; i++) {
    if (attempt[i] && isSamePitchClass(target[i], attempt[i])) {
      matched += 1;
    }
  }
  const scorePercent = total > 0 ? Math.round((matched / total) * 100) : 0;
  return {
    matchedCount: matched,
    total,
    scorePercent,
    isExact: matched === total && attempt.length === total,
  };
}
