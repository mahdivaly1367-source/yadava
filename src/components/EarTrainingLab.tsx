import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Ear,
  Mic,
  RefreshCw,
  RotateCcw,
  Volume2,
  XCircle,
} from 'lucide-react';
import { getAudioContext, requestMicrophoneStream, stopMediaStream } from '../audio/audioContext';
import { detectPitchYin } from '../audio/dsp';
import { playPersianNote } from '../audio/karplusStrong';
import {
  DICTATION_PAD_NOTES,
  evaluateDictationAttempt,
  generateDastgahExercise,
  generateDictationExercise,
  generateIntervalExercise,
  type EarTrainingMode,
} from '../core/earTraining';
import { formatNoteFa, frequencyToPersianNote } from '../data/musicTheory';
import type {
  EarTrainingStats,
  InstrumentId,
  KoronMode,
  PersianNoteSpec,
} from '../types/music';
import { INSTRUMENT_LABELS_FA, toPersianDigits } from '../utils/persian';

interface EarTrainingLabProps {
  isPro: boolean;
  instrument: InstrumentId;
  a4Hz: number;
  koronMode: KoronMode;
  stats: EarTrainingStats;
  onRecordAnswer: (isCorrect: boolean) => void;
}

export const EarTrainingLab: React.FC<EarTrainingLabProps> = ({
  isPro,
  instrument,
  a4Hz,
  koronMode,
  stats,
  onRecordAnswer,
}) => {
  const [mode, setMode] = useState<EarTrainingMode>('interval');
  const [seed, setSeed] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [dictationAttempt, setDictationAttempt] = useState<PersianNoteSpec[]>([]);
  const [dictationEvaluated, setDictationEvaluated] = useState<{
    matchedCount: number;
    total: number;
    scorePercent: number;
    isExact: boolean;
  } | null>(null);
  const [micCapturing, setMicCapturing] = useState(false);
  const [micMsg, setMicMsg] = useState<string | null>(null);

  const micStreamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const stopDictationMic = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    stopMediaStream(micStreamRef.current);
    micStreamRef.current = null;
    setMicCapturing(false);
  };

  useEffect(() => {
    return () => stopDictationMic();
  }, []);

  const mcExercise = useMemo(() => {
    if (mode === 'interval') return generateIntervalExercise(seed);
    return generateDastgahExercise(seed, isPro);
  }, [isPro, mode, seed]);

  const dictationExercise = useMemo(() => generateDictationExercise(seed), [seed]);

  const playNotesSequence = (notes: PersianNoteSpec[]) => {
    notes.forEach((n, idx) => {
      playPersianNote(n, {
        instrument,
        durationSec: 0.62,
        a4Hz,
        koronMode,
        startTimeOffsetSec: idx * 0.48,
      });
    });
  };

  const handleSelectOption = (optionId: string) => {
    if (selectedOptionId !== null) return;
    setSelectedOptionId(optionId);
    const isCorrect = optionId === mcExercise.correctOptionId;
    onRecordAnswer(isCorrect);
  };

  const handleNext = () => {
    stopDictationMic();
    setSelectedOptionId(null);
    setDictationAttempt([]);
    setDictationEvaluated(null);
    setMicMsg(null);
    setSeed((s) => s + 1);
  };

  const handleAddDictationNote = (note: PersianNoteSpec) => {
    if (dictationEvaluated) return;
    playPersianNote(note, { instrument, durationSec: 0.45, a4Hz, koronMode });
    const next = [...dictationAttempt, note];
    setDictationAttempt(next);
    if (next.length >= dictationExercise.notes.length) {
      const res = evaluateDictationAttempt(dictationExercise.notes, next);
      setDictationEvaluated(res);
      onRecordAnswer(res.scorePercent >= 75);
    }
  };

  const captureNextNoteByMic = async () => {
    if (dictationEvaluated) return;
    setMicMsg(null);
    stopDictationMic();

    try {
      const stream = await requestMicrophoneStream();
      micStreamRef.current = stream;
      const ctx = getAudioContext();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      src.connect(analyser);

      const buf = new Float32Array(analyser.fftSize);
      setMicCapturing(true);
      const started = performance.now();
      let stableFrames = 0;
      let lastLabel = '';
      let lastNote: PersianNoteSpec | null = null;

      const tick = () => {
        analyser.getFloatTimeDomainData(buf);
        const yin = detectPitchYin(buf, ctx.sampleRate, { rmsThreshold: 0.015 });
        if (yin.frequency && yin.clarity > 0.75) {
          const match = frequencyToPersianNote(
            yin.frequency,
            a4Hz,
            koronMode,
            DICTATION_PAD_NOTES
          );
          if (match.labelFa === lastLabel) {
            stableFrames += 1;
          } else {
            lastLabel = match.labelFa;
            lastNote = match.note;
            stableFrames = 1;
          }
          if (stableFrames >= 6 && lastNote) {
            stopDictationMic();
            handleAddDictationNote(lastNote);
            return;
          }
        }
        if (performance.now() - started > 4500) {
          stopDictationMic();
          setMicMsg('نت پایداری تشخیص داده نشد؛ دوباره بنوازید یا از دکمه‌های نت استفاده کنید.');
          return;
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setMicMsg('دسترسی میکروفون برقرار نشد؛ می‌توانید با کلیدهای ربع‌پرده پایین پاسخ دهید.');
      setMicCapturing(false);
    }
  };

  const accuracyPct =
    stats.totalAnswered > 0
      ? Math.round((stats.totalCorrect / stats.totalAnswered) * 100)
      : 0;

  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/85">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-teal-500 text-slate-950 shadow">
            <Ear className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
              آکادمی اختصاصی تربیت گوش ربع‌پرده (Microtonal Ear Lab)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              تمرین‌های ۲ دقیقه‌ای قطعی و آفلاین با سنتز {INSTRUMENT_LABELS_FA[instrument]} — دقت کل:{' '}
              <strong className="text-teal-600 dark:text-teal-300">
                {toPersianDigits(accuracyPct)}٪
              </strong>{' '}
              ({toPersianDigits(stats.totalCorrect)} از {toPersianDigits(stats.totalAnswered)} صحیح)
            </p>
          </div>
        </div>

        {/* 3 Ear Training Modes */}
        <div className="flex flex-wrap gap-1.5 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
          {(
            [
              { id: 'interval', label: '۱. تشخیص فاصله ایرانی' },
              { id: 'dastgah', label: '۲. تشخیص دستگاه/گوشه' },
              { id: 'dictation', label: '۳. دیکته ملودیک (Call & Response)' },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                stopDictationMic();
                setMode(m.id);
                setSelectedOptionId(null);
                setDictationAttempt([]);
                setDictationEvaluated(null);
              }}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                mode === m.id
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mode 1 & 2: Interval or Dastgah Multiple Choice */}
      {(mode === 'interval' || mode === 'dastgah') && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/75 p-4 dark:border-slate-800 dark:bg-slate-800/50">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                {mcExercise.promptFa}
              </div>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                راهنما: {mcExercise.hintFa}
              </p>
            </div>
            <button
              type="button"
              onClick={() => playNotesSequence(mcExercise.notes)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-xs font-extrabold text-white shadow hover:bg-teal-700"
            >
              <Volume2 className="h-4 w-4" />
              پخش صوت تمرین
            </button>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {mcExercise.options.map((opt) => {
              const isSelected = selectedOptionId === opt.id;
              const isCorrect = opt.id === mcExercise.correctOptionId;
              let btnClass =
                'border-slate-200 bg-white text-slate-800 hover:border-teal-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';
              if (selectedOptionId !== null) {
                if (isCorrect) {
                  btnClass = 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
                } else if (isSelected && !isCorrect) {
                  btnClass = 'border-rose-500 bg-rose-500/15 text-rose-700 dark:text-rose-300';
                }
              }
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelectOption(opt.id)}
                  className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-right text-xs font-bold transition ${btnClass}`}
                >
                  <span>{opt.labelFa}</span>
                  {selectedOptionId !== null && isCorrect && (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                  )}
                  {selectedOptionId !== null && isSelected && !isCorrect && (
                    <XCircle className="h-4 w-4 shrink-0 text-rose-500" />
                  )}
                </button>
              );
            })}
          </div>

          {selectedOptionId !== null && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-teal-500/10 p-3 text-xs">
              <p className="font-semibold text-slate-700 dark:text-slate-200">
                {mcExercise.explanationFa}
              </p>
              <button
                type="button"
                onClick={handleNext}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-1.5 text-xs font-extrabold text-slate-950 hover:bg-amber-400"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                سؤال بعدی
              </button>
            </div>
          )}
        </div>
      )}

      {/* Mode 3: Call & Response Melodic Dictation */}
      {mode === 'dictation' && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/75 p-4 dark:border-slate-800 dark:bg-slate-800/50">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                {dictationExercise.titleFa} ({toPersianDigits(dictationExercise.notes.length)} نت)
              </div>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                جمله را بشنوید، سپس نت‌به‌نت با میکروفون بخوانید/بنوازید یا کلیدهای ربع‌پرده زیر را بزنید.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => playNotesSequence(dictationExercise.notes)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-3.5 py-2 text-xs font-extrabold text-white hover:bg-teal-700"
              >
                <Volume2 className="h-4 w-4" />
                پخش جمله استاد
              </button>
              <button
                type="button"
                onClick={() => void captureNextNoteByMic()}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-extrabold text-white ${
                  micCapturing ? 'animate-pulse bg-emerald-600' : 'bg-slate-800 hover:bg-slate-700'
                }`}
              >
                <Mic className="h-4 w-4" />
                {micCapturing ? 'گوش دادن به نت بعدی...' : 'پاسخ با میکروفون'}
              </button>
            </div>
          </div>

          {micMsg && (
            <div className="mt-2 rounded-lg bg-amber-500/12 px-3 py-1.5 text-xs text-amber-700 dark:text-amber-300">
              {micMsg}
            </div>
          )}

          {/* Slots showing learner's entered sequence */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {dictationExercise.notes.map((targetNote, idx) => {
              const entered = dictationAttempt[idx];
              return (
                <div
                  key={idx}
                  className={`min-w-[82px] rounded-xl border px-3 py-2 text-center text-xs font-extrabold ${
                    entered
                      ? 'border-teal-500 bg-teal-500/15 text-teal-700 dark:text-teal-200'
                      : 'border-dashed border-slate-300 bg-white text-slate-400 dark:border-slate-700 dark:bg-slate-900'
                  }`}
                >
                  {entered ? formatNoteFa(entered) : `نت ${toPersianDigits(idx + 1)}`}
                  {dictationEvaluated && (
                    <div className="mt-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-300">
                      پاسخ: {formatNoteFa(targetNote)}
                    </div>
                  )}
                </div>
              );
            })}

            {dictationAttempt.length > 0 && !dictationEvaluated && (
              <button
                type="button"
                onClick={() => setDictationAttempt([])}
                className="inline-flex items-center gap-1 rounded-xl bg-slate-200 px-2.5 py-2 text-xs font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-200"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                پاک‌کردن
              </button>
            )}
          </div>

          {/* Microtonal Note Pads */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {DICTATION_PAD_NOTES.map((note, idx) => (
              <button
                key={idx}
                type="button"
                disabled={dictationEvaluated !== null}
                onClick={() => handleAddDictationNote(note)}
                className={`rounded-xl border px-3 py-2 text-xs font-extrabold transition ${
                  note.accidental === 'koron'
                    ? 'border-amber-400/60 bg-amber-500/15 text-amber-800 hover:bg-amber-500/25 dark:text-amber-200'
                    : 'border-slate-300 bg-white text-slate-800 hover:bg-teal-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'
                }`}
              >
                {formatNoteFa(note)}
              </button>
            ))}
          </div>

          {dictationEvaluated && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-emerald-500/12 p-3 text-xs">
              <div className="font-bold text-emerald-700 dark:text-emerald-300">
                امتیاز دیکته ملودیک: {toPersianDigits(dictationEvaluated.scorePercent)}٪ (
                {toPersianDigits(dictationEvaluated.matchedCount)} از{' '}
                {toPersianDigits(dictationEvaluated.total)} نت دقیق) — {dictationExercise.dastgahHintFa}
              </div>
              <button
                type="button"
                onClick={handleNext}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-1.5 text-xs font-extrabold text-slate-950"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                جمله بعدی
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
