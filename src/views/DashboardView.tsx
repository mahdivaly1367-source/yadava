import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  CheckCircle2,
  Clock,
  Compass,
  Flame,
  GraduationCap,
  Mic,
  Play,
  Share2,
  Sparkles,
  Target,
  TrendingUp,
  Volume2,
} from 'lucide-react';
import { getAudioContext, requestMicrophoneStream, stopMediaStream } from '../audio/audioContext';
import { detectPitchYin } from '../audio/dsp';
import { playPersianNote } from '../audio/karplusStrong';
import { ClassicalPiecesPanel } from '../components/ClassicalPiecesPanel';
import { EarTrainingLab } from '../components/EarTrainingLab';
import { LearningPathsPanel } from '../components/LearningPathsPanel';
import { PracticeHeatmapAndChallenges } from '../components/PracticeHeatmapAndChallenges';
import {
  EAR_PLACEMENT_QUESTIONS,
  evaluatePlacementAnswers,
  PITCH_PLACEMENT_TARGETS,
} from '../core/placement';
import {
  ALL_BADGES,
  buildDailyPracticePlan,
  getDueSrsCards,
  recommendNextSession,
} from '../core/srs';
import { formatNoteFa, noteToFrequency } from '../data/musicTheory';
import { GUSHEH_BY_ID, SYSTEM_BY_ID } from '../data/radifData';
import type {
  InstrumentId,
  KoronMode,
  PlacementResult,
  UserLearningState,
} from '../types/music';
import {
  formatDurationFa,
  INSTRUMENT_LABELS_FA,
  LEVEL_LABELS_FA,
  toPersianDigits,
} from '../utils/persian';

