import React, { useEffect, useRef, useState } from 'react';
import {
  AudioWaveform,
  FileAudio,
  FileCode2,
  FileMusic,
  Play,
  Repeat,
  Sparkles,
  Square,
  Upload,
} from 'lucide-react';
import {
  decodeAndTranscribeAudioBlob,
  synthesizeDemoPhraseWavBlob,
  transcribePcmSamplesToPersianNotes,
  type AudioTranscriptionResult,
} from '../audio/audioSlowdowner';
import { playPersianNote } from '../audio/karplusStrong';
import type { Gusheh, InstrumentId, KoronMode } from '../types/music';
import {
  generateNotesMicrotonalMidiBytes,
  generateNotesMusicXml,
  triggerFileDownload,
} from '../utils/exporters';
import { formatDurationFa, toPersianDigits } from '../utils/persian';

interface AudioSlowdownerPanelProps {
  gusheh: Gusheh;
  instrument: InstrumentId;
  a4Hz: number;
  koronMode: KoronMode;
}

export const AudioSlowdownerPanel: React.FC<AudioSlowdownerPanelProps> = ({
  gusheh,
  instrument,
  a4Hz,
  koronMode,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [sourceName, setSourceName] = useState<string>('');
  const [playbackRate, setPlaybackRate] = useState<number>(0.75);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [loopEnabled, setLoopEnabled] = useState<boolean>(true);
  const [loopA, setLoopA] = useState<number>(0);
  const [loopB, setLoopB] = useState<number>(4);
  const [processing, setProcessing] = useState<boolean>(false);
  const [errorFa, setErrorFa] = useState<string | null>(null);
  const [result, setResult] = useState<AudioTranscriptionResult | null>(null);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  // Enforce pitch preservation & speed on the HTML5 Audio element
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.playbackRate = playbackRate;
    const extended = el as HTMLAudioElement & {
      preservesPitch?: boolean;
      mozPreservesPitch?: boolean;
      webkitPreservesPitch?: boolean;
    };
    if ('preservesPitch' in extended) extended.preservesPitch = true;
    if ('mozPreservesPitch' in extended) extended.mozPreservesPitch = true;
    if ('webkitPreservesPitch' in extended) extended.webkitPreservesPitch = true;
  }, [playbackRate, audioUrl]);

  const setNewAudioBlob = (blob: Blob, label: string) => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }
    const url = URL.createObjectURL(blob);
    objectUrlRef.current = url;
    setAudioUrl(url);
    setSourceName(label);
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleLoadBuiltInDemo = () => {
    setErrorFa(null);
    setProcessing(true);
    try {
      const demoNotes = gusheh.melody.slice(0, 8);
      const { blob, samples, sampleRate } = synthesizeDemoPhraseWavBlob(demoNotes, {
        a4Hz,
        koronMode,
        noteDurationSec: 0.58,
      });
      setNewAudioBlob(blob, `نمونه آموزشی استاد — ${gusheh.nameFa}`);
      const transcription = transcribePcmSamplesToPersianNotes(samples, sampleRate, {
        a4Hz,
        koronMode,
        targetScale: gusheh.scale,
      });
      setResult(transcription);
      setLoopA(0);
      setLoopB(Math.max(0.5, transcription.durationSeconds));
    } catch {
      setErrorFa('خطا در ساخت نمونه آزمایشی صوتی.');
    } finally {
      setProcessing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorFa(null);
    setProcessing(true);
    try {
      setNewAudioBlob(file, file.name);
      const transcription = await decodeAndTranscribeAudioBlob(file, {
        a4Hz,
        koronMode,
        targetScale: gusheh.scale,
      });
      setResult(transcription);
      setLoopA(0);
      setLoopB(Math.max(0.5, transcription.durationSeconds));
    } catch {
      setErrorFa(
        'امکان کدگشایی فایل صوتی در مرورگر نبود. لطفاً یک فایل MP3، WAV یا M4A سالم انتخاب کنید.'
      );
    } finally {
      setProcessing(false);
      e.target.value = '';
    }
  };

  const togglePlayback = () => {
    const el = audioRef.current;
    if (!el || !audioUrl) return;
    if (isPlaying) {
      el.pause();
      setIsPlaying(false);
    } else {
      if (loopEnabled && (el.currentTime < loopA || el.currentTime >= loopB)) {
        el.currentTime = loopA;
      }
      void el.play();
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    const el = audioRef.current;
    if (!el) return;
    setCurrentTime(el.currentTime);
    if (loopEnabled && loopB > loopA + 0.15 && el.currentTime >= loopB) {
      el.currentTime = loopA;
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/85">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-300">
            <AudioWaveform className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
              آهسته‌ساز و نت‌نگار خودکار فایل صوتی استاد (آفلاین)
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              کاهش سرعت ۵۰٪ تا ۱۲۵٪ بدون تغییر کوک + حلقه A–B + استخراج نت‌های کُرُن و سُری با الگوریتم YIN
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleLoadBuiltInDemo}
            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/12 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-500/20 dark:text-amber-300"
          >
            <Sparkles className="h-3.5 w-3.5" />
            بارگذاری نمونه استاد ({gusheh.nameFa})
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-700"
          >
            <Upload className="h-3.5 w-3.5" />
            انتخاب فایل MP3 / WAV
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={(e) => void handleFileUpload(e)}
            className="hidden"
          />
        </div>
      </div>

      {processing && (
        <div className="mt-3 rounded-xl bg-sky-500/10 p-3 text-center text-xs font-semibold text-sky-700 dark:text-sky-300">
          در حال تحلیل آفلاین سیگنال و استخراج نت‌های ربع‌پرده...
        </div>
      )}

      {errorFa && (
        <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-300">
          {errorFa}
        </div>
      )}

      {audioUrl && result && !processing && (
        <div className="mt-3 space-y-3">
          <audio
            ref={audioRef}
            src={audioUrl}
            onTimeUpdate={handleTimeUpdate}
            onEnded={() => setIsPlaying(false)}
            className="hidden"
          />

          {/* File + Transport + Pitch-Preserved Speed Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-100/80 p-2.5 dark:bg-slate-800/70">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-100">
              <FileAudio className="h-4 w-4 text-sky-500" />
              <span>{sourceName}</span>
              <span className="text-[11px] text-slate-500">
                ({formatDurationFa(currentTime)} / {formatDurationFa(result.durationSeconds)})
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={togglePlayback}
                className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold text-white ${
                  isPlaying ? 'bg-rose-600' : 'bg-teal-600'
                }`}
              >
                {isPlaying ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {isPlaying ? 'توقف' : 'پخش آهسته'}
              </button>

              <button
                type="button"
                onClick={() => setLoopEnabled((v) => !v)}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold ${
                  loopEnabled
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                }`}
              >
                <Repeat className="h-3.5 w-3.5" />
                حلقه A–B
              </button>
            </div>
          </div>

          {/* Interactive Waveform + A–B Window */}
          <div
            className="relative flex h-14 cursor-pointer items-end gap-0.5 rounded-xl bg-slate-950 px-2 py-2"
            dir="ltr"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
              const nextSec = ratio * result.durationSeconds;
              if (audioRef.current) {
                audioRef.current.currentTime = nextSec;
                setCurrentTime(nextSec);
              }
            }}
          >
            {/* A-B Highlight Overlay */}
            {result.durationSeconds > 0 && (
              <div
                className="pointer-events-none absolute inset-y-0 border-x-2 border-amber-400 bg-amber-400/15"
                style={{
                  left: `${(loopA / result.durationSeconds) * 100}%`,
                  width: `${Math.max(
                    2,
                    ((loopB - loopA) / result.durationSeconds) * 100
                  )}%`,
                }}
              />
            )}
            {result.envelope.map((v, i) => {
              const frac = i / Math.max(1, result.envelope.length - 1);
              const passed = frac * result.durationSeconds <= currentTime;
              return (
                <div
                  key={i}
                  className={`flex-1 rounded-full ${
                    passed ? 'bg-teal-400' : 'bg-sky-500/45'
                  }`}
                  style={{ height: `${Math.max(10, Math.round(v * 100))}%` }}
                />
              );
            })}
          </div>

          {/* Speed & A-B Sliders */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/50">
              <div className="flex justify-between text-[11px] font-bold">
                <span>سرعت (کوک ثابت)</span>
                <span className="text-sky-600 dark:text-sky-300">
                  {toPersianDigits(Math.round(playbackRate * 100))}٪
                </span>
              </div>
              <input
                type="range"
                min={0.5}
                max={1.25}
                step={0.05}
                value={playbackRate}
                onChange={(e) => setPlaybackRate(Number(e.target.value))}
                className="mt-1 w-full accent-sky-500"
              />
            </div>

            <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/50">
              <div className="flex justify-between text-[11px] font-bold">
                <span>نقطه شروع (A)</span>
                <span>{toPersianDigits(loopA.toFixed(1))} ثانیه</span>
              </div>
              <input
                type="range"
                min={0}
                max={Math.max(0.5, result.durationSeconds - 0.2)}
                step={0.1}
                value={loopA}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setLoopA(val);
                  if (val >= loopB) setLoopB(Math.min(result.durationSeconds, val + 0.5));
                }}
                className="mt-1 w-full accent-amber-500"
              />
            </div>

            <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/50">
              <div className="flex justify-between text-[11px] font-bold">
                <span>نقطه پایان (B)</span>
                <span>{toPersianDigits(loopB.toFixed(1))} ثانیه</span>
              </div>
              <input
                type="range"
                min={Math.min(result.durationSeconds, loopA + 0.2)}
                max={Math.max(0.5, result.durationSeconds)}
                step={0.1}
                value={loopB}
                onChange={(e) => setLoopB(Number(e.target.value))}
                className="mt-1 w-full accent-amber-500"
              />
            </div>
          </div>

          {/* Microtonal Transcribed Notes Chips */}
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/75 p-3 dark:border-slate-800 dark:bg-slate-800/45">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs font-extrabold text-slate-800 dark:text-slate-100">
              <span>
                نت‌های استخراج‌شده توسط DSP ({toPersianDigits(result.notes.length)} نت)
              </span>
              {result.notes.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const xml = generateNotesMusicXml(
                        `نت‌نگاری ${sourceName || gusheh.nameFa}`,
                        result.notes.map((n) => ({
                          ...n.note,
                          durationBeats: Math.max(0.5, Number(((n.endSec - n.startSec) * 1.5).toFixed(2))),
                        })),
                        koronMode
                      );
                      triggerFileDownload(
                        new Blob([xml], {
                          type: 'application/vnd.recordare.musicxml+xml;charset=utf-8',
                        }),
                        'navanegar-transcription.musicxml'
                      );
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-teal-600/90 hover:bg-teal-500 px-2 py-1 text-[10px] font-bold text-white cursor-pointer"
                  >
                    <FileCode2 className="h-3 w-3" />
                    خروجی MusicXML
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const bytes = generateNotesMicrotonalMidiBytes(
                        result.notes.map((n) => ({
                          ...n.note,
                          durationBeats: Math.max(0.5, Number(((n.endSec - n.startSec) * 1.5).toFixed(2))),
                        })),
                        92,
                        koronMode
                      );
                      const buf = bytes.buffer.slice(
                        bytes.byteOffset,
                        bytes.byteOffset + bytes.byteLength
                      ) as ArrayBuffer;
                      triggerFileDownload(
                        new Blob([buf], { type: 'audio/midi' }),
                        'navanegar-transcription.mid'
                      );
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-amber-600/90 hover:bg-amber-500 px-2 py-1 text-[10px] font-bold text-white cursor-pointer"
                  >
                    <FileMusic className="h-3 w-3" />
                    خروجی MIDI ربع‌پرده
                  </button>
                </div>
              )}
            </div>
            {result.notes.length === 0 ? (
              <p className="text-xs text-slate-500">
                نت پایداری در این فایل شناسایی نشد (مطمئن شوید صدای تک‌ساز یا آواز شفاف است).
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {result.notes.map((tn) => {
                  const isCurrent =
                    currentTime >= tn.startSec && currentTime <= tn.endSec;
                  return (
                    <button
                      key={tn.id}
                      type="button"
                      onClick={() => {
                        playPersianNote(tn.note, {
                          instrument,
                          durationSec: 0.7,
                          a4Hz,
                          koronMode,
                        });
                        if (audioRef.current) {
                          audioRef.current.currentTime = tn.startSec;
                          setCurrentTime(tn.startSec);
                        }
                      }}
                      className={`rounded-lg border px-2.5 py-1 text-right text-[11px] transition ${
                        isCurrent
                          ? 'border-teal-400 bg-teal-500 text-slate-950 font-extrabold shadow'
                          : 'border-slate-300 bg-white text-slate-700 hover:border-sky-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                      }`}
                    >
                      <div className="font-bold">{tn.labelFa}</div>
                      <div className="ltr-num text-[9px] opacity-75">
                        {tn.startSec.toFixed(1)}s • {tn.avgCentsOffset >= 0 ? '+' : ''}
                        {tn.avgCentsOffset}¢
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
