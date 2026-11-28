import type { AppTab, WorkspaceMode } from '../types/music';

export type StudioToolTab =
  | 'bridge'
  | 'sound_lab'
  | 'call_response'
  | 'prosody_avaz'
  | 'blind_tuning'
  | 'drone'
  | 'percussion'
  | 'poetry'
  | 'slowdowner'
  | 'temperament'
  | 'breath'
  | 'tuner'
  | 'metronome'
  | 'midi'
  | 'fft'
  | 'recorder'
  | 'score_editor'
  | 'tradition_ab'
  | 'mixdown'
  | 'dastgah_quiz';

export const ALL_STUDIO_TOOL_IDS: readonly StudioToolTab[] = [
  'bridge',
  'sound_lab',
  'score_editor',
  'tradition_ab',
  'mixdown',
  'dastgah_quiz',
  'call_response',
  'prosody_avaz',
  'blind_tuning',
  'drone',
  'percussion',
  'poetry',
  'slowdowner',
  'temperament',
  'breath',
  'tuner',
  'metronome',
  'midi',
  'fft',
  'recorder',
] as const;

export const WORKSPACE_MODE_ORDER: readonly WorkspaceMode[] = ['lite', 'standard', 'full'] as const;

export const DEFAULT_WORKSPACE_MODE: WorkspaceMode = 'full';

export const WORKSPACE_MODE_STORAGE_KEY = 'navanegar_workspace_mode_v1';

export interface WorkspaceModeConfig {
  id: WorkspaceMode;
  labelFa: string;
  shortLabelFa: string;
  badgeFa: string;
  taglineFa: string;
  summaryFa: string;
  allowedTabs: readonly AppTab[];
  allowedStudioTools: readonly StudioToolTab[];
  header: {
    showGlossaryButton: boolean;
  };
  dashboard: {
    showPlacementButton: boolean;
    showTeacherButton: boolean;
    showExportButton: boolean;
    showOnboardingButton: boolean;
    showEarTraining: boolean;
    showHeatmapAndChallenges: boolean;
    showLearningPaths: boolean;
    showClassicalPieces: boolean;
    showBadgesAndHistory: boolean;
  };
  studio: {
    showTeacherButton: boolean;
    showExportButton: boolean;
    showMusicStandButton: boolean;
    showPrintSheetButton: boolean;
    showSoundEngineSelector: boolean;
    showReverbSelector: boolean;
    showOrnamentsToggle: boolean;
    showWaitModeButton: boolean;
    showHandsFreeButton: boolean;
    showFootPedalButton: boolean;
    showKoronModeToggle: boolean;
    showTranspositionToggle: boolean;
    showPitchContour: boolean;
  };
}

const LITE_STUDIO_TOOLS: readonly StudioToolTab[] = [
  'bridge',
  'tuner',
  'metronome',
  'recorder',
  'drone',
  'percussion',
] as const;

const STANDARD_STUDIO_TOOLS: readonly StudioToolTab[] = [
  ...LITE_STUDIO_TOOLS,
  'poetry',
  'prosody_avaz',
  'call_response',
  'slowdowner',
  'blind_tuning',
  'dastgah_quiz',
  'breath',
] as const;

