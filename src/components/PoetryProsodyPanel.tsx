import React from 'react';
import { BookOpen, Feather } from 'lucide-react';
import { getPoetryForGusheh } from '../data/persianPoetry';
import {
  getGushehTraditionComparison,
  RADIF_TRADITIONS,
  TRADITION_BY_ID,
} from '../data/radifTraditions';
import type { Gusheh, RadifTraditionId } from '../types/music';

interface PoetryProsodyPanelProps {
  gusheh: Gusheh;
  activeNoteIndex: number | null;
  traditionId: RadifTraditionId;
  onChangeTradition: (id: RadifTraditionId) => void;
}

export const PoetryProsodyPanel: React.FC<PoetryProsodyPanelProps> = ({
  gusheh,
  activeNoteIndex,
  traditionId,
  onChangeTradition,
}) => {
  const poetry = getPoetryForGusheh(gusheh);
  const comparisons = getGushehTraditionComparison(gusheh);
  const activeTradition = TRADITION_BY_ID[traditionId];
  const activeComparison =
    comparisons.find((c) => c.traditionId === traditionId) ?? comparisons[0];

  const highlightedSyllableIdx =
    activeNoteIndex !== null && poetry.syllables.length > 0
      ? activeNoteIndex % poetry.syllables.length
      : -1;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Feature 6: Poetry, Prosody (Aruz) & Syllable Alignment */}
      <div className="rounded-2xl border border-amber-500/25 bg-white/90 p-4 shadow-sm dark:bg-slate-900/85">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Feather className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
              کارگاه شعر، عروض و تصنیف‌خوانی هم‌تراز با گوشه
            </h3>
          </div>
          <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-300">
            {poetry.poetFa}
          </span>
        </div>

        <div className="mt-3 rounded-xl bg-amber-500/8 p-3 text-center">
          <div className="text-sm font-bold text-slate-900 dark:text-amber-100">
            {poetry.hemistich1Fa}
          </div>
          <div className="mt-1 text-sm font-bold text-slate-800 dark:text-amber-200/90">
            {poetry.hemistich2Fa}
          </div>
          <div className="mt-2 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
            {poetry.meterNameFa} • <span className="font-extrabold">{poetry.aruzPatternFa}</span>
          </div>
        </div>

        {/* Syllable Breakdown synced with active note */}
        <div className="mt-3">
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="font-bold">تقطیع هجایی و نشانه‌گذاری اجرا:</span>
            <span>ـ کشیده | U کوتاه | ♪ محل تحریر | ↓ نفس‌گیری</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {poetry.syllables.map((syl, idx) => {
              const isActive = idx === highlightedSyllableIdx;
              return (
                <div
                  key={`${syl.text}-${idx}`}
                  className={`flex flex-col items-center rounded-xl border px-2.5 py-1.5 text-xs transition ${
                    isActive
                      ? 'scale-105 border-teal-500 bg-teal-600 text-white shadow'
                      : syl.tahrir
                      ? 'border-amber-400/50 bg-amber-500/12 text-amber-800 dark:text-amber-200'
                      : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                  }`}
                >
                  <span className="font-extrabold">
                    {syl.text}
                    {syl.tahrir ? ' ♪' : ''}
                    {syl.breathAfter ? ' ↓' : ''}
                  </span>
                  <span className="text-[10px] opacity-80">
                    {syl.weight === 'long' ? 'ـ (کشیده)' : 'U (کوتاه)'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <p className="mt-3 rounded-xl bg-slate-100/80 px-3 py-2 text-[11px] leading-5 text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
          <strong>نکته آوازی:</strong> {poetry.performanceTipFa}
        </p>
      </div>

      {/* Feature 5: Radif Repertoire Traditions Switcher & Nuances */}
      <div className="rounded-2xl border border-teal-500/25 bg-white/90 p-4 shadow-sm dark:bg-slate-900/85">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-teal-500" />
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
              مقایسه روایت‌های ردیف (سازی ↔ آوازی)
            </h3>
          </div>
          <span className="rounded-full bg-teal-500/15 px-2.5 py-0.5 text-[11px] font-bold text-teal-700 dark:text-teal-300">
            {activeTradition.categoryFa}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {RADIF_TRADITIONS.map((trad) => (
            <button
              key={trad.id}
              type="button"
              onClick={() => onChangeTradition(trad.id)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                traditionId === trad.id
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {trad.shortNameFa}
            </button>
          ))}
        </div>

        <div className="mt-3 space-y-2 text-xs">
          <div className="rounded-xl bg-teal-500/8 p-3">
            <div className="font-extrabold text-teal-800 dark:text-teal-200">
              {activeTradition.nameFa} — {activeTradition.masterFa}
            </div>
            <p className="mt-1 leading-6 text-slate-700 dark:text-slate-200">
              {activeComparison.phrasingFa}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50/75 p-2.5 dark:border-slate-800 dark:bg-slate-800/50">
              <div className="text-[10px] font-bold text-slate-500">رفتار نت متغیر و تحریر</div>
              <div className="mt-1 text-[11px] leading-5 text-slate-700 dark:text-slate-200">
                {activeComparison.moteghayerNoteFa}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/75 p-2.5 dark:border-slate-800 dark:bg-slate-800/50">
              <div className="text-[10px] font-bold text-slate-500">الگوی فرود در این روایت</div>
              <div className="mt-1 text-[11px] leading-5 text-slate-700 dark:text-slate-200">
                {activeComparison.foroudCueFa}
              </div>
            </div>
          </div>

          <div className="text-[11px] font-semibold text-amber-600 dark:text-amber-300">
            {activeComparison.recommendedKoronFa} • زینت‌های شاخص: {activeTradition.ornamentFocusFa}
          </div>
        </div>
      </div>
    </div>
  );
};
