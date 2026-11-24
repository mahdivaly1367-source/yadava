package ir.navanegar.radif.billing

import android.content.Context
import androidx.appcompat.app.AppCompatActivity
import ir.cafebazaar.poolakey.Connection
import ir.cafebazaar.poolakey.Payment
import ir.cafebazaar.poolakey.config.PaymentConfiguration
import ir.cafebazaar.poolakey.config.SecurityCheck
import ir.cafebazaar.poolakey.entity.PurchaseInfo
import ir.cafebazaar.poolakey.request.PurchaseRequest
import ir.navanegar.radif.BuildConfig

/**
 * CafeBazaar native billing bridge built on Poolakey 2.2.0.
 *
 * Security Invariant:
 * - In Release builds (`!BuildConfig.DEBUG`), `SecurityCheck.Disable` is STRICTLY FORBIDDEN.
 * - `BuildConfig.MARKET_RSA_KEY` (injected from `NAVANEGAR_BAZAAR_RSA_KEY`) is mandatory and
 *   verified via `SecurityCheck.Enable(rsaPublicKey = rsaKey)`.
 */
class MarketBillingBridge(private val appContext: Context) : MarketBillingEngine {
    override val marketFlavor: String = "bazaar"

    private var payment: Payment? = null
    private var connection: Connection? = null

    private fun buildSecurityCheck(): SecurityCheck {
        val rsaKey = BuildConfig.MARKET_RSA_KEY.trim()
        if (!BuildConfig.DEBUG) {
            // Hard runtime enforcement mirroring Gradle's verifyBazaarReleaseSecurity lock
            check(rsaKey.length >= 32) {
                "SECURITY VIOLATION: NAVANEGAR_BAZAAR_RSA_KEY is required in Release builds; SecurityCheck.Disable is forbidden."
            }
            return SecurityCheck.Enable(rsaPublicKey = rsaKey)
        }
        return if (rsaKey.length >= 32) {
            SecurityCheck.Enable(rsaPublicKey = rsaKey)
        } else {
            // Allowed ONLY in local debug builds when developer hasn't set a production RSA key yet
            SecurityCheck.Disable
        }
    }

    private fun ensureConnected(
        onConnected: (Payment) -> Unit,
        onError: (String) -> Unit
    ) {
        val existing = payment
        if (existing != null && connection != null) {
            onConnected(existing)
            return
        }

        val config = try {
            PaymentConfiguration(localSecurityCheck = buildSecurityCheck())
        } catch (ex: Throwable) {
            onError(ex.message ?: "خطای پیکربندی امضای RSA کافه‌بازار")
            return
        }

        val client = Payment(context = appContext, config = config)
        payment = client
        connection = client.connect {
            connectionSucceed {
                onConnected(client)
            }
            connectionFailed { throwable ->
                connection = null
                onError(throwable.message ?: "اتصال به برنامه کافه‌بازار برقرار نشد.")
            }
            disconnected {
                connection = null
            }
        }
    }

    override fun supportsSubscriptions(): Boolean = true

    override fun purchase(
        activity: AppCompatActivity,
        productId: String,
        callback: (BillingOutcome) -> Unit
    ) {
        ensureConnected(
            onConnected = { client ->
                val request = PurchaseRequest(
                    productId = productId,
                    payload = "navanegar_${System.currentTimeMillis()}"
                )
                val registry = activity.activityResultRegistry

                if (productId == BillingSkus.QUARTERLY) {
                    client.subscribeProduct(registry = registry, request = request) {
                        purchaseSucceed { entity ->
                            callback(
                                BillingOutcome(
                                    status = "purchased",
                                    market = marketFlavor,
                                    productId = entity.productId,
                                    purchasedAt = entity.purchaseTime.takeIf { it > 0 }
                                        ?: System.currentTimeMillis(),
                                    purchaseToken = entity.purchaseToken
                                )
                            )
                        }
                        purchaseCanceled {
                            callback(BillingOutcome(status = "cancelled", market = marketFlavor))
                        }
                        purchaseFailed { throwable ->
                            callback(
                                BillingOutcome(
                                    status = "error",
                                    market = marketFlavor,
                                    message = throwable.message
                                )
                            )
                        }
                    }
                } else {
                    client.purchaseProduct(registry = registry, request = request) {
                        purchaseSucceed { entity ->
                            callback(
                                BillingOutcome(
                                    status = "purchased",
                                    market = marketFlavor,
                                    productId = entity.productId,
                                    purchasedAt = entity.purchaseTime.takeIf { it > 0 }
                                        ?: System.currentTimeMillis(),
                                    purchaseToken = entity.purchaseToken
                                )
                            )
                        }
                        purchaseCanceled {
                            callback(BillingOutcome(status = "cancelled", market = marketFlavor))
                        }
                        purchaseFailed { throwable ->
                            callback(
                                BillingOutcome(
                                    status = "error",
                                    market = marketFlavor,
                                    message = throwable.message
                                )
                            )
                        }
                    }
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
        ensureConnected(
            onConnected = { client ->
                // 1. Check permanent in-app lifetime purchases first
                client.getPurchasedProducts {
                    querySucceed { purchasedList ->
                        val lifetime = purchasedList.firstOrNull {
                            it.productId == BillingSkus.LIFETIME
                        }
                        if (lifetime != null) {
                            callback(
                                BillingOutcome(
                                    status = "restored",
                                    market = marketFlavor,
                                    productId = lifetime.productId,
                                    purchasedAt = lifetime.purchaseTime.takeIf { it > 0 }
                                        ?: System.currentTimeMillis(),
                                    purchaseToken = lifetime.purchaseToken
                                )
                            )
                            return@querySucceed
                        }

                        // 2. Otherwise inspect quarterly subscriptions and verify 90-day window
                        queryQuarterlySubscription(client, callback)
                    }
                    queryFailed { throwable ->
                        callback(
                            BillingOutcome(
                                status = "error",
                                market = marketFlavor,
                                message = throwable.message
                            )
                        )
                    }
                }
            },
            onError = { msg ->
                callback(BillingOutcome(status = "error", market = marketFlavor, message = msg))
            }
        )
    }

    private fun queryQuarterlySubscription(
        client: Payment,
        callback: (BillingOutcome) -> Unit
    ) {
        client.getSubscribedProducts {
            querySucceed { subsList ->
                val activeSub: PurchaseInfo? = subsList
                    .filter { it.productId == BillingSkus.QUARTERLY }
                    .maxByOrNull { it.purchaseTime }

                if (activeSub == null) {
                    callback(BillingOutcome(status = "not_owned", market = marketFlavor))
                    return@querySucceed
                }

                val now = System.currentTimeMillis()
                val isExpired = activeSub.purchaseTime > 0 &&
                    (now >= activeSub.purchaseTime + BillingSkus.QUARTERLY_DURATION_MS)

                callback(
                    BillingOutcome(
                        status = if (isExpired) "expired" else "restored",
                        market = marketFlavor,
                        productId = activeSub.productId,
                        purchasedAt = activeSub.purchaseTime,
                        purchaseToken = activeSub.purchaseToken
                    )
                )
            }
            queryFailed { throwable ->
                callback(
                    BillingOutcome(
                        status = "error",
                        market = marketFlavor,
                        message = throwable.message
                    )
                )
            }
        }
    }

    override fun dispose() {
        try {
            connection?.disconnect()
        } catch (_: Throwable) {
            // ignore
        }
        connection = null
        payment = null
    }
}
