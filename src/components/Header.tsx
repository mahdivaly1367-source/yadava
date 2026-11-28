import React, { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Check,
  ChevronDown,
  Compass,
  Crown,
  Layers,
  LayoutDashboard,
  Moon,
  Network,
  Radio,
  Sun,
  User,
  Users,
  WifiOff,
} from 'lucide-react';
import {
  getWorkspaceModeConfig,
  WORKSPACE_MODE_CONFIGS,
  WORKSPACE_MODE_ORDER,
} from '../core/workspaceMode';
import type { AppTab, BillingEntitlement, WorkspaceMode } from '../types/music';
import { GUEST_OWNER_UID } from '../services/sessionStore';

interface HeaderProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  workspaceMode: WorkspaceMode;
  onChangeWorkspaceMode: (mode: WorkspaceMode) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  ownerUid: string;
  displayName: string;
  entitlement: BillingEntitlement;
  isOffline: boolean;
  onOpenAuth: () => void;
  onOpenPaywall: () => void;
  onOpenGlossary?: () => void;
}

const NAV_ITEMS: Array<{
  id: AppTab;
  labelFa: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'dashboard', labelFa: 'برنامه روزانه', icon: LayoutDashboard },
  { id: 'studio', labelFa: 'کارگاه تمرین', icon: Radio },
  { id: 'explorer', labelFa: 'مرورگر ردیف', icon: Compass },
  { id: 'modulation', labelFa: 'نقشه مدولاسیون', icon: Network },
  { id: 'community', labelFa: 'انجمن زنده', icon: Users },
];

