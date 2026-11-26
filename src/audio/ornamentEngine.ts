import { noteToFrequency } from '../data/musicTheory';
import type {
  InstrumentId,
  KoronMode,
  OrnamentType,
  PersianNoteSpec,
} from '../types/music';

export interface OrnamentVoiceEvent {
  offsetSec: number;
  frequencyHz: number;
  durationSec: number;
  velocity: number;
  ornament?: OrnamentType;
  slideFromHz?: number;
}

/**
 * Finds the authentic modal upper (or lower) neighbor frequency in the active Dastgah scale.
 * Falls back cleanly to a neutral Persian second (+150¢ / -150¢) when no scale is provided.
 */
export function resolveModalNeighborHz(
  baseFreqHz: number,
  direction: 'up' | 'down',
  scale: PersianNoteSpec[] | undefined,
  a4Hz: number,
  koronMode: KoronMode
): number {
  if (scale && scale.length >= 3) {
    // Build a multi-octave candidate pool of scale frequencies so upper/lower neighbors
    // always stay strictly inside the Dastgah's authentic microtonal tuning.
    const candidates: number[] = [];
    for (const n of scale) {
      for (let octShift = -1; octShift <= 1; octShift++) {
        const oct = n.octave + octShift;
        if (oct < 2 || oct > 6) continue;
        candidates.push(noteToFrequency({ ...n, octave: oct }, a4Hz, koronMode));
      }
    }
    candidates.sort((a, b) => a - b);

    if (direction === 'up') {
      const upper = candidates.find((f) => f > baseFreqHz * 1.035 && f < baseFreqHz * 1.28);
      if (upper) return upper;
    } else {
      for (let i = candidates.length - 1; i >= 0; i--) {
        const f = candidates[i];
        if (f < baseFreqHz * 0.965 && f > baseFreqHz * 0.78) return f;
      }
    }
  }
  const fallbackCents = direction === 'up' ? 150 : -150;
  return baseFreqHz * Math.pow(2, fallbackCents / 1200);
}

/**
 * Expands a single Radif melody note into physically expressive Persian ornament micro-events:
 * - eshareh (اشاره): swift modal grace-note touch landing on target pitch
 * - tekieh (تکیه): expressive modal upper inflection and return
 * - riz (ریز): authentic rapid alternating down/up plectrum/mallet tremolo roll
 * - dorab (دراب): crisp 4-stroke rhythmic Persian flourish
 * - tahrir (تحریر): vocal/Ney/Kamancheh microtonal break & ~6 Hz undulation
 * - automatic malesh (مالش): smooth microtonal slide on Kamancheh / Ney between close pitches
 */
