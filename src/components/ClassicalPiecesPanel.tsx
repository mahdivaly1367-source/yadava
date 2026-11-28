import React, { useEffect, useRef, useState } from 'react';
import { Drum, Lock, Music4, Play, Square } from 'lucide-react';
import { playPersianNote } from '../audio/karplusStrong';
import { IranianPercussionEngine } from '../audio/percussion';
import {
  CLASSICAL_PIECES,
  type ClassicalPieceForm,
  type ClassicalRhythmicPiece,
} from '../data/classicalPieces';
import { formatNoteFa } from '../data/musicTheory';
import type { InstrumentId, KoronMode } from '../types/music';
import { toPersianDigits } from '../utils/persian';

interface ClassicalPiecesPanelProps {
  instrument: InstrumentId;
  a4Hz: number;
  koronMode: KoronMode;
  isPro: boolean;
  onRequestUpgrade: () => void;
}

const FORM_TABS: Array<{ id: ClassicalPieceForm | 'all'; labelFa: string }> = [
  { id: 'all', labelFa: 'همه فرم‌ها' },
  { id: 'pishdaramad', labelFa: 'پیش‌درآمد' },
  { id: 'chaharmezrab', labelFa: 'چهارمضراب' },
  { id: 'tasnif', labelFa: 'تصنیف' },
  { id: 'reng', labelFa: 'رِنگ' },
];

