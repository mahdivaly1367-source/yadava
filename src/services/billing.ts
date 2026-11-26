import { Capacitor, registerPlugin } from '@capacitor/core';
import type {
  BillingEntitlement,
  BillingProductId,
  BillingStatus,
  MarketFlavor,
} from '../types/music';

export const FREE_MAX_RECORDINGS = 2;
export const QUARTERLY_DURATION_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

export const PRODUCT_CATALOG: Record<
  BillingProductId,
  {
    id: BillingProductId;
    titleFa: string;
    subtitleFa: string;
    priceToman: number;
    durationDays: number | null;
    type: 'inapp' | 'subs';
  }
> = {
  navanegar_pro_lifetime: {
    id: 'navanegar_pro_lifetime',
    titleFa: 'نسخه کامل نوانگار (دائمی)',
    subtitleFa: 'یک‌بار پرداخت، دسترسی همیشگی به تمامی ۱۷۳ گوشه، FFT زیرسنت و بایگانی نامحدود',
    priceToman: 249_000,
    durationDays: null,
    type: 'inapp',
  },
  navanegar_pro_quarterly: {
    id: 'navanegar_pro_quarterly',
    titleFa: 'اشتراک ۹۰ روزه نوانگار حرفه‌ای',
    subtitleFa: 'دسترسی کامل سه‌ماهه به کل ردیف ۱۲ دستگاهی، FFT زنده و نقشه کامل مدولاسیون',
    priceToman: 99_000,
    durationDays: 90,
    type: 'subs',
  },
};

export interface NativeBillingResult {
  status: BillingStatus;
  market: MarketFlavor;
  productId?: BillingProductId | null;
  purchasedAt?: number | null;
  purchaseToken?: string | null;
  message?: string;
}

export interface NavanegarBillingNativePlugin {
  getMarketInfo(): Promise<{ market: MarketFlavor; subscriptionsSupported: boolean }>;
  purchase(options: { productId: BillingProductId }): Promise<NativeBillingResult>;
  restorePurchases(): Promise<NativeBillingResult>;
}

const NativeBillingBridge = registerPlugin<NavanegarBillingNativePlugin>('NavanegarBilling');

const WEB_PREVIEW_STORAGE_KEY = 'navanegar_web_preview_entitlement';

export interface BillingRuntimeEnv {
  isNativeAndroid: () => boolean;
  isOnline: () => boolean;
  now: () => number;
  nativePlugin: NavanegarBillingNativePlugin;
}

const defaultEnv: BillingRuntimeEnv = {
  isNativeAndroid: () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android',
  isOnline: () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false),
  now: () => Date.now(),
  nativePlugin: NativeBillingBridge,
};

export const BILLING_STATUS_MESSAGES_FA: Record<BillingStatus, string> = {
  purchased: 'خرید با موفقیت تأیید و نسخه کامل نوانگار (Pro) فعال شد.',
  restored: 'سوابق خرید پیشین شما از مارکت بازیابی و فعال شد.',
  cancelled: 'فرآیند پرداخت توسط کاربر لغو شد.',
  expired: 'مهلت ۹۰ روزه اشتراک شما به پایان رسیده است. برای ادامه، اشتراک را تمدید یا نسخه دائمی تهیه کنید.',
  not_owned: 'نسخه رایگان همیشگی فعال است (۴۳ گوشه شور، ابوعطا و ماهور).',
  offline_unverified:
    'اتصال اینترنت برقرار نیست؛ تأیید خرید یا بازیابی از سرور مارکت بدون اینترنت امکان‌پذیر نیست.',
  error: 'خطایی در ارتباط با سرویس پرداخت مارکت رخ داد. لطفاً از نصب بودن کافه‌بازار یا مایکت مطمئن شوید.',
};

