import React, { useEffect, useRef, useState } from 'react';
import { Drum, Play, Plus, RotateCcw, Save, Square, Trash2 } from 'lucide-react';
import {
  GROOVE_BY_ID,
  IRANIAN_GROOVES,
  IranianPercussionEngine,
  STROKE_LABELS_FA,
  type StrokeType,
} from '../audio/percussion';
import { CUSTOM_GROOVES_STORAGE_PREFIX } from '../core/backupRestore';
import type { IranianGrooveId, PercussionInstrument } from '../types/music';
import { toPersianDigits } from '../utils/persian';

interface SavedCustomGroove {
  id: string;
  nameFa: string;
  bpm: number;
  steps: StrokeType[];
}

interface TombakDafPanelProps {
  ownerUid?: string;
  initialBpm?: number;
  initialGrooveId?: IranianGrooveId;
}

const STROKE_CYCLE: StrokeType[] = ['tom', 'bak', 'pelang', 'riz', 'chain', 'rest'];

const STROKE_COLORS: Record<StrokeType, string> = {
  tom: 'bg-amber-500 text-slate-950 border-amber-400',
  bak: 'bg-teal-600 text-white border-teal-400',
  pelang: 'bg-sky-500 text-slate-950 border-sky-400',
  riz: 'bg-violet-500 text-white border-violet-400',
  chain: 'bg-emerald-500 text-slate-950 border-emerald-400',
  rest: 'bg-slate-200 text-slate-500 border-slate-300 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700',
};

