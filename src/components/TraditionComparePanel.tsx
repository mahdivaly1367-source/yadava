import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeftRight, Play, Sparkles, Square } from 'lucide-react';
import { playGushehPhrase, type PhrasePlaybackHandle } from '../audio/karplusStrong';
import { compareRadifTraditions } from '../core/traditionComparison';
import { formatNoteFa } from '../data/musicTheory';
import { RADIF_TRADITIONS } from '../data/radifTraditions';
import type { Gusheh, InstrumentId, RadifTraditionId } from '../types/music';
import { ORNAMENT_LABELS_FA, toPersianDigits } from '../utils/persian';

interface TraditionComparePanelProps {
  gusheh: Gusheh;
  instrument: InstrumentId;
  a4Hz: number;
}

export const TraditionComparePanel: React.FC<TraditionComparePanelProps> = ({
  gusheh,
  instrument,
  a4Hz,
}) => {
  const [tradA, setTradA] = useState<RadifTraditionId>('mirza_abdollah');
  const [tradB, setTradB] = useState<RadifTraditionId>('mahmoud_karimi');
  const [playingSide, setPlayingSide] = useState<'A' | 'B' | 'AB' | null>(null);
  const [activeNoteIdx, setActiveNoteIdx] = useState<number | null>(null);
  const handleRef = useRef<PhrasePlaybackHandle | null>(null);

  const report = useMemo(
    () => compareRadifTraditions(gusheh, tradA, tradB),
    [gusheh, tradA, tradB]
  );

  const stopPlayback = () => {
    handleRef.current?.stop();
    handleRef.current = null;
    setPlayingSide(null);
    setActiveNoteIdx(null);
  };

  useEffect(() => {
    return () => {
      handleRef.current?.stop();
    };
  }, []);

  const playVariant = (side: 'A' | 'B', thenChainB = false) => {
    stopPlayback();
    const variant = side === 'A' ? report.variantA : report.variantB;
    setPlayingSide(thenChainB ? 'AB' : side);

    handleRef.current = playGushehPhrase(variant.melody, {
      instrument,
      bpm: variant.recommendedBpm,
      speedMultiplier: 1,
      a4Hz,
      koronMode: variant.recommendedKoronMode,
      startIndex: 0,
      endIndex: variant.melody.length - 1,
      loop: false,
      enableOrnaments: false,
      scale: gusheh.scale,
      onNoteStart: (idx) => setActiveNoteIdx(idx),
      onComplete: () => {
        if (thenChainB) {
          playVariant('B', false);
        } else {
          setPlayingSide(null);
          setActiveNoteIdx(null);
        }
      },
    });
  };

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/85">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white">
            <ArrowLeftRight className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            مقایسه زنده دو روایت ردیف (A/B) — {gusheh.nameFa}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            تفاوت جمله‌بندی، زینت‌گذاری، کشش و کوک کُرُن بین روایت‌های سازی و آوازی را هم‌زمان ببینید و بشنوید.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {playingSide ? (
            <button
              type="button"
              onClick={stopPlayback}
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-extrabold text-white hover:bg-rose-500 cursor-pointer"
            >
              <Square className="h-3.5 w-3.5" />
              توقف مقایسه
            </button>
          ) : (
            <button
              type="button"
              onClick={() => playVariant('A', true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-3 py-1.5 text-xs font-extrabold text-white hover:bg-teal-500 cursor-pointer"
            >
              <Play className="h-3.5 w-3.5" />
              پخش متوالی A ← B
            </button>
          )}
        </div>
      </div>

      {/* Tradition A & B Pickers */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {[
          {
            side: 'A' as const,
            value: tradA,
            onChange: setTradA,
            variant: report.variantA,
            badgeCls: 'bg-teal-600 text-white',
            borderCls: 'border-teal-500/40 bg-teal-50/40 dark:bg-teal-950/20',
          },
          {
            side: 'B' as const,
            value: tradB,
            onChange: setTradB,
            variant: report.variantB,
            badgeCls: 'bg-amber-500 text-slate-950',
            borderCls: 'border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/20',
          },
        ].map(({ side, value, onChange, variant, badgeCls, borderCls }) => (
          <div key={side} className={`rounded-xl border p-3 space-y-2.5 ${borderCls}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className={`rounded-lg px-2 py-0.5 text-xs font-black ${badgeCls}`}>
                  روایت {side}
                </span>
                <select
                  value={value}
                  onChange={(e) => onChange(e.target.value as RadifTraditionId)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  {RADIF_TRADITIONS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nameFa}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => playVariant(side, false)}
                className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 cursor-pointer"
              >
                <Play className="h-3 w-3" />
                شنیدن {side}
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 text-[10px] font-bold">
              <span className="rounded-md bg-white/80 px-2 py-0.5 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {variant.categoryFa}
              </span>
              <span className="rounded-md bg-white/80 px-2 py-0.5 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                تمپو: {toPersianDigits(variant.recommendedBpm)} BPM
              </span>
              <span className="rounded-md bg-white/80 px-2 py-0.5 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                کُرُن: {variant.recommendedKoronMode === 'traditional_56' ? 'سنتی -۵۶¢' : 'استاندارد -۵۰¢'}
              </span>
            </div>

            <p className="text-[11px] leading-relaxed text-slate-700 dark:text-slate-300">
              {variant.phrasingFa}
            </p>

            {/* Note-by-note ornamentation diff chips */}
            <div className="flex flex-wrap gap-1">
              {variant.melody.map((n, idx) => {
                const otherNote =
                  side === 'A' ? report.variantB.melody[idx] : report.variantA.melody[idx];
                const diffOrn = otherNote && otherNote.ornament !== n.ornament;
                const isAct = activeNoteIdx === idx && (playingSide === side || playingSide === 'AB');
                return (
                  <div
                    key={idx}
                    className={`rounded-lg border px-1.5 py-1 text-[10px] font-bold transition ${
                      isAct
                        ? 'border-teal-500 bg-teal-600 text-white scale-105'
                        : diffOrn
                          ? 'border-amber-400 bg-amber-100/80 text-amber-950 dark:bg-amber-900/40 dark:text-amber-200'
                          : 'border-slate-200 bg-white/90 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <div>{formatNoteFa(n)}</div>
                    <div className="text-[9px] opacity-80">
                      {n.ornament ? ORNAMENT_LABELS_FA[n.ornament] : 'ساده'} • {toPersianDigits(n.durationBeats)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Automated Analytical Diff Summary */}
      <div className="rounded-xl border border-slate-200/80 bg-slate-50/75 p-3 dark:border-slate-800 dark:bg-slate-800/40">
        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-extrabold text-slate-800 dark:text-slate-100">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          تحلیل تفاوت‌های کلیدی بین دو روایت
        </div>
        <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
          {report.keyDifferencesFa.map((line, i) => (
            <li key={i}>• {line}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};
