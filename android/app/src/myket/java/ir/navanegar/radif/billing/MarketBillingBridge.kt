package ir.navanegar.radif.billing

import android.content.Context
import androidx.appcompat.app.AppCompatActivity
import ir.myket.billingclient.IabHelper
import ir.navanegar.radif.BuildConfig

/**
 * Myket native billing bridge built on `ir.myket:billing:2.2`.
 *
 * Enforces:
 * - Valid Myket RSA key in Release builds (`NAVANEGAR_MYKET_RSA_KEY`).
 * - Explicit `subscriptionsSupported()` check before launching subscription purchases.
 * - Full inventory restore across both `navanegar_pro_lifetime` (inapp) and
 *   `navanegar_pro_quarterly` (subs) with automatic 90-day expiry enforcement.
 */
class MarketBillingBridge(private val appContext: Context) : MarketBillingEngine {
    override val marketFlavor: String = "myket"

    private var iabHelper: IabHelper? = null
    private var setupComplete: Boolean = false
    private var subsSupported: Boolean = false

    private fun resolveRsaKey(): String {
        val key = BuildConfig.MARKET_RSA_KEY.trim()
        if (!BuildConfig.DEBUG) {
            check(key.length >= 32) {
                "SECURITY VIOLATION: NAVANEGAR_MYKET_RSA_KEY is required for Myket Release builds."
            }
        }
        return key
    }

    private fun ensureSetup(
        onReady: (IabHelper) -> Unit,
        onError: (String) -> Unit
    ) {
        val existing = iabHelper
        if (existing != null && setupComplete) {
            onReady(existing)
            return
        }

        val rsaKey = try {
            resolveRsaKey()
        } catch (ex: Throwable) {
            onError(ex.message ?: "خطای کلید امضای RSA مایکت")
            return
        }

        val helper = IabHelper(appContext, rsaKey)
        iabHelper = helper
        helper.startSetup { result ->
            if (!result.isSuccess) {
                setupComplete = false
                onError(result.message ?: "اتصال به سرویس پرداخت مایکت برقرار نشد.")
                return@startSetup
            }
            setupComplete = true
            subsSupported = helper.subscriptionsSupported()
            onReady(helper)
        }
    }

    override fun supportsSubscriptions(): Boolean {
        return iabHelper?.subscriptionsSupported() ?: subsSupported
    }

    override fun purchase(
        activity: AppCompatActivity,
        productId: String,
        callback: (BillingOutcome) -> Unit
    ) {
        ensureSetup(
            onReady = { helper ->
                val isSubscription = productId == BillingSkus.QUARTERLY
                if (isSubscription && !helper.subscriptionsSupported()) {
                    callback(
                        BillingOutcome(
                            status = "error",
                            market = marketFlavor,
                            message = "نسخه مایکت نصب‌شده از پرداخت اشتراک پشتیبانی نمی‌کند؛ لطفاً مایکت را به‌روزرسانی کنید یا نسخه دائمی را انتخاب نمایید."
                        )
                    )
                    return@ensureSetup
                }

                val itemType = if (isSubscription) {
                    IabHelper.ITEM_TYPE_SUBS
                } else {
                    IabHelper.ITEM_TYPE_INAPP
                }

                val payload = "navanegar_myket_${System.currentTimeMillis()}"
                try {
                    helper.launchPurchaseFlow(
                        activity,
                        productId,
                        itemType,
                        { result, purchase ->
                            if (result.response == IabHelper.IABHELPER_USER_CANCELLED ||
                                result.response == IabHelper.BILLING_RESPONSE_RESULT_USER_CANCELED
                            ) {
                                callback(BillingOutcome(status = "cancelled", market = marketFlavor))
                                return@launchPurchaseFlow
                            }

                            if (!result.isSuccess || purchase == null) {
                                callback(
                                    BillingOutcome(
                                        status = "error",
                                        market = marketFlavor,
                                        message = result.message ?: "خطا در تکمیل پرداخت مایکت"
                                    )
                                )
                                return@launchPurchaseFlow
                            }

                            callback(
                                BillingOutcome(
                                    status = "purchased",
                                    market = marketFlavor,
                                    productId = purchase.sku,
                                    purchasedAt = purchase.purchaseTime.takeIf { it > 0 }
                                        ?: System.currentTimeMillis(),
                                    purchaseToken = purchase.token
                                )
                            )
                        },
                        payload
                    )
                } catch (ex: Throwable) {
                    callback(
                        BillingOutcome(
                            status = "error",
                            market = marketFlavor,
                            message = ex.message ?: "اجرای درگاه مایکت با خطا مواجه شد."
                        )
                    )
                }
            },
            onError = { msg ->
                callback(BillingOutcome(status = "error", market = marketFlavor, message = msg))
            }
        )
    }

    override fun restore(
        activity: AppCompatActivity,
        callback: (BillingOutcome) -> Unit
    ) {
        ensureSetup(
            onReady = { helper ->
                val skus = listOf(BillingSkus.LIFETIME, BillingSkus.QUARTERLY)
                try {
                    helper.queryInventoryAsync(
                        true,
                        skus
                    ) { result, inventory ->
                        if (!result.isSuccess || inventory == null) {
                            callback(
                                BillingOutcome(
                                    status = "error",
                                    market = marketFlavor,
                                    message = result.message ?: "بازیابی موجودی از مایکت ناموفق بود."
                                )
                            )
                            return@queryInventoryAsync
                        }

                        // 1. Check permanent lifetime license first
                        val lifetime = inventory.getPurchase(BillingSkus.LIFETIME)
                        if (lifetime != null) {
                            callback(
                                BillingOutcome(
                                    status = "restored",
                                    market = marketFlavor,
                                    productId = lifetime.sku,
                                    purchasedAt = lifetime.purchaseTime.takeIf { it > 0 }
                                        ?: System.currentTimeMillis(),
                                    purchaseToken = lifetime.token
                                )
                            )
                            return@queryInventoryAsync
                        }

                        // 2. Check 90-day quarterly subscription
                        val quarterly = inventory.getPurchase(BillingSkus.QUARTERLY)
                        if (quarterly == null) {
                            callback(BillingOutcome(status = "not_owned", market = marketFlavor))
                            return@queryInventoryAsync
                        }

                        val now = System.currentTimeMillis()
                        val isExpired = quarterly.purchaseTime > 0 &&
                            (now >= quarterly.purchaseTime + BillingSkus.QUARTERLY_DURATION_MS)

                        callback(
                            BillingOutcome(
                                status = if (isExpired) "expired" else "restored",
                                market = marketFlavor,
                                productId = quarterly.sku,
                                purchasedAt = quarterly.purchaseTime,
                                purchaseToken = quarterly.token
                            )
                        )
                    }
                } catch (ex: Throwable) {
                    callback(
                        BillingOutcome(
                            status = "error",
                            market = marketFlavor,
                            message = ex.message
                        )
                    )
                }
            },
            onError = { msg ->
                callback(BillingOutcome(status = "error", market = marketFlavor, message = msg))
            }
        )
    }

    override fun dispose() {
        try {
            iabHelper?.dispose()
        } catch (_: Throwable) {
            // ignore
        }
        iabHelper = null
        setupComplete = false
    }
}
