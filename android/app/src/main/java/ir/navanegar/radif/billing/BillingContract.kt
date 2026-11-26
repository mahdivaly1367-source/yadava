package ir.navanegar.radif.billing

import androidx.appcompat.app.AppCompatActivity

object BillingSkus {
    const val LIFETIME = "navanegar_pro_lifetime"
    const val QUARTERLY = "navanegar_pro_quarterly"
    const val QUARTERLY_DURATION_MS = 90L * 24L * 60L * 60L * 1000L
}

data class BillingOutcome(
    val status: String, // purchased | restored | cancelled | expired | not_owned | offline_unverified | error
    val market: String, // bazaar | myket
    val productId: String? = null,
    val purchasedAt: Long? = null,
    val purchaseToken: String? = null,
    val message: String? = null
)

interface MarketBillingEngine {
    val marketFlavor: String
    fun supportsSubscriptions(): Boolean
    fun purchase(
        activity: AppCompatActivity,
        productId: String,
        callback: (BillingOutcome) -> Unit
    )
    fun restore(
        activity: AppCompatActivity,
        callback: (BillingOutcome) -> Unit
    )
    fun dispose()
}
