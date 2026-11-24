import React, { useEffect, useState } from 'react';
import { Sliders, Volume2 } from 'lucide-react';
import { playFrequencyTone } from '../audio/karplusStrong';
import {
  BUILTIN_TEMPERAMENT_PROFILES,
  compareTemperamentCents,
  loadScopedTemperament,
  noteToCustomTemperamentFrequency,
  saveScopedTemperament,
} from '../core/temperament';
import { formatNoteFa } from '../data/musicTheory';
import type {
  CustomTemperamentProfile,
  Gusheh,
  InstrumentId,
  NoteLetter,
} from '../types/music';
import { toPersianDigits } from '../utils/persian';

interface TemperamentEditorPanelProps {
  ownerUid: string;
  gusheh: Gusheh;
  instrument: InstrumentId;
  a4Hz: number;
}

const LETTERS: Array<{ id: NoteLetter; labelFa: string }> = [
  { id: 'C', labelFa: 'دو' },
  { id: 'D', labelFa: 'ر' },
  { id: 'E', labelFa: 'می' },
  { id: 'F', labelFa: 'فا' },
  { id: 'G', labelFa: 'سُل' },
  { id: 'A', labelFa: 'لا' },
  { id: 'B', labelFa: 'سی' },
];

export const TemperamentEditorPanel: React.FC<TemperamentEditorPanelProps> = ({
  ownerUid,
  gusheh,
  instrument,
  a4Hz,
}) => {
  const [profile, setProfile] = useState<CustomTemperamentProfile>(() =>
    loadScopedTemperament(ownerUid)
  );
  const [abFeedbackFa, setAbFeedbackFa] = useState<string | null>(null);

  useEffect(() => {
    setProfile(loadScopedTemperament(ownerUid));
  }, [ownerUid]);

  const updateProfile = (next: CustomTemperamentProfile) => {
    setProfile(next);
    saveScopedTemperament(ownerUid, next);
  };

  // Pick a signature microtonal note from active gusheh (or E koron fallback)
  const testNote =
    gusheh.scale.find((n) => n.accidental === 'koron' || n.accidental === 'sori') ?? {
      letter: 'E' as const,
      accidental: 'koron' as const,
      octave: 4,
    };

  const vaziriBaseline = BUILTIN_TEMPERAMENT_PROFILES[0];
  const diffFromVaziri = compareTemperamentCents(
    testNote,
    vaziriBaseline,
    profile,
    a4Hz
  );

  const playABCompare = () => {
    const fVaziri = noteToCustomTemperamentFrequency(testNote, vaziriBaseline, a4Hz);
    const fCustom = noteToCustomTemperamentFrequency(testNote, profile, a4Hz);
    playFrequencyTone(fVaziri, { instrument, durationSec: 0.9 });
    window.setTimeout(() => {
      playFrequencyTone(fCustom, { instrument, durationSec: 1.1 });
    }, 950);
    setAbFeedbackFa(
      `پخش مقایسه‌ای A/B برای ${formatNoteFa(testNote)}: اول وزیری (${Math.round(
        fVaziri
      )} Hz) ← سپس «${profile.nameFa}» (${Math.round(fCustom)} Hz | اختلاف ${
        diffFromVaziri >= 0 ? '+' : ''
      }${toPersianDigits(diffFromVaziri)} سنت)`
    );
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/85">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-300">
            <Sliders className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
              ویرایشگر کوک و ربع‌پرده‌های اختصاصی (مکاتب موسیقی ایرانی)
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              تنظیم دقیق سنت کُرُن، سُری و ریزکوک هر درجه بر پایه مکتب وزیری، هرمز فرهت، طلایی یا اصفهان
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={playABCompare}
          className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-violet-700"
        >
          <Volume2 className="h-4 w-4" />
          مقایسه شنیداری A/B ({formatNoteFa(testNote)})
        </button>
      </div>

      {/* 4 Built-in Iranian Temperament Schools */}
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {BUILTIN_TEMPERAMENT_PROFILES.map((preset) => {
          const active = profile.id === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => updateProfile({ ...preset, noteOffsetsCents: { ...preset.noteOffsetsCents } })}
              className={`rounded-xl border p-2.5 text-right transition ${
                active
                  ? 'border-violet-500 bg-violet-500/12 shadow-sm'
                  : 'border-slate-200 bg-slate-50/75 hover:border-violet-300 dark:border-slate-800 dark:bg-slate-800/50'
              }`}
            >
              <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                {preset.nameFa}
              </div>
              <div className="mt-0.5 text-[10px] text-violet-600 dark:text-violet-300">
                کُرُن: {toPersianDigits(preset.koronCents)}¢ • سُری: +{toPersianDigits(preset.soriCents)}¢
              </div>
            </button>
          );
        })}
      </div>

      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        {profile.descriptionFa}
      </p>

      {/* Koron & Sori Fine Sliders */}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-slate-100/80 p-3 dark:bg-slate-800/70">
          <div className="flex items-center justify-between text-xs font-bold">
            <span>مقدار دقیق کُرُن (𝄳)</span>
            <span className="ltr-num text-teal-600 dark:text-teal-300">
              {profile.koronCents} cents
            </span>
          </div>
          <input
            type="range"
            min={-70}
            max={-30}
            step={1}
            value={profile.koronCents}
            onChange={(e) =>
              updateProfile({
                ...profile,
                id: 'custom_user',
                nameFa: 'کوک سفارشی هنرجو',
                koronCents: Number(e.target.value),
              })
            }
            className="mt-1.5 w-full accent-teal-500"
          />
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>-۷۰¢ (بم‌تر / سنتی)</span>
            <span>-۵۰¢ (وزیری)</span>
            <span>-۳۰¢ (ملایم)</span>
          </div>
        </div>

        <div className="rounded-xl bg-slate-100/80 p-3 dark:bg-slate-800/70">
          <div className="flex items-center justify-between text-xs font-bold">
            <span>مقدار دقیق سُری (𝄲)</span>
            <span className="ltr-num text-amber-600 dark:text-amber-300">
              +{profile.soriCents} cents
            </span>
          </div>
          <input
            type="range"
            min={30}
            max={70}
            step={1}
            value={profile.soriCents}
            onChange={(e) =>
              updateProfile({
                ...profile,
                id: 'custom_user',
                nameFa: 'کوک سفارشی هنرجو',
                soriCents: Number(e.target.value),
              })
            }
            className="mt-1.5 w-full accent-amber-500"
          />
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>+۳۰¢ (ملایم)</span>
            <span>+۵۰¢ (وزیری)</span>
            <span>+۷۰¢ (زیرتر)</span>
          </div>
        </div>
      </div>

      {/* Per-Note Microtonal Offset Sliders (-20c to +20c) */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-7">
        {LETTERS.map((l) => {
          const val = profile.noteOffsetsCents[l.id] ?? 0;
          return (
            <div
              key={l.id}
              className="rounded-xl border border-slate-200/80 bg-slate-50/75 p-2 text-center dark:border-slate-800 dark:bg-slate-800/50"
            >
              <div className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
                {l.labelFa}
              </div>
              <div className="ltr-num text-[10px] font-bold text-violet-600 dark:text-violet-300">
                {val >= 0 ? `+${val}` : val}¢
              </div>
              <input
                type="range"
                min={-20}
                max={20}
                step={1}
                value={val}
                aria-label={`ریزکوک نت ${l.labelFa}`}
                onChange={(e) =>
                  updateProfile({
                    ...profile,
                    id: 'custom_user',
                    nameFa: 'کوک سفارشی هنرجو',
                    noteOffsetsCents: {
                      ...profile.noteOffsetsCents,
                      [l.id]: Number(e.target.value),
                    },
                  })
                }
                className="mt-1 w-full accent-violet-500"
              />
            </div>
          );
        })}
      </div>

      {abFeedbackFa && (
        <div className="mt-3 rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-700 dark:text-violet-300">
          {abFeedbackFa}
        </div>
      )}
    </div>
  );
};
