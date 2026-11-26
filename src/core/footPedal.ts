import type { FootPedalPresetId } from '../types/music';

export type StudioPedalAction =
  | 'toggle_play'
  | 'repeat_master'
  | 'toggle_record'
  | 'next_gusheh'
  | 'prev_gusheh'
  | 'toggle_wait_mode';

export interface FootPedalPreset {
  id: FootPedalPresetId;
  nameFa: string;
  descriptionFa: string;
  bindings: Record<string, StudioPedalAction>;
}

export const PEDAL_ACTION_LABELS_FA: Record<StudioPedalAction, string> = {
  toggle_play: 'پخش / توقف حلقه A–B',
  repeat_master: 'تکرار با استاد',
  toggle_record: 'شروع / توقف ضبط',
  next_gusheh: 'گوشه بعدی',
  prev_gusheh: 'گوشه قبلی',
  toggle_wait_mode: 'حالت صبر تا کوک دقیق',
};

/**
 * Standard Bluetooth musician foot pedal presets (AirTurn, PageFlip, Donner, iRig BlueTurn).
 * These pedals emit standard keyboard events (PageUp, PageDown, ArrowRight, ArrowLeft, Space, Enter).
 */
export const FOOT_PEDAL_PRESETS: FootPedalPreset[] = [
  {
    id: 'airturn_page',
    nameFa: 'پدال استاندارد صفحه‌گردان (AirTurn / PageFlip)',
    descriptionFa: 'PageDown / ArrowRight: گوشه بعد • PageUp / ArrowLeft: گوشه قبل • Space: پخش/توقف',
    bindings: {
      PageDown: 'next_gusheh',
      ArrowRight: 'next_gusheh',
      PageUp: 'prev_gusheh',
      ArrowLeft: 'prev_gusheh',
      ' ': 'toggle_play',
      Enter: 'repeat_master',
    },
  },
  {
    id: 'play_record',
    nameFa: 'حالت ضبط استودیویی بدون دست',
    descriptionFa: 'PageDown / ArrowDown: پخش/توقف • PageUp / ArrowUp: شروع/توقف ضبط • Space: تکرار با استاد',
    bindings: {
      PageDown: 'toggle_play',
      ArrowDown: 'toggle_play',
      PageUp: 'toggle_record',
      ArrowUp: 'toggle_record',
      ' ': 'repeat_master',
      Enter: 'toggle_wait_mode',
    },
  },
  {
    id: 'loop_next',
    nameFa: 'حالت تمرین ردیف (تکرار استاد + گوشه بعد)',
    descriptionFa: 'PageDown: تکرار با استاد • PageUp: گوشه بعد • Space: حالت صبر تا کوک دقیق',
    bindings: {
      PageDown: 'repeat_master',
      ArrowRight: 'repeat_master',
      PageUp: 'next_gusheh',
      ArrowLeft: 'prev_gusheh',
      ' ': 'toggle_wait_mode',
      Enter: 'toggle_play',
    },
  },
];

export function resolveFootPedalAction(
  key: string,
  presetId: FootPedalPresetId
): StudioPedalAction | null {
  const preset =
    FOOT_PEDAL_PRESETS.find((p) => p.id === presetId) ?? FOOT_PEDAL_PRESETS[0];
  return preset.bindings[key] ?? null;
}
