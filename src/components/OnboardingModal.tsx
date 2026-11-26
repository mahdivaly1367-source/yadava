import React, { useState } from 'react';
import { Check, Clock, GraduationCap, Music2, Sparkles, X } from 'lucide-react';
import type { InstrumentId, LearnerLevel } from '../types/music';
import { ALL_INSTRUMENT_IDS, INSTRUMENT_LABELS_FA, toPersianDigits } from '../utils/persian';

export interface OnboardingProfile {
  instrument: InstrumentId;
  level: LearnerLevel;
  dailyMinutesGoal: 10 | 15 | 30;
  completedAtIso: string;
}

const ONBOARDING_STORAGE_KEY = 'navanegar_onboarding_profile_v1';

export function loadOnboardingProfile(): OnboardingProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as OnboardingProfile) : null;
  } catch {
    return null;
  }
}

export function saveOnboardingProfile(profile: OnboardingProfile): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // ignore
  }
}

interface OnboardingModalProps {
  open: boolean;
  initialInstrument: InstrumentId;
  onClose: () => void;
  onComplete: (profile: OnboardingProfile) => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  open,
  initialInstrument,
  onClose,
  onComplete,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [instrument, setInstrument] = useState<InstrumentId>(initialInstrument);
  const [level, setLevel] = useState<LearnerLevel>('beginner');
  const [dailyMinutesGoal, setDailyMinutesGoal] = useState<10 | 15 | 30>(15);

  if (!open) return null;

  const handleFinish = () => {
    const profile: OnboardingProfile = {
      instrument,
      level,
      dailyMinutesGoal,
      completedAtIso: new Date().toISOString(),
    };
    saveOnboardingProfile(profile);
    onComplete(profile);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="خوش‌آمدگویی سریع نوانگار"
    >
      <div className="w-full max-w-lg rounded-3xl border border-teal-500/30 bg-white p-5 shadow-2xl dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-teal-600 text-white">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                تنظیم سریع استودیوی شخصی نوانگار
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                گام {toPersianDigits(step)} از ۳ • کمتر از ۲۰ ثانیه
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن خوش‌آمدگویی"
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step Progress Bar */}
        <div className="mb-5 flex gap-1.5">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition ${
                s <= step ? 'bg-teal-500' : 'bg-slate-200 dark:bg-slate-800'
              }`}
            />
          ))}
        </div>

        {/* Step 1: Instrument */}
        {step === 1 && (
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800 dark:text-slate-100">
              <Music2 className="h-4 w-4 text-teal-600" />
              ساز اصلی خود را انتخاب کنید (۷ ساز اصیل ایرانی):
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ALL_INSTRUMENT_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setInstrument(id)}
                  className={`rounded-2xl border p-3 text-center text-xs font-black transition cursor-pointer ${
                    instrument === id
                      ? 'border-teal-500 bg-teal-600 text-white shadow-md'
                      : 'border-slate-200 bg-slate-50 text-slate-800 hover:border-teal-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
                  }`}
                >
                  {INSTRUMENT_LABELS_FA[id]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Skill Level */}
        {step === 2 && (
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800 dark:text-slate-100">
              <GraduationCap className="h-4 w-4 text-teal-600" />
              سطح آشنایی شما با ردیف موسیقی ایرانی چقدر است؟
            </div>
            <div className="space-y-2">
              {[
                {
                  id: 'beginner' as const,
                  title: 'مبتدی (شروع درآمد شور و سه‌گاه)',
                  desc: 'تمرکز روی کوک درست، آشنایی با ربع‌پرده کرن و گوشه‌های پایه',
                },
                {
                  id: 'intermediate' as const,
                  title: 'متوسط (آشنا با چند دستگاه و مضراب‌ها)',
                  desc: 'تمرین زینت‌های زنده، تقطیع عروضی و گذر به آوازها',
                },
                {
                  id: 'advanced' as const,
                  title: 'پیشرفته (بداهه‌نوازی، مرکب‌خوانی و ردیف کامل)',
                  desc: 'آزمون شنیداری ۱۲ دستگاه، مقایسه روایت‌ها و بداهه‌نوازی سؤال و جواب',
                },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setLevel(opt.id)}
                  className={`w-full rounded-2xl border p-3 text-right transition cursor-pointer ${
                    level === opt.id
                      ? 'border-teal-500 bg-teal-50 dark:bg-teal-950/40'
                      : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/60'
                  }`}
                >
                  <div className="text-xs font-black text-slate-900 dark:text-white">{opt.title}</div>
                  <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Daily Practice Goal */}
        {step === 3 && (
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800 dark:text-slate-100">
              <Clock className="h-4 w-4 text-teal-600" />
              هدف تمرین روزانه شما چند دقیقه است؟
            </div>
            <div className="grid grid-cols-3 gap-2">
              {([10, 15, 30] as const).map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setDailyMinutesGoal(mins)}
                  className={`rounded-2xl border p-4 text-center transition cursor-pointer ${
                    dailyMinutesGoal === mins
                      ? 'border-teal-500 bg-teal-600 text-white shadow-md'
                      : 'border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
                  }`}
                >
                  <div className="text-xl font-black">{toPersianDigits(mins)}</div>
                  <div className="text-[11px] font-bold opacity-85">دقیقه در روز</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer Controls */}
        <div className="mt-6 flex items-center justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s === 3 ? 2 : 1))}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
            >
              مرحله قبل
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-3 py-2 text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              رد کردن
            </button>
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s === 1 ? 2 : 3))}
              className="rounded-xl bg-teal-600 px-5 py-2 text-xs font-extrabold text-white hover:bg-teal-500 cursor-pointer"
            >
              ادامه
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-extrabold text-white hover:bg-emerald-500 cursor-pointer"
            >
              <Check className="h-4 w-4" />
              شروع تمرین با نوانگار
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
