import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { Header } from './components/Header';
import { decodeAssignmentInput } from './core/assignments';
import { computeStreakWithFreeze } from './core/challenges';
import {
  computeEarnedBadges,
  reviewSrsCard,
  scoreToSrsQuality,
} from './core/srs';
import {
  loadWorkspaceMode,
  resolveAllowedTab,
  saveWorkspaceMode,
} from './core/workspaceMode';
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
  RadifTraditionId,
  SavedRecordingMeta,
  TeacherAssignment,
  UserLearningState,
  WorkspaceMode,
} from './types/music';
import { toIsoDateKey } from './utils/jalali';
import { DashboardView } from './views/DashboardView';

const AudioGlossaryModal = lazy(() =>
  import('./components/AudioGlossaryModal').then((m) => ({ default: m.AudioGlossaryModal }))
);
const AuthModal = lazy(() =>
  import('./components/AuthModal').then((m) => ({ default: m.AuthModal }))
);
const ExportShareModal = lazy(() =>
  import('./components/ExportShareModal').then((m) => ({ default: m.ExportShareModal }))
);
const PaywallModal = lazy(() =>
  import('./components/PaywallModal').then((m) => ({ default: m.PaywallModal }))
);
const TeacherAssignmentModal = lazy(() =>
  import('./components/TeacherAssignmentModal').then((m) => ({ default: m.TeacherAssignmentModal }))
);
const OnboardingModal = lazy(() =>
  import('./components/OnboardingModal').then((m) => ({ default: m.OnboardingModal }))
);
const CommunityView = lazy(() =>
  import('./views/CommunityView').then((m) => ({ default: m.CommunityView }))
);
const ModulationMapView = lazy(() =>
  import('./views/ModulationMapView').then((m) => ({ default: m.ModulationMapView }))
);
const PracticeStudioView = lazy(() =>
  import('./views/PracticeStudioView').then((m) => ({ default: m.PracticeStudioView }))
);
const RadifExplorerView = lazy(() =>
  import('./views/RadifExplorerView').then((m) => ({ default: m.RadifExplorerView }))
);

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
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>(() => loadWorkspaceMode());
  const [studioSubPanel, setStudioSubPanel] = useState<'dsp' | 'tuner' | 'recorder' | undefined>(
    undefined
  );

  const handleChangeWorkspaceMode = useCallback((nextMode: WorkspaceMode) => {
    setWorkspaceMode(nextMode);
    saveWorkspaceMode(nextMode);
    setActiveTab((prev) => resolveAllowedTab(prev, nextMode));
  }, []);

  // Atomic ownerUid ('guest' | Firebase UID | local test UID)
  const [ownerUid, setOwnerUid] = useState<string>(GUEST_OWNER_UID);
  const [userState, setUserState] = useState<UserLearningState>(() =>
    loadScopedUserState(GUEST_OWNER_UID)
  );

  // Global Studio Instrument, Microtonal & Repertoire Settings
  const [activeGushehId, setActiveGushehId] = useState<string>(ALL_GUSHEHS[0].id);
  const [instrument, setInstrument] = useState<InstrumentId>('tar');
  const [a4Hz, setA4Hz] = useState<number>(440.0);
  const [koronMode, setKoronMode] = useState<KoronMode>('standard_50');
  const [traditionId, setTraditionId] = useState<RadifTraditionId>('mirza_abdollah');
  const [activeAssignment, setActiveAssignment] = useState<TeacherAssignment | null>(null);

  // Freemium Billing Entitlement
  const [entitlement, setEntitlement] = useState<BillingEntitlement>(() =>
    createFreeEntitlement('not_owned', 'web')
  );

  // Modals & Network state
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [teacherModalOpen, setTeacherModalOpen] = useState(false);
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
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

  const handleLoadTeacherAssignment = useCallback(
    (assignment: TeacherAssignment) => {
      if (!isGushehUnlocked(assignment.gushehId, entitlement.isPro)) {
        setPaywallOpen(true);
        return;
      }
      setActiveAssignment(assignment);
      setActiveGushehId(assignment.gushehId);
      setInstrument(assignment.instrument);
      setKoronMode(assignment.koronMode);
      setTraditionId(assignment.traditionId);
      setStudioSubPanel('dsp');
      setActiveTab('studio');
    },
    [entitlement.isPro]
  );

  // Auto-detect offline Teacher Assignment URL hash (#assignment=NVN1-...) on load
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.hash && window.location.hash.includes('assignment=')) {
      const decoded = decodeAssignmentInput(window.location.hash);
      if (decoded) {
        handleLoadTeacherAssignment(decoded);
      }
    }
  }, [handleLoadTeacherAssignment]);

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

  useEffect(() => {
    if (!isGushehUnlocked(activeGushehId, entitlement.isPro)) {
      setActiveGushehId(ALL_GUSHEHS[0].id);
    }
  }, [activeGushehId, entitlement.isPro]);

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

  const handleRecordEarAnswer = (isCorrect: boolean) => {
    updateScopedState((prev) => {
      const curr = prev.earTrainingStats ?? {
        totalAnswered: 0,
        totalCorrect: 0,
        bestStreak: 0,
        completedSessions: 0,
      };
      const nextCorrect = curr.totalCorrect + (isCorrect ? 1 : 0);
      return {
        ...prev,
        earTrainingStats: {
          totalAnswered: curr.totalAnswered + 1,
          totalCorrect: nextCorrect,
          bestStreak: isCorrect ? Math.max(curr.bestStreak, nextCorrect) : curr.bestStreak,
          completedSessions: curr.completedSessions + (isCorrect ? 1 : 0),
        },
        updatedAt: Date.now(),
      };
    });
  };

  const handleActivateStreakFreeze = () => {
    const todayKey = toIsoDateKey(new Date());
    updateScopedState((prev) => {
      const remaining = prev.streakFreezesRemaining ?? 2;
      const frozen = prev.frozenDateKeys ?? [];
      if (remaining <= 0 || frozen.includes(todayKey)) return prev;
      return {
        ...prev,
        streakFreezesRemaining: remaining - 1,
        frozenDateKeys: [...frozen, todayKey],
        streakDays: Math.max(1, prev.streakDays),
        updatedAt: Date.now(),
      };
    });
  };

  const handleTogglePathStep = (stepId: string) => {
    updateScopedState((prev) => {
      const curr = prev.completedPathStepIds ?? [];
      const exists = curr.includes(stepId);
      return {
        ...prev,
        completedPathStepIds: exists
          ? curr.filter((id) => id !== stepId)
          : [...curr, stepId],
        updatedAt: Date.now(),
      };
    });
  };

  const handleNewBestBreath = (seconds: number) => {
    updateScopedState((prev) => ({
      ...prev,
      bestBreathSeconds: Math.max(prev.bestBreathSeconds ?? 0, seconds),
      updatedAt: Date.now(),
    }));
  };

  const handleImportBackupState = (importedState: UserLearningState) => {
    setUserState(importedState);
    saveScopedUserState(importedState);
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

    const streakEval = computeStreakWithFreeze(
      nextSessions,
      userState.frozenDateKeys ?? [],
      userState.streakFreezesRemaining ?? 2,
      session.completedAt
    );
    const nextStreak = Math.max(1, streakEval.streakDays, userState.streakDays || 1);
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

    await saveRecordingBlob(capturedOwner, meta.id, blob);

    if (!lifecycle.isCurrent(capturedOwner, capturedEpoch)) return;
    updateScopedState((prev) => ({
      ...prev,
      recordings: [meta, ...prev.recordings],
      updatedAt: Date.now(),
    }));

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
        onSelectTab={(tab) => setActiveTab(resolveAllowedTab(tab, workspaceMode))}
        workspaceMode={workspaceMode}
        onChangeWorkspaceMode={handleChangeWorkspaceMode}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        ownerUid={ownerUid}
        displayName={userState.displayName}
        entitlement={entitlement}
        isOffline={isOffline}
        onOpenAuth={() => setAuthModalOpen(true)}
        onOpenPaywall={() => setPaywallOpen(true)}
        onOpenGlossary={() => setGlossaryOpen(true)}
      />

      <main className="mx-auto max-w-7xl px-4 py-5">
        <Suspense
          fallback={
            <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-10 text-center text-sm font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300">
              در حال آماده‌سازی استودیوی نوانگار...
            </div>
          }
        >
          {activeTab === 'dashboard' && (
            <DashboardView
              userState={userState}
              isPro={entitlement.isPro}
              workspaceMode={workspaceMode}
              onChangeWorkspaceMode={handleChangeWorkspaceMode}
              instrument={instrument}
              a4Hz={a4Hz}
              koronMode={koronMode}
              onStartGushehPractice={handleStartGushehPractice}
              onToggleDailyStep={handleToggleDailyStep}
              onCompletePlacement={handleCompletePlacement}
              onRecordEarAnswer={handleRecordEarAnswer}
              onActivateStreakFreeze={handleActivateStreakFreeze}
              onTogglePathStep={handleTogglePathStep}
              onOpenTeacherModal={() => setTeacherModalOpen(true)}
              onOpenExportModal={() => setExportModalOpen(true)}
              onOpenExplorer={() => setActiveTab('explorer')}
              onOpenOnboarding={() => setOnboardingOpen(true)}
              onRequestUpgrade={() => setPaywallOpen(true)}
            />
          )}

          {activeTab === 'studio' && (
            <PracticeStudioView
              ownerUid={ownerUid}
              ownerName={userState.displayName}
              workspaceMode={workspaceMode}
              onChangeWorkspaceMode={handleChangeWorkspaceMode}
              gusheh={activeGusheh}
              onSelectGusheh={(id) => handleStartGushehPractice(id)}
              instrument={instrument}
              onChangeInstrument={setInstrument}
              a4Hz={a4Hz}
              onChangeA4Hz={setA4Hz}
              koronMode={koronMode}
              onChangeKoronMode={setKoronMode}
              traditionId={traditionId}
              onChangeTradition={setTraditionId}
              activeAssignment={activeAssignment}
              onClearAssignment={() => setActiveAssignment(null)}
              onOpenExportModal={() => setExportModalOpen(true)}
              onOpenTeacherModal={() => setTeacherModalOpen(true)}
              isPro={entitlement.isPro}
              bestBreathSeconds={userState.bestBreathSeconds ?? 0}
              onNewBestBreath={handleNewBestBreath}
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
              traditionId={traditionId}
              onChangeTradition={setTraditionId}
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
        </Suspense>
      </main>

      <Suspense fallback={null}>
        {paywallOpen && (
          <PaywallModal
            open={paywallOpen}
            onClose={() => setPaywallOpen(false)}
            entitlement={entitlement}
            onPurchase={handlePurchase}
            onRestore={handleRestore}
            onResetWebPreview={handleResetWebPreview}
          />
        )}

        {authModalOpen && (
          <AuthModal
            open={authModalOpen}
            onClose={() => setAuthModalOpen(false)}
            ownerUid={ownerUid}
            displayName={userState.displayName}
            onGoogleSignIn={handleGoogleSignIn}
            onSwitchLocalProfile={(uid, name) => transitionOwnerSession(uid, name)}
            onSignOut={handleSignOut}
          />
        )}

        {exportModalOpen && (
          <ExportShareModal
            open={exportModalOpen}
            onClose={() => setExportModalOpen(false)}
            gusheh={activeGusheh}
            instrument={instrument}
            a4Hz={a4Hz}
            koronMode={koronMode}
            userState={userState}
            onImportBackupState={handleImportBackupState}
          />
        )}

        {glossaryOpen && (
          <AudioGlossaryModal
            open={glossaryOpen}
            onClose={() => setGlossaryOpen(false)}
            instrument={instrument}
            a4Hz={a4Hz}
            koronMode={koronMode}
          />
        )}

        {teacherModalOpen && (
          <TeacherAssignmentModal
            open={teacherModalOpen}
            onClose={() => setTeacherModalOpen(false)}
            activeGusheh={activeGusheh}
            instrument={instrument}
            koronMode={koronMode}
            onLoadAssignment={handleLoadTeacherAssignment}
          />
        )}

        {onboardingOpen && (
          <OnboardingModal
            open={onboardingOpen}
            initialInstrument={instrument}
            initialWorkspaceMode={workspaceMode}
            onClose={() => setOnboardingOpen(false)}
            onComplete={(profile) => {
              setInstrument(profile.instrument);
              handleChangeWorkspaceMode(profile.workspaceMode);
              setUserState((prev) => ({
                ...prev,
                level: profile.level,
              }));
            }}
          />
        )}
      </Suspense>
    </div>
  );
}

export default App;
