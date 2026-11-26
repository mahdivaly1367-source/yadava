import { buildMelodyFingeringGuide } from '../core/fingeringGuide';
import { alignPoetryToGusheh } from '../core/prosodySyllables';
import {
  formatNoteFa,
  getRecommendedTuning,
  noteToStaffStep,
} from '../data/musicTheory';
import { SYSTEM_BY_ID } from '../data/radifData';
import type { Gusheh, InstrumentId, KoronMode } from '../types/music';
import {
  INSTRUMENT_LABELS_FA,
  ORNAMENT_LABELS_FA,
  toPersianDigits,
} from './persian';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function accidentalGlyph(acc: string): string {
  if (acc === 'koron') return '𝄳';
  if (acc === 'sori') return '𝄲';
  if (acc === 'flat') return '♭';
  if (acc === 'sharp') return '♯';
  return '';
}

/**
 * Generates a print-ready A4 Persian Sheet Music HTML document (جزوه چاپی / PDF نت ایرانی)
 * with embedded vector microtonal staff, Tar/Setar fingering table, instrument tuning,
 * prosody-aligned Persian poetry syllables, and Teacher Notes box.
 */
export function generatePrintableSheetHtml(options: {
  gusheh: Gusheh;
  instrument: InstrumentId;
  koronMode: KoronMode;
  a4Hz: number;
  teacherNoteFa?: string;
}): string {
  const { gusheh, instrument, koronMode, a4Hz, teacherNoteFa } = options;
  const dastgahName = SYSTEM_BY_ID[gusheh.dastgahId]?.nameFa ?? gusheh.dastgahId;
  const tuning = getRecommendedTuning(gusheh.dastgahId, instrument);
  const fingering = buildMelodyFingeringGuide(gusheh.melody);
  const prosody = alignPoetryToGusheh(gusheh);

  // Build crisp SVG microtonal staff (LTR musical coordinates inside RTL page)
  const noteSpacing = 62;
  const leftPad = 68;
  const svgW = Math.max(680, leftPad + gusheh.melody.length * noteSpacing + 36);
  const svgH = 195;
  const bottomLineY = 122; // E4 line
  const stepPx = 7;

  const staffLines = [0, 2, 4, 6, 8]
    .map(
      (s) =>
        `<line x1="20" y1="${bottomLineY - s * stepPx}" x2="${svgW - 18}" y2="${bottomLineY - s * stepPx}" stroke="#334155" stroke-width="1.1" />`
    )
    .join('\n');

  const notesSvg = gusheh.melody
    .map((n, idx) => {
      const x = leftPad + idx * noteSpacing;
      const stepFromE4 = noteToStaffStep(n) - 30; // E4 = 30
      const y = bottomLineY - stepFromE4 * stepPx;
      const glyph = accidentalGlyph(n.accidental);
      const isWhole = n.durationBeats >= 2;
      const isShahed =
        n.letter === gusheh.shahed.letter && n.accidental === gusheh.shahed.accidental;
      const fill = isWhole ? '#ffffff' : isShahed ? '#0f766e' : '#0f172a';
      const stroke = isShahed ? '#0f766e' : '#0f172a';
      const orn = n.ornament ? ORNAMENT_LABELS_FA[n.ornament] : '';
      const mezrab = idx % 2 === 0 ? '▼' : '▲';
      const syl = prosody.slots[idx]?.syllableFa ?? '';
      const f = fingering[idx];

      // Ledger line for C4 / A5 if needed
      let ledger = '';
      if (stepFromE4 <= -2) {
        ledger = `<line x1="${x - 13}" y1="${bottomLineY + 2 * stepPx}" x2="${x + 13}" y2="${bottomLineY + 2 * stepPx}" stroke="#334155" stroke-width="1.1" />`;
      } else if (stepFromE4 >= 10) {
        ledger = `<line x1="${x - 13}" y1="${bottomLineY - 10 * stepPx}" x2="${x + 13}" y2="${bottomLineY - 10 * stepPx}" stroke="#334155" stroke-width="1.1" />`;
      }

      return `
        ${ledger}
        ${glyph ? `<text x="${x - 17}" y="${y + 5}" font-size="16" font-weight="700" fill="#b45309">${glyph}</text>` : ''}
        <ellipse cx="${x}" cy="${y}" rx="6.5" ry="4.8" fill="${fill}" stroke="${stroke}" stroke-width="1.6" transform="rotate(-18 ${x} ${y})" />
        <line x1="${x + 6}" y1="${y}" x2="${x + 6}" y2="${y - 30}" stroke="${stroke}" stroke-width="1.4" />
        <text x="${x}" y="30" text-anchor="middle" font-size="10" fill="#0f766e" font-weight="700">${escapeHtml(orn)}</text>
        <text x="${x}" y="44" text-anchor="middle" font-size="10" fill="#475569">${mezrab}</text>
        <text x="${x}" y="156" text-anchor="middle" font-size="11" font-weight="700" fill="#0f172a">${escapeHtml(formatNoteFa(n))}</text>
        <text x="${x}" y="172" text-anchor="middle" font-size="10" fill="#0f766e">${escapeHtml(syl)}</text>
        <text x="${x}" y="187" text-anchor="middle" font-size="9" fill="#64748b">انگشت ${escapeHtml(f?.fingerCode ?? '۰')}</text>
      `;
    })
    .join('\n');

  const tuningRows = tuning.strings
    .map(
      (s) =>
        `<tr><td>${escapeHtml(s.labelFa)}</td><td><strong>${escapeHtml(formatNoteFa(s.note))}</strong></td></tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>برگه نت نوانگار — ${escapeHtml(gusheh.nameFa)}</title>
  <style>
    @page { size: A4 portrait; margin: 14mm; }
    body {
      font-family: 'Vazirmatn', 'Tahoma', system-ui, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 18px;
      line-height: 1.65;
    }
    .sheet { max-width: 794px; margin: 0 auto; }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2.5px solid #0d9488;
      padding-bottom: 10px;
      margin-bottom: 16px;
    }
    .brand { font-size: 12px; color: #0f766e; font-weight: 800; }
    h1 { margin: 2px 0; font-size: 22px; }
    .meta { display: flex; flex-wrap: wrap; gap: 10px; font-size: 12px; color: #334155; }
    .pill {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 3px 9px;
      font-weight: 700;
    }
    .staff-box {
      border: 1.5px solid #cbd5e1;
      border-radius: 12px;
      padding: 12px;
      margin: 14px 0;
      overflow-x: auto;
      direction: ltr;
      background: #fafafa;
    }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 14px; }
    .card {
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      padding: 11px;
      font-size: 12px;
    }
    .card h3 { margin: 0 0 8px; font-size: 13px; color: #0f766e; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    td, th { border-bottom: 1px solid #e2e8f0; padding: 4px 6px; text-align: right; }
    .notes-box {
      margin-top: 14px;
      border: 1.5px dashed #94a3b8;
      border-radius: 10px;
      padding: 12px;
      min-height: 78px;
      font-size: 12px;
    }
    .print-bar { text-align: left; margin-bottom: 10px; }
    .print-btn {
      background: #0d9488; color: #fff; border: 0; border-radius: 8px;
      padding: 7px 14px; font-weight: 700; cursor: pointer; font-family: inherit;
    }
    @media print { .print-bar { display: none; } body { padding: 0; } }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="print-bar">
      <button class="print-btn" onclick="window.print()">چاپ / ذخیره PDF (A4)</button>
    </div>
    <div class="header">
      <div>
        <div class="brand">نوانگار — جزوه آموزشی ردیف موسیقی اصیل ایرانی</div>
        <h1>${escapeHtml(gusheh.nameFa)} (${escapeHtml(dastgahName)})</h1>
      </div>
      <div class="meta">
        <span class="pill">ساز: ${escapeHtml(INSTRUMENT_LABELS_FA[instrument])}</span>
        <span class="pill">شاهد: ${escapeHtml(formatNoteFa(gusheh.shahed))}</span>
        <span class="pill">ایست: ${escapeHtml(formatNoteFa(gusheh.ist))}</span>
        <span class="pill">کُرُن: ${koronMode === 'traditional_56' ? 'سنتی (-۵۶¢)' : 'استاندارد (-۵۰¢)'}</span>
        <span class="pill">دیاپازون: ${toPersianDigits(a4Hz)}Hz</span>
      </div>
    </div>

    <div class="staff-box">
      <svg width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg">
        ${staffLines}
        <text x="26" y="114" font-size="44" fill="#0f172a">𝄞</text>
        ${notesSvg}
      </svg>
    </div>

    <div class="grid-2">
      <div class="card">
        <h3>جدول کوک پیشنهادی (${escapeHtml(tuning.titleFa)})</h3>
        <table>${tuningRows}</table>
      </div>
      <div class="card">
        <h3>شعر و عروض پیشنهادی (${escapeHtml(prosody.poetFa)})</h3>
        <p style="margin:0 0 6px; font-weight:700;">${escapeHtml(prosody.fullCoupletFa)}</p>
        <p style="margin:0; color:#475569;">وزن عروضی: ${escapeHtml(prosody.meterNameFa)} (${escapeHtml(prosody.aruzPatternFa)})</p>
      </div>
    </div>

    <div class="notes-box">
      <strong>یادداشت استاد / نکات تمرینی هنرجو:</strong>
      <p style="margin:6px 0 0; color:#334155;">${escapeHtml(teacherNoteFa?.trim() || gusheh.descriptionFa)}</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Opens the printable A4 sheet in a clean print window (with direct HTML download fallback).
 */
export function openPrintableSheetWindow(html: string, filename = 'navanegar-sheet-a4.html'): void {
  if (typeof window === 'undefined') return;
  const w = window.open('', '_blank', 'width=900,height=1020');
  if (w) {
    w.document.open();
    w.document.write(html);
    w.document.close();
    return;
  }
  // Popup blocked fallback: download standalone printable HTML file
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
