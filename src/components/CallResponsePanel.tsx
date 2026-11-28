import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  Mic,
  MicOff,
  Music2,
  Play,
  RefreshCw,
  Sparkles,
  Square,
} from 'lucide-react';
import { detectPitchYin } from '../audio/dsp';
import { playGushehPhrase, playPersianNote } from '../audio/karplusStrong';
import {
  evaluateImprovisedResponse,
  generateModalCallPhrase,
  type ImprovisationEvaluation,
} from '../core/callResponse';
import { formatNoteFa, noteToFrequency } from '../data/musicTheory';
import type {
  Gusheh,
  InstrumentId,
  KoronMode,
  PersianNoteSpec,
} from '../types/music';
import { INSTRUMENT_LABELS_FA, toPersianDigits } from '../utils/persian';

interface CallResponsePanelProps {
  gusheh: Gusheh;
  instrument: InstrumentId;
  a4Hz: number;
  koronMode: KoronMode;
  onAwardXp?: (xp: number) => void;
}

export const CallResponsePanel: React.FC<CallResponsePanelProps> = ({
  gusheh,
  instrument,
  a4Hz,
  koronMode,
  onAwardXp,
}) => {
  const [roundIdx, setRoundIdx] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'calling' | 'listening' | 'evaluated'>('idle');
  const [activeCallNoteIdx, setActiveCallNoteIdx] = useState<number | null>(null);
  const [capturedFreqs, setCapturedFreqs] = useState<number[]>([]);
  const [tappedNotesFa, setTappedNotesFa] = useState<string[]>([]);
  const [micErrorFa, setMicErrorFa] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<ImprovisationEvaluation | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(6);

  const playbackRef = useRef<{ stop: () => void } | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const countdownRef = useRef<number | null>(null);
  const capturedRef = useRef<number[]>([]);

  const callPhrase = useMemo(
    () => generateModalCallPhrase(gusheh, roundIdx),
    [gusheh, roundIdx]
  );

  const stopAll = () => {
    playbackRef.current?.stop();
    playbackRef.current = null;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (countdownRef.current !== null) {
      window.clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (micCtxRef.current) {
      micCtxRef.current.close().catch(() => {});
      micCtxRef.current = null;
    }
  };

  useEffect(() => {
    setRoundIdx(0);
    setPhase('idle');
    setEvaluation(null);
    setCapturedFreqs([]);
    setTappedNotesFa([]);
    return () => stopAll();
  }, [gusheh.id]);

  const finishAndEvaluate = () => {
    stopAll();
    const res = evaluateImprovisedResponse(capturedRef.current, gusheh, a4Hz, koronMode);
    setEvaluation(res);
    setPhase('evaluated');
    if (res.xpAwarded > 0) {
      onAwardXp?.(res.xpAwarded);
    }
  };

  const handlePlayCall = () => {
    stopAll();
    setMicErrorFa(null);
    setEvaluation(null);
    setPhase('calling');
    playbackRef.current = playGushehPhrase(callPhrase.notes, {
      instrument,
      bpm: gusheh.practiceLoop.defaultBpm,
      speedMultiplier: 1,
      a4Hz,
      koronMode,
      startIndex: 0,
      endIndex: callPhrase.notes.length - 1,
      loop: false,
      enableOrnaments: false,
      scale: gusheh.scale,
      onNoteStart: (idx) => setActiveCallNoteIdx(idx),
      onComplete: () => {
        setActiveCallNoteIdx(null);
        setPhase('idle');
      },
    });
  };

  const handleStartListening = async () => {
    stopAll();
    setMicErrorFa(null);
    setEvaluation(null);
    capturedRef.current = [];
    setCapturedFreqs([]);
    setTappedNotesFa([]);
    setSecondsLeft(6);
    setPhase('listening');

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('میکروفون مرورگر در دسترس نیست؛ می‌توانید با کلیدهای گام زیر پاسخ دهید.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      micCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      const timeBuf = new Float32Array(analyser.fftSize);

      const tick = () => {
        analyser.getFloatTimeDomainData(timeBuf);
        const yin = detectPitchYin(timeBuf, ctx.sampleRate, { rmsThreshold: 0.012 });
        if (yin.frequency && yin.clarity > 0.78) {
          capturedRef.current.push(yin.frequency);
          if (capturedRef.current.length % 4 === 0) {
            setCapturedFreqs([...capturedRef.current]);
          }
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);

      let left = 6;
      countdownRef.current = window.setInterval(() => {
        left -= 1;
        setSecondsLeft(Math.max(0, left));
        if (left <= 0) {
          finishAndEvaluate();
        }
      }, 1000);
    } catch (err) {
      setMicErrorFa(
        err instanceof Error
          ? err.message
          : 'دسترسی میکروفون صادر نشد؛ از صفحه‌کلید گام زیر برای پاسخ تعاملی استفاده کنید.'
      );
    }
  };

  const handleTapScaleNote = (note: PersianNoteSpec) => {
    playPersianNote(note, {
      instrument,
      durationSec: 0.65,
      a4Hz,
      koronMode,
      scale: gusheh.scale,
    });
    const hz = noteToFrequency(note, a4Hz, koronMode);
    // Append 3 frames per tapped note so keyboard improvisation evaluates smoothly
    capturedRef.current.push(hz, hz, hz);
    setCapturedFreqs([...capturedRef.current]);
    setTappedNotesFa((prev) => [...prev.slice(-11), formatNoteFa(note, false)]);
    if (phase === 'idle' || phase === 'evaluated') {
      setPhase('listening');
      setEvaluation(null);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            تمرین «سؤال و جواب» و بداهه‌نوازی هدایت‌شده
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            اپ جمله سؤال را با {INSTRUMENT_LABELS_FA[instrument]} و زینت‌های اصیل می‌نوازد؛ شما با ساز یا آواز (یا کلیدهای گام) پاسخ دهید و امتیاز وفاداری به دستگاه بگیرید.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            stopAll();
            setRoundIdx((r) => r + 1);
            setPhase('idle');
            setEvaluation(null);
            capturedRef.current = [];
            setCapturedFreqs([]);
            setTappedNotesFa([]);
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          جمله سؤال بعدی
        </button>
      </div>

      {/* Call phrase visual card */}
      <div className="rounded-xl border border-teal-500/25 bg-teal-950/20 p-3 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold text-teal-300">{callPhrase.labelFa}</span>
          <span className="text-[11px] text-amber-300">{callPhrase.promptHintFa}</span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {callPhrase.notes.map((n, idx) => (
            <span
              key={idx}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                activeCallNoteIdx === idx
                  ? 'bg-amber-500 text-slate-950 border-amber-300 scale-105'
                  : 'bg-slate-900/80 text-slate-200 border-slate-700'
              }`}
            >
              {formatNoteFa(n, true)}
            </span>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={phase === 'calling' ? () => { stopAll(); setPhase('idle'); } : handlePlayCall}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white cursor-pointer"
          >
            {phase === 'calling' ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {phase === 'calling' ? 'توقف سؤال' : '۱. شنیدن جمله سؤال'}
          </button>

          <button
            type="button"
            onClick={phase === 'listening' ? finishAndEvaluate : handleStartListening}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer ${
              phase === 'listening'
                ? 'bg-rose-600 hover:bg-rose-500 text-white'
                : 'bg-amber-600 hover:bg-amber-500 text-white'
            }`}
          >
            {phase === 'listening' ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            {phase === 'listening'
              ? `پایان و امتیازدهی (${toPersianDigits(secondsLeft)} ثانیه)`
              : '۲. ضبط پاسخ بداهه با میکروفون'}
          </button>

          {capturedFreqs.length >= 3 && phase !== 'evaluated' && (
            <button
              type="button"
              onClick={finishAndEvaluate}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
            >
              <Award className="w-3.5 h-3.5" />
              ارزیابی پاسخ فعلی
            </button>
          )}
        </div>
      </div>

      {micErrorFa && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/25 px-3 py-2 text-xs text-amber-200">
          {micErrorFa}
        </div>
      )}

      {/* Interactive Modal Scale Tap Pad (works 100% offline even without mic!) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <Music2 className="w-3.5 h-3.5 text-teal-400" />
            صفحه‌کلید پاسخ سریع در گام {gusheh.nameFa} (بدون نیاز به میکروفون):
          </span>
          <span>
            {toPersianDigits(capturedFreqs.length)} فریم ثبت‌شده
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {gusheh.scale.map((n, idx) => {
            const isShahed =
              n.letter === gusheh.shahed.letter && n.accidental === gusheh.shahed.accidental;
            const isIst =
              n.letter === gusheh.ist.letter && n.accidental === gusheh.ist.accidental;
            return (
              <button
                key={`${n.letter}_${n.accidental}_${n.octave}_${idx}`}
                type="button"
                onClick={() => handleTapScaleNote(n)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border transition cursor-pointer ${
                  isShahed
                    ? 'bg-amber-500/20 border-amber-400/60 text-amber-200 hover:bg-amber-500/30'
                    : isIst
                    ? 'bg-teal-500/20 border-teal-400/60 text-teal-200 hover:bg-teal-500/30'
                    : 'bg-slate-800/90 border-slate-700 text-slate-200 hover:bg-slate-700'
                }`}
              >
                {formatNoteFa(n, false)}
                {isShahed ? ' ★' : isIst ? ' ◎' : ''}
              </button>
            );
          })}
        </div>
        {tappedNotesFa.length > 0 && (
          <div className="text-[11px] text-slate-300 pt-1">
            پاسخ نواخته‌شده: <span className="text-teal-300">{tappedNotesFa.join(' ← ')}</span>
          </div>
        )}
      </div>

      {/* Evaluation Scorecard */}
      {evaluation && (
        <div className="rounded-xl border border-emerald-500/30 bg-slate-950/75 p-3.5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-400" />
              <span className="text-sm font-bold text-slate-100">
                امتیاز بداهه‌نوازی: {toPersianDigits(evaluation.overallScore)} از ۱۰۰
              </span>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
              +{toPersianDigits(evaluation.xpAwarded)} XP
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            {[
              { label: 'وفاداری به گام ربع‌پرده', val: evaluation.scaleAdherencePercent, color: 'text-teal-300' },
              { label: 'تأکید بر نت شاهد', val: evaluation.shahedEmphasisPercent, color: 'text-amber-300' },
              { label: 'فرود روی نت ایست', val: evaluation.foroudCadencePercent, color: 'text-emerald-300' },
              { label: 'تنوع ملودیک', val: evaluation.melodicRichnessPercent, color: 'text-sky-300' },
            ].map((item) => (
              <div key={item.label} className="rounded-lg bg-slate-900 border border-slate-800 p-2">
                <div className={`text-base font-extrabold ${item.color}`}>
                  {toPersianDigits(item.val)}٪
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">{item.label}</div>
              </div>
            ))}
          </div>

          <p className="text-xs text-slate-200 leading-relaxed">{evaluation.masterFeedbackFa}</p>
        </div>
      )}
    </div>
  );
};