export function expandNoteWithOrnaments(params: {
  baseFreqHz: number;
  durationSec: number;
  instrument: InstrumentId;
  ornament?: OrnamentType;
  velocity?: number;
  enableOrnaments?: boolean;
  scale?: PersianNoteSpec[];
  a4Hz?: number;
  koronMode?: KoronMode;
  prevFreqHz?: number;
}): OrnamentVoiceEvent[] {
  const {
    baseFreqHz,
    durationSec,
    instrument,
    ornament,
    velocity = 0.85,
    enableOrnaments = true,
    scale,
    a4Hz = 440,
    koronMode = 'standard_50',
    prevFreqHz,
  } = params;

  const isContinuous = instrument === 'ney' || instrument === 'kamancheh';
  const closeSlide =
    enableOrnaments &&
    isContinuous &&
    typeof prevFreqHz === 'number' &&
    prevFreqHz > 40 &&
    Math.abs(1200 * Math.log2(baseFreqHz / prevFreqHz)) > 25 &&
    Math.abs(1200 * Math.log2(baseFreqHz / prevFreqHz)) <= 360
      ? prevFreqHz
      : undefined;

  if (!enableOrnaments || !ornament) {
    return [
      {
        offsetSec: 0,
        frequencyHz: baseFreqHz,
        durationSec,
        velocity,
        slideFromHz: closeSlide,
      },
    ];
  }

  const upperHz = resolveModalNeighborHz(baseFreqHz, 'up', scale, a4Hz, koronMode);
  const lowerHz = resolveModalNeighborHz(baseFreqHz, 'down', scale, a4Hz, koronMode);

  if (ornament === 'eshareh') {
    const graceDur = Math.min(0.085, durationSec * 0.22);
    const graceOffset = Math.min(0.055, durationSec * 0.16);
    return [
      {
        offsetSec: 0,
        frequencyHz: upperHz,
        durationSec: Math.max(0.06, graceDur),
        velocity: velocity * 0.54,
      },
      {
        offsetSec: graceOffset,
        frequencyHz: baseFreqHz,
        durationSec: Math.max(0.14, durationSec),
        velocity,
        slideFromHz: isContinuous ? upperHz : undefined,
      },
    ];
  }

  if (ornament === 'tekieh') {
    const step1 = Math.min(0.085, durationSec * 0.24);
    const step2 = Math.min(0.155, durationSec * 0.42);
    return [
      {
        offsetSec: 0,
        frequencyHz: baseFreqHz,
        durationSec: Math.max(0.11, durationSec * 0.42),
        velocity: velocity * 0.86,
        slideFromHz: closeSlide,
      },
      {
        offsetSec: step1,
        frequencyHz: upperHz,
        durationSec: Math.max(0.08, durationSec * 0.24),
        velocity: velocity * 0.66,
      },
      {
        offsetSec: step2,
        frequencyHz: baseFreqHz,
        durationSec: Math.max(0.16, durationSec * 0.72),
        velocity: velocity * 0.92,
      },
    ];
  }

  if (ornament === 'dorab') {
    const step = Math.min(0.064, durationSec * 0.16);
    return [
      {
        offsetSec: 0,
        frequencyHz: upperHz,
        durationSec: Math.max(0.08, step * 1.6),
        velocity: velocity * 0.68,
      },
      {
        offsetSec: step,
        frequencyHz: baseFreqHz,
        durationSec: Math.max(0.09, step * 1.7),
        velocity: velocity * 0.78,
      },
      {
        offsetSec: step * 2,
        frequencyHz: lowerHz,
        durationSec: Math.max(0.08, step * 1.5),
        velocity: velocity * 0.66,
      },
      {
        offsetSec: step * 3,
        frequencyHz: baseFreqHz,
        durationSec: Math.max(0.18, durationSec * 0.86),
        velocity: Math.min(1, velocity * 0.96),
      },
    ];
  }

  if (ornament === 'riz') {
    // Bowed/wind instruments perform continuous tremolo; plucked/hammered perform real rapid multi-stroke Riz!
    if (isContinuous) {
      return [
        {
          offsetSec: 0,
          frequencyHz: baseFreqHz,
          durationSec,
          velocity,
          ornament: 'riz',
          slideFromHz: closeSlide,
        },
      ];
    }

    const strokeGapSec = instrument === 'santur' ? 0.044 : 0.052;
    const strokeCount = Math.max(4, Math.min(11, Math.floor((durationSec * 0.85) / strokeGapSec)));
    const events: OrnamentVoiceEvent[] = [];
    for (let i = 0; i < strokeCount; i++) {
      const progress = strokeCount > 1 ? i / (strokeCount - 1) : 0;
      // Natural musical arch: gentle crescendo into center of Riz, tapering at release
      const arch = 0.68 + 0.32 * Math.sin(Math.PI * progress);
      // Alternating right/left mezrab (راست و چپ) articulation balance
      const handFactor = i % 2 === 0 ? 1.0 : 0.84;
      const isLast = i === strokeCount - 1;
      events.push({
        offsetSec: i * strokeGapSec,
        frequencyHz: baseFreqHz,
        durationSec: isLast ? Math.max(0.24, durationSec * 0.45) : strokeGapSec * 2.1,
        velocity: Math.min(0.98, velocity * arch * handFactor * 0.78),
      });
    }
    return events;
  }

  // ornament === 'tahrir'
  if (isContinuous) {
    // Ney / Kamancheh: authentic glottal/bow break flick to modal upper step + 6 Hz Tahrir undulation
    const flickAt = Math.min(0.14, durationSec * 0.3);
    return [
      {
        offsetSec: 0,
        frequencyHz: baseFreqHz,
        durationSec: Math.max(0.22, durationSec),
        velocity,
        ornament: 'tahrir',
        slideFromHz: closeSlide,
      },
      {
        offsetSec: flickAt,
        frequencyHz: upperHz,
        durationSec: Math.min(0.11, durationSec * 0.25),
        velocity: velocity * 0.44,
      },
    ];
  }

  // Plucked strings rendering Tahrir (imitation of vocal Tahrir via quick upper grace echo)
  const echoAt = Math.min(0.12, durationSec * 0.3);
  return [
    {
      offsetSec: 0,
      frequencyHz: baseFreqHz,
      durationSec: Math.max(0.2, durationSec * 0.55),
      velocity: velocity * 0.88,
      ornament: 'tahrir',
    },
    {
      offsetSec: echoAt,
      frequencyHz: upperHz,
      durationSec: 0.095,
      velocity: velocity * 0.56,
    },
    {
      offsetSec: echoAt + 0.068,
      frequencyHz: baseFreqHz,
      durationSec: Math.max(0.18, durationSec * 0.7),
      velocity: velocity * 0.86,
      ornament: 'tahrir',
    },
  ];
}
