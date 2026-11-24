import React, { useEffect, useRef, useState } from 'react';
import { Award, RotateCcw, Wind } from 'lucide-react';
import {
  BreathLongToneTracker,
  TAHRIR_IDEAL_MAX_HZ,
  TAHRIR_IDEAL_MIN_HZ,
  type BreathLabMetrics,
} from '../core/breathLab';
import { toPersianDigits } from '../utils/persian';

interface BreathLongTonePanelProps {
  micActive: boolean;
  liveRms: number;
  liveTahrirRateHz: number;
  bestBreathSeconds: number;
  onNewBestBreath?: (seconds: number) => void;
}

export const BreathLongTonePanel: React.FC<BreathLongTonePanelProps> = ({
  micActive,
  liveRms,
  liveTahrirRateHz,
  bestBreathSeconds,
  onNewBestBreath,
}) => {
  const trackerRef = useRef<BreathLongToneTracker>(
    new BreathLongToneTracker(bestBreathSeconds)
  );
  const reportedBestRef = useRef<number>(bestBreathSeconds);

  const [metrics, setMetrics] = useState<BreathLabMetrics>(() =>
    trackerRef.current.update({
      rms: 0,
      tahrirRateHz: 0,
      nowMs: Date.now(),
    })
  );

  useEffect(() => {
    reportedBestRef.current = Math.max(reportedBestRef.current, bestBreathSeconds);
  }, [bestBreathSeconds]);

  useEffect(() => {
    if (!micActive) return;
    const next = trackerRef.current.update({
      rms: liveRms,
      tahrirRateHz: liveTahrirRateHz,
      nowMs: Date.now(),
    });
    setMetrics(next);
    if (next.bestSustainSec >= reportedBestRef.current + 1.0) {
      reportedBestRef.current = next.bestSustainSec;
      onNewBestBreath?.(next.bestSustainSec);
    }
  }, [micActive, liveRms, liveTahrirRateHz, onNewBestBreath]);

  const handleReset = () => {
    trackerRef.current.reset(true);
    setMetrics(
      trackerRef.current.update({
        rms: 0,
        tahrirRateHz: 0,
        nowMs: Date.now(),
      })
    );
  };

  // Tahrir needle position along 3.0 Hz .. 9.0 Hz scale
  const tahrirPercent = Math.max(
    0,
    Math.min(100, ((metrics.tahrirRateHz - 3) / 6) * 100)
  );
  const idealLeftPct = ((TAHRIR_IDEAL_MIN_HZ - 3) / 6) * 100;
  const idealWidthPct = ((TAHRIR_IDEAL_MAX_HZ - TAHRIR_IDEAL_MIN_HZ) / 6) * 100;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/85">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
            <Wind className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
              آزمایشگاه کنترل نفس، نت کشیده (Long-Tone) و تحریر ایرانی
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              ویژه آواز، نی و کمانچه — پایش ثبات داینامیک دیافراگم و محدوده طلایی تحریر (۵.۵ تا ۶.۸ هرتز)
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleReset}
          className="inline-flex items-center gap-1 rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          ریست کرنومتر
        </button>
      </div>

      {/* 3 Live Metric Tiles */}
      <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/8 p-3 text-center">
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
            کشش فعلی نفس / آرشه
          </div>
          <div className="mt-1 text-2xl font-black text-emerald-600 dark:text-emerald-300">
            {toPersianDigits(metrics.currentSustainSec.toFixed(1))} ثانیه
          </div>
          <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-300">
            <Award className="h-3.5 w-3.5" />
            رکورد شخصی: {toPersianDigits(Math.max(metrics.bestSustainSec, bestBreathSeconds).toFixed(1))} ثانیه
          </div>
        </div>

        <div className="rounded-xl border border-sky-500/30 bg-sky-500/8 p-3 text-center">
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
            ثبات داینامیک (یکدستی صدا)
          </div>
          <div className="mt-1 text-2xl font-black text-sky-600 dark:text-sky-300">
            {toPersianDigits(metrics.dynamicStabilityPercent)}٪
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-l from-sky-400 to-teal-500 transition-all"
              style={{ width: `${metrics.dynamicStabilityPercent}%` }}
            />
          </div>
          <div className="ltr-num mt-0.5 text-[10px] text-slate-500">
            {metrics.currentDb.toFixed(1)} dBFS
          </div>
        </div>

        <div className="rounded-xl border border-amber-500/30 bg-amber-500/8 p-3 text-center">
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
            بسامد تحریر زنده (Tahrir Rate)
          </div>
          <div className="mt-1 text-2xl font-black text-amber-600 dark:text-amber-300">
            {metrics.tahrirRateHz > 0
              ? `${toPersianDigits(metrics.tahrirRateHz.toFixed(1))} Hz`
              : '—'}
          </div>
          <div className="mt-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300">
            هدف اصیل ایرانی: ۵.۵ تا ۶.۸ هرتز
          </div>
        </div>
      </div>

      {/* Visual Tahrir Zone Bar */}
      <div className="mt-3 rounded-xl bg-slate-950 p-3 text-white">
        <div className="mb-1.5 flex items-center justify-between text-[11px]">
          <span className="font-bold text-amber-300">باند سنجش تحریر اصیل</span>
          <span className="text-[10px] text-slate-300">
            {micActive ? metrics.tahrirFeedbackFa : 'برای شروع پایش نفس و تحریر، میکروفون استودیو را روشن کنید.'}
          </span>
        </div>
        <div className="relative h-4 w-full overflow-hidden rounded-full bg-slate-800" dir="ltr">
          <div
            className="absolute inset-y-0 bg-emerald-500/45 border-x border-emerald-300"
            style={{ left: `${idealLeftPct}%`, width: `${idealWidthPct}%` }}
          />
          {metrics.tahrirRateHz >= 2.5 && (
            <div
              className="absolute top-0.5 h-3 w-3 -translate-x-1/2 rounded-full bg-amber-400 ring-2 ring-white transition-all"
              style={{ left: `${tahrirPercent}%` }}
            />
          )}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-slate-400" dir="ltr">
          <span>3 Hz (کند)</span>
          <span className="text-emerald-300 font-bold">5.5 – 6.8 Hz (طلایی)</span>
          <span>9 Hz (تند)</span>
        </div>
      </div>
    </div>
  );
};
