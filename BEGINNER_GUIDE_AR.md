# 🎓 دليل المبتدئ لقراءة المشروع — Top Academy (Smart Swimmer Nutrition)

> هذا الملف هو **خريطة تعلمك** للمشروع كاملًا.
> اقرأه أولًا، ثم افتح الملفات بالترتيب المذكور في آخر الملف.
> **كل ملف برمجي في المشروع (173 ملفًا في `src/`) يحمل الآن ترويسة "شرح الملف للمبتدئ"** تشرح: وظيفته، لماذا، متى يعمل، من يستدعيه، والملفات التي يتعامل معها، مع تعليقات تعليمية داخل الأجزاء المهمة.

---

## 1. ما هو المشروع؟

مشروع **Top Academy – Smart Swimmer Nutrition** هو موقع ويب متكامل لإدارة التغذية الرياضية للسباحين:

- يسجّل السباح/ولي الأمر/المدرب حسابًا في الموقع.
- يدخل بيانات السباح (الطول، الوزن، العمر، التدريب، الهدف…).
- يحسب الموقع الاحتياجات الغذائية (سعرات، بروتين، كربوهيدرات، ماء…) بمعادلات علمية.
- ينشئ خطة غذائية مخصصة بالوجبات والبدائل.
- يصوّر المستخدم وجبته بالكاميرا ويحلّلها الذكاء الاصطناعي.
- يسجّل اليومي: طعام، ماء، تمرين، نوم، وزن.
- يربط الساعات الذكية (Fitbit, Garmin/Strava, Oura, Polar).
- يصدر تقارير PDF عربية، ويبعت إشعارات، ويبعت للجوال.

**ببساطة:** موقع فيه حساب مستخدم + بيانات + حسابات + ذكاء اصطناعي + قاعدة بيانات + تطبيق موبايل.

---

## 2. التقنيات المستخدمة (ولماذا)

| التقنية | ما هي؟ | أين تظهر في المشروع؟ |
|---|---|---|
| **TypeScript** | لغة برمجة = JavaScript مع "أنواع" (Types). تخبر الكمبيوتر بنوع كل قيمة (نص، رقم، قائمة…). | كل الملفات داخل `src/` تنتهي بـ `.ts` أو `.tsx`. |
| **Next.js 15** | Framework (إطار عمل) للموقع. يبني صفحات الويب ويشغّل الخادم (Server) ونقاط API. | كل مجلد داخل `src/app/` يعتبر صفحة أو واجهة API. |
| **React 19** | مكتبة لبناء واجهات المستخدم (المكونات: أزرار، حقول، بطاقات). | الملفات داخل `src/components/`. |
| **Tailwind CSS** | مكتبة للتنسيق. تكتب فيها أوامر CSS جاهزة داخل الـ className. | مثل `className="bg-ocean-600 text-white"`. |
| **Prisma** | أداة تتعامل مع قاعدة البيانات. تكتب نموذج (Model) وتقرأ/تكتب به. | `prisma/schema.prisma` + `src/lib/prisma.ts`. |
| **NextAuth** | مكتبة تسجيل الدخول (بريد + كلمة مرور + جلسة + JWT). | `src/lib/auth.ts` + صفحة `login`. |
| **Zod** | مكتبة تتحقق من البيانات المدخلة قبل حفظها. | `src/lib/validation.ts`. |
| **bcryptjs** | مكتبة تشفير كلمات المرور (هاش). | `src/app/api/auth/register/route.ts`. |
| **lucide-react** | مكتبة أيقونات. | أيقونات مثل `Flame`, `Camera`. |
| **pdfmake** | مكتبة توليد ملفات PDF. | `src/services/pdf/`. |
| **recharts** | مكتبة الرسوم البيانية. | صفحات التقارير والإحصائيات. |
| **web-push** | إشعارات الدفع (PWA). | `src/lib/push.ts`. |
| **Vitest** | مكتبة اختبار الكود. | ملفات تنتهي بـ `.test.ts`. |
| **Flutter (فرعي)** | لغة بناء تطبيق الموبايل (الجسر للصحة Apple/Google). | مجلد `mobile/` — مشروع مستقل. |

---

## 3. هيكل الملفات (ماذا يوجد في كل مكان؟)

