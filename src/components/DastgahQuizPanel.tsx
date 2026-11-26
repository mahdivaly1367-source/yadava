import React, { useEffect, useRef, useState } from 'react';
import {
  Award,
  CheckCircle2,
  Ear,
  HelpCircle,
  Play,
  RefreshCw,
  Square,
  XCircle,
} from 'lucide-react';
import { playGushehPhrase, type PhrasePlaybackHandle } from '../audio/karplusStrong';
import {
  generateDastgahQuizQuestion,
  loadDastgahMastery,
  recordDastgahQuizResult,
  type DastgahMasteryEntry,
  type DastgahQuizMode,
  type DastgahQuizQuestion,
} from '../core/dastgahQuiz';
import { RADIF_SYSTEMS } from '../data/radifData';
import type { InstrumentId, KoronMode } from '../types/music';
import { toPersianDigits } from '../utils/persian';

interface DastgahQuizPanelProps {
  instrument: InstrumentId;
  a4Hz: number;
  koronMode: KoronMode;
}

export const DastgahQuizPanel: React.FC<DastgahQuizPanelProps> = ({
  instrument,
  a4Hz,
  koronMode,
}) => {
  const [mode, setMode] = useState<DastgahQuizMode>('dastgah');
  const [seedCounter, setSeedCounter] = useState<number>(101);
  const [question, setQuestion] = useState<DastgahQuizQuestion>(() =>
    generateDastgahQuizQuestion('dastgah', 101)
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [streak, setStreak] = useState(0);
  const [mastery, setMastery] = useState<Record<string, DastgahMasteryEntry>>(() =>
    loadDastgahMastery()
  );
  const handleRef = useRef<PhrasePlaybackHandle | null>(null);

  useEffect(() => {
    return () => {
      handleRef.current?.stop();
    };
  }, []);

  const stopAudio = () => {
    handleRef.current?.stop();
    handleRef.current = null;
    setIsPlaying(false);
  };

  const playQuestionPhrase = (q: DastgahQuizQuestion = question) => {
    stopAudio();
    setIsPlaying(true);
    handleRef.current = playGushehPhrase(q.targetGusheh.melody, {
      instrument,
      bpm: q.targetGusheh.practiceLoop.defaultBpm,
      speedMultiplier: 1.05,
      a4Hz,
      koronMode,
      startIndex: 0,
      endIndex: Math.min(7, q.targetGusheh.melody.length - 1),
      loop: false,
      enableOrnaments: true,
      scale: q.targetGusheh.scale,
      onComplete: () => setIsPlaying(false),
    });
  };

  const nextQuestion = (nextMode: DastgahQuizMode = mode) => {
    stopAudio();
    const nextSeed = seedCounter + 37;
    setSeedCounter(nextSeed);
    const q = generateDastgahQuizQuestion(nextMode, nextSeed);
    setQuestion(q);
    setSelectedId(null);
    setShowHint(false);
  };

  const handleSelectOption = (optionId: string) => {
    if (selectedId) return;
    setSelectedId(optionId);
    const isCorrect = optionId === question.correctOptionId;
    setStreak((s) => (isCorrect ? s + 1 : 0));
    setMastery(recordDastgahQuizResult(question.targetGusheh.dastgahId, isCorrect));
  };

  const isCorrect = selectedId !== null && selectedId === question.correctOptionId;

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/85">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white">
            <Ear className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            آزمون حرفه‌ای تشخیص دستگاه و گوشه با گوش
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            جمله مقامی را با زینت زنده بشنوید و دستگاه یا گوشه شاخص را تشخیص دهید.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => {
                setMode('dastgah');
                nextQuestion('dastgah');
              }}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-bold cursor-pointer ${
                mode === 'dastgah'
                  ? 'bg-teal-600 text-white'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              تشخیص ۱۲ دستگاه
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('gusheh');
                nextQuestion('gusheh');
              }}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-bold cursor-pointer ${
                mode === 'gusheh'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              تشخیص گوشه شاخص
            </button>
          </div>
          <span className="inline-flex items-center gap-1 rounded-xl bg-amber-500/15 px-2.5 py-1 text-xs font-extrabold text-amber-700 dark:text-amber-300">
            <Award className="h-3.5 w-3.5" />
            رکورد پیاپی: {toPersianDigits(streak)}
          </span>
        </div>
      </div>

      {/* Audio Prompt Box */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-teal-500/30 bg-teal-50/60 p-3 dark:bg-teal-950/25">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => (isPlaying ? stopAudio() : playQuestionPhrase())}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-extrabold text-white cursor-pointer ${
              isPlaying ? 'bg-rose-600 hover:bg-rose-500' : 'bg-teal-600 hover:bg-teal-500'
            }`}
          >
            {isPlaying ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {isPlaying ? 'توقف جمله' : 'پخش جمله آزمون'}
          </button>
          <button
            type="button"
            onClick={() => setShowHint((h) => !h)}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <HelpCircle className="h-3.5 w-3.5 text-amber-500" />
            راهنمای نت شاهد
          </button>
        </div>

        <button
          type="button"
          onClick={() => nextQuestion()}
          className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 cursor-pointer"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          سؤال بعدی
        </button>
      </div>

      {showHint && (
        <div className="rounded-xl border border-amber-400/40 bg-amber-50/70 px-3 py-2 text-xs font-semibold text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          💡 {question.hintFa}
        </div>
      )}

      {/* 4 Quiz Options */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {question.options.map((opt) => {
          const picked = selectedId === opt.id;
          const correctOpt = opt.id === question.correctOptionId;
          let cls =
            'border-slate-200 bg-white hover:border-teal-400 dark:border-slate-700 dark:bg-slate-800/80';
          if (selectedId) {
            if (correctOpt) {
              cls =
                'border-emerald-500 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-200';
            } else if (picked) {
              cls = 'border-rose-500 bg-rose-50 text-rose-950 dark:bg-rose-950/40 dark:text-rose-200';
            }
          }
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleSelectOption(opt.id)}
              disabled={selectedId !== null}
              className={`flex items-center justify-between rounded-xl border p-3 text-right transition cursor-pointer ${cls}`}
            >
              <div>
                <div className="text-sm font-black">{opt.labelFa}</div>
                <div className="text-[11px] opacity-75">{opt.subLabelFa}</div>
              </div>
              {selectedId && correctOpt && <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
              {selectedId && picked && !correctOpt && <XCircle className="h-5 w-5 text-rose-600" />}
            </button>
          );
        })}
      </div>

      {/* Explanation Feedback */}
      {selectedId && (
        <div
          className={`rounded-xl border p-3 text-xs font-semibold ${
            isCorrect
              ? 'border-emerald-400 bg-emerald-50/75 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200'
              : 'border-rose-400 bg-rose-50/75 text-rose-900 dark:bg-rose-950/30 dark:text-rose-200'
          }`}
        >
          {isCorrect ? 'آفرین! تشخیص شما کاملاً دقیق بود. ' : 'نزدیک بود! '}
          {question.explanationFa}
        </div>
      )}

      {/* Per-Dastgah Mastery Breakdown Chart */}
      <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40">
        <div className="mb-2 text-xs font-extrabold text-slate-800 dark:text-slate-100">
          نمودار درصد تسلط شنیداری به تفکیک ۱۲ دستگاه و آواز
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {RADIF_SYSTEMS.map((sys) => {
            const stat = mastery[sys.id];
            const pct = stat && stat.attempts > 0 ? Math.round((stat.correct / stat.attempts) * 100) : 0;
            return (
              <div key={sys.id} className="space-y-1">
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-700 dark:text-slate-300">
                  <span>{sys.nameFa}</span>
                  <span>
                    {stat && stat.attempts > 0
                      ? `${toPersianDigits(pct)}٪ (${toPersianDigits(stat.attempts)})`
                      : '—'}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div
                    className="h-full rounded-full bg-teal-500 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