export function createFreeEntitlement(
  status: BillingStatus = 'not_owned',
  market: MarketFlavor = 'web',
  customMessage?: string
): BillingEntitlement {
  return {
    isPro: false,
    productId: null,
    market,
    purchasedAt: null,
    expiresAt: null,
    status,
    verifiedByNative: false,
    webPreviewMode: false,
    messageFa: customMessage || BILLING_STATUS_MESSAGES_FA[status],
  };
}

/**
 * Computes expiration and validates entitlement authenticity (including automatic 90-day quarterly expiry).
 */
export function evaluatePurchaseEntitlement(params: {
  productId: BillingProductId | null;
  purchasedAt: number | null;
  status: BillingStatus;
  market: MarketFlavor;
  verifiedByNative: boolean;
  webPreviewMode: boolean;
  nowMs: number;
}): BillingEntitlement {
  const { productId, purchasedAt, status, market, verifiedByNative, webPreviewMode, nowMs } = params;

  if (status !== 'purchased' && status !== 'restored') {
    return createFreeEntitlement(status, market);
  }

  if (!productId || !purchasedAt || purchasedAt <= 0 || purchasedAt > nowMs + 60_000) {
    return createFreeEntitlement('error', market, 'اطلاعات زمان خرید معتبر نیست.');
  }

  if (productId === 'navanegar_pro_quarterly') {
    const expiresAt = purchasedAt + QUARTERLY_DURATION_MS;
    if (nowMs >= expiresAt) {
      return {
        isPro: false,
        productId,
        market,
        purchasedAt,
        expiresAt,
        status: 'expired',
        verifiedByNative,
        webPreviewMode: false,
        messageFa: BILLING_STATUS_MESSAGES_FA.expired,
      };
    }

    return {
      isPro: true,
      productId,
      market,
      purchasedAt,
      expiresAt,
      status,
      verifiedByNative,
      webPreviewMode,
      messageFa: BILLING_STATUS_MESSAGES_FA[status],
    };
  }

  // Lifetime product
  return {
    isPro: true,
    productId: 'navanegar_pro_lifetime',
    market,
    purchasedAt,
    expiresAt: null,
    status,
    verifiedByNative,
    webPreviewMode,
    messageFa: BILLING_STATUS_MESSAGES_FA[status],
  };
}

/**
 * Anti-tamper guard:
 * On Android native builds, removes any tampered localStorage Pro key and forbids web preview mode.
 */
export function purgeTamperedLocalStorageOnAndroid(env: BillingRuntimeEnv = defaultEnv): void {
  if (!env.isNativeAndroid()) return;
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(WEB_PREVIEW_STORAGE_KEY);
    window.localStorage.removeItem('navanegar_pro');
    window.localStorage.removeItem('isPro');
  } catch {
    // ignore
  }
}

export function isWebPreviewBillingAllowed(env: BillingRuntimeEnv = defaultEnv): boolean {
  return !env.isNativeAndroid();
}

export async function detectMarketFlavor(env: BillingRuntimeEnv = defaultEnv): Promise<MarketFlavor> {
  if (!env.isNativeAndroid()) return 'web';
  try {
    const info = await env.nativePlugin.getMarketInfo();
    return info.market === 'bazaar' || info.market === 'myket' ? info.market : 'bazaar';
  } catch {
    return 'bazaar';
  }
}

/**
 * Loads initial entitlement safely:
 * - On Android: NEVER trusts localStorage; queries native market billing bridge when online,
 *   otherwise returns `offline_unverified` (never grants unverified Pro offline).
 * - On Web: reads optional web preview entitlement (with 90-day expiry enforcement).
 */
