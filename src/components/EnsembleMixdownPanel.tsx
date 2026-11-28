import React, { useEffect, useRef, useState } from 'react';
import {
  Download,
  Loader2,
  Play,
  Sliders,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { getAudioContext } from '../audio/audioContext';
import {
  HALL_REVERB_PRESETS,
  type HallReverbPresetId,
} from '../audio/hallReverb';
import { renderEnsembleMixdownWav } from '../audio/mixdownEngine';
import { IRANIAN_GROOVES } from '../audio/percussion';
import { getRecordingBlob } from '../services/recordingDb';
import type {
  DroneVoicing,
  Gusheh,
  InstrumentId,
  IranianGrooveId,
  KoronMode,
  PercussionInstrument,
  SavedRecordingMeta,
} from '../types/music';
import { triggerFileDownload } from '../utils/exporters';
import { INSTRUMENT_LABELS_FA, toPersianDigits } from '../utils/persian';

interface EnsembleMixdownPanelProps {
  gusheh: Gusheh;
  instrument: InstrumentId;
  a4Hz: number;
  koronMode: KoronMode;
  reverbPreset: HallReverbPresetId;
  onChangeReverbPreset: (preset: HallReverbPresetId) => void;
  recordings: SavedRecordingMeta[];
}

export const EnsembleMixdownPanel: React.FC<EnsembleMixdownPanelProps> = ({
  gusheh,
  instrument,
  a4Hz,
  koronMode,
  reverbPreset,
  onChangeReverbPreset,
  recordings,
}) => {
  const [melodyVol, setMelodyVol] = useState(0.8);
  const [droneVol, setDroneVol] = useState(0.5);
  const [percVol, setPercVol] = useState(0.6);
  const [recVol, setRecVol] = useState(0.85);
  const [droneVoicing, setDroneVoicing] = useState<DroneVoicing>('base_fifth');
  const [percInstrument, setPercInstrument] = useState<PercussionInstrument>('tombak');
  const [grooveId, setGrooveId] = useState<IranianGrooveId>('chaharmezrab_6_8');
  const [selectedRecId, setSelectedRecId] = useState<string>('');
  const [bpm, setBpm] = useState<number>(gusheh.practiceLoop.defaultBpm);
  const [rendering, setRendering] = useState(false);
  const [mixUrl, setMixUrl] = useState<string | null>(null);
  const [mixBlob, setMixBlob] = useState<Blob | null>(null);
  const [mixMeta, setMixMeta] = useState<{ durationSec: number; peakLevel: number } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setBpm(gusheh.practiceLoop.defaultBpm);
  }, [gusheh.id, gusheh.practiceLoop.defaultBpm]);

  useEffect(() => {
    return () => {
      if (mixUrl) URL.revokeObjectURL(mixUrl);
    };
  }, [mixUrl]);

  const handleRenderMix = async () => {
    setRendering(true);
    try {
      let recordingPcm: Float32Array | null = null;
      let recordingSampleRate: number | undefined;

      if (selectedRecId) {
        const recMeta = recordings.find((r) => r.id === selectedRecId);
        const blob = recMeta ? await getRecordingBlob(recMeta.ownerUid, recMeta.id) : null;
        if (blob) {
          const arrBuf = await blob.arrayBuffer();
          const ctx = getAudioContext();
          const decoded = await ctx.decodeAudioData(arrBuf.slice(0));
          recordingPcm = decoded.getChannelData(0);
          recordingSampleRate = decoded.sampleRate;
        }
      }

      const result = renderEnsembleMixdownWav({
        gusheh,
        instrument,
        a4Hz,
        koronMode,
        bpm,
        enableOrnaments: false,
        reverbPreset,
        melodyVolume: melodyVol,
        droneVolume: droneVol,
        droneVoicing,
        percussionVolume: percVol,
        percussionInstrument: percInstrument,
        grooveId,
        recordingVolume: selectedRecId ? recVol : 0,
        recordingPcm,
        recordingSampleRate,
      });

      if (mixUrl) URL.revokeObjectURL(mixUrl);
      const url = URL.createObjectURL(result.wavBlob);
      setMixBlob(result.wavBlob);
      setMixUrl(url);
      setMixMeta({ durationSec: result.durationSec, peakLevel: result.peakLevel });
    } finally {
      setRendering(false);
    }
  };

  const handleTogglePreview = () => {
    const el = audioRef.current;
    if (!el || !mixUrl) return;
    if (isPlaying) {
      el.pause();
      setIsPlaying(false);
    } else {
      el.currentTime = 0;
      void el.play();
      setIsPlaying(true);
    }
  };

  const renderSlider = (
    label: string,
    val: number,
    setVal: (v: number) => void,
    accent: string
  ) => (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-800/45">
      <div className="mb-1.5 flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-100">
        <span>{label}</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-mono text-slate-500">
            {toPersianDigits(Math.round(val * 100))}٪
          </span>
          <button
            type="button"
            onClick={() => setVal(val > 0 ? 0 : 0.75)}
            className="text-slate-500 hover:text-teal-600 cursor-pointer"
            aria-label={`قطع یا وصل ${label}`}
          >
            {val <= 0.01 ? <VolumeX className="h-3.5 w-3.5 text-rose-500" /> : <Volume2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={val}
        onChange={(e) => setVal(Number(e.target.value))}
        className={`w-full ${accent}`}
      />
    </div>
  );

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/85">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white">
            <Sliders className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            میکسر همنوازی چندتراکی (Mixdown استودیویی WAV)
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            ترکیب صدای {INSTRUMENT_LABELS_FA[instrument]}، واخوان، تنبک/دف و ضبط شخصی با آکوستیک تالار ایرانی در یک فایل استریو.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void handleRenderMix()}
          disabled={rendering}
          className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-3.5 py-2 text-xs font-extrabold text-white hover:bg-teal-500 disabled:opacity-50 cursor-pointer"
        >
          {rendering ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {rendering ? 'در حال میکس و مسترینگ...' : 'ساخت میکس استودیویی'}
        </button>
      </div>

      {/* 4 Channel Faders */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {renderSlider(`۱. ساز مرجع (${INSTRUMENT_LABELS_FA[instrument]} + زینت)`, melodyVol, setMelodyVol, 'accent-teal-600')}
        {renderSlider('۲. واخوان (Drone مقامی)', droneVol, setDroneVol, 'accent-amber-500')}
        {renderSlider(`۳. ریتم (${percInstrument === 'daf' ? 'دف' : 'تنبک'})`, percVol, setPercVol, 'accent-indigo-600')}
        {renderSlider('۴. صدای ضبط‌شده هنرجو', recVol, setRecVol, 'accent-rose-600')}
      </div>

      {/* Arrangement & Persian Hall Reverb Settings */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
          آکوستیک تالار (Hall Reverb)
          <select
            value={reverbPreset}
            onChange={(e) => onChangeReverbPreset(e.target.value as HallReverbPresetId)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            {HALL_REVERB_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nameFa}
              </option>
            ))}
          </select>
        </label>

        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
          الگوی ریتم تنبک / دف
          <select
            value={grooveId}
            onChange={(e) => setGrooveId(e.target.value as IranianGrooveId)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            {IRANIAN_GROOVES.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nameFa}
              </option>
            ))}
          </select>
        </label>

        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
          ساز کوبه‌ای + چیدمان واخوان
          <div className="mt-1 flex gap-1">
            <select
              value={percInstrument}
              onChange={(e) => setPercInstrument(e.target.value as PercussionInstrument)}
              className="w-1/2 rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="tombak">تنبک</option>
              <option value="daf">دف</option>
            </select>
            <select
              value={droneVoicing}
              onChange={(e) => setDroneVoicing(e.target.value as DroneVoicing)}
              className="w-1/2 rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="base">بم</option>
              <option value="base_fifth">بم + پنجم</option>
              <option value="base_shahed">بم + شاهد</option>
            </select>
          </div>
        </label>

        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
          افزودن ضبط شخصی ({toPersianDigits(recordings.length)})
          <select
            value={selectedRecId}
            onChange={(e) => setSelectedRecId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="">بدون ضبط (همنوازی ارکسترال)</option>
            {recordings.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title} ({toPersianDigits(r.avgAccuracy)}٪)
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Rendered Stereo Mixdown Player & Download */}
      {mixUrl && mixMeta && mixBlob && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/40 bg-emerald-50/70 p-3 dark:bg-emerald-950/25">
          <div className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
            میکس استریو آماده شد • مدت: {toPersianDigits(mixMeta.durationSec)} ثانیه • سقف خروجی:{' '}
            {toPersianDigits(Math.round(mixMeta.peakLevel * 100))}٪
          </div>
          <div className="flex items-center gap-2">
            <audio
              ref={audioRef}
              src={mixUrl}
              onEnded={() => setIsPlaying(false)}
              className="hidden"
            />
            <button
              type="button"
              onClick={handleTogglePreview}
              className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 cursor-pointer"
            >
              {isPlaying ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {isPlaying ? 'توقف' : 'شنیدن میکس'}
            </button>
            <button
              type="button"
              onClick={() => triggerFileDownload(mixBlob, `navanegar-mixdown-${gusheh.id}.wav`)}
              className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              دانلود WAV استریو
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
