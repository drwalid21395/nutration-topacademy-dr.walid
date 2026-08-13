# 🎓 دليل المبتدئ لقراءة المشروع — Top Academy (Smart Swimmer Nutrition)

> هذا الملف هو **خريطة تعلمك** للمشروع كاملًا.
> اقرأه أولًا، ثم افتح الملفات بالترتيب المذكور في النهاية.
> كل ملف مهم في المشروع يحتوي الآن على **تعليقات تعليمية** في أعلاه وداخله تشرح كل جزء.

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

**ببساطة:** موقع فيه حساب مستخدم + بيانات + حسابات + ذكاء اصطناعي + قاعدة بيانات.

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

---

## 3. هيكل الملفات (ماذا يوجد في كل مكان؟)

```
نظام غذائى/
├── BEGINNER_GUIDE_AR.md        ← أنت هنا (خريطة التعلم)
├── package.json                ← وصفة المشروع: الأوامر والمكتبات
├── next.config.mjs             ← إعدادات Next.js (الأمان، الصور)
├── tailwind.config.ts          ← إعدادات التنسيق (الألوان، الخطوط)
├── postcss.config.mjs          ← إعداد يعالج CSS
├── tsconfig.json               ← إعدادات TypeScript
├── vitest.config.ts            ← إعدادات الاختبارات
├── prisma/
│   ├── schema.prisma           ← شكل قاعدة البيانات (الجداول والعلاقات)
│   ├── seed.ts                 ← بيانات البداية (مدير تجريبي، أطعمة)
│   └── food-data.ts            ← قاعدة الأطعمة وقيمها الغذائية
├── scripts/                    ← سكربتات مساعدة (التبديل بين قواعد البيانات)
├── public/                     ← ملفات ثابتة (أيقونات، صور، PWA)
├── mobile/                     ← جسر تطبيق الموبايل (Flutter)
└── src/
    ├── app/                    ← الصفحات + واجهات API (قلب المشروع)
    │   ├── layout.tsx          ← الهيكل الأساسي لكل صفحة
    │   ├── page.tsx            ← الصفحة الرئيسية (الترحيب)
    │   ├── login/page.tsx      ← صفحة تسجيل الدخول
    │   ├── register/page.tsx   ← صفحة إنشاء حساب
    │   ├── dashboard/page.tsx  ← لوحة المستخدم بعد الدخول
    │   ├── api/                ← واجهات API (الخادم)
    │   │   ├── auth/           ← تسجيل + دخول + استعادة كلمة المرور
    │   │   ├── calculator/     ← حساب الاحتياجات الغذائية
    │   │   ├── plan/           ← إنشاء الخطط الغذائية
    │   │   └── ...             ← ~60 واجهة أخرى
    │   └── plan/[id]/page.tsx  ← صفحة خطة محددة (رابط ديناميكي)
    ├── components/             ← مكونات واجهة المستخدم
    │   ├── layout/             ← شريط التنقل + الهيكل العام
    │   ├── ui/                 ← أزرار وحقول مشتركة
    │   ├── analyzer/           ← محلل الوجبات بالكاميرا
    │   └── ...                 ← مكونات حسب الميزة
    ├── lib/                    ← أدوات أساسية (قاعدة بيانات، أمان، تحقق)
    ├── services/               ← منطق الأعمال (الحسابات، AI، PDF، خطط)
    └── types/                  ← أنواع TypeScript المشتركة
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
| `getVisionProvider()` | `src/services/ai/index.ts` | يختار مزود الذكاء الاصطناعي | `api/analyze-meal` |
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
| `/api/nutrition/today` | GET | بيانات اليوم للوحة التحكم |
| `/api/profile` | PUT | تحديث بيانات السباح |
| `/api/supplements/calculate` | POST | حاسبة المكملات |
| `/api/wearables/connect` | POST | ربط الساعة الذكية |

---

## 10. أهم الملفات — مرتبة من الأسهل إلى الأصعب

1. `src/lib/constants.ts` — مجرد قوائم ونصوص (أسهل).
2. `src/lib/utils.ts` — دوال صغيرة بسيطة.
3. `next.config.mjs` — إعدادات فقط.
4. `src/lib/prisma.ts` — كيف نتصل بقاعدة البيانات.
5. `src/components/providers.tsx` — مكون من 7 أسطر.
6. `src/app/layout.tsx` — هيكل الصفحة.
7. `src/app/login/page.tsx` — نموذج تسجيل دخول حقيقي.
8. `src/lib/auth.ts` — منطق تسجيل الدخول.
9. `src/app/api/auth/register/route.ts` — أول API كامل.
10. `src/app/page.tsx` — الصفحة الرئيسية.
11. `src/components/layout/app-shell.tsx` — القائمة الجانبية.
12. `src/app/dashboard/page.tsx` — لوحة التحكم (تقرأ من قاعدة البيانات).
13. `src/app/api/calculator/route.ts` — API + حسابات + قاعدة بيانات.
14. `src/services/nutrition/index.ts` — المعادلات العلمية.
15. `prisma/schema.prisma` — شكل قاعدة البيانات.
16. `src/components/analyzer/meal-analyzer.tsx` — مكون معقد (كاميرا + AI).

---

## 11. ترتيب دراسة المشروع للمبتدئ (خطة أسبوعية تقريبًا)

### المرحلة 1 — فهم أساسيات المشروع (ساعة)
- اقرأ هذا الملف (BEGINNER_GUIDE_AR.md).
- اقرأ `src/lib/constants.ts` و`src/lib/utils.ts`.

### المرحلة 2 — كيف ينطلق الموقع؟ (ساعة)
- `next.config.mjs` → `src/app/layout.tsx` → `src/app/page.tsx`.

### المرحلة 3 — قاعدة البيانات والاتصال (ساعة)
- `src/lib/prisma.ts` → `prisma/schema.prisma` (نماذج User وSwimmerProfile وNutritionTargets).

### المرحلة 4 — تسجيل الدخول والحسابات (ساعتان)
- `src/lib/auth.ts` → `src/app/login/page.tsx` → `src/app/api/auth/register/route.ts`.

### المرحلة 5 — أول API وحسابات علمية (ساعتان)
- `src/app/api/calculator/route.ts` → `src/services/nutrition/index.ts`.

### المرحلة 6 — لوحة التحكم (ساعتان)
- `src/components/layout/app-shell.tsx` → `src/app/dashboard/page.tsx`.

### المرحلة 7 — الذكاء الاصطناعي والكاميرا (ساعتان)
- `src/services/ai/index.ts` → `src/app/meal-analyzer/page.tsx` → `src/components/analyzer/meal-analyzer.tsx`.

---

## 12. قواعد مهمة جدًا قبل أي تعديل

1. **لا تغيّر سلوك الموقع** — هدف التعلّم وليس إعادة البناء.
2. **لا تحذف كودًا** يبدو غير مستخدم إلا بعد التأكد الكامل.
3. افحص التعديل دائمًا:
   ```
   npm run typecheck
   npm test
   npm run build
   ```
4. بعد أي تعديل يُنشر على الإنتاج (حسب قواعد المشروع في `AGENTS.md`).

---

## 13. كيف تتدرب بنفسك (من هذا المشروع فقط)

- **تعديل بسيط:** غيّر نص ترحيبي في `src/app/page.tsx`.
- **إضافة لون:** أضف لونًا في `tailwind.config.ts` ثم استخدمه.
- **إضافة رابط:** أضف عنصرًا جديدًا لمصفوفة `NAV` في `app-shell.tsx`.
- **إضافة ثابت:** أضف قيمة جديدة إلى `src/lib/constants.ts`.
- **فهم API:** اقرأ `register/route.ts` ثم حاول كتابة واجهة مشابهة بسيطة.
- **إضافة اختبار:** اقرأ أحد ملفات `.test.ts` في `src/services` وحاول إضافة حالة.
- **التحدي الأكبر:** أضف صفحة جديدة في `src/app/my-page/page.tsx` ورابطًا لها في القائمة.

> بعد إتقانك لهذا المشروع، ستكون قادرًا على بناء موقع مشابه (نظام تسجيل + بيانات + حساب + واجهة + قاعدة بيانات) من الصفر.