export const WORKSPACE_MODE_CONFIGS: Record<WorkspaceMode, WorkspaceModeConfig> = {
  lite: {
    id: 'lite',
    labelFa: 'حالت سبک',
    shortLabelFa: 'سبک',
    badgeFa: 'خلوت و ساده',
    taglineFa: 'امکانات اصلی تمرین بدون شلوغی و سردرگمی',
    summaryFa: '۳ تب اصلی، ۶ ابزار ضروری کارگاه (پل انگشت‌گذاری، تیونر، مترونوم، ضبط، واخوان، تنبک) و قطعات کلاسیک',
    allowedTabs: ['dashboard', 'studio', 'explorer'],
    allowedStudioTools: LITE_STUDIO_TOOLS,
    header: {
      showGlossaryButton: false,
    },
    dashboard: {
      showPlacementButton: false,
      showTeacherButton: false,
      showExportButton: false,
      showOnboardingButton: true,
      showEarTraining: false,
      showHeatmapAndChallenges: false,
      showLearningPaths: false,
      showClassicalPieces: true,
      showBadgesAndHistory: false,
    },
    studio: {
      showTeacherButton: false,
      showExportButton: false,
      showMusicStandButton: false,
      showPrintSheetButton: false,
      showSoundEngineSelector: false,
      showReverbSelector: false,
      showOrnamentsToggle: false,
      showWaitModeButton: false,
      showHandsFreeButton: false,
      showFootPedalButton: false,
      showKoronModeToggle: false,
      showTranspositionToggle: false,
      showPitchContour: false,
    },
  },
  standard: {
    id: 'standard',
    labelFa: 'حالت متوسط',
    shortLabelFa: 'متوسط',
    badgeFa: 'هنرجویی',
    taglineFa: 'آموزش جامع ردیف، تربیت گوش، آواز و مسیر یادگیری',
    summaryFa: '۴ تب اصلی، ۱۳ ابزار کارگاه (شامل شعر، آواز عروضی، سؤال و جواب، آهسته‌ساز، آزمون دستگاه) + تربیت گوش و چالش‌ها',
    allowedTabs: ['dashboard', 'studio', 'explorer', 'modulation'],
    allowedStudioTools: STANDARD_STUDIO_TOOLS,
    header: {
      showGlossaryButton: true,
    },
    dashboard: {
      showPlacementButton: true,
      showTeacherButton: false,
      showExportButton: true,
      showOnboardingButton: true,
      showEarTraining: true,
      showHeatmapAndChallenges: true,
      showLearningPaths: true,
      showClassicalPieces: true,
      showBadgesAndHistory: true,
    },
    studio: {
      showTeacherButton: false,
      showExportButton: true,
      showMusicStandButton: true,
      showPrintSheetButton: false,
      showSoundEngineSelector: false,
      showReverbSelector: false,
      showOrnamentsToggle: true,
      showWaitModeButton: true,
      showHandsFreeButton: true,
      showFootPedalButton: false,
      showKoronModeToggle: true,
      showTranspositionToggle: true,
      showPitchContour: true,
    },
  },
  full: {
    id: 'full',
    labelFa: 'حالت کامل',
    shortLabelFa: 'کامل',
    badgeFa: 'حالت اصلی',
    taglineFa: 'همه امکانات استودیوی نوانگار بدون محدودیت',
    summaryFa: 'تمام ۵ تب، هر ۲۰ ابزار تخصصی (آزمایشگاه سمپل، نت‌نگار، میکسر WAV، مقایسه روایت‌ها، MIDI، FFT، پدال پا و انجمن)',
    allowedTabs: ['dashboard', 'studio', 'explorer', 'modulation', 'community'],
    allowedStudioTools: ALL_STUDIO_TOOL_IDS,
    header: {
      showGlossaryButton: true,
    },
    dashboard: {
      showPlacementButton: true,
      showTeacherButton: true,
      showExportButton: true,
      showOnboardingButton: true,
      showEarTraining: true,
      showHeatmapAndChallenges: true,
      showLearningPaths: true,
      showClassicalPieces: true,
      showBadgesAndHistory: true,
    },
    studio: {
      showTeacherButton: true,
      showExportButton: true,
      showMusicStandButton: true,
      showPrintSheetButton: true,
      showSoundEngineSelector: true,
      showReverbSelector: true,
      showOrnamentsToggle: true,
      showWaitModeButton: true,
      showHandsFreeButton: true,
      showFootPedalButton: true,
      showKoronModeToggle: true,
      showTranspositionToggle: true,
      showPitchContour: true,
    },
  },
};

export function isValidWorkspaceMode(value: unknown): value is WorkspaceMode {
  return value === 'lite' || value === 'standard' || value === 'full';
}

export function getWorkspaceModeConfig(mode: WorkspaceMode): WorkspaceModeConfig {
  return WORKSPACE_MODE_CONFIGS[mode] ?? WORKSPACE_MODE_CONFIGS[DEFAULT_WORKSPACE_MODE];
}

export function loadWorkspaceMode(): WorkspaceMode {
  if (typeof window === 'undefined') return DEFAULT_WORKSPACE_MODE;
  try {
    const raw = window.localStorage.getItem(WORKSPACE_MODE_STORAGE_KEY);
    return isValidWorkspaceMode(raw) ? raw : DEFAULT_WORKSPACE_MODE;
  } catch {
    return DEFAULT_WORKSPACE_MODE;
  }
}

export function saveWorkspaceMode(mode: WorkspaceMode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(WORKSPACE_MODE_STORAGE_KEY, mode);
  } catch {
    // ignore storage quota errors
  }
}

export function resolveAllowedTab(tab: AppTab, mode: WorkspaceMode): AppTab {
  const cfg = getWorkspaceModeConfig(mode);
  return cfg.allowedTabs.includes(tab) ? tab : 'dashboard';
}

export function resolveAllowedStudioTool(
  tool: StudioToolTab,
  mode: WorkspaceMode
): StudioToolTab {
  const cfg = getWorkspaceModeConfig(mode);
  return cfg.allowedStudioTools.includes(tool) ? tool : 'bridge';
}

export function getHiddenStudioToolCount(mode: WorkspaceMode): number {
  const cfg = getWorkspaceModeConfig(mode);
  return Math.max(0, ALL_STUDIO_TOOL_IDS.length - cfg.allowedStudioTools.length);
}

export function getNextExpandedMode(mode: WorkspaceMode): WorkspaceMode | null {
  if (mode === 'lite') return 'standard';
  if (mode === 'standard') return 'full';
  return null;
}
