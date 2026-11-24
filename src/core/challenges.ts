import type { PracticeSessionRecord, UserLearningState } from '../types/music';
import {
  dateToJalali,
  formatJalaliShortFa,
  JALALI_MONTH_NAMES_FA,
  toIsoDateKey,
} from '../utils/jalali';

export interface HeatmapDayCell {
  dateKey: string;
  jalaliLabelFa: string;
  monthLabelFa: string;
  minutes: number;
  sessionsCount: number;
  intensity: 0 | 1 | 2 | 3 | 4;
  isFrozen: boolean;
  isToday: boolean;
}

/**
 * Generates an 84-day (12-week) Jalali (Shamsi) calendar practice heatmap.
 */
export function buildJalaliPracticeHeatmap(
  sessions: PracticeSessionRecord[],
  frozenDateKeys: string[] = [],
  nowMs = Date.now(),
  totalDays = 84
): HeatmapDayCell[] {
  const minutesByDay = new Map<string, { minutes: number; count: number }>();

  for (const s of sessions) {
    const key = toIsoDateKey(new Date(s.completedAt));
    const entry = minutesByDay.get(key) ?? { minutes: 0, count: 0 };
    entry.minutes += Math.max(1, Math.round(s.durationSeconds / 60));
    entry.count += 1;
    minutesByDay.set(key, entry);
  }

  const frozenSet = new Set(frozenDateKeys);
  const today = new Date(nowMs);
  today.setHours(12, 0, 0, 0);
  const todayKey = toIsoDateKey(today);

  const cells: HeatmapDayCell[] = [];
  for (let offset = totalDays - 1; offset >= 0; offset--) {
    const d = new Date(today.getTime() - offset * 86_400_000);
    const key = toIsoDateKey(d);
    const stats = minutesByDay.get(key);
    const minutes = stats?.minutes ?? 0;
    const intensity: 0 | 1 | 2 | 3 | 4 =
      minutes === 0 ? 0 : minutes < 5 ? 1 : minutes < 15 ? 2 : minutes < 30 ? 3 : 4;
    const jalali = dateToJalali(d);

    cells.push({
      dateKey: key,
      jalaliLabelFa: formatJalaliShortFa(d),
      monthLabelFa: JALALI_MONTH_NAMES_FA[jalali.jm - 1],
      minutes,
      sessionsCount: stats?.count ?? 0,
      intensity,
      isFrozen: frozenSet.has(key) && minutes === 0,
      isToday: key === todayKey,
    });
  }

  return cells;
}

/**
 * Calculates active streak days with automatic Streak Freeze shield protection
 * (up to `freezesAvailable` missed days covered seamlessly).
 */
export function computeStreakWithFreeze(
  sessions: PracticeSessionRecord[],
  frozenDateKeys: string[] = [],
  freezesAvailable = 2,
  nowMs = Date.now()
): {
  streakDays: number;
  usedFreezeToday: boolean;
  protectedMissedDays: number;
  remainingFreezes: number;
} {
  const practicedDays = new Set<string>(
    sessions.map((s) => toIsoDateKey(new Date(s.completedAt)))
  );
  const explicitFrozen = new Set<string>(frozenDateKeys);

  const today = new Date(nowMs);
  today.setHours(12, 0, 0, 0);

  let streak = 0;
  let remaining = Math.max(0, freezesAvailable);
  let protectedMissedDays = 0;
  let usedFreezeToday = false;
  let pendingFreezeDays = 0;

  for (let offset = 0; offset < 365; offset++) {
    const d = new Date(today.getTime() - offset * 86_400_000);
    const key = toIsoDateKey(d);
    if (practicedDays.has(key)) {
      // Any buffered freeze days bridged a genuine gap to an older practiced day!
      if (pendingFreezeDays > 0) {
        streak += pendingFreezeDays;
        protectedMissedDays += pendingFreezeDays;
        remaining -= pendingFreezeDays;
        pendingFreezeDays = 0;
      }
      streak += 1;
    } else if (explicitFrozen.has(key)) {
      if (pendingFreezeDays > 0) {
        streak += pendingFreezeDays;
        protectedMissedDays += pendingFreezeDays;
        remaining -= pendingFreezeDays;
        pendingFreezeDays = 0;
      }
      streak += 1;
      protectedMissedDays += 1;
      if (offset === 0) usedFreezeToday = true;
    } else if (offset === 0) {
      // Today hasn't ended yet — don't break streak before day ends
      continue;
    } else if (streak > 0 && pendingFreezeDays < remaining) {
      // Tentatively hold a freeze shield; only commit if an older practiced day exists!
      pendingFreezeDays += 1;
    } else {
      break;
    }
  }

  return {
    streakDays: streak,
    usedFreezeToday,
    protectedMissedDays,
    remainingFreezes: remaining,
  };
}

