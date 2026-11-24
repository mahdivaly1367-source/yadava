import React, { useMemo } from 'react';
import { Calendar, Flame, Play, ShieldCheck, Trophy } from 'lucide-react';
import {
  buildJalaliPracticeHeatmap,
  computeStreakWithFreeze,
  evaluateWeeklyChallenges,
} from '../core/challenges';
import type { UserLearningState } from '../types/music';
import { formatJalaliFullFa } from '../utils/jalali';
import { toPersianDigits } from '../utils/persian';

interface PracticeHeatmapAndChallengesProps {
  userState: UserLearningState;
  onActivateFreezeToday: () => void;
  onStartChallengeGusheh: (gushehId: string) => void;
}

const INTENSITY_CLASSES: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'bg-slate-200/80 dark:bg-slate-800',
  1: 'bg-teal-300/70 dark:bg-teal-900',
  2: 'bg-teal-500/80 dark:bg-teal-700',
  3: 'bg-teal-600 dark:bg-teal-500',
  4: 'bg-amber-400 dark:bg-amber-400',
};

export const PracticeHeatmapAndChallenges: React.FC<PracticeHeatmapAndChallengesProps> = ({
  userState,
  onActivateFreezeToday,
  onStartChallengeGusheh,
}) => {
  const freezesRemaining = userState.streakFreezesRemaining ?? 2;
  const frozenDates = useMemo(
    () => userState.frozenDateKeys ?? [],
    [userState.frozenDateKeys]
  );

  const heatmap = useMemo(
    () => buildJalaliPracticeHeatmap(userState.sessions, frozenDates),
    [userState.sessions, frozenDates]
  );

  const streakInfo = useMemo(
    () => computeStreakWithFreeze(userState.sessions, frozenDates, freezesRemaining),
    [userState.sessions, frozenDates, freezesRemaining]
  );

  const challenges = useMemo(() => evaluateWeeklyChallenges(userState), [userState]);

  const weeks: typeof heatmap[] = [];
  for (let i = 0; i < heatmap.length; i += 7) {
    weeks.push(heatmap.slice(i, i + 7));
  }

  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      {/* Jalali Practice Heatmap + Streak Freeze */}
      <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-sm lg:col-span-7 dark:border-slate-800 dark:bg-slate-900/85">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-teal-500" />
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
                تقویم حرارتی تمرین (۱۲ هفته شمسی)
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                امروز: {formatJalaliFullFa(new Date())} • مداومت موثر:{' '}
                <strong className="text-amber-600 dark:text-amber-300">
                  {toPersianDigits(Math.max(userState.streakDays, streakInfo.streakDays))} روز
                </strong>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-xl bg-sky-500/15 px-2.5 py-1 text-[11px] font-bold text-sky-700 dark:text-sky-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              محافظ استریک: {toPersianDigits(freezesRemaining)} سپر
            </span>
            <button
              type="button"
              disabled={freezesRemaining <= 0 || streakInfo.usedFreezeToday}
              onClick={onActivateFreezeToday}
              className="rounded-xl border border-sky-500/40 bg-sky-500/10 px-2.5 py-1 text-[11px] font-extrabold text-sky-700 transition hover:bg-sky-500/20 disabled:opacity-45 dark:text-sky-300"
            >
              {streakInfo.usedFreezeToday ? 'سپر امروز فعال شد ✓' : 'فعال‌سازی سپر امروز'}
            </button>
          </div>
        </div>

        {/* 12-week RTL Heatmap Grid */}
        <div className="mt-4 overflow-x-auto pb-1">
          <div className="inline-flex gap-1.5">
            {weeks.map((week, wIdx) => (
              <div key={wIdx} className="flex flex-col gap-1.5">
                {week.map((cell) => (
                  <div
                    key={cell.dateKey}
                    title={`${cell.jalaliLabelFa} — ${
                      cell.isFrozen
                        ? 'محافظت‌شده با سپر استریک'
                        : `${toPersianDigits(cell.minutes)} دقیقه (${toPersianDigits(cell.sessionsCount)} جلسه)`
                    }`}
                    className={`h-4 w-4 rounded-[4px] transition ${
                      cell.isFrozen
                        ? 'bg-sky-400 ring-1 ring-sky-300'
                        : INTENSITY_CLASSES[cell.intensity]
                    } ${cell.isToday ? 'ring-2 ring-amber-400 ring-offset-1 dark:ring-offset-slate-900' : ''}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500 dark:text-slate-400">
          <span>هر مربع نشان‌دهنده یک روز شمسی است (موس را نگه دارید)</span>
          <div className="flex items-center gap-1.5">
            <span>کم</span>
            {([0, 1, 2, 3, 4] as const).map((lvl) => (
              <span key={lvl} className={`h-3 w-3 rounded-[3px] ${INTENSITY_CLASSES[lvl]}`} />
            ))}
            <span>زیاد</span>
            <span className="mr-2 inline-flex items-center gap-1">
              <span className="h-3 w-3 rounded-[3px] bg-sky-400" /> سپر
            </span>
          </div>
        </div>
      </div>

      {/* Weekly Themed Challenges */}
      <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-sm lg:col-span-5 dark:border-slate-800 dark:bg-slate-900/85">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
              چالش‌های هفتگی ردیف
            </h2>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-300">
            <Flame className="h-3.5 w-3.5" />
            {toPersianDigits(challenges.filter((c) => c.completed).length)} از{' '}
            {toPersianDigits(challenges.length)} تکمیل
          </span>
        </div>

        <div className="space-y-2.5">
          {challenges.map((ch) => {
            const pct = Math.round((ch.current / ch.target) * 100);
            return (
              <div
                key={ch.id}
                className={`rounded-2xl border p-3 transition ${
                  ch.completed
                    ? 'border-emerald-500/40 bg-emerald-500/10'
                    : 'border-slate-200 bg-slate-50/75 dark:border-slate-800 dark:bg-slate-800/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                      {ch.titleFa}
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                      {ch.descriptionFa}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-lg bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                    {toPersianDigits(ch.current)}/{toPersianDigits(ch.target)}
                  </span>
                </div>

                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div
                    className={`h-full rounded-full transition-all ${
                      ch.completed ? 'bg-emerald-500' : 'bg-gradient-to-l from-amber-400 to-teal-500'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <div className="mt-2 flex items-center justify-between text-[10px]">
                  <span className="font-semibold text-teal-700 dark:text-teal-300">
                    جایزه: {ch.rewardBadgeFa}
                  </span>
                  {ch.targetGushehId && !ch.completed && (
                    <button
                      type="button"
                      onClick={() => onStartChallengeGusheh(ch.targetGushehId!)}
                      className="inline-flex items-center gap-1 font-extrabold text-amber-600 hover:underline dark:text-amber-300"
                    >
                      <Play className="h-2.5 w-2.5" />
                      شروع تمرین
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
