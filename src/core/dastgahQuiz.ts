import { formatNoteFa } from '../data/musicTheory';
import { ALL_GUSHEHS, RADIF_SYSTEMS, SYSTEM_BY_ID } from '../data/radifData';
import type { Gusheh } from '../types/music';

export type DastgahQuizMode = 'dastgah' | 'gusheh';

export interface DastgahQuizOption {
  id: string;
  labelFa: string;
  subLabelFa: string;
}

export interface DastgahQuizQuestion {
  mode: DastgahQuizMode;
  targetGusheh: Gusheh;
  correctOptionId: string;
  options: DastgahQuizOption[];
  hintFa: string;
  explanationFa: string;
}

export interface DastgahMasteryEntry {
  dastgahId: string;
  attempts: number;
  correct: number;
}

const MASTERY_STORAGE_KEY = 'navanegar_dastgah_quiz_mastery_v1';

const SIGNATURE_GUSHEH_SLUGS = [
  'daramad',
  'zabol',
  'bidad',
  'oshagh',
  'mokhalef',
  'araq',
  'hesar',
  'chakavak',
  'shahnaz',
  'delkash',
  'shekasteh',
  'hejaz',
  'razavi',
  'salmak',
  'mansuri',
  'bayat_raje',
];

function seededShuffle<T>(items: T[], seed: number): T[] {
  const arr = [...items];
  let s = (seed || 1) >>> 0;
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Generates an ear-recognition question for either:
 * - `dastgah`: identify which of the 12 Persian Dastgah/Avaz systems was played
 * - `gusheh`: identify the exact signature Gusheh name (e.g. Zabol, Bidad, Mokhalef, Araq...)
 */
export function generateDastgahQuizQuestion(
  mode: DastgahQuizMode,
  seed: number = Date.now()
): DastgahQuizQuestion {
  if (mode === 'dastgah') {
    const systems = seededShuffle(RADIF_SYSTEMS, seed);
    const targetSys = systems[0];
    const targetGusheh =
      targetSys.gushehs.find((g) => g.role === 'daramad') ?? targetSys.gushehs[0];

    const distractorSystems = systems.slice(1, 4);
    const options: DastgahQuizOption[] = seededShuffle(
      [targetSys, ...distractorSystems].map((s) => ({
        id: s.id,
        labelFa: s.nameFa,
        subLabelFa: s.parentDastgahId
          ? `آواز (متعلقات ${SYSTEM_BY_ID[s.parentDastgahId]?.nameFa ?? ''})`
          : 'دستگاه مستقل',
      })),
      seed + 17
    );

    return {
      mode,
      targetGusheh,
      correctOptionId: targetSys.id,
      options,
      hintFa: `نت شاهد این جمله ${formatNoteFa(targetGusheh.shahed)} و نت ایست آن ${formatNoteFa(targetGusheh.ist)} است.`,
      explanationFa: `این جمله از گوشه «${targetGusheh.nameFa}» در ${targetSys.nameFa} نواخته شد. ${targetSys.moodFa}`,
    };
  }

  // Signature Gusheh mode
  const signaturePool = ALL_GUSHEHS.filter((g) =>
    SIGNATURE_GUSHEH_SLUGS.some((slug) => g.id.includes(slug))
  );
  const pool = signaturePool.length >= 8 ? signaturePool : ALL_GUSHEHS;
  const shuffled = seededShuffle(pool, seed);
  const targetGusheh = shuffled[0];

  const distractors: Gusheh[] = [];
  for (let i = 1; i < shuffled.length && distractors.length < 3; i++) {
    if (shuffled[i].nameFa !== targetGusheh.nameFa) {
      distractors.push(shuffled[i]);
    }
  }

  const options: DastgahQuizOption[] = seededShuffle(
    [targetGusheh, ...distractors].map((g) => ({
      id: g.id,
      labelFa: g.nameFa,
      subLabelFa: SYSTEM_BY_ID[g.dastgahId]?.nameFa ?? g.dastgahId,
    })),
    seed + 31
  );

  return {
    mode,
    targetGusheh,
    correctOptionId: targetGusheh.id,
    options,
    hintFa: `این گوشه متعلق به ${SYSTEM_BY_ID[targetGusheh.dastgahId]?.nameFa ?? ''} با شاهد ${formatNoteFa(targetGusheh.shahed)} است.`,
    explanationFa: `پاسخ درست: «${targetGusheh.nameFa}» از ${SYSTEM_BY_ID[targetGusheh.dastgahId]?.nameFa ?? ''}. ${targetGusheh.descriptionFa}`,
  };
}

export function loadDastgahMastery(): Record<string, DastgahMasteryEntry> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(MASTERY_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, DastgahMasteryEntry>;
  } catch {
    return {};
  }
}

export function recordDastgahQuizResult(
  dastgahId: string,
  isCorrect: boolean
): Record<string, DastgahMasteryEntry> {
  const current = loadDastgahMastery();
  const prev = current[dastgahId] ?? { dastgahId, attempts: 0, correct: 0 };
  const next: Record<string, DastgahMasteryEntry> = {
    ...current,
    [dastgahId]: {
      dastgahId,
      attempts: prev.attempts + 1,
      correct: prev.correct + (isCorrect ? 1 : 0),
    },
  };
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(MASTERY_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}
