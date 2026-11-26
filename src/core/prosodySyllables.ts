import { formatNoteFa } from '../data/musicTheory';
import { getPoetryForGusheh } from '../data/persianPoetry';
import type { Gusheh, MelodyNote } from '../types/music';

export type SyllableWeight = 'long' | 'short'; // هجای بلند (—) یا کوتاه (◡)

export interface ProsodyAlignedSlot {
  noteIndex: number;
  note: MelodyNote;
  noteLabelFa: string;
  syllableFa: string;
  weight: SyllableWeight;
  isBreathPoint: boolean; // محل نفس‌گیری (❟)
  isTahrirStart: boolean; // نقطه شروع تحریر (〰)
}

export interface ProsodyAlignmentResult {
  poetFa: string;
  meterNameFa: string;
  aruzPatternFa: string;
  performanceTipFa: string;
  fullCoupletFa: string;
  slots: ProsodyAlignedSlot[];
}

const SHORT_VOWEL_HINT_WORDS = new Set([
  'به',
  'که',
  'چه',
  'نه',
  'در',
  'بر',
  'از',
  'و',
  'تو',
  'من',
  'دل',
  'سر',
  'شب',
  'غم',
  'می',
  'تا',
]);

/**
 * Splits any user-supplied Persian verse (مصراع) into singable syllables (تقطیع هجایی)
 * with classic prosodic weight estimation (بلند / کوتاه) for Avaz & Tasnif practice.
 */
export function syllabifyPersianVerse(verseFa: string): Array<{
  text: string;
  weight: SyllableWeight;
  tahrir?: boolean;
  breathAfter?: boolean;
}> {
  const cleaned = verseFa
    .replace(/[،؛.!؟«»—\-()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return [];

  const words = cleaned.split(' ');
  const syllables: Array<{
    text: string;
    weight: SyllableWeight;
    tahrir?: boolean;
    breathAfter?: boolean;
  }> = [];

  for (const word of words) {
    if (word.length <= 3) {
      const isLong =
        !SHORT_VOWEL_HINT_WORDS.has(word) &&
        (/[اویآ]/.test(word) || word.length === 3);
      syllables.push({ text: word, weight: isLong ? 'long' : 'short' });
      continue;
    }

    let cursor = 0;
    const chunks: string[] = [];
    while (cursor < word.length) {
      const rem = word.length - cursor;
      if (rem <= 3) {
        chunks.push(word.slice(cursor));
        break;
      }
      let cut = 2;
      if ('اویآ'.includes(word[cursor + 1])) {
        cut = 2;
      } else if ('اویآ'.includes(word[cursor + 2]) && rem > 4) {
        cut = 3;
      }
      chunks.push(word.slice(cursor, cursor + cut));
      cursor += cut;
    }

    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      const isLong = c.length >= 3 || /[اویآ]/.test(c);
      syllables.push({
        text: i < chunks.length - 1 ? `${c}ـ` : c,
        weight: isLong ? 'long' : 'short',
      });
    }
  }

  // Mark natural mid-verse breath point on longer custom lines
  if (syllables.length >= 6) {
    syllables[Math.floor(syllables.length / 2) - 1].breathAfter = true;
  }

  return syllables;
}

/**
 * Aligns either the authentic Dastgah-matched classical Ghazal OR a custom Persian verse
 * syllable-by-syllable directly beneath the Gusheh's musical staff notes,
 * marking exact breath points (محل نفس‌گیری) and Tahrir melisma zones (شروع تحریر).
 */
export function alignPoetryToGusheh(
  gusheh: Gusheh,
  customVerseFa?: string
): ProsodyAlignmentResult {
  const classic = getPoetryForGusheh(gusheh);
  const customTrimmed = customVerseFa?.trim() ?? '';
  const sourceSyllables = customTrimmed
    ? syllabifyPersianVerse(customTrimmed)
    : classic.syllables;

  const halfIdx = Math.max(2, Math.floor(gusheh.melody.length / 2));

  const slots: ProsodyAlignedSlot[] = gusheh.melody.map((note, idx) => {
    const syl = sourceSyllables[idx % Math.max(1, sourceSyllables.length)] ?? {
      text: 'آ',
      weight: 'long' as const,
    };

    const isTahrir = Boolean(
      note.isTahrirZone || note.ornament === 'tahrir' || syl.tahrir
    );
    const isBreath = Boolean(
      syl.breathAfter || idx === halfIdx - 1 || note.isForoudTarget
    );

    return {
      noteIndex: idx,
      note,
      noteLabelFa: formatNoteFa(note, false),
      syllableFa: syl.text,
      weight: isTahrir || note.durationBeats >= 1.5 ? 'long' : syl.weight,
      isBreathPoint: isBreath,
      isTahrirStart: isTahrir,
    };
  });

  return {
    poetFa: customTrimmed ? 'شعر انتخابی هنرجو' : classic.poetFa,
    meterNameFa: customTrimmed ? 'تقطیع خودکار هجایی (آوازی)' : classic.meterNameFa,
    aruzPatternFa: customTrimmed ? 'وزن آزاد / تلفیقی با ردیف' : classic.aruzPatternFa,
    performanceTipFa: classic.performanceTipFa,
    fullCoupletFa: customTrimmed
      ? customTrimmed
      : `${classic.hemistich1Fa}  /  ${classic.hemistich2Fa}`,
    slots,
  };
}
