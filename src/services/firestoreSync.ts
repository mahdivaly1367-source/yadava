import {
  collection,
  doc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import type {
  ForumPost,
  ForumReply,
  PlacementResult,
  PracticeRoom,
  PracticeSessionRecord,
  SavedRecordingMeta,
  SrsCard,
  UserLearningState,
} from '../types/music';
import { getFirebaseServices, handleFirestoreError, type HandledFirestoreError } from './firebase';
import { GUEST_OWNER_UID } from './sessionStore';

function assertCloudReady(ownerUid: string, signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new Error('SESSION_ABORTED');
  }
  if (!ownerUid || ownerUid === GUEST_OWNER_UID) {
    return null;
  }
  const { db } = getFirebaseServices();
  return db;
}

/**
 * Atomic writeBatch committing:
 * 1) users/{uid}/practice_sessions/{sessionId}
 * 2) users/{uid}/srs_cards/{gushehId}
 * 3) users/{uid} aggregate profile stats
 */
export async function commitPracticeSessionBatch(params: {
  ownerUid: string;
  session: PracticeSessionRecord;
  updatedCard: SrsCard;
  nextState: UserLearningState;
  signal?: AbortSignal;
}): Promise<{ synced: boolean; error?: HandledFirestoreError }> {
  const db = assertCloudReady(params.ownerUid, params.signal);
  if (!db) return { synced: false };

  try {
    const batch = writeBatch(db);
    const now = Math.max(Date.now(), params.nextState.updatedAt);

    const sessionRef = doc(db, 'users', params.ownerUid, 'practice_sessions', params.session.id);
    batch.set(sessionRef, {
      gushehId: params.session.gushehId,
      dastgahId: params.session.dastgahId,
      instrument: params.session.instrument,
      durationSeconds: params.session.durationSeconds,
      accuracyPercent: params.session.accuracyPercent,
      foroudScore: params.session.foroudScore,
      tahrirDetected: params.session.tahrirDetected,
      avgCentsError: params.session.avgCentsError,
      completedAt: params.session.completedAt,
    });

    const cardRef = doc(db, 'users', params.ownerUid, 'srs_cards', params.updatedCard.gushehId);
    batch.set(cardRef, {
      gushehId: params.updatedCard.gushehId,
      easeFactor: params.updatedCard.easeFactor,
      intervalDays: params.updatedCard.intervalDays,
      repetitions: params.updatedCard.repetitions,
      nextReviewAt: params.updatedCard.nextReviewAt,
      lastQuality: params.updatedCard.lastQuality,
      updatedAt: params.updatedCard.updatedAt,
    });

    const userRef = doc(db, 'users', params.ownerUid);
    batch.set(
      userRef,
      {
        uid: params.ownerUid,
        displayName: params.nextState.displayName,
        level: params.nextState.level,
        totalPracticeMinutes: params.nextState.totalPracticeMinutes,
        streakDays: params.nextState.streakDays,
        averageAccuracy: params.nextState.averageAccuracy,
        weakIntervals: params.nextState.weakIntervals.slice(0, 16),
        badges: params.nextState.badges.slice(0, 32),
        placementCompleted: params.nextState.placementCompleted,
        createdAt: params.nextState.sessions[0]?.completedAt ?? now,
        updatedAt: now,
      },
      { merge: true }
    );

    if (params.signal?.aborted) return { synced: false };
    await batch.commit();
    return { synced: true };
  } catch (err) {
    return { synced: false, error: handleFirestoreError(err, 'commitPracticeSessionBatch') };
  }
}

/**
 * Atomic writeBatch committing:
 * 1) users/{uid}/placement_tests/{testId}
 * 2) users/{uid} level, weakIntervals, badges, placementCompleted
 */
export async function commitPlacementTestBatch(params: {
  ownerUid: string;
  result: PlacementResult;
  nextState: UserLearningState;
  signal?: AbortSignal;
}): Promise<{ synced: boolean; error?: HandledFirestoreError }> {
  const db = assertCloudReady(params.ownerUid, params.signal);
  if (!db) return { synced: false };

  try {
    const batch = writeBatch(db);
    const now = Math.max(Date.now(), params.result.completedAt);

    const testRef = doc(db, 'users', params.ownerUid, 'placement_tests', params.result.id);
    batch.set(testRef, {
      earScore: params.result.earScore,
      pitchScore: params.result.pitchScore,
      recommendedLevel: params.result.recommendedLevel,
      weakIntervals: params.result.weakIntervals.slice(0, 16),
      completedAt: params.result.completedAt,
    });

    const userRef = doc(db, 'users', params.ownerUid);
    batch.set(
      userRef,
      {
        uid: params.ownerUid,
        displayName: params.nextState.displayName,
        level: params.nextState.level,
        totalPracticeMinutes: params.nextState.totalPracticeMinutes,
        streakDays: params.nextState.streakDays,
        averageAccuracy: params.nextState.averageAccuracy,
        weakIntervals: params.nextState.weakIntervals.slice(0, 16),
        badges: params.nextState.badges.slice(0, 32),
        placementCompleted: true,
        createdAt: params.nextState.sessions[0]?.completedAt ?? now,
        updatedAt: now,
      },
      { merge: true }
    );

    if (params.signal?.aborted) return { synced: false };
    await batch.commit();
    return { synced: true };
  } catch (err) {
    return { synced: false, error: handleFirestoreError(err, 'commitPlacementTestBatch') };
  }
}

