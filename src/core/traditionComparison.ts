import { formatNoteFa, noteToCentsFromC0 } from '../data/musicTheory';
import { getGushehTraditionComparison, TRADITION_BY_ID } from '../data/radifTraditions';
import type { Gusheh, KoronMode, MelodyNote, RadifTraditionId } from '../types/music';

export interface TraditionVariation {
  traditionId: RadifTraditionId;
  nameFa: string;
  shortNameFa: string;
  categoryFa: string;
  recommendedKoronMode: KoronMode;
  recommendedBpm: number;
  melody: MelodyNote[];
  phrasingFa: string;
  foroudCueFa: string;
  ornamentSummaryFa: string;
}

export interface TraditionComparisonReport {
  gushehNameFa: string;
  variantA: TraditionVariation;
  variantB: TraditionVariation;
  bpmDelta: number;
  ornamentDiffCount: number;
  durationDiffPercent: number;
  keyDifferencesFa: string[];
}

/**
 * Generates an authentic stylistic variation of a Gusheh melody tailored to
 * one of the 4 classical Iranian Radif traditions (Mirza Abdollah, Karimi, Saba, Davami).
 */
export function buildTraditionVariation(
  gusheh: Gusheh,
  traditionId: RadifTraditionId
): TraditionVariation {
  const info = TRADITION_BY_ID[traditionId];
  const note =
    getGushehTraditionComparison(gusheh).find((t) => t.traditionId === traditionId) ?? {
      traditionId,
      phrasingFa: info.characterFa,
      moteghayerNoteFa: '',
      foroudCueFa: info.foroudStyleFa,
      recommendedKoronFa: '',
    };
  const baseBpm = gusheh.practiceLoop.defaultBpm;
  const recommendedBpm = Math.max(48, Math.min(165, Math.round(baseBpm * info.tempoFactor)));
  const recommendedKoronMode: KoronMode =
    traditionId === 'davami' || traditionId === 'mahmoud_karimi'
      ? 'traditional_56'
      : 'standard_50';

  const melody: MelodyNote[] = gusheh.melody.map((n, idx, arr) => {
    const isLast = idx === arr.length - 1;
    const isPenultimate = idx === arr.length - 2;
    const isPeak =
      noteToCentsFromC0(n, recommendedKoronMode) >=
      Math.max(...arr.map((x) => noteToCentsFromC0(x, recommendedKoronMode))) - 30;

    if (traditionId === 'mirza_abdollah') {
      // Instrumental crisp phrasing: dorab/riz accents, crisp endings
      return {
        ...n,
        ornament: isLast ? 'riz' : idx === 0 ? 'dorab' : n.ornament,
      };
    }

    if (traditionId === 'mahmoud_karimi') {
      // Vocal rubato & expressive Tahrir on peak and stretched penultimate cadence
      return {
        ...n,
        durationBeats: isPeak || isLast ? Number((n.durationBeats * 1.25).toFixed(2)) : n.durationBeats,
        ornament: isPeak ? 'tahrir' : isPenultimate ? 'eshareh' : n.ornament,
        isTahrirZone: isPeak || n.isTahrirZone,
      };
    }

    if (traditionId === 'saba') {
      // Flowing pedagogical phrasing with graceful eshareh/tekieh & slightly brisker gait
      return {
        ...n,
        durationBeats: Number(Math.max(0.5, n.durationBeats * 0.94).toFixed(2)),
        ornament: idx % 3 === 1 ? 'eshareh' : isLast ? 'tekieh' : n.ornament,
      };
    }

    // Davami: authoritative classical vocal phrasing with strong tekieh & hammered tahrir
    return {
      ...n,
      durationBeats: isLast ? Number((n.durationBeats * 1.2).toFixed(2)) : n.durationBeats,
      ornament: isPeak ? 'tahrir' : idx === 0 ? 'tekieh' : n.ornament,
    };
  });

  return {
    traditionId,
    nameFa: info.nameFa,
    shortNameFa: info.shortNameFa,
    categoryFa: info.categoryFa,
    recommendedKoronMode,
    recommendedBpm,
    melody,
    phrasingFa: note.phrasingFa,
    foroudCueFa: note.foroudCueFa,
    ornamentSummaryFa: info.ornamentFocusFa,
  };
}

/**
 * Compares two Radif traditions side-by-side (A/B) for a given Gusheh.
 */
export function compareRadifTraditions(
  gusheh: Gusheh,
  traditionA: RadifTraditionId,
  traditionB: RadifTraditionId
): TraditionComparisonReport {
  const variantA = buildTraditionVariation(gusheh, traditionA);
  const variantB = buildTraditionVariation(gusheh, traditionB);

  let ornamentDiffCount = 0;
  let totalBeatsA = 0;
  let totalBeatsB = 0;

  for (let i = 0; i < variantA.melody.length; i++) {
    const a = variantA.melody[i];
    const b = variantB.melody[i];
    totalBeatsA += a.durationBeats;
    totalBeatsB += b.durationBeats;
    if (a.ornament !== b.ornament) ornamentDiffCount++;
  }

  const bpmDelta = variantB.recommendedBpm - variantA.recommendedBpm;
  const durationDiffPercent = Math.round(
    ((totalBeatsB - totalBeatsA) / Math.max(0.1, totalBeatsA)) * 100
  );

  const keyDifferencesFa: string[] = [
    `تمپوی پیشنهادی: ${variantA.shortNameFa} (${variantA.recommendedBpm} BPM) در برابر ${variantB.shortNameFa} (${variantB.recommendedBpm} BPM).`,
    `شیوه کُرُن: ${variantA.shortNameFa} (${variantA.recommendedKoronMode === 'traditional_56' ? 'سنتی -۵۶¢' : 'استاندارد -۵۰¢'}) در مقایسه با ${variantB.shortNameFa} (${variantB.recommendedKoronMode === 'traditional_56' ? 'سنتی -۵۶¢' : 'استاندارد -۵۰¢'}).`,
    `تفاوت زینت‌گذاری: در ${ornamentDiffCount} نت از ${variantA.melody.length} نت، نوع مضراب/تحریر بین دو روایت متفاوت است.`,
    `نت شاهد (${formatNoteFa(gusheh.shahed)}) و ایست (${formatNoteFa(gusheh.ist)}) در هر دو روایت حفظ می‌شود، اما کشش و نوع فرود تغییر می‌کند.`,
  ];

  return {
    gushehNameFa: gusheh.nameFa,
    variantA,
    variantB,
    bpmDelta,
    ornamentDiffCount,
    durationDiffPercent,
    keyDifferencesFa,
  };
}