```
نظام غذائى/
├── BEGINNER_GUIDE_AR.md        ← أنت هنا (خريطة التعلم)
├── AGENTS.md                   ← قواعد العمل (مهم جدًا للمطورين)
├── README.md                   ← وصف المشروع + روابط التشغيل
├── package.json                ← وصفة المشروع: الأوامر والمكتبات
├── next.config.mjs             ← إعدادات Next.js (الأمان، الصور)
├── tailwind.config.ts          ← إعدادات التنسيق (الألوان، الخطوط)
├── postcss.config.mjs          ← إعداد يعالج CSS
├── tsconfig.json               ← إعدادات TypeScript (JSON — لا يحتاج شرح)
├── vitest.config.ts            ← إعدادات الاختبارات (مشروح)
├── .vercelignore               ← ما يستبعده النشر (mobile/android-sdk)
├── prisma/
│   ├── schema.prisma           ← شكل قاعدة البيانات (المخطط النشط)
│   ├── schema.sqlite.prisma    ← مخطط SQLite (محلي) — مشروح
│   ├── schema.postgres.prisma  ← مخطط PostgreSQL (إنتاج) — مشروح
│   ├── seed.ts                 ← بيانات البداية (مدير تجريبي، أطعمة…) — مشروح
│   ├── food-data.ts            ← قاعدة الأطعمة وقيمها الغذائية — مشروح
│   ├── supplement-data.ts      ← بيانات المكملات — مشروح
│   └── supplement-science-data.ts ← حدود المكونات والمراجع — مشروح
├── scripts/
│   ├── use-db.js               ← مبدّل قاعدة البيانات sqlite/postgres — مشروح
│   └── sync-foods.ts           ← مزامنة الأطعمة للإنتاج — مشروح
├── public/                     ← ملفات ثابتة (أيقونات، صور، PWA)
├── mobile/                     ← جسر تطبيق الموبايل (Flutter — مشروع فرعي مستقل)
└── src/
    ├── app/                    ← الصفحات + واجهات API (قلب المشروع)
    │   ├── layout.tsx          ← الهيكل الأساسي لكل صفحة — مشروح
    │   ├── page.tsx            ← الصفحة الرئيسية (الترحيب) — مشروح
    │   ├── login/page.tsx      ← صفحة تسجيل الدخول — مشروح
    │   ├── register/page.tsx   ← صفحة إنشاء حساب — مشروح
    │   ├── dashboard/page.tsx  ← لوحة المستخدم بعد الدخول — مشروح
    │   ├── calculator/page.tsx ← صفحة حاسبة الاحتياجات
    │   ├── plan/…              ← صفحات إنشاء وعرض الخطط (create، [id])
    │   ├── supplements/…       ← صفحة وحاسبة المكملات
    │   ├── wearables/page.tsx  ← صفحة ربط الساعات الذكية
    │   ├── api/                ← واجهات API (الخادم) — كلها مشروحة
    │   │   ├── auth/           ← تسجيل + دخول + استعادة كلمة المرور
    │   │   ├── calculator/     ← حساب الاحتياجات الغذائية
    │   │   ├── plan/           ← إنشاء الخطط + استبدال الوجبات + PDF
    │   │   ├── supplements/    ← تقييمات + منتجات + جرعات + معامل
    │   │   ├── wearables/      ← ربط ومزامنة الساعات (OAuth)
    │   │   ├── admin/          ← نظرة المشرف + التقارير
    │   │   └── …               ← ~60 واجهة أخرى (كلها مشروحة)
    │   └── not-found.tsx       ← صفحة الخطأ 404 — مشروحة
    ├── components/             ← مكونات واجهة المستخدم — كلها مشروحة
    │   ├── layout/             ← navbar، app-shell، footer، logo…
    │   ├── ui/                 ← أزرار وحقول مشتركة
    │   ├── analyzer/           ← محلل الوجبات بالكاميرا
    │   ├── wearables/          ← صفحة وربط الساعات
    │   ├── supplements/        ← دليل وحاسبة المكملات
    │   └── …                   ← مكونات حسب الميزة
    ├── lib/                    ← أدوات أساسية — كلها مشروحة
    │   ├── prisma.ts           ← الاتصال بقاعدة البيانات
    │   ├── auth.ts             ← الجلسات وتسجيل الدخول
    │   ├── security.ts         ← rateLimit + audit + تنقية النصوص
    │   ├── constants.ts        ← القوائم والثوابت
    │   ├── push.ts             ← إشعارات الدفع
    │   ├── wearables/          ← جسور الساعات الأربع + الترجمة
    │   └── nutrition/          ← الحساب الديناميكي
    ├── services/               ← منطق الأعمال — كلها مشروحة
    │   ├── nutrition/          ← المعادلات العلمية (Mifflin…)
    │   ├── plan/ و plan-generator/ ← إنشاء الخطط الغذائية
    │   ├── ai/                 ← الذكاء الاصطناعي (OpenAI/Gemini/Groq/Mock)
    │   ├── supplements/        ← تقييمات المكملات
    │   └── pdf/                ← توليد PDF عربي
    └── types/                  ← أنواع TypeScript المشتركة — مشروحة
```