function loadScopedCustomGrooves(ownerUid: string): SavedCustomGroove[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(
      `${CUSTOM_GROOVES_STORAGE_PREFIX}${ownerUid || 'guest'}`
    );
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveScopedCustomGrooves(ownerUid: string, grooves: SavedCustomGroove[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(
      `${CUSTOM_GROOVES_STORAGE_PREFIX}${ownerUid || 'guest'}`,
      JSON.stringify(grooves)
    );
  } catch {
    // ignore storage quota errors
  }
}

export const TombakDafPanel: React.FC<TombakDafPanelProps> = ({
  ownerUid = 'guest',
  initialBpm = 108,
  initialGrooveId = 'chaharmezrab_6_8',
}) => {
  const engineRef = useRef<IranianPercussionEngine | null>(null);
  const [grooveId, setGrooveId] = useState<IranianGrooveId>(initialGrooveId);
  const [instrument, setInstrument] = useState<PercussionInstrument>('tombak');
  const [bpm, setBpm] = useState<number>(initialBpm);
  const [volume, setVolume] = useState<number>(0.78);
  const [playing, setPlaying] = useState<boolean>(false);
  const [activeStep, setActiveStep] = useState<number>(-1);

  // Interactive Custom Step Sequencer state
  const [customSteps, setCustomSteps] = useState<StrokeType[] | null>(null);
  const [customName, setCustomName] = useState<string>('');
  const [savedGrooves, setSavedGrooves] = useState<SavedCustomGroove[]>(() =>
    loadScopedCustomGrooves(ownerUid)
  );
  const [statusFa, setStatusFa] = useState<string | null>(null);

  if (!engineRef.current) {
    engineRef.current = new IranianPercussionEngine();
  }

  useEffect(() => {
    setSavedGrooves(loadScopedCustomGrooves(ownerUid));
    setCustomSteps(null);
  }, [ownerUid]);

  const activeGroove = GROOVE_BY_ID[grooveId] ?? IRANIAN_GROOVES[0];
  const displayedSteps = customSteps ?? activeGroove.steps;

  useEffect(() => {
    engineRef.current?.configure({
      grooveId,
      customSteps,
      instrument,
      bpm,
      volume,
      onStep: (idx) => setActiveStep(idx),
    });
  }, [grooveId, customSteps, instrument, bpm, volume]);

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
        customSteps,
        instrument,
        bpm,
        volume,
        onStep: (idx) => setActiveStep(idx),
      });
      engineRef.current?.start();
      setPlaying(true);
    }
  };

  const handleCycleStep = (idx: number) => {
    const base = [...displayedSteps];
    const currentIdx = STROKE_CYCLE.indexOf(base[idx]);
    base[idx] = STROKE_CYCLE[(currentIdx + 1) % STROKE_CYCLE.length];
    setCustomSteps(base);
    setStatusFa(null);
  };

  const handleStepCountChange = (newLen: number) => {
    const clamped = Math.max(4, Math.min(12, newLen));
    const base = [...displayedSteps];
    while (base.length < clamped) base.push('rest');
    setCustomSteps(base.slice(0, clamped));
  };

  const handleSaveCustomGroove = () => {
    const label =
      customName.trim() || `الگوی سفارشی ${toPersianDigits(savedGrooves.length + 1)}`;
    const next: SavedCustomGroove[] = [
      {
        id: `cg_${Date.now()}`,
        nameFa: label,
        bpm,
        steps: [...displayedSteps],
      },
      ...savedGrooves,
    ].slice(0, 12);
    setSavedGrooves(next);
    saveScopedCustomGrooves(ownerUid, next);
    setCustomName('');
    setStatusFa(`ریتم «${label}» با موفقیت در پروفایل شما ذخیره شد.`);
  };

  const handleDeleteCustomGroove = (id: string) => {
    const next = savedGrooves.filter((g) => g.id !== id);
    setSavedGrooves(next);
    saveScopedCustomGrooves(ownerUid, next);
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
              ضربی‌ساز و ویرایشگر ریتم تنبک / دف (تعاملی ۴ تا ۱۲ ضرب)
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              روی هر خانه ضرب کلیک کنید تا نوع ضرب (تُم، بَک، بشکن، ریز، حلقه، سکوت) تغییر کند
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
              setCustomSteps(null);
              setBpm(g.defaultBpm);
            }}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              grooveId === g.id && !customSteps
                ? 'bg-teal-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            {g.nameFa}
          </button>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span>
          {customSteps
            ? `حالت ویرایش سفارشی (${toPersianDigits(displayedSteps.length)} ضرب) — روی خانه‌ها کلیک کنید`
            : activeGroove.descriptionFa}
        </span>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-[11px] font-bold">
            تعداد ضرب:
            <select
              value={displayedSteps.length}
              onChange={(e) => handleStepCountChange(Number(e.target.value))}
              className="rounded-lg border border-slate-300 bg-white px-2 py-0.5 text-xs dark:border-slate-700 dark:bg-slate-800"
            >
              {[4, 5, 6, 7, 8, 9, 10, 12].map((n) => (
                <option key={n} value={n}>
                  {toPersianDigits(n)} ضرب
                </option>
              ))}
            </select>
          </label>
          {customSteps && (
            <button
              type="button"
              onClick={() => setCustomSteps(null)}
              className="inline-flex items-center gap-1 rounded-lg bg-slate-200 px-2 py-1 text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              <RotateCcw className="h-3 w-3" />
              بازگشت به پیش‌فرض
            </button>
          )}
        </div>
      </div>

      {/* Interactive Clickable Step Sequencer Grid */}
      <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
        {displayedSteps.map((stroke, idx) => {
          const isCurrent = playing && activeStep === idx;
          return (
            <button
              key={`step-${idx}`}
              type="button"
              onClick={() => handleCycleStep(idx)}
              title="کلیک برای تغییر نوع ضرب"
              className={`rounded-xl border px-2 py-2.5 text-center transition hover:brightness-110 active:scale-95 ${
                STROKE_COLORS[stroke]
              } ${isCurrent ? 'scale-105 ring-2 ring-white shadow-lg' : 'opacity-90'}`}
            >
              <div className="text-[10px] opacity-80">ضرب {toPersianDigits(idx + 1)}</div>
              <div className="mt-0.5 text-xs font-black">{STROKE_LABELS_FA[stroke]}</div>
            </button>
          );
        })}
      </div>

      {/* Save Custom Rhythm Bar */}
      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50/75 p-2.5 dark:border-slate-800 dark:bg-slate-800/50">
        <Plus className="h-4 w-4 text-teal-500" />
        <input
          type="text"
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          placeholder="نام ریتم سفارشی برای ذخیره (مثلاً رنگ محلی ۷ ضربی)..."
          className="flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
        />
        <button
          type="button"
          onClick={handleSaveCustomGroove}
          className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-700"
        >
          <Save className="h-3.5 w-3.5" />
          ذخیره الگوی سفارشی
        </button>
      </div>

      {statusFa && (
        <div className="mt-2 rounded-lg bg-emerald-500/12 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          {statusFa}
        </div>
      )}

      {/* Saved Custom Grooves Chips */}
      {savedGrooves.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold text-slate-500">ریتم‌های ذخیره شده شما:</span>
          {savedGrooves.map((sg) => (
            <div
              key={sg.id}
              className="inline-flex items-center gap-1 rounded-xl border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-800 dark:text-amber-300"
            >
              <button
                type="button"
                onClick={() => {
                  setCustomSteps([...sg.steps]);
                  setBpm(sg.bpm);
                }}
              >
                {sg.nameFa} ({toPersianDigits(sg.steps.length)} ضرب)
              </button>
              <button
                type="button"
                onClick={() => handleDeleteCustomGroove(sg.id)}
                aria-label="حذف ریتم سفارشی"
                className="text-rose-500 hover:text-rose-600"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

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
