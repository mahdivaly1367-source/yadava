import type { LearnerLevel, PersianNoteSpec, PlacementResult } from '../types/music';
import { deriveLevelFromPlacement } from './srs';

export interface EarPlacementQuestion {
  id: string;
  promptFa: string;
  hintFa: string;
  notes: PersianNoteSpec[];
  options: Array<{ id: string; labelFa: string }>;
  correctOptionId: string;
  intervalTag: string; // e.g., 'koron', 'foroud', 'tahrir', 'sori'
}

export interface PitchPlacementTarget {
  id: string;
  promptFa: string;
  note: PersianNoteSpec;
  intervalTag: string;
}

export const EAR_PLACEMENT_QUESTIONS: EarPlacementQuestion[] = [
  {
    id: 'ear-q1-koron',
    promptFa: 'این جمله کوتاه با فاصله ربع‌پرده (لا کُرُن) متعلق به کدام نظام است؟',
    hintFa: 'به فاصله نزدیک و سوزناک دوم کُرُن گوش دهید.',
    notes: [
      { letter: 'G', accidental: 'natural', octave: 4 },
      { letter: 'A', accidental: 'koron', octave: 4 },
      { letter: 'B', accidental: 'flat', octave: 4 },
      { letter: 'A', accidental: 'koron', octave: 4 },
      { letter: 'G', accidental: 'natural', octave: 4 },
    ],
    options: [
      { id: 'shur', labelFa: 'دستگاه شور (لا کُرُن)' },
      { id: 'mahur', labelFa: 'دستگاه ماهور (بکار)' },
      { id: 'chahargah', labelFa: 'دستگاه چهارگاه' },
    ],
    correctOptionId: 'shur',
    intervalTag: 'koron',
  },
  {
    id: 'ear-q2-mahur',
    promptFa: 'این حرکت روشن و بدون ربع‌پرده در کدام دستگاه نواخته می‌شود؟',
    hintFa: 'ساختار گام بزرگ بدون کُرُن و سُری.',
    notes: [
      { letter: 'C', accidental: 'natural', octave: 4 },
      { letter: 'D', accidental: 'natural', octave: 4 },
      { letter: 'E', accidental: 'natural', octave: 4 },
      { letter: 'F', accidental: 'natural', octave: 4 },
      { letter: 'G', accidental: 'natural', octave: 4 },
      { letter: 'C', accidental: 'natural', octave: 4 },
    ],
    options: [
      { id: 'abuata', labelFa: 'آواز ابوعطا' },
      { id: 'mahur', labelFa: 'دستگاه ماهور' },
      { id: 'homayun', labelFa: 'دستگاه همایون' },
    ],
    correctOptionId: 'mahur',
    intervalTag: 'foroud',
  },
  {
    id: 'ear-q3-homayun',
    promptFa: 'این فاصله متمایز و شاهانه (۵/۴ پرده میان لا کُرُن تا سی بکار) نشانه چیست؟',
    hintFa: 'جهش دراماتیک روی درجه سوم بکار.',
    notes: [
      { letter: 'G', accidental: 'natural', octave: 4 },
      { letter: 'A', accidental: 'koron', octave: 4 },
      { letter: 'B', accidental: 'natural', octave: 4 },
      { letter: 'C', accidental: 'natural', octave: 5 },
      { letter: 'B', accidental: 'natural', octave: 4 },
      { letter: 'A', accidental: 'koron', octave: 4 },
      { letter: 'G', accidental: 'natural', octave: 4 },
    ],
    options: [
      { id: 'shur', labelFa: 'دستگاه شور' },
      { id: 'homayun', labelFa: 'دستگاه همایون' },
      { id: 'mahur', labelFa: 'دستگاه ماهور' },
    ],
    correctOptionId: 'homayun',
    intervalTag: 'koron',
  },
  {
    id: 'ear-q4-foroud',
    promptFa: 'این جمله در آواز ابوعطا روی کدام نت ایست می‌کند؟',
    hintFa: 'به نت پایانی پس از شاهد دو دقت کنید.',
    notes: [
      { letter: 'C', accidental: 'natural', octave: 5 },
      { letter: 'B', accidental: 'flat', octave: 4 },
      { letter: 'A', accidental: 'koron', octave: 4 },
      { letter: 'G', accidental: 'natural', octave: 4 },
    ],
    options: [
      { id: 'foroud', labelFa: 'فرود به نت پایه سل شور' },
      { id: 'owj', labelFa: 'صعود به اوج حجاز' },
      { id: 'zarbi', labelFa: 'الگوی ضربی رِنگ' },
    ],
    correctOptionId: 'foroud',
    intervalTag: 'foroud',
  },
];

export const PITCH_PLACEMENT_TARGETS: PitchPlacementTarget[] = [
  {
    id: 'pitch-t1-g4',
    promptFa: 'نت شاهد شور (سل ۴) را با آواز یا ساز بنوازید',
    note: { letter: 'G', accidental: 'natural', octave: 4 },
    intervalTag: 'foroud',
  },
  {
    id: 'pitch-t2-ak4',
    promptFa: 'نت ربع‌پرده لا کُرُن ۴ (-50¢) را با دقت کوک اجرا کنید',
    note: { letter: 'A', accidental: 'koron', octave: 4 },
    intervalTag: 'koron',
  },
];

export function evaluatePlacementAnswers(params: {
  earAnswers: Record<string, string>;
  pitchScores: Record<string, number>; // targetId -> 0..100
  now?: number;
}): PlacementResult {
  const now = params.now ?? Date.now();
  let earCorrect = 0;
  const weakSet = new Set<string>();

  for (const q of EAR_PLACEMENT_QUESTIONS) {
    if (params.earAnswers[q.id] === q.correctOptionId) {
      earCorrect += 1;
    } else {
      weakSet.add(q.intervalTag);
    }
  }

  const earScore = Math.round((earCorrect / EAR_PLACEMENT_QUESTIONS.length) * 100);

  const pitchVals = PITCH_PLACEMENT_TARGETS.map((t) => {
    const sc = params.pitchScores[t.id] ?? 0;
    if (sc < 75) weakSet.add(t.intervalTag);
    return sc;
  });

  const pitchScore =
    pitchVals.length > 0
      ? Math.round(pitchVals.reduce((a, b) => a + b, 0) / pitchVals.length)
      : 0;

  if (earScore < 75) weakSet.add('tahrir');
  if (weakSet.size === 0) weakSet.add('tahrir');

  const recommendedLevel: LearnerLevel = deriveLevelFromPlacement(earScore, pitchScore);

  return {
    id: `placement_${now}`,
    earScore,
    pitchScore,
    recommendedLevel,
    weakIntervals: Array.from(weakSet),
    completedAt: now,
  };
}
