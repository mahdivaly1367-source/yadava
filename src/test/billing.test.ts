import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FREE_MAX_RECORDINGS,
  hydrateEntitlement,
  isWebPreviewBillingAllowed,
  PRODUCT_CATALOG,
  purchaseProProduct,
  QUARTERLY_DURATION_MS,
  restoreProPurchases,
  type BillingRuntimeEnv,
  type NavanegarBillingNativePlugin,
} from '../services/billing';

function makeMockAndroidEnv(overrides?: Partial<BillingRuntimeEnv> & {
  pluginOverrides?: Partial<NavanegarBillingNativePlugin>;
}): BillingRuntimeEnv {
  const defaultPlugin: NavanegarBillingNativePlugin = {
    getMarketInfo: vi.fn(async () => ({ market: 'bazaar' as const, subscriptionsSupported: true })),
    purchase: vi.fn(async ({ productId }) => ({
      status: 'purchased' as const,
      market: 'bazaar' as const,
      productId,
      purchasedAt: 1_750_000_000_000,
    })),
    restorePurchases: vi.fn(async () => ({
      status: 'not_owned' as const,
      market: 'bazaar' as const,
    })),
    ...(overrides?.pluginOverrides ?? {}),
  };

  return {
    isNativeAndroid: () => true,
    isOnline: () => true,
    now: () => 1_750_000_000_000,
    nativePlugin: defaultPlugin,
    ...overrides,
  };
}

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('Freemium Catalog, Dual-Market Android Billing & Anti-Tamper Security', () => {
  it('defines exact SKUs, Toman prices, and Free recording cap', () => {
    expect(FREE_MAX_RECORDINGS).toBe(2);
    expect(PRODUCT_CATALOG.navanegar_pro_lifetime.priceToman).toBe(249_000);
    expect(PRODUCT_CATALOG.navanegar_pro_quarterly.priceToman).toBe(99_000);
    expect(PRODUCT_CATALOG.navanegar_pro_quarterly.durationDays).toBe(90);
  });

  it('prevents Pro activation via localStorage tampering and disables web preview on Android', async () => {
    // Attacker injects fake Pro flags into localStorage
    window.localStorage.setItem(
      'navanegar_web_preview_entitlement',
      JSON.stringify({
        productId: 'navanegar_pro_lifetime',
        purchasedAt: 1_750_000_000_000,
      })
    );
    window.localStorage.setItem('navanegar_pro', 'true');
    window.localStorage.setItem('isPro', 'true');

    const env = makeMockAndroidEnv();
    expect(isWebPreviewBillingAllowed(env)).toBe(false);

    const ent = await hydrateEntitlement(env);
    expect(ent.isPro).toBe(false);
    expect(ent.status).toBe('not_owned');
    expect(ent.webPreviewMode).toBe(false);

    // Tampered keys must have been purged
    expect(window.localStorage.getItem('navanegar_web_preview_entitlement')).toBeNull();
    expect(window.localStorage.getItem('navanegar_pro')).toBeNull();
    expect(window.localStorage.getItem('isPro')).toBeNull();
  });

  it('rejects fake activation and returns offline_unverified when internet is disconnected', async () => {
    const env = makeMockAndroidEnv({ isOnline: () => false });

    const hydrated = await hydrateEntitlement(env);
    expect(hydrated.isPro).toBe(false);
    expect(hydrated.status).toBe('offline_unverified');

    const bought = await purchaseProProduct('navanegar_pro_lifetime', env);
    expect(bought.isPro).toBe(false);
    expect(bought.status).toBe('offline_unverified');

    const restored = await restoreProPurchases(env);
    expect(restored.isPro).toBe(false);
    expect(restored.status).toBe('offline_unverified');
  });

  it('automatically expires 90-day quarterly subscription after 90 days while keeping lifetime permanent', async () => {
    const purchaseTime = 1_750_000_000_000;

    // Day 89: still active
    const day89Env = makeMockAndroidEnv({
      now: () => purchaseTime + QUARTERLY_DURATION_MS - 60_000,
      pluginOverrides: {
        restorePurchases: vi.fn(async () => ({
          status: 'restored' as const,
          market: 'myket' as const,
          productId: 'navanegar_pro_quarterly' as const,
          purchasedAt: purchaseTime,
        })),
      },
    });
    const active = await hydrateEntitlement(day89Env);
    expect(active.isPro).toBe(true);
    expect(active.status).toBe('restored');
    expect(active.market).toBe('myket');

    // Day 90+: automatically expired!
    const day91Env = makeMockAndroidEnv({
      now: () => purchaseTime + QUARTERLY_DURATION_MS + 1000,
      pluginOverrides: {
        restorePurchases: vi.fn(async () => ({
          status: 'restored' as const,
          market: 'myket' as const,
          productId: 'navanegar_pro_quarterly' as const,
          purchasedAt: purchaseTime,
        })),
      },
    });
    const expired = await hydrateEntitlement(day91Env);
    expect(expired.isPro).toBe(false);
    expect(expired.status).toBe('expired');

    // Lifetime remains active years later
    const yearLaterEnv = makeMockAndroidEnv({
      now: () => purchaseTime + 5 * 365 * 24 * 60 * 60 * 1000,
      pluginOverrides: {
        restorePurchases: vi.fn(async () => ({
          status: 'restored' as const,
          market: 'bazaar' as const,
          productId: 'navanegar_pro_lifetime' as const,
          purchasedAt: purchaseTime,
        })),
      },
    });
    const lifetime = await hydrateEntitlement(yearLaterEnv);
    expect(lifetime.isPro).toBe(true);
    expect(lifetime.status).toBe('restored');
    expect(lifetime.expiresAt).toBeNull();
  });

  it('surfaces distinct transparent billing statuses: purchased, restored, cancelled, expired, not_owned, offline_unverified, error', async () => {
    const envCancelled = makeMockAndroidEnv({
      pluginOverrides: {
        purchase: vi.fn(async () => ({ status: 'cancelled' as const, market: 'bazaar' as const })),
      },
    });
    const cancelled = await purchaseProProduct('navanegar_pro_lifetime', envCancelled);
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.isPro).toBe(false);

    const envPurchased = makeMockAndroidEnv();
    const purchased = await purchaseProProduct('navanegar_pro_lifetime', envPurchased);
    expect(purchased.status).toBe('purchased');
    expect(purchased.isPro).toBe(true);
    expect(purchased.verifiedByNative).toBe(true);

    const envError = makeMockAndroidEnv({
      pluginOverrides: {
        purchase: vi.fn(async () => {
          throw new Error('Market not installed');
        }),
      },
    });
    const errored = await purchaseProProduct('navanegar_pro_quarterly', envError);
    expect(errored.status).toBe('error');
    expect(errored.isPro).toBe(false);
  });
});
