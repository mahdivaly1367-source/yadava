import {
  formatNoteFa,
  noteToFrequency,
} from '../data/musicTheory';
import type {
  Gusheh,
  KoronMode,
  MelodyNote,
  PersianNoteSpec,
} from '../types/music';

export interface CallPhrase {
  id: string;
  labelFa: string;
  promptHintFa: string;
  notes: MelodyNote[];
}

export interface ImprovisationEvaluation {
  overallScore: number; // 0..100
  scaleAdherencePercent: number;
  shahedEmphasisPercent: number;
  foroudCadencePercent: number;
  melodicRichnessPercent: number;
  detectedNoteCount: number;
  uniqueScaleDegrees: number;
  masterFeedbackFa: string;
  xpAwarded: number;
}

/**
 * Generates an authentic modal "سؤال" (Call) phrase anchored on the Gusheh's
 * Aghaz, Shahed, Moteghayer, and Ist so the student can answer idiomatically.
 */
export function generateModalCallPhrase(
  gusheh: Gusheh,
  roundIndex: number = 0
): CallPhrase {
  const len = gusheh.melody.length;
  const sliceLen = Math.min(5, Math.max(3, Math.floor(len / 2)));
  const maxStart = Math.max(0, len - sliceLen);
  const start = maxStart > 0 ? (roundIndex * 2) % (maxStart + 1) : 0;
  const chosen = gusheh.melody.slice(start, start + sliceLen);

  // End the Call phrase on an open-ended note (Shahed or neighbor) inviting the student's Foroud answer
  const callNotes: MelodyNote[] =
    chosen.length >= 3
      ? chosen.map((n, idx) => ({
          ...n,
          durationBeats: idx === chosen.length - 1 ? 1.5 : Math.min(1.25, n.durationBeats),
        }))
      : [
          { ...gusheh.aghaz, durationBeats: 1 },
          { ...gusheh.shahed, durationBeats: 1.5, ornament: gusheh.ornaments[0] },
          { ...gusheh.ist, durationBeats: 1 },
        ];

  const shahedFa = formatNoteFa(gusheh.shahed, false);
  const istFa = formatNoteFa(gusheh.ist, false);

  return {
    id: `${gusheh.id}_call_${roundIndex}`,
    labelFa: `جمله سؤال ${roundIndex + 1} — ${gusheh.nameFa}`,
    promptHintFa: `با تأکید بر شاهد «${shahedFa}» پاسخ دهید و جمله را با فرود آرام روی «${istFa}» ببندید.`,
    notes: callNotes,
  };
}

function nearestScaleErrorCents(
  freqHz: number,
  scale: PersianNoteSpec[],
  a4Hz: number,
  koronMode: KoronMode
): { minCents: number; matchedDegreeIdx: number } {
  let minCents = Infinity;
  let matchedDegreeIdx = 0;

  for (let i = 0; i < scale.length; i++) {
    const base = scale[i];
    for (let octShift = -1; octShift <= 1; octShift++) {
      const oct = base.octave + octShift;
      if (oct < 2 || oct > 6) continue;
      const targetHz = noteToFrequency({ ...base, octave: oct }, a4Hz, koronMode);
      const err = Math.abs(1200 * Math.log2(freqHz / targetHz));
      if (err < minCents) {
        minCents = err;
        matchedDegreeIdx = i;
      }
    }
  }
  return { minCents, matchedDegreeIdx };
}

function pitchClassDistanceCents(
  freqHz: number,
  target: PersianNoteSpec,
  a4Hz: number,
  koronMode: KoronMode
): number {
  let best = Infinity;
  for (let oct = 2; oct <= 6; oct++) {
    const ref = noteToFrequency({ ...target, octave: oct }, a4Hz, koronMode);
    const d = Math.abs(1200 * Math.log2(freqHz / ref));
    if (d < best) best = d;
  }
  return best;
}

/**
 * Evaluates a student's improvised "جواب" (Response) pitch stream against authentic
 * Iranian modal grammar:
 * 1. Scale / microtonal Koron-Sori adherence (40%)
 * 2. Shahed modal center emphasis (25%)
 * 3. Foroud cadence landing on Ist (25%)
 * 4. Melodic contour richness (10%)
 */
