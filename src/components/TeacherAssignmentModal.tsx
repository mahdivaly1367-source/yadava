import React, { useState } from 'react';
import {
  Check,
  Copy,
  GraduationCap,
  Link2,
  Send,
  X,
} from 'lucide-react';
import {
  buildAssignmentShareUrl,
  decodeAssignmentInput,
  encodeAssignmentCode,
} from '../core/assignments';
import { ALL_GUSHEHS, SYSTEM_BY_ID } from '../data/radifData';
import { RADIF_TRADITIONS } from '../data/radifTraditions';
import type {
  Gusheh,
  InstrumentId,
  KoronMode,
  RadifTraditionId,
  TeacherAssignment,
} from '../types/music';
import { INSTRUMENT_LABELS_FA, toPersianDigits } from '../utils/persian';

interface TeacherAssignmentModalProps {
  open: boolean;
  onClose: () => void;
  activeGusheh: Gusheh;
  instrument: InstrumentId;
  koronMode: KoronMode;
  onLoadAssignment: (assignment: TeacherAssignment) => void;
}

export const TeacherAssignmentModal: React.FC<TeacherAssignmentModalProps> = ({
  open,
  onClose,
  activeGusheh,
  instrument,
  koronMode,
  onLoadAssignment,
}) => {
  const [tab, setTab] = useState<'create' | 'load'>('create');
  const [teacherName, setTeacherName] = useState('استاد ردیف');
  const [titleFa, setTitleFa] = useState(`تکلیف هفتگی ${activeGusheh.nameFa}`);
  const [gushehId, setGushehId] = useState(activeGusheh.id);
  const [traditionId, setTraditionId] = useState<RadifTraditionId>('mirza_abdollah');
  const [selectedInst, setSelectedInst] = useState<InstrumentId>(instrument);
  const [speedPercent, setSpeedPercent] = useState(80);
  const [targetAccuracy, setTargetAccuracy] = useState(85);
  const [transposeSemitones, setTransposeSemitones] = useState(0);
  const [requireWaitMode, setRequireWaitMode] = useState(true);
  const [notesFa, setNotesFa] = useState('با سرعت ۸۰٪ و واخوان روشن تمرین کنید و روی کُرُن دقیق مکث نمایید.');

  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [copiedType, setCopiedType] = useState<'code' | 'url' | null>(null);

  const [studentInput, setStudentInput] = useState('');
  const [loadErrorFa, setLoadErrorFa] = useState<string | null>(null);

  if (!open) return null;

  const handleGenerate = () => {
    const selectedGusheh = ALL_GUSHEHS.find((g) => g.id === gushehId) ?? activeGusheh;
    const asg: TeacherAssignment = {
      version: 1,
      id: `asg_${Date.now().toString(36)}`,
      titleFa: titleFa.trim() || `تکلیف ${selectedGusheh.nameFa}`,
      teacherName: teacherName.trim() || 'استاد نوانگار',
      gushehId: selectedGusheh.id,
      traditionId,
      instrument: selectedInst,
      speedPercent,
      loopStart: selectedGusheh.practiceLoop.startIndex,
      loopEnd: selectedGusheh.practiceLoop.endIndex,
      transposeSemitones,
      koronMode,
      targetAccuracyPercent: targetAccuracy,
      requireWaitMode,
      notesFa: notesFa.trim(),
      createdAt: Date.now(),
    };
    setGeneratedCode(encodeAssignmentCode(asg));
    setGeneratedUrl(buildAssignmentShareUrl(asg));
    setCopiedType(null);
  };

  const handleCopy = async (text: string, type: 'code' | 'url') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(type);
      window.setTimeout(() => setCopiedType(null), 2200);
    } catch {
      // ignore if clipboard blocked
    }
  };

  const handleStudentLoad = () => {
    setLoadErrorFa(null);
    const decoded = decodeAssignmentInput(studentInput);
    if (!decoded) {
      setLoadErrorFa('کد یا لینک تکلیف معتبر نیست. لطفاً کد NVN1-... یا لینک کامل استاد را وارد کنید.');
      return;
    }
    onLoadAssignment(decoded);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="کلاس استاد و تکلیف هفتگی"
    >
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-amber-500/30 bg-white p-6 shadow-2xl dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-300">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                حالت کلاس استاد و تکلیف هفتگی (آفلاین)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                ساخت لینک و کد تکلیف بدون نیاز به سرور • بازشدن مستقیم در کارگاه هنرجو
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

        {/* Mode Switcher */}
        <div className="mt-4 grid grid-cols-2 gap-1.5 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setTab('create')}
            className={`rounded-xl py-2 text-xs font-extrabold transition ${
              tab === 'create'
                ? 'bg-teal-600 text-white shadow'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            پنل استاد: ساخت تکلیف جدید
          </button>
          <button
            type="button"
            onClick={() => setTab('load')}
            className={`rounded-xl py-2 text-xs font-extrabold transition ${
              tab === 'load'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            پنل هنرجو: باز کردن کد تکلیف
          </button>
        </div>

        {tab === 'create' && (
          <div className="mt-4 space-y-3 text-xs">
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <label className="block">
                <span className="font-bold text-slate-600 dark:text-slate-300">نام استاد</span>
                <input
                  type="text"
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
                />
              </label>
              <label className="block">
                <span className="font-bold text-slate-600 dark:text-slate-300">عنوان تکلیف</span>
                <input
                  type="text"
                  value={titleFa}
                  onChange={(e) => setTitleFa(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <label className="block">
                <span className="font-bold text-slate-600 dark:text-slate-300">گوشه تکلیف</span>
                <select
                  value={gushehId}
                  onChange={(e) => setGushehId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-2.5 py-2 dark:border-slate-700 dark:bg-slate-800"
                >
                  {ALL_GUSHEHS.map((g) => (
                    <option key={g.id} value={g.id}>
                      {SYSTEM_BY_ID[g.dastgahId]?.nameFa} — {g.nameFa}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="font-bold text-slate-600 dark:text-slate-300">روایت ردیف</span>
                <select
                  value={traditionId}
                  onChange={(e) => setTraditionId(e.target.value as RadifTraditionId)}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-2.5 py-2 dark:border-slate-700 dark:bg-slate-800"
                >
                  {RADIF_TRADITIONS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nameFa}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <label className="block">
                <span className="font-bold text-slate-600 dark:text-slate-300">ساز</span>
                <select
                  value={selectedInst}
                  onChange={(e) => setSelectedInst(e.target.value as InstrumentId)}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-2 py-2 dark:border-slate-700 dark:bg-slate-800"
                >
                  {(['tar', 'setar', 'santur', 'ney'] as InstrumentId[]).map((inst) => (
                    <option key={inst} value={inst}>
                      {INSTRUMENT_LABELS_FA[inst]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="font-bold text-slate-600 dark:text-slate-300">
                  سرعت ({toPersianDigits(speedPercent)}٪)
                </span>
                <input
                  type="range"
                  min={55}
                  max={130}
                  step={5}
                  value={speedPercent}
                  onChange={(e) => setSpeedPercent(Number(e.target.value))}
                  className="mt-2.5 w-full accent-teal-500"
                />
              </label>

              <label className="block">
                <span className="font-bold text-slate-600 dark:text-slate-300">
                  حداقل دقت ({toPersianDigits(targetAccuracy)}٪)
                </span>
                <input
                  type="range"
                  min={65}
                  max={98}
                  value={targetAccuracy}
                  onChange={(e) => setTargetAccuracy(Number(e.target.value))}
                  className="mt-2.5 w-full accent-amber-500"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-100/80 px-3 py-2 dark:bg-slate-800/70">
              <label className="inline-flex cursor-pointer items-center gap-2 font-bold">
                <input
                  type="checkbox"
                  checked={requireWaitMode}
                  onChange={(e) => setRequireWaitMode(e.target.checked)}
                  className="accent-teal-600"
                />
                فعال‌سازی خودکار حالت «صبر کن تا درست بنوازی» (Wait Mode)
              </label>
              <label className="flex items-center gap-1.5 font-bold">
                <span>ترانسپوز:</span>
                <input
                  type="number"
                  min={-12}
                  max={12}
                  value={transposeSemitones}
                  onChange={(e) => setTransposeSemitones(Number(e.target.value))}
                  className="ltr-num w-14 rounded-lg border border-slate-300 bg-white px-2 py-1 text-center dark:border-slate-700 dark:bg-slate-900"
                />
              </label>
            </div>

            <label className="block">
              <span className="font-bold text-slate-600 dark:text-slate-300">یادداشت استاد برای هنرجو</span>
              <textarea
                rows={2}
                value={notesFa}
                onChange={(e) => setNotesFa(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
              />
            </label>

            <button
              type="button"
              onClick={handleGenerate}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-amber-500 to-teal-600 py-2.5 text-xs font-extrabold text-white shadow"
            >
              <Send className="h-4 w-4" />
              تولید لینک و کد تکلیف آفلاین
            </button>

            {generatedCode && generatedUrl && (
              <div className="space-y-2 rounded-2xl border border-emerald-500/35 bg-emerald-500/8 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-extrabold text-emerald-700 dark:text-emerald-300">
                    کد کوتاه آفلاین (قابل ارسال در تلگرام/پیامک):
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleCopy(generatedCode, 'code')}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white"
                  >
                    {copiedType === 'code' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copiedType === 'code' ? 'کپی شد' : 'کپی کد'}
                  </button>
                </div>
                <div className="ltr-num break-all rounded-lg bg-slate-950 p-2 font-mono text-[10px] text-teal-300">
                  {generatedCode}
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="font-bold text-slate-600 dark:text-slate-300">
                    لینک مستقیم باز شدن در کارگاه:
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleCopy(generatedUrl, 'url')}
                    className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-2.5 py-1 text-[11px] font-bold text-white"
                  >
                    <Link2 className="h-3 w-3" />
                    {copiedType === 'url' ? 'کپی شد' : 'کپی لینک'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'load' && (
          <div className="mt-4 space-y-3 text-xs">
            <p className="text-slate-600 dark:text-slate-300">
              کد تکلیف (`NVN1-...`) یا لینک ارسالی استاد را اینجا وارد کنید تا گوشه، سرعت، کوک و هدف دقت مستقیماً در کارگاه تمرین تنظیم شود:
            </p>
            <textarea
              rows={3}
              value={studentInput}
              onChange={(e) => setStudentInput(e.target.value)}
              placeholder="NVN1-... یا https://...#assignment=NVN1-..."
              className="ltr-num w-full rounded-xl border border-slate-300 bg-slate-50 p-3 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
            />
            {loadErrorFa && (
              <div className="rounded-xl bg-rose-500/12 px-3 py-2 text-rose-600 dark:text-rose-300">
                {loadErrorFa}
              </div>
            )}
            <button
              type="button"
              onClick={handleStudentLoad}
              className="w-full rounded-2xl bg-amber-500 py-2.5 text-xs font-extrabold text-slate-950 shadow hover:bg-amber-400"
            >
              بارگذاری تکلیف و شروع تمرین در کارگاه
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
