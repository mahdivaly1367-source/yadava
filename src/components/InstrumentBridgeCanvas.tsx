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
  const [viewInstrument, setViewInstrument] = useState<
    'tar_setar' | 'santur' | 'kamancheh' | 'ney'
  >(
    instrument === 'santur'
      ? 'santur'
      : instrument === 'ney'
      ? 'ney'
      : 'tar_setar'
  );
  const [lastClickedLabel, setLastClickedLabel] = useState<string>('');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (instrument === 'santur') setViewInstrument('santur');
    else if (instrument === 'ney') setViewInstrument('ney');
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

  // Kamancheh 4-string standard Persian tuning (Mi4, La3, Re3, Sol2 or Re4/La3/Re3/Sol2)
  const kamanchehStrings: Array<{ labelFa: string; openNote: PersianNoteSpec }> = useMemo(
    () => [
      { labelFa: 'سیم ۱ (می زیر)', openNote: { letter: 'E', accidental: 'natural', octave: 4 } },
      { labelFa: 'سیم ۲ (لا)', openNote: { letter: 'A', accidental: 'natural', octave: 3 } },
      { labelFa: 'سیم ۳ (ر)', openNote: { letter: 'D', accidental: 'natural', octave: 3 } },
      { labelFa: 'سیم ۴ (سُل بم)', openNote: { letter: 'G', accidental: 'natural', octave: 2 } },
    ],
    []
  );

  // Authentic 7-Band Iranian Ney 6+1 fingering table (5 front holes + 1 thumb hole on back)
  // 1 = closed, 0.5 = half-hole (quarter-tone Koron/Sori), 0 = open
  const neyFingerings: Array<{
    note: PersianNoteSpec;
    registerFa: 'بم' | 'اوج' | 'غیث';
    frontHoles: number[]; // top to bottom (5 front holes)
    thumbHole: number;    // back thumb hole
  }> = useMemo(
    () => [
      { note: { letter: 'C', accidental: 'natural', octave: 4 }, registerFa: 'بم', frontHoles: [1, 1, 1, 1, 1], thumbHole: 1 },
      { note: { letter: 'D', accidental: 'natural', octave: 4 }, registerFa: 'بم', frontHoles: [1, 1, 1, 1, 0], thumbHole: 1 },
      { note: { letter: 'E', accidental: 'koron', octave: 4 }, registerFa: 'بم', frontHoles: [1, 1, 1, 0.5, 0], thumbHole: 1 },
      { note: { letter: 'E', accidental: 'flat', octave: 4 }, registerFa: 'بم', frontHoles: [1, 1, 1, 0, 0], thumbHole: 1 },
      { note: { letter: 'F', accidental: 'natural', octave: 4 }, registerFa: 'بم', frontHoles: [1, 1, 0, 0, 0], thumbHole: 1 },
      { note: { letter: 'G', accidental: 'natural', octave: 4 }, registerFa: 'اوج', frontHoles: [1, 0, 0, 0, 0], thumbHole: 1 },
      { note: { letter: 'A', accidental: 'koron', octave: 4 }, registerFa: 'اوج', frontHoles: [0.5, 0, 0, 0, 0], thumbHole: 1 },
      { note: { letter: 'A', accidental: 'flat', octave: 4 }, registerFa: 'اوج', frontHoles: [0, 0, 0, 0, 0], thumbHole: 1 },
      { note: { letter: 'B', accidental: 'natural', octave: 4 }, registerFa: 'اوج', frontHoles: [0, 0, 0, 0, 0], thumbHole: 0 },
      { note: { letter: 'C', accidental: 'natural', octave: 5 }, registerFa: 'غیث', frontHoles: [1, 1, 1, 1, 1], thumbHole: 0.5 },
    ],
    []
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
              : viewInstrument === 'santur'
              ? '۲۷ خرک سنتور (۹ زرد، ۹ سفید، ۹ پشت‌خرک) متناسب با کوک دستگاه فعال'
              : viewInstrument === 'kamancheh'
              ? 'دسته بدون پرده ۴ سیم کمانچه با نقاط انگشت‌گذاری میلی‌متری کُرُن و سُری'
              : 'نقشه انگشت‌گذاری نی هفت‌بند (۵ سوراخ جلو + ۱ سوراخ شست پشت و نیم‌سوراخ کُرُن)'}
          </p>
        </div>
        <div className="inline-flex flex-wrap rounded-xl bg-slate-100 p-1 text-xs dark:bg-slate-800">
          {(
            [
              { id: 'tar_setar', label: 'تار / سه‌تار', activeCls: 'bg-teal-600 text-white' },
              { id: 'santur', label: 'سنتور (۲۷ خرک)', activeCls: 'bg-amber-600 text-white' },
              { id: 'kamancheh', label: 'کمانچه (۴ سیم)', activeCls: 'bg-indigo-600 text-white' },
              { id: 'ney', label: 'نی هفت‌بند', activeCls: 'bg-emerald-600 text-white' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setViewInstrument(tab.id)}
              className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                viewInstrument === tab.id
                  ? `${tab.activeCls} shadow-sm`
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
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
      ) : viewInstrument === 'kamancheh' ? (
        <div className="space-y-2 rounded-xl bg-gradient-to-b from-slate-900 to-stone-950 p-3.5 text-white">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300">
            <span>دسته بدون پرده کمانچه — پوزیشن اول (روی هر نقطه انگشت کلیک کنید)</span>
            <span className="text-teal-300">نقطه فیروزه‌ای: ربع‌پرده کُرُن/سُری • نارنجی: شاهد</span>
          </div>
          <div className="space-y-2" dir="ltr">
            {kamanchehStrings.map((ks) => {
              const openCents = noteToCentsFromC0(ks.openNote, koronMode);
              const positionsCents = [0, 100, 150, 200, 300, 350, 400, 500, 550, 600, 700];
              return (
                <div
                  key={ks.labelFa}
                  className="relative flex items-center gap-2 rounded-lg bg-amber-950/45 px-2.5 py-2"
                >
                  <span
                    dir="rtl"
                    className="w-24 shrink-0 text-right text-[11px] font-bold text-amber-200"
                  >
                    {ks.labelFa}
                  </span>
                  <div className="relative flex flex-1 items-center justify-between">
                    <div className="pointer-events-none absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-gradient-to-l from-amber-300/70 to-slate-200/80" />
                    {positionsCents.map((offsetC) => {
                      const totalC = openCents + offsetC;
                      const freq =
                        a4Hz * Math.pow(2, (totalC - (4 * 1200 + 900)) / 1200);
                      const matched = frequencyToPersianNote(
                        freq,
                        a4Hz,
                        koronMode,
                        gusheh.scale
                      );
                      const isActive =
                        activeNote !== null &&
                        Math.abs(totalC - noteToCentsFromC0(activeNote, koronMode)) < 25;
                      const inScale = gusheh.scale.some((s) =>
                        isSamePitchClass(s, matched.note)
                      );
                      const isShahed = isSamePitchClass(gusheh.shahed, matched.note);
                      const isMicro = offsetC % 100 !== 0;

                      return (
                        <button
                          key={offsetC}
                          type="button"
                          onClick={() => {
                            playPersianNote(matched.note, {
                              instrument: 'ney',
                              durationSec: 1.15,
                              a4Hz,
                              koronMode,
                            });
                            setLastClickedLabel(
                              `کمانچه (${ks.labelFa}) ← ${formatNoteFa(matched.note, true)} (${Math.round(
                                freq
                              )} Hz)`
                            );
                          }}
                          title={formatNoteFa(matched.note, true)}
                          className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full border text-[9px] font-bold transition hover:scale-110 ${
                            isActive
                              ? 'border-white bg-teal-400 text-slate-950 shadow-lg shadow-teal-400/50'
                              : isShahed
                              ? 'border-amber-200 bg-amber-500 text-slate-950'
                              : isMicro && inScale
                              ? 'border-teal-300 bg-teal-600/85 text-white'
                              : inScale
                              ? 'border-slate-300 bg-slate-700 text-white'
                              : 'border-white/10 bg-slate-900/75 text-slate-500 opacity-55 hover:opacity-100'
                          }`}
                        >
                          {formatNoteFa(matched.note).slice(0, 3)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : viewInstrument === 'ney' ? (
        <div className="rounded-xl bg-gradient-to-b from-emerald-950/90 to-slate-950 p-3.5 text-white">
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-emerald-200/90">
            <span>نی هفت‌بند ایرانی (۵ سوراخ جلو + ۱ سوراخ شست) — ● بسته • ◐ نیم‌بسته (کُرُن) • ○ باز</span>
            <span>روی هر نت کلیک کنید تا صدای نی سنتز شود</span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {neyFingerings.map((item, idx) => {
              const isActive =
                activeNote !== null && isSamePitchClass(item.note, activeNote);
              const inScale = gusheh.scale.some((s) =>
                isSamePitchClass(s, item.note)
              );
              const isShahed = isSamePitchClass(gusheh.shahed, item.note);

              return (
                <button
                  key={`${item.note.letter}-${item.note.accidental}-${idx}`}
                  type="button"
                  onClick={() => {
                    playPersianNote(item.note, {
                      instrument: 'ney',
                      durationSec: 1.25,
                      a4Hz,
                      koronMode,
                    });
                    setLastClickedLabel(
                      `نی هفت‌بند (${item.registerFa}) ← ${formatNoteFa(item.note, true)}`
                    );
                  }}
                  className={`flex flex-col items-center rounded-xl border p-2.5 transition hover:brightness-110 active:scale-95 ${
                    isActive
                      ? 'border-teal-300 bg-teal-500/30 ring-2 ring-teal-300'
                      : isShahed
                      ? 'border-amber-400 bg-amber-500/20'
                      : inScale
                      ? 'border-emerald-400/40 bg-white/10'
                      : 'border-white/10 bg-black/25 opacity-60 hover:opacity-100'
                  }`}
                >
                  <div className="text-xs font-extrabold text-white">
                    {formatNoteFa(item.note)}
                  </div>
                  <div className="text-[10px] text-emerald-300">منطقه {item.registerFa}</div>
                  {/* Bamboo Ney Tube + 5 Front Holes + Thumb Hole */}
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex flex-col items-center gap-1 rounded-full bg-amber-200/20 px-2 py-1.5 border border-amber-300/40">
                      {item.frontHoles.map((h, hIdx) => (
                        <span
                          key={hIdx}
                          className={`h-2.5 w-2.5 rounded-full border border-amber-200 ${
                            h === 1
                              ? 'bg-amber-300'
                              : h === 0.5
                              ? 'bg-gradient-to-r from-amber-300 via-amber-300 to-transparent'
                              : 'bg-transparent'
                          }`}
                        />
                      ))}
                    </div>
                    <div className="flex flex-col items-center text-[9px] text-slate-300">
                      <span>شست</span>
                      <span
                        className={`mt-0.5 h-3 w-3 rounded-full border border-teal-300 ${
                          item.thumbHole === 1
                            ? 'bg-teal-400'
                            : item.thumbHole === 0.5
                            ? 'bg-gradient-to-r from-teal-400 to-transparent'
                            : 'bg-transparent'
                        }`}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
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
