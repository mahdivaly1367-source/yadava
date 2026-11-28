import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Download,
  FileCode2,
  FileMusic,
  FolderOpen,
  Music,
  Play,
  Plus,
  Printer,
  RotateCcw,
  Save,
  Square,
  Trash2,
} from 'lucide-react';
import { playGushehPhrase, playPersianNote, type PhrasePlaybackHandle } from '../audio/karplusStrong';
import {
  ACCIDENTAL_CYCLE,
  createScoreFromGusheh,
  customScoreToGusheh,
  deleteSavedCustomScore,
  DURATION_OPTIONS,
  loadSavedCustomScores,
  ORNAMENT_OPTIONS,
  persistCustomScore,
  stepNoteDiatonic,
  type CustomPersianScore,
} from '../core/scoreEditor';
import { formatNoteFa } from '../data/musicTheory';
import type {
  Accidental,
  Gusheh,
  InstrumentId,
  IranianMeter,
  KoronMode,
  MelodyNote,
  OrnamentType,
} from '../types/music';
import {
  generateGushehMusicXml,
  generateMicrotonalMidiBytes,
  synthesizeGushehToWav,
  triggerFileDownload,
} from '../utils/exporters';
import { toPersianDigits } from '../utils/persian';
import { generatePrintableSheetHtml, openPrintableSheetWindow } from '../utils/printableSheet';
import { PersianStaffNotation } from './PersianStaffNotation';

interface MicrotonalScoreEditorPanelProps {
  gusheh: Gusheh;
  instrument: InstrumentId;
  a4Hz: number;
  koronMode: KoronMode;
}

const ACCIDENTAL_LABELS: Record<Accidental, string> = {
  natural: 'بکار (♮)',
  koron: 'کُرُن (𝄳)',
  flat: 'بمل (♭)',
  sori: 'سُری (𝄲)',
  sharp: 'دیز (♯)',
};

const METER_OPTIONS: IranianMeter[] = ['2/4', '3/4', '4/4', '5/8', '6/8', '7/8'];

