import React, { useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronLeft,
  Crown,
  Lock,
  Play,
  Search,
  Square,
  Volume2,
} from 'lucide-react';
import { playGushehPhrase, type PhrasePlaybackHandle } from '../audio/karplusStrong';
import { formatNoteFa } from '../data/musicTheory';
import {
  ALL_GUSHEHS,
  FREE_GUSHEHS,
  isDastgahUnlocked,
  RADIF_SYSTEMS,
} from '../data/radifData';
import {
  getGushehTraditionComparison,
  RADIF_TRADITIONS,
  TRADITION_BY_ID,
} from '../data/radifTraditions';
import type {
  Gusheh,
  GushehRole,
  InstrumentId,
  KoronMode,
  RadifTraditionId,
} from '../types/music';
import {
  normalizePersian,
  ORNAMENT_LABELS_FA,
  ROLE_BADGE_CLASSES,
  ROLE_LABELS_FA,
  toPersianDigits,
} from '../utils/persian';

interface RadifExplorerViewProps {
  isPro: boolean;
  instrument: InstrumentId;
  a4Hz: number;
  koronMode: KoronMode;
  activeGushehId: string;
  traditionId: RadifTraditionId;
  onChangeTradition: (id: RadifTraditionId) => void;
  onPracticeGusheh: (gushehId: string) => void;
  onRequestUpgrade: () => void;
}

