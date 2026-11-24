import React, { useEffect, useRef, useState } from 'react';
import {
  DatabaseBackup,
  Download,
  FileAudio,
  FileCode2,
  FileMusic,
  Image as ImageIcon,
  Printer,
  Share2,
  Upload,
  X,
} from 'lucide-react';
import {
  buildFullOfflineBackupJson,
  parseAndSanitizeBackupJson,
} from '../core/backupRestore';
import type {
  Gusheh,
  InstrumentId,
  KoronMode,
  UserLearningState,
} from '../types/music';
import {
  buildPrintableSheetHtml,
  generateGushehMusicXml,
  generateMicrotonalMidiBytes,
  renderProgressCardToCanvas,
  synthesizeGushehToWav,
  triggerFileDownload,
} from '../utils/exporters';
import { INSTRUMENT_LABELS_FA } from '../utils/persian';

interface ExportShareModalProps {
  open: boolean;
  onClose: () => void;
  gusheh: Gusheh;
  instrument: InstrumentId;
  a4Hz: number;
  koronMode: KoronMode;
  userState: UserLearningState;
  onImportBackupState?: (nextState: UserLearningState) => void;
}

export const ExportShareModal: React.FC<ExportShareModalProps> = ({
  open,
  onClose,
  gusheh,
  instrument,
  a4Hz,
  koronMode,
  userState,
  onImportBackupState,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [statusFa, setStatusFa] = useState<string | null>(null);
  const [errorFa, setErrorFa] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !canvasRef.current) return;
    renderProgressCardToCanvas(canvasRef.current, userState, gusheh);
  }, [open, userState, gusheh]);

  if (!open) return null;

  const slug = gusheh.id.replace(/[^a-z0-9_-]/gi, '_');

  const handleMusicXml = () => {
    const xml = generateGushehMusicXml(gusheh, koronMode);
    triggerFileDownload(
      new Blob([xml], { type: 'application/vnd.recordare.musicxml+xml;charset=utf-8' }),
      `navanegar-${slug}.musicxml`
    );
    setStatusFa('فایل استاندارد MusicXML با علائم ربع‌پرده کُرُن/سُری دانلود شد.');
  };

  const handleMidi = () => {
    const bytes = generateMicrotonalMidiBytes(gusheh, gusheh.practiceLoop.defaultBpm, koronMode);
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    triggerFileDownload(new Blob([buffer], { type: 'audio/midi' }), `navanegar-${slug}-microtonal.mid`);
    setStatusFa('فایل MIDI ربع‌پرده (همراه با Pitch Bend دقیق کُرُن/سُری) دانلود شد.');
  };

  const handleWav = () => {
    const wavBytes = synthesizeGushehToWav(
      gusheh,
      instrument,
      gusheh.practiceLoop.defaultBpm,
      a4Hz,
      koronMode
    );
    const buffer = wavBytes.buffer.slice(wavBytes.byteOffset, wavBytes.byteOffset + wavBytes.byteLength) as ArrayBuffer;
    triggerFileDownload(new Blob([buffer], { type: 'audio/wav' }), `navanegar-${slug}-${instrument}.wav`);
    setStatusFa(`فایل صوتی WAV سنتز ${INSTRUMENT_LABELS_FA[instrument]} آماده و دانلود شد.`);
  };

  const handlePrintSheet = () => {
    const html = buildPrintableSheetHtml(gusheh, koronMode);
    const win = window.open('', '_blank', 'width=900,height=720');
    if (win) {
      win.document.open();
      win.document.write(html);
      win.document.close();
      setStatusFa('صفحه چاپی نت ایرانی باز شد؛ از دکمه چاپ برای ذخیره PDF استفاده کنید.');
    } else {
      triggerFileDownload(new Blob([html], { type: 'text/html;charset=utf-8' }), `navanegar-${slug}-sheet.html`);
      setStatusFa('برگه نت قابل چاپ (HTML/PDF) دانلود شد.');
    }
  };

  const handleDownloadCardPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    renderProgressCardToCanvas(canvas, userState, gusheh);
    canvas.toBlob((blob) => {
      if (!blob) return;
      triggerFileDownload(blob, `navanegar-progress-${slug}.png`);
      setStatusFa('کارت پیشرفت PNG با کیفیت بالا برای اشتراک در اینستاگرام/تلگرام دانلود شد.');
    }, 'image/png');
  };

  const handleExportBackupJson = () => {
    setErrorFa(null);
    const json = buildFullOfflineBackupJson(userState);
    triggerFileDownload(
      new Blob([json], { type: 'application/json;charset=utf-8' }),
      'navanegar-backup-v2.json'
    );
    setStatusFa(
      'پشتیبان کامل آفلاین (navanegar-backup-v2.json) شامل جلسات، کارت‌های SM-2، مسیرها و کوک سفارشی ذخیره شد.'
    );
  };

  const handleImportBackupFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorFa(null);
    const text = await file.text();
    const res = parseAndSanitizeBackupJson(text, userState.ownerUid);
    if (!res.ok) {
      setErrorFa(res.errorFa);
      setStatusFa(null);
    } else {
      onImportBackupState?.(res.userState);
      setStatusFa(res.summaryFa);
    }
    e.target.value = '';
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="خروجی استاندارد و اشتراک‌گذاری"
    >
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-teal-500/30 bg-white p-6 shadow-2xl dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-500/15 text-teal-600 dark:text-teal-300">
              <Share2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                خروجی استاندارد استودیویی و اشتراک‌گذاری
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                گوشه فعال: {gusheh.nameFa} — تمام خروجی‌ها ۱۰۰٪ آفلاین روی دستگاه شما ساخته می‌شوند
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="بستن"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 4 File Exports */}
        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <button
            type="button"
            onClick={handleMusicXml}
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-right transition hover:border-teal-400 dark:border-slate-800 dark:bg-slate-800/60"
          >
            <FileCode2 className="h-6 w-6 shrink-0 text-teal-500" />
            <div>
              <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                خروجی MusicXML ربع‌پرده
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                سازگار با MuseScore، Finale و Sibelius (با تگ quarter-flat/sharp)
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={handleMidi}
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-right transition hover:border-amber-400 dark:border-slate-800 dark:bg-slate-800/60"
          >
            <FileMusic className="h-6 w-6 shrink-0 text-amber-500" />
            <div>
              <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                خروجی MIDI ربع‌پرده (.mid)
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                همراه با Pitch Bend دقیق کُرُن و سُری برای DAWها
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={handleWav}
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-right transition hover:border-sky-400 dark:border-slate-800 dark:bg-slate-800/60"
          >
            <FileAudio className="h-6 w-6 shrink-0 text-sky-500" />
            <div>
              <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                خروجی صوتی WAV ({INSTRUMENT_LABELS_FA[instrument]})
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                رندر آفلاین Karplus-Strong با کیفیت ۱۶ بیتی PCM
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={handlePrintSheet}
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-right transition hover:border-emerald-400 dark:border-slate-800 dark:bg-slate-800/60"
          >
            <Printer className="h-6 w-6 shrink-0 text-emerald-500" />
            <div>
              <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                برگه نت چاپی / PDF کلاس
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                شامل درجات، جمله گوشه و غزل عروضی آماده چاپ
              </div>
            </div>
          </button>
        </div>

        {/* Shareable Progress Card Preview */}
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/75 p-4 dark:border-slate-800 dark:bg-slate-800/50">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800 dark:text-slate-100">
              <ImageIcon className="h-4 w-4 text-amber-500" />
              کارت پیشرفت تصویری (اینستاگرام و تلگرام)
            </div>
            <button
              type="button"
              onClick={handleDownloadCardPng}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-l from-amber-500 to-teal-600 px-3.5 py-1.5 text-xs font-extrabold text-white shadow"
            >
              <Download className="h-3.5 w-3.5" />
              دانلود کارت PNG
            </button>
          </div>
          <canvas
            ref={canvasRef}
            className="w-full rounded-xl border border-slate-700 shadow-inner"
          />
        </div>

        {/* Feature 13: Full Offline JSON Backup & Scoped Restore */}
        <div className="mt-4 rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <DatabaseBackup className="h-5 w-5 text-indigo-500" />
              <div>
                <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                  پشتیبان‌گیری و بازیابی کامل آفلاین (JSON)
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  انتقال تمام پیشرفت، SM-2، کوک سفارشی و ریتم‌ها بین گوشی و وب با ایزولاسیون کامل حساب
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleExportBackupJson}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700"
              >
                <Download className="h-3.5 w-3.5" />
                دانلود پشتیبان JSON
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-500/40 bg-white px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-50 dark:bg-slate-900 dark:text-indigo-300"
              >
                <Upload className="h-3.5 w-3.5" />
                بازیابی از فایل JSON
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={(e) => void handleImportBackupFile(e)}
                className="hidden"
              />
            </div>
          </div>
        </div>

        {errorFa && (
          <div className="mt-3 rounded-xl border border-rose-500/35 bg-rose-500/12 px-3 py-2 text-xs font-bold text-rose-700 dark:text-rose-300">
            {errorFa}
          </div>
        )}

        {statusFa && (
          <div className="mt-3 rounded-xl border border-emerald-500/35 bg-emerald-500/12 px-3 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">
            {statusFa}
          </div>
        )}
      </div>
    </div>
  );
};
