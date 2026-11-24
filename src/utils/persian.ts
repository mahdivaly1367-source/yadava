import type { GushehRole, InstrumentId, LearnerLevel, OrnamentType } from '../types/music';

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function toPersianDigits(input: string | number): string {
  return String(input).replace(/\d/g, (d) => PERSIAN_DIGITS[Number(d)] ?? d);
}

export function normalizePersian(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/ة/g, 'ه')
    .replace(/[أإآ]/g, 'ا')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/\u200c/g, ' ')
    .replace(/\s+/g, ' ');
}

export function formatDurationFa(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${toPersianDigits(m)}:${toPersianDigits(String(s).padStart(2, '0'))}`;
}

export function formatToman(amount: number): string {
  const formatted = amount.toLocaleString('en-US').replace(/,/g, '٬');
  return `${toPersianDigits(formatted)} تومان`;
}

export function getTodayDateKey(now = Date.now()): string {
  const d = new Date(now);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export const ROLE_LABELS_FA: Record<GushehRole, string> = {
  daramad: 'درآمد',
  miani: 'میانی',
  owj: 'اوج',
  zarbi: 'ضربی',
  foroud: 'فرود',
};

export const ROLE_BADGE_CLASSES: Record<GushehRole, string> = {
  daramad: 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30',
  miani: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
  owj: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  zarbi: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30',
  foroud: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
};

export const ORNAMENT_LABELS_FA: Record<OrnamentType, string> = {
  eshareh: 'اشاره',
  tekieh: 'تکیه',
  dorab: 'دراب',
  riz: 'ریز',
  tahrir: 'تحریر',
};

export const INSTRUMENT_LABELS_FA: Record<InstrumentId, string> = {
  tar: 'تار',
  setar: 'سه‌تار',
  santur: 'سنتور',
  ney: 'نی',
};

export const LEVEL_LABELS_FA: Record<LearnerLevel, string> = {
  beginner: 'مبتدی',
  intermediate: 'متوسط',
  advanced: 'پیشرفته',
};
