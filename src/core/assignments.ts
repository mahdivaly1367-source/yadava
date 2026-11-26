import { GUSHEH_BY_ID } from '../data/radifData';
import type {
  InstrumentId,
  KoronMode,
  RadifTraditionId,
  TeacherAssignment,
} from '../types/music';

const CODE_PREFIX = 'NVN1-';

function utf8ToBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToUtf8(b64Url: string): string {
  const padded = b64Url.replace(/-/g, '+').replace(/_/g, '/');
  const mod = padded.length % 4;
  const full = mod === 0 ? padded : padded + '='.repeat(4 - mod);
  const binary = atob(full);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Encodes a TeacherAssignment into a compact offline share code (`NVN1-...`)
 * that requires ZERO backend and works over SMS, Telegram, WhatsApp, or QR.
 */
export function encodeAssignmentCode(assignment: TeacherAssignment): string {
  const compact = {
    v: 1,
    id: assignment.id,
    t: assignment.titleFa.slice(0, 80),
    tn: assignment.teacherName.slice(0, 50),
    g: assignment.gushehId,
    tr: assignment.traditionId,
    i: assignment.instrument,
    sp: Math.max(50, Math.min(150, Math.round(assignment.speedPercent))),
    ls: Math.max(0, assignment.loopStart),
    le: Math.max(0, assignment.loopEnd),
    tp: Math.max(-12, Math.min(12, Math.round(assignment.transposeSemitones))),
    km: assignment.koronMode,
    ta: Math.max(50, Math.min(99, Math.round(assignment.targetAccuracyPercent))),
    wm: assignment.requireWaitMode ? 1 : 0,
    nt: assignment.notesFa.slice(0, 200),
    at: assignment.createdAt,
  };
  return `${CODE_PREFIX}${utf8ToBase64Url(JSON.stringify(compact))}`;
}

export function buildAssignmentShareUrl(
  assignment: TeacherAssignment,
  baseOrigin?: string
): string {
  const code = encodeAssignmentCode(assignment);
  const origin =
    baseOrigin ??
    (typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : 'https://navanegar.app/');
  return `${origin}#assignment=${encodeURIComponent(code)}`;
}

/**
 * Decodes either a raw `NVN1-...` offline code OR a full share URL containing `#assignment=...`.
 */
export function decodeAssignmentInput(rawInput: string): TeacherAssignment | null {
  const trimmed = rawInput.trim();
  if (!trimmed) return null;

  let code = trimmed;
  const hashIdx = trimmed.indexOf('assignment=');
  if (hashIdx >= 0) {
    code = decodeURIComponent(trimmed.slice(hashIdx + 'assignment='.length).split('&')[0]);
  }
  if (!code.startsWith(CODE_PREFIX)) return null;

  try {
    const jsonStr = base64UrlToUtf8(code.slice(CODE_PREFIX.length));
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
    if (parsed.v !== 1 || typeof parsed.g !== 'string') return null;

    const gusheh = GUSHEH_BY_ID[parsed.g];
    if (!gusheh) return null;

    const validInstruments: InstrumentId[] = [
      'tar',
      'setar',
      'santur',
      'ney',
      'kamancheh',
      'oud',
      'tanbur',
    ];
    const validTraditions: RadifTraditionId[] = [
      'mirza_abdollah',
      'mahmoud_karimi',
      'saba',
      'davami',
    ];
    const inst = validInstruments.includes(parsed.i as InstrumentId)
      ? (parsed.i as InstrumentId)
      : 'tar';
    const trad = validTraditions.includes(parsed.tr as RadifTraditionId)
      ? (parsed.tr as RadifTraditionId)
      : 'mirza_abdollah';
    const koronMode: KoronMode =
      parsed.km === 'traditional_56' ? 'traditional_56' : 'standard_50';

    const maxIdx = Math.max(0, gusheh.melody.length - 1);
    const ls = Math.max(0, Math.min(maxIdx, Number(parsed.ls) || 0));
    const le = Math.max(ls, Math.min(maxIdx, Number(parsed.le) || maxIdx));

    return {
      version: 1,
      id: typeof parsed.id === 'string' ? parsed.id : `asg_${Date.now()}`,
      titleFa: typeof parsed.t === 'string' && parsed.t ? parsed.t : `تکلیف ${gusheh.nameFa}`,
      teacherName:
        typeof parsed.tn === 'string' && parsed.tn ? parsed.tn : 'استاد ردیف',
      gushehId: gusheh.id,
      traditionId: trad,
      instrument: inst,
      speedPercent: Math.max(50, Math.min(150, Number(parsed.sp) || 80)),
      loopStart: ls,
      loopEnd: le,
      transposeSemitones: Math.max(-12, Math.min(12, Number(parsed.tp) || 0)),
      koronMode,
      targetAccuracyPercent: Math.max(50, Math.min(99, Number(parsed.ta) || 85)),
      requireWaitMode: parsed.wm === 1 || parsed.wm === true,
      notesFa: typeof parsed.nt === 'string' ? parsed.nt : '',
      createdAt: Number(parsed.at) || Date.now(),
    };
  } catch {
    return null;
  }
}
