import React from 'react';
import { formatNoteFa, isSamePitchClass, noteToStaffStep } from '../data/musicTheory';
import type { Gusheh, MelodyNote } from '../types/music';
import { ORNAMENT_LABELS_FA, toPersianDigits } from '../utils/persian';

interface PersianStaffNotationProps {
  gusheh: Gusheh;
  activeNoteIndex: number | null;
  loopStart: number;
  loopEnd: number;
  onSelectNote?: (index: number, note: MelodyNote) => void;
  onSetLoopStart?: (index: number) => void;
  onSetLoopEnd?: (index: number) => void;
}

/**
 * Renders genuine Persian musical staff notation with custom vector glyphs for
 * Koron (کُرُن — slashed reversed half-flat) and Sori (سُری — chevron half-sharp),
 * A-B loop brackets, shahed/ist indicators, and ornament tags.
 */
export const PersianStaffNotation: React.FC<PersianStaffNotationProps> = ({
  gusheh,
  activeNoteIndex,
  loopStart,
  loopEnd,
  onSelectNote,
  onSetLoopStart,
  onSetLoopEnd,
}) => {
  const notes = gusheh.melody;
  const noteSpacing = 62;
  const leftPad = 64;
  const rightPad = 28;
  const width = Math.max(560, leftPad + notes.length * noteSpacing + rightPad);
  const height = 176;

  // Treble staff lines: E4 (step 2), G4 (4), B4 (6), D5 (8), F5 (10)
  // Step 10 (F5) at y = 44, each diatonic step = 7px downwards
  const stepToY = (step: number) => 44 + (10 - step) * 7;
  const staffLineSteps = [10, 8, 6, 4, 2];

  const renderAccidentalGlyph = (acc: MelodyNote['accidental'], x: number, y: number, color: string) => {
    if (acc === 'natural') return null;
    if (acc === 'koron') {
      // Authentic Persian Koron glyph: vertical stem with left-pointing triangular/p loop and slash
      return (
        <g transform={`translate(${x - 16}, ${y})`} stroke={color} fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <line x1="2" y1="-12" x2="2" y2="8" />
          <path d="M 2,-4 L -5,0 L 2,4" fill={color} fillOpacity="0.2" />
          <line x1="-5" y1="-7" x2="6" y2="-1" />
        </g>
      );
    }
    if (acc === 'sori') {
      // Authentic Persian Sori glyph: double-crossed chevron half-sharp
      return (
        <g transform={`translate(${x - 16}, ${y})`} stroke={color} fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M -4,-7 L 4,0 L -4,7" />
          <line x1="0" y1="-9" x2="0" y2="9" />
          <line x1="-5" y1="-3" x2="5" y2="-3" />
          <line x1="-5" y1="3" x2="5" y2="3" />
        </g>
      );
    }
    if (acc === 'flat') {
      return (
        <text x={x - 18} y={y + 5} fill={color} fontSize="17" fontWeight="700">
          ♭
        </text>
      );
    }
    return (
      <text x={x - 18} y={y + 5} fill={color} fontSize="16" fontWeight="700">
        ♯
      </text>
    );
  };

  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-slate-200/80 bg-white/90 p-3 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/85">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-teal-700 dark:text-teal-300">
            خط حامل ایرانی (با علائم کُرُن و سُری)
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-700 dark:text-amber-300">
            شاهد: {formatNoteFa(gusheh.shahed)}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-700 dark:text-emerald-300">
            ایست: {formatNoteFa(gusheh.ist)}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
          <span>حلقه A–B: نت {toPersianDigits(loopStart + 1)} تا {toPersianDigits(loopEnd + 1)}</span>
          <span>•</span>
          <span>کلیک روی هر نت برای پخش</span>
        </div>
      </div>

      {/* Musical notation reads left-to-right universally, even inside RTL UI */}
      <div dir="ltr" className="min-w-[540px]">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-[176px] w-full select-none"
          role="img"
          aria-label={`خط حامل گوشه ${gusheh.nameFa}`}
        >
          {/* Loop A-B highlight band */}
          <rect
            x={leftPad + loopStart * noteSpacing - 24}
            y={18}
            width={(loopEnd - loopStart + 1) * noteSpacing - 14}
            height={132}
            rx={12}
            className="fill-teal-500/10 stroke-teal-500/40"
            strokeDasharray="5 4"
            strokeWidth="1.5"
          />
          <text
            x={leftPad + loopStart * noteSpacing - 18}
            y={31}
            className="fill-teal-600 text-[10px] font-bold dark:fill-teal-300"
          >
            A
          </text>
          <text
            x={leftPad + loopEnd * noteSpacing + 14}
            y={31}
            className="fill-teal-600 text-[10px] font-bold dark:fill-teal-300"
          >
            B
          </text>

          {/* 5 Staff lines */}
          {staffLineSteps.map((step) => {
            const y = stepToY(step);
            return (
              <line
                key={step}
                x1={16}
                y1={y}
                x2={width - 16}
                y2={y}
                className="stroke-slate-300 dark:stroke-slate-600"
                strokeWidth="1.2"
              />
            );
          })}

          {/* Stylized Treble Clef */}
          <text
            x={22}
            y={94}
            fontSize="58"
            className="fill-slate-700 dark:fill-slate-300"
            style={{ fontFamily: 'serif' }}
          >
            𝄞
          </text>

          {/* Notes */}
          {notes.map((note, idx) => {
            const x = leftPad + idx * noteSpacing;
            const step = noteToStaffStep(note);
            const y = stepToY(step);
            const isActive = activeNoteIndex === idx;
            const isShahed = isSamePitchClass(note, gusheh.shahed);
            const isIst = isSamePitchClass(note, gusheh.ist) && idx === notes.length - 1;
            const inLoop = idx >= loopStart && idx <= loopEnd;

            const fillColor = isActive
              ? '#14b8a6'
              : isIst
              ? '#10b981'
              : isShahed
              ? '#f59e0b'
              : inLoop
              ? '#0f766e'
              : '#64748b';

            // Ledger lines above F5 (step >= 12) or below E4 (step <= 0)
            const ledgerLines: number[] = [];
            if (step <= 0) {
              for (let s = 0; s >= step; s -= 2) ledgerLines.push(s);
            }
            if (step >= 12) {
              for (let s = 12; s <= step; s += 2) ledgerLines.push(s);
            }

            const stemUp = step < 6;

            return (
              <g
                key={`${idx}-${note.letter}-${note.octave}`}
                className="cursor-pointer transition-opacity hover:opacity-100"
                onClick={() => onSelectNote?.(idx, note)}
              >
                {/* Ledger lines */}
                {ledgerLines.map((ls) => (
                  <line
                    key={ls}
                    x1={x - 13}
                    y1={stepToY(ls)}
                    x2={x + 13}
                    y2={stepToY(ls)}
                    className="stroke-slate-400 dark:stroke-slate-500"
                    strokeWidth="1.3"
                  />
                ))}

                {/* Active halo */}
                {isActive && (
                  <circle cx={x} cy={y} r={14} fill="#14b8a6" fillOpacity="0.22" />
                )}

                {/* Persian Accidental */}
                {renderAccidentalGlyph(note.accidental, x, y, fillColor)}

                {/* Stem */}
                <line
                  x1={stemUp ? x + 6.5 : x - 6.5}
                  y1={y}
                  x2={stemUp ? x + 6.5 : x - 6.5}
                  y2={stemUp ? y - 32 : y + 32}
                  stroke={fillColor}
                  strokeWidth="1.8"
                />

                {/* Notehead */}
                <ellipse
                  cx={x}
                  cy={y}
                  rx={7.2}
                  ry={5.3}
                  transform={`rotate(-18 ${x} ${y})`}
                  fill={note.durationBeats >= 1.5 ? 'none' : fillColor}
                  stroke={fillColor}
                  strokeWidth="2.1"
                />

                {/* Ornament badge above staff */}
                {note.ornament && (
                  <text
                    x={x}
                    y={15}
                    textAnchor="middle"
                    className="fill-amber-600 text-[9px] font-bold dark:fill-amber-300"
                  >
                    {ORNAMENT_LABELS_FA[note.ornament]}
                  </text>
                )}

                {/* Persian Note Name below staff */}
                <text
                  x={x}
                  y={144}
                  textAnchor="middle"
                  className={`text-[10px] font-medium ${
                    isActive
                      ? 'fill-teal-600 font-bold dark:fill-teal-300'
                      : 'fill-slate-600 dark:fill-slate-300'
                  }`}
                >
                  {formatNoteFa(note)}
                </text>

                {/* Quick A/B clickable tags */}
                <text
                  x={x}
                  y={162}
                  textAnchor="middle"
                  className="fill-slate-400 text-[9px]"
                >
                  {toPersianDigits(idx + 1)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Smart A-B Loop Range Sliders */}
      {onSetLoopStart && onSetLoopEnd && notes.length > 2 && (
        <div className="mt-2 flex flex-wrap items-center gap-4 border-t border-slate-200/70 pt-2 text-xs dark:border-slate-800">
          <label className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
            <span>نقطه شروع (A):</span>
            <select
              value={loopStart}
              onChange={(e) => {
                const v = Number(e.target.value);
                onSetLoopStart(v);
                if (v > loopEnd) onSetLoopEnd(v);
              }}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
            >
              {notes.map((n, i) => (
                <option key={i} value={i}>
                  نت {toPersianDigits(i + 1)} ({formatNoteFa(n)})
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
            <span>نقطه پایان (B):</span>
            <select
              value={loopEnd}
              onChange={(e) => {
                const v = Number(e.target.value);
                onSetLoopEnd(v);
                if (v < loopStart) onSetLoopStart(v);
              }}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
            >
              {notes.map((n, i) => (
                <option key={i} value={i} disabled={i < loopStart}>
                  نت {toPersianDigits(i + 1)} ({formatNoteFa(n)})
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  );
};
