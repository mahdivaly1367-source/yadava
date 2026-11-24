import React, { useEffect, useRef, useState } from 'react';
import {
  Circle,
  Globe,
  Lock,
  Play,
  Save,
  Square,
  Trash2,
} from 'lucide-react';
import { requestMicrophoneStream, stopMediaStream } from '../audio/audioContext';
import { analyzeAudioBlob, pickSupportedAudioMimeType } from '../audio/recordingAnalyzer';
import { FREE_MAX_RECORDINGS } from '../services/billing';
import { getRecordingBlob } from '../services/recordingDb';
import type { ObjectUrlRegistry } from '../services/sessionStore';
import type {
  Gusheh,
  InstrumentId,
  KoronMode,
  RecordingAnalysis,
  SavedRecordingMeta,
} from '../types/music';
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
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.src = '';
    }
  }, [ownerUid]);

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

  // Support automatic recording synced to Practice Studio playback/call-and-response
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
    audioElRef.current.onended = () => setPlayingId(null);
    await audioElRef.current.play();
    setPlayingId(rec.id);
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/85">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
            ضبط، تحلیل پس از اجرا و بایگانی صوتی (IndexedDB)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isPro
              ? `بایگانی نامحدود فعال (${toPersianDigits(recordings.length)} قطعه ذخیره شده)`
              : `سقف نسخه رایگان: ${toPersianDigits(recordings.length)} از ${toPersianDigits(FREE_MAX_RECORDINGS)} قطعه`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100/80 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <input
              type="checkbox"
              checked={autoRecord}
              onChange={(e) => onToggleAutoRecord(e.target.checked)}
              className="accent-teal-600"
            />
            ضبط خودکار هنگام تمرین
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
            {isRecording ? <Square className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5 fill-rose-500 text-rose-500" />}
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
            <audio controls src={pendingUrl} className="mt-2.5 h-9 w-full" />
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
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                    <span>دقت {toPersianDigits(rec.avgAccuracy)}٪</span>
                    <span>•</span>
                    <span className="ltr-num">{rec.rmsDb.toFixed(1)} dB</span>
                    <span>•</span>
                    <span>{formatDurationFa(rec.durationSeconds)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
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
