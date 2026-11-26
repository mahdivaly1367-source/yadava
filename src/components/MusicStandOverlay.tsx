import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Maximize2,
  Play,
  Repeat,
  Sparkles,
  Square,
  Sun,
  X,
} from 'lucide-react';
import { buildMelodyFingeringGuide } from '../core/fingeringGuide';
import { alignPoetryToGusheh } from '../core/prosodySyllables';
import { createWakeLockController } from '../core/wakeLock';
import { formatNoteFa } from '../data/musicTheory';
import type {
  Gusheh,
  InstrumentId,
  KoronMode,
  PitchAnalysisFrame,
} from '../types/music';
import { INSTRUMENT_LABELS_FA, toPersianDigits } from '../utils/persian';
import { PersianStaffNotation } from './PersianStaffNotation';

interface MusicStandOverlayProps {
  open: boolean;
  onClose: () => void;
  gusheh: Gusheh;
  instrument: InstrumentId;
  a4Hz: number;
  koronMode: KoronMode;
  bpm: number;
  speedMultiplier: number;
  isPlaying: boolean;
  loopEnabled: boolean;
  enableOrnaments: boolean;
  activeNoteIdx: number | null;
  livePitch: PitchAnalysisFrame | null;
  onTogglePlay: () => void;
  onToggleLoop: () => void;
  onToggleOrnaments: () => void;
  onSelectNote?: (idx: number) => void;
}

