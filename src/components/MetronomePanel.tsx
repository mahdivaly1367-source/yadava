import React, { useEffect, useRef, useState } from 'react';
import { Hand, Play, Square } from 'lucide-react';
import {
  computeTapTempoBpm,
  IRANIAN_METERS,
  PrecisionMetronome,
  type MetronomeTickInfo,
} from '../audio/metronome';
import type { IranianMeter, Subdivision } from '../types/music';
import { toPersianDigits } from '../utils/persian';

interface MetronomePanelProps {
  meter: IranianMeter;
  bpm: number;
  onChangeMeter: (meter: IranianMeter) => void;
  onChangeBpm: (bpm: number) => void;
}

const METER_LIST: IranianMeter[] = ['2/4', '3/4', '4/4', '5/8', '6/8', '7/8'];

export const MetronomePanel: React.FC<MetronomePanelProps> = ({
  meter,
  bpm,
  onChangeMeter,
  onChangeBpm,
}) => {
  const [subdivision, setSubdivision] = useState<Subdivision>(1);
  const [running, setRunning] = useState(false);
  const [lastTick, setLastTick] = useState<MetronomeTickInfo | null>(null);
  const metronomeRef = useRef<PrecisionMetronome | null>(null);
  const tapTimesRef = useRef<number[]>([]);

  useEffect(() => {
    const m = new PrecisionMetronome();
    metronomeRef.current = m;
    return () => {
      m.stop();
    };
  }, []);

  useEffect(() => {
    metronomeRef.current?.configure({
      bpm,
      meter,
      subdivision,
      onTick: (tick) => setLastTick(tick),
    });
  }, [bpm, meter, subdivision]);

  const toggleRun = () => {
    const m = metronomeRef.current;
    if (!m) return;
    if (running) {
      m.stop();
      setRunning(false);
      setLastTick(null);
    } else {
      m.configure({ bpm, meter, subdivision, onTick: (t) => setLastTick(t) });
      m.start();
      setRunning(true);
    }
  };

  const handleTapTempo = () => {
    const now = performance.now();
    if (tapTimesRef.current.length > 0 && now - tapTimesRef.current[tapTimesRef.current.length - 1] > 2200) {
      tapTimesRef.current = [];
    }
    tapTimesRef.current.push(now);
    const detected = computeTapTempoBpm(tapTimesRef.current);
    if (detected !== null) {
      onChangeBpm(detected);
    }
  };

  const def = IRANIAN_METERS[meter];

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/85">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
            مترونوم دقیق Web Audio (میزان‌های ایرانی)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {def.labelFa} — {def.categoryFa}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleTapTempo}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-200 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <Hand className="h-3.5 w-3.5 text-amber-500" />
            لمس ضرب
          </button>
          <button
            type="button"
            onClick={toggleRun}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition ${
              running ? 'bg-rose-500 hover:bg-rose-600' : 'bg-teal-600 hover:bg-teal-700'
            }`}
          >
            {running ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {running ? 'توقف' : 'شروع'}
          </button>
        </div>
      </div>

      {/* Visual Tonbak Pulse Lamps */}
      <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-slate-100/80 py-3 dark:bg-slate-800/70">
        {def.accentPattern.map((accent, idx) => {
          const isCurrent = running && lastTick?.pulseIndex === idx && lastTick?.subIndex === 0;
          const isSubActive = running && lastTick?.pulseIndex === idx && (lastTick?.subIndex ?? 0) > 0;
          return (
            <div key={idx} className="flex flex-col items-center gap-1">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full border text-xs font-extrabold transition-all duration-75 ${
                  isCurrent
                    ? accent === 'tom'
                      ? 'scale-110 border-amber-400 bg-amber-500 text-slate-950 shadow-md shadow-amber-500/40'
                      : 'scale-105 border-teal-400 bg-teal-500 text-white shadow-md shadow-teal-500/35'
                    : isSubActive
                    ? 'border-sky-400 bg-sky-500/30 text-sky-200'
                    : 'border-slate-300 bg-white text-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-400'
                }`}
              >
                {toPersianDigits(idx + 1)}
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                {accent === 'tom' ? 'تُم' : accent === 'pelang' ? 'پُلَنگ' : 'بَک'}
              </span>
            </div>
          );
        })}
      </div>

      {/* Meters, BPM, Subdivisions */}
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div>
          <div className="mb-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
            میزان ایرانی
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {METER_LIST.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onChangeMeter(m)}
                className={`rounded-lg py-1.5 text-xs font-bold transition ${
                  meter === m
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {toPersianDigits(m)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300">
            <span>تندا (BPM)</span>
            <span className="ltr-num font-extrabold text-teal-600 dark:text-teal-300">
              {bpm} BPM
            </span>
          </div>
          <input
            type="range"
            min={40}
            max={220}
            value={bpm}
            onChange={(e) => onChangeBpm(Number(e.target.value))}
            className="mt-1 w-full accent-teal-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-500">
            <button
              type="button"
              onClick={() => onChangeBpm(Math.max(40, bpm - 5))}
              className="rounded bg-slate-200 px-2 py-0.5 font-bold dark:bg-slate-700"
            >
              -۵
            </button>
            <span>آهسته ← تند</span>
            <button
              type="button"
              onClick={() => onChangeBpm(Math.min(220, bpm + 5))}
              className="rounded bg-slate-200 px-2 py-0.5 font-bold dark:bg-slate-700"
            >
              +۵
            </button>
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
            ریزتقسیم ضرب
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {([1, 2, 3] as Subdivision[]).map((sub) => (
              <button
                key={sub}
                type="button"
                onClick={() => setSubdivision(sub)}
                className={`rounded-lg py-2 text-xs font-bold transition ${
                  subdivision === sub
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {toPersianDigits(sub)}×
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
