import React, { useEffect, useMemo, useRef, useState } from 'react';
import { playPersianNote } from '../audio/karplusStrong';
import {
  formatNoteFa,
  fretCentsToLinearRatio,
  frequencyToPersianNote,
  getRecommendedTuning,
  getSantur27Bridges,
  getTar24FretCents,
  isSamePitchClass,
  noteToCentsFromC0,
  noteToFrequency,
} from '../data/musicTheory';
import type {
  Gusheh,
  InstrumentId,
  KoronMode,
  PersianNoteSpec,
} from '../types/music';
import { toPersianDigits } from '../utils/persian';

interface InstrumentBridgeCanvasProps {
  gusheh: Gusheh;
  instrument: InstrumentId;
  activeNote: PersianNoteSpec | null;
  a4Hz: number;
  koronMode: KoronMode;
}

export const InstrumentBridgeCanvas: React.FC<InstrumentBridgeCanvasProps> = ({
  gusheh,
  instrument,
  activeNote,
  a4Hz,
  koronMode,
}) => {
  const [viewInstrument, setViewInstrument] = useState<'tar_setar' | 'santur'>(
    instrument === 'santur' ? 'santur' : 'tar_setar'
  );
  const [lastClickedLabel, setLastClickedLabel] = useState<string>('');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (instrument === 'santur') setViewInstrument('santur');
    else if (instrument === 'tar' || instrument === 'setar') setViewInstrument('tar_setar');
  }, [instrument]);

  const fretCents = useMemo(() => getTar24FretCents(koronMode), [koronMode]);
  const tuning = useMemo(
    () => getRecommendedTuning(gusheh.dastgahId, instrument === 'setar' ? 'setar' : 'tar'),
    [gusheh.dastgahId, instrument]
  );
  const santurBridges = useMemo(
    () => getSantur27Bridges(gusheh.dastgahId),
    [gusheh.dastgahId]
  );

  // Draw logarithmic 24-fret Tar/Setar neck on HTML5 Canvas
  useEffect(() => {
    if (viewInstrument !== 'tar_setar') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const width = 820;
    const height = 196;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Clear
    ctx.clearRect(0, 0, width, height);

    const nutX = 56;
    const neckEndX = width - 24;
    const neckSpan = neckEndX - nutX;
    const neckTop = 34;
    const neckHeight = 122;

    // Walnut wood fingerboard gradient
    const woodGrad = ctx.createLinearGradient(nutX, neckTop, nutX, neckTop + neckHeight);
    woodGrad.addColorStop(0, '#3b2414');
    woodGrad.addColorStop(0.5, '#52321c');
    woodGrad.addColorStop(1, '#311d10');
    ctx.fillStyle = woodGrad;
    ctx.beginPath();
    ctx.roundRect(nutX - 8, neckTop, neckSpan + 16, neckHeight, 10);
    ctx.fill();

    // Camel-bone decorative side binding
    ctx.strokeStyle = '#e7d5b8';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw Nut (شیطانک)
    ctx.fillStyle = '#f8ecd7';
    ctx.fillRect(nutX - 4, neckTop, 7, neckHeight);

    // Draw all 24 logarithmic pardeh frets (۲۴ پرده)
    for (let f = 1; f < fretCents.length; f++) {
      const c = fretCents[f];
      const ratio = fretCentsToLinearRatio(c, 1700);
      const x = nutX + ratio * neckSpan;
      const isMicrotonal = c % 100 !== 0;

      ctx.beginPath();
      ctx.moveTo(x, neckTop + 1);
      ctx.lineTo(x, neckTop + neckHeight - 1);
      ctx.strokeStyle = isMicrotonal ? '#2dd4bf' : '#d6b484';
      ctx.lineWidth = isMicrotonal ? 1.8 : 1.4;
      ctx.stroke();

      // Fret number label along top
      if (f <= 17 || f % 2 === 0) {
        ctx.fillStyle = isMicrotonal ? '#5eead4' : '#cbd5e1';
        ctx.font = '600 10px Vazirmatn, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(toPersianDigits(f), x, neckTop - 9);
      }
    }

    // Draw 4 courses/strings and highlight gusheh scale + shahed + active note
    const stringYs = [
      neckTop + 20,
      neckTop + 48,
      neckTop + 76,
      neckTop + 104,
    ];

    tuning.strings.forEach((st, sIdx) => {
      const y = stringYs[sIdx];
      const openCents = noteToCentsFromC0(st.note, koronMode);

      // String line
      ctx.beginPath();
      ctx.moveTo(nutX - 10, y);
      ctx.lineTo(neckEndX + 8, y);
      ctx.strokeStyle = sIdx === 1 ? '#fbbf24' : sIdx === 3 ? '#d97706' : '#e2e8f0';
      ctx.lineWidth = sIdx === 3 ? 2.4 : sIdx === 1 ? 1.8 : 1.3;
      ctx.stroke();

      // Open string label at left of nut
      ctx.fillStyle = '#f1f5f9';
      ctx.font = '600 10px Vazirmatn, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(formatNoteFa(st.note), nutX - 12, y + 3);

      // Evaluate each fret on this string (focus primary melody strings 0 & 1 for clean clarity, plus matching active note on all strings)
      for (let f = 0; f < fretCents.length; f++) {
        const totalCents = openCents + fretCents[f];
        const freq = a4Hz * Math.pow(2, (totalCents - (4 * 1200 + 900)) / 1200);
        const matched = frequencyToPersianNote(freq, a4Hz, koronMode, gusheh.scale);

        const isActive =
          activeNote !== null &&
          Math.abs(totalCents - noteToCentsFromC0(activeNote, koronMode)) < 22;
        const inScale = gusheh.scale.some((sc) => isSamePitchClass(sc, matched.note));
        const isShahed = isSamePitchClass(gusheh.shahed, matched.note);
        const isIst = isSamePitchClass(gusheh.ist, matched.note);

        if (!isActive && (!inScale || sIdx > 1)) continue;

        const prevRatio = f === 0 ? 0 : fretCentsToLinearRatio(fretCents[f - 1], 1700);
        const currRatio = fretCentsToLinearRatio(fretCents[f], 1700);
        const dotX = f === 0 ? nutX : nutX + ((prevRatio + currRatio) * 0.5) * neckSpan;

        ctx.beginPath();
        ctx.arc(dotX, y, isActive ? 9.5 : isShahed || isIst ? 6.5 : 4.5, 0, Math.PI * 2);
        ctx.fillStyle = isActive
          ? '#14b8a6'
          : isIst
          ? '#10b981'
          : isShahed
          ? '#f59e0b'
          : 'rgba(226, 232, 240, 0.78)';
        ctx.fill();

        if (isActive || isShahed) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.6;
          ctx.stroke();
        }
      }
    });

    // Footer legend on canvas
    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 10px Vazirmatn, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('پرده‌های فیروزه‌ای = ربع‌پرده (کُرُن/سُری)  |  نارنجی = شاهد  |  سبز = ایست', nutX, height - 10);
  }, [viewInstrument, fretCents, tuning, gusheh, activeNote, a4Hz, koronMode]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = 820 / rect.width;
    const scaleY = 196 / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    const nutX = 56;
    const neckSpan = 820 - 24 - nutX;
    const stringYs = [54, 82, 110, 138];

    // Find closest string
    let bestStringIdx = 0;
    let bestDy = Infinity;
    stringYs.forEach((sy, idx) => {
      const d = Math.abs(clickY - sy);
      if (d < bestDy) {
        bestDy = d;
        bestStringIdx = idx;
      }
    });

    // Find closest logarithmic fret
    let bestFretIdx = 0;
    let bestDx = Infinity;
    for (let f = 0; f < fretCents.length; f++) {
      const prevRatio = f === 0 ? 0 : fretCentsToLinearRatio(fretCents[f - 1], 1700);
      const currRatio = fretCentsToLinearRatio(fretCents[f], 1700);
      const fx = f === 0 ? nutX : nutX + ((prevRatio + currRatio) * 0.5) * neckSpan;
      const d = Math.abs(clickX - fx);
      if (d < bestDx) {
        bestDx = d;
        bestFretIdx = f;
      }
    }

    const st = tuning.strings[bestStringIdx];
    const totalCents = noteToCentsFromC0(st.note, koronMode) + fretCents[bestFretIdx];
    const freq = a4Hz * Math.pow(2, (totalCents - (4 * 1200 + 900)) / 1200);
    const matched = frequencyToPersianNote(freq, a4Hz, koronMode, gusheh.scale);

    playPersianNote(matched.note, {
      instrument: instrument === 'setar' ? 'setar' : 'tar',
      durationSec: 1.0,
      a4Hz,
      koronMode,
    });
    setLastClickedLabel(
      `پرده ${toPersianDigits(bestFretIdx)} (${st.labelFa}) ← ${formatNoteFa(matched.note, true)} (${Math.round(
        noteToFrequency(matched.note, a4Hz, koronMode)
      )} Hz)`
    );
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/85">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
            پل بصری تئوری ↔ اجرای فیزیکی
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {viewInstrument === 'tar_setar'
              ? 'دسته لگاریتمی ۲۴ پرده‌ای تار و سه‌تار — روی هر پرده کلیک کنید تا بنوازد'
              : '۲۷ خرک سنتور (۹ زرد، ۹ سفید، ۹ پشت‌خرک) متناسب با کوک دستگاه فعال'}
          </p>
        </div>
        <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setViewInstrument('tar_setar')}
            className={`rounded-lg px-3 py-1 font-semibold transition ${
              viewInstrument === 'tar_setar'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
            }`}
          >
            تار / سه‌تار (۲۴ پرده)
          </button>
          <button
            type="button"
            onClick={() => setViewInstrument('santur')}
            className={`rounded-lg px-3 py-1 font-semibold transition ${
              viewInstrument === 'santur'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
            }`}
          >
            سنتور (۲۷ خرک)
          </button>
        </div>
      </div>

      {viewInstrument === 'tar_setar' ? (
        <div className="overflow-x-auto" dir="ltr">
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            className="h-[196px] w-full min-w-[640px] cursor-pointer rounded-xl bg-slate-950/95"
          />
        </div>
      ) : (
        <div className="space-y-2.5 rounded-xl bg-gradient-to-b from-amber-950/90 to-stone-950 p-3 text-white">
          {(
            [
              { key: 'posht', title: 'پشت‌خرک (۹ خرک زیر)', badge: 'bg-teal-500/25 text-teal-200' },
              { key: 'sefid', title: 'سیم‌های سفید (۹ خرک میانی)', badge: 'bg-slate-200/20 text-slate-100' },
              { key: 'zard', title: 'سیم‌های زرد (۹ خرک بم)', badge: 'bg-amber-500/25 text-amber-200' },
            ] as const
          ).map((row) => {
            const bridges = santurBridges.filter((b) => b.register === row.key);
            return (
              <div key={row.key} className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-amber-100/80">
                  <span>{row.title}</span>
                  <span>خرک ۱ تا ۹</span>
                </div>
                <div className="grid grid-cols-9 gap-1.5">
                  {bridges.map((bridge) => {
                    const isActive =
                      activeNote !== null &&
                      isSamePitchClass(bridge.note, activeNote) &&
                      bridge.note.octave === activeNote.octave;
                    const inScale = gusheh.scale.some((s) => isSamePitchClass(s, bridge.note));
                    const isShahed = isSamePitchClass(gusheh.shahed, bridge.note);

                    return (
                      <button
                        key={bridge.index}
                        type="button"
                        onClick={() => {
                          playPersianNote(bridge.note, {
                            instrument: 'santur',
                            durationSec: 1.25,
                            a4Hz,
                            koronMode,
                          });
                          setLastClickedLabel(
                            `خرک ${toPersianDigits(bridge.index)} (${row.title}) ← ${formatNoteFa(
                              bridge.note,
                              true
                            )}`
                          );
                        }}
                        className={`flex flex-col items-center justify-center rounded-lg border py-1.5 text-center transition active:scale-95 ${
                          isActive
                            ? 'border-teal-300 bg-teal-500 text-slate-950 shadow-md shadow-teal-500/40'
                            : isShahed
                            ? 'border-amber-400 bg-amber-500/30 text-amber-100 hover:bg-amber-500/45'
                            : inScale
                            ? 'border-amber-200/35 bg-white/10 text-white hover:bg-white/20'
                            : 'border-white/10 bg-black/25 text-slate-400 hover:bg-white/10'
                        }`}
                      >
                        <span className="text-[11px] font-bold">{bridge.labelFa}</span>
                        <span className="text-[9px] opacity-75">
                          {toPersianDigits(bridge.bridgeNumberInRegister)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {lastClickedLabel && (
        <div className="mt-2 rounded-lg bg-teal-500/10 px-3 py-1.5 text-xs font-medium text-teal-700 dark:text-teal-300">
          اجرای مستقیم: {lastClickedLabel}
        </div>
      )}
    </div>
  );
};
