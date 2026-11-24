import { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { AuthModal } from './components/AuthModal';
import { Header } from './components/Header';
import { PaywallModal } from './components/PaywallModal';
import {
  computeEarnedBadges,
  reviewSrsCard,
  scoreToSrsQuality,
} from './core/srs';
import { ALL_GUSHEHS, GUSHEH_BY_ID, isGushehUnlocked } from './data/radifData';
import {
  clearWebPreviewEntitlement,
  createFreeEntitlement,
  hydrateEntitlement,
  purchaseProProduct,
  restoreProPurchases,
} from './services/billing';
import {
  getFirebaseServices,
  signInWithGoogleUnified,
  signOutUnified,
} from './services/firebase';
import {
  commitPlacementTestBatch,
  commitPracticeSessionBatch,
  createRecordingMetaCloud,
  updateRecordingMetaCloud,
} from './services/firestoreSync';
import { deleteRecordingBlob, saveRecordingBlob } from './services/recordingDb';
import {
  GUEST_OWNER_UID,
  loadScopedUserState,
  saveScopedUserState,
  SessionLifecycleController,
} from './services/sessionStore';
import type {
  AppTab,
  BillingEntitlement,
  BillingProductId,
  InstrumentId,
  KoronMode,
  PlacementResult,
  PracticeSessionRecord,
  SavedRecordingMeta,
  UserLearningState,
} from './types/music';
import { CommunityView } from './views/CommunityView';
import { DashboardView } from './views/DashboardView';
import { ModulationMapView } from './views/ModulationMapView';
import { PracticeStudioView } from './views/PracticeStudioView';
import { RadifExplorerView } from './views/RadifExplorerView';

const THEME_STORAGE_KEY = 'navanegar_theme';

export function App() {
  const lifecycleRef = useRef<SessionLifecycleController | null>(null);
  if (!lifecycleRef.current) {
    lifecycleRef.current = new SessionLifecycleController();
  }
  const lifecycle = lifecycleRef.current;

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window === 'undefined') return 'dark';
    return window.localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark';
  });

  const [activeTab, setActiveTab] = useState<AppTab>('dashboard');
  const [studioSubPanel, setStudioSubPanel] = useState<'dsp' | 'tuner' | 'recorder' | undefined>(
    undefined
  );

  // Atomic ownerUid ('guest' | Firebase UID | local test UID)
  const [ownerUid, setOwnerUid] = useState<string>(GUEST_OWNER_UID);
  const [userState, setUserState] = useState<UserLearningState>(() =>
    loadScopedUserState(GUEST_OWNER_UID)
  );

  // Global Studio Instrument & Microtonal Settings
  const [activeGushehId, setActiveGushehId] = useState<string>(ALL_GUSHEHS[0].id);
  const [instrument, setInstrument] = useState<InstrumentId>('tar');
  const [a4Hz, setA4Hz] = useState<number>(440.0);
  const [koronMode, setKoronMode] = useState<KoronMode>('standard_50');

  // Freemium Billing Entitlement
  const [entitlement, setEntitlement] = useState<BillingEntitlement>(() =>
    createFreeEntitlement('not_owned', 'web')
  );

  // Modals & Network state
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [isOffline, setIsOffline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine === false : false
  );

  // Apply Dark/Light theme class cleanly
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  // Monitor browser online/offline state
  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Hydrate billing entitlement safely on startup (anti-tamper on Android)
  useEffect(() => {
    let mounted = true;
    void hydrateEntitlement().then((ent) => {
      if (mounted) setEntitlement(ent);
    });
    return () => {
      mounted = false;
    };
  }, []);

  /**
   * Atomic session transition (Guest <-> User A <-> User B):
   * 1) Aborts all in-flight Firestore sync operations via SessionLifecycleController
   * 2) Immediately revokes every Blob ObjectURL from the prior account
   * 3) Clears & reloads cleanly scoped UserLearningState for `nextUid`
   */
  const transitionOwnerSession = useCallback(
    (nextUid: string, nextDisplayName?: string) => {
      const safeUid = nextUid.trim() || GUEST_OWNER_UID;
      lifecycle.switchOwner(safeUid);
      setOwnerUid(safeUid);
      const nextState = loadScopedUserState(safeUid, nextDisplayName);
      setUserState(nextState);
    },
    [lifecycle]
  );

  // Subscribe to Firebase Auth changes when configured
  useEffect(() => {
    const { auth } = getFirebaseServices();
    if (!auth) return;
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser) {
        transitionOwnerSession(fbUser.uid, fbUser.displayName || fbUser.email || 'هنرجوی نوانگار');
      } else {
        transitionOwnerSession(GUEST_OWNER_UID, 'هنرجوی مهمان');
      }
    });
    return () => unsub();
  }, [transitionOwnerSession]);

  // Ensure active gusheh remains unlocked if Pro expires or resets
  useEffect(() => {
    if (!isGushehUnlocked(activeGushehId, entitlement.isPro)) {
      setActiveGushehId(ALL_GUSHEHS[0].id);
    }
  }, [activeGushehId, entitlement.isPro]);

  // Cleanup all ObjectURLs on unmount
  useEffect(() => {
    return () => {
      lifecycle.objectUrls.revokeAll();
    };
  }, [lifecycle]);

  const updateScopedState = useCallback(
    (updater: (prev: UserLearningState) => UserLearningState): UserLearningState => {
      let computed: UserLearningState | null = null;
      setUserState((prev) => {
        const next = updater(prev);
        computed = next;
        saveScopedUserState(next);
        return next;
      });
      return computed ?? userState;
    },
    [userState]
  );

  const handleToggleDailyStep = (stepId: string) => {
    updateScopedState((prev) => {
      const exists = prev.dailyCompletedSteps.includes(stepId);
      return {
        ...prev,
        dailyCompletedSteps: exists
          ? prev.dailyCompletedSteps.filter((id) => id !== stepId)
          : [...prev.dailyCompletedSteps, stepId],
        updatedAt: Date.now(),
      };
    });
  };

  const handleSavePracticeSession = async (session: PracticeSessionRecord) => {
    const capturedOwner = ownerUid;
    const capturedEpoch = lifecycle.currentEpoch;
    const signal = lifecycle.signal;

    const quality = scoreToSrsQuality(session.accuracyPercent, session.foroudScore);
    const updatedCard = reviewSrsCard(
      userState.srsCards[session.gushehId],
      session.gushehId,
      quality,
      session.completedAt
    );

    const nextSessions = [session, ...userState.sessions].slice(0, 100);
    const totalMinutes =
      userState.totalPracticeMinutes + Math.max(1, Math.round(session.durationSeconds / 60));
    const avgAccuracy = Math.round(
      nextSessions.reduce((acc, s) => acc + s.accuracyPercent, 0) / nextSessions.length
    );
    const nextStreak = Math.max(1, userState.streakDays || 1);
    const nextBadges = computeEarnedBadges(
      nextSessions,
      nextStreak,
      userState.placementCompleted
    );

    const nextWeak = new Set(userState.weakIntervals);
    if (session.accuracyPercent >= 88) nextWeak.delete('koron');
    if (session.foroudScore >= 88) nextWeak.delete('foroud');
    if (session.tahrirDetected) nextWeak.delete('tahrir');
    if (session.accuracyPercent < 70) nextWeak.add('koron');
    if (session.foroudScore < 72) nextWeak.add('foroud');

    const nextState: UserLearningState = {
      ...userState,
      totalPracticeMinutes: totalMinutes,
      streakDays: nextStreak,
      averageAccuracy: avgAccuracy,
      weakIntervals: Array.from(nextWeak),
      badges: nextBadges,
      srsCards: {
        ...userState.srsCards,
        [session.gushehId]: updatedCard,
      },
      sessions: nextSessions,
      updatedAt: Date.now(),
    };

    if (!lifecycle.isCurrent(capturedOwner, capturedEpoch)) return;
    setUserState(nextState);
    saveScopedUserState(nextState);

    // Atomic writeBatch sync to Firestore
    await commitPracticeSessionBatch({
      ownerUid: capturedOwner,
      session,
      updatedCard,
      nextState,
      signal,
    });
  };

  const handleCompletePlacement = async (result: PlacementResult) => {
    const capturedOwner = ownerUid;
    const capturedEpoch = lifecycle.currentEpoch;
    const signal = lifecycle.signal;

    const nextBadges = computeEarnedBadges(userState.sessions, userState.streakDays, true);
    const nextState: UserLearningState = {
      ...userState,
      level: result.recommendedLevel,
      weakIntervals: result.weakIntervals,
      placementCompleted: true,
      lastPlacement: result,
      badges: nextBadges,
      updatedAt: Date.now(),
    };

    if (!lifecycle.isCurrent(capturedOwner, capturedEpoch)) return;
    setUserState(nextState);
    saveScopedUserState(nextState);

    await commitPlacementTestBatch({
      ownerUid: capturedOwner,
      result,
      nextState,
      signal,
    });
  };

  const handleSaveRecording = async (meta: SavedRecordingMeta, blob: Blob) => {
    const capturedOwner = ownerUid;
    const capturedEpoch = lifecycle.currentEpoch;
    const signal = lifecycle.signal;

    // 1. Save audio blob into owner-prefixed IndexedDB key `${ownerUid}::${id}`
    await saveRecordingBlob(capturedOwner, meta.id, blob);

    if (!lifecycle.isCurrent(capturedOwner, capturedEpoch)) return;
    updateScopedState((prev) => ({
      ...prev,
      recordings: [meta, ...prev.recordings],
      updatedAt: Date.now(),
    }));

    // 2. Sync metadata to cloud `saved_recordings` if signed in
    await createRecordingMetaCloud(meta, signal);
  };

  const handleToggleRecordingPublic = async (rec: SavedRecordingMeta) => {
    const capturedOwner = ownerUid;
    const capturedEpoch = lifecycle.currentEpoch;
    const signal = lifecycle.signal;
    const nextPublic = !rec.isPublic;

    const cloudRes = await updateRecordingMetaCloud({
      ownerUid: capturedOwner,
      recordingId: rec.id,
      previousUpdatedAt: rec.updatedAt,
      title: rec.title,
      isPublic: nextPublic,
      signal,
    });

    if (!lifecycle.isCurrent(capturedOwner, capturedEpoch)) return;
    updateScopedState((prev) => ({
      ...prev,
      recordings: prev.recordings.map((r) =>
        r.id === rec.id
          ? { ...r, isPublic: nextPublic, updatedAt: cloudRes.nextUpdatedAt }
          : r
      ),
      updatedAt: Date.now(),
    }));
  };

  const handleDeleteRecording = async (recordingId: string) => {
    const capturedOwner = ownerUid;
    const capturedEpoch = lifecycle.currentEpoch;
    await deleteRecordingBlob(capturedOwner, recordingId);
    if (!lifecycle.isCurrent(capturedOwner, capturedEpoch)) return;
    updateScopedState((prev) => ({
      ...prev,
      recordings: prev.recordings.filter((r) => r.id !== recordingId),
      updatedAt: Date.now(),
    }));
  };

  const handleStartGushehPractice = (
    gushehId: string,
    focusPanel?: 'dsp' | 'tuner' | 'recorder'
  ) => {
    if (!isGushehUnlocked(gushehId, entitlement.isPro)) {
      setPaywallOpen(true);
      return;
    }
    setActiveGushehId(gushehId);
    setStudioSubPanel(focusPanel);
    setActiveTab('studio');
  };

  const handlePurchase = async (productId: BillingProductId) => {
    const next = await purchaseProProduct(productId);
    setEntitlement(next);
  };

  const handleRestore = async () => {
    const next = await restoreProPurchases();
    setEntitlement(next);
  };

  const handleResetWebPreview = () => {
    setEntitlement(clearWebPreviewEntitlement());
  };

  const handleGoogleSignIn = async () => {
    const user = await signInWithGoogleUnified();
    transitionOwnerSession(user.uid, user.displayName || user.email || 'هنرجوی نوانگار');
  };

  const handleSignOut = async () => {
    await signOutUnified();
    transitionOwnerSession(GUEST_OWNER_UID, 'هنرجوی مهمان');
  };

  const activeGusheh = GUSHEH_BY_ID[activeGushehId] ?? ALL_GUSHEHS[0];

  return (
    <div className="persian-grid-bg min-h-screen bg-slate-50 pb-20 text-slate-900 transition-colors lg:pb-8 dark:bg-slate-950 dark:text-slate-100">
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        ownerUid={ownerUid}
        displayName={userState.displayName}
        entitlement={entitlement}
        isOffline={isOffline}
        onOpenAuth={() => setAuthModalOpen(true)}
        onOpenPaywall={() => setPaywallOpen(true)}
      />

      <main className="mx-auto max-w-7xl px-4 py-5">
        {activeTab === 'dashboard' && (
          <DashboardView
            userState={userState}
            isPro={entitlement.isPro}
            instrument={instrument}
            a4Hz={a4Hz}
            koronMode={koronMode}
            onStartGushehPractice={handleStartGushehPractice}
            onToggleDailyStep={handleToggleDailyStep}
            onCompletePlacement={handleCompletePlacement}
            onOpenExplorer={() => setActiveTab('explorer')}
          />
        )}

        {activeTab === 'studio' && (
          <PracticeStudioView
            ownerUid={ownerUid}
            ownerName={userState.displayName}
            gusheh={activeGusheh}
            onSelectGusheh={(id) => handleStartGushehPractice(id)}
            instrument={instrument}
            onChangeInstrument={setInstrument}
            a4Hz={a4Hz}
            onChangeA4Hz={setA4Hz}
            koronMode={koronMode}
            onChangeKoronMode={setKoronMode}
            isPro={entitlement.isPro}
            recordings={userState.recordings}
            objectUrlRegistry={lifecycle.objectUrls}
            initialSubPanel={studioSubPanel}
            onSaveSession={handleSavePracticeSession}
            onSaveRecording={handleSaveRecording}
            onToggleRecordingPublic={handleToggleRecordingPublic}
            onDeleteRecording={handleDeleteRecording}
            onRequestUpgrade={() => setPaywallOpen(true)}
          />
        )}

        {activeTab === 'explorer' && (
          <RadifExplorerView
            isPro={entitlement.isPro}
            instrument={instrument}
            a4Hz={a4Hz}
            koronMode={koronMode}
            activeGushehId={activeGusheh.id}
            onPracticeGusheh={(id) => handleStartGushehPractice(id, 'dsp')}
            onRequestUpgrade={() => setPaywallOpen(true)}
          />
        )}

        {activeTab === 'modulation' && (
          <ModulationMapView
            isPro={entitlement.isPro}
            instrument={instrument}
            a4Hz={a4Hz}
            koronMode={koronMode}
            onPracticeGusheh={(id) => handleStartGushehPractice(id, 'dsp')}
            onRequestUpgrade={() => setPaywallOpen(true)}
          />
        )}

        {activeTab === 'community' && (
          <CommunityView
            ownerUid={ownerUid}
            displayName={userState.displayName}
            a4Hz={a4Hz}
            koronMode={koronMode}
            localPublicRecordings={userState.recordings.filter((r) => r.isPublic)}
            onOpenAuth={() => setAuthModalOpen(true)}
            onPracticeGusheh={(id) => handleStartGushehPractice(id, 'dsp')}
          />
        )}
      </main>

      <PaywallModal
        open={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        entitlement={entitlement}
        onPurchase={handlePurchase}
        onRestore={handleRestore}
        onResetWebPreview={handleResetWebPreview}
      />

      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        ownerUid={ownerUid}
        displayName={userState.displayName}
        onGoogleSignIn={handleGoogleSignIn}
        onSwitchLocalProfile={(uid, name) => transitionOwnerSession(uid, name)}
        onSignOut={handleSignOut}
      />
    </div>
  );
}

export default App;
