import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, Plug, PlugZap } from 'lucide-react';
import { playPersianNote } from '../audio/karplusStrong';
import {
  isWebMidiSupported,
  WebMidiManager,
  type MidiDeviceInfo,
  type MidiNoteEvent,
} from '../audio/webMidi';
import { formatNoteFa, noteToFrequency } from '../data/musicTheory';
import type {
  Gusheh,
  InstrumentId,
  KoronMode,
  PersianNoteSpec,
} from '../types/music';
import { toPersianDigits } from '../utils/persian';

interface WebMidiPanelProps {
  gusheh: Gusheh;
  instrument: InstrumentId;
  a4Hz: number;
  koronMode: KoronMode;
  onMidiPitchDetected: (freqHz: number | null, labelFa: string | null) => void;
}

export const WebMidiPanel: React.FC<WebMidiPanelProps> = ({
  gusheh,
  instrument,
  a4Hz,
  koronMode,
  onMidiPitchDetected,
}) => {
  const managerRef = useRef<WebMidiManager | null>(null);
  const [connected, setConnected] = useState(false);
  const [devices, setDevices] = useState<MidiDeviceInfo[]>([]);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [synthOutput, setSynthOutput] = useState(true);
  const [lastEvent, setLastEvent] = useState<MidiNoteEvent | null>(null);

  if (!managerRef.current) {
    managerRef.current = new WebMidiManager();
  }

  useEffect(() => {
    managerRef.current?.configure({
      a4Hz,
      koronMode,
      preferredScale: gusheh.scale,
      onDevicesChange: (list) => setDevices(list),
      onNote: (ev) => {
        setLastEvent(ev);
        if (ev.type === 'note_on') {
          onMidiPitchDetected(ev.frequencyHz, ev.labelFa);
          if (synthOutput) {
            playPersianNote(ev.note, {
              instrument,
              durationSec: 0.75,
              a4Hz,
              koronMode,
              velocity: Math.max(0.35, ev.velocity),
            });
          }
        } else {
          onMidiPitchDetected(null, null);
        }
      },
    });
  }, [a4Hz, gusheh.scale, instrument, koronMode, onMidiPitchDetected, synthOutput]);

  useEffect(() => {
    return () => {
      managerRef.current?.disconnect();
    };
  }, []);

  const handleToggleConnect = async () => {
    if (connected) {
      managerRef.current?.disconnect();
      setConnected(false);
      setDevices([]);
      setStatusMsg('اتصال MIDI قطع شد.');
      onMidiPitchDetected(null, null);
      return;
    }

    const res = await managerRef.current!.connect();
    setDevices(res.devices);
    if (res.errorFa) {
      setStatusMsg(res.errorFa);
      setConnected(false);
    } else {
      setConnected(true);
      setStatusMsg(
        res.devices.length > 0
          ? `${toPersianDigits(res.devices.length)} دستگاه MIDI متصل شد و آماده ارسال نت به کارگاه و حالت Wait Mode است.`
          : 'پورت Web MIDI آماده است؛ کیبورد یا کنترلر USB-OTG خود را متصل کنید.'
      );
    }
  };

  const triggerVirtualMidiKey = (note: PersianNoteSpec) => {
    const freq = noteToFrequency(note, a4Hz, koronMode);
    const label = formatNoteFa(note, true);
    setLastEvent({
      type: 'note_on',
      midiNote: 60,
      velocity: 0.85,
      pitchBendCents:
        note.accidental === 'koron'
          ? koronMode === 'traditional_56'
            ? -56
            : -50
          : note.accidental === 'sori'
          ? 50
          : 0,
      frequencyHz: freq,
      note,
      labelFa: label,
      timestampMs: Date.now(),
    });
    onMidiPitchDetected(freq, label);
    if (synthOutput) {
      playPersianNote(note, {
        instrument,
        durationSec: 0.8,
        a4Hz,
        koronMode,
      });
    }
    window.setTimeout(() => onMidiPitchDetected(null, null), 650);
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/85">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-300">
            <Keyboard className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
              اتصال آفلاین کیبورد MIDI / USB-OTG (پشتیبانی ربع‌پرده Pitch Bend)
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              نت‌های ورودی کیبورد مستقیماً روی عقربه سنت، منحنی زیر و بمی و حالت «صبر کن تا درست بنوازی» ارزیابی می‌شوند.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <input
              type="checkbox"
              checked={synthOutput}
              onChange={(e) => setSynthOutput(e.target.checked)}
              className="accent-teal-600"
            />
            پخش با سنتز ساز ایرانی
          </label>

          <button
            type="button"
            onClick={() => void handleToggleConnect()}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-extrabold text-white shadow-sm transition ${
              connected
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {connected ? <PlugZap className="h-4 w-4" /> : <Plug className="h-4 w-4" />}
            {connected ? 'متصل به Web MIDI' : 'اتصال کیبورد MIDI / OTG'}
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className="mt-2.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-xs text-indigo-700 dark:text-indigo-300">
          {statusMsg}
        </div>
      )}

      {!isWebMidiSupported() && !statusMsg && (
        <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
          وضعیت مرورگر: برای اتصال سخت‌افزاری USB-OTG از Chrome/Edge یا اندروید استفاده کنید؛ کلاویه ربع‌پرده آزمایشی زیر همیشه در دسترس است.
        </div>
      )}

      {devices.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {devices.map((d) => (
            <span
              key={d.id}
              className="rounded-lg bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300"
            >
              {d.name} ({d.manufacturer})
            </span>
          ))}
        </div>
      )}

      {lastEvent && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-slate-100/80 px-3 py-2 text-xs dark:bg-slate-800/70">
          <span>
            آخرین نت ورودی:{' '}
            <strong className="text-teal-700 dark:text-teal-300">{lastEvent.labelFa}</strong>
          </span>
          <span className="ltr-num font-bold text-slate-600 dark:text-slate-300">
            {lastEvent.frequencyHz.toFixed(1)} Hz
          </span>
          <span className="ltr-num text-amber-600 dark:text-amber-300">
            Pitch Bend: {lastEvent.pitchBendCents > 0 ? `+${lastEvent.pitchBendCents}` : lastEvent.pitchBendCents}¢
          </span>
        </div>
      )}

      {/* Microtonal Virtual MIDI Keys matching active Gusheh scale (works without hardware & feeds Wait Mode!) */}
      <div className="mt-3">
        <div className="mb-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400">
          کلاویه لمسی ربع‌پرده گوشه فعال (ارسال مستقیم سیگنال به Wait Mode و منحنی زیر و بمی):
        </div>
        <div className="flex flex-wrap gap-1.5">
          {gusheh.scale.map((note, idx) => (
            <button
              key={`${note.letter}-${note.accidental}-${note.octave}-${idx}`}
              type="button"
              onClick={() => triggerVirtualMidiKey(note)}
              className={`rounded-xl border px-3 py-2.5 text-xs font-extrabold transition active:scale-95 ${
                note.accidental === 'koron' || note.accidental === 'sori'
                  ? 'border-amber-400/60 bg-amber-500/15 text-amber-800 hover:bg-amber-500/25 dark:text-amber-200'
                  : 'border-slate-300 bg-white text-slate-800 hover:bg-teal-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
              }`}
            >
              {formatNoteFa(note, true)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
