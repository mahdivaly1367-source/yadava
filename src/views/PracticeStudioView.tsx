import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Footprints,
  GraduationCap,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  PauseCircle,
  Play,
  Printer,
  RefreshCw,
  Repeat,
  RotateCcw,
  Share2,
  Sliders,
  Sparkles,
  Square,
  Sun,
  Volume2,
  X,
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
  getActiveHallReverbPreset,
  HALL_REVERB_PRESETS,
  setActiveHallReverbPreset,
  type HallReverbPresetId,
} from '../audio/hallReverb';
import {
  playGushehPhrase,
  playPersianNote,
  preloadInstrumentSamples,
  type PhrasePlaybackHandle,
} from '../audio/karplusStrong';
import {
  acousticSampleBank,
  getSoundEngineMode,
  setSoundEngineMode,
} from '../audio/sampleEngine';
import {
  generatePrintableSheetHtml,
  openPrintableSheetWindow,
} from '../utils/printableSheet';
import { CentGauge } from '../components/CentGauge';
import { InstrumentBridgeCanvas } from '../components/InstrumentBridgeCanvas';
import { PersianStaffNotation } from '../components/PersianStaffNotation';
import { PitchContourCanvas } from '../components/PitchContourCanvas';

const AcousticSoundLabPanel = lazy(() =>
  import('../components/AcousticSoundLabPanel').then((m) => ({
    default: m.AcousticSoundLabPanel,
  }))
);
const AudioSlowdownerPanel = lazy(() =>
  import('../components/AudioSlowdownerPanel').then((m) => ({ default: m.AudioSlowdownerPanel }))
);
const BlindTuningPanel = lazy(() =>
  import('../components/BlindTuningPanel').then((m) => ({ default: m.BlindTuningPanel }))
);
const BreathLongTonePanel = lazy(() =>
  import('../components/BreathLongTonePanel').then((m) => ({ default: m.BreathLongTonePanel }))
);
const CallResponsePanel = lazy(() =>
  import('../components/CallResponsePanel').then((m) => ({ default: m.CallResponsePanel }))
);
const DastgahQuizPanel = lazy(() =>
  import('../components/DastgahQuizPanel').then((m) => ({ default: m.DastgahQuizPanel }))
);
const DronePanel = lazy(() =>
  import('../components/DronePanel').then((m) => ({ default: m.DronePanel }))
);
const EnsembleMixdownPanel = lazy(() =>
  import('../components/EnsembleMixdownPanel').then((m) => ({ default: m.EnsembleMixdownPanel }))
);
const FFTVisualizerPanel = lazy(() =>
  import('../components/FFTVisualizerPanel').then((m) => ({ default: m.FFTVisualizerPanel }))
);
const InstrumentTunerPanel = lazy(() =>
  import('../components/InstrumentTunerPanel').then((m) => ({ default: m.InstrumentTunerPanel }))
);
const MetronomePanel = lazy(() =>
  import('../components/MetronomePanel').then((m) => ({ default: m.MetronomePanel }))
);
const MicrotonalScoreEditorPanel = lazy(() =>
  import('../components/MicrotonalScoreEditorPanel').then((m) => ({
    default: m.MicrotonalScoreEditorPanel,
  }))
);
const MusicStandOverlay = lazy(() =>
  import('../components/MusicStandOverlay').then((m) => ({ default: m.MusicStandOverlay }))
);
const PoetryProsodyPanel = lazy(() =>
  import('../components/PoetryProsodyPanel').then((m) => ({ default: m.PoetryProsodyPanel }))
);
const ProsodyAvazPanel = lazy(() =>
  import('../components/ProsodyAvazPanel').then((m) => ({ default: m.ProsodyAvazPanel }))
);
const RecorderPanel = lazy(() =>
  import('../components/RecorderPanel').then((m) => ({ default: m.RecorderPanel }))
);
const TemperamentEditorPanel = lazy(() =>
  import('../components/TemperamentEditorPanel').then((m) => ({
    default: m.TemperamentEditorPanel,
  }))
);
const TombakDafPanel = lazy(() =>
  import('../components/TombakDafPanel').then((m) => ({ default: m.TombakDafPanel }))
);
const TraditionComparePanel = lazy(() =>
  import('../components/TraditionComparePanel').then((m) => ({ default: m.TraditionComparePanel }))
);
const WebMidiPanel = lazy(() =>
  import('../components/WebMidiPanel').then((m) => ({ default: m.WebMidiPanel }))
);
import {
  FOOT_PEDAL_PRESETS,
  PEDAL_ACTION_LABELS_FA,
  resolveFootPedalAction,
} from '../core/footPedal';
import {
  evaluateHandsFreeCycle,
  type HandsFreePhase,
} from '../core/handsFree';
import {
  formatSemitoneShiftFa,
  transposeGusheh,
  TRANSPOSITION_PRESETS,
} from '../core/transposition';
import {
  createWaitModeState,
  evaluateWaitModeStep,
  type WaitModeState,
} from '../core/waitMode';
import { formatNoteFa, frequencyToPersianNote } from '../data/musicTheory';
import {
  ALL_GUSHEHS,
  isGushehUnlocked,
  SYSTEM_BY_ID,
} from '../data/radifData';
import { TRADITION_BY_ID } from '../data/radifTraditions';
import type { ObjectUrlRegistry } from '../services/sessionStore';
import type {
  FootPedalPresetId,
  Gusheh,
  HarmonicPeak,
  InstrumentId,
  IranianMeter,
  KoronMode,
  PitchAnalysisFrame,
  PracticeSessionRecord,
  RadifTraditionId,
  SavedRecordingMeta,
  SoundEngineMode,
  TeacherAssignment,
} from '../types/music';
import {
  ALL_INSTRUMENT_IDS,
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
  traditionId: RadifTraditionId;
  onChangeTradition: (id: RadifTraditionId) => void;
  activeAssignment: TeacherAssignment | null;
  onClearAssignment: () => void;
  onOpenExportModal: () => void;
  onOpenTeacherModal: () => void;
  isPro: boolean;
  bestBreathSeconds?: number;
  onNewBestBreath?: (seconds: number) => void;
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

type StudioToolTab =
  | 'bridge'
  | 'sound_lab'
  | 'call_response'
  | 'prosody_avaz'
  | 'blind_tuning'
  | 'drone'
  | 'percussion'
  | 'poetry'
  | 'slowdowner'
  | 'temperament'
  | 'breath'
  | 'tuner'
  | 'metronome'
  | 'midi'
  | 'fft'
  | 'recorder'
  | 'score_editor'
  | 'tradition_ab'
  | 'mixdown'
  | 'dastgah_quiz';

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
  traditionId,
  onChangeTradition,
  activeAssignment,
  onClearAssignment,
  onOpenExportModal,
  onOpenTeacherModal,
  isPro,
  bestBreathSeconds = 0,
  onNewBestBreath,
  recordings,
  objectUrlRegistry,
  initialSubPanel,
  onSaveSession,
  onSaveRecording,
  onToggleRecordingPublic,
  onDeleteRecording,
  onRequestUpgrade,
}) => {
  // Feature 8: Smart Tuning & Vocal Transposition (-12..+12 semitones)
  const [transposeSemitones, setTransposeSemitones] = useState<number>(0);
  const [transpositionPanelOpen, setTranspositionPanelOpen] = useState(false);
  // Phase 3 & 4: Real Ornament Playback Engine, Music Stand (Wake Lock) & Persian Hall Reverb
  const [enableOrnaments, setEnableOrnaments] = useState<boolean>(false);
  const [musicStandOpen, setMusicStandOpen] = useState<boolean>(false);
  const [reverbPreset, setReverbPreset] = useState<HallReverbPresetId>(() =>
    getActiveHallReverbPreset()
  );
  const [soundEngineMode, setSoundEngineModeState] = useState<SoundEngineMode>(() =>
    getSoundEngineMode()
  );

  const handleChangeReverbPreset = useCallback((next: HallReverbPresetId) => {
    setReverbPreset(next);
    setActiveHallReverbPreset(next);
  }, []);

  const handleChangeSoundEngineMode = useCallback((next: SoundEngineMode) => {
    setSoundEngineModeState(next);
    setSoundEngineMode(next);
  }, []);

  useEffect(() => {
    void acousticSampleBank.ensureManifest();
    void acousticSampleBank.ensureCustomSamplesLoaded();
  }, []);

  const effectiveGusheh = useMemo(
    () => transposeGusheh(gusheh, transposeSemitones, koronMode),
    [gusheh, transposeSemitones, koronMode]
  );

  const activeTradition = TRADITION_BY_ID[traditionId];

  const [micActive, setMicActive] = useState(false);
  const [micErrorFa, setMicErrorFa] = useState<string | null>(null);
  const [pitchFrame, setPitchFrame] = useState<PitchAnalysisFrame>(INITIAL_FRAME);
  const [midiFreqHz, setMidiFreqHz] = useState<number | null>(null);
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

  // Feature 4: Wait Mode ("صبر کن تا درست بنوازی")
  const [waitMode, setWaitMode] = useState<WaitModeState>(() =>
    createWaitModeState(gusheh.practiceLoop.startIndex, gusheh.practiceLoop.endIndex, 22, 220)
  );
  const waitModeRef = useRef<WaitModeState>(waitMode);
  waitModeRef.current = waitMode;

  const [meter, setMeter] = useState<IranianMeter>(gusheh.practiceLoop.meter);
  const [bpm, setBpm] = useState<number>(gusheh.practiceLoop.defaultBpm);

  const [callResponsePhase, setCallResponsePhase] = useState<'idle' | 'master' | 'student'>('idle');

  // Phase-2 Feature 8: Hands-Free Auto-Cycle Studio
  const [handsFreeActive, setHandsFreeActive] = useState(false);
  const [handsFreePhase, setHandsFreePhase] = useState<HandsFreePhase>('idle');
  const [handsFreeCountdown, setHandsFreeCountdown] = useState<number>(3);
  const [handsFreeFeedbackFa, setHandsFreeFeedbackFa] = useState<string>('');
  const handsFreeActiveRef = useRef<boolean>(false);
  handsFreeActiveRef.current = handsFreeActive;
  const handsFreeTimersRef = useRef<number[]>([]);
  const handsFreeSampleStartIdxRef = useRef<number>(0);

  // Phase-2 Feature 9: Bluetooth Foot Pedal & Pro Keyboard Shortcuts
  const [footPedalEnabled, setFootPedalEnabled] = useState(true);
  const [footPedalPreset, setFootPedalPreset] = useState<FootPedalPresetId>('airturn_page');
  const [pedalPanelOpen, setPedalPanelOpen] = useState(false);
  const [pedalHudToastFa, setPedalHudToastFa] = useState<string | null>(null);
  const pedalHudTimerRef = useRef<number | null>(null);

  const unlockedGushehs = useMemo(
    () => ALL_GUSHEHS.filter((g) => isGushehUnlocked(g.id, isPro)),
    [isPro]
  );

  const navigateUnlockedGusheh = useCallback(
    (delta: 1 | -1) => {
      if (unlockedGushehs.length === 0) return;
      const idx = unlockedGushehs.findIndex((g) => g.id === gusheh.id);
      const nextIdx =
        idx < 0
          ? 0
          : (idx + delta + unlockedGushehs.length) % unlockedGushehs.length;
      onSelectGusheh(unlockedGushehs[nextIdx].id);
    },
    [gusheh.id, onSelectGusheh, unlockedGushehs]
  );
  const [fullscreen, setFullscreen] = useState(false);
  const [autoRecord, setAutoRecord] = useState(false);
  const [recorderTrigger, setRecorderTrigger] = useState<'idle' | 'start' | 'stop'>('idle');
  const [sessionToast, setSessionToast] = useState<string | null>(null);
  const [activeToolTab, setActiveToolTab] = useState<StudioToolTab>(
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

  // Sync loop/meter/bpm/WaitMode when active gusheh changes
  useEffect(() => {
    playbackRef.current?.stop();
    setIsPlaying(false);
    setActiveNoteIndex(null);
    setLoopStart(gusheh.practiceLoop.startIndex);
    setLoopEnd(gusheh.practiceLoop.endIndex);
    setMeter(gusheh.practiceLoop.meter);
    setBpm(Math.round(gusheh.practiceLoop.defaultBpm * activeTradition.tempoFactor));
    setWaitMode(
      createWaitModeState(gusheh.practiceLoop.startIndex, gusheh.practiceLoop.endIndex, 22, 220)
    );
    recentForoudRef.current = [];
    sessionStartRef.current = Date.now();
    accuracySamplesRef.current = [];
    centsErrorSamplesRef.current = [];
    sawTahrirRef.current = false;
    bestForoudRef.current = 0;
  }, [gusheh, activeTradition.tempoFactor]);

  // Apply Teacher Assignment settings automatically when loaded
  useEffect(() => {
    if (!activeAssignment || activeAssignment.gushehId !== gusheh.id) return;
    setSpeedMultiplier(Math.max(0.5, Math.min(1.5, activeAssignment.speedPercent / 100)));
    setLoopStart(activeAssignment.loopStart);
    setLoopEnd(activeAssignment.loopEnd);
    setTransposeSemitones(activeAssignment.transposeSemitones);
    if (activeAssignment.requireWaitMode) {
      setWaitMode({
        ...createWaitModeState(activeAssignment.loopStart, activeAssignment.loopEnd, 22, 220),
        enabled: true,
      });
      setActiveNoteIndex(activeAssignment.loopStart);
    }
  }, [activeAssignment, gusheh.id]);

  useEffect(() => {
    if (initialSubPanel === 'tuner') setActiveToolTab('tuner');
    else if (initialSubPanel === 'recorder') setActiveToolTab('recorder');
  }, [initialSubPanel]);

  useEffect(() => {
    filterChainRef.current?.configure(filterMode, filterCutoffHz, 1.1);
  }, [filterMode, filterCutoffHz]);

  const processWaitModeFrequency = useCallback(
    (freqHz: number | null, nowMs: number) => {
      const curr = waitModeRef.current;
      if (!curr.enabled || curr.isComplete) return;

      const { nextState, advanced, completedLoop } = evaluateWaitModeStep(
        curr,
        effectiveGusheh.melody,
        freqHz,
        nowMs,
        a4Hz,
        koronMode
      );

      waitModeRef.current = nextState;
      setWaitMode(nextState);

      if (advanced) {
        setActiveNoteIndex(nextState.currentIndex);
        if (!completedLoop && effectiveGusheh.melody[nextState.currentIndex]) {
          // Preview next target note softly so learner hears the next pitch immediately
          playPersianNote(effectiveGusheh.melody[nextState.currentIndex], {
            instrument,
            durationSec: 0.45,
            a4Hz,
            koronMode,
            velocity: 0.55,
          });
        }
      }
    },
    [a4Hz, effectiveGusheh.melody, instrument, koronMode]
  );

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
          targetScale: effectiveGusheh.scale,
          targetIst: effectiveGusheh.ist,
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

        // Feed live mic pitch straight into Wait Mode evaluator
        processWaitModeFrequency(frame.frequency, nowMs);

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
  }, [
    a4Hz,
    effectiveGusheh.ist,
    effectiveGusheh.scale,
    filterCutoffHz,
    filterMode,
    koronMode,
    processWaitModeFrequency,
    stopMicDsp,
  ]);

  const toggleMic = useCallback(() => {
    if (micActive) stopMicDsp();
    else void startMicDsp();
  }, [micActive, startMicDsp, stopMicDsp]);

  // Feed Web MIDI input into live gauge + Wait Mode (with immediate step pass when exact MIDI note hits!)
  const handleMidiPitchDetected = useCallback(
    (freqHz: number | null, labelFa: string | null) => {
      setMidiFreqHz(freqHz);
      if (freqHz !== null) {
        const match = frequencyToPersianNote(freqHz, a4Hz, koronMode, effectiveGusheh.scale);
        setPitchFrame({
          frequency: freqHz,
          clarity: 1,
          rms: 0.4,
          note: match.note,
          noteLabelFa: labelFa ?? match.labelFa,
          centsOffset: match.centsOffset,
          tahrirDetected: false,
          tahrirRateHz: 0,
          foroudScore: 95,
        });
        // Trigger Wait Mode hold check cleanly (MIDI notes are instant discrete attacks)
        const now = performance.now();
        processWaitModeFrequency(freqHz, now);
        processWaitModeFrequency(freqHz, now + waitModeRef.current.requiredHoldMs + 10);
      }
    },
    [a4Hz, effectiveGusheh.scale, koronMode, processWaitModeFrequency]
  );

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
    setWaitMode((prev) => ({ ...prev, enabled: false }));
    setIsPlaying(true);
    if (autoRecord) setRecorderTrigger('start');
    playbackRef.current = playGushehPhrase(effectiveGusheh.melody, {
      instrument,
      bpm,
      speedMultiplier,
      a4Hz,
      koronMode,
      startIndex: loopStart,
      endIndex: loopEnd,
      loop: loopEnabled,
      enableOrnaments,
      scale: effectiveGusheh.scale,
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
    effectiveGusheh.melody,
    effectiveGusheh.scale,
    enableOrnaments,
    instrument,
    koronMode,
    loopEnabled,
    loopEnd,
    loopStart,
    speedMultiplier,
    stopPhrase,
  ]);

  const toggleWaitMode = useCallback(() => {
    if (waitModeRef.current.enabled) {
      setWaitMode((prev) => ({ ...prev, enabled: false }));
      setActiveNoteIndex(null);
      return;
    }
    stopPhrase();
    const fresh: WaitModeState = {
      ...createWaitModeState(loopStart, loopEnd, waitModeRef.current.toleranceCents, 220),
      enabled: true,
    };
    setWaitMode(fresh);
    setActiveNoteIndex(loopStart);
    if (effectiveGusheh.melody[loopStart]) {
      playPersianNote(effectiveGusheh.melody[loopStart], {
        instrument,
        durationSec: 0.75,
        a4Hz,
        koronMode,
      });
    }
    if (!micActive) {
      void startMicDsp();
    }
  }, [
    a4Hz,
    effectiveGusheh.melody,
    instrument,
    koronMode,
    loopEnd,
    loopStart,
    micActive,
    startMicDsp,
    stopPhrase,
  ]);

  const clearHandsFreeTimers = useCallback(() => {
    for (const id of handsFreeTimersRef.current) window.clearTimeout(id);
    handsFreeTimersRef.current = [];
  }, []);

  const stopHandsFree = useCallback(() => {
    clearHandsFreeTimers();
    handsFreeActiveRef.current = false;
    setHandsFreeActive(false);
    setHandsFreePhase('idle');
    setHandsFreeFeedbackFa('');
    stopPhrase();
  }, [clearHandsFreeTimers, stopPhrase]);

  const runHandsFreeCycle = useCallback(() => {
    if (!handsFreeActiveRef.current) return;
    clearHandsFreeTimers();
    stopPhrase();
    setHandsFreePhase('master_playing');
    setHandsFreeFeedbackFa('استاد جمله را می‌نوازد؛ با دقت گوش دهید...');
    setIsPlaying(true);

    playbackRef.current = playGushehPhrase(effectiveGusheh.melody, {
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
        if (!handsFreeActiveRef.current) return;
        setIsPlaying(false);
        setActiveNoteIndex(null);
        setHandsFreePhase('countdown');
        setHandsFreeCountdown(3);
        setHandsFreeFeedbackFa('آماده اجرا شوید: ۳ ...');

        const t2 = window.setTimeout(() => {
          if (!handsFreeActiveRef.current) return;
          setHandsFreeCountdown(2);
          setHandsFreeFeedbackFa('آماده اجرا شوید: ۲ ...');
        }, 700);
        const t1 = window.setTimeout(() => {
          if (!handsFreeActiveRef.current) return;
          setHandsFreeCountdown(1);
          setHandsFreeFeedbackFa('آماده اجرا شوید: ۱ ...');
        }, 1400);
        const tListen = window.setTimeout(() => {
          if (!handsFreeActiveRef.current) return;
          setHandsFreePhase('student_listening');
          setHandsFreeFeedbackFa('نوبت شماست! بدون لمس صفحه بنوازید یا بخوانید...');
          handsFreeSampleStartIdxRef.current = accuracySamplesRef.current.length;
          if (!micActive) {
            void startMicDsp();
          }

          const sliceBeats = effectiveGusheh.melody
            .slice(loopStart, loopEnd + 1)
            .reduce((acc, m) => acc + m.durationBeats, 0);
          const listenMs = Math.max(
            3800,
            Math.round(sliceBeats * (60 / Math.max(40, bpm * speedMultiplier)) * 1000 + 1200)
          );

          const tReview = window.setTimeout(() => {
            if (!handsFreeActiveRef.current) return;
            const cycleSamples = accuracySamplesRef.current.slice(
              handsFreeSampleStartIdxRef.current
            );
            const evaluation = evaluateHandsFreeCycle(cycleSamples, 82);
            setHandsFreePhase('review_score');
            setHandsFreeFeedbackFa(evaluation.feedbackFa);

            const tNext = window.setTimeout(() => {
              if (!handsFreeActiveRef.current) return;
              if (evaluation.action === 'advance_next_gusheh') {
                navigateUnlockedGusheh(1);
              } else {
                runHandsFreeCycle();
              }
            }, 2200);
            handsFreeTimersRef.current.push(tNext);
          }, listenMs);
          handsFreeTimersRef.current.push(tReview);
        }, 2100);

        handsFreeTimersRef.current.push(t2, t1, tListen);
      },
    });
  }, [
    a4Hz,
    bpm,
    clearHandsFreeTimers,
    effectiveGusheh.melody,
    instrument,
    koronMode,
    loopEnd,
    loopStart,
    micActive,
    navigateUnlockedGusheh,
    speedMultiplier,
    startMicDsp,
    stopPhrase,
  ]);

  const toggleHandsFree = useCallback(() => {
    if (handsFreeActiveRef.current) {
      stopHandsFree();
    } else {
      handsFreeActiveRef.current = true;
      setHandsFreeActive(true);
      runHandsFreeCycle();
    }
  }, [runHandsFreeCycle, stopHandsFree]);

  // If Hands-Free advances to a new gusheh, automatically begin the next cycle!
  useEffect(() => {
    if (handsFreeActiveRef.current) {
      const id = window.setTimeout(() => {
        if (handsFreeActiveRef.current) runHandsFreeCycle();
      }, 450);
      return () => window.clearTimeout(id);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gusheh.id]);

  const showPedalToast = useCallback((labelFa: string) => {
    setPedalHudToastFa(labelFa);
    if (pedalHudTimerRef.current !== null) {
      window.clearTimeout(pedalHudTimerRef.current);
    }
    pedalHudTimerRef.current = window.setTimeout(() => {
      setPedalHudToastFa(null);
    }, 2200);
  }, []);

  const startRepeatWithMaster = useCallback(() => {
    stopPhrase();
    setCallResponsePhase('master');
    setIsPlaying(true);

    playbackRef.current = playGushehPhrase(effectiveGusheh.melody, {
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

        const sliceBeats = effectiveGusheh.melody
          .slice(loopStart, loopEnd + 1)
          .reduce((acc, m) => acc + m.durationBeats, 0);
        const studentWindowMs = Math.max(
          3500,
          Math.round(sliceBeats * (60 / Math.max(40, bpm * speedMultiplier)) * 1000 + 1200)
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
    effectiveGusheh.melody,
    instrument,
    koronMode,
    loopEnd,
    loopStart,
    micActive,
    speedMultiplier,
    startMicDsp,
    stopPhrase,
  ]);

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
        return;
      }
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        setFullscreen((v) => !v);
        return;
      }
      if (e.key === 'Escape' && fullscreen) {
        setFullscreen(false);
        return;
      }

      // Phase-2 Feature 9: Bluetooth Foot Pedal & Pro Keyboard Mapper
      if (footPedalEnabled) {
        const action = resolveFootPedalAction(e.key, footPedalPreset);
        if (action) {
          e.preventDefault();
          showPedalToast(`پدال پا: ${PEDAL_ACTION_LABELS_FA[action]}`);
          if (action === 'toggle_play') {
            if (isPlaying) stopPhrase();
            else startPhrase();
          } else if (action === 'repeat_master') {
            startRepeatWithMaster();
          } else if (action === 'toggle_record') {
            setActiveToolTab('recorder');
            setRecorderTrigger((prev) => (prev === 'start' ? 'stop' : 'start'));
          } else if (action === 'next_gusheh') {
            navigateUnlockedGusheh(1);
          } else if (action === 'prev_gusheh') {
            navigateUnlockedGusheh(-1);
          } else if (action === 'toggle_wait_mode') {
            toggleWaitMode();
          }
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    footPedalEnabled,
    footPedalPreset,
    fullscreen,
    isPlaying,
    navigateUnlockedGusheh,
    showPedalToast,
    startPhrase,
    startRepeatWithMaster,
    stopPhrase,
    toggleWaitMode,
  ]);

  useEffect(() => {
    return () => {
      stopMicDsp();
      clearHandsFreeTimers();
      if (pedalHudTimerRef.current !== null) window.clearTimeout(pedalHudTimerRef.current);
      playbackRef.current?.stop();
      if (callTimerRef.current !== null) window.clearTimeout(callTimerRef.current);
    };
  }, [clearHandsFreeTimers, stopMicDsp]);

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
    const foroudScore =
      bestForoudRef.current > 0 ? bestForoudRef.current : Math.min(100, accuracyPercent + 4);

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

    const assignmentPassed =
      activeAssignment &&
      activeAssignment.gushehId === gusheh.id &&
      accuracyPercent >= activeAssignment.targetAccuracyPercent;

    setSessionToast(
      assignmentPassed
        ? `تبریک! تکلیف «${activeAssignment.titleFa}» با دقت ${toPersianDigits(accuracyPercent)}٪ (هدف ${toPersianDigits(activeAssignment.targetAccuracyPercent)}٪) با موفقیت تکمیل شد!`
        : `جلسه «${gusheh.nameFa}» ثبت شد — دقت کوک ${toPersianDigits(accuracyPercent)}٪، فرود ${toPersianDigits(foroudScore)}٪، کارت SM-2 به‌روزرسانی گردید.`
    );
    sessionStartRef.current = Date.now();
    window.setTimeout(() => setSessionToast(null), 6000);
  };

  const dastgah = SYSTEM_BY_ID[gusheh.dastgahId];

  const activeMelodyNote =
    activeNoteIndex !== null
      ? effectiveGusheh.melody[activeNoteIndex] ?? null
      : pitchFrame.note;

  return (
    <div
      className={
        fullscreen
          ? 'fixed inset-0 z-50 overflow-y-auto bg-slate-950 p-4 text-slate-100 sm:p-6'
          : 'space-y-4'
      }
    >
      {/* Feature 11: Active Teacher Assignment Banner */}
      {activeAssignment && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/45 bg-gradient-to-l from-amber-500/15 to-teal-500/10 px-4 py-3 text-xs shadow-sm">
          <div className="flex items-start gap-2.5">
            <GraduationCap className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <div>
              <div className="font-extrabold text-slate-900 dark:text-white">
                تکلیف فعال استاد ({activeAssignment.teacherName}): {activeAssignment.titleFa}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-300">
                هدف دقت کوک: <strong>{toPersianDigits(activeAssignment.targetAccuracyPercent)}٪</strong> • سرعت:{' '}
                <strong>{toPersianDigits(activeAssignment.speedPercent)}٪</strong> •{' '}
                {activeAssignment.notesFa}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClearAssignment}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800"
            aria-label="بستن تکلیف فعال"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

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
              <span className="rounded-full bg-indigo-500/12 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                روایت {activeTradition.shortNameFa}
              </span>
              {transposeSemitones !== 0 && (
                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-extrabold text-amber-700 dark:text-amber-300">
                  ترانسپوز: {formatSemitoneShiftFa(transposeSemitones)}
                </span>
              )}
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

          <div className="flex flex-wrap items-center gap-1.5">
            <select
              value={gusheh.id}
              onChange={(e) => onSelectGusheh(e.target.value)}
              aria-label="انتخاب گوشه فعال"
              className="max-w-[205px] rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              {unlockedGushehs.map((g) => (
                <option key={g.id} value={g.id}>
                  {SYSTEM_BY_ID[g.dastgahId]?.nameFa} — {g.nameFa}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={onOpenTeacherModal}
              title="کلاس استاد و تکلیف هفتگی"
              className="inline-flex items-center gap-1 rounded-xl border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 text-xs font-bold text-amber-700 hover:bg-amber-500/20 dark:text-amber-300"
            >
              <GraduationCap className="h-4 w-4" />
              <span className="hidden md:inline">تکلیف</span>
            </button>

            <button
              type="button"
              onClick={onOpenExportModal}
              title="خروجی MusicXML / MIDI / WAV / PDF / کارت پیشرفت"
              className="inline-flex items-center gap-1 rounded-xl border border-teal-500/40 bg-teal-500/10 px-2.5 py-2 text-xs font-bold text-teal-700 hover:bg-teal-500/20 dark:text-teal-300"
            >
              <Share2 className="h-4 w-4" />
              <span className="hidden md:inline">خروجی</span>
            </button>

            <button
              type="button"
              onClick={() => setMusicStandOpen(true)}
              title="حالت پایه نت افقی با جلوگیری از خاموش شدن صفحه (Wake Lock)"
              className="inline-flex items-center gap-1 rounded-xl border border-amber-500/40 bg-amber-500/15 px-2.5 py-2 text-xs font-bold text-amber-700 hover:bg-amber-500/25 dark:text-amber-300"
            >
              <Sun className="h-4 w-4" />
              <span className="hidden lg:inline">پایه نت</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const html = generatePrintableSheetHtml({
                  gusheh: effectiveGusheh,
                  instrument,
                  koronMode,
                  a4Hz,
                });
                openPrintableSheetWindow(html, `navanegar-${effectiveGusheh.id}-a4.html`);
              }}
              title="چاپ جزوه A4 / ذخیره PDF نت ایرانی با انگشت‌گذاری و شعر"
              className="inline-flex items-center gap-1 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-300"
            >
              <Printer className="h-4 w-4" />
              <span className="hidden lg:inline">چاپ A4</span>
            </button>

            <select
              value={soundEngineMode}
              onChange={(e) => handleChangeSoundEngineMode(e.target.value as SoundEngineMode)}
              aria-label="موتور صوتی و سمپل واقعی سازها"
              title="انتخاب موتور صوتی: هیبرید سمپل واقعی / سمپل خالص / سنتز فیزیکی v2"
              className="rounded-xl border border-teal-400/45 bg-teal-500/10 px-2 py-2 text-[11px] font-bold text-teal-800 dark:bg-teal-950/60 dark:text-teal-200"
            >
              <option value="hybrid_studio">صدا: هیبرید سمپل واقعی</option>
              <option value="acoustic_samples">صدا: سمپل استودیویی خالص</option>
              <option value="physical_v2">صدا: سنتز فیزیکی v2</option>
            </select>

            <select
              value={reverbPreset}
              onChange={(e) => handleChangeReverbPreset(e.target.value as HallReverbPresetId)}
              aria-label="فضای آکوستیک و ریورب تالار ایرانی"
              title="آکوستیک و ریورب تالار ایرانی"
              className="rounded-xl border border-indigo-400/40 bg-indigo-500/10 px-2 py-2 text-[11px] font-bold text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-200"
            >
              {HALL_REVERB_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  آکوستیک: {p.shortFa}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setFullscreen((v) => !v)}
              title="حالت تمرین تمام‌صفحه (کلید F)"
              className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-slate-100 px-2.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              <span className="hidden lg:inline">{fullscreen ? 'خروج (F)' : 'تمام‌صفحه'}</span>
            </button>
          </div>
        </div>

        {/* Reference Instrument Selector (All 7 Persian Instruments) + Transport + Ornaments + Mic DSP */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 pt-3 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="ml-1 text-xs font-bold text-slate-500 dark:text-slate-400">
              ساز مرجع:
            </span>
            {ALL_INSTRUMENT_IDS.map((inst) => (
              <button
                key={inst}
                type="button"
                onClick={() => {
                  onChangeInstrument(inst);
                  const playPreview = () =>
                    playPersianNote(effectiveGusheh.shahed, {
                      instrument: inst,
                      durationSec: 0.85,
                      a4Hz,
                      koronMode,
                      scale: effectiveGusheh.scale,
                    });
                  if (
                    soundEngineMode === 'physical_v2' ||
                    acousticSampleBank.isInstrumentReady(inst)
                  ) {
                    playPreview();
                  } else {
                    void Promise.race([
                      preloadInstrumentSamples(inst),
                      new Promise((r) => window.setTimeout(r, 180)),
                    ]).then(() => playPreview());
                  }
                }}
                className={`rounded-xl px-2.5 py-1.5 text-xs font-bold transition ${
                  instrument === inst
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {INSTRUMENT_LABELS_FA[inst]}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={isPlaying ? stopPhrase : startPhrase}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-extrabold text-white shadow-sm transition ${
                isPlaying ? 'bg-rose-600 hover:bg-rose-700' : 'bg-teal-600 hover:bg-teal-700'
              }`}
            >
              {isPlaying ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {isPlaying ? 'توقف' : 'پخش A–B'}
            </button>

            <button
              type="button"
              onClick={() => setLoopEnabled((v) => !v)}
              className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-2 text-xs font-bold transition ${
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
              onClick={() => setEnableOrnaments((v) => !v)}
              title="اجرای واقعی ریز، اشاره، تکیه، دراب، تحریر و مالش هنگام پخش نمونه گوشه"
              className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-2 text-xs font-bold transition ${
                enableOrnaments
                  ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                  : 'border-slate-300 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              زینت زنده
            </button>

            {/* Feature 4: Wait Mode ("صبر کن تا درست بنوازی") */}
            <button
              type="button"
              onClick={toggleWaitMode}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-extrabold transition ${
                waitMode.enabled
                  ? 'bg-violet-600 text-white shadow'
                  : 'bg-violet-500/15 text-violet-700 hover:bg-violet-500/25 dark:text-violet-300'
              }`}
            >
              <PauseCircle className="h-3.5 w-3.5" />
              {waitMode.enabled ? 'صبر تا کوک دقیق (فعال)' : 'حالت صبر تا درست بنوازی'}
            </button>

            <button
              type="button"
              onClick={startRepeatWithMaster}
              title="کلید میانبر R"
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-extrabold transition ${
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
                ? 'نوبت شماست!'
                : 'تکرار با استاد (R)'}
            </button>

            <button
              type="button"
              onClick={toggleHandsFree}
              title="چرخه خودکار بدون دست: استاد → شمارش ۳-۲-۱ → اجرا → امتیاز و گوشه بعد"
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-extrabold transition ${
                handsFreeActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30'
                  : 'border border-indigo-500/40 bg-indigo-500/12 text-indigo-700 hover:bg-indigo-500/20 dark:text-indigo-300'
              }`}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${handsFreeActive ? 'animate-spin' : ''}`} />
              {handsFreeActive ? 'توقف حالت بدون دست' : 'تمرین بدون دست'}
            </button>

            <button
              type="button"
              onClick={() => setPedalPanelOpen((v) => !v)}
              title="تنظیم پدال بلوتوثی پا (AirTurn / PageFlip) و کلیدهای میانبر"
              className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-2 text-xs font-bold transition ${
                pedalPanelOpen || footPedalEnabled
                  ? 'border-sky-500/45 bg-sky-500/12 text-sky-700 dark:text-sky-300'
                  : 'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300'
              }`}
            >
              <Footprints className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">پدال پا</span>
            </button>

            <button
              type="button"
              onClick={toggleMic}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-extrabold text-white shadow-sm transition ${
                micActive
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600'
              }`}
            >
              {micActive ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
              {micActive ? 'DSP فعال' : 'میکروفون'}
            </button>

            <button
              type="button"
              onClick={() => void handleCompleteSession()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-xs font-extrabold text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-300"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              ثبت جلسه
            </button>
          </div>
        </div>

        {/* Speed + Koron Tuning + Feature 8 Smart Transposition Toggle */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-100/80 px-3.5 py-2 text-xs dark:bg-slate-800/70">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-bold text-slate-700 dark:text-slate-200">
              سرعت (بدون تغییر کوک):
            </span>
            <input
              type="range"
              min={0.5}
              max={1.5}
              step={0.05}
              value={speedMultiplier}
              onChange={(e) => setSpeedMultiplier(Number(e.target.value))}
              className="w-28 accent-teal-500"
            />
            <span className="ltr-num rounded-md bg-white px-2 py-0.5 font-extrabold text-teal-700 dark:bg-slate-900 dark:text-teal-300">
              {Math.round(speedMultiplier * 100)}%
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                onChangeKoronMode(koronMode === 'standard_50' ? 'traditional_56' : 'standard_50')
              }
              className="rounded-lg border border-teal-500/35 bg-teal-500/12 px-2.5 py-1 text-[11px] font-bold text-teal-700 dark:text-teal-300"
            >
              {koronMode === 'traditional_56' ? 'کُرُن سنتی (-۵۶¢)' : 'کُرُن استاندارد (-۵۰¢)'}
            </button>

            <button
              type="button"
              onClick={() => setTranspositionPanelOpen((v) => !v)}
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-bold transition ${
                transposeSemitones !== 0 || transpositionPanelOpen
                  ? 'border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300'
                  : 'border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
              }`}
            >
              <Sliders className="h-3 w-3" />
              کوک و ترانسپوز ({formatSemitoneShiftFa(transposeSemitones)})
            </button>

            <span className="hidden text-[11px] text-slate-500 xl:inline dark:text-slate-400">
              آغاز: {formatNoteFa(effectiveGusheh.aghaz)}
              {effectiveGusheh.moteghayer
                ? ` • متغیر: ${formatNoteFa(effectiveGusheh.moteghayer)}`
                : ''}
            </span>
          </div>
        </div>

        {/* Feature 8: Expandable Smart Iranian Tuning & Vocal Range Transposition Panel */}
        {transpositionPanelOpen && (
          <div className="mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-extrabold text-amber-800 dark:text-amber-200">
                تبدیل کوک ساز و ترانسپوز هوشمند بازه صدایی (همگام با نت، واخوان، سنتز و پرده‌بندی)
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={-12}
                  max={12}
                  step={1}
                  value={transposeSemitones}
                  onChange={(e) => setTransposeSemitones(Number(e.target.value))}
                  className="w-32 accent-amber-500"
                />
                <span className="ltr-num rounded-lg bg-white px-2 py-0.5 font-extrabold text-amber-700 dark:bg-slate-900 dark:text-amber-300">
                  {transposeSemitones > 0 ? `+${transposeSemitones}` : transposeSemitones} ST
                </span>
              </div>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {TRANSPOSITION_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  title={p.subtitleFa}
                  onClick={() => setTransposeSemitones(p.semitones)}
                  className={`rounded-xl px-2.5 py-1.5 text-[11px] font-bold transition ${
                    transposeSemitones === p.semitones
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'bg-white text-slate-700 hover:bg-amber-50 dark:bg-slate-800 dark:text-slate-200'
                  }`}
                >
                  {p.labelFa}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Feature 4: Interactive Wait Mode Live Banner */}
        {waitMode.enabled && (
          <div className="mt-3 rounded-2xl border border-violet-500/40 bg-violet-500/10 p-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-extrabold text-violet-800 dark:text-violet-200">
                  {waitMode.isComplete
                    ? 'آفرین! تمام نت‌های حلقه با دقت کوک عالی اجرا شدند!'
                    : `حالت صبر تا درست بنوازی — نت فعلی: ${
                        effectiveGusheh.melody[waitMode.currentIndex]
                          ? formatNoteFa(effectiveGusheh.melody[waitMode.currentIndex], true)
                          : ''
                      } (گام ${toPersianDigits(waitMode.completedSteps + 1)} از ${toPersianDigits(waitMode.totalSteps)})`}
                </div>
                <div className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-300">
                  نت را با خطای کمتر از ±{toPersianDigits(waitMode.toleranceCents)} سنت روی میکروفون یا کیبورد MIDI نگه دارید تا خودکار به نت بعدی بروید.
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <select
                  value={waitMode.toleranceCents}
                  onChange={(e) =>
                    setWaitMode((prev) => ({ ...prev, toleranceCents: Number(e.target.value) }))
                  }
                  aria-label="تلرانس سنت حالت صبر"
                  className="rounded-lg border border-violet-400/50 bg-white px-2 py-1 text-[11px] font-bold dark:bg-slate-900"
                >
                  <option value={15}>سخت‌گیرانه (±۱۵¢)</option>
                  <option value={22}>استاندارد (±۲۲¢)</option>
                  <option value={32}>مبتدی (±۳۲¢)</option>
                </select>
                <button
                  type="button"
                  onClick={() => {
                    const reset = {
                      ...createWaitModeState(loopStart, loopEnd, waitMode.toleranceCents, 220),
                      enabled: true,
                    };
                    setWaitMode(reset);
                    setActiveNoteIndex(loopStart);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1 text-[11px] font-bold text-white"
                >
                  <RotateCcw className="h-3 w-3" />
                  شروع مجدد
                </button>
              </div>
            </div>

            {/* Hold Progress Bar */}
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-l from-emerald-400 to-violet-500 transition-all"
                style={{
                  width: `${
                    waitMode.isComplete
                      ? 100
                      : Math.max(
                          Math.round((waitMode.completedSteps / Math.max(1, waitMode.totalSteps)) * 100),
                          Math.round(waitMode.holdProgress * 100)
                        )
                  }%`,
                }}
              />
            </div>
          </div>
        )}

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

        {/* Phase-2 Feature 8: Hands-Free Auto-Cycle Live HUD Banner */}
        {handsFreeActive && (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-indigo-500/45 bg-indigo-500/12 px-3.5 py-2.5 text-xs">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-sm font-black text-white">
                {handsFreePhase === 'countdown'
                  ? toPersianDigits(handsFreeCountdown)
                  : handsFreePhase === 'master_playing'
                  ? '♪'
                  : handsFreePhase === 'student_listening'
                  ? '●'
                  : '✓'}
              </span>
              <div>
                <div className="font-extrabold text-indigo-800 dark:text-indigo-200">
                  چرخه خودکار بدون دست فعال است (حد نصاب انتقال به گوشه بعد: ۸۲٪)
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-300">
                  {handsFreeFeedbackFa}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={stopHandsFree}
              className="rounded-xl bg-rose-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-rose-700"
            >
              پایان چرخه
            </button>
          </div>
        )}

        {/* Phase-2 Feature 9: Foot Pedal & Pro Shortcuts Configuration Panel */}
        {pedalPanelOpen && (
          <div className="mt-2 rounded-2xl border border-sky-500/35 bg-sky-500/8 p-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-extrabold text-sky-800 dark:text-sky-200">
                پشتیبانی پدال بلوتوثی پا (AirTurn / PageFlip / Donner) و کلیدهای حرفه‌ای
              </div>
              <label className="inline-flex cursor-pointer items-center gap-1.5 font-bold text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={footPedalEnabled}
                  onChange={(e) => setFootPedalEnabled(e.target.checked)}
                  className="accent-sky-500"
                />
                فعال‌سازی شنود پدال
              </label>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {FOOT_PEDAL_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setFootPedalPreset(preset.id)}
                  className={`rounded-xl border p-2.5 text-right transition ${
                    footPedalPreset === preset.id
                      ? 'border-sky-500 bg-sky-500/15 font-extrabold'
                      : 'border-slate-200 bg-white/80 dark:border-slate-700 dark:bg-slate-900/60'
                  }`}
                >
                  <div className="text-[11px] text-slate-900 dark:text-white">
                    {preset.nameFa}
                  </div>
                  <div className="mt-0.5 text-[10px] font-normal text-slate-500 dark:text-slate-400">
                    {preset.descriptionFa}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {pedalHudToastFa && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-sky-500/40 bg-sky-500/15 px-3 py-1.5 text-xs font-extrabold text-sky-700 dark:text-sky-200">
            <Footprints className="h-3.5 w-3.5" />
            {pedalHudToastFa}
          </div>
        )}
      </div>

      {/* Main Console Grid: Persian Staff Notation + Live ±50¢ Gauge */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <PersianStaffNotation
            gusheh={effectiveGusheh}
            instrument={instrument}
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
                ornament: enableOrnaments ? note.ornament : undefined,
                enableOrnaments,
              });
            }}
            onSetLoopStart={setLoopStart}
            onSetLoopEnd={setLoopEnd}
          />
        </div>

        <div className="lg:col-span-4">
          <CentGauge
            frame={pitchFrame}
            micActive={micActive || midiFreqHz !== null}
            targetNoteLabelFa={
              activeNoteIndex !== null && effectiveGusheh.melody[activeNoteIndex]
                ? formatNoteFa(effectiveGusheh.melody[activeNoteIndex], true)
                : `ایست: ${formatNoteFa(effectiveGusheh.ist, true)}`
            }
          />
        </div>
      </div>

      {/* Feature 2: Real-Time Microtonal Pitch Contour / Piano-Roll */}
      <PitchContourCanvas
        gusheh={effectiveGusheh}
        a4Hz={a4Hz}
        koronMode={koronMode}
        pitchFrame={pitchFrame}
        micActive={micActive}
        externalFreqHz={midiFreqHz}
        activeNoteIndex={activeNoteIndex}
      />

      {/* Modular Studio Workbench Tabs (Classic + Phase 1, 2 & 3 Master Conservatory Tools) */}
      <div className="flex flex-wrap gap-1.5 rounded-2xl border border-slate-200/80 bg-white/85 p-1.5 dark:border-slate-800 dark:bg-slate-900/85">
        {(
          [
            { id: 'bridge', labelFa: 'پل بصری و انگشت‌گذاری' },
            { id: 'sound_lab', labelFa: 'آزمایشگاه صدا و سمپل واقعی' },
            { id: 'score_editor', labelFa: 'نت‌نگار ربع‌پرده (آهنگ‌ساز)' },
            { id: 'tradition_ab', labelFa: 'مقایسه روایت‌ها (A/B)' },
            { id: 'mixdown', labelFa: 'میکسر همنوازی (WAV)' },
            { id: 'dastgah_quiz', labelFa: 'آزمون تشخیص دستگاه' },
            { id: 'call_response', labelFa: 'سؤال و جواب (بداهه)' },
            { id: 'prosody_avaz', labelFa: 'آواز و تقطیع عروضی' },
            { id: 'blind_tuning', labelFa: 'کوک با گوش' },
            { id: 'drone', labelFa: 'واخوان (Drone)' },
            { id: 'percussion', labelFa: 'تنبک و دف' },
            { id: 'poetry', labelFa: 'شعر و روایت‌ها' },
            { id: 'slowdowner', labelFa: 'آهسته‌ساز و نت‌نگار' },
            { id: 'temperament', labelFa: 'کوک و ربع‌پرده' },
            { id: 'breath', labelFa: 'نفس و تحریر' },
            { id: 'tuner', labelFa: 'تیونر ساز' },
            { id: 'metronome', labelFa: 'مترونوم' },
            { id: 'midi', labelFa: 'کیبورد MIDI / OTG' },
            { id: 'fft', labelFa: isPro ? 'FFT زیرسنت' : 'FFT (Pro)' },
            { id: 'recorder', labelFa: 'ضبط و مقایسه' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveToolTab(tab.id)}
            className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
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
          gusheh={effectiveGusheh}
          instrument={instrument}
          activeNote={activeMelodyNote}
          a4Hz={a4Hz}
          koronMode={koronMode}
        />
      )}

      <Suspense
        fallback={
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-center text-xs text-slate-400">
            در حال بارگذاری ابزار تخصصی استودیو...
          </div>
        }
      >
        {activeToolTab === 'call_response' && (
          <CallResponsePanel
            gusheh={effectiveGusheh}
            instrument={instrument}
            a4Hz={a4Hz}
            koronMode={koronMode}
          />
        )}

        {activeToolTab === 'prosody_avaz' && (
          <ProsodyAvazPanel
            gusheh={effectiveGusheh}
            instrument={instrument}
            a4Hz={a4Hz}
            koronMode={koronMode}
          />
        )}

        {activeToolTab === 'blind_tuning' && (
          <BlindTuningPanel
            instrument={instrument}
            dastgahId={effectiveGusheh.dastgahId}
            a4Hz={a4Hz}
            koronMode={koronMode}
          />
        )}

        {activeToolTab === 'drone' && (
          <DronePanel gusheh={effectiveGusheh} a4Hz={a4Hz} koronMode={koronMode} />
        )}

        {activeToolTab === 'percussion' && (
          <TombakDafPanel ownerUid={ownerUid} initialBpm={bpm} />
        )}

        {activeToolTab === 'poetry' && (
          <PoetryProsodyPanel
            gusheh={effectiveGusheh}
            activeNoteIndex={activeNoteIndex}
            traditionId={traditionId}
            onChangeTradition={onChangeTradition}
          />
        )}

        {activeToolTab === 'slowdowner' && (
          <AudioSlowdownerPanel
            gusheh={effectiveGusheh}
            instrument={instrument}
            a4Hz={a4Hz}
            koronMode={koronMode}
          />
        )}

        {activeToolTab === 'temperament' && (
          <TemperamentEditorPanel
            ownerUid={ownerUid}
            gusheh={effectiveGusheh}
            instrument={instrument}
            a4Hz={a4Hz}
          />
        )}

        {activeToolTab === 'breath' && (
          <BreathLongTonePanel
            micActive={micActive}
            liveRms={pitchFrame.rms}
            liveTahrirRateHz={pitchFrame.tahrirRateHz}
            bestBreathSeconds={bestBreathSeconds}
            onNewBestBreath={onNewBestBreath}
          />
        )}

        {activeToolTab === 'tuner' && (
          <InstrumentTunerPanel
            dastgahId={effectiveGusheh.dastgahId}
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

        {activeToolTab === 'midi' && (
          <WebMidiPanel
            gusheh={effectiveGusheh}
            instrument={instrument}
            a4Hz={a4Hz}
            koronMode={koronMode}
            onMidiPitchDetected={handleMidiPitchDetected}
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
            gusheh={effectiveGusheh}
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

        {activeToolTab === 'score_editor' && (
          <MicrotonalScoreEditorPanel
            gusheh={effectiveGusheh}
            instrument={instrument}
            a4Hz={a4Hz}
            koronMode={koronMode}
          />
        )}

        {activeToolTab === 'tradition_ab' && (
          <TraditionComparePanel
            gusheh={effectiveGusheh}
            instrument={instrument}
            a4Hz={a4Hz}
          />
        )}

        {activeToolTab === 'mixdown' && (
          <EnsembleMixdownPanel
            gusheh={effectiveGusheh}
            instrument={instrument}
            a4Hz={a4Hz}
            koronMode={koronMode}
            reverbPreset={reverbPreset}
            onChangeReverbPreset={handleChangeReverbPreset}
            recordings={recordings}
          />
        )}

        {activeToolTab === 'dastgah_quiz' && (
          <DastgahQuizPanel
            instrument={instrument}
            a4Hz={a4Hz}
            koronMode={koronMode}
          />
        )}

        {activeToolTab === 'sound_lab' && (
          <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-4 sm:p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
            <AcousticSoundLabPanel
              activeInstrument={instrument}
              onSelectInstrument={onChangeInstrument}
              a4Hz={a4Hz}
              koronMode={koronMode}
            />
          </div>
        )}

        {musicStandOpen && (
          <MusicStandOverlay
            open={musicStandOpen}
            onClose={() => setMusicStandOpen(false)}
            gusheh={effectiveGusheh}
            instrument={instrument}
            a4Hz={a4Hz}
            koronMode={koronMode}
            bpm={bpm}
            speedMultiplier={speedMultiplier}
            isPlaying={isPlaying}
            loopEnabled={loopEnabled}
            enableOrnaments={enableOrnaments}
            activeNoteIdx={activeNoteIndex}
            livePitch={pitchFrame}
            onTogglePlay={isPlaying ? stopPhrase : startPhrase}
            onToggleLoop={() => setLoopEnabled((v) => !v)}
            onToggleOrnaments={() => setEnableOrnaments((v) => !v)}
            onSelectNote={(idx) => {
              const target = effectiveGusheh.melody[idx];
              if (!target) return;
              setActiveNoteIndex(idx);
              playPersianNote(target, {
                instrument,
                durationSec: 0.85,
                a4Hz,
                koronMode,
                ornament: target.ornament,
                enableOrnaments,
                scale: effectiveGusheh.scale,
              });
            }}
          />
        )}
      </Suspense>
    </div>
  );
};
