import { ALL_GUSHEHS, GUSHEH_BY_ID, isGushehUnlocked, SYSTEM_BY_ID } from '../data/radifData';
import type {
  Gusheh,
  LearnerLevel,
  PracticeSessionRecord,
  SrsCard,
  UserLearningState,
} from '../types/music';

const DAY_MS = 24 * 60 * 60 * 1000;

export function createInitialSrsCard(gushehId: string, now = Date.now()): SrsCard {
  return {
    gushehId,
    easeFactor: 2.5,
    intervalDays: 0,
    repetitions: 0,
    nextReviewAt: now,
    lastQuality: 0,
    updatedAt: now,
  };
}

/**
 * Converts DSP practice accuracy & foroud score into SM-2 quality grade (0..5).
 */
export function scoreToSrsQuality(accuracyPercent: number, foroudScore: number): number {
  const combined = accuracyPercent * 0.65 + foroudScore * 0.35;
  if (combined >= 92) return 5;
  if (combined >= 82) return 4;
  if (combined >= 70) return 3;
  if (combined >= 55) return 2;
  if (combined >= 35) return 1;
  return 0;
}

/**
 * Standard SuperMemo-2 (SM-2) Spaced Repetition Algorithm.
 */
export function reviewSrsCard(
  existing: SrsCard | undefined,
  gushehId: string,
  qualityInput: number,
  now = Date.now()
): SrsCard {
  const q = Math.max(0, Math.min(5, Math.round(qualityInput)));
  const card = existing ?? createInitialSrsCard(gushehId, now);

  let repetitions = card.repetitions;
  let intervalDays = card.intervalDays;
  let easeFactor = card.easeFactor;

  if (q < 3) {
    repetitions = 0;
    intervalDays = 1;
  } else {
    if (repetitions === 0) {
      intervalDays = 1;
    } else if (repetitions === 1) {
      intervalDays = 6;
    } else {
      intervalDays = Math.round(intervalDays * easeFactor);
    }
    repetitions += 1;
  }

  easeFactor = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  easeFactor = Math.max(1.3, Math.min(3.5, Math.round(easeFactor * 100) / 100));

  return {
    gushehId,
    easeFactor,
    intervalDays,
    repetitions,
    nextReviewAt: now + intervalDays * DAY_MS,
    lastQuality: q,
    updatedAt: now,
  };
}

export function getDueSrsCards(
  srsCards: Record<string, SrsCard>,
  isPro: boolean,
  now = Date.now()
): SrsCard[] {
  return Object.values(srsCards)
    .filter((card) => card.nextReviewAt <= now && isGushehUnlocked(card.gushehId, isPro))
    .sort((a, b) => a.nextReviewAt - b.nextReviewAt);
}

export interface SmartSessionRecommendation {
  gusheh: Gusheh;
  dastgahNameFa: string;
  reasonFa: string;
  focusTagFa: string;
  dueCardsCount: number;
  targetBpm: number;
}

/**
 * Deterministic "پیشنهاد هوشمند جلسه بعدی" engine:
 * Prioritizes:
 * 1) Overdue SM-2 SRS cards (lowest quality / most overdue first)
 * 2) Unlocked gushehs matching learner's weak intervals (e.g., Koron, Foroud, Tahrir)
 * 3) Level-appropriate next progression gusheh
 */