/**
 * Saves recording metadata to Firestore `saved_recordings/{recordingId}`.
 */
export async function createRecordingMetaCloud(
  meta: SavedRecordingMeta,
  signal?: AbortSignal
): Promise<{ synced: boolean; error?: HandledFirestoreError }> {
  const db = assertCloudReady(meta.ownerUid, signal);
  if (!db) return { synced: false };

  try {
    const ref = doc(db, 'saved_recordings', meta.id);
    await setDoc(ref, {
      ownerUid: meta.ownerUid,
      ownerName: meta.ownerName,
      gushehId: meta.gushehId,
      dastgahId: meta.dastgahId,
      instrument: meta.instrument,
      title: meta.title,
      durationSeconds: meta.durationSeconds,
      avgAccuracy: meta.avgAccuracy,
      rmsDb: meta.rmsDb,
      envelope: meta.envelope.slice(0, 128),
      isPublic: meta.isPublic,
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt,
    });
    return { synced: true };
  } catch (err) {
    return { synced: false, error: handleFirestoreError(err, 'createRecordingMetaCloud') };
  }
}

/**
 * Safe update of `saved_recordings/{recordingId}` enforcing strict monotonic `updatedAt`
 * matching firestore.rules (`request.resource.data.updatedAt > resource.data.updatedAt`).
 */
export async function updateRecordingMetaCloud(params: {
  ownerUid: string;
  recordingId: string;
  previousUpdatedAt: number;
  title: string;
  isPublic: boolean;
  signal?: AbortSignal;
}): Promise<{ synced: boolean; nextUpdatedAt: number; error?: HandledFirestoreError }> {
  const nextUpdatedAt = Math.max(Date.now(), params.previousUpdatedAt + 1);
  const db = assertCloudReady(params.ownerUid, params.signal);
  if (!db) return { synced: false, nextUpdatedAt };

  try {
    const ref = doc(db, 'saved_recordings', params.recordingId);
    await updateDoc(ref, {
      title: params.title,
      isPublic: params.isPublic,
      updatedAt: nextUpdatedAt,
    });
    return { synced: true, nextUpdatedAt };
  } catch (err) {
    return {
      synced: false,
      nextUpdatedAt,
      error: handleFirestoreError(err, 'updateRecordingMetaCloud'),
    };
  }
}

/**
 * Atomic writeBatch for adding a forum reply:
 * Writes `forum_posts/{postId}/replies/{replyId}` AND updates parent `forum_posts/{postId}`
 * with `replyCount: increment(1)` and `lastReplyId: replyId`, satisfying the strict
 * `!exists && existsAfter && getAfter` anti-spoofing rule in firestore.rules.
 */
export async function commitForumReplyBatch(params: {
  postId: string;
  reply: ForumReply;
  signal?: AbortSignal;
}): Promise<{ synced: boolean; error?: HandledFirestoreError }> {
  const db = assertCloudReady(params.reply.authorUid, params.signal);
  if (!db) return { synced: false };

  try {
    const batch = writeBatch(db);
    const replyRef = doc(db, 'forum_posts', params.postId, 'replies', params.reply.id);
    const postRef = doc(db, 'forum_posts', params.postId);

    batch.set(replyRef, {
      postId: params.postId,
      authorUid: params.reply.authorUid,
      authorName: params.reply.authorName,
      body: params.reply.body,
      createdAt: params.reply.createdAt,
    });

    batch.update(postRef, {
      replyCount: increment(1),
      lastReplyId: params.reply.id,
      updatedAt: params.reply.createdAt,
    });

    if (params.signal?.aborted) return { synced: false };
    await batch.commit();
    return { synced: true };
  } catch (err) {
    return { synced: false, error: handleFirestoreError(err, 'commitForumReplyBatch') };
  }
}

export async function createForumPostCloud(
  post: ForumPost,
  signal?: AbortSignal
): Promise<{ synced: boolean; error?: HandledFirestoreError }> {
  const db = assertCloudReady(post.authorUid, signal);
  if (!db) return { synced: false };

  try {
    const ref = doc(db, 'forum_posts', post.id);
    await setDoc(ref, {
      authorUid: post.authorUid,
      authorName: post.authorName,
      title: post.title,
      body: post.body,
      dastgahId: post.dastgahId,
      tags: post.tags.slice(0, 6),
      replyCount: 0,
      lastReplyId: null,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    });
    return { synced: true };
  } catch (err) {
    return { synced: false, error: handleFirestoreError(err, 'createForumPostCloud') };
  }
}

