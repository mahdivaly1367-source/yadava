# راهنمای ساخت، امضا و انتشار اندروید نوانگار (کافه‌بازار و مایکت)

این سند مراحل گام‌به‌گام آماده‌سازی کلید امضا، تنظیمات پرداخت درون‌برنامه‌ای (Poolakey کافه‌بازار و IAB مایکت)، ساخت خروجی‌های `Debug` و `Release` (APK و AAB) و اعتبارسنجی نهایی امضا را شرح می‌دهد.

---

## ۱. پیش‌نیازهای محیط ساخت (Local یا CI)

- **Node.js 22+** و **npm 10+**
- **JDK 17** (برای AGP 8.7.2 و Gradle 8.11)
- **Android SDK** (`compileSdk 35`, `build-tools 35.0.0`, `platform-tools`)
- فایل `android/app/google-services.json` (دریافت‌شده از کنسول Firebase با شناسه `ir.navanegar.radif` و SHA-1 کلید امضای انتشار)

> **نکته امنیتی**: فایل‌های `android/keystore.properties`، `*.jks`، `*.keystore`، `google-services.json` و `.env.local` در `.gitignore` مسدود شده‌اند تا هرگز وارد تاریخچه Git نشوند.

---

## ۲. تولید کلید امضای انتشار (Release Keystore)

اگر هنوز فایل کلید امضای `navanegar-release.jks` را نساخته‌اید، دستور زیر را اجرا کنید:

```bash
keytool -genkey -v \
  -keystore android/navanegar-release.jks \
  -alias navanegar-release \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

سپس فایل `android/keystore.properties` را بر اساس الگوی `android/keystore.properties.example` بسازید:

```properties
storeFile=navanegar-release.jks
storePassword=YOUR_STRONG_STORE_PASSWORD
keyAlias=navanegar-release
keyPassword=YOUR_STRONG_KEY_PASSWORD
```

---

## ۳. همگام‌سازی وب با Capacitor Android

پیش از هر ساخت Gradle، بیلد تولید وب را بسازید و با Capacitor همگام کنید:

```bash
npm ci
npm run build
npx cap sync android
```

---

## ۴. ساخت خروجی‌های Debug (برای تست روی دستگاه بدون امضای انتشار)

```bash
cd android
./gradlew assembleBazaarDebug assembleMyketDebug
```

خروجی‌ها:
- `android/app/build/outputs/apk/bazaar/debug/app-bazaar-debug.apk`
- `android/app/build/outputs/apk/myket/debug/app-myket-debug.apk`

---

## ۵. ساخت خروجی‌های Release امضاشده (کافه‌بازار و مایکت)

پروژه دارای قفل امنیتی سخت‌گیرانه در `android/app/build.gradle` است:
- اگر `android/keystore.properties` یا فایل `.jks` مفقود باشد، ساخت Release متوقف می‌شود.
- اگر `android/app/google-services.json` موجود نباشد، ساخت Release متوقف می‌شود.
- برای **کافه‌بازار** (`bazaarRelease`)، متغیر محیطی `NAVANEGAR_BAZAAR_RSA_KEY` اجباری است و `SecurityCheck.Disable` مطلقاً در بیلد غیر Debug ممنوع شده است.
- برای **مایکت** (`myketRelease`)، متغیر محیطی `NAVANEGAR_MYKET_RSA_KEY` اجباری است و `manifestPlaceholders` به `ir.mservices.market` و مجوز `ir.mservices.market.BILLING` متصل است.

### ۵.۱ بیلد کافه‌بازار (APK + AAB)

```bash
export NAVANEGAR_BAZAAR_RSA_KEY="MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A..."
cd android
./gradlew assembleBazaarRelease bundleBazaarRelease
```

خروجی‌ها:
- `android/app/build/outputs/apk/bazaar/release/app-bazaar-release.apk`
- `android/app/build/outputs/bundle/bazaarRelease/app-bazaar-release.aab`

### ۵.۲ بیلد مایکت (APK + AAB)

```bash
export NAVANEGAR_MYKET_RSA_KEY="MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A..."
cd android
./gradlew assembleMyketRelease bundleMyketRelease
```

خروجی‌ها:
- `android/app/build/outputs/apk/myket/release/app-myket-release.apk`
- `android/app/build/outputs/bundle/myketRelease/app-myket-release.aab`

---

## ۶. اعتبارسنجی نهایی امضا با `apksigner`

```bash
apksigner verify --verbose android/app/build/outputs/apk/bazaar/release/app-bazaar-release.apk
apksigner verify --verbose android/app/build/outputs/apk/myket/release/app-myket-release.apk
```

---

## ۷. شناسه‌های محصول در پنل توسعه‌دهندگان کافه‌بازار و مایکت

در هر دو پنل کافه‌بازار (پیشخوان) و مایکت، دو محصول زیر را دقیقاً با همین SKU تعریف کنید:

| SKU | نوع در مارکت | قیمت | کاربرد |
|---|---|---|---|
| `navanegar_pro_lifetime` | خرید غیرمصرفی (In-App) | ۲۴۹٬۰۰۰ تومان | دسترسی دائمی نسخه حرفه‌ای |
| `navanegar_pro_quarterly` | اشتراک سه‌ماهه (۹۰ روزه) | ۹۹٬۰۰۰ تومان | اشتراک فصلی با انقضای خودکار ۹۰ روزه |

---

## ۸. اسرار موردنیاز در GitHub Actions

برای اجرای خودکار جاب `android-release-builds` در `.github/workflows/ci-android.yml`، این ۶ Secret را در تنظیمات مخزن ثبت کنید:
1. `NAVANEGAR_KEYSTORE_BASE64` (محتوای Base64 فایل `navanegar-release.jks`)
2. `NAVANEGAR_KEYSTORE_STORE_PASSWORD`
3. `NAVANEGAR_KEYSTORE_KEY_PASSWORD`
4. `NAVANEGAR_GOOGLE_SERVICES_JSON` (محتوای Base64 فایل `google-services.json`)
5. `NAVANEGAR_BAZAAR_RSA_KEY`
6. `NAVANEGAR_MYKET_RSA_KEY`
