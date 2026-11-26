import React, { useEffect, useState } from 'react';
import { getAudioContext } from '../audio/audioContext';
import { PERSIAN_BODY_IR_SPECS } from '../audio/instrumentBodyIR';
import { playPersianNote } from '../audio/karplusStrong';
import { triggerPersianStroke } from '../audio/percussion';
import {
  acousticSampleBank,
  DEFAULT_ACOUSTIC_SCULPT,
  getAcousticSculptSettings,
  MASTER_STUDIO_PRESETS,
  REAL_SAMPLE_CREDITS,
  setAcousticSculptSettings,
} from '../audio/sampleEngine';
import { noteToFrequency } from '../data/musicTheory';
import type {
  AcousticSculptSettings,
  CustomInstrumentSampleMeta,
  InstrumentId,
  KoronMode,
  OrnamentType,
  SoundEngineMode,
} from '../types/music';
import { ALL_INSTRUMENT_IDS, INSTRUMENT_LABELS_FA, toPersianDigits } from '../utils/persian';

interface AcousticSoundLabPanelProps {
  activeInstrument: InstrumentId;
  onSelectInstrument: (inst: InstrumentId) => void;
  a4Hz: number;
  koronMode: KoronMode;
}

const ENGINE_MODE_CARDS: Array<{
  id: SoundEngineMode;
  titleFa: string;
  badgeFa: string;
  descFa: string;
}> = [
  {
    id: 'hybrid_studio',
    titleFa: 'هیبرید سمپل واقعی + بدنه ایرانی',
    badgeFa: 'پیشنهاد ویژه',
    descFa:
      '۵۴ سمپل استودیویی کالیبره‌شده با YIN + کانولوشن ۱۲ تا ۱۴ مُد بدنه چوبی/پوستی، جفت‌سیم، مالش و تحریر زنده',
  },
  {
    id: 'acoustic_samples',
    titleFa: 'سمپل استودیویی خالص',
    badgeFa: 'طبیعی و خام',
    descFa:
      'پخش مستقیم ضبط‌های آکوستیک چندناحیه‌ای با کمترین پردازش و کوک دقیق ربع‌پرده کرن و سری',
  },
  {
    id: 'physical_v2',
    titleFa: 'سنتز فیزیکی پیشرفته v2',
    badgeFa: 'بدون نیاز به فایل',
    descFa:
      'مدل‌سازی ریاضی موج‌بر (Karplus-Strong) + کانولوشن بدنه برای مقایسه A/B و مصرف حافظه فوق‌کم',
  },
];

