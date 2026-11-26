import React, { useState } from 'react';
import {
  CheckCircle2,
  Compass,
  Lock,
  Play,
  Sparkles,
} from 'lucide-react';
import {
  evaluateLearningPathProgress,
  GUIDED_LEARNING_PATHS,
  type LearningPathStep,
} from '../data/learningPaths';
import type { UserLearningState } from '../types/music';
import { toPersianDigits } from '../utils/persian';

interface LearningPathsPanelProps {
  userState: UserLearningState;
  isPro: boolean;
  onStartStepInStudio: (systemId: string, gushehId: string) => void;
  onToggleStepCompleted: (stepId: string) => void;
  onRequestUpgrade: () => void;
}

export const LearningPathsPanel: React.FC<LearningPathsPanelProps> = ({
  userState,
  isPro,
  onStartStepInStudio,
  onToggleStepCompleted,
  onRequestUpgrade,
}) => {
  const [selectedPathId, setSelectedPathId] = useState<string>(
    GUIDED_LEARNING_PATHS[0].id
  );

  const activePath =
    GUIDED_LEARNING_PATHS.find((p) => p.id === selectedPathId) ??
    GUIDED_LEARNING_PATHS[0];
  const progress = evaluateLearningPathProgress(activePath, userState);
  const locked = activePath.isPro && !isPro;

  const handleStepAction = (step: LearningPathStep) => {
    if (locked) {
      onRequestUpgrade();
      return;
    }
    onStartStepInStudio(step.systemId, step.gushehId);
  };

  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/85">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-300">
            <Compass className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
              مسیرهای یادگیری ساختارمند ۳۰ روزه (نقشه راه هنرجو)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              برنامه گام‌به‌گام تسلط بر دستگاه‌ها با هدف دقت کوک و تکمیل خودکار پس از هر جلسه استودیو
            </p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1 rounded-full bg-teal-500/12 px-3 py-1 text-xs font-extrabold text-teal-700 dark:text-teal-300">
          <Sparkles className="h-3.5 w-3.5" />
          پیشرفت مسیر فعال: {toPersianDigits(progress.completedCount)} از{' '}
          {toPersianDigits(progress.totalCount)} ایستگاه ({toPersianDigits(progress.percent)}٪)
        </span>
      </div>

      {/* 3 Guided Path Selector Cards */}
      <div className="mt-4 grid grid-cols-1 gap-2.5 md:grid-cols-3">
        {GUIDED_LEARNING_PATHS.map((path) => {
          const prog = evaluateLearningPathProgress(path, userState);
          const isSelected = path.id === activePath.id;
          const isPathLocked = path.isPro && !isPro;
          return (
            <button
              key={path.id}
              type="button"
              onClick={() => setSelectedPathId(path.id)}
              className={`rounded-2xl border p-3.5 text-right transition ${
                isSelected
                  ? 'border-teal-500 bg-teal-500/8 shadow-sm'
                  : 'border-slate-200 bg-slate-50/70 hover:border-teal-300 dark:border-slate-800 dark:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                  {path.levelBadgeFa}
                </span>
                {isPathLocked && <Lock className="h-3.5 w-3.5 text-amber-500" />}
              </div>
              <div className="mt-2 text-xs font-extrabold text-slate-900 dark:text-white">
                {path.titleFa}
              </div>
              <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                {path.durationFa}
              </div>
              <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${prog.percent}%`,
                    backgroundColor: path.accentColor,
                  }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* Active Path Description + Steps */}
      <p className="mt-3 text-xs text-slate-600 dark:text-slate-300">
        {activePath.subtitleFa}
      </p>

      <div className="mt-3 grid grid-cols-1 gap-2.5 md:grid-cols-2 lg:grid-cols-3">
        {activePath.steps.map((step, idx) => {
          const done = progress.completedStepIds.has(step.id);
          return (
            <div
              key={step.id}
              className={`flex flex-col justify-between rounded-2xl border p-3.5 transition ${
                done
                  ? 'border-emerald-500/40 bg-emerald-500/8'
                  : 'border-slate-200/80 bg-slate-50/75 dark:border-slate-800 dark:bg-slate-800/45'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-lg bg-slate-200/80 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                    ایستگاه {toPersianDigits(idx + 1)} • {step.dayRangeFa}
                  </span>
                  <button
                    type="button"
                    onClick={() => onToggleStepCompleted(step.id)}
                    className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold transition ${
                      done
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300'
                    }`}
                    title="تغییر وضعیت تکمیل ایستگاه"
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    {done ? 'تکمیل شد' : 'تیک تکمیل'}
                  </button>
                </div>

                <h3 className="mt-2 text-xs font-extrabold text-slate-900 dark:text-white">
                  {step.titleFa}
                </h3>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                  {step.goalFa}
                </p>
                <p className="mt-1.5 rounded-lg bg-white/70 p-2 text-[10px] text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                  نکته استاد: {step.practiceTipFa}
                </p>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-200/70 pt-2.5 dark:border-slate-700/70">
                <span className="text-[10px] font-bold text-slate-500">
                  هدف دقت: {toPersianDigits(step.targetAccuracy)}٪ • {toPersianDigits(step.recommendedBpm)} BPM
                </span>
                <button
                  type="button"
                  onClick={() => handleStepAction(step)}
                  className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-[11px] font-bold text-white transition ${
                    locked
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-teal-600 hover:bg-teal-700'
                  }`}
                >
                  {locked ? (
                    <Lock className="h-3 w-3" />
                  ) : (
                    <Play className="h-3 w-3" />
                  )}
                  {locked ? 'نسخه پرو' : 'تمرین در استودیو'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