---

## 4. من أين يبدأ البرنامج؟

مشروع Next.js لا يبدأ من `main.js` مثل React العادي؛ يبدأ من **مسارات الملفات** في `src/app`:

```
المستخدم يكتب العنوان في المتصفح
        ↓
Next.js يبحث في src/app عن مسار مطابق
        ↓
layout.tsx (الإطار العام) يعمل أولًا
        ↓
الصفحة نفسها (مثل page.tsx أو login/page.tsx) تعمل
        ↓
المكونات التي تستوردها الصفحة تعمل
        ↓
إن احتاجت بيانات → واجهات API في src/app/api
        ↓
قاعدة البيانات عبر Prisma
```

---

## 5. ترتيب تشغيل البرنامج (الرحلة الكاملة)

### رحلة الزائر غير المسجل (الصفحة الرئيسية)
```
1. src/app/layout.tsx          ← يهيئ الصفحة (لغة عربية، خطوط، خلفيات)
2. src/components/providers.tsx ← يفعّل جلسة NextAuth (فحص هل أنت مسجل)
3. src/app/page.tsx            ← الصفحة الرئيسية
4. src/components/layout/navbar.tsx ← شريط التنقل العلوي
5. src/components/layout/footer.tsx ← تذييل الصفحة
```

### رحلة المستخدم المسجل (لوحة التحكم)
```
1. layout.tsx + providers.tsx
2. src/app/dashboard/page.tsx  ← لوحة التحكم
3. src/lib/auth.ts (getCurrentUser) ← من هو المستخدم؟ (من الجلسة/الكوكي)
4. src/lib/prisma.ts           ← الاتصال بقاعدة البيانات
5. prisma/schema.prisma        ← شكل البيانات المطلوبة
6. src/components/layout/app-shell.tsx ← القائمة الجانبية
```

### رحلة تسجيل الدخول (مثال API)
```
1. صفحة login/page.tsx (مكون Client)
2. المستخدم يضغط "تسجيل الدخول"
3. signIn() من مكتبة next-auth/react
4. → src/app/api/auth/[...nextauth]/route.ts (خادم NextAuth)
5. → src/lib/auth.ts (authorize يفحص البريد وكلمة المرور)
6. → src/lib/prisma.ts (يبحث عن المستخدم في قاعدة البيانات)
7. → bcrypt يتحقق من كلمة المرور المشفرة
8. → نجاح → يعمل JWT callback → يعود للمتصفح
9. → ينتقل المستخدم إلى /dashboard
```

### رحلة حساب الاحتياجات (مثال API كامل)
```
1. المستخدم يضغط "احسب" في حاسبة الاحتياجات
2. → src/app/api/calculator/route.ts (POST)
3. getCurrentUser() ← هل هو مسجل؟
4. rateLimit() ← هل أرسل طلبات كثيرة؟
5. prisma.swimmerProfile ← جلب ملف السباح
6. summarizeNutrition() من src/services/nutrition
7. المعادلات العلمية في src/services/nutrition/calculations.ts
8. حفظ النتيجة في جدول NutritionTargets
9. audit() ← تسجيل العملية في AuditLog
10. الرد JSON يعود للصفحة لعرضها
```

### رحلة الساعات الذكية (OAuth)
```
1. المستخدم يضغط "ربط" في صفحة الساعات
2. → src/app/api/wearables/connect/route.ts ← يجلب رابط التفويض من الخدمة
3. المستخدم يوافق في موقع الساعة (Fitbit/Strava/Oura/Polar)
4. الخدمة تعيده إلى src/app/api/wearables/callback/route.ts
5. نحفظ accessToken/refreshToken (مشفّرة) في قاعدة البيانات
6. مزامنة تلقائية → src/lib/wearables/sync.ts → تُترجم البيانات إلى صيغة موحدة
```

