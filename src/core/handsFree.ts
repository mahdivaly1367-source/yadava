export type HandsFreePhase =
  | 'idle'
  | 'master_playing'
  | 'countdown'
  | 'student_listening'
  | 'review_score';

export interface HandsFreeConfig {
  autoAdvanceThreshold: number; // e.g. 82% accuracy auto-advances to next gusheh
  countdownBeats: number;       // 3 -> 2 -> 1
  reviewPauseMs: number;        // 2200ms score display before next cycle
}

export interface HandsFreeCycleEvaluation {
  accuracyPercent: number;
  passed: boolean;
  action: 'advance_next_gusheh' | 'repeat_phrase';
  feedbackFa: string;
}

export function evaluateHandsFreeCycle(
  accuracySamples: number[],
  thresholdPercent = 82
): HandsFreeCycleEvaluation {
  const accuracyPercent =
    accuracySamples.length > 0
      ? Math.round(
          accuracySamples.reduce((a, b) => a + b, 0) / accuracySamples.length
        )
      : 0;

  if (accuracySamples.length === 0) {
    return {
      accuracyPercent: 0,
      passed: false,
      action: 'repeat_phrase',
      feedbackFa: 'صدایی دریافت نشد؛ جمله دوباره برای شما پخش می‌شود.',
    };
  }

  if (accuracyPercent >= thresholdPercent) {
    return {
      accuracyPercent,
      passed: true,
      action: 'advance_next_gusheh',
      feedbackFa: `عالی! دقت ${accuracyPercent}٪ (بالاتر از حد نصاب ${thresholdPercent}٪) — انتقال خودکار به گوشه بعدی!`,
    };
  }

  return {
    accuracyPercent,
    passed: false,
    action: 'repeat_phrase',
    feedbackFa: `دقت این دور ${accuracyPercent}٪ بود (هدف ${thresholdPercent}٪) — تکرار خودکار همین جمله...`,
  };
}
