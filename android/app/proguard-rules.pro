# Navanegar ProGuard / R8 Keep Rules

# Capacitor Plugins
-keep @com.getcapacitor.annotation.CapacitorPlugin public class * { *; }
-keepclassmembers class * {
    @com.getcapacitor.PluginMethod <methods>;
}
-keep class ir.navanegar.radif.billing.** { *; }

# CafeBazaar Poolakey 2.2.0
-keep class ir.cafebazaar.poolakey.** { *; }
-keep class com.farsitel.bazaar.** { *; }

# Myket Billing 2.2
-keep class ir.myket.billingclient.** { *; }
-keep class com.android.vending.billing.** { *; }

# Firebase Auth & Google Sign-In
-keepattributes Signature,InnerClasses,EnclosingMethod
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.auth.** { *; }