const MODE_BUTTON_STYLES: Record<WorkspaceMode, string> = {
  lite: 'border-emerald-500/40 bg-emerald-500/12 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300',
  standard: 'border-sky-500/40 bg-sky-500/12 text-sky-700 hover:bg-sky-500/20 dark:text-sky-300',
  full: 'border-teal-500/40 bg-teal-500/12 text-teal-700 hover:bg-teal-500/20 dark:text-teal-300',
};

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onSelectTab,
  workspaceMode,
  onChangeWorkspaceMode,
  theme,
  onToggleTheme,
  ownerUid,
  displayName,
  entitlement,
  isOffline,
  onOpenAuth,
  onOpenPaywall,
  onOpenGlossary,
}) => {
  const isGuest = ownerUid === GUEST_OWNER_UID;
  const modeConfig = getWorkspaceModeConfig(workspaceMode);
  const visibleNavItems = NAV_ITEMS.filter((item) => modeConfig.allowedTabs.includes(item.id));

  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const modeMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!modeMenuOpen) return;
    const handlePointerDown = (ev: MouseEvent) => {
      if (modeMenuRef.current && !modeMenuRef.current.contains(ev.target as Node)) {
        setModeMenuOpen(false);
      }
    };
    const handleKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setModeMenuOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [modeMenuOpen]);

  const mobileGridClass =
    visibleNavItems.length <= 3
      ? 'grid-cols-3'
      : visibleNavItems.length === 4
      ? 'grid-cols-4'
      : 'grid-cols-5';

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/85">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-3 sm:gap-3 sm:px-4">
          {/* Brand Emblem */}
          <button
            type="button"
            onClick={() => onSelectTab('dashboard')}
            className="flex items-center gap-2.5 text-right"
          >
            <img
              src="/icon.svg"
              alt="نوانگار"
              className="h-9 w-9 rounded-xl shadow-md shadow-teal-600/20"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-black tracking-tight text-slate-900 dark:text-white">
                  نوانگار
                </span>
                <span className="hidden rounded-md bg-teal-500/15 px-1.5 py-0.5 text-[10px] font-bold text-teal-700 sm:inline dark:text-teal-300">
                  ردیف اصیل
                </span>
              </div>
              <p className="hidden text-[11px] text-slate-500 sm:block dark:text-slate-400">
                استودیوی جامع موسیقی ایرانی (۱۲ دستگاه • ۱۷۳ گوشه)
              </p>
            </div>
          </button>

          {/* Desktop Navigation */}
          <nav className="hidden items-center gap-1 rounded-2xl border border-slate-200/80 bg-slate-100/75 p-1 lg:flex dark:border-slate-800 dark:bg-slate-900/80">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                    active
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.labelFa}
                </button>
              );
            })}
          </nav>

          {/* Right Action Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {isOffline && (
              <span
                title="حالت آفلاین — تمام پردازش صوتی بدون اینترنت فعال است"
                className="inline-flex items-center gap-1 rounded-xl border border-amber-500/35 bg-amber-500/15 px-2 py-1.5 text-[11px] font-bold text-amber-700 dark:text-amber-300"
              >
                <WifiOff className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">آفلاین</span>
              </span>
            )}

            {/* Workspace Mode Switcher (Lite / Standard / Full) */}
            <div className="relative" ref={modeMenuRef}>
              <button
                type="button"
                onClick={() => setModeMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={modeMenuOpen}
                aria-label="تغییر حالت نمایش امکانات (سبک، متوسط، کامل)"
                title="تغییر سطح نمایش امکانات: سبک / متوسط / کامل"
                className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-extrabold transition cursor-pointer ${MODE_BUTTON_STYLES[workspaceMode]}`}
              >
                <Layers className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">نمای</span>
                <span>{modeConfig.shortLabelFa}</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${modeMenuOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {modeMenuOpen && (
                <div
                  role="menu"
                  aria-label="انتخاب حالت نمایش امکانات"
                  className="absolute left-0 mt-2 w-72 rounded-2xl border border-slate-200/90 bg-white p-2 shadow-2xl ring-1 ring-slate-900/5 sm:w-80 dark:border-slate-700 dark:bg-slate-900"
                >
                  <div className="mb-1.5 px-2.5 pt-1 text-[11px] font-extrabold text-slate-500 dark:text-slate-400">
                    انتخاب سطح نمایش امکانات (بدون حذف اطلاعات)
                  </div>
                  <div className="space-y-1.5">
                    {WORKSPACE_MODE_ORDER.map((modeId) => {
                      const cfg = WORKSPACE_MODE_CONFIGS[modeId];
                      const selected = workspaceMode === modeId;
                      return (
                        <button
                          key={modeId}
                          type="button"
                          role="menuitemradio"
                          aria-checked={selected}
                          onClick={() => {
                            onChangeWorkspaceMode(modeId);
                            setModeMenuOpen(false);
                          }}
                          className={`flex w-full items-start justify-between gap-2 rounded-xl border p-2.5 text-right transition cursor-pointer ${
                            selected
                              ? 'border-teal-500 bg-teal-500/10 dark:bg-teal-500/15'
                              : 'border-slate-200/75 bg-slate-50/60 hover:border-slate-300 hover:bg-slate-100/70 dark:border-slate-800 dark:bg-slate-800/50 dark:hover:border-slate-700'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-xs font-black text-slate-900 dark:text-white">
                                {cfg.labelFa}
                              </span>
                              <span
                                className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                                  modeId === 'full'
                                    ? 'bg-teal-500/20 text-teal-700 dark:text-teal-300'
                                    : modeId === 'standard'
                                    ? 'bg-sky-500/20 text-sky-700 dark:text-sky-300'
                                    : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                                }`}
                              >
                                {cfg.badgeFa}
                              </span>
                            </div>
                            <p className="mt-1 text-[11px] leading-4 text-slate-600 dark:text-slate-300">
                              {cfg.taglineFa}
                            </p>
                            <p className="mt-0.5 text-[10px] leading-4 text-slate-500 dark:text-slate-400">
                              {cfg.summaryFa}
                            </p>
                          </div>
                          <span
                            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                              selected
                                ? 'border-teal-500 bg-teal-600 text-white'
                                : 'border-slate-300 dark:border-slate-600'
                            }`}
                          >
                            {selected && <Check className="h-3 w-3" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {onOpenGlossary && modeConfig.header.showGlossaryButton && (
              <button
                type="button"
                onClick={onOpenGlossary}
                title="فرهنگ صوتی اصطلاحات ردیف"
                className="inline-flex items-center gap-1 rounded-xl border border-amber-500/35 bg-amber-500/10 px-2.5 py-1.5 text-xs font-bold text-amber-700 transition hover:bg-amber-500/20 dark:text-amber-300"
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span className="hidden md:inline">فرهنگ صوتی</span>
              </button>
            )}

            <button
              type="button"
              onClick={onOpenPaywall}
              className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-extrabold transition sm:px-3 ${
                entitlement.isPro
                  ? 'border border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300'
                  : 'bg-gradient-to-l from-amber-500 to-teal-600 text-white shadow-sm hover:opacity-95'
              }`}
            >
              <Crown className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">
                {entitlement.isPro ? 'نسخه Pro' : 'ارتقا به Pro'}
              </span>
              <span className="sm:hidden">Pro</span>
            </button>

            <button
              type="button"
              onClick={onToggleTheme}
              className="rounded-xl border border-slate-200 bg-slate-100 p-2 text-slate-600 transition hover:bg-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="تغییر تم روشن و تاریک"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-amber-400" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>

            <button
              type="button"
              onClick={onOpenAuth}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 transition hover:border-teal-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <User className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
              <span className="hidden max-w-[92px] truncate sm:inline">
                {isGuest ? 'مهمان' : displayName}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] pt-1.5 backdrop-blur-md lg:hidden dark:border-slate-800 dark:bg-slate-950/95">
        <div className={`mx-auto grid max-w-lg ${mobileGridClass} gap-1`}>
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`flex flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[10px] font-bold transition ${
                  active
                    ? 'bg-teal-600/12 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="truncate">{item.labelFa}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
