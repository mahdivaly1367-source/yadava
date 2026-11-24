import React, { useEffect, useRef, useState } from 'react';
import { Radio, Volume2, VolumeX } from 'lucide-react';
import { computeDroneFrequencies, PersianDroneEngine } from '../audio/drone';
import { formatNoteFa } from '../data/musicTheory';
import type {
  DroneTimbre,
  DroneVoicing,
  Gusheh,
  KoronMode,
} from '../types/music';
import { toPersianDigits } from '../utils/persian';

interface DronePanelProps {
  gusheh: Gusheh;
  a4Hz: number;
  koronMode: KoronMode;
}

const TIMBRE_LABELS: Record<DroneTimbre, string> = {
  tanbur: 'تنبور / تار پیوسته',
  ney: 'نی / واخوان گرم',
  kamancheh: 'کمانچه / آرشه',
};

const VOICING_LABELS: Record<DroneVoicing, string> = {
  base: 'فقط پایه (ایست)',
  base_fifth: 'پایه + پنجم درست',
  base_shahed: 'پایه + نت شاهد',
};

export const DronePanel: React.FC<DronePanelProps> = ({
  gusheh,
  a4Hz,
  koronMode,
}) => {
  const engineRef = useRef<PersianDroneEngine | null>(null);
  const [active, setActive] = useState(false);
  const [timbre, setTimbre] = useState<DroneTimbre>('tanbur');
  const [voicing, setVoicing] = useState<DroneVoicing>('base_shahed');
  const [volume, setVolume] = useState(0.55);

  if (!engineRef.current) {
    engineRef.current = new PersianDroneEngine();
  }

  const droneConfig = {
    baseNote: gusheh.ist,
    shahedNote: gusheh.shahed,
    voicing,
    timbre,
    volume,
    a4Hz,
    koronMode,
  };

  useEffect(() => {
    if (active) {
      engineRef.current?.update(droneConfig);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, gusheh.id, gusheh.ist, gusheh.shahed, timbre, voicing, volume, a4Hz, koronMode]);

  useEffect(() => {
    return () => {
      engineRef.current?.stop();
    };
  }, []);

  const toggleDrone = () => {
    if (active) {
      engineRef.current?.stop();
      setActive(false);
    } else {
      engineRef.current?.start(droneConfig);
      setActive(true);
    }
  };

  const freqs = computeDroneFrequencies(droneConfig);

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/85">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/15 text-teal-600 dark:text-teal-300">
            <Radio className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
              واخوان / پِدال هوشمند دستگاه (Drone Companion)
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              هماهنگ خودکار با ایست ({formatNoteFa(gusheh.ist)}) و شاهد ({formatNoteFa(gusheh.shahed)}) • فرکانس‌ها:{' '}
              <span className="ltr-num font-semibold text-teal-600 dark:text-teal-300">
                {freqs.map((f) => `${f.toFixed(1)}Hz`).join(' · ')}
              </span>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={toggleDrone}
          className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-extrabold text-white shadow-sm transition ${
            active
              ? 'bg-emerald-600 hover:bg-emerald-700'
              : 'bg-slate-800 hover:bg-slate-700 dark:bg-teal-600 dark:hover:bg-teal-700'
          }`}
        >
          {active ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          {active ? 'واخوان روشن است (توقف)' : 'روشن‌کردن واخوان'}
        </button>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* Timbre */}
        <div>
          <div className="mb-1 text-[11px] font-bold text-slate-500 dark:text-slate-400">
            رنگ صدای واخوان:
          </div>
          <div className="flex flex-wrap gap-1">
            {(['tanbur', 'ney', 'kamancheh'] as DroneTimbre[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTimbre(t)}
                className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${
                  timbre === t
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {TIMBRE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        {/* Voicing */}
        <div>
          <div className="mb-1 text-[11px] font-bold text-slate-500 dark:text-slate-400">
            آکورد واخوان:
          </div>
          <div className="flex flex-wrap gap-1">
            {(['base', 'base_fifth', 'base_shahed'] as DroneVoicing[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVoicing(v)}
                className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${
                  voicing === v
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {VOICING_LABELS[v]}
              </button>
            ))}
          </div>
        </div>

        {/* Volume */}
        <div>
          <div className="mb-1 flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
            <span>حجم صدا</span>
            <span>{toPersianDigits(Math.round(volume * 100))}٪</span>
          </div>
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="mt-1.5 w-full accent-teal-500"
          />
        </div>
      </div>
    </div>
  );
};