export const ClassicalPiecesPanel: React.FC<ClassicalPiecesPanelProps> = ({
  instrument,
  a4Hz,
  koronMode,
  isPro,
  onRequestUpgrade,
}) => {
  const [filterForm, setFilterForm] = useState<ClassicalPieceForm | 'all'>('all');
  const [playingPieceId, setPlayingPieceId] = useState<string | null>(null);
  const [activeNoteIdx, setActiveNoteIdx] = useState<number>(-1);
  const [withTombak, setWithTombak] = useState<boolean>(true);
  const [tempoMultiplier, setTempoMultiplier] = useState<number>(1.0);

  const percEngineRef = useRef<IranianPercussionEngine | null>(null);
  const timersRef = useRef<number[]>([]);

  if (!percEngineRef.current) {
    percEngineRef.current = new IranianPercussionEngine();
  }

  const stopPlayback = () => {
    for (const id of timersRef.current) window.clearTimeout(id);
    timersRef.current = [];
    percEngineRef.current?.stop();
    setPlayingPieceId(null);
    setActiveNoteIdx(-1);
  };

  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, []);

  const handlePlayPiece = (piece: ClassicalRhythmicPiece) => {
    if (piece.isPro && !isPro) {
      onRequestUpgrade();
      return;
    }
    if (playingPieceId === piece.id) {
      stopPlayback();
      return;
    }
    stopPlayback();

    const effectiveBpm = Math.round(piece.recommendedBpm * tempoMultiplier);
    const beatMs = (60 / Math.max(45, effectiveBpm)) * 1000;

    if (withTombak) {
      percEngineRef.current?.configure({
        grooveId: piece.grooveId,
        instrument: piece.form === 'reng' ? 'daf' : 'tombak',
        bpm: effectiveBpm,
        volume: 0.65,
      });
      percEngineRef.current?.start();
    }

    setPlayingPieceId(piece.id);

    piece.notes.forEach((note, idx) => {
      const tId = window.setTimeout(() => {
        setActiveNoteIdx(idx);
        playPersianNote(note, {
          instrument,
          durationSec: Math.max(0.25, (beatMs / 1000) * 0.95),
          a4Hz,
          koronMode,
          enableOrnaments: false,
        });
      }, idx * beatMs);
      timersRef.current.push(tId);
    });

    const endId = window.setTimeout(() => {
      stopPlayback();
    }, piece.notes.length * beatMs + 350);
    timersRef.current.push(endId);
  };

  const visiblePieces =
    filterForm === 'all'
      ? CLASSICAL_PIECES
      : CLASSICAL_PIECES.filter((p) => p.form === filterForm);

  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/85">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-500/15 text-teal-600 dark:text-teal-300">
            <Music4 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
              تصنیف‌خانه، پیش‌درآمد، چهارمضراب و رنگ (کتابخانه قطعات ضربی)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              هم‌نوازی همزمان ملودی ربع‌پرده Karplus-Strong با ریتم هماهنگ تنبک و دف — کاملاً آفلاین
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100/80 px-3 py-1.5 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <input
              type="checkbox"
              checked={withTombak}
              onChange={(e) => setWithTombak(e.target.checked)}
              className="accent-amber-500"
            />
            <Drum className="h-3.5 w-3.5 text-amber-500" />
            همراهی تنبک / دف
          </label>

          <select
            value={tempoMultiplier}
            onChange={(e) => setTempoMultiplier(Number(e.target.value))}
            aria-label="سرعت پخش قطعه"
            className="rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold dark:border-slate-700 dark:bg-slate-800"
          >
            <option value={0.75}>سرعت ۷۵٪ (آموزشی)</option>
            <option value={1}>سرعت ۱۰۰٪ (اصلی)</option>
            <option value={1.15}>سرعت ۱۱۵٪ (چابک)</option>
          </select>
        </div>
      </div>

      {/* Form Filter Pills */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {FORM_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setFilterForm(t.id)}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              filterForm === t.id
                ? 'bg-teal-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            {t.labelFa}
          </button>
        ))}
      </div>

      {/* Pieces Grid */}
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        {visiblePieces.map((piece) => {
          const isPlaying = playingPieceId === piece.id;
          const locked = piece.isPro && !isPro;
          return (
            <div
              key={piece.id}
              className={`rounded-2xl border p-4 transition ${
                isPlaying
                  ? 'border-teal-500 bg-teal-500/8 shadow-md'
                  : 'border-slate-200/80 bg-slate-50/75 dark:border-slate-800 dark:bg-slate-800/45'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-extrabold text-amber-700 dark:text-amber-300">
                      {piece.formLabelFa}
                    </span>
                    <span className="rounded-full bg-teal-500/15 px-2 py-0.5 text-[10px] font-bold text-teal-700 dark:text-teal-300">
                      {piece.systemNameFa}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {piece.timeSignatureFa} • {toPersianDigits(piece.recommendedBpm)} BPM
                    </span>
                  </div>
                  <h3 className="mt-1.5 text-sm font-extrabold text-slate-900 dark:text-white">
                    {piece.titleFa}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {piece.composerFa}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handlePlayPiece(piece)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-white shadow-sm transition ${
                    locked
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : isPlaying
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-teal-600 hover:bg-teal-700'
                  }`}
                >
                  {locked ? (
                    <Lock className="h-3.5 w-3.5" />
                  ) : isPlaying ? (
                    <Square className="h-3.5 w-3.5" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                  {locked ? 'نسخه پرو' : isPlaying ? 'توقف' : 'پخش هم‌نوازی'}
                </button>
              </div>

              <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                {piece.descriptionFa}
              </p>

              {piece.lyricsLineFa && (
                <div className="mt-2 rounded-xl border border-amber-500/25 bg-amber-500/8 px-3 py-1.5 text-xs font-medium italic text-amber-900 dark:text-amber-200">
                  «{piece.lyricsLineFa}»
                </div>
              )}

              {/* Live Highlighted Note Ribbon */}
              <div className="mt-2.5 flex flex-wrap gap-1">
                {piece.notes.map((n, idx) => {
                  const highlight = isPlaying && activeNoteIdx === idx;
                  return (
                    <span
                      key={`${piece.id}-n-${idx}`}
                      className={`rounded-md px-2 py-0.5 text-[10px] font-bold transition ${
                        highlight
                          ? 'scale-110 bg-teal-500 text-slate-950 shadow'
                          : 'bg-white/80 text-slate-600 dark:bg-slate-900/75 dark:text-slate-300'
                      }`}
                    >
                      {formatNoteFa(n)}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
