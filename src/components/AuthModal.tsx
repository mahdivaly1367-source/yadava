import React, { useState } from 'react';
import { LogIn, LogOut, Shield, UserCheck, Users, X } from 'lucide-react';
import { isFirebaseConfigured } from '../services/firebase';
import { GUEST_OWNER_UID } from '../services/sessionStore';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  ownerUid: string;
  displayName: string;
  onGoogleSignIn: () => Promise<void>;
  onSwitchLocalProfile: (uid: string, name: string) => void;
  onSignOut: () => Promise<void>;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  open,
  onClose,
  ownerUid,
  displayName,
  onGoogleSignIn,
  onSwitchLocalProfile,
  onSignOut,
}) => {
  const [loading, setLoading] = useState(false);
  const [errorFa, setErrorFa] = useState<string | null>(null);

  if (!open) return null;

  const isGuest = ownerUid === GUEST_OWNER_UID;
  const firebaseReady = isFirebaseConfigured();

  const handleGoogle = async () => {
    setErrorFa(null);
    setLoading(true);
    try {
      await onGoogleSignIn();
      onClose();
    } catch (err) {
      setErrorFa(err instanceof Error ? err.message : 'خطا در ورود با حساب گوگل.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setErrorFa(null);
    setLoading(true);
    try {
      await onSignOut();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 left-4 rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="بستن"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-600/15 text-teal-600 dark:text-teal-300">
            <UserCheck className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
              حساب کاربری و جداسازی نشست
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              وضعیت فعلی: <strong className="text-teal-600 dark:text-teal-300">{displayName}</strong>{' '}
              ({isGuest ? 'حالت مهمان' : `شناسه: ${ownerUid.slice(0, 12)}`})
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-teal-500/25 bg-teal-500/5 p-3 text-xs leading-6 text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-1.5 font-bold text-teal-700 dark:text-teal-300">
            <Shield className="h-4 w-4" />
            ایزوله‌سازی اتمیک کاربران و IndexedDB
          </div>
          <p className="mt-1">
            هنگام خروج یا تغییر حساب، تمامی وضعیت‌های حافظه، ObjectURL فایل‌های صوتی و عملیات
            همگام‌سازی معوق بلافاصله پاکسازی می‌شوند و ضبط‌های هر کاربر با کلید مجزا ذخیره می‌گردد.
          </p>
        </div>

        {errorFa && (
          <div className="mt-3 rounded-xl border border-rose-500/35 bg-rose-500/10 p-2.5 text-xs text-rose-600 dark:text-rose-300">
            {errorFa}
          </div>
        )}

        <div className="mt-4 space-y-2.5">
          <button
            type="button"
            disabled={loading}
            onClick={() => void handleGoogle()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-50"
          >
            <LogIn className="h-4 w-4" />
            {loading
              ? 'در حال اتصال به احراز هویت گوگل...'
              : 'ورود با حساب گوگل (وب و اندروید بومی)'}
          </button>

          {!firebaseReady && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/60">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
                <Users className="h-3.5 w-3.5 text-amber-500" />
                حساب‌های ایزوله محلی (آفلاین / تست جابه‌جایی A ← B)
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onSwitchLocalProfile('local_user_sara', 'سارا (تارنواز)');
                    onClose();
                  }}
                  className="rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 hover:border-teal-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  حساب الف (سارا)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSwitchLocalProfile('local_user_amir', 'امیر (سنتور)');
                    onClose();
                  }}
                  className="rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 hover:border-teal-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  حساب ب (امیر)
                </button>
              </div>
            </div>
          )}

          {!isGuest && (
            <button
              type="button"
              disabled={loading}
              onClick={() => void handleSignOut()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/35 bg-rose-500/10 px-4 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-500/20 dark:text-rose-300"
            >
              <LogOut className="h-4 w-4" />
              خروج امن و بازگشت به حالت مهمان
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
