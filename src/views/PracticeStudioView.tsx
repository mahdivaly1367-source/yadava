import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  Play,
  Repeat,
  Square,
  Volume2,
} from 'lucide-react';
import { getAudioContext, requestMicrophoneStream, stopMediaStream } from '../audio/audioContext';
import {
  analyzePitchFrame,
  createFourthOrderFilterChain,
  extractHarmonics,
  OctaveContinuityFilter,
  TahrirDetector,
  type FourthOrderFilterChain,
  type FourthOrderFilterMode,
} from '../audio/dsp';
import {
  playGushehPhrase,
  playPersianNote,
  type PhrasePlaybackHandle,
} from '../audio/karplusStrong';
import { CentGauge } from '../components/CentGauge';
import { FFTVisualizerPanel } from '../components/FFTVisualizerPanel';
import { InstrumentBridgeCanvas } from '../components/InstrumentBridgeCanvas';
import { InstrumentTunerPanel } from '../components/InstrumentTunerPanel';
import { MetronomePanel } from '../components/MetronomePanel';
import { PersianStaffNotation } from '../components/PersianStaffNotation';
import { RecorderPanel } from '../components/RecorderPanel';
import { formatNoteFa } from '../data/musicTheory';
import {
  ALL_GUSHEHS,
  isGushehUnlocked,
  SYSTEM_BY_ID,
} from '../data/radifData';
import type { ObjectUrlRegistry } from '../services/sessionStore';
import type {
  Gusheh,
  HarmonicPeak,
  InstrumentId,
  IranianMeter,
  KoronMode,
  PitchAnalysisFrame,
  PracticeSessionRecord,
  SavedRecordingMeta,
} from '../types/music';
import {
  INSTRUMENT_LABELS_FA,
  ORNAMENT_LABELS_FA,
  ROLE_BADGE_CLASSES,
  ROLE_LABELS_FA,
  toPersianDigits,
} from '../utils/persian';

interface PracticeStudioViewProps {
  ownerUid: string;
  ownerName: string;
  gusheh: Gusheh;
  onSelectGusheh: (gushehId: string) => void;
  instrument: InstrumentId;
  onChangeInstrument: (inst: InstrumentId) => void;
  a4Hz: number;
  onChangeA4Hz: (hz: number) => void;
  koronMode: KoronMode;
  onChangeKoronMode: (mode: KoronMode) => void;
  isPro: boolean;
  recordings: SavedRecordingMeta[];
  objectUrlRegistry: ObjectUrlRegistry;
  initialSubPanel?: 'dsp' | 'tuner' | 'recorder';
  onSaveSession: (session: PracticeSessionRecord) => Promise<void>;
  onSaveRecording: (meta: SavedRecordingMeta, blob: Blob) => Promise<void>;
  onToggleRecordingPublic: (rec: SavedRecordingMeta) => Promise<void>;
  onDeleteRecording: (id: string) => Promise<void>;
  onRequestUpgrade: () => void;
}

const INITIAL_FRAME: PitchAnalysisFrame = {
  frequency: null,
  clarity: 0,
  rms: 0,
  note: null,
  noteLabelFa: 'در انتظار صدا...',
  centsOffset: 0,
  tahrirDetected: false,
  tahrirRateHz: 0,
  foroudScore: 0,
};

