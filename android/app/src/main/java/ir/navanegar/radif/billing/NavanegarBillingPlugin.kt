package ir.navanegar.radif.billing

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import ir.navanegar.radif.BuildConfig

@CapacitorPlugin(name = "NavanegarBilling")
class NavanegarBillingPlugin : Plugin() {
    private var engine: MarketBillingEngine? = null

    private fun getOrCreateEngine(): MarketBillingEngine {
        return engine ?: MarketBillingBridge(context.applicationContext).also {
            engine = it
        }
    }

    private fun isDeviceOnline(): Boolean {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
            ?: return false
        val network = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(network) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
            caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }

    private fun toJsObject(outcome: BillingOutcome): JSObject {
        return JSObject().apply {
            put("status", outcome.status)
            put("market", outcome.market)
            if (outcome.productId != null) put("productId", outcome.productId)
            if (outcome.purchasedAt != null) put("purchasedAt", outcome.purchasedAt)
            if (outcome.purchaseToken != null) put("purchaseToken", outcome.purchaseToken)
            if (outcome.message != null) put("message", outcome.message)
        }
    }

    @PluginMethod
    fun getMarketInfo(call: PluginCall) {
        val eng = getOrCreateEngine()
        val result = JSObject().apply {
            put("market", BuildConfig.MARKET_FLAVOR)
            put("subscriptionsSupported", eng.supportsSubscriptions())
        }
        call.resolve(result)
    }

    @PluginMethod
    fun purchase(call: PluginCall) {
        val productId = call.getString("productId")
        if (productId != BillingSkus.LIFETIME && productId != BillingSkus.QUARTERLY) {
            call.resolve(
                toJsObject(
                    BillingOutcome(
                        status = "error",
                        market = BuildConfig.MARKET_FLAVOR,
                        message = "شناسه محصول نامعتبر است."
                    )
                )
            )
            return
        }

        if (!isDeviceOnline()) {
            call.resolve(
                toJsObject(
                    BillingOutcome(
                        status = "offline_unverified",
                        market = BuildConfig.MARKET_FLAVOR,
                        message = "تأیید خرید بدون اتصال اینترنت امکان‌پذیر نیست."
                    )
                )
            )
            return
        }

        val act = activity
        if (act == null) {
            call.resolve(
                toJsObject(
                    BillingOutcome(
                        status = "error",
                        market = BuildConfig.MARKET_FLAVOR,
                        message = "اکتیویتی فعال برای آغاز پرداخت در دسترس نیست."
                    )
                )
            )
            return
        }

        val eng = getOrCreateEngine()
        act.runOnUiThread {
            eng.purchase(act, productId) { outcome ->
                call.resolve(toJsObject(outcome))
            }
        }
    }

    @PluginMethod
    fun restorePurchases(call: PluginCall) {
        if (!isDeviceOnline()) {
            call.resolve(
                toJsObject(
                    BillingOutcome(
                        status = "offline_unverified",
                        market = BuildConfig.MARKET_FLAVOR,
                        message = "بازیابی سوابق خرید بدون اتصال اینترنت امکان‌پذیر نیست."
                    )
                )
            )
            return
        }

        val act = activity
        if (act == null) {
            call.resolve(
                toJsObject(
                    BillingOutcome(
                        status = "error",
                        market = BuildConfig.MARKET_FLAVOR,
                        message = "اکتیویتی فعال در دسترس نیست."
                    )
                )
            )
            return
        }

        val eng = getOrCreateEngine()
        act.runOnUiThread {
            eng.restore(act) { outcome ->
                call.resolve(toJsObject(outcome))
            }
        }
    }

    override fun handleOnDestroy() {
        engine?.dispose()
        engine = null
        super.handleOnDestroy()
    }
}
