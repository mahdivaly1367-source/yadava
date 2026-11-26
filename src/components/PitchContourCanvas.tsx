import React, { useEffect, useRef } from 'react';
import { Activity } from 'lucide-react';
import {
  formatNoteShort,
  isSamePitchClass,
  noteToCentsFromC0,
} from '../data/musicTheory';
import type {
  Gusheh,
  KoronMode,
  PersianNoteSpec,
  PitchAnalysisFrame,
} from '../types/music';

export interface PitchContourSample {
  timestampMs: number;
  centsFromC0: number | null;
  centsOffset: number;
  tahrir: boolean;
}

interface PitchContourCanvasProps {
  gusheh: Gusheh;
  a4Hz: number;
  koronMode: KoronMode;
  pitchFrame: PitchAnalysisFrame;
  micActive: boolean;
  externalFreqHz?: number | null; // e.g., from Web MIDI input!
  activeNoteIndex: number | null;
}

const WINDOW_MS = 8500;

export const PitchContourCanvas: React.FC<PitchContourCanvasProps> = ({
  gusheh,
  a4Hz,
  koronMode,
  pitchFrame,
  micActive,
  externalFreqHz,
  activeNoteIndex,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const samplesRef = useRef<PitchContourSample[]>([]);
  const lastPushRef = useRef<number>(0);

  // Append incoming mic or MIDI pitch sample
  useEffect(() => {
    const now = performance.now();
    if (now - lastPushRef.current < 32) return;
    lastPushRef.current = now;

    const freq = externalFreqHz ?? (micActive ? pitchFrame.frequency : null);
    let centsFromC0: number | null = null;
    if (freq && Number.isFinite(freq) && freq > 45) {
      const a4Cents = 4 * 1200 + 900;
      centsFromC0 = a4Cents + 1200 * Math.log2(freq / a4Hz);
    }

    samplesRef.current.push({
      timestampMs: now,
      centsFromC0,
      centsOffset: externalFreqHz ? 0 : pitchFrame.centsOffset,
      tahrir: pitchFrame.tahrirDetected,
    });

    const cutoff = now - WINDOW_MS - 400;
    while (samplesRef.current.length > 0 && samplesRef.current[0].timestampMs < cutoff) {
      samplesRef.current.shift();
    }
  }, [a4Hz, externalFreqHz, micActive, pitchFrame]);

  // Draw scrolling microtonal piano-roll contour
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const cssW = canvas.clientWidth || 720;
    const cssH = 210;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Background
    ctx.fillStyle = '#090f1d';
    ctx.fillRect(0, 0, cssW, cssH);

    // Determine visible cents range centered around gusheh melody/scale
    const refNotes: PersianNoteSpec[] = [...gusheh.scale, ...gusheh.melody];
    const refCents = refNotes.map((n) => noteToCentsFromC0(n, koronMode));
    const minCents = Math.min(...refCents) - 180;
    const maxCents = Math.max(...refCents) + 180;
    const span = Math.max(600, maxCents - minCents);

    const padLeft = 58;
    const padRight = 14;
    const padTop = 14;
    const padBottom = 18;
    const plotW = cssW - padLeft - padRight;
    const plotH = cssH - padTop - padBottom;

    const yForCents = (c: number) => padTop + plotH * (1 - (c - minCents) / span);

    // 1. Horizontal microtonal Persian scale degree guide lines
    const uniqueScale = gusheh.scale.filter(
      (n, i, arr) =>
        arr.findIndex(
          (o) => o.letter === n.letter && o.accidental === n.accidental && o.octave === n.octave
        ) === i
    );

    uniqueScale.forEach((n) => {
      const c = noteToCentsFromC0(n, koronMode);
      const y = yForCents(c);
      if (y < padTop || y > cssH - padBottom) return;

      const isShahed = isSamePitchClass(n, gusheh.shahed);
      const isIst = isSamePitchClass(n, gusheh.ist);
      const isMicro = n.accidental === 'koron' || n.accidental === 'sori';

      ctx.strokeStyle = isShahed
        ? 'rgba(245, 158, 11, 0.5)'
        : isIst
        ? 'rgba(16, 185, 129, 0.45)'
        : isMicro
        ? 'rgba(45, 212, 191, 0.28)'
        : 'rgba(148, 163, 184, 0.16)';
      ctx.lineWidth = isShahed || isIst ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(cssW - padRight, y);
      ctx.stroke();

      ctx.fillStyle = isShahed
        ? '#fbbf24'
        : isIst
        ? '#34d399'
        : isMicro
        ? '#5eead4'
        : '#94a3b8';
      ctx.font = 'bold 10px Vazirmatn, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(formatNoteShort(n), padLeft - 6, y + 3);
    });

    // 2. Ghost reference contour of the Gusheh melody across plot width
    if (gusheh.melody.length > 1) {
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.26)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      gusheh.melody.forEach((m, idx) => {
        const x = padLeft + (idx / (gusheh.melody.length - 1)) * plotW;
        const y = yForCents(noteToCentsFromC0(m, koronMode));
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.setLineDash([]);

      // Highlight active melody target dot
      if (activeNoteIndex !== null && gusheh.melody[activeNoteIndex]) {
        const m = gusheh.melody[activeNoteIndex];
        const x = padLeft + (activeNoteIndex / (gusheh.melody.length - 1)) * plotW;
        const y = yForCents(noteToCentsFromC0(m, koronMode));
        ctx.fillStyle = 'rgba(245, 158, 11, 0.9)';
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 3. Live scrolling pitch trail (last 8.5s) color-coded by cent accuracy
    const now = performance.now();
    const samples = samplesRef.current;
    let prevX: number | null = null;
    let prevY: number | null = null;

    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      if (s.centsFromC0 === null) {
        prevX = null;
        prevY = null;
        continue;
      }

      // Octave-fold into visible band if singer is an octave lower/higher so contour stays clearly legible
      let c = s.centsFromC0;
      while (c < minCents + 60 && c + 1200 <= maxCents) c += 1200;
      while (c > maxCents - 60 && c - 1200 >= minCents) c -= 1200;

      const ageMs = now - s.timestampMs;
      const x = padLeft + plotW * (1 - ageMs / WINDOW_MS);
      const y = Math.max(padTop, Math.min(cssH - padBottom, yForCents(c)));

      if (x < padLeft) continue;

      const absErr = Math.abs(s.centsOffset);
      const color =
        absErr <= 15 ? '#10b981' : absErr <= 32 ? '#f59e0b' : '#f43f5e';

      if (prevX !== null && prevY !== null && Math.abs(y - prevY) < 75) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(prevX, prevY);
        ctx.lineTo(x, y);
        ctx.stroke();
      }

      if (s.tahrir) {
        ctx.fillStyle = 'rgba(56, 189, 248, 0.85)';
        ctx.beginPath();
        ctx.arc(x, y, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }

      prevX = x;
      prevY = y;
    }
  }, [activeNoteIndex, gusheh, koronMode, micActive, pitchFrame, externalFreqHz]);

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-3.5 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/85">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-teal-500" />
          <h3 className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
            منحنی زنده زیر و بمی (Piano-Roll ربع‌پرده‌ای — ۸.۵ ثانیه اخیر)
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> دقیق (±۱۵¢)
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-400" /> خط مرجع گوشه
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-sky-400" /> نبض تحریر
          </span>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="h-[210px] w-full rounded-xl border border-slate-800"
        aria-label="گراف زمان‌محور منحنی زیر و بمی"
      />
    </div>
  );
};