---

## 6. مسار البيانات (من المستخدم حتى قاعدة البيانات والعكس)

```
مدخل المستخدم (نموذج/زر)
        ↓
صفحة أو مكوّن Client (src/app أو src/components)
        ↓
إما fetch / أو signIn / أو رفعت ملفًا
        ↓
واجهة API في src/app/api/…/route.ts
        ↓
التحقق: getCurrentUser + rateLimit + zod (src/lib)
        ↓
منطق العمل: services/ (حسابات، ذكاء اصطناعي، خطط)
        ↓
قاعدة البيانات عبر prisma (src/lib/prisma.ts)
        ↓
النتيجة ترجع بالعكس إلى المتصفح → تظهر للمستخدم
```

---

## 7. أهم Functions في المشروع

| الدالة | مكانها | وظيفتها | من يستدعيها |
|---|---|---|---|
| `getCurrentUser()` | `src/lib/auth.ts` | يجلب المستخدم الحالي من الجلسة | كل الصفحات المحمية |
| `getApiUser(req)` | `src/lib/api-user.ts` | يحدد المستخدم في API (ويب أو موبايل) | واجهات API |
| `requireRole(...roles)` | `src/lib/auth.ts` | يمنع غير المخولين (مثل admin) | واجهات الإدارة |
| `rateLimit(key)` | `src/lib/security.ts` | يحد من عدد الطلبات (يمنع الاختراق) | واجهات API |
| `audit()` | `src/lib/security.ts` | يسجل عمليات مهمة في AuditLog | واجهات API |
| `sanitizeText()` | `src/lib/security.ts` | ينظف النص من HTML الخبيث | التسجيل |
| `signMobileToken()` | `src/lib/mobile-token.ts` | يصنع JWT لتطبيق الموبايل | واجهة دخول الموبايل |
| `summarizeNutrition()` | `src/services/nutrition/index.ts` | يحسب كل الاحتياجات الغذائية | `api/calculator` |
| `buildMedicalAlerts()` | `src/services/nutrition/index.ts` | يصنع تنبيهات طبية (غير علاجية) | `summarizeNutrition` |
| `createPlanFromTargets()` | `src/services/plan/service.ts` | يبني الخطة الغذائية الأسبوعية | `api/plan` |
| `generateSupplementAssessment()` | `src/services/supplements/assessment.ts` | يقيم مكملات المستخدم | `api/supplements/calculate` |
| `getVisionProvider()` | `src/services/ai/index.ts` | يختار مزود الذكاء الاصطناعي | `api/analyze-meal` |
| `sendPushToUser()` | `src/lib/push.ts` | يرسل إشعار دفع PWA | `notifyUser` |
| `syncWearable()` | `src/lib/wearables/sync.ts` | يزامن الساعة مع الخادم | واجهات wearables |
| `cn()` | `src/lib/utils.ts` | يجمع فئات Tailwind | كل المكونات تقريبًا |
| `formatNumber()` | `src/lib/utils.ts` | تنسيق الأرقام بالعربي | كل الصفحات |
| `calculateAge()` | `src/lib/utils.ts` | حساب العمر من تاريخ الميلاد | صفحة الملف |

---

## 8. أهم المتغيرات والثوابت

| الثابت | مكانه | ماذا يحتوي؟ |
|---|---|---|
| `BRAND` | `src/lib/constants.ts` | اسم الأكاديمية والدكتور والشعار |
| `ROLES` | `src/lib/constants.ts` | الأدوار: سباح، ولي أمر، مدرب… |
| `GOALS` | `src/lib/constants.ts` | أهداف المستخدم (خفض دهون، بناء عضل…) |
| `MEAL_TYPES` | `src/lib/constants.ts` | أسماء الوجبات (فطور، غداء…) |
| `MEAL_TYPE_ORDER` | `src/lib/constants.ts` | ترتيب الوجبات في اليوم |
| `MEDICAL_DISCLAIMER` | `src/lib/constants.ts` | نص إخلاء المسؤولية الطبية |
| `CATEGORIES` / `FOODS` | `prisma/food-data.ts` | تصنيفات وأطعمة (~76 صنفًا) |
| `SUPPLEMENTS` | `prisma/supplement-data.ts` | بيانات المكملات للدليل |
| `NAV` | `app-shell.tsx` | روابط القائمة الجانبية |

---

## 9. أهم واجهات API (في `src/app/api`)

