import React from 'react';
import {
  BookOpen,
  Compass,
  Crown,
  LayoutDashboard,
  Moon,
  Network,
  Radio,
  Sun,
  User,
  Users,
  WifiOff,
} from 'lucide-react';
import type { AppTab, BillingEntitlement } from '../types/music';
import { GUEST_OWNER_UID } from '../services/sessionStore';

interface HeaderProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
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

const NAV_ITEMS: Array<{ id: AppTab; labelFa: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'dashboard', labelFa: 'برنامه روزانه', icon: LayoutDashboard },
  { id: 'studio', labelFa: 'کارگاه تمرین', icon: Radio },
  { id: 'explorer', labelFa: 'مرورگر ردیف', icon: Compass },
  { id: 'modulation', labelFa: 'نقشه مدولاسیون', icon: Network },
  { id: 'community', labelFa: 'انجمن زنده', icon: Users },
];

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onSelectTab,
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

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/85">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
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
                <span className="rounded-md bg-teal-500/15 px-1.5 py-0.5 text-[10px] font-bold text-teal-700 dark:text-teal-300">
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
            {NAV_ITEMS.map((item) => {
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
          <div className="flex items-center gap-2">
            {isOffline && (
              <span
                title="حالت آفلاین — تمام پردازش صوتی بدون اینترنت فعال است"
                className="inline-flex items-center gap-1 rounded-xl border border-amber-500/35 bg-amber-500/15 px-2.5 py-1.5 text-[11px] font-bold text-amber-700 dark:text-amber-300"
              >
                <WifiOff className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">آفلاین</span>
              </span>
            )}

            {onOpenGlossary && (
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
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-extrabold transition ${
                entitlement.isPro
                  ? 'border border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300'
                  : 'bg-gradient-to-l from-amber-500 to-teal-600 text-white shadow-sm hover:opacity-95'
              }`}
            >
              <Crown className="h-3.5 w-3.5" />
              <span>{entitlement.isPro ? 'نسخه Pro' : 'ارتقا به Pro'}</span>
            </button>

            <button
              type="button"
              onClick={onToggleTheme}
              className="rounded-xl border border-slate-200 bg-slate-100 p-2 text-slate-600 transition hover:bg-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="تغییر تم روشن و تاریک"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
            </button>

            <button
              type="button"
              onClick={onOpenAuth}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 transition hover:border-teal-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <User className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
              <span className="max-w-[92px] truncate">{isGuest ? 'مهمان' : displayName}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] pt-1.5 backdrop-blur-md lg:hidden dark:border-slate-800 dark:bg-slate-950/95">
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-1">
          {NAV_ITEMS.map((item) => {
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
