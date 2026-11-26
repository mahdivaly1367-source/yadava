import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Search, Square, Volume2, X } from 'lucide-react';
import { playPersianNote } from '../audio/karplusStrong';
import {
  AUDIO_GLOSSARY_TERMS,
  type AudioGlossaryTerm,
} from '../data/audioGlossary';
import { formatNoteFa } from '../data/musicTheory';
import type { InstrumentId, KoronMode } from '../types/music';
import { toPersianDigits } from '../utils/persian';

interface AudioGlossaryModalProps {
  open: boolean;
  onClose: () => void;
  instrument: InstrumentId;
  a4Hz: number;
  koronMode: KoronMode;
}

const CATEGORIES: Array<AudioGlossaryTerm['categoryFa'] | 'همه'> = [
  'همه',
  'مبانی ردیف',
  'ربع‌پرده و کوک',
  'زینت و اجرا',
  'فرم‌های ریتمیک',
];

export const AudioGlossaryModal: React.FC<AudioGlossaryModalProps> = ({
  open,
  onClose,
  instrument,
  a4Hz,
  koronMode,
}) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<AudioGlossaryTerm['categoryFa'] | 'همه'>('همه');
  const [playingTermId, setPlayingTermId] = useState<string | null>(null);
  const timersRef = useRef<number[]>([]);

  const stopDemo = () => {
    for (const id of timersRef.current) window.clearTimeout(id);
    timersRef.current = [];
    setPlayingTermId(null);
  };

  useEffect(() => {
    if (!open) stopDemo();
    return () => stopDemo();
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim();
    return AUDIO_GLOSSARY_TERMS.filter((t) => {
      if (category !== 'همه' && t.categoryFa !== category) return false;
      if (!q) return true;
      return (
        t.termFa.includes(q) ||
        t.shortDefFa.includes(q) ||
        t.detailFa.includes(q)
      );
    });
  }, [query, category]);

  if (!open) return null;

  const playTermDemo = (term: AudioGlossaryTerm) => {
    if (playingTermId === term.id) {
      stopDemo();
      return;
    }
    stopDemo();
    setPlayingTermId(term.id);
    const stepMs = (60 / Math.max(60, term.demoBpm)) * 1000;
    term.demoNotes.forEach((n, idx) => {
      const id = window.setTimeout(() => {
        playPersianNote(n, {
          instrument,
          durationSec: Math.max(0.22, (stepMs / 1000) * 1.05),
          a4Hz,
          koronMode,
        });
      }, idx * stepMs);
      timersRef.current.push(id);
    });
    const endId = window.setTimeout(() => {
      setPlayingTermId(null);
    }, term.demoNotes.length * stepMs + 300);
    timersRef.current.push(endId);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="فرهنگ صوتی اصطلاحات موسیقی ایرانی"
    >
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-amber-500/30 bg-white p-6 shadow-2xl dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-300">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                فرهنگ صوتی تعاملی اصطلاحات ردیف ({toPersianDigits(AUDIO_GLOSSARY_TERMS.length)} اصطلاح)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                هر اصطلاح همراه با نمونه صوتی سنتزشده زنده (شاهد، ایست، کُرُن، تحریر، فرود، کرشمه و ...)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="بستن فرهنگ صوتی"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search & Category Pills */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="جستجوی اصطلاح (مثلاً تحریر، کُرُن، شاهد، فرود)..."
              className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2 pr-9 pl-3 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <div className="flex flex-wrap gap-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`rounded-xl px-2.5 py-1.5 text-xs font-bold transition ${
                  category === cat
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Terms List */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {filtered.map((term) => {
            const isPlaying = playingTermId === term.id;
            return (
              <div
                key={term.id}
                className={`rounded-2xl border p-3.5 transition ${
                  isPlaying
                    ? 'border-amber-500 bg-amber-500/10'
                    : 'border-slate-200 bg-slate-50/75 dark:border-slate-800 dark:bg-slate-800/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="rounded-full bg-teal-500/15 px-2 py-0.5 text-[10px] font-bold text-teal-700 dark:text-teal-300">
                      {term.categoryFa}
                    </span>
                    <h3 className="mt-1 text-sm font-extrabold text-slate-900 dark:text-white">
                      {term.termFa}
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => playTermDemo(term)}
                    className={`inline-flex shrink-0 items-center gap-1 rounded-xl px-2.5 py-1.5 text-[11px] font-bold text-white transition ${
                      isPlaying
                        ? 'bg-rose-600'
                        : 'bg-teal-600 hover:bg-teal-700'
                    }`}
                  >
                    {isPlaying ? (
                      <Square className="h-3 w-3" />
                    ) : (
                      <Volume2 className="h-3.5 w-3.5" />
                    )}
                    {isPlaying ? 'توقف' : 'شنیدن نمونه'}
                  </button>
                </div>

                <p className="mt-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {term.shortDefFa}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                  {term.detailFa}
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-slate-200/70 pt-2 text-[10px] dark:border-slate-700/70">
                  <span className="font-bold text-amber-600 dark:text-amber-300">
                    {term.exampleLabelFa}:
                  </span>
                  {term.demoNotes.map((n, i) => (
                    <span
                      key={i}
                      className="rounded bg-white/80 px-1.5 py-0.5 font-bold text-slate-700 dark:bg-slate-900 dark:text-slate-300"
                    >
                      {formatNoteFa(n)}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
