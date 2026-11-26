import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Ear,
  Play,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Sliders,
  Volume2,
} from 'lucide-react';
import { playFrequencyTone } from '../audio/karplusStrong';
import {
  computeDetunedStringHz,
  createBlindTuningChallenge,
  evaluateBlindTuning,
  type BlindTuningDifficulty,
  type BlindTuningOutcome,
} from '../core/blindTuning';
import type { InstrumentId, KoronMode } from '../types/music';
import { INSTRUMENT_LABELS_FA, toPersianDigits } from '../utils/persian';

interface BlindTuningPanelProps {
  instrument: InstrumentId;
  dastgahId: string;
  a4Hz: number;
  koronMode: KoronMode;
  onAwardXp?: (xp: number) => void;
}

export const BlindTuningPanel: React.FC<BlindTuningPanelProps> = ({
  instrument,
  dastgahId,
  a4Hz,
  koronMode,
  onAwardXp,
}) => {
  const [difficulty, setDifficulty] = useState<BlindTuningDifficulty>('beginner');
  const [roundNumber, setRoundNumber] = useState(0);
  const [pegOffsetCents, setPegOffsetCents] = useState(0);
  const [outcome, setOutcome] = useState<BlindTuningOutcome | null>(null);
  const [streak, setStreak] = useState(0);

  const challenge = useMemo(
    () =>
      createBlindTuningChallenge({
        instrument,
        dastgahId,
        a4Hz,
        koronMode,
        difficulty,
        roundNumber,
      }),
    [instrument, dastgahId, a4Hz, koronMode, difficulty, roundNumber]
  );

  const currentStringHz = computeDetunedStringHz(challenge, pegOffsetCents);

  const handlePlayReference = () => {
    playFrequencyTone(challenge.targetHz, {
      instrument,
      durationSec: 1.15,
      velocity: 0.85,
    });
  };

  const handlePlayString = () => {
    playFrequencyTone(currentStringHz, {
      instrument,
      durationSec: 1.15,
      velocity: 0.85,
    });
  };

  const handlePlayBothBeating = () => {
    playFrequencyTone(challenge.targetHz, {
      instrument,
      durationSec: 1.4,
      velocity: 0.65,
    });
    playFrequencyTone(currentStringHz, {
      instrument,
      durationSec: 1.4,
      velocity: 0.65,
    });
  };

  const adjustPeg = (deltaCents: number) => {
    if (outcome) return;
    setPegOffsetCents((prev) => Math.max(-65, Math.min(65, Number((prev + deltaCents).toFixed(1)))));
  };

  const handleSubmit = () => {
    const res = evaluateBlindTuning(challenge, pegOffsetCents);
    setOutcome(res);
    setStreak((s) => (res.passed ? s + 1 : 0));
    if (res.xpAwarded > 0) {
      onAwardXp?.(res.xpAwarded);
    }
  };

  const handleNextRound = (nextDiff: BlindTuningDifficulty = difficulty) => {
    setDifficulty(nextDiff);
    setRoundNumber((r) => r + 1);
    setPegOffsetCents(0);
    setOutcome(null);
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Ear className="w-4 h-4 text-sky-400" />
            آزمایشگاه «کوک کردن با گوش» (بدون عقربه تیونر)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            یکی از سیم‌ها یا خرک‌های {INSTRUMENT_LABELS_FA[instrument]} عمداً فالش شده است. بدون دیدن تیونر، فقط با گوش دادن و چرخاندن گوشی مجازی آن را دقیق کوک کنید!
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          {([
            { id: 'beginner', label: 'مبتدی (±۸¢)' },
            { id: 'intermediate', label: 'متوسط (±۵¢)' },
            { id: 'master', label: 'استادانه (±۲.۵¢)' },
          ] as Array<{ id: BlindTuningDifficulty; label: string }>).map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => handleNextRound(d.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium cursor-pointer border transition ${
                difficulty === d.id
                  ? 'bg-sky-600 text-white border-sky-400'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Hidden Challenge Header */}
      <div className="rounded-xl border border-sky-500/25 bg-sky-950/20 p-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-bold text-sky-300">
            {challenge.stringLabelFa} — نت هدف: {challenge.targetNoteFa}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            مقدار فالش بودن اولیه مخفی است! پیاپی موفق: <span className="text-amber-300 font-bold">{toPersianDigits(streak)}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handlePlayReference}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            شنیدن نت مرجع
          </button>
          <button
            type="button"
            onClick={handlePlayString}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white cursor-pointer"
          >
            <Volume2 className="w-3.5 h-3.5" />
            شنیدن سیم شما
          </button>
          <button
            type="button"
            onClick={handlePlayBothBeating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5" />
            پخش هم‌زمان (شنیدن ضربان)
          </button>
        </div>
      </div>

      {/* Virtual Tuning Peg Controls (No Needle Revealed!) */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-300 font-semibold">چرخاندن گوشی مجازی (گام شُل / سفت کردن سیم)</span>
          <span className="text-slate-400 text-[11px]">
            تغییر اعمالی شما: <span className="text-sky-300 font-mono" dir="ltr">{pegOffsetCents >= 0 ? `+${pegOffsetCents}` : pegOffsetCents}¢</span>
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            disabled={Boolean(outcome)}
            onClick={() => adjustPeg(-5)}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 border border-slate-700 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-sky-400" />
            بم‌تر (−۵¢)
          </button>
          <button
            type="button"
            disabled={Boolean(outcome)}
            onClick={() => adjustPeg(-1)}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 border border-slate-700 cursor-pointer"
          >
            ریز بم‌تر (−۱¢)
          </button>
          <button
            type="button"
            disabled={Boolean(outcome)}
            onClick={() => adjustPeg(1)}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 border border-slate-700 cursor-pointer"
          >
            ریز زیرتر (+۱¢)
          </button>
          <button
            type="button"
            disabled={Boolean(outcome)}
            onClick={() => adjustPeg(5)}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 border border-slate-700 cursor-pointer"
          >
            <RotateCw className="w-3.5 h-3.5 text-amber-400" />
            زیرتر (+۵¢)
          </button>
        </div>

        <div dir="ltr" className="px-2">
          <input
            type="range"
            min={-60}
            max={60}
            step={0.5}
            disabled={Boolean(outcome)}
            value={pegOffsetCents}
            onChange={(e) => setPegOffsetCents(Number(e.target.value))}
            className="w-full accent-sky-500 cursor-pointer"
            aria-label="تنظیم گوشی ساز"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          {!outcome ? (
            <button
              type="button"
              onClick={handleSubmit}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              ثبت و بررسی دقت کوک
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleNextRound()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              چالش سیم بعدی
            </button>
          )}
          <span className="text-[11px] text-slate-500">
            نکته: وقتی دو صدا هم‌زمان پخش شوند و لرزش/ضربان (Beating) کاملاً محو شود، سیم هم‌کوک است!
          </span>
        </div>
      </div>

      {/* Grading Reveal */}
      {outcome && (
        <div
          className={`rounded-xl border p-3.5 space-y-2 ${
            outcome.passed
              ? 'border-emerald-500/40 bg-emerald-950/25'
              : 'border-rose-500/40 bg-rose-950/20'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-bold text-slate-100">{outcome.rankLabelFa}</span>
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-200 font-mono" dir="ltr">
                خطا: {outcome.residualCents >= 0 ? `+${outcome.residualCents}` : outcome.residualCents}¢
              </span>
              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                +{toPersianDigits(outcome.xpAwarded)} XP
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-200 leading-relaxed">{outcome.feedbackFa}</p>
          <div className="text-[11px] text-slate-400">
            انحراف مخفی اولیه سیم:{' '}
            <span className="font-mono text-slate-200" dir="ltr">
              {challenge.initialDetuneCents >= 0
                ? `+${challenge.initialDetuneCents}`
                : challenge.initialDetuneCents}
              ¢
            </span>{' '}
            • دقت امتیاز: {toPersianDigits(outcome.accuracyPercent)}٪
          </div>
        </div>
      )}
    </div>
  );
};
