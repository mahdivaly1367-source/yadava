import { beforeEach, describe, expect, it } from 'vitest';
import {
  ALL_STUDIO_TOOL_IDS,
  DEFAULT_WORKSPACE_MODE,
  getHiddenStudioToolCount,
  getNextExpandedMode,
  getWorkspaceModeConfig,
  isValidWorkspaceMode,
  loadWorkspaceMode,
  resolveAllowedStudioTool,
  resolveAllowedTab,
  saveWorkspaceMode,
  WORKSPACE_MODE_CONFIGS,
  WORKSPACE_MODE_STORAGE_KEY,
} from '../core/workspaceMode';

describe('Workspace Mode (Lite / Standard / Full Progressive Disclosure)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('defaults to full mode as the main experience', () => {
    expect(DEFAULT_WORKSPACE_MODE).toBe('full');
    expect(loadWorkspaceMode()).toBe('full');
    expect(WORKSPACE_MODE_CONFIGS.full.badgeFa).toBe('حالت اصلی');
  });

  it('persists and restores workspace mode safely and rejects invalid storage values', () => {
    saveWorkspaceMode('lite');
    expect(loadWorkspaceMode()).toBe('lite');

    saveWorkspaceMode('standard');
    expect(loadWorkspaceMode()).toBe('standard');

    window.localStorage.setItem(WORKSPACE_MODE_STORAGE_KEY, 'unknown_mode');
    expect(loadWorkspaceMode()).toBe('full');

    expect(isValidWorkspaceMode('lite')).toBe(true);
    expect(isValidWorkspaceMode('standard')).toBe(true);
    expect(isValidWorkspaceMode('full')).toBe(true);
    expect(isValidWorkspaceMode('ultra')).toBe(false);
  });

  it('enforces strictly monotonic navigation tabs (lite 3 ⊂ standard 4 ⊂ full 5)', () => {
    const liteTabs = getWorkspaceModeConfig('lite').allowedTabs;
    const standardTabs = getWorkspaceModeConfig('standard').allowedTabs;
    const fullTabs = getWorkspaceModeConfig('full').allowedTabs;

    expect(liteTabs).toEqual(['dashboard', 'studio', 'explorer']);
    expect(standardTabs).toEqual(['dashboard', 'studio', 'explorer', 'modulation']);
    expect(fullTabs).toEqual(['dashboard', 'studio', 'explorer', 'modulation', 'community']);

    for (const tab of liteTabs) {
      expect(standardTabs).toContain(tab);
    }
    for (const tab of standardTabs) {
      expect(fullTabs).toContain(tab);
    }
  });

  it('enforces strictly monotonic studio tools (lite 6 ⊂ standard 13 ⊂ full 20)', () => {
    const liteTools = getWorkspaceModeConfig('lite').allowedStudioTools;
    const standardTools = getWorkspaceModeConfig('standard').allowedStudioTools;
    const fullTools = getWorkspaceModeConfig('full').allowedStudioTools;

    expect(liteTools.length).toBe(6);
    expect(standardTools.length).toBe(13);
    expect(fullTools.length).toBe(ALL_STUDIO_TOOL_IDS.length);
    expect(fullTools.length).toBe(20);

    for (const tool of liteTools) {
      expect(standardTools).toContain(tool);
    }
    for (const tool of standardTools) {
      expect(fullTools).toContain(tool);
    }

    expect(getHiddenStudioToolCount('lite')).toBe(14);
    expect(getHiddenStudioToolCount('standard')).toBe(7);
    expect(getHiddenStudioToolCount('full')).toBe(0);
    expect(getNextExpandedMode('lite')).toBe('standard');
    expect(getNextExpandedMode('standard')).toBe('full');
    expect(getNextExpandedMode('full')).toBeNull();
  });

  it('safely redirects hidden tabs and studio tools when switching to simpler modes', () => {
    expect(resolveAllowedTab('community', 'full')).toBe('community');
    expect(resolveAllowedTab('community', 'standard')).toBe('dashboard');
    expect(resolveAllowedTab('modulation', 'standard')).toBe('modulation');
    expect(resolveAllowedTab('modulation', 'lite')).toBe('dashboard');
    expect(resolveAllowedTab('studio', 'lite')).toBe('studio');

    expect(resolveAllowedStudioTool('fft', 'full')).toBe('fft');
    expect(resolveAllowedStudioTool('fft', 'standard')).toBe('bridge');
    expect(resolveAllowedStudioTool('call_response', 'standard')).toBe('call_response');
    expect(resolveAllowedStudioTool('call_response', 'lite')).toBe('bridge');
    expect(resolveAllowedStudioTool('tuner', 'lite')).toBe('tuner');
    expect(resolveAllowedStudioTool('recorder', 'lite')).toBe('recorder');
  });

  it('keeps classical pieces and core daily plan available in every mode while gating advanced controls', () => {
    const lite = getWorkspaceModeConfig('lite');
    const standard = getWorkspaceModeConfig('standard');
    const full = getWorkspaceModeConfig('full');

    expect(lite.dashboard.showClassicalPieces).toBe(true);
    expect(lite.dashboard.showEarTraining).toBe(false);
    expect(lite.studio.showFootPedalButton).toBe(false);
    expect(lite.studio.showPitchContour).toBe(false);

    expect(standard.dashboard.showEarTraining).toBe(true);
    expect(standard.dashboard.showTeacherButton).toBe(false);
    expect(standard.studio.showTranspositionToggle).toBe(true);
    expect(standard.studio.showSoundEngineSelector).toBe(false);

    expect(full.dashboard.showTeacherButton).toBe(true);
    expect(full.studio.showSoundEngineSelector).toBe(true);
    expect(full.studio.showReverbSelector).toBe(true);
    expect(full.studio.showFootPedalButton).toBe(true);
  });
});