export function evaluateImprovisedResponse(
  capturedFreqsHz: number[],
  gusheh: Gusheh,
  a4Hz: number = 440,
  koronMode: KoronMode = 'standard_50'
): ImprovisationEvaluation {
  const valid = capturedFreqsHz.filter((f) => Number.isFinite(f) && f >= 75 && f <= 2000);
  if (valid.length < 3) {
    return {
      overallScore: 0,
      scaleAdherencePercent: 0,
      shahedEmphasisPercent: 0,
      foroudCadencePercent: 0,
      melodicRichnessPercent: 0,
      detectedNoteCount: valid.length,
      uniqueScaleDegrees: 0,
      masterFeedbackFa:
        'پاسخ صوتی کافی دریافت نشد؛ لطفاً جمله پاسخ خود را با صدای واضح‌تر بنوازید یا بخوانید.',
      xpAwarded: 0,
    };
  }

  let inScaleCount = 0;
  let shahedCount = 0;
  const visitedDegrees = new Set<number>();

  for (const f of valid) {
    const { minCents, matchedDegreeIdx } = nearestScaleErrorCents(
      f,
      gusheh.scale,
      a4Hz,
      koronMode
    );
    if (minCents <= 34) {
      inScaleCount++;
      visitedDegrees.add(matchedDegreeIdx);
    }
    if (pitchClassDistanceCents(f, gusheh.shahed, a4Hz, koronMode) <= 36) {
      shahedCount++;
    }
  }

  const scaleAdherencePercent = Math.round((inScaleCount / valid.length) * 100);

  // Ideal Shahed presence in Iranian improvisation is ~18%–55% of frames
  const shahedRatio = shahedCount / valid.length;
  const shahedEmphasisPercent =
    shahedRatio <= 0
      ? 10
      : shahedRatio < 0.18
      ? Math.round(40 + (shahedRatio / 0.18) * 55)
      : shahedRatio <= 0.65
      ? 100
      : Math.max(55, Math.round(100 - (shahedRatio - 0.65) * 110));

  // Evaluate tail 25% of frames for authentic Foroud cadence onto Ist (or Shahed if identical)
  const tailStart = Math.max(0, Math.floor(valid.length * 0.72));
  const tail = valid.slice(tailStart);
  const avgTailErr =
    tail.reduce(
      (sum, f) => sum + pitchClassDistanceCents(f, gusheh.ist, a4Hz, koronMode),
      0
    ) / tail.length;
  const foroudCadencePercent = Math.max(
    0,
    Math.min(100, Math.round(100 - Math.max(0, avgTailErr - 12) * 1.45))
  );

  // Melodic contour richness (ideal: 3 to 6 distinct scale degrees)
  const uniqueDegrees = visitedDegrees.size;
  const melodicRichnessPercent =
    uniqueDegrees >= 4 ? 100 : uniqueDegrees === 3 ? 85 : uniqueDegrees === 2 ? 60 : 30;

  const overallScore = Math.round(
    scaleAdherencePercent * 0.4 +
      shahedEmphasisPercent * 0.25 +
      foroudCadencePercent * 0.25 +
      melodicRichnessPercent * 0.1
  );

  const shahedFa = formatNoteFa(gusheh.shahed, false);
  const istFa = formatNoteFa(gusheh.ist, false);
  let masterFeedbackFa: string;
  if (overallScore >= 85) {
    masterFeedbackFa = `آفرین! پاسخ شما کاملاً در حال‌وهوای «${gusheh.nameFa}» بود؛ وفاداری به فواصل ربع‌پرده و فرود روی «${istFa}» عالی انجام شد.`;
  } else if (foroudCadencePercent < 65) {
    masterFeedbackFa = `ملودی خوبی آغاز کردید، اما در پایان جمله برای فرود اصیل‌تر روی نت ایست «${istFa}» مکث و استقرار بیشتری بدهید.`;
  } else if (shahedEmphasisPercent < 65) {
    masterFeedbackFa = `برای تثبیت هویت «${gusheh.nameFa}»، در میانه پاسخ یک‌بار دیگر به نت شاهد «${shahedFa}» تکیه کنید.`;
  } else {
    masterFeedbackFa = `تلاش ارزشمندی بود؛ دقت روی پرده‌های ربع‌پرده گام ${gusheh.nameFa} را کمی بالاتر ببرید تا رنگ دستگاه شفاف‌تر شود.`;
  }

  return {
    overallScore,
    scaleAdherencePercent,
    shahedEmphasisPercent,
    foroudCadencePercent,
    melodicRichnessPercent,
    detectedNoteCount: valid.length,
    uniqueScaleDegrees: uniqueDegrees,
    masterFeedbackFa,
    xpAwarded: overallScore >= 80 ? 35 : overallScore >= 55 ? 20 : 10,
  };
}
