import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowLeftRight,
  Circle,
  Download,
  Globe,
  Lock,
  Play,
  Save,
  Square,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { requestMicrophoneStream, stopMediaStream } from '../audio/audioContext';
import { analyzeAudioBlob, pickSupportedAudioMimeType } from '../audio/recordingAnalyzer';
import {
  buildRecordingTimeline,
  compareRecordings,
} from '../core/recordingComparison';
import { formatNoteFa, noteToFrequency } from '../data/musicTheory';
import { FREE_MAX_RECORDINGS } from '../services/billing';
import { getRecordingBlob } from '../services/recordingDb';
import type { ObjectUrlRegistry } from '../services/sessionStore';
import type {
  Gusheh,
  InstrumentId,
  KoronMode,
  RecordedPitchPoint,
  RecordingAnalysis,
  SavedRecordingMeta,
} from '../types/music';
import { triggerFileDownload } from '../utils/exporters';
import { formatJalaliShortFa } from '../utils/jalali';
import { formatDurationFa, INSTRUMENT_LABELS_FA, toPersianDigits } from '../utils/persian';

interface RecorderPanelProps {
  ownerUid: string;
  ownerName: string;
  gusheh: Gusheh;
  instrument: InstrumentId;
  a4Hz: number;
  koronMode: KoronMode;
  isPro: boolean;
  recordings: SavedRecordingMeta[];
  autoRecord: boolean;
  onToggleAutoRecord: (enabled: boolean) => void;
  externalTriggerState?: 'idle' | 'start' | 'stop';
  objectUrlRegistry: ObjectUrlRegistry;
  onSaveRecording: (meta: SavedRecordingMeta, blob: Blob) => Promise<void>;
  onToggleRecordingPublic: (recording: SavedRecordingMeta) => Promise<void>;
  onDeleteRecording: (recordingId: string) => Promise<void>;
  onRequestUpgrade: () => void;
}

