import React, { useState } from 'react';
import {
  CheckCircle2,
  Crown,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  isWebPreviewBillingAllowed,
  PRODUCT_CATALOG,
} from '../services/billing';
import type { BillingEntitlement, BillingProductId } from '../types/music';
import { formatToman, toPersianDigits } from '../utils/persian';

interface PaywallModalProps {
  open: boolean;
  onClose: () => void;
  entitlement: BillingEntitlement;
  onPurchase: (productId: BillingProductId) => Promise<void>;
  onRestore: () => Promise<void>;
  onResetWebPreview: () => void;
}

export const PaywallModal: React.FC<PaywallModalProps> = ({
  open,
  onClose,
  entitlement,
  onPurchase,
  onRestore,
  onResetWebPreview,
}) => {
  const [busyProduct, setBusyProduct] = useState<BillingProductId | 'restore' | null>(null);

  if (!open) return null;

  const allowWebPreview = isWebPreviewBillingAllowed();
  const marketLabelFa =
    entitlement.market === 'bazaar'
      ? 'درگاه پرداخت بومی کافه‌بازار (Poolakey)'
      : entitlement.market === 'myket'
      ? 'درگاه پرداخت بومی مایکت (Myket Billing)'
      : 'حالت پیش‌نمایش وب (غیرفعال در اندروید)';

  const handleBuy = async (productId: BillingProductId) => {
    setBusyProduct(productId);
    try {
      await onPurchase(productId);
    } finally {
      setBusyProduct(null);
    }
  };

  const handleRestore = async () => {
    setBusyProduct('restore');
    try {
      await onRestore();
    } finally {
      setBusyProduct(null);
    }
  };

  const statusTone =
    entitlement.status === 'purchased' || entitlement.status === 'restored'
      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
      : entitlement.status === 'offline_unverified' || entitlement.status === 'expired'
      ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
      : entitlement.status === 'error'
      ? 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300'
      : 'border-slate-300/60 bg-slate-100/80 text-slate-700 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <div className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-amber-500/30 bg-white p-6 shadow-2xl dark:bg-slate-900">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 left-4 rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
          aria-label="بستن"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-teal-600 text-white shadow-lg">
            <Crown className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
              نسخه حرفه‌ای نوانگار (Pro)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{marketLabelFa}</p>
          </div>
        </div>

        {/* Transparent Billing Status Banner */}
        <div className={`mt-4 rounded-2xl border p-3 text-xs leading-6 ${statusTone}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-bold">{entitlement.messageFa}</span>
            <span className="ltr-num rounded-md bg-black/10 px-2 py-0.5 text-[10px] font-bold uppercase dark:bg-white/10">
              {entitlement.status}
            </span>
          </div>
          {entitlement.expiresAt && entitlement.isPro && (
            <div className="mt-1 text-[11px] opacity-85">
              اعتبار اشتراک ۹۰ روزه تا:{' '}
              {toPersianDigits(new Date(entitlement.expiresAt).toLocaleDateString('fa-IR'))}
            </div>
          )}
        </div>

        {/* Feature Comparison */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/75 p-4 dark:border-slate-800 dark:bg-slate-800/50">
            <div className="text-xs font-extrabold text-slate-700 dark:text-slate-200">
              نسخه رایگان همیشگی
            </div>
            <ul className="mt-2.5 space-y-2 text-xs text-slate-600 dark:text-slate-300">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-500" />
                دستگاه شور، آواز ابوعطا و دستگاه ماهور (۴۳ گوشه)
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-500" />
                تیونر هوشمند ساز و مترونوم دقیق Web Audio
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-500" />
                آزمون تعیین سطح شنیداری و کوک صوتی
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-500" />
                ذخیره تا ۲ قطعه صوتی در بایگانی محلی
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-b from-amber-500/10 to-teal-500/10 p-4 dark:from-amber-500/15 dark:to-teal-500/10">
            <div className="text-xs font-extrabold text-amber-700 dark:text-amber-300">
              نسخه کامل (Pro)
            </div>
            <ul className="mt-2.5 space-y-2 text-xs text-slate-700 dark:text-slate-200">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                آزادسازی تمامی ۱۲ نظام و ۱۷۳ گوشه ردیف
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                ویژوالایزر زنده FFT، فیلتر مرتبه ۴ و کالیبراسیون زیرسنت A4
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                نقشه کامل مدولاسیون و گذرهای مُدال میان ۱۲ دستگاه
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                بایگانی نامحدود ضبط‌های صوتی و تحلیل کوک
              </li>
            </ul>
          </div>
        </div>

        {/* Two SKU Cards */}
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(['navanegar_pro_lifetime', 'navanegar_pro_quarterly'] as BillingProductId[]).map(
            (sku) => {
              const item = PRODUCT_CATALOG[sku];
              const isLifetime = sku === 'navanegar_pro_lifetime';
              const isOwned = entitlement.isPro && entitlement.productId === sku;

              return (
                <div
                  key={sku}
                  className={`flex flex-col justify-between rounded-2xl border p-4 ${
                    isLifetime
                      ? 'border-amber-500 bg-amber-500/5 shadow-md'
                      : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/60'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                        {item.titleFa}
                      </span>
                      {isLifetime && (
                        <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-slate-950">
                          پیشنهاد ویژه
                        </span>
                      )}
                    </div>
                    <div className="mt-2 text-xl font-black text-teal-700 dark:text-teal-300">
                      {formatToman(item.priceToman)}
                    </div>
                    <p className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
                      {item.subtitleFa}
                    </p>
                    <div className="ltr-num mt-2 text-[10px] text-slate-400">SKU: {item.id}</div>
                  </div>

                  <button
                    type="button"
                    disabled={busyProduct !== null || isOwned}
                    onClick={() => void handleBuy(sku)}
                    className={`mt-4 w-full rounded-xl py-2.5 text-xs font-extrabold transition ${
                      isOwned
                        ? 'cursor-default bg-emerald-600/20 text-emerald-700 dark:text-emerald-300'
                        : isLifetime
                        ? 'bg-gradient-to-l from-amber-500 to-teal-600 text-white shadow hover:opacity-95'
                        : 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-teal-600 dark:hover:bg-teal-700'
                    }`}
                  >
                    {busyProduct === sku
                      ? 'در حال ارتباط با درگاه...'
                      : isOwned
                      ? 'فعال روی این حساب'
                      : allowWebPreview
                      ? 'فعال‌سازی پیش‌نمایش وب'
                      : 'پرداخت امن از طریق مارکت'}
                  </button>
                </div>
              );
            }
          )}
        </div>

        {/* Footer Security Note & Restore */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 text-xs dark:border-slate-800">
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <span>
              تأیید امضای RSA و اعتبارسنجی آنلاین در اندروید (ضد دستکاری حافظه محلی)
            </span>
          </div>
          <div className="flex items-center gap-2">
            {allowWebPreview && entitlement.isPro && (
              <button
                type="button"
                onClick={onResetWebPreview}
                className="rounded-lg border border-slate-300 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
              >
                بازگشت به نسخه رایگان (وب)
              </button>
            )}
            <button
              type="button"
              disabled={busyProduct !== null}
              onClick={() => void handleRestore()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${busyProduct === 'restore' ? 'animate-spin' : ''}`} />
              بازیابی خرید قبلی
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
