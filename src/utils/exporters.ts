import { synthesizeKarplusStrongSamples } from '../audio/karplusStrong';
import { expandNoteWithOrnaments } from '../audio/ornamentEngine';
import {
  formatNoteFa,
  getAccidentalCents,
  NOTE_SEMITONES,
  noteToCentsFromC0,
  noteToFrequency,
} from '../data/musicTheory';
import { getPoetryForGusheh } from '../data/persianPoetry';
import { SYSTEM_BY_ID } from '../data/radifData';
import type {
  Gusheh,
  InstrumentId,
  KoronMode,
  MelodyNote,
  PersianNoteSpec,
  UserLearningState,
} from '../types/music';
import { formatJalaliFullFa } from './jalali';
import { LEVEL_LABELS_FA, toPersianDigits } from './persian';

/**
 * Generates standard MusicXML 4.0 with authentic Persian microtonal `<alter>` tags
 * (`-0.5` for Koron, `+0.5` for Sori, `-1` for Flat, `+1` for Sharp).
 */
export function generateGushehMusicXml(
  gusheh: Gusheh,
  koronMode: KoronMode = 'standard_50'
): string {
  const sys = SYSTEM_BY_ID[gusheh.dastgahId];
  const divisions = 4;
  const alterValue = (acc: string): number => {
    switch (acc) {
      case 'koron':
        return koronMode === 'traditional_56' ? -0.56 : -0.5;
      case 'sori':
        return 0.5;
      case 'flat':
        return -1;
      case 'sharp':
        return 1;
      default:
        return 0;
    }
  };

  const [beatsStr, beatTypeStr] = gusheh.practiceLoop.meter.split('/');
  const beats = Number(beatsStr) || 4;
  const beatType = Number(beatTypeStr) || 4;

  const notesXml = gusheh.melody
    .map((m) => {
      const alt = alterValue(m.accidental);
      const dur = Math.max(1, Math.round(m.durationBeats * divisions));
      const noteType =
        m.durationBeats >= 2
          ? 'half'
          : m.durationBeats >= 1
          ? 'quarter'
          : m.durationBeats >= 0.5
          ? 'eighth'
          : '16th';
      const accTag =
        m.accidental === 'koron'
          ? '        <accidental>quarter-flat</accidental>\n'
          : m.accidental === 'sori'
          ? '        <accidental>quarter-sharp</accidental>\n'
          : m.accidental === 'flat'
          ? '        <accidental>flat</accidental>\n'
          : m.accidental === 'sharp'
          ? '        <accidental>sharp</accidental>\n'
          : '';
      return `      <note>
        <pitch>
          <step>${m.letter}</step>
          ${alt !== 0 ? `<alter>${alt}</alter>` : ''}
          <octave>${m.octave}</octave>
        </pitch>
        <duration>${dur}</duration>
        <type>${noteType}</type>
${accTag}      </note>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <work>
    <work-title>${gusheh.nameFa} (${sys?.nameFa ?? gusheh.dastgahId})</work-title>
  </work>
  <identification>
    <creator type="software">Navanegar (نوانگار) v1.0.0</creator>
  </identification>
  <part-list>
    <score-part id="P1">
      <part-name>Radif — ${gusheh.nameEn}</part-name>
    </score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>${divisions}</divisions>
        <time>
          <beats>${beats}</beats>
          <beat-type>${beatType}</beat-type>
        </time>
        <clef>
          <sign>G</sign>
          <line>2</line>
        </clef>
      </attributes>
      <direction placement="above">
        <sound tempo="${gusheh.practiceLoop.defaultBpm}"/>
      </direction>
${notesXml}
    </measure>
  </part>
</score-partwise>
`;
}

function writeVarLen(value: number): number[] {
  let v = Math.max(0, Math.floor(value));
  const bytes: number[] = [v & 0x7f];
  v >>= 7;
  while (v > 0) {
    bytes.unshift((v & 0x7f) | 0x80);
    v >>= 7;
  }
  return bytes;
}

/**
 * Generates a real binary Standard MIDI File (SMF Format 0) with exact microtonal
 * Pitch Bend events (±200¢ standard bend range -> Koron -50¢/-56¢ & Sori +50¢ play in tune!).
 */
export function generateMicrotonalMidiBytes(
  gusheh: Gusheh,
  bpm = gusheh.practiceLoop.defaultBpm,
  koronMode: KoronMode = 'standard_50'
): Uint8Array {
  const ticksPerQuarter = 480;
  const track: number[] = [];

  // Tempo meta event (FF 51 03 tt tt tt)
  const usPerBeat = Math.round(60_000_000 / Math.max(40, Math.min(240, bpm)));
  track.push(
    0x00,
    0xff,
    0x51,
    0x03,
    (usPerBeat >> 16) & 0xff,
    (usPerBeat >> 8) & 0xff,
    usPerBeat & 0xff
  );

  // Program Change: Acoustic Plucked / Sitar-like (GM Program 104) on channel 0
  track.push(0x00, 0xc0, 104);

  for (const m of gusheh.melody) {
    const exactCentsFromC0 = noteToCentsFromC0(m, koronMode);
    // MIDI note 60 = C4 = 4800 cents from C0 => midiFloat = (cents / 100) + 12
    const midiBase = Math.max(
      24,
      Math.min(108, (m.octave + 1) * 12 + NOTE_SEMITONES[m.letter])
    );
    const accCents = getAccidentalCents(m.accidental, koronMode);

    // Split full semitones into MIDI key and residual microtonal cents into Pitch Bend
    const wholeSemis = Math.round(accCents / 100);
    const midiNote = Math.max(24, Math.min(108, midiBase + wholeSemis));
    const residualCents = accCents - wholeSemis * 100; // -50 / -56 / +50 / 0

    // Standard ±200 cents pitch bend range => 8192 + (residualCents / 200) * 8192
    const bendVal = Math.max(
      0,
      Math.min(16383, Math.round(8192 + (residualCents / 200) * 8192))
    );
    const bendLsb = bendVal & 0x7f;
    const bendMsb = (bendVal >> 7) & 0x7f;

    const noteTicks = Math.max(120, Math.round(m.durationBeats * ticksPerQuarter));

    // Pitch bend + Note On (delta 0)
    track.push(0x00, 0xe0, bendLsb, bendMsb);
    track.push(0x00, 0x90, midiNote, 96);
    // Note Off after noteTicks
    track.push(...writeVarLen(noteTicks), 0x80, midiNote, 0x00);

    void exactCentsFromC0;
  }

  // End of Track meta event
  track.push(0x00, 0xff, 0x2f, 0x00);

  const trackLen = track.length;
  const header = [
    0x4d, 0x54, 0x68, 0x64, // "MThd"
    0x00, 0x00, 0x00, 0x06, // header length = 6
    0x00, 0x00,             // format 0
    0x00, 0x01,             // 1 track
    (ticksPerQuarter >> 8) & 0xff,
    ticksPerQuarter & 0xff,
    0x4d, 0x54, 0x72, 0x6b, // "MTrk"
    (trackLen >> 24) & 0xff,
    (trackLen >> 16) & 0xff,
    (trackLen >> 8) & 0xff,
    trackLen & 0xff,
  ];

  return new Uint8Array([...header, ...track]);
}

/**
 * Generates standard MusicXML 4.0 from any arbitrary transcribed Persian note list
 * (e.g. Audio Slowdowner microtonal transcriptions) for MuseScore / Finale / Sibelius.
 */
export function generateNotesMusicXml(
  titleFa: string,
  notes: Array<PersianNoteSpec & { durationBeats?: number }>,
  koronMode: KoronMode = 'standard_50',
  meter: string = '4/4'
): string {
  const source: Array<PersianNoteSpec & { durationBeats?: number }> =
    notes.length > 0 ? notes : [{ letter: 'G', accidental: 'natural', octave: 4, durationBeats: 1 }];
  const safeNotes: MelodyNote[] = source.map((n) => ({
    letter: n.letter,
    accidental: n.accidental,
    octave: n.octave,
    durationBeats: n.durationBeats ?? 1,
  }));
  const syntheticGusheh: Gusheh = {
    id: 'transcribed_notes',
    dastgahId: 'shur',
    order: 1,
    nameFa: titleFa || 'نت‌نگاری ربع‌پرده نوانگار',
    nameEn: 'Navanegar Transcription',
    role: 'daramad',
    difficulty: 1,
    shahed: safeNotes[0],
    ist: safeNotes[safeNotes.length - 1],
    aghaz: safeNotes[0],
    scale: safeNotes.slice(0, 7),
    ornaments: [],
    melody: safeNotes,
    practiceLoop: {
      startIndex: 0,
      endIndex: Math.max(0, safeNotes.length - 1),
      defaultBpm: 92,
      meter: (['2/4', '3/4', '4/4', '5/8', '6/8', '7/8'].includes(meter) ? meter : '4/4') as Gusheh['practiceLoop']['meter'],
    },
    modulations: [],
    descriptionFa: 'خروجی نت‌نگاری میکروتونال نوانگار',
  };
  return generateGushehMusicXml(syntheticGusheh, koronMode);
}

/**
 * Generates a microtonal Standard MIDI File (.mid) with 14-bit Pitch Bend for Koron/Sori
 * from any arbitrary transcribed Persian note sequence.
 */
export function generateNotesMicrotonalMidiBytes(
  notes: Array<PersianNoteSpec & { durationBeats?: number }>,
  bpm: number = 92,
  koronMode: KoronMode = 'standard_50'
): Uint8Array {
  const source: Array<PersianNoteSpec & { durationBeats?: number }> =
    notes.length > 0 ? notes : [{ letter: 'G', accidental: 'natural', octave: 4, durationBeats: 1 }];
  const safeNotes: MelodyNote[] = source.map((n) => ({
    letter: n.letter,
    accidental: n.accidental,
    octave: n.octave,
    durationBeats: n.durationBeats ?? 1,
  }));
  const syntheticGusheh: Gusheh = {
    id: 'transcribed_midi',
    dastgahId: 'shur',
    order: 1,
    nameFa: 'نت‌نگاری MIDI نوانگار',
    nameEn: 'Navanegar MIDI',
    role: 'daramad',
    difficulty: 1,
    shahed: safeNotes[0],
    ist: safeNotes[safeNotes.length - 1],
    aghaz: safeNotes[0],
    scale: safeNotes.slice(0, 7),
    ornaments: [],
    melody: safeNotes,
    practiceLoop: {
      startIndex: 0,
      endIndex: Math.max(0, safeNotes.length - 1),
      defaultBpm: bpm,
      meter: '4/4',
    },
    modulations: [],
    descriptionFa: '',
  };
  return generateMicrotonalMidiBytes(syntheticGusheh, bpm, koronMode);
}

/**
 * Encodes mono Float32 PCM samples [-1..1] into a standard 16-bit RIFF/WAVE binary buffer.
 */
export function encodeMonoPcmToWav(samples: Float32Array, sampleRate = 44100): Uint8Array {
  const numSamples = samples.length;
  const dataSize = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true);  // Linear PCM
  view.setUint16(22, 1, true);  // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // ByteRate
  view.setUint16(32, 2, true);  // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }

  return new Uint8Array(buffer);
}

/**
 * Offline physical-modeling renderer producing a complete downloadable WAV file of a Gusheh,
 * including real Iranian ornaments (Eshareh, Tekieh, Riz, Dorab, Tahrir, Malesh).
 */
export function synthesizeGushehToWav(
  gusheh: Gusheh,
  instrument: InstrumentId,
  bpm = gusheh.practiceLoop.defaultBpm,
  a4Hz = 440,
  koronMode: KoronMode = 'standard_50',
  sampleRate = 22050,
  enableOrnaments = true
): Uint8Array {
  const beatSec = 60 / Math.max(40, Math.min(220, bpm));
  const totalSec =
    gusheh.melody.reduce((acc, m) => acc + Math.max(0.2, m.durationBeats * beatSec), 0) + 0.8;
  const totalSamples = Math.max(sampleRate, Math.ceil(totalSec * sampleRate));
  const mix = new Float32Array(totalSamples);

  let cursorSec = 0.05;
  let prevFreqHz: number | undefined;
  for (const m of gusheh.melody) {
    const durSec = Math.max(0.2, m.durationBeats * beatSec);
    const freq = noteToFrequency(m, a4Hz, koronMode);
    const events = expandNoteWithOrnaments({
      baseFreqHz: freq,
      durationSec: durSec * 1.12,
      instrument,
      ornament: m.ornament,
      velocity: 0.82,
      enableOrnaments,
      scale: gusheh.scale,
      a4Hz,
      koronMode,
      prevFreqHz,
    });
    for (const ev of events) {
      const noteSamples = synthesizeKarplusStrongSamples({
        frequency: ev.frequencyHz,
        sampleRate,
        durationSec: ev.durationSec,
        instrument,
        ornament: ev.ornament,
        velocity: ev.velocity,
        slideFromHz: ev.slideFromHz,
      });
      const startIdx = Math.floor((cursorSec + ev.offsetSec) * sampleRate);
      for (let i = 0; i < noteSamples.length && startIdx + i < totalSamples; i++) {
        if (startIdx + i >= 0) {
          mix[startIdx + i] = Math.tanh(mix[startIdx + i] + noteSamples[i]);
        }
      }
    }
    prevFreqHz = freq;
    cursorSec += durSec;
  }

  return encodeMonoPcmToWav(mix, sampleRate);
}

/**
 * Generates clean printable Persian sheet HTML for Print / Save as PDF.
 */
export function buildPrintableSheetHtml(
  gusheh: Gusheh,
  koronMode: KoronMode
): string {
  const sys = SYSTEM_BY_ID[gusheh.dastgahId];
  const poetry = getPoetryForGusheh(gusheh);
  const scaleList = gusheh.scale.map((n) => formatNoteFa(n, true)).join(' — ');
  const melodyCells = gusheh.melody
    .map(
      (m, idx) =>
        `<span class="note-pill">${toPersianDigits(idx + 1)}. ${formatNoteFa(m, true)} (${toPersianDigits(m.durationBeats)} ضرب)</span>`
    )
    .join('');

  return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8" />
<title>نت و راهنمای ${gusheh.nameFa} — نوانگار</title>
<style>
  body { font-family: Tahoma, Arial, sans-serif; color: #0f172a; padding: 28px; line-height: 1.8; }
  h1 { margin: 0 0 6px; font-size: 22px; color: #0f766e; }
  .meta { font-size: 13px; color: #475569; margin-bottom: 18px; }
  .box { border: 1px solid #cbd5e1; border-radius: 12px; padding: 14px 16px; margin-bottom: 16px; }
  .note-pill { display: inline-block; border: 1px solid #99f6e4; background: #f0fdfa; border-radius: 8px; padding: 4px 10px; margin: 4px; font-size: 12px; font-weight: bold; }
  .poetry { background: #fffbeb; border-color: #fde68a; }
  @media print { button { display: none; } }
</style>
</head>
<body>
  <button onclick="window.print()" style="padding:8px 16px;background:#0d9488;color:#fff;border:none;border-radius:8px;cursor:pointer;margin-bottom:14px;">چاپ / ذخیره PDF</button>
  <h1>${gusheh.nameFa} — ${sys?.nameFa ?? ''}</h1>
  <div class="meta">
    نت شاهد: <strong>${formatNoteFa(gusheh.shahed, true)}</strong> •
    نت ایست: <strong>${formatNoteFa(gusheh.ist, true)}</strong> •
    نظام کُرُن: <strong>${koronMode === 'traditional_56' ? 'سنتی (-۵۶¢)' : 'استاندارد (-۵۰¢)'}</strong> •
    تمپو: <strong>${toPersianDigits(gusheh.practiceLoop.defaultBpm)} BPM (${gusheh.practiceLoop.meter})</strong>
  </div>
  <div class="box">
    <strong>گام و درجات گوشه:</strong><br/>${scaleList}
  </div>
  <div class="box">
    <strong>جمله تمرینی ردیف:</strong><br/>${melodyCells}
  </div>
  <div class="box poetry">
    <strong>شعر و عروض پیشنهادی (${poetry.poetFa} — ${poetry.meterNameFa}):</strong><br/>
    <div>${poetry.hemistich1Fa} &nbsp;&nbsp;/&nbsp;&nbsp; ${poetry.hemistich2Fa}</div>
    <div style="font-size:12px;color:#92400e;margin-top:6px;">افاعیل: ${poetry.aruzPatternFa}</div>
  </div>
  <div style="font-size:11px;color:#64748b;">تولیدشده با استودیوی آفلاین نوانگار (Navanegar) — ${formatJalaliFullFa(new Date())}</div>
</body>
</html>`;
}

/**
 * Renders a high-contrast Persian RTL Shareable Progress Card onto an HTML5 Canvas
 * ready to export as `.png` for Instagram Stories / Telegram.
 */
export function renderProgressCardToCanvas(
  canvas: HTMLCanvasElement,
  userState: UserLearningState,
  activeGusheh: Gusheh
): void {
  const w = 1080;
  const h = 620;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Deep Persian Turquoise + Midnight Gradient Background
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#0f172a');
  bg.addColorStop(0.55, '#134e4a');
  bg.addColorStop(1, '#0f172a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Decorative Persian Geometric Accent Rings
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.22)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(170, 140, 110, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(170, 140, 82, 0, Math.PI * 2);
  ctx.stroke();

  // Outer golden border
  ctx.strokeStyle = 'rgba(45, 212, 191, 0.45)';
  ctx.lineWidth = 3;
  ctx.strokeRect(24, 24, w - 48, h - 48);

  // RTL Header
  ctx.direction = 'rtl';
  ctx.textAlign = 'right';

  ctx.fillStyle = '#5eead4';
  ctx.font = 'bold 26px Vazirmatn, Tahoma, sans-serif';
  ctx.fillText('کارت پیشرفت استودیوی نوانگار (Navanegar)', w - 64, 92);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 46px Vazirmatn, Tahoma, sans-serif';
  ctx.fillText(userState.displayName || 'هنرجوی ردیف ایرانی', w - 64, 154);

  const sys = SYSTEM_BY_ID[activeGusheh.dastgahId];
  ctx.fillStyle = '#fcd34d';
  ctx.font = 'bold 24px Vazirmatn, Tahoma, sans-serif';
  ctx.fillText(
    `گوشه فعال: ${activeGusheh.nameFa} (${sys?.nameFa ?? ''}) • سطح: ${LEVEL_LABELS_FA[userState.level]}`,
    w - 64,
    206
  );

  // 4 Stat Cards
  const stats = [
    { label: 'زنجیره مداومت', value: `${toPersianDigits(userState.streakDays)} روز`, color: '#f59e0b' },
    { label: 'میانگین دقت کوک', value: `${toPersianDigits(userState.averageAccuracy)}٪`, color: '#10b981' },
    { label: 'مجموع تمرین', value: `${toPersianDigits(userState.totalPracticeMinutes)} دقیقه`, color: '#38bdf8' },
    { label: 'گوشه‌های مرور شده', value: `${toPersianDigits(Object.keys(userState.srsCards).length)} گوشه`, color: '#2dd4bf' },
  ];

  const cardW = 220;
  const cardH = 148;
  const gap = 24;
  const startX = w - 64 - cardW;
  const cardY = 264;

  stats.forEach((st, idx) => {
    const x = startX - idx * (cardW + gap);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
    ctx.fillRect(x, cardY, cardW, cardH);
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, cardY, cardW, cardH);

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 20px Vazirmatn, Tahoma, sans-serif';
    ctx.fillText(st.label, x + cardW - 20, cardY + 48);

    ctx.fillStyle = st.color;
    ctx.font = 'bold 38px Vazirmatn, Tahoma, sans-serif';
    ctx.fillText(st.value, x + cardW - 20, cardY + 108);
  });

  // Footer
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '20px Vazirmatn, Tahoma, sans-serif';
  ctx.fillText(
    `تاریخ: ${formatJalaliFullFa(new Date())}  •  ۱۲ نظام و ۱۷۳ گوشه ردیف اصیل ایرانی`,
    w - 64,
    h - 68
  );
}

export function triggerFileDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 2500);
}