| المسار | النوع | ماذا يفعل؟ |
|---|---|---|
| `/api/auth/[...nextauth]` | POST | تسجيل الدخول (NextAuth) |
| `/api/auth/register` | POST | إنشاء حساب جديد |
| `/api/calculator` | POST | حساب الاحتياجات الغذائية وحفظها |
| `/api/analyze-meal` | POST | تحليل وجبة بالكاميرا (AI) |
| `/api/plan` | POST | إنشاء خطة غذائية |
| `/api/plan/[id]/pdf` | GET | تصدير الخطة PDF |
| `/api/plan/[id]/meal/[mealId]` | POST | استبدال وجبة ببديلها |
| `/api/nutrition/today` | GET | بيانات اليوم للوحة التحكم |
| `/api/profile` | PUT | تحديث بيانات السباح |
| `/api/supplements/calculate` | POST | حاسبة المكملات |
| `/api/supplements/assessments` | POST/GET | إنشاء/عرض تقييم المكملات |
| `/api/wearables/connect` | POST | بدء ربط الساعة الذكية (OAuth) |
| `/api/wearables/callback` | GET | عودة من موقع الساعة بعد الموافقة |
| `/api/wearables/sync` | POST | مزامنة يدوية للساعة |
| `/api/mobile/login` | POST | دخول تطبيق الموبايل (JWT مخصص) |

---

## 10. أهم الملفات — مرتبة من الأسهل إلى الأصعب

1. `src/lib/constants.ts` — مجرد قوائم ونصوص (أسهل).
2. `src/lib/utils.ts` — دوال صغيرة بسيطة.
3. `next.config.mjs` — إعدادات فقط.
4. `vitest.config.ts` — إعدادات الاختبارات (14 سطرًا).
5. `src/lib/prisma.ts` — كيف نتصل بقاعدة البيانات.
6. `src/components/providers.tsx` — مكون من 7 أسطر.
7. `src/components/ui/button.tsx` — أول مكوّن UI بسيط.
8. `src/app/layout.tsx` — هيكل الصفحة.
9. `src/app/login/page.tsx` — نموذج تسجيل دخول حقيقي.
10. `src/lib/auth.ts` — منطق تسجيل الدخول.
11. `src/app/api/auth/register/route.ts` — أول API كامل.
12. `src/app/page.tsx` — الصفحة الرئيسية.
13. `src/components/layout/app-shell.tsx` — القائمة الجانبية.
14. `src/app/dashboard/page.tsx` — لوحة التحكم (تقرأ من قاعدة البيانات).
15. `src/app/api/calculator/route.ts` — API + حسابات + قاعدة بيانات.
16. `src/services/nutrition/index.ts` — المعادلات العلمية.
17. `prisma/schema.prisma` — شكل قاعدة البيانات.
18. `prisma/seed.ts` — كيف تُملأ قاعدة البيانات.
19. `src/app/api/plan/route.ts` — أنشأ الخطة (أطول قصة).
20. `src/components/analyzer/meal-analyzer.tsx` — مكون معقد (كاميرا + AI).
21. `src/services/supplements/assessment.ts` — تقييم المكملات.
22. `src/lib/wearables/sync.ts` — مزامنة الساعات (مفهوم Adapter).

---

## 11. ترتيب دراسة المشروع للمبتدئ (خطة أسبوعية تقريبًا)

### المرحلة 1 — فهم أساسيات المشروع (ساعة)
- اقرأ هذا الملف (BEGINNER_GUIDE_AR.md).
- اقرأ `src/lib/constants.ts` و`src/lib/utils.ts` و`vitest.config.ts`.

### المرحلة 2 — كيف ينطلق الموقع؟ (ساعة)
- `next.config.mjs` → `src/app/layout.tsx` → `src/app/page.tsx` → `src/components/providers.tsx`.

### المرحلة 3 — قاعدة البيانات والاتصال (ساعة)
- `src/lib/prisma.ts` → `prisma/schema.prisma` (نماذج User وSwimmerProfile وNutritionTargets) → `prisma/seed.ts`.

### المرحلة 4 — تسجيل الدخول والحسابات (ساعتان)
- `src/lib/auth.ts` → `src/app/login/page.tsx` → `src/app/register/page.tsx` → `src/app/api/auth/register/route.ts` → `src/app/api/auth/[...nextauth]/route.ts`.