export function recommendNextSession(
  state: UserLearningState,
  isPro: boolean,
  now = Date.now()
): SmartSessionRecommendation {
  const dueCards = getDueSrsCards(state.srsCards, isPro, now);
  const unlockedGushehs = ALL_GUSHEHS.filter((g) => isGushehUnlocked(g.id, isPro));

  if (dueCards.length > 0) {
    // Pick most overdue / lowest ease card
    const ranked = [...dueCards].sort((a, b) => {
      const scoreA = a.lastQuality * 10 + a.easeFactor;
      const scoreB = b.lastQuality * 10 + b.easeFactor;
      return scoreA - scoreB;
    });
    const topCard = ranked[0];
    const gusheh = GUSHEH_BY_ID[topCard.gushehId] ?? unlockedGushehs[0];
    const sys = SYSTEM_BY_ID[gusheh.dastgahId];
    return {
      gusheh,
      dastgahNameFa: sys?.nameFa ?? 'دستگاه شور',
      reasonFa: `زمان مرور فاصله‌دار (SM-2) این گوشه فرا رسیده است تا تثبیت کوک و فرود در حافظه بلندمدت حفظ شود.`,
      focusTagFa: 'مرور سررسیدشده SRS',
      dueCardsCount: dueCards.length,
      targetBpm: gusheh.practiceLoop.defaultBpm,
    };
  }

  // Next, match learner's weak intervals (koron / foroud / tahrir / sori)
  const weakSet = new Set(state.weakIntervals);
  const targetDifficulty =
    state.level === 'beginner' ? 1 : state.level === 'intermediate' ? 2 : 3;

  const practicedIds = new Set(Object.keys(state.srsCards));

  const scored = unlockedGushehs.map((g) => {
    let score = 0;
    if (!practicedIds.has(g.id)) score += 25;
    if (g.difficulty === targetDifficulty) score += 20;
    if (g.difficulty <= targetDifficulty) score += 8;

    const hasKoron = g.scale.some((note) => note.accidental === 'koron');
    const hasTahrir = g.ornaments.includes('tahrir');
    const isForoud = g.role === 'foroud';

    if (weakSet.has('koron') && hasKoron) score += 30;
    if (weakSet.has('tahrir') && hasTahrir) score += 26;
    if (weakSet.has('foroud') && isForoud) score += 28;
    if (weakSet.has('zarbi') && g.role === 'zarbi') score += 22;

    return { gusheh: g, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const chosen = scored[0]?.gusheh ?? unlockedGushehs[0];
  const sys = SYSTEM_BY_ID[chosen.dastgahId];

  let focusTagFa = 'گام بعدی ردیف';
  let reasonFa = `متناسب با سطح ${state.level === 'beginner' ? 'مبتدی' : state.level === 'intermediate' ? 'متوسط' : 'پیشرفته'} شما برای گسترش تسلط بر ردیف.`;

  if (weakSet.has('koron') && chosen.scale.some((n) => n.accidental === 'koron')) {
    focusTagFa = 'تقویت فاصله کُرُن';
    reasonFa = 'بر اساس تحلیل آزمون و جلسات قبلی، تمرین فواصل ربع‌پرده کُرُن در این گوشه دقت کوک شما را به‌سرعت ارتقا می‌دهد.';
  } else if (weakSet.has('foroud') && chosen.role === 'foroud') {
    focusTagFa = 'تثبیت فرود و نت ایست';
    reasonFa = 'تمرکز این جلسه بر فرود دقیق و تثبیت ایست نهایی بدون لغزش زیرسنت است.';
  } else if (weakSet.has('tahrir') && chosen.ornaments.includes('tahrir')) {
    focusTagFa = 'کنترل تحریر (۶ هرتز)';
    reasonFa = 'این گوشه موقعیت‌های استاندارد تحریر را برای تمرین نوسان یکنواخت در کارگاه DSP فراهم می‌کند.';
  }

  return {
    gusheh: chosen,
    dastgahNameFa: sys?.nameFa ?? 'دستگاه شور',
    reasonFa,
    focusTagFa,
    dueCardsCount: 0,
    targetBpm: chosen.practiceLoop.defaultBpm,
  };
}

export interface DailyPlanStep {
  id: string;
  stepNumber: number;
  titleFa: string;
  subtitleFa: string;
  minutes: number;
  targetGushehId: string;
  actionMode: 'tuner' | 'srs' | 'gusheh' | 'record';
}

/**
 * Generates the adaptive 15-minute 4-step daily routine (3 + 4 + 5 + 3 = 15 minutes).
 */
export function buildDailyPracticePlan(
  state: UserLearningState,
  isPro: boolean,
  now = Date.now()
): DailyPlanStep[] {
  const smart = recommendNextSession(state, isPro, now);
  const due = getDueSrsCards(state.srsCards, isPro, now);
  const srsGusheh = due[0] ? GUSHEH_BY_ID[due[0].gushehId] : smart.gusheh;
  const sys = SYSTEM_BY_ID[smart.gusheh.dastgahId];
  const foroudGusheh =
    sys?.gushehs.find((g) => g.role === 'foroud') ?? smart.gusheh;

  return [
    {
      id: 'step-warmup-tuning',
      stepNumber: 1,
      titleFa: 'کوک ساز و گرم‌کردن شنیداری',
      subtitleFa: `بررسی کوک استاندارد ${sys?.nameFa ?? 'شور'} و کالیبراسیون نت شاهد با تیونر زنده`,
      minutes: 3,
      targetGushehId: smart.gusheh.id,
      actionMode: 'tuner',
    },
    {
      id: 'step-srs-review',
      stepNumber: 2,
      titleFa: due.length > 0 ? 'مرور فاصله‌دار کارت‌های سررسیدشده (SM-2)' : 'مرور گوشه پایه و فواصل ربع‌پرده',
      subtitleFa: `اجرای یکنواخت ${srsGusheh?.nameFa ?? smart.gusheh.nameFa} با خط حامل و عقربه سنت`,
      minutes: 4,
      targetGushehId: srsGusheh?.id ?? smart.gusheh.id,
      actionMode: 'srs',
    },
    {
      id: 'step-target-gusheh',
      stepNumber: 3,
      titleFa: `تمرین متمرکز: ${smart.gusheh.nameFa}`,
      subtitleFa: `${smart.focusTagFa} — حلقه هوشمند A–B و تکرار با استاد (کلید R)`,
      minutes: 5,
      targetGushehId: smart.gusheh.id,
      actionMode: 'gusheh',
    },
    {
      id: 'step-foroud-record',
      stepNumber: 4,
      titleFa: 'تثبیت فرود و ضبط ارزیابی پایانی',
      subtitleFa: `اجرای ${foroudGusheh.nameFa} و ثبت تحلیل کوک و بلندی در بایگانی`,
      minutes: 3,
      targetGushehId: foroudGusheh.id,
      actionMode: 'record',
    },
  ];
}

export interface BadgeInfo {
  id: string;
  titleFa: string;
  descriptionFa: string;
  icon: 'award' | 'flame' | 'sparkles' | 'music' | 'mic';
}

export const ALL_BADGES: BadgeInfo[] = [
  {
    id: 'first_session',
    titleFa: 'نخستین مضراب',
    descriptionFa: 'تکمیل اولین جلسه تمرین ثبت‌شده در نوانگار',
    icon: 'music',
  },
  {
    id: 'koron_ear',
    titleFa: 'گوش ربع‌پرده',
    descriptionFa: 'کسب دقت کوک بالای ۸۵٪ در تمرین زنده DSP',
    icon: 'sparkles',
  },
  {
    id: 'tahrir_master',
    titleFa: 'نگارنده تحریر',
    descriptionFa: 'تشخیص موفق تحریر ۶ هرتزی در کنسول زنده',
    icon: 'mic',
  },
  {
    id: 'foroud_precision',
    titleFa: 'فرود استوار',
    descriptionFa: 'کسب امتیاز فرود ۹۰٪ یا بالاتر در پایان جمله',
    icon: 'award',
  },
  {
    id: 'streak_7',
    titleFa: 'مداومت هفت‌روزه',
    descriptionFa: 'حفظ زنجیره تمرین به مدت ۷ روز پیاپی',
    icon: 'flame',
  },
  {
    id: 'placement_done',
    titleFa: 'نقشه‌راه آگاهانه',
    descriptionFa: 'تکمیل آزمون تعیین سطح شنیداری و کوک صوتی',
    icon: 'award',
  },
];

export function computeEarnedBadges(
  sessions: PracticeSessionRecord[],
  streakDays: number,
  placementCompleted: boolean
): string[] {
  const earned = new Set<string>();
  if (sessions.length >= 1) earned.add('first_session');
  if (sessions.some((s) => s.accuracyPercent >= 85)) earned.add('koron_ear');
  if (sessions.some((s) => s.tahrirDetected)) earned.add('tahrir_master');
  if (sessions.some((s) => s.foroudScore >= 90)) earned.add('foroud_precision');
  if (streakDays >= 7) earned.add('streak_7');
  if (placementCompleted) earned.add('placement_done');
  return Array.from(earned);
}

export function deriveLevelFromPlacement(earScore: number, pitchScore: number): LearnerLevel {
  const avg = earScore * 0.5 + pitchScore * 0.5;
  if (avg >= 80) return 'advanced';
  if (avg >= 55) return 'intermediate';
  return 'beginner';
}