export const AcousticSoundLabPanel: React.FC<AcousticSoundLabPanelProps> = ({
  activeInstrument,
  onSelectInstrument,
  a4Hz,
  koronMode,
}) => {
  const [settings, setSettings] = useState<AcousticSculptSettings>(() =>
    getAcousticSculptSettings()
  );
  const [counts, setCounts] = useState(() => acousticSampleBank.getLoadedCounts());
  const [customMetas, setCustomMetas] = useState<CustomInstrumentSampleMeta[]>(() =>
    acousticSampleBank.getAllCustomSampleMetas()
  );
  const [preloading, setPreloading] = useState(false);
  const [uploadInstrument, setUploadInstrument] = useState<InstrumentId>(activeInstrument);
  const [overrideHzText, setOverrideHzText] = useState('');
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const activeBodySpec = PERSIAN_BODY_IR_SPECS[activeInstrument];

  useEffect(() => {
    setUploadInstrument(activeInstrument);
  }, [activeInstrument]);

  useEffect(() => {
    void acousticSampleBank.ensureCustomSamplesLoaded();
    void acousticSampleBank.ensureManifest();
    const unsub = acousticSampleBank.subscribe(() => {
      setCounts(acousticSampleBank.getLoadedCounts());
      setCustomMetas(acousticSampleBank.getAllCustomSampleMetas());
    });
    return unsub;
  }, []);

  const updateSettings = (patch: Partial<AcousticSculptSettings>) => {
    const next = setAcousticSculptSettings(patch);
    setSettings(next);
  };

  const handlePreloadAll = async () => {
    setPreloading(true);
    try {
      const ctx = getAudioContext();
      await Promise.all([
        ...ALL_INSTRUMENT_IDS.map((instId) => acousticSampleBank.preloadInstrument(ctx, instId)),
        acousticSampleBank.preloadPercussion(ctx, 'tombak'),
        acousticSampleBank.preloadPercussion(ctx, 'daf'),
      ]);
      setCounts(acousticSampleBank.getLoadedCounts());
    } finally {
      setPreloading(false);
    }
  };

  const auditionMelodicInstrument = async (instId: InstrumentId) => {
    onSelectInstrument(instId);
    const ctx = getAudioContext();
    if (settings.engineMode !== 'physical_v2' && !acousticSampleBank.isInstrumentReady(instId)) {
      await acousticSampleBank.preloadInstrument(ctx, instId);
    }
    // Expressive Shur motif covering quick articulation + Malesh glide + sustained Shahed/Ist:
    // G4 -> A-Koron4 -> Bb4 -> C5 -> A-Koron4 -> G4 (sustained)
    const motif: Array<{
      letter: 'G' | 'A' | 'B' | 'C';
      accidental: 'natural' | 'koron' | 'flat';
      octave: number;
      dur: number;
      vel: number;
      orn?: OrnamentType;
    }> = [
      { letter: 'G', accidental: 'natural', octave: 4, dur: 0.34, vel: 0.9 },
      { letter: 'A', accidental: 'koron', octave: 4, dur: 0.32, vel: 0.85 },
      { letter: 'B', accidental: 'flat', octave: 4, dur: 0.44, vel: 0.92, orn: 'eshareh' },
      { letter: 'C', accidental: 'natural', octave: 5, dur: 0.38, vel: 0.88 },
      { letter: 'A', accidental: 'koron', octave: 4, dur: 0.46, vel: 0.86, orn: 'tekieh' },
      { letter: 'G', accidental: 'natural', octave: 4, dur: 1.1, vel: 0.9 },
    ];
    let offset = 0.02;
    let prevHz: number | undefined;
    for (const step of motif) {
      const noteSpec = { letter: step.letter, accidental: step.accidental, octave: step.octave };
      playPersianNote(noteSpec, {
        instrument: instId,
        durationSec: step.dur,
        a4Hz,
        koronMode,
        ornament: step.orn,
        startTimeOffsetSec: offset,
        velocity: step.vel,
        prevFreqHz: prevHz,
      });
      prevHz = noteToFrequency(noteSpec, a4Hz, koronMode);
      offset += step.dur * 0.88;
    }
  };

  const auditionPercussion = async (inst: 'tombak' | 'daf') => {
    const ctx = getAudioContext();
    if (settings.engineMode !== 'physical_v2') {
      await acousticSampleBank.preloadPercussion(ctx, inst);
    }
    const pattern: Array<{
      stroke: 'tom' | 'bak' | 'pelang' | 'riz' | 'chain';
      dt: number;
      vol: number;
    }> =
      inst === 'tombak'
        ? [
            { stroke: 'tom', dt: 0.02, vol: 0.95 },
            { stroke: 'bak', dt: 0.27, vol: 0.78 },
            { stroke: 'pelang', dt: 0.51, vol: 0.84 },
            { stroke: 'tom', dt: 0.76, vol: 0.88 },
            { stroke: 'riz', dt: 1.02, vol: 0.86 },
            { stroke: 'bak', dt: 1.3, vol: 0.8 },
          ]
        : [
            { stroke: 'tom', dt: 0.02, vol: 0.96 },
            { stroke: 'chain', dt: 0.29, vol: 0.84 },
            { stroke: 'bak', dt: 0.56, vol: 0.8 },
            { stroke: 'tom', dt: 0.82, vol: 0.9 },
            { stroke: 'pelang', dt: 1.09, vol: 0.85 },
            { stroke: 'chain', dt: 1.33, vol: 0.88 },
          ];
    const base = ctx.currentTime;
    for (const hit of pattern) {
      triggerPersianStroke(ctx, base + hit.dt, hit.stroke, inst, hit.vol);
    }
  };

  const handleImportSampleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setImporting(true);
    setUploadError(null);
    setUploadStatus(null);
    try {
      const ctx = getAudioContext();
      const parsedOverride = overrideHzText.trim() ? Number(overrideHzText.trim()) : undefined;
      const meta = await acousticSampleBank.importCustomInstrumentSample(
        ctx,
        uploadInstrument,
        file,
        parsedOverride
      );
      setCustomMetas(acousticSampleBank.getAllCustomSampleMetas());
      setUploadStatus(
        `سمپل «${meta.fileName}» با فرکانس کالیبره‌شده ${toPersianDigits(meta.measuredHz.toFixed(1))} هرتز برای ساز انتخابی ذخیره و فعال شد.`
      );
    } catch (err) {
      setUploadError(
        err instanceof Error
          ? err.message
          : 'خطا در خواندن یا رمزگشایی فایل صوتی. لطفاً فایل WAV یا MP3 سالم انتخاب کنید.'
      );
    } finally {
      setImporting(false);
    }
  };

  const handleDeleteCustomSample = async (instId: InstrumentId) => {
    await acousticSampleBank.removeCustomInstrumentSample(instId);
    setCustomMetas(acousticSampleBank.getAllCustomSampleMetas());
    setUploadStatus('سمپل اختصاصی حذف شد و سمپل استودیویی داخلی مجدداً فعال گردید.');
  };

  return (
    <div className="space-y-4">
      {/* Header & Sample Cache Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-ink-100">
        <div>
          <h3 className="text-sm sm:text-base font-extrabold text-ink-900">
            آزمایشگاه صدا و سمپل آکوستیک واقعی (نسخه ۲.۵ استودیویی)
          </h3>
          <p className="text-xs text-ink-500 mt-0.5">
            موتور هیبرید ۵۴ سمپل واقعی کالیبره‌شده با YIN + کانولوشن ۱۲ تا ۱۴ مُد بدنه ساز ایرانی با دقت کوک زیر ۰.۰۱ سنت
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full bg-turquoise-50 border border-turquoise-200 text-turquoise-800 text-[11px] font-bold">
            {toPersianDigits(counts.loadedFiles)} / {toPersianDigits(counts.totalFiles)} سمپل در حافظه
          </span>
          <button
            type="button"
            disabled={preloading}
            onClick={() => void handlePreloadAll()}
            className="px-3 py-1.5 rounded-xl bg-turquoise-600 text-white hover:bg-turquoise-700 disabled:opacity-60 text-xs font-bold transition"
          >
            {preloading ? 'در حال بارگذاری...' : 'پیش‌بارگذاری کامل همه سازها'}
          </button>
        </div>
      </div>

      {/* Active Instrument Physical Body IR Architecture Card */}
      <div className="p-3 rounded-2xl bg-gradient-to-l from-turquoise-50/80 to-amber-50/50 border border-turquoise-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div>
          <div className="font-extrabold text-ink-900">
            مدل فیزیکی بدنه فعال: {activeBodySpec.nameFa}
          </div>
          <div className="text-[11px] text-ink-600 mt-0.5">
            {activeBodySpec.bodyMaterialFa} · {toPersianDigits(activeBodySpec.modes.length)} مُد رزونانس کانولوشن ({toPersianDigits(activeBodySpec.lengthMs)} میلی‌ثانیه)
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-xl bg-white/90 border border-turquoise-200 text-[11px] font-extrabold text-turquoise-800">
          کانولوشن بدنه: {toPersianDigits(Math.round(settings.bodyConvolverMix * 100))}٪
        </span>
      </div>

      {/* 1. Sound Engine Mode Cards */}
      <div>
        <div className="text-xs font-bold text-ink-700 mb-2">حالت موتور صوتی (مقایسه زنده A/B):</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {ENGINE_MODE_CARDS.map((card) => {
            const active = settings.engineMode === card.id;
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => updateSettings({ engineMode: card.id })}
                className={`text-right p-3 rounded-2xl border transition ${
                  active
                    ? 'bg-turquoise-50 border-turquoise-500 ring-1 ring-turquoise-400 shadow-sm'
                    : 'bg-white border-ink-200 hover:border-turquoise-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-extrabold text-ink-900">{card.titleFa}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      active ? 'bg-turquoise-600 text-white' : 'bg-ink-100 text-ink-600'
                    }`}
                  >
                    {card.badgeFa}
                  </span>
                </div>
                <p className="text-[11px] text-ink-600 leading-5">{card.descFa}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* 1B. Master Studio Acoustic Presets */}
      <div className="space-y-2">
        <div className="text-xs font-extrabold text-ink-800">
          پروفایل‌های آماده مسترینگ استودیویی (۱ کلیک):
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {MASTER_STUDIO_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => updateSettings(preset.patch)}
              className="text-right p-2.5 rounded-xl bg-white border border-ink-200 hover:border-turquoise-400 hover:bg-turquoise-50/40 transition"
            >
              <div className="text-xs font-extrabold text-ink-900">{preset.nameFa}</div>
              <div className="text-[10px] text-ink-500 mt-0.5 leading-4">{preset.subtitleFa}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 2. Fine-Grained Acoustic Tone & Articulation Deck */}
      <div className="p-3.5 rounded-2xl bg-parchment-50 border border-ink-100 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-extrabold text-ink-800">
            ظریف‌کاری بدنه آکوستیک، مضراب، نَفَس نی و مالش زنده
          </span>
          <button
            type="button"
            onClick={() => updateSettings({ ...DEFAULT_ACOUSTIC_SCULPT })}
            className="text-[11px] font-bold text-turquoise-700 hover:underline"
          >
            بازگشت به پیش‌فرض استودیو
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <label className="block">
            <div className="flex justify-between text-[11px] font-bold text-ink-700 mb-1">
              <span>کانولوشن بدنه چوبی/پوستی (Body IR)</span>
              <span>{toPersianDigits(Math.round(settings.bodyConvolverMix * 100))}٪</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.bodyConvolverMix}
              onChange={(e) => updateSettings({ bodyConvolverMix: Number(e.target.value) })}
              className="w-full accent-turquoise-600"
            />
          </label>

          <label className="block">
            <div className="flex justify-between text-[11px] font-bold text-ink-700 mb-1">
              <span>گرمای کاسه و پوست (Body Warmth)</span>
              <span>{toPersianDigits(Math.round(settings.bodyWarmth * 100))}٪</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.bodyWarmth}
              onChange={(e) => updateSettings({ bodyWarmth: Number(e.target.value) })}
              className="w-full accent-turquoise-600"
            />
          </label>

          <label className="block">
            <div className="flex justify-between text-[11px] font-bold text-ink-700 mb-1">
              <span>شفافیت مضراب / آرشه (Attack Crispness)</span>
              <span>{toPersianDigits(Math.round(settings.attackCrispness * 100))}٪</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.attackCrispness}
              onChange={(e) => updateSettings({ attackCrispness: Number(e.target.value) })}
              className="w-full accent-turquoise-600"
            />
          </label>

          <label className="block">
            <div className="flex justify-between text-[11px] font-bold text-ink-700 mb-1">
              <span>طنین جفت‌سیم و واخوان / مشتاق</span>
              <span>{toPersianDigits(Math.round(settings.sympatheticShimmer * 100))}٪</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.sympatheticShimmer}
              onChange={(e) => updateSettings({ sympatheticShimmer: Number(e.target.value) })}
              className="w-full accent-turquoise-600"
            />
          </label>

          <label className="block">
            <div className="flex justify-between text-[11px] font-bold text-ink-700 mb-1">
              <span>نَفَس پشت‌دندان نی (Ney Breath)</span>
              <span>{toPersianDigits(Math.round(settings.neyBreathiness * 100))}٪</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.neyBreathiness}
              onChange={(e) => updateSettings({ neyBreathiness: Number(e.target.value) })}
              className="w-full accent-turquoise-600"
            />
          </label>

          <label className="block">
            <div className="flex justify-between text-[11px] font-bold text-ink-700 mb-1">
              <span>ویبراتوی طبیعی نی و کمانچه</span>
              <span>{toPersianDigits(Math.round(settings.vibratoExpression * 100))}٪</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.vibratoExpression}
              onChange={(e) => updateSettings({ vibratoExpression: Number(e.target.value) })}
              className="w-full accent-turquoise-600"
            />
          </label>
        </div>

        {/* Santur Mallet Switch + Legato Malesh & Humanize Toggles */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-ink-100">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-extrabold text-ink-700">نوع مضراب سنتور:</span>
            <div className="inline-flex rounded-xl bg-white border border-ink-200 p-0.5">
              <button
                type="button"
                onClick={() => updateSettings({ santurMallet: 'felt' })}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                  settings.santurMallet === 'felt'
                    ? 'bg-turquoise-600 text-white'
                    : 'text-ink-600 hover:text-ink-900'
                }`}
              >
                نمدی مخملین (گرم)
              </button>
              <button
                type="button"
                onClick={() => updateSettings({ santurMallet: 'wood' })}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                  settings.santurMallet === 'wood'
                    ? 'bg-amber-600 text-white'
                    : 'text-ink-600 hover:text-ink-900'
                }`}
              >
                چوبی لخت (شفاف)
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-1.5 text-xs text-ink-700 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={settings.legatoMalesh}
                onChange={(e) => updateSettings({ legatoMalesh: e.target.checked })}
                className="rounded accent-turquoise-600"
              />
              <span>مالش و اتصال نرم نت‌ها (کمانچه، نی، عود و سه‌تار)</span>
            </label>

            <label className="inline-flex items-center gap-1.5 text-xs text-ink-700 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={settings.humanizeMicroCents}
                onChange={(e) => updateSettings({ humanizeMicroCents: e.target.checked })}
                className="rounded accent-turquoise-600"
              />
              <span>تنوع چرخشی انسانی (زیر ۰.۸ سنت)</span>
            </label>
          </div>
        </div>
      </div>

      {/* 3. Live Audition Deck — All 7 Melodic + Tombak & Daf */}
      <div className="space-y-2.5">
        <div className="text-xs font-extrabold text-ink-800">
          شنیدن زنده جمله آواز شور با مالش، اشاره و تکیه (سُل – لا کُرن – سی‌بمل – دو – لا کُرن – سُل):
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {ALL_INSTRUMENT_IDS.map((instId) => {
            const hasCustom = customMetas.some((m) => m.instrument === instId);
            const isSelected = activeInstrument === instId;
            return (
              <button
                key={instId}
                type="button"
                onClick={() => void auditionMelodicInstrument(instId)}
                className={`p-2.5 rounded-xl border text-center transition ${
                  isSelected
                    ? 'bg-turquoise-600 text-white border-turquoise-600 shadow-sm'
                    : 'bg-white border-ink-200 text-ink-800 hover:border-turquoise-400'
                }`}
              >
                <div className="text-xs font-extrabold">{INSTRUMENT_LABELS_FA[instId]}</div>
                <div
                  className={`text-[10px] mt-0.5 ${
                    isSelected ? 'text-turquoise-100' : 'text-ink-500'
                  }`}
                >
                  {hasCustom ? 'سمپل شخصی شما' : 'پخش نمونه ♪'}
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={() => void auditionPercussion('tombak')}
            className="px-3.5 py-2 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 hover:bg-amber-100 text-xs font-bold transition"
          >
            🥁 تست تنبک واقعی استودیویی (۱۱ ضربه چرخشی + تاکید سرضرب)
          </button>
          <button
            type="button"
            onClick={() => void auditionPercussion('daf')}
            className="px-3.5 py-2 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 hover:bg-amber-100 text-xs font-bold transition"
          >
            🪘 تست دف آکوستیک + حلقه‌های فلزی
          </button>
        </div>
      </div>

      {/* 4. Custom Personal Instrument Sample Importer */}
      <div className="p-3.5 rounded-2xl bg-white border border-ink-200 space-y-3">
        <div>
          <div className="text-xs font-extrabold text-ink-900">
            بارگذاری سمپل واقعی ساز شخصی خودتان (WAV / MP3 / OGG)
          </div>
          <p className="text-[11px] text-ink-500 mt-0.5">
            یک نت شفاف و کشیده از ساز واقعی خودتان ضبط و بارگذاری کنید؛ نوانگار با الگوریتم YIN فرکانس دقیق آن را می‌سنجد و کل ۱۷۳ گوشه ردیف را با صدای واقعی ساز خودتان و کوک دقیق ربع‌پرده می‌نوازد!
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2.5">
          <div>
            <label className="block text-[11px] font-bold text-ink-600 mb-1">ساز مقصد</label>
            <select
              value={uploadInstrument}
              onChange={(e) => setUploadInstrument(e.target.value as InstrumentId)}
              className="rounded-xl border border-ink-200 bg-white px-2.5 py-1.5 text-xs font-bold text-ink-800"
            >
              {ALL_INSTRUMENT_IDS.map((instId) => (
                <option key={instId} value={instId}>
                  {INSTRUMENT_LABELS_FA[instId]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-ink-600 mb-1">
              فرکانس دستی (اختیاری — هرتز)
            </label>
            <input
              type="number"
              step="0.1"
              placeholder="تشخیص خودکار YIN"
              value={overrideHzText}
              onChange={(e) => setOverrideHzText(e.target.value)}
              className="w-36 rounded-xl border border-ink-200 px-2.5 py-1.5 text-xs text-ink-800"
            />
          </div>

          <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-ink-900 text-white hover:bg-ink-800 text-xs font-bold cursor-pointer transition">
            <span>{importing ? 'در حال کالیبراسیون...' : 'انتخاب فایل صوتی ساز'}</span>
            <input
              type="file"
              accept="audio/*"
              disabled={importing}
              onChange={(e) => void handleImportSampleFile(e)}
              className="hidden"
            />
          </label>
        </div>

        {uploadStatus && (
          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
            {uploadStatus}
          </div>
        )}
        {uploadError && (
          <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
            {uploadError}
          </div>
        )}

        {customMetas.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <div className="text-[11px] font-bold text-ink-700">سمپل‌های شخصی فعال (ذخیره آفلاین):</div>
            {customMetas.map((meta) => {
              const instName = INSTRUMENT_LABELS_FA[meta.instrument] ?? meta.instrument;
              return (
                <div
                  key={meta.instrument}
                  className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-xl bg-turquoise-50/60 border border-turquoise-200 text-xs"
                >
                  <div>
                    <span className="font-extrabold text-ink-900">{instName}:</span>{' '}
                    <span className="text-ink-700">{meta.fileName}</span>{' '}
                    <span className="text-turquoise-700 font-bold">
                      ({toPersianDigits(meta.measuredHz.toFixed(1))} Hz · {toPersianDigits(meta.durationSec.toFixed(2))} ثانیه)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => void auditionMelodicInstrument(meta.instrument)}
                      className="px-2.5 py-1 rounded-lg bg-turquoise-600 text-white text-[11px] font-bold"
                    >
                      شنیدن
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteCustomSample(meta.instrument)}
                      className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-700 text-[11px] font-bold"
                    >
                      حذف
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Verified Open-License Attribution */}
      <div className="p-3 rounded-2xl bg-ink-50/70 border border-ink-100 space-y-1.5">
        <div className="text-[11px] font-extrabold text-ink-800">
          منابع و مجوزهای قانونی سمپل‌های استودیویی داخلی (کاملاً آفلاین و متن‌باز):
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {REAL_SAMPLE_CREDITS.map((credit) => (
            <div key={credit.id} className="p-2 rounded-xl bg-white border border-ink-100 text-[11px]">
              <div className="font-bold text-ink-900">{credit.titleFa}</div>
              <div className="text-ink-600 mt-0.5">{credit.instrumentsFa}</div>
              <div className="text-[10px] text-ink-500 mt-1 leading-4">{credit.source}</div>
              <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold text-[10px]">
                مجوز: {credit.license}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
