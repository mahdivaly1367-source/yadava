import { describe, expect, it } from 'vitest';
import { EAR_PLACEMENT_QUESTIONS, evaluatePlacementAnswers } from '../core/placement';
import {
  buildDailyPracticePlan,
  computeEarnedBadges,
  recommendNextSession,
  reviewSrsCard,
  scoreToSrsQuality,
} from '../core/srs';
import { createEmptyUserState } from '../services/sessionStore';

describe('SM-2 Spaced Repetition & Adaptive Session Planner', () => {
  it('progresses intervals correctly on strong recalls (1 -> 6 -> EF*6) and resets on failure', () => {
    const t0 = 1_700_000_000_000;
    const c1 = reviewSrsCard(undefined, 'shur_daramad_1', 5, t0);
    expect(c1.repetitions).toBe(1);
    expect(c1.intervalDays).toBe(1);
    expect(c1.easeFactor).toBeGreaterThanOrEqual(2.5);

    const c2 = reviewSrsCard(c1, 'shur_daramad_1', 4, t0 + 86400_000);
    expect(c2.repetitions).toBe(2);
    expect(c2.intervalDays).toBe(6);

    const c3 = reviewSrsCard(c2, 'shur_daramad_1', 5, t0 + 7 * 86400_000);
    expect(c3.repetitions).toBe(3);
    expect(c3.intervalDays).toBeGreaterThanOrEqual(15);

    // Failed recall (quality = 1) resets repetitions and interval to 1 day
    const cFail = reviewSrsCard(c3, 'shur_daramad_1', 1, t0 + 25 * 86400_000);
    expect(cFail.repetitions).toBe(0);
    expect(cFail.intervalDays).toBe(1);
    expect(cFail.easeFactor).toBeGreaterThanOrEqual(1.3);
  });

  it('prioritizes overdue SM-2 cards first in Smart Next Session and respects Free tier', () => {
    const now = 1_750_000_000_000;
    const state = createEmptyUserState('guest', 'مهمان', now);
    state.srsCards = {
      // Locked Pro card that is overdue -> must NOT be recommended when isPro=false
      homayun_bidad: {
        gushehId: 'homayun_bidad',
        easeFactor: 2.1,
        intervalDays: 1,
        repetitions: 1,
        nextReviewAt: now - 10_000,
        lastQuality: 2,
        updatedAt: now - 100_000,
      },
      // Free card that is overdue -> MUST be recommended!
      abuata_hejaz: {
        gushehId: 'abuata_hejaz',
        easeFactor: 2.3,
        intervalDays: 1,
        repetitions: 1,
        nextReviewAt: now - 5_000,
        lastQuality: 3,
        updatedAt: now - 50_000,
      },
    };

    const recFree = recommendNextSession(state, false, now);
    expect(recFree.gusheh.id).toBe('abuata_hejaz');
    expect(recFree.dueCardsCount).toBe(1);

    const recPro = recommendNextSession(state, true, now);
    expect(recPro.gusheh.id).toBe('homayun_bidad');
    expect(recPro.dueCardsCount).toBe(2);
  });

  it('builds a 4-step daily plan totaling exactly 15 minutes', () => {
    const state = createEmptyUserState('guest');
    const plan = buildDailyPracticePlan(state, false);
    expect(plan).toHaveLength(4);
    const totalMinutes = plan.reduce((sum, s) => sum + s.minutes, 0);
    expect(totalMinutes).toBe(15);
  });

  it('evaluates placement test answers and awards badges accurately', () => {
    const perfectEar: Record<string, string> = {};
    for (const q of EAR_PLACEMENT_QUESTIONS) {
      perfectEar[q.id] = q.correctOptionId;
    }
    const res = evaluatePlacementAnswers({
      earAnswers: perfectEar,
      pitchScores: { 'pitch-t1-g4': 92, 'pitch-t2-ak4': 88 },
    });
    expect(res.earScore).toBe(100);
    expect(res.pitchScore).toBe(90);
    expect(res.recommendedLevel).toBe('advanced');

    expect(scoreToSrsQuality(95, 92)).toBe(5);
    expect(scoreToSrsQuality(40, 40)).toBe(1);

    const badges = computeEarnedBadges(
      [
        {
          id: 's1',
          gushehId: 'shur_daramad_1',
          dastgahId: 'shur',
          instrument: 'tar',
          durationSeconds: 180,
          accuracyPercent: 90,
          foroudScore: 95,
          tahrirDetected: true,
          avgCentsError: 5,
          completedAt: Date.now(),
        },
      ],
      7,
      true
    );
    expect(badges).toContain('first_session');
    expect(badges).toContain('koron_ear');
    expect(badges).toContain('tahrir_master');
    expect(badges).toContain('foroud_precision');
    expect(badges).toContain('streak_7');
    expect(badges).toContain('placement_done');
  });
});
