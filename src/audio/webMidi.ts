import { frequencyToPersianNote } from '../data/musicTheory';
import type { KoronMode, PersianNoteSpec } from '../types/music';

export interface MidiDeviceInfo {
  id: string;
  name: string;
  manufacturer: string;
  state: string;
}

export interface MidiNoteEvent {
  type: 'note_on' | 'note_off';
  midiNote: number;
  velocity: number; // 0..1
  pitchBendCents: number; // supports microtonal pitch-bend keyboards (e.g. -50¢ Koron / +50¢ Sori)
  frequencyHz: number;
  note: PersianNoteSpec;
  labelFa: string;
  timestampMs: number;
}

/**
 * Converts a MIDI note number (0..127) + optional microtonal pitch-bend offset (cents)
 * into exact Hz calibrated to `a4Hz`.
 */
export function midiNoteToFrequency(
  midiNote: number,
  pitchBendCents = 0,
  a4Hz = 440
): number {
  const semisFromA4 = midiNote - 69 + pitchBendCents / 100;
  return a4Hz * Math.pow(2, semisFromA4 / 12);
}

/**
 * Parses a raw 3-byte MIDI channel message into a deterministic event (note_on, note_off, or pitch_bend).
 */
export function parseRawMidiMessage(
  data: Uint8Array,
  currentPitchBendCents: number,
  a4Hz = 440,
  koronMode: KoronMode = 'standard_50',
  preferredScale?: PersianNoteSpec[],
  pitchBendRangeSemitones = 2
):
  | { kind: 'note'; event: MidiNoteEvent }
  | { kind: 'pitch_bend'; pitchBendCents: number }
  | { kind: 'ignore' } {
  if (!data || data.length < 2) return { kind: 'ignore' };
  const status = data[0] & 0xf0;
  const d1 = data[1] ?? 0;
  const d2 = data[2] ?? 0;

  // Pitch Bend (0xE0): 14-bit value centered at 8192
  if (status === 0xe0 && data.length >= 3) {
    const raw14 = ((d2 & 0x7f) << 7) | (d1 & 0x7f);
    const normalized = (raw14 - 8192) / 8192; // -1..+1
    const cents = Math.round(normalized * pitchBendRangeSemitones * 100 * 10) / 10;
    return { kind: 'pitch_bend', pitchBendCents: cents };
  }

  // Note On (0x90) with velocity > 0
  if (status === 0x90 && d2 > 0) {
    const freq = midiNoteToFrequency(d1, currentPitchBendCents, a4Hz);
    const match = frequencyToPersianNote(freq, a4Hz, koronMode, preferredScale);
    return {
      kind: 'note',
      event: {
        type: 'note_on',
        midiNote: d1,
        velocity: Math.min(1, d2 / 127),
        pitchBendCents: currentPitchBendCents,
        frequencyHz: freq,
        note: match.note,
        labelFa: match.labelFa,
        timestampMs: Date.now(),
      },
    };
  }

  // Note Off (0x80) or Note On with velocity 0
  if (status === 0x80 || (status === 0x90 && d2 === 0)) {
    const freq = midiNoteToFrequency(d1, currentPitchBendCents, a4Hz);
    const match = frequencyToPersianNote(freq, a4Hz, koronMode, preferredScale);
    return {
      kind: 'note',
      event: {
        type: 'note_off',
        midiNote: d1,
        velocity: 0,
        pitchBendCents: currentPitchBendCents,
        frequencyHz: freq,
        note: match.note,
        labelFa: match.labelFa,
        timestampMs: Date.now(),
      },
    };
  }

  return { kind: 'ignore' };
}

export function isWebMidiSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof (navigator as Navigator & { requestMIDIAccess?: unknown }).requestMIDIAccess ===
      'function'
  );
}

/**
 * Offline Web MIDI / USB-OTG controller manager.
 */
export class WebMidiManager {
  private access: MIDIAccess | null = null;
  private pitchBendCents = 0;
  private a4Hz = 440;
  private koronMode: KoronMode = 'standard_50';
  private preferredScale: PersianNoteSpec[] | undefined;
  private onNoteCb?: (ev: MidiNoteEvent) => void;
  private onDevicesCb?: (devices: MidiDeviceInfo[]) => void;

  configure(opts: {
    a4Hz: number;
    koronMode: KoronMode;
    preferredScale?: PersianNoteSpec[];
    onNote?: (ev: MidiNoteEvent) => void;
    onDevicesChange?: (devices: MidiDeviceInfo[]) => void;
  }): void {
    this.a4Hz = opts.a4Hz;
    this.koronMode = opts.koronMode;
    this.preferredScale = opts.preferredScale;
    this.onNoteCb = opts.onNote;
    this.onDevicesCb = opts.onDevicesChange;
  }

  async connect(): Promise<{ supported: boolean; devices: MidiDeviceInfo[]; errorFa?: string }> {
    if (!isWebMidiSupported()) {
      return {
        supported: false,
        devices: [],
        errorFa:
          'مرورگر فعلی از Web MIDI پشتیبانی نمی‌کند (در کروم دسکتاپ، Edge و اندروید USB-OTG فعال است). می‌توانید از کلیدهای آزمایشی MIDI پایین استفاده کنید.',
      };
    }

    try {
      const access = await navigator.requestMIDIAccess({ sysex: false });
      this.access = access;
      this.bindInputs();
      access.onstatechange = () => this.bindInputs();
      return { supported: true, devices: this.listDevices() };
    } catch {
      return {
        supported: true,
        devices: [],
        errorFa: 'دسترسی به دستگاه MIDI / USB-OTG توسط کاربر یا سیستم مسدود شد.',
      };
    }
  }

  private bindInputs(): void {
    if (!this.access) return;
    for (const input of this.access.inputs.values()) {
      input.onmidimessage = (ev) => {
        if (!ev.data) return;
        const parsed = parseRawMidiMessage(
          ev.data,
          this.pitchBendCents,
          this.a4Hz,
          this.koronMode,
          this.preferredScale
        );
        if (parsed.kind === 'pitch_bend') {
          this.pitchBendCents = parsed.pitchBendCents;
        } else if (parsed.kind === 'note') {
          this.onNoteCb?.(parsed.event);
        }
      };
    }
    this.onDevicesCb?.(this.listDevices());
  }

  listDevices(): MidiDeviceInfo[] {
    if (!this.access) return [];
    const list: MidiDeviceInfo[] = [];
    for (const input of this.access.inputs.values()) {
      list.push({
        id: input.id,
        name: input.name || 'دستگاه MIDI بدون نام',
        manufacturer: input.manufacturer || 'USB-OTG / MIDI',
        state: input.state || 'connected',
      });
    }
    return list;
  }

  disconnect(): void {
    if (!this.access) return;
    for (const input of this.access.inputs.values()) {
      input.onmidimessage = null;
    }
    this.access.onstatechange = null;
    this.access = null;
  }
}
