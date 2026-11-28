import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Feather, Play, Square, Wind } from 'lucide-react';
import { playGushehPhrase, playPersianNote } from '../audio/karplusStrong';
import { alignPoetryToGusheh } from '../core/prosodySyllables';
import type { Gusheh, InstrumentId, KoronMode } from '../types/music';
import { toPersianDigits } from '../utils/persian';

interface ProsodyAvazPanelProps {
  gusheh: Gusheh;
  instrument: InstrumentId;
  a4Hz: number;
  koronMode: KoronMode;
}

export const ProsodyAvazPanel: React.FC<ProsodyAvazPanelProps> = ({
  gusheh,
  instrument,
  a4Hz,
  koronMode,
}) => {
  const [customVerse, setCustomVerse] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeSlotIdx, setActiveSlotIdx] = useState<number | null>(null);
  const playbackRef = useRef<{ stop: () => void } | null>(null);

  const alignment = useMemo(
    () => alignPoetryToGusheh(gusheh, customVerse),
    [gusheh, customVerse]
  );

  useEffect(() => {
    return () => {
      playbackRef.current?.stop();
    };
  }, [gusheh.id]);

  const handleTogglePlay = () => {
    if (isPlaying) {
      playbackRef.current?.stop();
      playbackRef.current = null;
      setIsPlaying(false);
      setActiveSlotIdx(null);
      return;
    }

    setIsPlaying(true);
    playbackRef.current = playGushehPhrase(gusheh.melody, {
      instrument,
      bpm: Math.max(62, Math.round(gusheh.practiceLoop.defaultBpm * 0.85)),
      speedMultiplier: 1,
      a4Hz,
      koronMode,
      startIndex: 0,
      endIndex: gusheh.melody.length - 1,
      loop: false,
      enableOrnaments: false,
      scale: gusheh.scale,
      onNoteStart: (idx) => setActiveSlotIdx(idx),
      onComplete: () => {
        setIsPlaying(false);
        setActiveSlotIdx(null);
      },
    });
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Feather className="w-4 h-4 text-rose-400" />
            تلفیق شعر و نت با تقطیع عروضی (آواز و تصنیف‌خوانی)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            چیدمان هجاهای شعر زیر نت‌های گوشه همراه با نشانگر هجای بلند (—) / کوتاه (◡)، محل نفس‌گیری (❟) و نقطه شروع تحریر (〰).
          </p>
        </div>

        <button
          type="button"
          onClick={handleTogglePlay}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white cursor-pointer"
        >
          {isPlaying ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          {isPlaying ? 'توقف هم‌خوانی' : 'پخش هم‌زمان نت و هجا'}
        </button>
      </div>

      {/* Classical Ghazal Header & Meter */}
      <div className="rounded-xl border border-rose-500/25 bg-rose-950/15 p-3 space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-bold text-rose-300 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5" />
            {alignment.poetFa}
          </span>
          <span className="text-[11px] text-amber-300">
            {alignment.meterNameFa} • {alignment.aruzPatternFa}
          </span>
        </div>
        <p className="text-sm font-semibold text-slate-100 leading-relaxed">
          {alignment.fullCoupletFa}
        </p>
        <p className="text-[11px] text-slate-300 leading-relaxed">
          راهنمای آوازی: {alignment.performanceTipFa}
        </p>
      </div>

      {/* Optional custom Persian verse input */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={customVerse}
          onChange={(e) => setCustomVerse(e.target.value)}
          placeholder="دلخواه: مصراع فارسی خودتان را بنویسید تا زیر نت‌ها تقطیع هجایی شود..."
          className="flex-1 min-w-[220px] rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-rose-400"
        />
        {customVerse && (
          <button
            type="button"
            onClick={() => setCustomVerse('')}
            className="px-3 py-2 rounded-xl text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
          >
            بازگشت به غزل کلاسیک
          </button>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
        <span className="inline-flex items-center gap-1">
          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-bold">—</span> هجای بلند
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-sky-300 font-bold">◡</span> هجای کوتاه
        </span>
        <span className="inline-flex items-center gap-1 text-emerald-300">
          <Wind className="w-3.5 h-3.5" /> ❟ محل نفس‌گیری
        </span>
        <span className="inline-flex items-center gap-1 text-rose-300">
          〰 نقطه شروع تحریر
        </span>
      </div>

      {/* Aligned Staff-Note + Syllable + Prosody Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
        {alignment.slots.map((slot) => {
          const active = activeSlotIdx === slot.noteIndex;
          return (
            <button
              key={slot.noteIndex}
              type="button"
              onClick={() => {
                setActiveSlotIdx(slot.noteIndex);
                playPersianNote(slot.note, {
                  instrument,
                  durationSec: 0.75,
                  a4Hz,
                  koronMode,
                  enableOrnaments: false,
                  scale: gusheh.scale,
                });
              }}
              className={`rounded-xl border p-2.5 text-center transition cursor-pointer flex flex-col items-center gap-1 ${
                active
                  ? 'bg-rose-500/25 border-rose-400 scale-105 shadow-md'
                  : slot.isTahrirStart
                  ? 'bg-amber-950/30 border-amber-500/40 hover:border-amber-400'
                  : 'bg-slate-950/70 border-slate-800 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center justify-between w-full text-[10px] text-slate-500">
                <span>{toPersianDigits(slot.noteIndex + 1)}</span>
                <span className={slot.weight === 'long' ? 'text-amber-300 font-bold' : 'text-sky-300 font-bold'}>
                  {slot.weight === 'long' ? '—' : '◡'}
                </span>
              </div>

              <div className="text-xs font-bold text-teal-300">{slot.noteLabelFa}</div>

              <div className="text-sm font-extrabold text-slate-100">{slot.syllableFa}</div>

              <div className="flex items-center justify-center gap-1 min-h-[16px]">
                {slot.isTahrirStart && (
                  <span className="px-1.5 py-0.5 rounded bg-rose-500/25 text-[10px] text-rose-200 font-bold">
                    〰 تحریر
                  </span>
                )}
                {slot.isBreathPoint && (
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-[10px] text-emerald-300 font-bold">
                    ❟ نفس
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
