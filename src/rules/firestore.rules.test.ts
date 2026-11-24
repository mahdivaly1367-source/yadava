/**
 * Isolated Firestore Security Rules Test Suite
 * Executed against Firebase Firestore Emulator using `firebase.emulator.json`
 * and demo project ID `demo-navanegar-rules`:
 *
 *   npm run test:rules
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  increment,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

const PROJECT_ID = 'demo-navanegar-rules';
const RULES_PATH = path.resolve(process.cwd(), 'firestore.rules');

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: '127.0.0.1',
      port: 8089,
      rules: fs.readFileSync(RULES_PATH, 'utf8'),
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

afterAll(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});

describe('Navanegar Firestore Security Rules (demo-navanegar-rules)', () => {
  const now = 1_760_000_000_000;

  it('enforces strict owner isolation on users/{uid} and atomic writeBatch for practice & placement', async () => {
    const aliceDb = testEnv.authenticatedContext('alice').firestore();
    const bobDb = testEnv.authenticatedContext('bob').firestore();
    const guestDb = testEnv.unauthenticatedContext().firestore();

    // Atomic writeBatch: practice session + SRS card + profile
    const batch = writeBatch(aliceDb);
    batch.set(doc(aliceDb, 'users', 'alice'), {
      uid: 'alice',
      displayName: 'آلیس',
      level: 'beginner',
      totalPracticeMinutes: 15,
      streakDays: 1,
      averageAccuracy: 88,
      weakIntervals: ['koron'],
      badges: ['first_session'],
      placementCompleted: false,
      createdAt: now,
      updatedAt: now,
    });
    batch.set(doc(aliceDb, 'users', 'alice', 'srs_cards', 'shur_daramad_1'), {
      gushehId: 'shur_daramad_1',
      easeFactor: 2.5,
      intervalDays: 1,
      repetitions: 1,
      nextReviewAt: now + 86400_000,
      lastQuality: 4,
      updatedAt: now,
    });
    batch.set(doc(aliceDb, 'users', 'alice', 'practice_sessions', 'sess_1'), {
      gushehId: 'shur_daramad_1',
      dastgahId: 'shur',
      instrument: 'tar',
      durationSeconds: 300,
      accuracyPercent: 88,
      foroudScore: 91,
      tahrirDetected: true,
      avgCentsError: 6.2,
      completedAt: now,
    });

    await assertSucceeds(batch.commit());

    // Bob and Guest CANNOT read or overwrite Alice's private records
    await assertFails(getDoc(doc(bobDb, 'users', 'alice')));
    await assertFails(getDoc(doc(guestDb, 'users', 'alice')));
    await assertFails(getDoc(doc(bobDb, 'users', 'alice', 'srs_cards', 'shur_daramad_1')));

    // Atomic writeBatch: placement test + profile upgrade
    const placementBatch = writeBatch(aliceDb);
    placementBatch.set(doc(aliceDb, 'users', 'alice', 'placement_tests', 'pl_1'), {
      earScore: 90,
      pitchScore: 85,
      recommendedLevel: 'advanced',
      weakIntervals: ['tahrir'],
      completedAt: now + 1000,
    });
    placementBatch.update(doc(aliceDb, 'users', 'alice'), {
      level: 'advanced',
      placementCompleted: true,
      updatedAt: now + 1000,
    });
    await assertSucceeds(placementBatch.commit());
  });

  it('enforces safe saved_recordings updates with monotonic updatedAt and owner immutability', async () => {
    const aliceDb = testEnv.authenticatedContext('alice').firestore();
    const bobDb = testEnv.authenticatedContext('bob').firestore();

    const recData = {
      ownerUid: 'alice',
      ownerName: 'آلیس',
      gushehId: 'shur_daramad_1',
      dastgahId: 'shur',
      instrument: 'tar',
      title: 'تمرین درآمد شور',
      durationSeconds: 45,
      avgAccuracy: 89,
      rmsDb: -16.5,
      envelope: [0.2, 0.6, 0.8],
      isPublic: false,
      createdAt: now,
      updatedAt: now,
    };

    await assertSucceeds(setDoc(doc(aliceDb, 'saved_recordings', 'rec_1'), recData));

    // Private recording is invisible to Bob
    await assertFails(getDoc(doc(bobDb, 'saved_recordings', 'rec_1')));

    // Updating without advancing updatedAt MUST FAIL
    await assertFails(
      updateDoc(doc(aliceDb, 'saved_recordings', 'rec_1'), {
        isPublic: true,
        updatedAt: now,
      })
    );

    // Tampering with immutable ownerUid MUST FAIL
    await assertFails(
      updateDoc(doc(aliceDb, 'saved_recordings', 'rec_1'), {
        ownerUid: 'bob',
        updatedAt: now + 500,
      })
    );

    // Valid safe update with monotonic updatedAt SUCCEEDS and unlocks public read
    await assertSucceeds(
      updateDoc(doc(aliceDb, 'saved_recordings', 'rec_1'), {
        title: 'درآمد شور (نسخه عمومی)',
        isPublic: true,
        updatedAt: now + 1000,
      })
    );

    await assertSucceeds(getDoc(doc(bobDb, 'saved_recordings', 'rec_1')));
    // Bob still cannot edit Alice's recording
    await assertFails(
      updateDoc(doc(bobDb, 'saved_recordings', 'rec_1'), {
        title: 'خرابکاری',
        updatedAt: now + 2000,
      })
    );
  });

  it('blocks spoofed forum replyCount increments and permits genuine atomic writeBatch replies', async () => {
    const aliceDb = testEnv.authenticatedContext('alice').firestore();
    const bobDb = testEnv.authenticatedContext('bob').firestore();

    await assertSucceeds(
      setDoc(doc(aliceDb, 'forum_posts', 'post_1'), {
        authorUid: 'alice',
        authorName: 'آلیس',
        title: 'پرسش درباره کوک لا کُرُن در شور',
        body: 'چگونه کوک دقیق -۵۶ سنت را روی تار بگیریم؟',
        dastgahId: 'shur',
        tags: ['شور', 'کُرُن'],
        replyCount: 0,
        lastReplyId: null,
        createdAt: now,
        updatedAt: now,
      })
    );

    // ATTACK 1: Spoofed replyCount increment without creating a reply doc -> MUST FAIL
    await assertFails(
      updateDoc(doc(bobDb, 'forum_posts', 'post_1'), {
        replyCount: increment(1),
        lastReplyId: 'fake_nonexistent_reply',
        updatedAt: now + 500,
      })
    );

    // ATTACK 2: Spoofed increment by +5 -> MUST FAIL
    await assertFails(
      updateDoc(doc(bobDb, 'forum_posts', 'post_1'), {
        replyCount: increment(5),
        lastReplyId: 'rep_1',
        updatedAt: now + 500,
      })
    );

    // LEGITIMATE ATOMIC writeBatch: creates brand-new reply AND increments replyCount by 1 with matching lastReplyId
    const replyBatch = writeBatch(bobDb);
    replyBatch.set(doc(bobDb, 'forum_posts', 'post_1', 'replies', 'rep_0001'), {
      postId: 'post_1',
      authorUid: 'bob',
      authorName: 'باب',
      body: 'حالت کُرُن سنتی (-۵۶ سنت) را در کارگاه تمرین فعال کنید.',
      createdAt: now + 1000,
    });
    replyBatch.update(doc(bobDb, 'forum_posts', 'post_1'), {
      replyCount: increment(1),
      lastReplyId: 'rep_0001',
      updatedAt: now + 1000,
    });
    await assertSucceeds(replyBatch.commit());

    // ATTACK 3: Replaying an already-existing replyId (`!exists` check) -> MUST FAIL
    await assertFails(
      updateDoc(doc(bobDb, 'forum_posts', 'post_1'), {
        replyCount: increment(1),
        lastReplyId: 'rep_0001',
        updatedAt: now + 2000,
      })
    );
  });

  it('enforces host-only playback control on practice_rooms while allowing participant updates', async () => {
    const hostDb = testEnv.authenticatedContext('host_1').firestore();
    const memberDb = testEnv.authenticatedContext('member_1').firestore();

    await assertSucceeds(
      setDoc(doc(hostDb, 'practice_rooms', 'room_1'), {
        hostUid: 'host_1',
        hostName: 'استاد سارا',
        title: 'هم‌نوازی درآمد شور',
        dastgahId: 'shur',
        gushehId: 'shur_daramad_1',
        instrument: 'tar',
        tempoBpm: 76,
        meter: '6/8',
        metronomeActive: false,
        isPlaying: false,
        activeParticipants: ['host_1'],
        createdAt: now,
        updatedAt: now,
      })
    );

    // Member CANNOT hijack host tempo/gusheh
    await assertFails(
      updateDoc(doc(memberDb, 'practice_rooms', 'room_1'), {
        tempoBpm: 180,
        updatedAt: now + 500,
      })
    );

    // Member CAN join activeParticipants
    await assertSucceeds(
      updateDoc(doc(memberDb, 'practice_rooms', 'room_1'), {
        activeParticipants: ['host_1', 'member_1'],
        updatedAt: now + 600,
      })
    );

    // Host CAN update tempo and metronome state
    await assertSucceeds(
      updateDoc(doc(hostDb, 'practice_rooms', 'room_1'), {
        tempoBpm: 88,
        metronomeActive: true,
        updatedAt: now + 1200,
      })
    );
  });
});
