import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleFirestoreError } from '../services/firebase';
import {
  __resetMemoryRecordingStore,
  buildRecordingKey,
  deleteRecordingBlob,
  getRecordingBlob,
  isKeyOwnedBy,
  listRecordingIdsForOwner,
  saveRecordingBlob,
} from '../services/recordingDb';
import {
  createEmptyUserState,
  GUEST_OWNER_UID,
  loadScopedUserState,
  saveScopedUserState,
  SessionLifecycleController,
} from '../services/sessionStore';

afterEach(() => {
  __resetMemoryRecordingStore();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('Atomic Session Isolation (Guest <-> User A <-> User B) & IndexedDB Key Prefixing', () => {
  it('strictly prefixes IndexedDB recording keys with `${ownerUid}::${id}` and prevents cross-user leakage', async () => {
    const guestKey = buildRecordingKey(GUEST_OWNER_UID, 'rec_1');
    const userAKey = buildRecordingKey('uid_alice', 'rec_1');
    const userBKey = buildRecordingKey('uid_bob', 'rec_1');

    expect(guestKey).toBe('guest::rec_1');
    expect(userAKey).toBe('uid_alice::rec_1');
    expect(userBKey).toBe('uid_bob::rec_1');
    expect(isKeyOwnedBy(userAKey, 'uid_alice')).toBe(true);
    expect(isKeyOwnedBy(userAKey, 'uid_bob')).toBe(false);

    const blobGuest = new Blob(['guest-audio'], { type: 'audio/webm' });
    const blobA = new Blob(['alice-audio'], { type: 'audio/webm' });
    const blobB = new Blob(['bob-audio'], { type: 'audio/webm' });

    await saveRecordingBlob(GUEST_OWNER_UID, 'rec_1', blobGuest);
    await saveRecordingBlob('uid_alice', 'rec_1', blobA);
    await saveRecordingBlob('uid_alice', 'rec_2', blobA);
    await saveRecordingBlob('uid_bob', 'rec_1', blobB);

    expect(await listRecordingIdsForOwner(GUEST_OWNER_UID)).toEqual(['rec_1']);
    expect(await listRecordingIdsForOwner('uid_alice')).toEqual(['rec_1', 'rec_2']);
    expect(await listRecordingIdsForOwner('uid_bob')).toEqual(['rec_1']);

    const readA = await getRecordingBlob('uid_alice', 'rec_1');
    const readB = await getRecordingBlob('uid_bob', 'rec_1');
    expect(readA).toBe(blobA);
    expect(readB).toBe(blobB);
    expect(await getRecordingBlob('uid_bob', 'rec_2')).toBeNull();

    // Deleting Alice's rec_1 never touches Bob's or Guest's rec_1
    await deleteRecordingBlob('uid_alice', 'rec_1');
    expect(await getRecordingBlob('uid_alice', 'rec_1')).toBeNull();
    expect(await getRecordingBlob('uid_bob', 'rec_1')).toBe(blobB);
    expect(await getRecordingBlob(GUEST_OWNER_UID, 'rec_1')).toBe(blobGuest);
  });

  it('immediately aborts pending sync operations and revokes all ObjectURLs on A -> B switch or sign-out', () => {
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    const createSpy = vi.fn(() => `blob:navanegar-${Math.random()}`);
    const revokeSpy = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: createSpy });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: revokeSpy });

    try {
      const controller = new SessionLifecycleController();
      controller.switchOwner('uid_alice');
      const aliceEpoch = controller.currentEpoch;
      const aliceSignal = controller.signal;

      // Create two ObjectURLs during Alice's session
      controller.objectUrls.create(new Blob(['a1']));
      controller.objectUrls.create(new Blob(['a2']));
      expect(controller.objectUrls.activeCount).toBe(2);
      expect(aliceSignal.aborted).toBe(false);

      // Switch Alice -> Bob atomically
      const transition = controller.switchOwner('uid_bob');
      expect(transition.previousOwnerUid).toBe('uid_alice');
      expect(transition.nextOwnerUid).toBe('uid_bob');
      expect(transition.revokedUrls).toBe(2);
      expect(revokeSpy).toHaveBeenCalledTimes(2);
      expect(controller.objectUrls.activeCount).toBe(0);
      expect(aliceSignal.aborted).toBe(true);
      expect(controller.isCurrent('uid_alice', aliceEpoch)).toBe(false);
      expect(controller.isCurrent('uid_bob', transition.epoch)).toBe(true);

      // Sign out Bob -> Guest
      const signOutRes = controller.switchOwner(GUEST_OWNER_UID);
      expect(signOutRes.nextOwnerUid).toBe('guest');
      expect(transition.signal.aborted).toBe(true);

      expect(createSpy).toHaveBeenCalledTimes(2);
    } finally {
      Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: origCreate });
      Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: origRevoke });
    }
  });

  it('isolates scoped localStorage state per ownerUid and rejects mismatched recordings', () => {
    const aliceState = createEmptyUserState('uid_alice', 'آلیس');
    aliceState.totalPracticeMinutes = 45;
    aliceState.recordings = [
      {
        id: 'r1',
        ownerUid: 'uid_alice',
        ownerName: 'آلیس',
        gushehId: 'shur_daramad_1',
        dastgahId: 'shur',
        instrument: 'tar',
        title: 'ضبط آلیس',
        durationSeconds: 30,
        avgAccuracy: 88,
        rmsDb: -18,
        envelope: [0.4],
        isPublic: false,
        hasLocalAudio: true,
        createdAt: 1000,
        updatedAt: 1000,
      },
      // Injected foreign recording belonging to Bob must be stripped on load
      {
        id: 'r_foreign',
        ownerUid: 'uid_bob',
        ownerName: 'باب',
        gushehId: 'shur_daramad_1',
        dastgahId: 'shur',
        instrument: 'tar',
        title: 'ضبط غیرمجاز',
        durationSeconds: 20,
        avgAccuracy: 70,
        rmsDb: -20,
        envelope: [0.2],
        isPublic: false,
        hasLocalAudio: true,
        createdAt: 1000,
        updatedAt: 1000,
      },
    ];
    saveScopedUserState(aliceState);

    const loadedAlice = loadScopedUserState('uid_alice');
    expect(loadedAlice.totalPracticeMinutes).toBe(45);
    expect(loadedAlice.recordings).toHaveLength(1);
    expect(loadedAlice.recordings[0].id).toBe('r1');

    const loadedBob = loadScopedUserState('uid_bob');
    expect(loadedBob.totalPracticeMinutes).toBe(0);
    expect(loadedBob.recordings).toHaveLength(0);
  });

  it('classifies Firestore unavailable network errors cleanly without crashing', () => {
    const handled = handleFirestoreError(
      { code: 'unavailable', message: 'Failed to get document because the client is offline.' },
      'CommunityView'
    );
    expect(handled.code).toBe('unavailable');
    expect(handled.isOffline).toBe(true);
    expect(handled.messageFa).toContain('unavailable');
  });
});
