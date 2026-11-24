import React, { useEffect, useRef, useState } from 'react';
import { Drum, Play, Square } from 'lucide-react';
import {
  GROOVE_BY_ID,
  IRANIAN_GROOVES,
  IranianPercussionEngine,
  STROKE_LABELS_FA,
  type StrokeType,
} from '../audio/percussion';
import type { IranianGrooveId, PercussionInstrument } from '../types/music';
import { toPersianDigits } from '../utils/persian';

interface TombakDafPanelProps {
  initialBpm?: number;
}

const STROKE_COLORS: Record<StrokeType, string> = {
  tom: 'bg-amber-500 text-slate-950 border-amber-400',
  bak: 'bg-teal-600 text-white border-teal-400',
  pelang: 'bg-sky-500 text-slate-950 border-sky-400',
  riz: 'bg-violet-500 text-white border-violet-400',
  chain: 'bg-emerald-500 text-slate-950 border-emerald-400',
  rest: 'bg-slate-200 text-slate-500 border-slate-300 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700',
};

export const TombakDafPanel: React.FC<TombakDafPanelProps> = ({ initialBpm = 108 }) => {
  const engineRef = useRef<IranianPercussionEngine | null>(null);
  const [grooveId, setGrooveId] = useState<IranianGrooveId>('chaharmezrab_6_8');
  const [instrument, setInstrument] = useState<PercussionInstrument>('tombak');
  const [bpm, setBpm] = useState<number>(initialBpm);
  const [volume, setVolume] = useState<number>(0.78);
  const [playing, setPlaying] = useState<boolean>(false);
  const [activeStep, setActiveStep] = useState<number>(-1);

  if (!engineRef.current) {
    engineRef.current = new IranianPercussionEngine();
  }

  const activeGroove = GROOVE_BY_ID[grooveId] ?? IRANIAN_GROOVES[0];

  useEffect(() => {
    engineRef.current?.configure({
      grooveId,
      instrument,
      bpm,
      volume,
      onStep: (idx) => setActiveStep(idx),
    });
  }, [grooveId, instrument, bpm, volume]);

  useEffect(() => {
    return () => {
      engineRef.current?.stop();
    };
  }, []);

  const togglePlay = () => {
    if (playing) {
      engineRef.current?.stop();
      setPlaying(false);
      setActiveStep(-1);
    } else {
      engineRef.current?.configure({
        grooveId,
        instrument,
        bpm,
        volume,
        onStep: (idx) => setActiveStep(idx),
      });
      engineRef.current?.start();
      setPlaying(true);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/85">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-300">
            <Drum className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
              ضربی‌ساز و هم‌نواز تنبک / دف (تُم · بَک · بشکن · ریز)
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              سنتز آفلاین ریتم‌های اصیل ایرانی برای هم‌نوازی چهارمضراب، رنگ، پیش‌درآمد و لنگ
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            {(
              [
                { id: 'tombak', label: 'تنبک' },
                { id: 'daf', label: 'دف + حلقه' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setInstrument(opt.id)}
                className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
                  instrument === opt.id
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={togglePlay}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-extrabold text-white shadow-sm transition ${
              playing ? 'bg-rose-600 hover:bg-rose-700' : 'bg-teal-600 hover:bg-teal-700'
            }`}
          >
            {playing ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {playing ? 'توقف ریتم' : 'شروع هم‌نوازی'}
          </button>
        </div>
      </div>

      {/* 8 Authentic Iranian Grooves */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {IRANIAN_GROOVES.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => {
              setGrooveId(g.id);
              setBpm(g.defaultBpm);
            }}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              grooveId === g.id
                ? 'bg-teal-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            {g.nameFa}
          </button>
        ))}
      </div>

      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        {activeGroove.descriptionFa}
      </p>

      {/* Visual Step Sequencer Grid */}
      <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-8">
        {activeGroove.steps.map((stroke, idx) => {
          const isCurrent = playing && activeStep === idx;
          return (
            <div
              key={`${activeGroove.id}-${idx}`}
              className={`rounded-xl border px-2 py-2.5 text-center transition ${
                STROKE_COLORS[stroke]
              } ${isCurrent ? 'scale-105 ring-2 ring-white shadow-lg' : 'opacity-85'}`}
            >
              <div className="text-[10px] opacity-80">ضرب {toPersianDigits(idx + 1)}</div>
              <div className="mt-0.5 text-xs font-black">{STROKE_LABELS_FA[stroke]}</div>
            </div>
          );
        })}
      </div>

      {/* BPM & Volume Sliders */}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-xl bg-slate-100/80 px-3 py-2 dark:bg-slate-800/70">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
            تمپو ({toPersianDigits(bpm)} BPM)
          </span>
          <input
            type="range"
            min={50}
            max={185}
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
            className="flex-1 accent-amber-500"
          />
        </div>

        <div className="flex items-center gap-3 rounded-xl bg-slate-100/80 px-3 py-2 dark:bg-slate-800/70">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
            شدت صدا ({toPersianDigits(Math.round(volume * 100))}٪)
          </span>
          <input
            type="range"
            min={0.15}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="flex-1 accent-teal-500"
          />
        </div>
      </div>
    </div>
  );
};