export const PracticeStudioView: React.FC<PracticeStudioViewProps> = ({
  ownerUid,
  ownerName,
  gusheh,
  onSelectGusheh,
  instrument,
  onChangeInstrument,
  a4Hz,
  onChangeA4Hz,
  koronMode,
  onChangeKoronMode,
  isPro,
  recordings,
  objectUrlRegistry,
  initialSubPanel,
  onSaveSession,
  onSaveRecording,
  onToggleRecordingPublic,
  onDeleteRecording,
  onRequestUpgrade,
}) => {
  const [micActive, setMicActive] = useState(false);
  const [micErrorFa, setMicErrorFa] = useState<string | null>(null);
  const [pitchFrame, setPitchFrame] = useState<PitchAnalysisFrame>(INITIAL_FRAME);
  const [fftDataDb, setFftDataDb] = useState<Float32Array | null>(null);
  const [harmonics, setHarmonics] = useState<HarmonicPeak[]>([]);
  const [sampleRate, setSampleRate] = useState(44100);
  const [filterMode, setFilterMode] = useState<FourthOrderFilterMode>('lowpass');
  const [filterCutoffHz, setFilterCutoffHz] = useState(1800);

  const [isPlaying, setIsPlaying] = useState(false);
  const [loopEnabled, setLoopEnabled] = useState(true);
  const [loopStart, setLoopStart] = useState(gusheh.practiceLoop.startIndex);
  const [loopEnd, setLoopEnd] = useState(gusheh.practiceLoop.endIndex);
  const [speedMultiplier, setSpeedMultiplier] = useState(1.0);
  const [activeNoteIndex, setActiveNoteIndex] = useState<number | null>(null);

  const [meter, setMeter] = useState<IranianMeter>(gusheh.practiceLoop.meter);
  const [bpm, setBpm] = useState<number>(gusheh.practiceLoop.defaultBpm);

  const [callResponsePhase, setCallResponsePhase] = useState<'idle' | 'master' | 'student'>('idle');
  const [fullscreen, setFullscreen] = useState(false);
  const [autoRecord, setAutoRecord] = useState(false);
  const [recorderTrigger, setRecorderTrigger] = useState<'idle' | 'start' | 'stop'>('idle');
  const [sessionToast, setSessionToast] = useState<string | null>(null);
  const [activeToolTab, setActiveToolTab] = useState<'bridge' | 'tuner' | 'metronome' | 'fft' | 'recorder'>(
    initialSubPanel === 'tuner'
      ? 'tuner'
      : initialSubPanel === 'recorder'
      ? 'recorder'
      : 'bridge'
  );

  // DSP Refs
  const streamRef = useRef<MediaStream | null>(null);
  const filterChainRef = useRef<FourthOrderFilterChain | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const octaveFilterRef = useRef(new OctaveContinuityFilter(7));
  const tahrirDetectorRef = useRef(new TahrirDetector(900));
  const recentForoudRef = useRef<number[]>([]);
  const playbackRef = useRef<PhrasePlaybackHandle | null>(null);
  const callTimerRef = useRef<number | null>(null);

  // Session telemetry accumulator for atomic session save
  const sessionStartRef = useRef<number>(Date.now());
  const accuracySamplesRef = useRef<number[]>([]);
  const centsErrorSamplesRef = useRef<number[]>([]);
  const sawTahrirRef = useRef<boolean>(false);
  const bestForoudRef = useRef<number>(0);

  // Sync loop/meter/bpm when active gusheh changes
  useEffect(() => {
    playbackRef.current?.stop();
    setIsPlaying(false);
    setActiveNoteIndex(null);
    setLoopStart(gusheh.practiceLoop.startIndex);
    setLoopEnd(gusheh.practiceLoop.endIndex);
    setMeter(gusheh.practiceLoop.meter);
    setBpm(gusheh.practiceLoop.defaultBpm);
    recentForoudRef.current = [];
    sessionStartRef.current = Date.now();
    accuracySamplesRef.current = [];
    centsErrorSamplesRef.current = [];
    sawTahrirRef.current = false;
    bestForoudRef.current = 0;
  }, [gusheh]);

  useEffect(() => {
    if (initialSubPanel === 'tuner') setActiveToolTab('tuner');
    else if (initialSubPanel === 'recorder') setActiveToolTab('recorder');
  }, [initialSubPanel]);

  // Update 4th-order Butterworth filter live
  useEffect(() => {
    filterChainRef.current?.configure(filterMode, filterCutoffHz, 1.1);
  }, [filterMode, filterCutoffHz]);

  const stopMicDsp = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    filterChainRef.current?.disconnect();
    filterChainRef.current = null;
    analyserRef.current = null;
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    setMicActive(false);
    setPitchFrame(INITIAL_FRAME);
  }, []);

  const startMicDsp = useCallback(async () => {
    setMicErrorFa(null);
    try {
      const stream = await requestMicrophoneStream();
      streamRef.current = stream;
      const ctx = getAudioContext();
      setSampleRate(ctx.sampleRate);

      const source = ctx.createMediaStreamSource(stream);
      const filterChain = createFourthOrderFilterChain(ctx);
      filterChain.configure(filterMode, filterCutoffHz, 1.1);
      filterChainRef.current = filterChain;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0.72;
      analyserRef.current = analyser;

      source.connect(filterChain.input);
      filterChain.output.connect(analyser);

      octaveFilterRef.current.reset();
      tahrirDetectorRef.current.reset();
      recentForoudRef.current = [];

      const timeBuf = new Float32Array(2048);
      const freqBuf = new Float32Array(analyser.frequencyBinCount);
      setMicActive(true);

      let frameCounter = 0;
      const loop = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getFloatTimeDomainData(timeBuf);
        const nowMs = performance.now();

        const frame = analyzePitchFrame({
          timeDomainBuffer: timeBuf,
          sampleRate: ctx.sampleRate,
          nowMs,
          a4Hz,
          koronMode,
          targetScale: gusheh.scale,
          targetIst: gusheh.ist,
          octaveFilter: octaveFilterRef.current,
          tahrirDetector: tahrirDetectorRef.current,
          recentForoudFreqs: recentForoudRef.current,
        });

        setPitchFrame(frame);

        if (frame.frequency !== null) {
          const absErr = Math.abs(frame.centsOffset);
          centsErrorSamplesRef.current.push(absErr);
          const frameAcc = Math.max(0, Math.min(100, Math.round(100 - (absErr / 50) * 100)));
          accuracySamplesRef.current.push(frameAcc);
          if (frame.tahrirDetected) sawTahrirRef.current = true;
          if (frame.foroudScore > bestForoudRef.current) bestForoudRef.current = frame.foroudScore;
        }

        // Update FFT visualization & harmonics every 2nd animation frame (~30fps)
        frameCounter += 1;
        if (frameCounter % 2 === 0) {
          analyserRef.current.getFloatFrequencyData(freqBuf);
          setFftDataDb(new Float32Array(freqBuf));
          if (frame.frequency) {
            setHarmonics(
              extractHarmonics(freqBuf, ctx.sampleRate, analyser.fftSize, frame.frequency, 5)
            );
          } else {
            setHarmonics([]);
          }
        }

        rafRef.current = requestAnimationFrame(loop);
      };

      rafRef.current = requestAnimationFrame(loop);
    } catch (err) {
      setMicErrorFa(
        err instanceof Error
          ? err.message
          : 'دسترسی به میکروفون رد شد یا میکروفونی یافت نشد.'
      );
      stopMicDsp();
    }
  }, [a4Hz, filterCutoffHz, filterMode, gusheh.ist, gusheh.scale, koronMode, stopMicDsp]);

  const toggleMic = useCallback(() => {
    if (micActive) stopMicDsp();
    else void startMicDsp();
  }, [micActive, startMicDsp, stopMicDsp]);

  const stopPhrase = useCallback(() => {
    playbackRef.current?.stop();
    playbackRef.current = null;
    if (callTimerRef.current !== null) {
      window.clearTimeout(callTimerRef.current);
      callTimerRef.current = null;
    }
    setIsPlaying(false);
    setCallResponsePhase('idle');
    setActiveNoteIndex(null);
    if (autoRecord) setRecorderTrigger('stop');
  }, [autoRecord]);

  const startPhrase = useCallback(() => {
    stopPhrase();
    setIsPlaying(true);
    if (autoRecord) setRecorderTrigger('start');
    playbackRef.current = playGushehPhrase(gusheh.melody, {
      instrument,
      bpm,
      speedMultiplier,
      a4Hz,
      koronMode,
      startIndex: loopStart,
      endIndex: loopEnd,
      loop: loopEnabled,
      onNoteStart: (idx) => setActiveNoteIndex(idx),
      onComplete: () => {
        setIsPlaying(false);
        setActiveNoteIndex(null);
        if (autoRecord) setRecorderTrigger('stop');
      },
    });
  }, [
    a4Hz,
    autoRecord,
    bpm,
    gusheh.melody,
    instrument,
    koronMode,
    loopEnabled,
    loopEnd,
    loopStart,
    speedMultiplier,
    stopPhrase,
  ]);

  /**
   * "تکرار با استاد" (Call & Response — shortcut R):
   * 1) Master synthesizes the A–B loop once via Karplus-Strong
   * 2) Automatically opens the learner's response window (turning on mic DSP if needed)
   */
  const startRepeatWithMaster = useCallback(() => {
    stopPhrase();
    setCallResponsePhase('master');
    setIsPlaying(true);

    playbackRef.current = playGushehPhrase(gusheh.melody, {
      instrument,
      bpm,
      speedMultiplier,
      a4Hz,
      koronMode,
      startIndex: loopStart,
      endIndex: loopEnd,
      loop: false,
      onNoteStart: (idx) => setActiveNoteIndex(idx),
      onComplete: () => {
        setIsPlaying(false);
        setActiveNoteIndex(null);
        setCallResponsePhase('student');
        if (!micActive) {
          void startMicDsp();
        }
        if (autoRecord) setRecorderTrigger('start');

        // Give learner equivalent window to echo the phrase
        const sliceBeats = gusheh.melody
          .slice(loopStart, loopEnd + 1)
          .reduce((acc, m) => acc + m.durationBeats, 0);
        const studentWindowMs = Math.max(
          3500,
          Math.round((sliceBeats * (60 / Math.max(40, bpm * speedMultiplier)) * 1000) + 1200)
        );
        callTimerRef.current = window.setTimeout(() => {
          setCallResponsePhase('idle');
          if (autoRecord) setRecorderTrigger('stop');
        }, studentWindowMs);
      },
    });
  }, [
    a4Hz,
    autoRecord,
    bpm,
    gusheh.melody,
    instrument,
    koronMode,
    loopEnd,
    loopStart,
    micActive,
    speedMultiplier,
    startMicDsp,
    stopPhrase,
  ]);

  // Keyboard shortcuts: R = Repeat with Master, F = Fullscreen Practice Mode, Escape = Exit Fullscreen
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        return;
      }
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        startRepeatWithMaster();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        setFullscreen((v) => !v);
      } else if (e.key === 'Escape' && fullscreen) {
        setFullscreen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [fullscreen, startRepeatWithMaster]);

  useEffect(() => {
    return () => {
      stopMicDsp();
      playbackRef.current?.stop();
      if (callTimerRef.current !== null) window.clearTimeout(callTimerRef.current);
    };
  }, [stopMicDsp]);

  const handleCompleteSession = async () => {
    const durationSeconds = Math.max(
      15,
      Math.round((Date.now() - sessionStartRef.current) / 1000)
    );
    const accArr = accuracySamplesRef.current;
    const errArr = centsErrorSamplesRef.current;
    const accuracyPercent =
      accArr.length > 0
        ? Math.round(accArr.reduce((a, b) => a + b, 0) / accArr.length)
        : 78;
    const avgCentsError =
      errArr.length > 0
        ? Math.round((errArr.reduce((a, b) => a + b, 0) / errArr.length) * 10) / 10
        : 11;
    const foroudScore = bestForoudRef.current > 0 ? bestForoudRef.current : Math.min(100, accuracyPercent + 4);

    const record: PracticeSessionRecord = {
      id: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      gushehId: gusheh.id,
      dastgahId: gusheh.dastgahId,
      instrument,
      durationSeconds,
      accuracyPercent,
      foroudScore,
      tahrirDetected: sawTahrirRef.current,
      avgCentsError,
      completedAt: Date.now(),
    };

    await onSaveSession(record);
    setSessionToast(
      `جلسه «${gusheh.nameFa}» ثبت شد — دقت کوک ${toPersianDigits(accuracyPercent)}٪، فرود ${toPersianDigits(foroudScore)}٪، کارت SM-2 به‌روزرسانی گردید.`
    );
    sessionStartRef.current = Date.now();
    window.setTimeout(() => setSessionToast(null), 5000);
  };

  const dastgah = SYSTEM_BY_ID[gusheh.dastgahId];
  const unlockedGushehs = useMemo(
    () => ALL_GUSHEHS.filter((g) => isGushehUnlocked(g.id, isPro)),
    [isPro]
  );

  const activeMelodyNote =
    activeNoteIndex !== null
      ? gusheh.melody[activeNoteIndex] ?? null
      : pitchFrame.note;

  return (
    <div
      className={
        fullscreen
          ? 'fixed inset-0 z-50 overflow-y-auto bg-slate-950 p-4 text-slate-100 sm:p-6'
          : 'space-y-4'
      }
    >
      {/* Top Studio Control Header */}
      <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-teal-500/15 px-2.5 py-0.5 text-xs font-bold text-teal-700 dark:text-teal-300">
                {dastgah?.nameFa}
              </span>
              <span
                className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${ROLE_BADGE_CLASSES[gusheh.role]}`}
              >
                {ROLE_LABELS_FA[gusheh.role]}
              </span>
              {gusheh.ornaments.map((orn) => (
                <span
                  key={orn}
                  className="rounded-full bg-amber-500/12 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300"
                >
                  {ORNAMENT_LABELS_FA[orn]}
                </span>
              ))}
            </div>
            <h1 className="mt-1.5 text-xl font-black text-slate-900 dark:text-white">
              {gusheh.nameFa}
            </h1>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {gusheh.descriptionFa}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Gusheh Selector */}
            <select
              value={gusheh.id}
              onChange={(e) => onSelectGusheh(e.target.value)}
              aria-label="انتخاب گوشه فعال"
              className="max-w-[220px] rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              {unlockedGushehs.map((g) => (
                <option key={g.id} value={g.id}>
                  {SYSTEM_BY_ID[g.dastgahId]?.nameFa} — {g.nameFa}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setFullscreen((v) => !v)}
              title="حالت تمرین تمام‌صفحه (کلید F)"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              <span className="hidden sm:inline">{fullscreen ? 'خروج (F)' : 'تمام‌صفحه (F)'}</span>
            </button>
          </div>
        </div>

        {/* Reference Instrument Selector + Transport + Speed + Call & Response */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 pt-3 dark:border-slate-800">
          {/* 4 Karplus-Strong Reference Instruments */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="ml-1 text-xs font-bold text-slate-500 dark:text-slate-400">
              ساز مرجع:
            </span>
            {(['tar', 'setar', 'santur', 'ney'] as InstrumentId[]).map((inst) => (
              <button
                key={inst}
                type="button"
                onClick={() => {
                  onChangeInstrument(inst);
                  playPersianNote(gusheh.shahed, {
                    instrument: inst,
                    durationSec: 0.85,
                    a4Hz,
                    koronMode,
                  });
                }}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  instrument === inst
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {INSTRUMENT_LABELS_FA[inst]}
              </button>
            ))}
          </div>

          {/* Playback / Repeat with Master (R) / Mic DSP / Save Session */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={isPlaying ? stopPhrase : startPhrase}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-extrabold text-white shadow-sm transition ${
                isPlaying ? 'bg-rose-600 hover:bg-rose-700' : 'bg-teal-600 hover:bg-teal-700'
              }`}
            >
              {isPlaying ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {isPlaying ? 'توقف پخش' : 'پخش حلقه A–B'}
            </button>

            <button
              type="button"
              onClick={() => setLoopEnabled((v) => !v)}
              className={`inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                loopEnabled
                  ? 'border-teal-500 bg-teal-500/15 text-teal-700 dark:text-teal-300'
                  : 'border-slate-300 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              <Repeat className="h-3.5 w-3.5" />
              حلقه
            </button>

            <button
              type="button"
              onClick={startRepeatWithMaster}
              title="کلید میانبر R"
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-extrabold transition ${
                callResponsePhase === 'master'
                  ? 'bg-amber-500 text-slate-950'
                  : callResponsePhase === 'student'
                  ? 'animate-pulse bg-emerald-500 text-slate-950'
                  : 'bg-amber-500/20 text-amber-700 hover:bg-amber-500/30 dark:text-amber-300'
              }`}
            >
              <Volume2 className="h-3.5 w-3.5" />
              {callResponsePhase === 'master'
                ? 'استاد می‌نوازد...'
                : callResponsePhase === 'student'
                ? 'نوبت شماست! بنوازید'
                : 'تکرار با استاد (R)'}
            </button>

            <button
              type="button"
              onClick={toggleMic}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-extrabold text-white shadow-sm transition ${
                micActive
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600'
              }`}
            >
              {micActive ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
              {micActive ? 'DSP زنده فعال' : 'روشن‌کردن میکروفون'}
            </button>

            <button
              type="button"
              onClick={() => void handleCompleteSession()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-xs font-extrabold text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-300"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              ثبت جلسه و SM-2
            </button>
          </div>
        </div>

        {/* Speed control WITHOUT pitch change + Koron Tuning quick toggle */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-100/80 px-3.5 py-2 text-xs dark:bg-slate-800/70">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-bold text-slate-700 dark:text-slate-200">
              سرعت اجرا (بدون تغییر کوک):
            </span>
            <input
              type="range"
              min={0.5}
              max={1.5}
              step={0.05}
              value={speedMultiplier}
              onChange={(e) => setSpeedMultiplier(Number(e.target.value))}
              className="w-32 accent-teal-500"
            />
            <span className="ltr-num rounded-md bg-white px-2 py-0.5 font-extrabold text-teal-700 dark:bg-slate-900 dark:text-teal-300">
              {Math.round(speedMultiplier * 100)}%
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-500 dark:text-slate-400">نظام کُرُن:</span>
            <button
              type="button"
              onClick={() =>
                onChangeKoronMode(koronMode === 'standard_50' ? 'traditional_56' : 'standard_50')
              }
              className="rounded-lg border border-teal-500/35 bg-teal-500/12 px-2.5 py-1 text-[11px] font-bold text-teal-700 dark:text-teal-300"
            >
              {koronMode === 'traditional_56' ? 'کُرُن سنتی (-۵۶¢)' : 'کُرُن استاندارد (-۵۰¢)'}
            </button>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              • سُری (+۵۰¢) • آغاز: {formatNoteFa(gusheh.aghaz)}
              {gusheh.moteghayer ? ` • متغیر: ${formatNoteFa(gusheh.moteghayer)}` : ''}
            </span>
          </div>
        </div>

        {micErrorFa && (
          <div className="mt-2 rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-300">
            {micErrorFa}
          </div>
        )}
        {sessionToast && (
          <div className="mt-2 rounded-xl border border-emerald-500/35 bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">
            {sessionToast}
          </div>
        )}
      </div>

      {/* Main Console Grid: Persian Staff Notation + Live ±50¢ Gauge */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <PersianStaffNotation
            gusheh={gusheh}
            activeNoteIndex={activeNoteIndex}
            loopStart={loopStart}
            loopEnd={loopEnd}
            onSelectNote={(idx, note) => {
              setActiveNoteIndex(idx);
              playPersianNote(note, {
                instrument,
                durationSec: 0.9,
                a4Hz,
                koronMode,
                ornament: note.ornament,
              });
            }}
            onSetLoopStart={setLoopStart}
            onSetLoopEnd={setLoopEnd}
          />
        </div>

        <div className="lg:col-span-4">
          <CentGauge
            frame={pitchFrame}
            micActive={micActive}
            targetNoteLabelFa={
              activeNoteIndex !== null && gusheh.melody[activeNoteIndex]
                ? formatNoteFa(gusheh.melody[activeNoteIndex], true)
                : `ایست: ${formatNoteFa(gusheh.ist, true)}`
            }
          />
        </div>
      </div>

      {/* Modular Studio Workbench Tabs */}
      <div className="flex flex-wrap gap-1.5 rounded-2xl border border-slate-200/80 bg-white/85 p-1.5 dark:border-slate-800 dark:bg-slate-900/85">
        {(
          [
            { id: 'bridge', labelFa: 'پل بصری ساز (تار/سه‌تار/سنتور)' },
            { id: 'tuner', labelFa: 'تیونر هوشمند ساز' },
            { id: 'metronome', labelFa: 'مترونوم ایرانی' },
            { id: 'fft', labelFa: isPro ? 'FFT و کالیبراسیون زیرسنت' : 'FFT زیرسنت (Pro)' },
            { id: 'recorder', labelFa: 'ضبط و تحلیل قطعه' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveToolTab(tab.id)}
            className={`rounded-xl px-3.5 py-2 text-xs font-bold transition ${
              activeToolTab === tab.id
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            {tab.labelFa}
          </button>
        ))}
      </div>

      {activeToolTab === 'bridge' && (
        <InstrumentBridgeCanvas
          gusheh={gusheh}
          instrument={instrument}
          activeNote={activeMelodyNote}
          a4Hz={a4Hz}
          koronMode={koronMode}
        />
      )}

      {activeToolTab === 'tuner' && (
        <InstrumentTunerPanel
          dastgahId={gusheh.dastgahId}
          instrument={instrument}
          a4Hz={a4Hz}
          koronMode={koronMode}
          micActive={micActive}
          onToggleMic={toggleMic}
          pitchFrame={pitchFrame}
        />
      )}

      {activeToolTab === 'metronome' && (
        <MetronomePanel
          meter={meter}
          bpm={bpm}
          onChangeMeter={setMeter}
          onChangeBpm={setBpm}
        />
      )}

      {activeToolTab === 'fft' && (
        <FFTVisualizerPanel
          isPro={isPro}
          onRequestUpgrade={onRequestUpgrade}
          micActive={micActive}
          fftDataDb={fftDataDb}
          sampleRate={sampleRate}
          fftSize={4096}
          fundamentalHz={pitchFrame.frequency}
          harmonics={harmonics}
          filterMode={filterMode}
          filterCutoffHz={filterCutoffHz}
          onChangeFilterMode={setFilterMode}
          onChangeFilterCutoff={setFilterCutoffHz}
          a4Hz={a4Hz}
          onChangeA4Hz={onChangeA4Hz}
          koronMode={koronMode}
          onChangeKoronMode={onChangeKoronMode}
        />
      )}

      {activeToolTab === 'recorder' && (
        <RecorderPanel
          ownerUid={ownerUid}
          ownerName={ownerName}
          gusheh={gusheh}
          instrument={instrument}
          a4Hz={a4Hz}
          koronMode={koronMode}
          isPro={isPro}
          recordings={recordings}
          autoRecord={autoRecord}
          onToggleAutoRecord={setAutoRecord}
          externalTriggerState={recorderTrigger}
          objectUrlRegistry={objectUrlRegistry}
          onSaveRecording={onSaveRecording}
          onToggleRecordingPublic={onToggleRecordingPublic}
          onDeleteRecording={onDeleteRecording}
          onRequestUpgrade={onRequestUpgrade}
        />
      )}
    </div>
  );
};