interface DashboardViewProps {
  userState: UserLearningState;
  isPro: boolean;
  instrument: InstrumentId;
  a4Hz: number;
  koronMode: KoronMode;
  onStartGushehPractice: (gushehId: string, focusPanel?: 'dsp' | 'tuner' | 'recorder') => void;
  onToggleDailyStep: (stepId: string) => void;
  onCompletePlacement: (result: PlacementResult) => Promise<void>;
  onRecordEarAnswer: (isCorrect: boolean) => void;
  onActivateStreakFreeze: () => void;
  onTogglePathStep: (stepId: string) => void;
  onOpenTeacherModal: () => void;
  onOpenExportModal: () => void;
  onOpenExplorer: () => void;
  onOpenOnboarding?: () => void;
  onRequestUpgrade: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  userState,
  isPro,
  instrument,
  a4Hz,
  koronMode,
  onStartGushehPractice,
  onToggleDailyStep,
  onCompletePlacement,
  onRecordEarAnswer,
  onActivateStreakFreeze,
  onTogglePathStep,
  onOpenTeacherModal,
  onOpenExportModal,
  onOpenExplorer,
  onOpenOnboarding,
  onRequestUpgrade,
}) => {
  const [placementOpen, setPlacementOpen] = useState(false);
  const [placementStep, setPlacementStep] = useState<'ear' | 'pitch' | 'done'>('ear');
  const [earAnswers, setEarAnswers] = useState<Record<string, string>>({});
  const [pitchScores, setPitchScores] = useState<Record<string, number>>({});
  const [activePitchTargetIdx, setActivePitchTargetIdx] = useState(0);
  const [micTesting, setMicTesting] = useState(false);
  const [liveTestCents, setLiveTestCents] = useState<number | null>(null);
  const [micErrorFa, setMicErrorFa] = useState<string | null>(null);
  const [latestPlacement, setLatestPlacement] = useState<PlacementResult | null>(
    userState.lastPlacement
  );

  const micStreamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const stopMicTest = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    stopMediaStream(micStreamRef.current);
    micStreamRef.current = null;
    setMicTesting(false);
  };

  useEffect(() => {
    return () => stopMicTest();
  }, []);

  const smartRec = useMemo(
    () => recommendNextSession(userState, isPro),
    [userState, isPro]
  );

  const dailyPlan = useMemo(
    () => buildDailyPracticePlan(userState, isPro),
    [userState, isPro]
  );

  const dueCount = useMemo(
    () => getDueSrsCards(userState.srsCards, isPro).length,
    [userState.srsCards, isPro]
  );

  const completedStepsCount = dailyPlan.filter((s) =>
    userState.dailyCompletedSteps.includes(s.id)
  ).length;

  const playEarPhrase = (qIdx: number) => {
    const q = EAR_PLACEMENT_QUESTIONS[qIdx];
    if (!q) return;
    q.notes.forEach((note, idx) => {
      playPersianNote(note, {
        instrument,
        durationSec: 0.55,
        a4Hz,
        koronMode,
        startTimeOffsetSec: idx * 0.45,
      });
    });
  };

  const runLivePitchTestForTarget = async (targetIdx: number) => {
    const target = PITCH_PLACEMENT_TARGETS[targetIdx];
    if (!target) return;

    setMicErrorFa(null);
    stopMicTest();

    // First play reference note clearly
    playPersianNote(target.note, {
      instrument,
      durationSec: 1.1,
      a4Hz,
      koronMode,
    });

    try {
      const stream = await requestMicrophoneStream();
      micStreamRef.current = stream;
      const ctx = getAudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);

      const buf = new Float32Array(analyser.fftSize);
      const targetFreq = noteToFrequency(target.note, a4Hz, koronMode);
      const collectedErrors: number[] = [];
      const startedAt = performance.now();
      setMicTesting(true);

      const tick = () => {
        analyser.getFloatTimeDomainData(buf);
        const yin = detectPitchYin(buf, ctx.sampleRate, { rmsThreshold: 0.015 });
        if (yin.frequency !== null && yin.clarity > 0.72) {
          let diff = 1200 * Math.log2(yin.frequency / targetFreq);
          diff = ((diff + 600) % 1200 + 1200) % 1200 - 600;
          setLiveTestCents(Math.round(diff * 10) / 10);
          collectedErrors.push(Math.abs(diff));
        }

        if (performance.now() - startedAt >= 3600 || collectedErrors.length >= 16) {
          stopMicTest();
          const avgErr =
            collectedErrors.length > 0
              ? collectedErrors.reduce((a, b) => a + b, 0) / collectedErrors.length
              : 40;
          const score = Math.max(20, Math.min(100, Math.round(100 - (avgErr / 50) * 100)));
          setPitchScores((prev) => ({ ...prev, [target.id]: score }));
          return;
        }
        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      setMicErrorFa(
        err instanceof Error
          ? err.message
          : 'دسترسی به میکروفون برقرار نشد. می‌توانید بدون میکروفون امتیاز مرحله را ثبت کنید.'
      );
      setMicTesting(false);
    }
  };

  const finishPlacement = async () => {
    stopMicTest();
    const res = evaluatePlacementAnswers({
      earAnswers,
      pitchScores,
    });
    setLatestPlacement(res);
    setPlacementStep('done');
    await onCompletePlacement(res);
  };

  return (
    <div className="space-y-6">
      {/* Hero Banner: Smart Next Session + Placement Test CTA */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="relative overflow-hidden rounded-3xl border border-teal-500/30 bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 p-6 text-white shadow-xl lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-400/20 px-3 py-1 text-xs font-bold text-teal-200">
              <Sparkles className="h-3.5 w-3.5" />
              پیشنهاد هوشمند جلسه بعدی (الگوریتم SM-2)
            </span>
            <span className="rounded-full bg-amber-400/20 px-3 py-1 text-xs font-bold text-amber-200">
              {smartRec.focusTagFa}
            </span>
          </div>

          <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">
            {smartRec.gusheh.nameFa}
          </h1>
          <p className="mt-1 text-sm font-semibold text-teal-200">
            {smartRec.dastgahNameFa} • نت شاهد: {formatNoteFa(smartRec.gusheh.shahed)} • نت ایست:{' '}
            {formatNoteFa(smartRec.gusheh.ist)}
          </p>
          <p className="mt-2.5 max-w-2xl text-xs leading-6 text-slate-300">
            {smartRec.reasonFa}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onStartGushehPractice(smartRec.gusheh.id, 'dsp')}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-l from-amber-400 to-teal-400 px-5 py-3 text-xs font-black text-slate-950 shadow-lg transition hover:opacity-95"
            >
              <Play className="h-4 w-4 fill-slate-950" />
              شروع تمرین زنده این گوشه
            </button>
            <button
              type="button"
              onClick={() => {
                setPlacementOpen((v) => !v);
                setPlacementStep('ear');
              }}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/25 bg-white/10 px-4 py-3 text-xs font-bold text-white backdrop-blur transition hover:bg-white/20"
            >
              <Target className="h-4 w-4 text-amber-300" />
              {userState.placementCompleted
                ? 'تکرار آزمون تعیین سطح'
                : 'آزمون تعیین سطح شنیداری و کوک'}
            </button>
            <button
              type="button"
              onClick={onOpenExplorer}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-white/15 px-4 py-3 text-xs font-bold text-teal-200 hover:bg-white/10"
            >
              <Compass className="h-4 w-4" />
              مرور ۱۷۳ گوشه ردیف
            </button>
            <button
              type="button"
              onClick={onOpenTeacherModal}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-amber-400/35 bg-amber-400/15 px-4 py-3 text-xs font-bold text-amber-200 hover:bg-amber-400/25"
            >
              <GraduationCap className="h-4 w-4" />
              کلاس استاد / تکلیف
            </button>
            {onOpenOnboarding && (
              <button
                type="button"
                onClick={onOpenOnboarding}
                className="inline-flex items-center gap-1.5 rounded-2xl border border-emerald-400/35 bg-emerald-400/15 px-3.5 py-3 text-xs font-bold text-emerald-200 hover:bg-emerald-400/25"
              >
                <Sparkles className="h-4 w-4" />
                تنظیم سریع (۲۰ ثانیه)
              </button>
            )}
            <button
              type="button"
              onClick={onOpenExportModal}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-white/15 bg-white/5 px-3.5 py-3 text-xs font-bold text-slate-200 hover:bg-white/15"
            >
              <Share2 className="h-4 w-4" />
              کارت پیشرفت و خروجی
            </button>
          </div>
        </div>

        {/* Summary Stats Panel */}
        <div className="grid grid-cols-2 gap-3 rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/85">
          <div className="rounded-2xl bg-slate-100/80 p-3 dark:bg-slate-800/75">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              <TrendingUp className="h-3.5 w-3.5 text-teal-500" />
              سطح فعلی
            </div>
            <div className="mt-1 text-lg font-black text-slate-900 dark:text-white">
              {LEVEL_LABELS_FA[userState.level]}
            </div>
          </div>

          <div className="rounded-2xl bg-slate-100/80 p-3 dark:bg-slate-800/75">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              <Flame className="h-3.5 w-3.5 text-amber-500" />
              زنجیره مداومت
            </div>
            <div className="mt-1 text-lg font-black text-amber-600 dark:text-amber-300">
              {toPersianDigits(userState.streakDays)} روز
            </div>
          </div>

          <div className="rounded-2xl bg-slate-100/80 p-3 dark:bg-slate-800/75">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              <Clock className="h-3.5 w-3.5 text-sky-500" />
              مجموع تمرین
            </div>
            <div className="mt-1 text-lg font-black text-slate-900 dark:text-white">
              {toPersianDigits(userState.totalPracticeMinutes)} دقیقه
            </div>
          </div>

          <div className="rounded-2xl bg-slate-100/80 p-3 dark:bg-slate-800/75">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              <Target className="h-3.5 w-3.5 text-emerald-500" />
              کارت SRS سررسید
            </div>
            <div className="mt-1 text-lg font-black text-emerald-600 dark:text-emerald-400">
              {toPersianDigits(dueCount)} گوشه
            </div>
          </div>

          <div className="col-span-2 rounded-2xl border border-teal-500/20 bg-teal-500/8 px-3 py-2 text-xs text-slate-700 dark:text-slate-200">
            میانگین دقت کوک:{' '}
            <strong className="text-teal-700 dark:text-teal-300">
              {toPersianDigits(userState.averageAccuracy)}٪
            </strong>{' '}
            • فواصل نیازمند تمرین:{' '}
            <strong className="text-amber-600 dark:text-amber-300">
              {userState.weakIntervals
                .map((w) =>
                  w === 'koron'
                    ? 'کُرُن'
                    : w === 'foroud'
                    ? 'فرود'
                    : w === 'tahrir'
                    ? 'تحریر'
                    : w
                )
                .join('، ')}
            </strong>
          </div>
        </div>
      </section>

      {/* Interactive Placement Test (Ear Training + Live Mic Pitch Intonation) */}
      {placementOpen && (
        <section className="rounded-3xl border border-amber-500/35 bg-white p-5 shadow-lg dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                آزمون تعیین سطح شنیداری و کوک صوتی (بدون اینترنت و قطعی)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                بخش ۱: تشخیص فواصل ربع‌پرده و دستگاه‌ها • بخش ۲: سنجش کوک زنده با میکروفون (YIN DSP)
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                stopMicTest();
                setPlacementOpen(false);
              }}
              className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            >
              بستن آزمون
            </button>
          </div>

          {placementStep === 'ear' && (
            <div className="mt-4 space-y-4">
              {EAR_PLACEMENT_QUESTIONS.map((q, idx) => (
                <div
                  key={q.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50/75 p-4 dark:border-slate-800 dark:bg-slate-800/50"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                      {toPersianDigits(idx + 1)}. {q.promptFa}
                    </div>
                    <button
                      type="button"
                      onClick={() => playEarPhrase(idx)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-700"
                    >
                      <Volume2 className="h-3.5 w-3.5" />
                      پخش جمله با {INSTRUMENT_LABELS_FA[instrument]}
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{q.hintFa}</p>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {q.options.map((opt) => {
                      const selected = earAnswers[q.id] === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() =>
                            setEarAnswers((prev) => ({ ...prev, [q.id]: opt.id }))
                          }
                          className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                            selected
                              ? 'border-teal-500 bg-teal-600 text-white shadow-sm'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-teal-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                          }`}
                        >
                          {opt.labelFa}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setPlacementStep('pitch')}
                  className="rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-extrabold text-slate-950 shadow hover:bg-amber-400"
                >
                  ادامه به بخش ۲: سنجش کوک با میکروفون ←
                </button>
              </div>
            </div>
          )}

          {placementStep === 'pitch' && (
            <div className="mt-4 space-y-4">
              {micErrorFa && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                  {micErrorFa}
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {PITCH_PLACEMENT_TARGETS.map((target, idx) => {
                  const score = pitchScores[target.id];
                  const isCurrent = activePitchTargetIdx === idx && micTesting;
                  return (
                    <div
                      key={target.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50/75 p-4 dark:border-slate-800 dark:bg-slate-800/50"
                    >
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        {target.promptFa}
                      </div>
                      <div className="mt-1 text-xs text-teal-600 dark:text-teal-300">
                        نت مرجع: {formatNoteFa(target.note, true)} (
                        {noteToFrequency(target.note, a4Hz, koronMode).toFixed(1)} Hz)
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setActivePitchTargetIdx(idx);
                            void runLivePitchTestForTarget(idx);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-3 py-2 text-xs font-bold text-white hover:bg-teal-700"
                        >
                          <Mic className="h-3.5 w-3.5" />
                          {isCurrent ? 'در حال گوش دادن...' : 'پخش نت و سنجش با میکروفون'}
                        </button>
                        {score !== undefined && (
                          <span className="rounded-lg bg-emerald-500/15 px-2.5 py-1 text-xs font-extrabold text-emerald-600 dark:text-emerald-300">
                            امتیاز کوک: {toPersianDigits(score)}٪
                          </span>
                        )}
                      </div>

                      {isCurrent && liveTestCents !== null && (
                        <div className="ltr-num mt-2 text-xs font-bold text-amber-600 dark:text-amber-300">
                          انحراف لحظه‌ای: {liveTestCents > 0 ? `+${liveTestCents}` : liveTestCents}¢
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    stopMicTest();
                    setPlacementStep('ear');
                  }}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300"
                >
                  → بازگشت به بخش شنیداری
                </button>
                <button
                  type="button"
                  onClick={() => void finishPlacement()}
                  className="rounded-xl bg-gradient-to-l from-amber-500 to-teal-600 px-5 py-2.5 text-xs font-extrabold text-white shadow"
                >
                  ثبت نتیجه و شخصی‌سازی برنامه روزانه
                </button>
              </div>
            </div>
          )}

          {placementStep === 'done' && latestPlacement && (
            <div className="mt-4 rounded-2xl border border-emerald-500/35 bg-emerald-500/10 p-4 text-center">
              <div className="text-sm font-extrabold text-emerald-700 dark:text-emerald-300">
                آزمون تعیین سطح با موفقیت ثبت شد!
              </div>
              <div className="mt-2 flex flex-wrap justify-center gap-4 text-xs font-bold">
                <span>امتیاز شنیداری: {toPersianDigits(latestPlacement.earScore)}٪</span>
                <span>امتیاز کوک میکروفون: {toPersianDigits(latestPlacement.pitchScore)}٪</span>
                <span>سطح پیشنهادی: {LEVEL_LABELS_FA[latestPlacement.recommendedLevel]}</span>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Adaptive 15-Minute 4-Step Daily Plan */}
      <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/85">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
              برنامه تمرین روزانه ۱۵ دقیقه‌ای تطبیقی (۴ گام)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              طراحی‌شده بر اساس کارت‌های SRS، سطح {LEVEL_LABELS_FA[userState.level]} و فواصل نیازمند تقویت
            </p>
          </div>
          <div className="rounded-full bg-teal-500/15 px-3 py-1 text-xs font-extrabold text-teal-700 dark:text-teal-300">
            پیشرفت امروز: {toPersianDigits(completedStepsCount)} از ۴ گام
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {dailyPlan.map((step) => {
            const done = userState.dailyCompletedSteps.includes(step.id);
            return (
              <div
                key={step.id}
                className={`flex flex-col justify-between rounded-2xl border p-4 transition ${
                  done
                    ? 'border-emerald-500/40 bg-emerald-500/8'
                    : 'border-slate-200 bg-slate-50/75 dark:border-slate-800 dark:bg-slate-800/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <button
                      type="button"
                      onClick={() => onToggleDailyStep(step.id)}
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition ${
                        done
                          ? 'border-emerald-500 bg-emerald-500 text-white'
                          : 'border-slate-300 bg-white text-transparent hover:border-teal-500 dark:border-slate-600 dark:bg-slate-900'
                      }`}
                      aria-label="تکمیل گام"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </button>
                    <div>
                      <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                        گام {toPersianDigits(step.stepNumber)}: {step.titleFa}
                      </div>
                      <p className="mt-1 text-[11px] leading-5 text-slate-500 dark:text-slate-400">
                        {step.subtitleFa}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-lg bg-slate-200/80 px-2 py-0.5 text-[11px] font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                    {toPersianDigits(step.minutes)} دقیقه
                  </span>
                </div>

                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() =>
                      onStartGushehPractice(
                        step.targetGushehId,
                        step.actionMode === 'tuner'
                          ? 'tuner'
                          : step.actionMode === 'record'
                          ? 'recorder'
                          : 'dsp'
                      )
                    }
                    className="inline-flex items-center gap-1 rounded-xl bg-teal-600/15 px-3 py-1.5 text-xs font-bold text-teal-700 transition hover:bg-teal-600 hover:text-white dark:text-teal-300"
                  >
                    <Play className="h-3 w-3" />
                    شروع در کارگاه تمرین
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Feature 3: Microtonal Ear Training Academy */}
      <EarTrainingLab
        isPro={isPro}
        instrument={instrument}
        a4Hz={a4Hz}
        koronMode={koronMode}
        stats={
          userState.earTrainingStats ?? {
            totalAnswered: 0,
            totalCorrect: 0,
            bestStreak: 0,
            completedSessions: 0,
          }
        }
        onRecordAnswer={onRecordEarAnswer}
      />

      {/* Feature 12: Jalali Practice Heatmap, Streak Freeze & Weekly Challenges */}
      <PracticeHeatmapAndChallenges
        userState={userState}
        onActivateFreezeToday={onActivateStreakFreeze}
        onStartChallengeGusheh={(gid) => onStartGushehPractice(gid, 'dsp')}
      />

      {/* Phase-2 Feature 10: Guided 30-Day Learning Paths */}
      <LearningPathsPanel
        userState={userState}
        isPro={isPro}
        onStartStepInStudio={(_sysId, gid) => onStartGushehPractice(gid, 'dsp')}
        onToggleStepCompleted={onTogglePathStep}
        onRequestUpgrade={onRequestUpgrade}
      />

      {/* Phase-2 Feature 11: Classical Rhythmic Pieces (Tasnif, Pishdaramad, Chaharmezrab, Reng) */}
      <ClassicalPiecesPanel
        instrument={instrument}
        a4Hz={a4Hz}
        koronMode={koronMode}
        isPro={isPro}
        onRequestUpgrade={onRequestUpgrade}
      />

      {/* Badges & Session History */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Achievements */}
        <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/85">
          <div className="mb-3 flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-500" />
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
              نشان‌های افتخار ردیف ({toPersianDigits(userState.badges.length)} از{' '}
              {toPersianDigits(ALL_BADGES.length)})
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {ALL_BADGES.map((b) => {
              const unlocked = userState.badges.includes(b.id);
              return (
                <div
                  key={b.id}
                  className={`rounded-2xl border p-3 text-center transition ${
                    unlocked
                      ? 'border-amber-400/50 bg-amber-500/10'
                      : 'border-slate-200/70 bg-slate-100/60 opacity-55 dark:border-slate-800 dark:bg-slate-800/40'
                  }`}
                >
                  <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-300">
                    <Award className="h-5 w-5" />
                  </div>
                  <div className="mt-2 text-xs font-bold text-slate-900 dark:text-white">
                    {b.titleFa}
                  </div>
                  <p className="mt-0.5 text-[10px] leading-4 text-slate-500 dark:text-slate-400">
                    {b.descriptionFa}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Practice History */}
        <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/85">
          <h2 className="mb-3 text-sm font-extrabold text-slate-900 dark:text-white">
            تاریخچه جلسات اخیر ({toPersianDigits(userState.sessions.length)})
          </h2>
          {userState.sessions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
              هنوز جلسه‌ای ثبت نشده است. پس از تمرین در کارگاه، دکمه «ثبت پایان جلسه» را بزنید تا
              پیشرفت و کارت مرور SM-2 شما ذخیره شود.
            </div>
          ) : (
            <div className="max-h-72 space-y-2 overflow-y-auto pl-1">
              {userState.sessions.slice(0, 12).map((s) => {
                const g = GUSHEH_BY_ID[s.gushehId];
                const sys = SYSTEM_BY_ID[s.dastgahId];
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/75 px-3 py-2.5 text-xs dark:border-slate-800 dark:bg-slate-800/50"
                  >
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">
                        {g?.nameFa ?? s.gushehId}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {sys?.nameFa} • {INSTRUMENT_LABELS_FA[s.instrument]} •{' '}
                        {formatDurationFa(s.durationSeconds)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-left">
                      <span className="rounded-lg bg-teal-500/15 px-2 py-0.5 font-extrabold text-teal-700 dark:text-teal-300">
                        کوک {toPersianDigits(s.accuracyPercent)}٪
                      </span>
                      <span className="rounded-lg bg-emerald-500/15 px-2 py-0.5 font-bold text-emerald-700 dark:text-emerald-300">
                        فرود {toPersianDigits(s.foroudScore)}٪
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