export const MusicStandOverlay: React.FC<MusicStandOverlayProps> = ({
  open,
  onClose,
  gusheh,
  instrument,
  a4Hz,
  koronMode,
  bpm,
  speedMultiplier,
  isPlaying,
  loopEnabled,
  enableOrnaments,
  activeNoteIdx,
  livePitch,
  onTogglePlay,
  onToggleLoop,
  onToggleOrnaments,
  onSelectNote,
}) => {
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [showFingering, setShowFingering] = useState(true);
  const [showSyllables, setShowSyllables] = useState(true);
  const wakeLockRef = useRef(createWakeLockController());

  const fingering = useMemo(
    () => buildMelodyFingeringGuide(gusheh.melody, a4Hz, koronMode),
    [gusheh.melody, a4Hz, koronMode]
  );

  const prosody = useMemo(() => alignPoetryToGusheh(gusheh), [gusheh]);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    const ctrl = wakeLockRef.current;

    const acquire = async () => {
      const ok = await ctrl.acquire();
      if (mounted) setWakeLockActive(ok);
    };
    void acquire();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void acquire();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      mounted = false;
      document.removeEventListener('visibilitychange', handleVisibility);
      void ctrl.release();
      setWakeLockActive(false);
    };
  }, [open]);

  if (!open) return null;

  const isStringNeck = instrument === 'tar' || instrument === 'setar' || instrument === 'tanbur';

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/98 backdrop-blur-md flex flex-col justify-between p-4 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="حالت پایه نت تمام‌صفحه"
    >
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-500/20 border border-teal-400/40 flex items-center justify-center">
            <Maximize2 className="w-4 h-4 text-teal-300" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-100">
              حالت پایه نت — {gusheh.nameFa}
            </h2>
            <p className="text-xs text-slate-400">
              ساز: {INSTRUMENT_LABELS_FA[instrument]} • شاهد: {formatNoteFa(gusheh.shahed, false)} • ایست:{' '}
              {formatNoteFa(gusheh.ist, false)} • تمپو: {toPersianDigits(Math.round(bpm * speedMultiplier))} BPM
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
              wakeLockActive
                ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
                : 'bg-slate-800 border-slate-700 text-slate-300'
            }`}
          >
            <Sun className="w-3.5 h-3.5" />
            {wakeLockActive ? 'صفحه روشن می‌ماند (Wake Lock فعال)' : 'حالت پایه نت فعال'}
          </span>

          <button
            type="button"
            onClick={() => setShowSyllables((v) => !v)}
            className={`px-2.5 py-1.5 rounded-xl text-xs border cursor-pointer ${
              showSyllables
                ? 'bg-rose-500/20 border-rose-400/50 text-rose-200'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            هجاهای شعر
          </button>

          {isStringNeck && (
            <button
              type="button"
              onClick={() => setShowFingering((v) => !v)}
              className={`px-2.5 py-1.5 rounded-xl text-xs border cursor-pointer ${
                showFingering
                  ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              انگشت‌گذاری
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
            بستن
          </button>
        </div>
      </div>

      {/* Main Oversized Staff + Aligned Fingering & Poetry */}
      <div className="my-auto py-4 space-y-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4">
          <PersianStaffNotation
            gusheh={gusheh}
            activeNoteIndex={activeNoteIdx ?? -1}
            loopStart={gusheh.practiceLoop.startIndex}
            loopEnd={gusheh.practiceLoop.endIndex}
            onSelectNote={(idx) => onSelectNote?.(idx)}
            instrument={instrument}
          />
        </div>

        {/* Enlarged Fingering & Prosody Strip */}
        {(showSyllables || (showFingering && isStringNeck)) && (
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
            {gusheh.melody.map((note, idx) => {
              const f = fingering[idx];
              const p = prosody.slots[idx];
              const isAct = activeNoteIdx === idx;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSelectNote?.(idx)}
                  className={`rounded-xl border p-2 text-center transition cursor-pointer ${
                    isAct
                      ? 'bg-teal-500/25 border-teal-400 scale-105'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div className="text-xs font-extrabold text-teal-300">
                    {formatNoteFa(note, false)}
                  </div>
                  {showSyllables && p && (
                    <div className="text-xs font-semibold text-rose-200 mt-0.5">
                      {p.syllableFa}
                      {p.isBreathPoint ? ' ❟' : ''}
                    </div>
                  )}
                  {showFingering && isStringNeck && f && (
                    <div className="text-[10px] text-amber-300 mt-0.5">
                      انگشت {f.fingerCode} • {f.courseId === 'sefid' ? 'سفید' : f.courseId === 'zard' ? 'زرد' : 'بم'}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Transport + Compact Live Microtonal Pitch Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onTogglePlay}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-teal-600 hover:bg-teal-500 text-white cursor-pointer"
          >
            {isPlaying ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {isPlaying ? 'توقف پخش' : 'پخش گوشه'}
          </button>

          <button
            type="button"
            onClick={onToggleLoop}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold border cursor-pointer ${
              loopEnabled
                ? 'bg-amber-500/20 border-amber-400/60 text-amber-200'
                : 'bg-slate-800 border-slate-700 text-slate-300'
            }`}
          >
            <Repeat className="w-4 h-4" />
            تکرار حلقه A-B
          </button>

          <button
            type="button"
            onClick={onToggleOrnaments}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold border cursor-pointer ${
              enableOrnaments
                ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            اجرای زنده زینت‌ها {enableOrnaments ? 'فعال' : 'خاموش'}
          </button>
        </div>

        {/* Compact Live Microtonal Tuner Readout */}
        <div className="flex items-center gap-3 rounded-xl bg-slate-900 border border-slate-800 px-3.5 py-2">
          <span className="text-[11px] text-slate-400">تیونر زنده:</span>
          {livePitch?.frequency ? (
            <>
              <span className="text-sm font-extrabold text-teal-300">{livePitch.noteLabelFa}</span>
              <span
                dir="ltr"
                className={`text-xs font-mono font-bold ${
                  Math.abs(livePitch.centsOffset) <= 8
                    ? 'text-emerald-400'
                    : Math.abs(livePitch.centsOffset) <= 20
                    ? 'text-amber-300'
                    : 'text-rose-400'
                }`}
              >
                {livePitch.centsOffset >= 0 ? `+${livePitch.centsOffset.toFixed(1)}` : livePitch.centsOffset.toFixed(1)}¢
              </span>
            </>
          ) : (
            <span className="text-xs text-slate-500">در انتظار صدای ساز/آواز...</span>
          )}
        </div>
      </div>
    </div>
  );
};