### المرحلة 5 — أول API وحسابات علمية (ساعتان)
- `src/app/api/calculator/route.ts` → `src/services/nutrition/index.ts` → `src/services/nutrition/calculations.ts`.

### المرحلة 6 — لوحة التحكم (ساعتان)
- `src/components/layout/app-shell.tsx` → `src/app/dashboard/page.tsx` → `src/app/api/nutrition/today/route.ts`.

### المرحلة 7 — الخطط الغذائية (ساعتان)
- `src/app/api/plan/route.ts` → `src/services/plan/service.ts` → `src/services/plan-generator/plan-generator.ts` → `src/app/plan/[id]/page.tsx`.

### المرحلة 8 — الذكاء الاصطناعي والكاميرا (ساعتان)
- `src/services/ai/index.ts` → `src/app/api/analyze-meal/route.ts` → `src/app/meal-analyzer/page.tsx` → `src/components/analyzer/meal-analyzer.tsx`.

### المرحلة 9 — المكملات (ساعتان)
- `src/services/supplements/index.ts` → `src/services/supplements/assessment.ts` → `src/app/api/supplements/calculate/route.ts` → `src/app/supplements/page.tsx`.

### المرحلة 10 — الساعات الذكية (ساعتان)
- `src/lib/wearables/types.ts` → `src/lib/wearables/normalize.ts` → `src/lib/wearables/sync.ts` → `src/app/api/wearables/connect/route.ts` → `src/app/api/wearables/callback/route.ts`.

### المرحلة 11 — التقارير والـ PDF (ساعتان)
- `src/app/api/reports/route.ts` → `src/services/pdf/plan-pdf.ts` → `src/app/reports/page.tsx`.

### المرحلة 12 — الإدارة والتواصل (ساعتان)
- `src/app/admin/dashboard/page.tsx` → `src/components/admin/admin-dashboard.tsx` → `src/app/messages/page.tsx`.

---

## 12. قواعد مهمة جدًا قبل أي تعديل

1. **لا تغيّر سلوك الموقع** — هدف التعلّم وليس إعادة البناء.
2. **لا تحذف كودًا** يبدو غير مستخدم إلا بعد التأكد الكامل.
3. افحص التعديل دائمًا:
   ```
   node .\node_modules\typescript\bin\tsc --noEmit
   node .\node_modules\vitest\vitest.mjs run
   node .\node_modules\next\dist\bin\next build
   ```
4. بعد أي تعديل يُنشر على الإنتاج (حسب قواعد المشروع في `AGENTS.md`).

---

## 13. أهم 10 مفاهيم ستتعلمها من هذا المشروع

1. **Server Component vs Client Component** — صفحات تعمل في الخادم (`page.tsx` بدون `'use client'`) ومكونات تعمل في المتصفح (`'use client'` + useState).
2. **Routing (التوجيه بالملفات)** — مجلد = مسار، و`page.tsx` = الصفحة، و`route.ts` = واجهة API، و`[id]` = معامل ديناميكي.
3. **API و HTTP** — POST/GET/PUT/DELETE ومعنى 200/401/422/429.
4. **قاعدة البيانات عبر Prisma** — النماذج، `findFirst`/`create`/`upsert`/`deleteMany`.
5. **المصادقة (Authentication)** — NextAuth، الجلسة، JWT، تشفير كلمات المرور بـ bcrypt.
6. **الحماية** — `rateLimit` (منع الطلبات الكثيرة)، `requireRole` (الصلاحيات)، تنقية المدخلات بـ zod.
7. **async/await** — انتظار طلبات الخادم قبل متابعة التنفيذ.
8. **المكونات (Components) و Props** — تمرير البيانات بين الأجزاء.
9. **الوظائف النقية (Pure Functions)** — دوال تُرجع نتيجة من مدخلاتها (معادلات التغذية).
10. **التكامل مع خدمات خارجية** — OAuth للساعات، مزودو الذكاء الاصطناعي، إشعارات الدفع.

---

## 14. أول جزء يجب أن تحاول كتابته بنفسك

ابدأ بـ **واجهة API بسيطة** بعد قراءة `src/app/api/auth/register/route.ts`:

```typescript
// مهمتك: اكتب واجهة في src/app/api/hello/route.ts
// تُرجع { message: "أهلاً بك" } عند طلب GET.
// ثم افتح في المتصفح: /api/hello
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ message: 'أهلاً بك' });
}
```

