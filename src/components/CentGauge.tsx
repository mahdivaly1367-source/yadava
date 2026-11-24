import React from 'react';
import type { PitchAnalysisFrame } from '../types/music';
import { toPersianDigits } from '../utils/persian';

interface CentGaugeProps {
  frame: PitchAnalysisFrame;
  micActive: boolean;
  targetNoteLabelFa?: string;
}

export const CentGauge: React.FC<CentGaugeProps> = ({ frame, micActive, targetNoteLabelFa }) => {
  const clampedCents = Math.max(-50, Math.min(50, frame.centsOffset));
  const angleDeg = (clampedCents / 50) * 68; // -68deg .. +68deg
  const absCents = Math.abs(clampedCents);

  const statusColor =
    !frame.frequency
      ? '#64748b'
      : absCents <= 10
      ? '#10b981'
      : absCents <= 25
      ? '#f59e0b'
      : '#ef4444';

  const statusTextFa = !micActive
    ? 'میکروفون خاموش'
    : !frame.frequency
    ? 'در انتظار نوای ساز یا آواز...'
    : absCents <= 10
    ? 'کوک دقیق و استوار'
    : clampedCents > 0
    ? 'کمی زیرتر از کوک (تیز)'
    : 'کمی بم‌تر از کوک';

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/85">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
            عقربه سنت زنده (±۵۰ سنت)
          </h3>
          {targetNoteLabelFa && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              هدف فعلی: <span className="font-semibold text-teal-600 dark:text-teal-300">{targetNoteLabelFa}</span>
            </p>
          )}
        </div>

        {/* Live Tahrir Badge (~6 Hz) */}
        <div
          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-all ${
            frame.tahrirDetected
              ? 'border-amber-400 bg-amber-500/20 text-amber-700 shadow-sm dark:text-amber-300'
              : 'border-slate-200 bg-slate-100/70 text-slate-500 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-400'
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              frame.tahrirDetected ? 'animate-pulse bg-amber-500' : 'bg-slate-400'
            }`}
          />
          {frame.tahrirDetected
            ? `تحریر فعال (${toPersianDigits(frame.tahrirRateHz)} هرتز)`
            : 'تحریر (~۶ هرتز)'}
        </div>
      </div>

      {/* SVG Precision Analog Gauge */}
      <div className="mx-auto mt-2 max-w-[300px]" dir="ltr">
        <svg viewBox="0 0 260 150" className="w-full overflow-visible">
          {/* Outer Scale Arc */}
          <path
            d="M 28 130 A 102 102 0 0 1 232 130"
            fill="none"
            className="stroke-slate-200 dark:stroke-slate-700"
            strokeWidth="12"
            strokeLinecap="round"
          />
          {/* Green In-Tune Center Zone (±10¢) */}
          <path
            d="M 106 31 A 102 102 0 0 1 154 31"
            fill="none"
            stroke="#10b981"
            strokeWidth="12"
            strokeLinecap="round"
            opacity="0.85"
          />

          {/* Tick marks (-50, -25, 0, +25, +50) */}
          {[-50, -25, -10, 0, 10, 25, 50].map((val) => {
            const rad = ((val / 50) * 68 - 90) * (Math.PI / 180);
            const x1 = 130 + Math.cos(rad) * 86;
            const y1 = 130 + Math.sin(rad) * 86;
            const x2 = 130 + Math.cos(rad) * 102;
            const y2 = 130 + Math.sin(rad) * 102;
            const tx = 130 + Math.cos(rad) * 116;
            const ty = 130 + Math.sin(rad) * 116;
            return (
              <g key={val}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={val === 0 ? '#10b981' : '#94a3b8'}
                  strokeWidth={val === 0 ? 2.8 : 1.5}
                />
                {Math.abs(val) !== 10 && (
                  <text
                    x={tx}
                    y={ty + 3}
                    textAnchor="middle"
                    className="fill-slate-500 text-[9px] font-semibold dark:fill-slate-400"
                  >
                    {val > 0 ? `+${val}` : val}
                  </text>
                )}
              </g>
            );
          })}

          {/* Rotating Needle */}
          <g transform={`rotate(${frame.frequency ? angleDeg : 0} 130 130)`} style={{ transition: 'transform 90ms ease-out' }}>
            <line
              x1="130"
              y1="130"
              x2="130"
              y2="36"
              stroke={statusColor}
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            <circle cx="130" cy="130" r="8" fill={statusColor} />
            <circle cx="130" cy="130" r="3" fill="#ffffff" />
          </g>
        </svg>
      </div>

      {/* Live Numeric Readout */}
      <div className="mt-1 grid grid-cols-3 gap-2 rounded-xl bg-slate-100/80 p-2.5 text-center dark:bg-slate-800/75">
        <div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">نت تشخیص‌داده‌شده</div>
          <div className="mt-0.5 text-base font-extrabold text-slate-900 dark:text-white">
            {frame.note ? frame.noteLabelFa : '—'}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">انحراف سنت</div>
          <div
            className="ltr-num mt-0.5 text-base font-extrabold"
            style={{ color: statusColor }}
          >
            {frame.frequency
              ? `${clampedCents > 0 ? '+' : ''}${clampedCents.toFixed(1)}¢`
              : '0.0¢'}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">بسامد (Hz)</div>
          <div className="ltr-num mt-0.5 text-base font-bold text-slate-800 dark:text-slate-200">
            {frame.frequency ? `${frame.frequency.toFixed(1)} Hz` : '—'}
          </div>
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between text-xs">
        <span className="font-medium" style={{ color: statusColor }}>
          {statusTextFa}
        </span>
        <span className="text-slate-500 dark:text-slate-400">
          ارزیابی فرود: <strong className="text-emerald-600 dark:text-emerald-400">{toPersianDigits(frame.foroudScore)}٪</strong>
        </span>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div
          className="h-full rounded-full bg-gradient-to-l from-emerald-500 to-teal-400 transition-all duration-300"
          style={{ width: `${Math.min(100, Math.max(0, frame.foroudScore))}%` }}
        />
      </div>
    </div>
  );
};