export const RadifExplorerView: React.FC<RadifExplorerViewProps> = ({
  isPro,
  instrument,
  a4Hz,
  koronMode,
  activeGushehId,
  traditionId,
  onChangeTradition,
  onPracticeGusheh,
  onRequestUpgrade,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<GushehRole | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'dastgah' | 'avaz'>('all');
  const [expandedSystems, setExpandedSystems] = useState<Record<string, boolean>>({
    shur: true,
    abuata: true,
    mahur: false,
  });
  const [compareGusheh, setCompareGusheh] = useState<Gusheh | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const previewHandleRef = useRef<PhrasePlaybackHandle | null>(null);

  const activeTradition = TRADITION_BY_ID[traditionId];
  const normalizedQuery = normalizePersian(searchQuery);

  const filteredSystems = useMemo(() => {
    return RADIF_SYSTEMS.filter((sys) => {
      if (categoryFilter !== 'all' && sys.category !== categoryFilter) return false;
      return true;
    })
      .map((sys) => {
        const sysMatch =
          normalizedQuery.length > 0 &&
          (normalizePersian(sys.nameFa).includes(normalizedQuery) ||
            sys.nameEn.toLowerCase().includes(normalizedQuery));

        const matchingGushehs = sys.gushehs.filter((g) => {
          if (roleFilter !== 'all' && g.role !== roleFilter) return false;
          if (!normalizedQuery || sysMatch) return true;
          return (
            normalizePersian(g.nameFa).includes(normalizedQuery) ||
            g.nameEn.toLowerCase().includes(normalizedQuery) ||
            normalizePersian(g.descriptionFa).includes(normalizedQuery)
          );
        });

        return { system: sys, gushehs: matchingGushehs };
      })
      .filter((entry) => entry.gushehs.length > 0);
  }, [categoryFilter, normalizedQuery, roleFilter]);

  const totalVisibleGushehs = useMemo(
    () => filteredSystems.reduce((sum, item) => sum + item.gushehs.length, 0),
    [filteredSystems]
  );

  const togglePreview = (g: Gusheh, unlocked: boolean) => {
    if (!unlocked) {
      onRequestUpgrade();
      return;
    }
    if (previewingId === g.id) {
      previewHandleRef.current?.stop();
      setPreviewingId(null);
      return;
    }
    previewHandleRef.current?.stop();
    setPreviewingId(g.id);
    previewHandleRef.current = playGushehPhrase(g.melody, {
      instrument,
      bpm: Math.round(g.practiceLoop.defaultBpm * activeTradition.tempoFactor),
      speedMultiplier: 1.0,
      a4Hz,
      koronMode,
      startIndex: 0,
      endIndex: Math.min(g.melody.length - 1, 6),
      loop: false,
      onComplete: () => setPreviewingId(null),
    });
  };

  return (
    <div className="space-y-4">
      {/* Explorer Header & Search Bar */}
      <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white">
              مرورگر جامع ردیف موسیقی اصیل ایرانی
            </h1>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              ۱۲ نظام (۷ دستگاه و ۵ آواز) شامل{' '}
              <strong className="text-teal-600 dark:text-teal-300">
                {toPersianDigits(ALL_GUSHEHS.length)} گوشه
              </strong>{' '}
              — دسترسی رایگان دائمی به{' '}
              <strong className="text-amber-600 dark:text-amber-300">
                {toPersianDigits(FREE_GUSHEHS.length)} گوشه
              </strong>{' '}
              (شور، ابوعطا، ماهور)
            </p>
          </div>
          {!isPro && (
            <button
              type="button"
              onClick={onRequestUpgrade}
              className="inline-flex items-center gap-1.5 rounded-2xl bg-gradient-to-l from-amber-500 to-teal-600 px-4 py-2 text-xs font-extrabold text-white shadow"
            >
              <Crown className="h-4 w-4" />
              آزادسازی کل ۱۷۳ گوشه
            </button>
          )}
        </div>

        {/* Feature 5: Radif Repertoire Tradition Switcher (Instrumental vs Vocal Masters) */}
        <div className="mt-4 rounded-2xl border border-teal-500/25 bg-teal-500/5 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-teal-700 dark:text-teal-300">
              <BookOpen className="h-4 w-4" />
              روایت فعال ردیف (سازی ↔ آوازی):
            </div>
            <div className="flex flex-wrap gap-1.5">
              {RADIF_TRADITIONS.map((trad) => (
                <button
                  key={trad.id}
                  type="button"
                  onClick={() => onChangeTradition(trad.id)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                    traditionId === trad.id
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'bg-white text-slate-700 hover:bg-teal-50 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {trad.shortNameFa} ({trad.categoryFa === 'ردیف آوازی' ? 'آوازی' : 'سازی'})
                </button>
              ))}
            </div>
          </div>
          <p className="mt-2 text-[11px] leading-5 text-slate-600 dark:text-slate-300">
            <strong>{activeTradition.masterFa}:</strong> {activeTradition.characterFa}
          </p>
        </div>

        {/* Search & Filter Controls */}
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="relative md:col-span-5">
            <Search className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جست‌وجوی نام دستگاه، آواز یا گوشه (مثلاً شهناز، حجاز، دلکش، بیداد)..."
              className="w-full rounded-2xl border border-slate-300 bg-slate-50 py-2.5 pr-9 pl-3 text-xs font-medium text-slate-800 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5 md:col-span-3">
            {(
              [
                { id: 'all', label: 'همه (۱۲)' },
                { id: 'dastgah', label: '۷ دستگاه' },
                { id: 'avaz', label: '۵ آواز' },
              ] as const
            ).map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryFilter(cat.id)}
                className={`rounded-xl px-2.5 py-2 text-xs font-bold transition ${
                  categoryFilter === cat.id
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1 md:col-span-4">
            {(['all', 'daramad', 'miani', 'owj', 'zarbi', 'foroud'] as const).map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => setRoleFilter(role)}
                className={`rounded-xl px-2.5 py-1.5 text-[11px] font-bold transition ${
                  roleFilter === role
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {role === 'all' ? 'همه نقش‌ها' : ROLE_LABELS_FA[role]}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
          نمایش {toPersianDigits(totalVisibleGushehs)} گوشه در {toPersianDigits(filteredSystems.length)} نظام
        </div>
      </div>

      {/* Side-by-Side 4-Master Comparison Matrix Drawer when a Gusheh is selected for comparison */}
      {compareGusheh && (
        <div className="rounded-3xl border border-amber-500/35 bg-white p-5 shadow-lg dark:bg-slate-900">
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
                مقایسه ۴ روایت ردیف برای گوشه «{compareGusheh.nameFa}»
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                تفاوت جمله‌بندی، نت متغیر، زینت‌ها و الگوی فرود میان میرزاعبدالله، محمود کریمی، صبا و دوامی
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCompareGusheh(null)}
              className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            >
              بستن مقایسه
            </button>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {getGushehTraditionComparison(compareGusheh).map((item) => {
              const info = TRADITION_BY_ID[item.traditionId];
              return (
                <div
                  key={item.traditionId}
                  className={`rounded-2xl border p-3.5 text-xs ${
                    item.traditionId === traditionId
                      ? 'border-teal-500 bg-teal-500/8'
                      : 'border-slate-200 bg-slate-50/75 dark:border-slate-800 dark:bg-slate-800/50'
                  }`}
                >
                  <div className="font-extrabold text-slate-900 dark:text-white">
                    {info.nameFa}
                  </div>
                  <div className="mt-0.5 text-[10px] font-bold text-teal-600 dark:text-teal-300">
                    {info.categoryFa}
                  </div>
                  <p className="mt-2 leading-5 text-slate-600 dark:text-slate-300">
                    {item.phrasingFa}
                  </p>
                  <div className="mt-2 border-t border-slate-200/70 pt-2 text-[11px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    <strong>فرود:</strong> {item.foroudCueFa}
                  </div>
                  <div className="mt-1 text-[10px] font-semibold text-amber-600 dark:text-amber-300">
                    {item.recommendedKoronFa}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Hierarchical Tree of Systems & Gushehs */}
      <div className="space-y-3">
        {filteredSystems.map(({ system, gushehs }) => {
          const unlocked = isDastgahUnlocked(system.id, isPro);
          const isOpen =
            normalizedQuery.length > 0 || (expandedSystems[system.id] ?? false);

          return (
            <div
              key={system.id}
              className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-900/85"
            >
              <button
                type="button"
                onClick={() =>
                  setExpandedSystems((prev) => ({ ...prev, [system.id]: !isOpen }))
                }
                className="flex w-full items-center justify-between gap-3 p-4 text-right transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="h-10 w-2 rounded-full"
                    style={{ backgroundColor: system.colorHex }}
                  />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-extrabold text-slate-900 dark:text-white">
                        {system.nameFa}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {system.category === 'dastgah' ? 'دستگاه' : 'آواز'} •{' '}
                        {toPersianDigits(gushehs.length)} گوشه
                      </span>
                      {system.isFree ? (
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300">
                          رایگان همیشگی
                        </span>
                      ) : unlocked ? (
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-extrabold text-amber-700 dark:text-amber-300">
                          بازشده (Pro)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-extrabold text-amber-700 dark:text-amber-300">
                          <Lock className="h-3 w-3" />
                          نسخه کامل Pro
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {system.moodFa} — شاهد: {formatNoteFa(system.shahed)} • ایست:{' '}
                      {formatNoteFa(system.ist)}
                    </p>
                  </div>
                </div>

                {isOpen ? (
                  <ChevronDown className="h-5 w-5 shrink-0 text-slate-400" />
                ) : (
                  <ChevronLeft className="h-5 w-5 shrink-0 text-slate-400" />
                )}
              </button>

              {isOpen && (
                <div className="border-t border-slate-200/75 p-4 dark:border-slate-800">
                  <p className="mb-3 text-xs leading-6 text-slate-600 dark:text-slate-300">
                    {system.summaryFa}
                  </p>
                  <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
                    {gushehs.map((g) => {
                      const isCurrent = g.id === activeGushehId;
                      const isPreview = previewingId === g.id;
                      return (
                        <div
                          key={g.id}
                          className={`flex flex-col justify-between rounded-2xl border p-3.5 transition ${
                            isCurrent
                              ? 'border-teal-500 bg-teal-500/10'
                              : 'border-slate-200 bg-slate-50/75 hover:border-teal-400/70 dark:border-slate-800 dark:bg-slate-800/50'
                          }`}
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                                  {toPersianDigits(g.order)}. {g.nameFa}
                                </div>
                                <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                                  شاهد: {formatNoteFa(g.shahed)} • ایست: {formatNoteFa(g.ist)}
                                  {g.moteghayer ? ` • متغیر: ${formatNoteFa(g.moteghayer)}` : ''}
                                </div>
                              </div>
                              <span
                                className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${ROLE_BADGE_CLASSES[g.role]}`}
                              >
                                {ROLE_LABELS_FA[g.role]}
                              </span>
                            </div>

                            <p className="mt-2 line-clamp-2 text-[11px] leading-5 text-slate-600 dark:text-slate-300">
                              {g.descriptionFa}
                            </p>

                            <div className="mt-2 flex flex-wrap gap-1">
                              {g.ornaments.map((orn) => (
                                <span
                                  key={orn}
                                  className="rounded-md bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                                >
                                  {ORNAMENT_LABELS_FA[orn]}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center justify-between gap-1.5 border-t border-slate-200/70 pt-2.5 dark:border-slate-700/70">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => togglePreview(g, unlocked)}
                                className="inline-flex items-center gap-1 rounded-xl bg-slate-200/80 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200"
                              >
                                {isPreview ? (
                                  <>
                                    <Square className="h-3 w-3 text-rose-500" />
                                    توقف
                                  </>
                                ) : (
                                  <>
                                    <Volume2 className="h-3 w-3 text-teal-600 dark:text-teal-400" />
                                    شنیدن
                                  </>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => setCompareGusheh(g)}
                                className="rounded-xl bg-amber-500/12 px-2 py-1.5 text-[10px] font-bold text-amber-700 hover:bg-amber-500/20 dark:text-amber-300"
                              >
                                مقایسه ۴ روایت
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                unlocked ? onPracticeGusheh(g.id) : onRequestUpgrade()
                              }
                              className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-[11px] font-extrabold transition ${
                                unlocked
                                  ? 'bg-teal-600 text-white hover:bg-teal-700'
                                  : 'bg-amber-500/20 text-amber-700 hover:bg-amber-500/30 dark:text-amber-300'
                              }`}
                            >
                              {unlocked ? (
                                <>
                                  <Play className="h-3 w-3" />
                                  تمرین
                                </>
                              ) : (
                                <>
                                  <Lock className="h-3 w-3" />
                                  بازکردن (Pro)
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