بعد نجاحها، أضف شرطًا: لو طلب `?name=علي` رجّع اسمه، وإلا رسالة عامة. ستتعلم بذلك: واجهة API + قراءة Query + JSON.

---

## 15. تمارين عملية (من هذا المشروع فقط)

**مستوى مبتدئ:**
- غيّر نصًا ترحيبيًا في `src/app/page.tsx`.
- أضف ثابتًا جديدًا إلى `src/lib/constants.ts` (مثلًا لون فريقك) ثم اطبعه في صفحة.
- أضف رابطًا جديدًا لمصفوفة `NAV` في `src/components/layout/app-shell.tsx`.

**مستوى متوسط:**
- اقرأ `src/app/api/calculator/route.ts` ثم اكتب واجهة `GET /api/time` ترجع الساعة الحالية.
- أضف حقل "مدينة" إلى `prisma/schema.sqlite.prisma` في نموذج SwimmerProfile، ثم اقرأ/اكتبه في `api/profile`.
- أضف صنفين جديدين إلى `prisma/food-data.ts` ثم شغّل `npm run db:seed` محليًا.

**مستوى متقدم:**
- أضف صفحة جديدة `src/app/my-page/page.tsx` ورابطًا لها في القائمة.
- أضف حالة اختبار جديدة في `src/services/supplements/supplements.test.ts` لمعادلة حساب البروتين.
- حاول فهم `src/lib/wearables/sync.ts` ثم اكتب محوّلًا (Adapter) لساعة افتراضية ترجع خطوة واحدة (خُطوة إضافية).

**التحدي الأكبر:**
- أضف ميزة "تذكير يومي" تعرض رسالة في لوحة التحكم، بمسار: ثابت في constants → مكوّن يعرضها → واجهة API تحفظها → جدول في schema.

> بعد إتقانك لهذا المشروع، ستكون قادرًا على بناء موقع مشابه (نظام تسجيل + بيانات + حساب + واجهة + قاعدة بيانات) من الصفر.

---

## 16. ملاحظات على ملفات لم تحتج شرحًا مفصّلًا

- **`tsconfig.json`** — ملف JSON لا يقبل التعليقات (تعريف الأنواع والإعدادات فقط).
- **`*.test.ts`** — ملفات الاختبار تحمل ترويسة مختصرة وعناوين أقسام (قاعدة: لا نشرح كل سطر فيها).
- **`*/types.ts`** — ملفات الأنواع تحمل ترويسة وشرحًا خفيفًا لكل نوع.
- **`prisma/dev.db`** — ملف قاعدة البيانات المحلية (ملف مولّد، ليس كودًا).
- **`public/`** — صور وأيقونات ثابتة (ليست كودًا).
- **`mobile/`** — مشروع Flutter فرعي مستقل (جسر الصحة)، له دليل داخل المجلد.

---

## 17. ترتيب القراءة النهائي (ابدأ هنا)

```
ابدأ بـ: BEGINNER_GUIDE_AR.md (هذا الملف)
    ↓
src/lib/constants.ts  →  src/lib/utils.ts
    ↓
next.config.mjs  →  src/app/layout.tsx  →  src/app/page.tsx
    ↓
src/lib/prisma.ts  →  prisma/schema.prisma  →  prisma/seed.ts
    ↓
src/lib/auth.ts  →  src/app/login/page.tsx  →  src/app/register/page.tsx
    ↓
src/app/api/auth/register/route.ts  →  src/app/api/auth/[...nextauth]/route.ts
    ↓
src/app/api/calculator/route.ts  →  src/services/nutrition/index.ts
    ↓
src/components/layout/app-shell.tsx  →  src/app/dashboard/page.tsx
    ↓
src/app/api/plan/route.ts  →  src/services/plan/service.ts
    ↓
src/services/ai/index.ts  →  src/app/meal-analyzer/page.tsx
    ↓
src/services/supplements/index.ts  →  src/app/api/supplements/calculate/route.ts
    ↓
src/lib/wearables/sync.ts  →  src/app/api/wearables/callback/route.ts
    ↓
src/services/pdf/plan-pdf.ts  →  src/app/api/reports/route.ts
    ↓
src/app/admin/dashboard/page.tsx  →  src/app/messages/page.tsx
```

> كل ملف من هذه الملفات يحمل ترويسة تعليمية في أعلاه تشرح دوره وعلاقاته، فافتح أي ملف في أي وقت وستجد شرحه داخل نفسه.