export async function hydrateEntitlement(
  env: BillingRuntimeEnv = defaultEnv
): Promise<BillingEntitlement> {
  if (env.isNativeAndroid()) {
    purgeTamperedLocalStorageOnAndroid(env);
    const market = await detectMarketFlavor(env);

    if (!env.isOnline()) {
      return createFreeEntitlement('offline_unverified', market);
    }

    try {
      const res = await env.nativePlugin.restorePurchases();
      return evaluatePurchaseEntitlement({
        productId: res.productId ?? null,
        purchasedAt: res.purchasedAt ?? null,
        status: res.status,
        market: res.market || market,
        verifiedByNative: res.status === 'restored' || res.status === 'purchased',
        webPreviewMode: false,
        nowMs: env.now(),
      });
    } catch {
      return createFreeEntitlement('error', market);
    }
  }

  // Web environment: optional local preview state (explicitly marked webPreviewMode)
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(WEB_PREVIEW_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          productId?: BillingProductId;
          purchasedAt?: number;
        };
        if (parsed.productId && parsed.purchasedAt) {
          return evaluatePurchaseEntitlement({
            productId: parsed.productId,
            purchasedAt: parsed.purchasedAt,
            status: 'restored',
            market: 'web',
            verifiedByNative: false,
            webPreviewMode: true,
            nowMs: env.now(),
          });
        }
      }
    } catch {
      // ignore corrupted web preview state
    }
  }

  return createFreeEntitlement('not_owned', 'web');
}

/**
 * Initiates a Pro purchase.
 * - On Android: requires online connectivity & native Poolakey/Myket verification.
 * - On Web: activates controlled web preview mode ONLY when online (rejects offline activation).
 */
export async function purchaseProProduct(
  productId: BillingProductId,
  env: BillingRuntimeEnv = defaultEnv
): Promise<BillingEntitlement> {
  const isAndroid = env.isNativeAndroid();
  if (isAndroid) {
    purgeTamperedLocalStorageOnAndroid(env);
  }

  const market = await detectMarketFlavor(env);

  if (!env.isOnline()) {
    return createFreeEntitlement('offline_unverified', market);
  }

  if (isAndroid) {
    try {
      const res = await env.nativePlugin.purchase({ productId });
      return evaluatePurchaseEntitlement({
        productId: res.productId ?? null,
        purchasedAt: res.purchasedAt ?? null,
        status: res.status,
        market: res.market || market,
        verifiedByNative: res.status === 'purchased' || res.status === 'restored',
        webPreviewMode: false,
        nowMs: env.now(),
      });
    } catch {
      return createFreeEntitlement('error', market);
    }
  }

  // Web preview activation (strictly disabled on Android)
  const purchasedAt = env.now();
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(
      WEB_PREVIEW_STORAGE_KEY,
      JSON.stringify({ productId, purchasedAt })
    );
  }
  return evaluatePurchaseEntitlement({
    productId,
    purchasedAt,
    status: 'purchased',
    market: 'web',
    verifiedByNative: false,
    webPreviewMode: true,
    nowMs: env.now(),
  });
}

export async function restoreProPurchases(
  env: BillingRuntimeEnv = defaultEnv
): Promise<BillingEntitlement> {
  const isAndroid = env.isNativeAndroid();
  const market = await detectMarketFlavor(env);

  if (!env.isOnline()) {
    return createFreeEntitlement('offline_unverified', market);
  }

  if (isAndroid) {
    purgeTamperedLocalStorageOnAndroid(env);
    try {
      const res = await env.nativePlugin.restorePurchases();
      return evaluatePurchaseEntitlement({
        productId: res.productId ?? null,
        purchasedAt: res.purchasedAt ?? null,
        status: res.status,
        market: res.market || market,
        verifiedByNative: res.status === 'restored' || res.status === 'purchased',
        webPreviewMode: false,
        nowMs: env.now(),
      });
    } catch {
      return createFreeEntitlement('error', market);
    }
  }

  return hydrateEntitlement(env);
}

export function clearWebPreviewEntitlement(env: BillingRuntimeEnv = defaultEnv): BillingEntitlement {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem(WEB_PREVIEW_STORAGE_KEY);
  }
  return createFreeEntitlement('not_owned', env.isNativeAndroid() ? 'bazaar' : 'web');
}