export interface WeeklyChallengeProgress {
  id: string;
  titleFa: string;
  descriptionFa: string;
  rewardBadgeFa: string;
  current: number;
  target: number;
  completed: boolean;
  targetGushehId?: string;
}

/**
 * Computes deterministic themed Weekly Iranian Music Challenges based on user's real progress.
 */
export function evaluateWeeklyChallenges(
  state: UserLearningState,
  nowMs = Date.now()
): WeeklyChallengeProgress[] {
  const weekCutoff = nowMs - 7 * 86_400_000;
  const recentSessions = state.sessions.filter((s) => s.completedAt >= weekCutoff);

  const shurKoronSessions = recentSessions.filter(
    (s) => (s.dastgahId === 'shur' || s.dastgahId === 'abuata') && s.accuracyPercent >= 80
  ).length;

  const foroudMasterSessions = recentSessions.filter((s) => s.foroudScore >= 85).length;

  const earCorrect = state.earTrainingStats?.totalCorrect ?? 0;

  const totalPracticeDaysThisWeek = new Set(
    recentSessions.map((s) => toIsoDateKey(new Date(s.completedAt)))
  ).size;

  return [
    {
      id: 'wk_shur_koron',
      titleFa: 'چالش ۷ روزه تثبیت کُرُن شور و ابوعطا',
      descriptionFa: '۳ جلسه تمرین در شور یا ابوعطا با دقت کوک بالای ۸۰٪ ثبت کنید.',
      rewardBadgeFa: 'نشان طلایی کُرُن‌شناس',
      current: Math.min(3, shurKoronSessions),
      target: 3,
      completed: shurKoronSessions >= 3,
      targetGushehId: 'shur-daramad-1',
    },
    {
      id: 'wk_foroud_mastery',
      titleFa: 'تسلط بر فرود اصیل دستگاه‌ها',
      descriptionFa: 'در ۲ جلسه تمرین امتیاز فرود ۸۵٪ یا بالاتر بگیرید.',
      rewardBadgeFa: 'استاد فرود و ایست',
      current: Math.min(2, foroudMasterSessions),
      target: 2,
      completed: foroudMasterSessions >= 2,
      targetGushehId: 'mahur-daramad',
    },
    {
      id: 'wk_ear_lab',
      titleFa: 'چالش آکادمی تربیت گوش ربع‌پرده',
      descriptionFa: '۵ پاسخ صحیح در آزمایشگاه تربیت گوش ربع‌پرده ثبت کنید.',
      rewardBadgeFa: 'گوش ربع‌پرده دقیق',
      current: Math.min(5, earCorrect),
      target: 5,
      completed: earCorrect >= 5,
    },
    {
      id: 'wk_habit_days',
      titleFa: 'مداومت ۵ روزه هفته جاری',
      descriptionFa: 'در ۵ روز متفاوت از هفته جاری دست‌کم یک تمرین در نوانگار انجام دهید.',
      rewardBadgeFa: 'هم‌نفس با ردیف',
      current: Math.min(5, totalPracticeDaysThisWeek),
      target: 5,
      completed: totalPracticeDaysThisWeek >= 5,
      targetGushehId: 'shur-shahnaz',
    },
  ];
}