export const RecorderPanel: React.FC<RecorderPanelProps> = ({
  ownerUid,
  ownerName,
  gusheh,
  instrument,
  a4Hz,
  koronMode,
  isPro,
  recordings,
  autoRecord,
  onToggleAutoRecord,
  externalTriggerState,
  objectUrlRegistry,
  onSaveRecording,
  onToggleRecordingPublic,
  onDeleteRecording,
  onRequestUpgrade,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<RecordingAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [errorFa, setErrorFa] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [replayTimeSec, setReplayTimeSec] = useState<number>(0);
  const [replayDurationSec, setReplayDurationSec] = useState<number>(0);
  const [overlayContour, setOverlayContour] = useState<RecordedPitchPoint[] | null>(null);
  const [overlayTitleFa, setOverlayTitleFa] = useState<string>('');
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareAId, setCompareAId] = useState<string>('');
  const [compareBId, setCompareBId] = useState<string>('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  // Clean up when ownerUid changes (atomic session isolation)
  useEffect(() => {
    setPendingBlob(null);
    setPendingUrl(null);
    setAnalysis(null);
    setPlayingId(null);
    setCompareAId('');
    setCompareBId('');
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.src = '';
    }
  }, [ownerUid]);

  // Auto-select oldest & newest recordings for Before/After comparison
  useEffect(() => {
    if (recordings.length >= 2) {
      if (!recordings.some((r) => r.id === compareAId)) {
        setCompareAId(recordings[recordings.length - 1].id);
      }
      if (!recordings.some((r) => r.id === compareBId)) {
        setCompareBId(recordings[0].id);
      }
    }
  }, [compareAId, compareBId, recordings]);

  const comparison = useMemo(() => {
    if (recordings.length < 2) return null;
    const a = recordings.find((r) => r.id === compareAId) ?? recordings[recordings.length - 1];
    const b = recordings.find((r) => r.id === compareBId) ?? recordings[0];
    if (!a || !b || a.id === b.id) return null;
    return compareRecordings(a, b);
  }, [compareAId, compareBId, recordings]);

  const timelinePoints = useMemo(() => buildRecordingTimeline(recordings), [recordings]);

  const startRecording = async () => {
    setErrorFa(null);
    if (isRecording) return;
    try {
      const stream = await requestMicrophoneStream();
      streamRef.current = stream;
      chunksRef.current = [];
      const mimeType = pickSupportedAudioMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          chunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, {
          type: mimeType || 'audio/webm',
        });
        stopMediaStream(streamRef.current);
        streamRef.current = null;

        if (pendingUrl) {
          objectUrlRegistry.revoke(pendingUrl);
        }
        const url = objectUrlRegistry.create(blob);
        setPendingBlob(blob);
        setPendingUrl(url);
        setTitleInput(`اجرای ${gusheh.nameFa} با ${INSTRUMENT_LABELS_FA[instrument]}`);
        setAnalyzing(true);
        const result = await analyzeAudioBlob(blob, gusheh.scale, a4Hz, koronMode);
        setAnalysis(result);
        setAnalyzing(false);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setIsRecording(true);
      setElapsedSec(0);
      timerRef.current = window.setInterval(() => {
        setElapsedSec((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      setErrorFa(
        err instanceof Error
          ? err.message
          : 'اجازه دسترسی به میکروفون برای ضبط صدا داده نشد.'
      );
    }
  };

  const stopRecording = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  useEffect(() => {
    if (!autoRecord) return;
    if (externalTriggerState === 'start' && !isRecording) {
      void startRecording();
    } else if (externalTriggerState === 'stop' && isRecording) {
      stopRecording();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalTriggerState, autoRecord]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
      stopMediaStream(streamRef.current);
    };
  }, []);

  const reachedFreeCap = !isPro && recordings.length >= FREE_MAX_RECORDINGS;

  const handleSave = async () => {
    if (!pendingBlob || !analysis) return;
    if (reachedFreeCap) {
      onRequestUpgrade();
      return;
    }
    const now = Date.now();
    const meta: SavedRecordingMeta = {
      id: `rec_${now}_${Math.random().toString(36).slice(2, 7)}`,
      ownerUid,
      ownerName,
      gushehId: gusheh.id,
      dastgahId: gusheh.dastgahId,
      instrument,
      title: titleInput.trim() || `اجرای ${gusheh.nameFa}`,
      durationSeconds: analysis.durationSeconds,
      avgAccuracy: analysis.avgAccuracy,
      rmsDb: analysis.rmsDb,
      envelope: analysis.envelope,
      pitchContour: analysis.pitchContour,
      isPublic: false,
      hasLocalAudio: true,
      createdAt: now,
      updatedAt: now,
    };

    await onSaveRecording(meta, pendingBlob);
    setPendingBlob(null);
    setAnalysis(null);
  };

  const handlePlaySaved = async (rec: SavedRecordingMeta) => {
    if (playingId === rec.id) {
      audioElRef.current?.pause();
      setPlayingId(null);
      return;
    }
    const blob = await getRecordingBlob(ownerUid, rec.id);
    if (!blob) {
      setErrorFa('فایل صوتی محلی این ضبط روی این دستگاه موجود نیست.');
      return;
    }
    const url = objectUrlRegistry.create(blob);
    if (!audioElRef.current) {
      audioElRef.current = new Audio();
    }
    audioElRef.current.src = url;
    audioElRef.current.ontimeupdate = () => {
      if (audioElRef.current) {
        setReplayTimeSec(audioElRef.current.currentTime);
        if (audioElRef.current.duration && Number.isFinite(audioElRef.current.duration)) {
          setReplayDurationSec(audioElRef.current.duration);
        }
      }
    };
    audioElRef.current.onended = () => {
      setPlayingId(null);
      setReplayTimeSec(0);
    };
    setReplayDurationSec(Math.max(0.5, rec.durationSeconds));
    setOverlayTitleFa(rec.title);
    setOverlayContour(rec.pitchContour ?? null);
    await audioElRef.current.play();
    setPlayingId(rec.id);
  };

  // Renders Feature 2: Overlay Pitch Contour Replay (Student Recorded YIN Curve vs Target Reference Scale)
  const renderOverlayContourSvg = (
    contour: RecordedPitchPoint[],
    durationSec: number,
    playheadSec: number,
    titleFa: string
  ) => {
    if (!contour.length) return null;
    const scaleFreqs = gusheh.scale.map((n) => ({
      labelFa: formatNoteFa(n),
      freq: noteToFrequency(n, a4Hz, koronMode),
    }));
    const allFreqs = [
      ...scaleFreqs.map((s) => s.freq),
      ...contour.map((p) => p.freqHz),
    ];
    const minFreq = Math.max(80, Math.min(...allFreqs) * 0.92);
    const maxFreq = Math.max(minFreq + 40, Math.max(...allFreqs) * 1.08);
    const logMin = Math.log2(minFreq);
    const logMax = Math.log2(maxFreq);
    const freqToY = (f: number) => {
      const clamped = Math.max(minFreq, Math.min(maxFreq, f));
      const norm = (Math.log2(clamped) - logMin) / Math.max(0.001, logMax - logMin);
      return 128 - norm * 108;
    };
    const safeDur = Math.max(0.5, durationSec, contour[contour.length - 1]?.timeSec ?? 1);
    const playheadX = 48 + Math.min(1, Math.max(0, playheadSec / safeDur)) * 492;

    return (
      <div className="mt-3 rounded-xl border border-teal-500/35 bg-slate-950 p-3 text-white">
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1.5 font-bold text-teal-300">
            <Activity className="h-3.5 w-3.5" />
            پخش هم‌پوشانی خط کوک ضبط‌شده روی درجات مرجع — {titleFa}
          </span>
          <span className="text-[10px] text-slate-400">
            سبز: کوک دقیق (±۱۵¢) • نارنجی: انحراف ملایم • قرمز: فالش
          </span>
        </div>
        <div dir="ltr">
        <svg viewBox="0 0 560 144" className="h-36 w-full">
          {/* Reference Scale Degree Horizontal Lines */}
          {scaleFreqs.map((s, idx) => {
            const y = freqToY(s.freq);
            return (
              <g key={`${s.labelFa}-${idx}`}>
                <line
                  x1={48}
                  y1={y}
                  x2={544}
                  y2={y}
                  stroke="rgba(255,255,255,0.14)"
                  strokeDasharray="4 4"
                />
                <text
                  x={42}
                  y={y + 3}
                  textAnchor="end"
                  fill="#94a3b8"
                  fontSize="9"
                >
                  {s.labelFa}
                </text>
              </g>
            );
          })}

          {/* Continuous Recorded Student Contour Path */}
          <polyline
            fill="none"
            stroke="#2dd4bf"
            strokeWidth="2"
            strokeOpacity="0.85"
            points={contour
              .map((pt) => {
                const x = 48 + Math.min(1, pt.timeSec / safeDur) * 492;
                const y = freqToY(pt.freqHz);
                return `${x.toFixed(1)},${y.toFixed(1)}`;
              })
              .join(' ')}
          />

          {/* Color-coded Accuracy Points */}
          {contour.map((pt, i) => {
            const x = 48 + Math.min(1, pt.timeSec / safeDur) * 492;
            const y = freqToY(pt.freqHz);
            const absC = Math.abs(pt.centsOffset);
            const color =
              absC <= 15 ? '#34d399' : absC <= 30 ? '#fbbf24' : '#f43f5e';
            return (
              <circle key={i} cx={x} cy={y} r="2.6" fill={color}>
                <title>
                  {pt.noteLabelFa} ({pt.centsOffset >= 0 ? '+' : ''}
                  {pt.centsOffset}¢)
                </title>
              </circle>
            );
          })}

          {/* Live Synced Playhead */}
          <line
            x1={playheadX}
            y1={12}
            x2={playheadX}
            y2={134}
            stroke="#f59e0b"
            strokeWidth="2"
          />
        </svg>
        </div>
      </div>
    );
  };

  const handleDownloadSaved = async (rec: SavedRecordingMeta) => {
    const blob = await getRecordingBlob(ownerUid, rec.id);
    if (!blob) {
      setErrorFa('فایل صوتی محلی برای دانلود روی این دستگاه موجود نیست.');
      return;
    }
    const ext = blob.type.includes('ogg') ? 'ogg' : blob.type.includes('mp4') ? 'm4a' : 'webm';
    triggerFileDownload(blob, `navanegar-${rec.id}.${ext}`);
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/85">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
            ضبط، تحلیل پس از اجرا و مقایسه پیشرفت ضبط‌ها (Before / After)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isPro
              ? `بایگانی نامحدود فعال (${toPersianDigits(recordings.length)} قطعه ذخیره شده)`
              : `سقف نسخه رایگان: ${toPersianDigits(recordings.length)} از ${toPersianDigits(FREE_MAX_RECORDINGS)} قطعه`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {recordings.length >= 2 && (
            <button
              type="button"
              onClick={() => setCompareOpen((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                compareOpen
                  ? 'border-amber-500 bg-amber-500 text-slate-950'
                  : 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
              }`}
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              مقایسه قبل / بعد ({toPersianDigits(recordings.length)})
            </button>
          )}

          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100/80 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <input
              type="checkbox"
              checked={autoRecord}
              onChange={(e) => onToggleAutoRecord(e.target.checked)}
              className="accent-teal-600"
            />
            ضبط خودکار
          </label>

          <button
            type="button"
            onClick={isRecording ? stopRecording : () => void startRecording()}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition ${
              isRecording
                ? 'animate-pulse bg-rose-600 hover:bg-rose-700'
                : 'bg-slate-900 hover:bg-slate-800 dark:bg-teal-600 dark:hover:bg-teal-700'
            }`}
          >
            {isRecording ? (
              <Square className="h-3.5 w-3.5" />
            ) : (
              <Circle className="h-3.5 w-3.5 fill-rose-500 text-rose-500" />
            )}
            {isRecording
              ? `توقف ضبط (${formatDurationFa(elapsedSec)})`
              : 'ضبط دستی قطعه'}
          </button>
        </div>
      </div>

      {errorFa && (
        <div className="mt-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-300">
          {errorFa}
        </div>
      )}

      {/* Feature 9: Before/After Recording Comparison & Progress Timeline */}
      {compareOpen && comparison && (
        <div className="mt-3 rounded-2xl border border-amber-500/35 bg-amber-500/5 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-amber-700 dark:text-amber-300">
              <TrendingUp className="h-4 w-4" />
              مقایسه تحلیلی اجرای قدیم در برابر اجرای جدید
            </div>
            <div className="flex flex-wrap gap-2 text-[11px]">
              <select
                value={compareAId}
                onChange={(e) => setCompareAId(e.target.value)}
                aria-label="ضبط اول برای مقایسه"
                className="rounded-lg border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
              >
                {recordings.map((r) => (
                  <option key={r.id} value={r.id}>
                    الف: {r.title} ({toPersianDigits(r.avgAccuracy)}٪)
                  </option>
                ))}
              </select>
              <select
                value={compareBId}
                onChange={(e) => setCompareBId(e.target.value)}
                aria-label="ضبط دوم برای مقایسه"
                className="rounded-lg border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
              >
                {recordings.map((r) => (
                  <option key={r.id} value={r.id}>
                    ب: {r.title} ({toPersianDigits(r.avgAccuracy)}٪)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3 text-center text-xs">
            <div className="rounded-xl bg-white/85 p-2.5 dark:bg-slate-900/75">
              <div className="text-[10px] text-slate-500">تغییر دقت کوک (Δ)</div>
              <div
                className={`mt-0.5 text-base font-black ${
                  comparison.accuracyDelta >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-500'
                }`}
              >
                {comparison.accuracyDelta >= 0 ? '+' : ''}
                {toPersianDigits(comparison.accuracyDelta)}٪
              </div>
              <div className="text-[10px] text-slate-500">
                {toPersianDigits(comparison.earlier.avgAccuracy)}٪ ←{' '}
                {toPersianDigits(comparison.later.avgAccuracy)}٪
              </div>
            </div>

            <div className="rounded-xl bg-white/85 p-2.5 dark:bg-slate-900/75">
              <div className="text-[10px] text-slate-500">کاهش خطای سنت</div>
              <div
                className={`mt-0.5 text-base font-black ${
                  comparison.centsErrorReduction >= 0
                    ? 'text-teal-600 dark:text-teal-300'
                    : 'text-amber-600'
                }`}
              >
                {comparison.centsErrorReduction >= 0 ? '↓ ' : '↑ '}
                {toPersianDigits(Math.abs(comparison.centsErrorReduction))} سنت
              </div>
              <div className="text-[10px] text-slate-500">
                ±{toPersianDigits(comparison.estimatedCentsErrorEarlier)}¢ ← ±
                {toPersianDigits(comparison.estimatedCentsErrorLater)}¢
              </div>
            </div>

            <div className="rounded-xl bg-white/85 p-2.5 dark:bg-slate-900/75">
              <div className="text-[10px] text-slate-500">پایداری پوش صدا و نفس</div>
              <div className="mt-0.5 text-base font-black text-sky-600 dark:text-sky-300">
                {comparison.stabilityDelta >= 0 ? '+' : ''}
                {toPersianDigits(comparison.stabilityDelta)}٪
              </div>
              <div className="text-[10px] text-slate-500">
                {toPersianDigits(comparison.envelopeStabilityEarlier)}٪ ←{' '}
                {toPersianDigits(comparison.envelopeStabilityLater)}٪
              </div>
            </div>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <p className="font-semibold text-slate-700 dark:text-slate-200">
              {comparison.verdictFa}
            </p>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => void handlePlaySaved(comparison.earlier)}
                className="rounded-lg bg-slate-200 px-2.5 py-1 font-bold text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200"
              >
                پخش قبل ({formatJalaliShortFa(new Date(comparison.earlier.createdAt))})
              </button>
              <button
                type="button"
                onClick={() => void handlePlaySaved(comparison.later)}
                className="rounded-lg bg-teal-600 px-2.5 py-1 font-bold text-white hover:bg-teal-700"
              >
                پخش بعد ({formatJalaliShortFa(new Date(comparison.later.createdAt))})
              </button>
            </div>
          </div>

          {/* Progress Sparkline SVG */}
          {timelinePoints.length >= 2 && (
            <div className="mt-3 rounded-xl bg-slate-950/90 p-2.5">
              <div className="mb-1 text-[10px] font-bold text-slate-400">
                نمودار روند دقت کوک در طول ضبط‌های بایگانی:
              </div>
              <svg viewBox="0 0 300 54" className="h-12 w-full">
                <polyline
                  fill="none"
                  stroke="#2dd4bf"
                  strokeWidth="2.5"
                  points={timelinePoints
                    .map((pt, i) => {
                      const x = 10 + (i / (timelinePoints.length - 1)) * 280;
                      const y = 46 - (Math.min(100, Math.max(0, pt.avgAccuracy)) / 100) * 38;
                      return `${x.toFixed(1)},${y.toFixed(1)}`;
                    })
                    .join(' ')}
                />
                {timelinePoints.map((pt, i) => {
                  const x = 10 + (i / (timelinePoints.length - 1)) * 280;
                  const y = 46 - (Math.min(100, Math.max(0, pt.avgAccuracy)) / 100) * 38;
                  return <circle key={pt.id} cx={x} cy={y} r="3.5" fill="#f59e0b" />;
                })}
              </svg>
            </div>
          )}
        </div>
      )}

      {/* Post-Session Deterministic Analysis Preview */}
      {analyzing && (
        <div className="mt-3 rounded-xl bg-slate-100 p-3 text-center text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          در حال تحلیل قطعی پوش موج، بلندی (dBFS) و دقت کوک ربع‌پرده...
        </div>
      )}

      {pendingBlob && analysis && !analyzing && (
        <div className="mt-3 rounded-xl border border-teal-500/35 bg-teal-500/5 p-3">
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg bg-white/85 p-2 dark:bg-slate-900/75">
              <div className="text-[10px] text-slate-500">دقت کوک</div>
              <div className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                {toPersianDigits(analysis.avgAccuracy)}٪
              </div>
            </div>
            <div className="rounded-lg bg-white/85 p-2 dark:bg-slate-900/75">
              <div className="text-[10px] text-slate-500">بلندی (RMS)</div>
              <div className="ltr-num text-sm font-extrabold text-slate-800 dark:text-slate-100">
                {analysis.rmsDb.toFixed(1)} dB
              </div>
            </div>
            <div className="rounded-lg bg-white/85 p-2 dark:bg-slate-900/75">
              <div className="text-[10px] text-slate-500">مدت</div>
              <div className="text-sm font-extrabold text-teal-600 dark:text-teal-300">
                {formatDurationFa(analysis.durationSeconds)}
              </div>
            </div>
          </div>

          {/* Waveform Envelope */}
          <div className="mt-2.5 flex h-12 items-end gap-0.5 rounded-lg bg-slate-950/90 px-2 py-1.5" dir="ltr">
            {analysis.envelope.map((v, idx) => (
              <div
                key={idx}
                className="flex-1 rounded-full bg-gradient-to-t from-teal-500 to-amber-300"
                style={{ height: `${Math.max(10, Math.round(v * 100))}%` }}
              />
            ))}
          </div>

          {pendingUrl && (
            <audio
              controls
              src={pendingUrl}
              onTimeUpdate={(e) => setReplayTimeSec(e.currentTarget.currentTime)}
              className="mt-2.5 h-9 w-full"
            />
          )}

          {analysis.pitchContour &&
            analysis.pitchContour.length > 0 &&
            renderOverlayContourSvg(
              analysis.pitchContour,
              analysis.durationSeconds,
              replayTimeSec,
              titleInput || gusheh.nameFa
            )}

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              placeholder="عنوان قطعه برای ذخیره..."
              className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
            />
            <button
              type="button"
              onClick={() => void handleSave()}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold text-white shadow-sm ${
                reachedFreeCap
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-teal-600 hover:bg-teal-700'
              }`}
            >
              {reachedFreeCap ? <Lock className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
              {reachedFreeCap ? 'ارتقا برای ذخیره نامحدود' : 'ذخیره در بایگانی'}
            </button>
          </div>
        </div>
      )}

      {/* Live Overlay Replay for currently playing archive item */}
      {overlayContour && overlayContour.length > 0 && playingId && (
        renderOverlayContourSvg(
          overlayContour,
          replayDurationSec,
          replayTimeSec,
          overlayTitleFa
        )
      )}

      {/* Saved Recordings Archive List */}
      <div className="mt-3 space-y-2">
        {recordings.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
            هنوز قطعه‌ای در بایگانی این حساب ذخیره نشده است. کلید‌های ذخیره در IndexedDB به‌طور کامل با شناسه حساب ایزوله می‌شوند.
          </div>
        ) : (
          recordings.map((rec) => (
            <div
              key={rec.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/75 p-2.5 dark:border-slate-800 dark:bg-slate-800/60"
            >
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => void handlePlaySaved(rec)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-600 text-white transition hover:bg-teal-700"
                  aria-label="پخش ضبط"
                >
                  {playingId === rec.id ? (
                    <Square className="h-3.5 w-3.5" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                </button>
                <div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    {rec.title}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                    <span>دقت {toPersianDigits(rec.avgAccuracy)}٪</span>
                    <span>•</span>
                    <span className="ltr-num">{rec.rmsDb.toFixed(1)} dB</span>
                    <span>•</span>
                    <span>{formatDurationFa(rec.durationSeconds)}</span>
                    <span>•</span>
                    <span>{formatJalaliShortFa(new Date(rec.createdAt))}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => void handleDownloadSaved(rec)}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-teal-500/15 hover:text-teal-600"
                  aria-label="دانلود فایل صوتی"
                  title="دانلود فایل صوتی"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => void onToggleRecordingPublic(rec)}
                  className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                    rec.isPublic
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                      : 'bg-slate-200/80 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                  }`}
                >
                  <Globe className="h-3 w-3" />
                  {rec.isPublic ? 'عمومی در انجمن' : 'خصوصی'}
                </button>
                <button
                  type="button"
                  onClick={() => void onDeleteRecording(rec.id)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-500/15 hover:text-rose-500"
                  aria-label="حذف قطعه"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
