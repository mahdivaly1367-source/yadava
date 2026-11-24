# نوانگار (Navanegar) — استودیوی جامع آموزش ردیف و موسیقی اصیل ایرانی

**Navanegar (`ir.navanegar.radif`, v1.0.0)** is an offline-first, 100% deterministic Web, PWA, and Dual-Market Android (CafeBazaar & Myket) conservatory studio for authentic Iranian classical music (Radif).

---

## ویژگی‌های کلیدی / Key Features

- **پوشش کامل ۱۲ نظام و ۱۷۳ گوشه ردیف اصیل ایرانی**:
  - **۷ دستگاه**: شور (۱۸)، ماهور (۱۶)، همایون (۱۹)، سه‌گاه (۱۴)، چهارگاه (۱۷)، نوا (۱۶)، راست‌پنجگاه (۲۱).
  - **۵ آواز**: ابوعطا (۹)، بیات ترک/زند (۱۱)، افشاری (۱۰)، دشتی (۱۱)، بیات اصفهان (۱۱).
  - پشتیبانی دقیق ربع‌پرده **کُرُن (`-50¢` استاندارد و `-56¢` سنتی)** و **سُری (`+50¢`)**، نت شاهد، ایست، آغاز، متغیر و زینت‌ها (اشاره، تکیه، دراب، ریز، تحریر).
- **موتور سنتز فیزیکی Karplus-Strong** برای ۴ ساز مرجع: **تار، سه‌تار، سنتور، نی**.
- **پردازش صوتی تماماً قطعی و آفلاین (Zero LLM / No Gemini API)**:
  - الگوریتم **YIN** + فیلتر تداوم اکتاو + تشخیص خودکار **تحریر (~۶ هرتز)** + ارزیابی **فرود** + عقربه سنت دقیق (`±50¢`).
  - خط حامل ایرانی با علائم عارضی اختصاصی کُرُن و سُری، حلقه هوشمند A–B، کنترل سرعت بدون تغییر کوک، **تکرار با استاد (`R`)** و **حالت تمرین تمام‌صفحه (`F`)**.
  - ویژوالایزر زنده **FFT لگاریتمی**، استخراج هارمونیک‌ها، **فیلتر باترورث مرتبه ۴** (۲۴ dB/oct) و کالیبراسیون زیرسنت دیاپازون لا (`A4`).
  - **تیونر هوشمند ساز**، **مترونوم دقیق Web Audio** (`۲/۴`، `۳/۴`، `۴/۴`، `۵/۸`، `۶/۸`، `۷/۸` + ریزتقسیم `۱×/۲×/۳×` + لمس ضرب)، **ضبط `MediaRecorder`** و تحلیل پس از اجرا.
  - **پل بصری تئوری ↔ اجرای فیزیکی**: دسته لگاریتمی ۲۴ پرده‌ای تار/سه‌تار (HTML5 Canvas) و ۲۷ خرک سنتور.
- **۵ بخش یکپارچه**:
  1. برنامه روزانه (`DashboardView`): آزمون تعیین سطح شنیداری و میکروفون، برنامه ۱۵ دقیقه‌ای ۴ گامه تطبیقی، الگوریتم **SM-2** و پیشنهاد هوشمند جلسه بعدی.
  2. کارگاه تمرین (`PracticeStudioView`)
  3. مرورگر ردیف (`RadifExplorerView`)
  4. نقشه مدولاسیون (`ModulationMapView`)
  5. انجمن و اتاق زنده (`CommunityView`) با مدیریت خطای شبکه (`unavailable`) بدون کرش.
- **معماری امنیتی و جداسازی کامل نشست**:
  - جداسازی اتمیک کاربران و مهمان با `ownerUid`، پاکسازی فوری `ObjectURL` و لغو عملیات همگام‌سازی معوق در خروج/تغییر حساب (`A → B`).
  - پیشوندگذاری کلیدهای IndexedDB به صورت `${ownerUid}::${id}`.
  - قواعد امنیتی سخت‌گیرانه `firestore.rules` هم‌خوان با `firebase-blueprint.json`، دیتابیس نام‌گذاری‌شده `navanegar-db` با `experimentalForceLongPolling: true`، `writeBatch` اتمیک و ضدجعل `replyCount` با `lastReplyId` (`!exists && existsAfter && getAfter`).
- **فریمیوم و پرداخت دو مارکت اندروید (کافه‌بازار و مایکت)**:
  - **رایگان همیشگی**: شور + ابوعطا + ماهور (**۴۳ گوشه**)، تیونر، مترونوم، تعیین سطح و ذخیره تا ۲ قطعه.
  - **نسخه حرفه‌ای (Pro)**: `navanegar_pro_lifetime` (۲۴۹٬۰۰۰ تومان) و `navanegar_pro_quarterly` (اشتراک ۹۰ روزه ۹۹٬۰۰۰ تومان).
  - Flavor مجزای `bazaar` (`Poolakey 2.2.0` با اجبار امضای RSA در Release) و `myket` (`ir.myket:billing:2.2` با بررسی `subscriptionsSupported()`).
  - دسترسی میکروفون (`RECORD_AUDIO`) فقط به‌صورت **Just-In-Time** هنگام استفاده واقعی (بدون درخواست پیش‌دستانه در `MainActivity.onCreate`).

---

## دستورات توسعه و آزمون / Development & Verification Commands

```bash
# Install dependencies
npm install

# Start live development server (RTL Persian UI)
npm run dev

# TypeScript check
npm run typecheck

# ESLint (including firestore.rules AST security linting & blueprint validation)
npm run lint
npm run lint:rules

# Unit & Integration Tests (Radif 173/43, DSP, Karplus-Strong, SM-2, Session Isolation, Billing Anti-Tamper, Android Audit)
npm test

# Isolated Firestore Security Rules Emulator Tests (requires Java + Firebase CLI)
npm run test:rules

# Production Web + PWA Build (outputs to dist/)
npm run build

# Sync Web Assets & Native Plugins to Capacitor Android
npx cap sync android
```

---

## مستندات بیشتر / Additional Documentation

- [راهنمای کامل ساخت، امضا و انتشار APK/AAB (کافه‌بازار و مایکت)](docs/ANDROID_RELEASE_GUIDE.md)
- [متن آماده معرفی فروشگاهی کافه‌بازار و مایکت](docs/STORE_LISTING_FA.md)
- [نقشه دیتابیس Firebase (`firebase-blueprint.json`)](firebase-blueprint.json)
- [قواعد امنیتی Firestore (`firestore.rules`)](firestore.rules)
- [گردش‌کار CI/CD گیت‌هاب (`.github/workflows/ci-android.yml`)](.github/workflows/ci-android.yml)