export const MicrotonalScoreEditorPanel: React.FC<MicrotonalScoreEditorPanelProps> = ({
  gusheh,
  instrument,
  a4Hz,
  koronMode,
}) => {
  const [score, setScore] = useState<CustomPersianScore>(() => createScoreFromGusheh(gusheh));
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [savedScores, setSavedScores] = useState<CustomPersianScore[]>(() => loadSavedCustomScores());
  const [statusMsg, setStatusMsg] = useState<string>('');
  const playbackRef = useRef<PhrasePlaybackHandle | null>(null);

  useEffect(() => {
    return () => {
      playbackRef.current?.stop();
    };
  }, []);

  const previewGusheh = useMemo(() => customScoreToGusheh(score), [score]);
  const safeSelectedIdx = Math.max(0, Math.min(score.notes.length - 1, selectedIdx));
  const selectedNote = score.notes[safeSelectedIdx];

  const updateSelectedNote = (updater: (note: MelodyNote) => MelodyNote) => {
    setScore((prev) => {
      const notes = [...prev.notes];
      if (!notes[safeSelectedIdx]) return prev;
      const updated = updater(notes[safeSelectedIdx]);
      notes[safeSelectedIdx] = updated;
      playPersianNote(updated, {
        instrument,
        durationSec: 0.45,
        a4Hz,
        koronMode,
        enableOrnaments: false,
        scale: previewGusheh.scale,
      });
      return { ...prev, notes };
    });
  };

  const handleInsertNote = () => {
    setScore((prev) => {
      const base = prev.notes[safeSelectedIdx] ?? {
        letter: 'G' as const,
        accidental: 'natural' as const,
        octave: 4,
        durationBeats: 1,
      };
      const copy: MelodyNote = { ...base, ornament: undefined };
      const notes = [
        ...prev.notes.slice(0, safeSelectedIdx + 1),
        copy,
        ...prev.notes.slice(safeSelectedIdx + 1),
      ];
      return { ...prev, notes };
    });
    setSelectedIdx((i) => i + 1);
  };

  const handleDeleteNote = () => {
    if (score.notes.length <= 1) return;
    setScore((prev) => ({
      ...prev,
      notes: prev.notes.filter((_, idx) => idx !== safeSelectedIdx),
    }));
    setSelectedIdx((i) => Math.max(0, i - 1));
  };

  const handleTogglePlay = () => {
    if (isPlaying) {
      playbackRef.current?.stop();
      setIsPlaying(false);
      setPlayingIdx(null);
      return;
    }
    setIsPlaying(true);
    playbackRef.current = playGushehPhrase(previewGusheh.melody, {
      instrument,
      bpm: score.bpm,
      speedMultiplier: 1,
      a4Hz,
      koronMode,
      startIndex: 0,
      endIndex: previewGusheh.melody.length - 1,
      loop: false,
      enableOrnaments: false,
      scale: previewGusheh.scale,
      onNoteStart: (idx) => setPlayingIdx(idx),
      onComplete: () => {
        setIsPlaying(false);
        setPlayingIdx(null);
      },
    });
  };

  const handleSaveLocal = () => {
    const updated = persistCustomScore(score);
    setSavedScores(updated);
    setStatusMsg(`قطعه «${score.titleFa}» در حافظه آفلاین ذخیره شد.`);
  };

  const handleExportXml = () => {
    const xml = generateGushehMusicXml(previewGusheh, koronMode);
    triggerFileDownload(
      new Blob([xml], { type: 'application/vnd.recordare.musicxml+xml;charset=utf-8' }),
      `${score.id}.musicxml`
    );
  };

  const handleExportMidi = () => {
    const bytes = generateMicrotonalMidiBytes(previewGusheh, score.bpm, koronMode);
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    triggerFileDownload(new Blob([buffer], { type: 'audio/midi' }), `${score.id}.mid`);
  };

  const handleExportWav = () => {
    const wavBytes = synthesizeGushehToWav(previewGusheh, instrument, score.bpm, a4Hz, koronMode);
    const buffer = wavBytes.buffer.slice(wavBytes.byteOffset, wavBytes.byteOffset + wavBytes.byteLength) as ArrayBuffer;
    triggerFileDownload(new Blob([buffer], { type: 'audio/wav' }), `${score.id}.wav`);
  };

  const handlePrintA4 = () => {
    const html = generatePrintableSheetHtml({
      gusheh: previewGusheh,
      instrument,
      koronMode,
      a4Hz,
    });
    openPrintableSheetWindow(html, `${score.id}-a4.html`);
  };

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/85">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white">
            <Music className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            ویرایشگر و نت‌نگار تعاملی ربع‌پرده (آهنگ‌ساز ایرانی)
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            روی هر نت کلیک کنید، ارتفاع، کرن/سری، دیرند و زینت آن را تغییر دهید و خروجی استاندارد بگیرید.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              playbackRef.current?.stop();
              setIsPlaying(false);
              setScore(createScoreFromGusheh(gusheh));
              setSelectedIdx(0);
              setStatusMsg(`الگوی گوشه «${gusheh.nameFa}» بارگذاری شد.`);
            }}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            بارگذاری از گوشه فعلی
          </button>
          <button
            type="button"
            onClick={handleTogglePlay}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-extrabold text-white cursor-pointer ${
              isPlaying ? 'bg-rose-600 hover:bg-rose-500' : 'bg-teal-600 hover:bg-teal-500'
            }`}
          >
            {isPlaying ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {isPlaying ? 'توقف پخش' : 'پخش قطعه'}
          </button>
        </div>
      </div>

      {/* Metadata Bar */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
          عنوان قطعه / اتود
          <input
            type="text"
            value={score.titleFa}
            onChange={(e) => setScore((s) => ({ ...s, titleFa: e.target.value }))}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </label>
        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
          میزان‌نما
          <select
            value={score.meter}
            onChange={(e) => setScore((s) => ({ ...s, meter: e.target.value as IranianMeter }))}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            {METER_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
          تمپو: {toPersianDigits(score.bpm)} BPM
          <input
            type="range"
            min={50}
            max={160}
            value={score.bpm}
            onChange={(e) => setScore((s) => ({ ...s, bpm: Number(e.target.value) }))}
            className="mt-2 w-full accent-teal-600"
          />
        </label>
      </div>

      {/* Live Interactive Microtonal Staff */}
      <PersianStaffNotation
        gusheh={previewGusheh}
        instrument={instrument}
        activeNoteIndex={playingIdx ?? safeSelectedIdx}
        loopStart={0}
        loopEnd={Math.max(0, previewGusheh.melody.length - 1)}
        onSelectNote={(idx) => setSelectedIdx(idx)}
      />

      {/* Selected Note Inspector Controls */}
      {selectedNote && (
        <div className="rounded-xl border border-teal-500/30 bg-teal-50/50 p-3 space-y-3 dark:bg-teal-950/20">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-black text-teal-900 dark:text-teal-200">
              نت انتخاب‌شده (#{toPersianDigits(safeSelectedIdx + 1)}):{' '}
              <span className="rounded-lg bg-teal-600 px-2 py-0.5 text-white">
                {formatNoteFa(selectedNote)}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => updateSelectedNote((n) => stepNoteDiatonic(n, 1))}
                className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 border border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 cursor-pointer"
              >
                <ArrowUp className="h-3.5 w-3.5 text-teal-600" />
                زیرتر
              </button>
              <button
                type="button"
                onClick={() => updateSelectedNote((n) => stepNoteDiatonic(n, -1))}
                className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 border border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 cursor-pointer"
              >
                <ArrowDown className="h-3.5 w-3.5 text-amber-600" />
                بم‌تر
              </button>
              <button
                type="button"
                onClick={handleInsertNote}
                className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-teal-500 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                افزودن نت بعد
              </button>
              <button
                type="button"
                onClick={handleDeleteNote}
                disabled={score.notes.length <= 1}
                className="inline-flex items-center gap-1 rounded-lg bg-rose-600/90 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-rose-500 disabled:opacity-40 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                حذف
              </button>
            </div>
          </div>

          {/* Accidentals (Natural / Koron / Flat / Sori / Sharp) */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">علامت عرضی:</span>
            {ACCIDENTAL_CYCLE.map((acc) => (
              <button
                key={acc}
                type="button"
                onClick={() => updateSelectedNote((n) => ({ ...n, accidental: acc }))}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition cursor-pointer ${
                  selectedNote.accidental === acc
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200'
                }`}
              >
                {ACCIDENTAL_LABELS[acc]}
              </button>
            ))}
          </div>

          {/* Duration + Ornament */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">دیرند:</span>
              {DURATION_OPTIONS.map((d) => (
                <button
                  key={d.beats}
                  type="button"
                  onClick={() => updateSelectedNote((n) => ({ ...n, durationBeats: d.beats }))}
                  className={`rounded-lg px-2 py-1 text-[11px] font-bold cursor-pointer ${
                    selectedNote.durationBeats === d.beats
                      ? 'bg-teal-600 text-white'
                      : 'bg-white text-slate-700 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200'
                  }`}
                >
                  {d.labelFa}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">زینت:</span>
              {ORNAMENT_OPTIONS.map((o) => {
                const active = (selectedNote.ornament ?? 'none') === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() =>
                      updateSelectedNote((n) => ({
                        ...n,
                        ornament: o.id === 'none' ? undefined : (o.id as OrnamentType),
                      }))
                    }
                    className={`rounded-lg px-2 py-1 text-[11px] font-bold cursor-pointer ${
                      active
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white text-slate-700 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {o.labelFa}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Save & Export Studio Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={handleSaveLocal}
            className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 cursor-pointer"
          >
            <Save className="h-3.5 w-3.5" />
            ذخیره آفلاین
          </button>
          <button
            type="button"
            onClick={handleExportXml}
            className="inline-flex items-center gap-1 rounded-xl bg-teal-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-teal-500 cursor-pointer"
          >
            <FileCode2 className="h-3.5 w-3.5" />
            MusicXML
          </button>
          <button
            type="button"
            onClick={handleExportMidi}
            className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-indigo-500 cursor-pointer"
          >
            <FileMusic className="h-3.5 w-3.5" />
            MIDI ربع‌پرده
          </button>
          <button
            type="button"
            onClick={handleExportWav}
            className="inline-flex items-center gap-1 rounded-xl bg-amber-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-amber-500 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            صوت WAV
          </button>
          <button
            type="button"
            onClick={handlePrintA4}
            className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-500 cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5" />
            چاپ A4 / PDF
          </button>
        </div>

        {statusMsg && (
          <span className="text-[11px] font-bold text-teal-700 dark:text-teal-300">
            {statusMsg}
          </span>
        )}
      </div>

      {/* Saved Compositions Library */}
      {savedScores.length > 0 && (
        <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-800/40">
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-extrabold text-slate-700 dark:text-slate-200">
            <FolderOpen className="h-3.5 w-3.5 text-teal-600" />
            قطعات ذخیره‌شده من ({toPersianDigits(savedScores.length)})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {savedScores.map((item) => (
              <div
                key={item.id}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-900"
              >
                <button
                  type="button"
                  onClick={() => {
                    setScore(item);
                    setSelectedIdx(0);
                    setStatusMsg(`قطعه «${item.titleFa}» باز شد.`);
                  }}
                  className="font-bold text-slate-800 hover:text-teal-600 dark:text-slate-100 cursor-pointer"
                >
                  {item.titleFa} ({toPersianDigits(item.notes.length)} نت)
                </button>
                <button
                  type="button"
                  onClick={() => setSavedScores(deleteSavedCustomScore(item.id))}
                  aria-label="حذف قطعه"
                  className="text-rose-500 hover:text-rose-400 cursor-pointer"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
