import React, { useEffect, useRef } from 'react';
import { Lock, SlidersHorizontal, Sparkles } from 'lucide-react';
import type { FourthOrderFilterMode } from '../audio/dsp';
import type { HarmonicPeak, KoronMode } from '../types/music';
import { toPersianDigits } from '../utils/persian';

interface FFTVisualizerPanelProps {
  isPro: boolean;
  onRequestUpgrade: () => void;
  micActive: boolean;
  fftDataDb: Float32Array | null;
  sampleRate: number;
  fftSize: number;
  fundamentalHz: number | null;
  harmonics: HarmonicPeak[];
  filterMode: FourthOrderFilterMode;
  filterCutoffHz: number;
  onChangeFilterMode: (mode: FourthOrderFilterMode) => void;
  onChangeFilterCutoff: (hz: number) => void;
  a4Hz: number;
  onChangeA4Hz: (hz: number) => void;
  koronMode: KoronMode;
  onChangeKoronMode: (mode: KoronMode) => void;
}

export const FFTVisualizerPanel: React.FC<FFTVisualizerPanelProps> = ({
  isPro,
  onRequestUpgrade,
  micActive,
  fftDataDb,
  sampleRate,
  fftSize,
  fundamentalHz,
  harmonics,
  filterMode,
  filterCutoffHz,
  onChangeFilterMode,
  onChangeFilterCutoff,
  a4Hz,
  onChangeA4Hz,
  koronMode,
  onChangeKoronMode,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Render Logarithmic FFT Spectrum (60 Hz .. 4000 Hz)
  useEffect(() => {
    if (!isPro) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 640;
    const height = 168;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Background
    ctx.fillStyle = '#090f1d';
    ctx.fillRect(0, 0, width, height);

    const minHz = 60;
    const maxHz = 4000;
    const logMin = Math.log10(minHz);
    const logMax = Math.log10(maxHz);
    const hzToX = (hz: number) =>
      ((Math.log10(Math.max(minHz, Math.min(maxHz, hz))) - logMin) / (logMax - logMin)) * width;

    // Logarithmic frequency grid
    const gridFreqs = [100, 200, 440, 880, 1500, 3000];
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
    ctx.lineWidth = 1;
    ctx.font = '500 10px monospace';
    ctx.fillStyle = 'rgba(148, 163, 184, 0.75)';
    for (const f of gridFreqs) {
      const x = hzToX(f);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height - 18);
      ctx.stroke();
      ctx.fillText(`${f}Hz`, x + 3, height - 5);
    }

    // Filter cutoff marker line
    if (filterMode !== 'bypass') {
      const cutX = hzToX(filterCutoffHz);
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.7)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(cutX, 0);
      ctx.lineTo(cutX, height - 18);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw Spectrum Curve
    if (fftDataDb && fftDataDb.length > 0 && micActive) {
      const binHz = sampleRate / fftSize;
      ctx.beginPath();
      let started = false;
      for (let i = 1; i < fftDataDb.length; i++) {
        const hz = i * binHz;
        if (hz < minHz || hz > maxHz) continue;
        const x = hzToX(hz);
        const norm = Math.max(0, Math.min(1, (fftDataDb[i] + 105) / 85));
        const y = (height - 20) * (1 - norm);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.strokeStyle = '#2dd4bf';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Highlight harmonic markers
      for (const h of harmonics) {
        if (h.frequencyHz < minHz || h.frequencyHz > maxHz) continue;
        const hx = hzToX(h.frequencyHz);
        const hNorm = Math.max(0, Math.min(1, (h.magnitudeDb + 105) / 85));
        const hy = (height - 20) * (1 - hNorm);
        ctx.beginPath();
        ctx.arc(hx, hy, 4, 0, Math.PI * 2);
        ctx.fillStyle = h.harmonicNumber === 1 ? '#f59e0b' : '#38bdf8';
        ctx.fill();
        ctx.fillStyle = '#fde68a';
        ctx.font = '700 9px monospace';
        ctx.fillText(`f${h.harmonicNumber}`, hx - 6, Math.max(12, hy - 7));
      }
    } else {
      ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
      ctx.font = '500 12px Vazirmatn, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('برای مشاهده طیف لگاریتمی زنده، میکروفون کارگاه را روشن کنید', width / 2, height / 2);
    }
  }, [isPro, fftDataDb, sampleRate, fftSize, micActive, harmonics, filterMode, filterCutoffHz]);

  if (!isPro) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-amber-500/35 bg-gradient-to-br from-amber-500/10 via-white to-teal-500/10 p-5 shadow-sm dark:from-amber-950/35 dark:via-slate-900 dark:to-teal-950/35">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-300">
              <Lock className="h-3.5 w-3.5" />
              ویژگی نسخه حرفه‌ای (Pro)
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              ویژوالایزر زنده FFT لگاریتمی، استخراج هارمونیک و کالیبراسیون زیرسنت
            </h3>
            <p className="max-w-xl text-xs leading-6 text-slate-600 dark:text-slate-300">
              با فعال‌سازی نسخه کامل نوانگار به نمودار لگاریتمی طیف صوت، فیلتر باترورث مرتبه ۴ (۲۴ dB/oct)،
              تحلیل هارمونیک‌های ساز، و کالیبراسیون دقیق دیاپازون لا (A4) و کُرُن سنتی (-۵۶¢) دسترسی خواهید داشت.
            </p>
          </div>
          <button
            type="button"
            onClick={onRequestUpgrade}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-l from-amber-500 to-teal-600 px-4 py-2.5 text-xs font-bold text-white shadow-md transition hover:opacity-95"
          >
            <Sparkles className="h-4 w-4" />
            مشاهده نسخه حرفه‌ای
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/85">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-teal-600 dark:text-teal-400" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
            ویژوالایزر زنده FFT، هارمونیک‌ها و کالیبراسیون زیرسنت
          </h3>
        </div>
        <span className="ltr-num rounded-full bg-teal-500/15 px-2.5 py-0.5 text-xs font-bold text-teal-700 dark:text-teal-300">
          A4 = {a4Hz.toFixed(1)} Hz • کُرُن {koronMode === 'traditional_56' ? '-56¢' : '-50¢'}
        </span>
      </div>

      {/* Logarithmic Spectrum Canvas */}
      <div dir="ltr" className="overflow-hidden rounded-xl border border-slate-800">
        <canvas ref={canvasRef} className="h-[168px] w-full" />
      </div>

      {/* 4th-order Filter + Sub-cent A4 & Koron Calibration */}
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-xl bg-slate-100/80 p-3 dark:bg-slate-800/70">
          <div className="mb-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
            فیلتر مرتبه ۴ (۲۴ dB/oct)
          </div>
          <div className="flex gap-1.5">
            {(
              [
                { id: 'bypass', label: 'خاموش' },
                { id: 'lowpass', label: 'پایین‌گذر' },
                { id: 'bandpass', label: 'میان‌گذر' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onChangeFilterMode(opt.id)}
                className={`flex-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                  filterMode === opt.id
                    ? 'bg-teal-600 text-white'
                    : 'bg-white text-slate-600 dark:bg-slate-900 dark:text-slate-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="mt-2">
            <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>فرکانس قطع</span>
              <span className="ltr-num font-bold">{filterCutoffHz} Hz</span>
            </div>
            <input
              type="range"
              min={250}
              max={3600}
              step={50}
              value={filterCutoffHz}
              onChange={(e) => onChangeFilterCutoff(Number(e.target.value))}
              className="mt-1 w-full accent-teal-500"
            />
          </div>
        </div>

        <div className="rounded-xl bg-slate-100/80 p-3 dark:bg-slate-800/70">
          <div className="mb-1.5 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200">
            <span>کالیبراسیون دیاپازون لا (A4)</span>
            <button
              type="button"
              onClick={() => onChangeA4Hz(440)}
              className="text-[11px] font-semibold text-teal-600 hover:underline dark:text-teal-400"
            >
              بازنشانی ۴۴۰
            </button>
          </div>
          <div className="ltr-num text-center text-lg font-extrabold text-amber-600 dark:text-amber-300">
            {a4Hz.toFixed(1)} Hz
          </div>
          <input
            type="range"
            min={415}
            max={466}
            step={0.1}
            value={a4Hz}
            onChange={(e) => onChangeA4Hz(Number(e.target.value))}
            className="mt-1 w-full accent-amber-500"
          />
          <div className="mt-2 flex gap-1.5">
            <button
              type="button"
              onClick={() => onChangeKoronMode('standard_50')}
              className={`flex-1 rounded-lg px-2 py-1 text-[11px] font-semibold ${
                koronMode === 'standard_50'
                  ? 'bg-teal-600 text-white'
                  : 'bg-white text-slate-600 dark:bg-slate-900 dark:text-slate-300'
              }`}
            >
              کُرُن استاندارد (-۵۰¢)
            </button>
            <button
              type="button"
              onClick={() => onChangeKoronMode('traditional_56')}
              className={`flex-1 rounded-lg px-2 py-1 text-[11px] font-semibold ${
                koronMode === 'traditional_56'
                  ? 'bg-amber-600 text-white'
                  : 'bg-white text-slate-600 dark:bg-slate-900 dark:text-slate-300'
              }`}
            >
              کُرُن سنتی (-۵۶¢)
            </button>
          </div>
        </div>

        <div className="rounded-xl bg-slate-100/80 p-3 dark:bg-slate-800/70">
          <div className="mb-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
            هارمونیک‌های استخراج‌شده {fundamentalHz ? `(f₀=${fundamentalHz.toFixed(0)}Hz)` : ''}
          </div>
          {harmonics.length > 0 ? (
            <div className="space-y-1">
              {harmonics.map((h) => (
                <div
                  key={h.harmonicNumber}
                  className="flex items-center justify-between rounded-md bg-white/80 px-2 py-1 text-[11px] dark:bg-slate-900/75"
                >
                  <span className="font-semibold text-slate-600 dark:text-slate-300">
                    هارمونیک {toPersianDigits(h.harmonicNumber)}
                  </span>
                  <span className="ltr-num font-bold text-teal-600 dark:text-teal-300">
                    {h.frequencyHz.toFixed(1)} Hz
                  </span>
                  <span className="ltr-num text-slate-500">{h.magnitudeDb.toFixed(1)} dB</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] leading-5 text-slate-500 dark:text-slate-400">
              پس از نواختن یک نت ممتد روی میکروفون، بسامد پایه و ۴ هارمونیک بعدی به‌صورت لحظه‌ای نمایش داده می‌شوند.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