export async function createPracticeRoomCloud(
  room: PracticeRoom,
  signal?: AbortSignal
): Promise<{ synced: boolean; error?: HandledFirestoreError }> {
  const db = assertCloudReady(room.hostUid, signal);
  if (!db) return { synced: false };

  try {
    const ref = doc(db, 'practice_rooms', room.id);
    await setDoc(ref, {
      hostUid: room.hostUid,
      hostName: room.hostName,
      title: room.title,
      dastgahId: room.dastgahId,
      gushehId: room.gushehId,
      instrument: room.instrument,
      tempoBpm: room.tempoBpm,
      meter: room.meter,
      metronomeActive: room.metronomeActive,
      isPlaying: room.isPlaying,
      activeParticipants: room.activeParticipants.slice(0, 32),
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
    });
    return { synced: true };
  } catch (err) {
    return { synced: false, error: handleFirestoreError(err, 'createPracticeRoomCloud') };
  }
}

export async function updatePracticeRoomCloud(
  ownerUid: string,
  roomId: string,
  patch: Partial<
    Pick<
      PracticeRoom,
      'dastgahId' | 'gushehId' | 'instrument' | 'tempoBpm' | 'meter' | 'metronomeActive' | 'isPlaying' | 'activeParticipants'
    >
  >,
  signal?: AbortSignal
): Promise<{ synced: boolean; error?: HandledFirestoreError }> {
  const db = assertCloudReady(ownerUid, signal);
  if (!db) return { synced: false };

  try {
    const ref = doc(db, 'practice_rooms', roomId);
    await updateDoc(ref, {
      ...patch,
      updatedAt: Date.now(),
    });
    return { synced: true };
  } catch (err) {
    return { synced: false, error: handleFirestoreError(err, 'updatePracticeRoomCloud') };
  }
}

export function subscribeCommunityFeed(params: {
  ownerUid: string;
  onRooms: (rooms: PracticeRoom[]) => void;
  onPosts: (posts: ForumPost[]) => void;
  onPublicRecordings: (recordings: SavedRecordingMeta[]) => void;
  onError: (err: HandledFirestoreError) => void;
}): Unsubscribe {
  const db = assertCloudReady(params.ownerUid);
  if (!db) {
    return () => {};
  }

  const unsubs: Unsubscribe[] = [];

  try {
    const roomsQ = query(
      collection(db, 'practice_rooms'),
      orderBy('updatedAt', 'desc'),
      limit(12)
    );
    unsubs.push(
      onSnapshot(
        roomsQ,
        (snap) => {
          const items: PracticeRoom[] = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<PracticeRoom, 'id'>),
          }));
          params.onRooms(items);
        },
        (err) => params.onError(handleFirestoreError(err, 'subscribePracticeRooms'))
      )
    );

    const postsQ = query(
      collection(db, 'forum_posts'),
      orderBy('updatedAt', 'desc'),
      limit(20)
    );
    unsubs.push(
      onSnapshot(
        postsQ,
        (snap) => {
          const items: ForumPost[] = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<ForumPost, 'id'>),
          }));
          params.onPosts(items);
        },
        (err) => params.onError(handleFirestoreError(err, 'subscribeForumPosts'))
      )
    );

    const recQ = query(
      collection(db, 'saved_recordings'),
      where('isPublic', '==', true),
      orderBy('createdAt', 'desc'),
      limit(16)
    );
    unsubs.push(
      onSnapshot(
        recQ,
        (snap) => {
          const items: SavedRecordingMeta[] = snap.docs.map((d) => ({
            id: d.id,
            hasLocalAudio: false,
            ...(d.data() as Omit<SavedRecordingMeta, 'id' | 'hasLocalAudio'>),
          }));
          params.onPublicRecordings(items);
        },
        (err) => params.onError(handleFirestoreError(err, 'subscribePublicRecordings'))
      )
    );
  } catch (err) {
    params.onError(handleFirestoreError(err, 'subscribeCommunityFeed'));
  }

  return () => {
    for (const u of unsubs) {
      try {
        u();
      } catch {
        // ignore
      }
    }
  };
}

export async function fetchPostRepliesCloud(
  ownerUid: string,
  postId: string
): Promise<{ replies: ForumReply[]; error?: HandledFirestoreError }> {
  const db = assertCloudReady(ownerUid);
  if (!db) return { replies: [] };

  try {
    const q = query(
      collection(db, 'forum_posts', postId, 'replies'),
      orderBy('createdAt', 'asc'),
      limit(50)
    );
    const snap = await getDocs(q);
    return {
      replies: snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<ForumReply, 'id'>),
      })),
    };
  } catch (err) {
    return {
      replies: [],
      error: handleFirestoreError(err, 'fetchPostRepliesCloud'),
    };
  }
}
