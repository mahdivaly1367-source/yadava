import React, { useMemo, useState } from 'react';
import { Mic, Volume2 } from 'lucide-react';
import { playPersianNote } from '../audio/karplusStrong';
import {
  formatNoteFa,
  getRecommendedTuning,
  noteToFrequency,
} from '../data/musicTheory';
import type {
  InstrumentId,
  KoronMode,
  PitchAnalysisFrame,
} from '../types/music';
import { INSTRUMENT_LABELS_FA } from '../utils/persian';

interface InstrumentTunerPanelProps {
  dastgahId: string;
  instrument: InstrumentId;
  a4Hz: number;
  koronMode: KoronMode;
  micActive: boolean;
  onToggleMic: () => void;
  pitchFrame: PitchAnalysisFrame;
}

export const InstrumentTunerPanel: React.FC<InstrumentTunerPanelProps> = ({
  dastgahId,
  instrument,
  a4Hz,
  koronMode,
  micActive,
  onToggleMic,
  pitchFrame,
}) => {
  const recommended = useMemo(
    () => getRecommendedTuning(dastgahId, instrument),
    [dastgahId, instrument]
  );

  const [selectedStringId, setSelectedStringId] = useState<string>(
    recommended.strings[0]?.id ?? 'course-1'
  );

  const activeString =
    recommended.strings.find((s) => s.id === selectedStringId) ?? recommended.strings[0];

  const targetFreq = activeString
    ? noteToFrequency(activeString.note, a4Hz, koronMode)
    : 440;

  let diffCentsFromString: number | null = null;
  if (micActive && pitchFrame.frequency && activeString) {
    let diff = 1200 * Math.log2(pitchFrame.frequency / targetFreq);
    // Allow octave-insensitive feedback if slightly off octave while still showing exact cents
    if (Math.abs(diff) > 600) {
      diff = ((diff + 600) % 1200 + 1200) % 1200 - 600;
    }
    diffCentsFromString = Math.max(-50, Math.min(50, Math.round(diff * 10) / 10));
  }

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/85">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
            تیونر هوشمند {INSTRUMENT_LABELS_FA[instrument]}
          </h3>
          <p className="text-xs text-teal-700 dark:text-teal-300">{recommended.titleFa}</p>
        </div>
        <button
          type="button"
          onClick={onToggleMic}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
            micActive
              ? 'bg-rose-500 text-white shadow-sm'
              : 'bg-teal-600 text-white hover:bg-teal-700'
          }`}
        >
          <Mic className="h-3.5 w-3.5" />
          {micActive ? 'توقف سنجش میکروفون' : 'سنجش کوک با میکروفون'}
        </button>
      </div>

      {/* String / Bridge reference buttons */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {recommended.strings.map((st) => {
          const isSelected = activeString?.id === st.id;
          const freq = noteToFrequency(st.note, a4Hz, koronMode);
          return (
            <button
              key={st.id}
              type="button"
              onClick={() => {
                setSelectedStringId(st.id);
                playPersianNote(st.note, {
                  instrument,
                  durationSec: 1.5,
                  a4Hz,
                  koronMode,
                });
              }}
              className={`flex flex-col items-start rounded-xl border p-2.5 text-right transition ${
                isSelected
                  ? 'border-teal-500 bg-teal-500/12 shadow-sm dark:bg-teal-500/20'
                  : 'border-slate-200 bg-slate-50/70 hover:border-teal-400 dark:border-slate-700 dark:bg-slate-800/60'
              }`}
            >
              <div className="flex w-full items-center justify-between">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {st.labelFa}
                </span>
                <Volume2 className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
              </div>
              <div className="mt-1 text-sm font-extrabold text-slate-900 dark:text-white">
                {formatNoteFa(st.note, true)}
              </div>
              <div className="ltr-num text-[11px] text-slate-500 dark:text-slate-400">
                {freq.toFixed(1)} Hz
              </div>
            </button>
          );
        })}
      </div>

      {/* Live deviation bar locked to chosen string */}
      {activeString && (
        <div className="mt-3 rounded-xl bg-slate-100/80 p-3 dark:bg-slate-800/75">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              هدف انتخابی: {activeString.labelFa} ({formatNoteFa(activeString.note, true)})
            </span>
            <span
              className={`ltr-num font-extrabold ${
                diffCentsFromString === null
                  ? 'text-slate-400'
                  : Math.abs(diffCentsFromString) <= 8
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : Math.abs(diffCentsFromString) <= 20
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-rose-500'
              }`}
            >
              {diffCentsFromString === null
                ? '—'
                : `${diffCentsFromString > 0 ? '+' : ''}${diffCentsFromString.toFixed(1)}¢`}
            </span>
          </div>

          <div className="relative mt-2 h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" dir="ltr">
            <div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-emerald-500" />
            {diffCentsFromString !== null && (
              <div
                className={`absolute top-0.5 h-2 w-3 -translate-x-1/2 rounded-full transition-all duration-100 ${
                  Math.abs(diffCentsFromString) <= 8
                    ? 'bg-emerald-500'
                    : Math.abs(diffCentsFromString) <= 20
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
                }`}
                style={{ left: `${50 + (diffCentsFromString / 50) * 46}%` }}
              />
            )}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-slate-500 dark:text-slate-400">
            <span>سفت‌تر کنید (بم)</span>
            <span>کوک دقیق (۰¢)</span>
            <span>شل‌تر کنید (زیر)</span>
          </div>
        </div>
      )}
    </div>
  );
};
