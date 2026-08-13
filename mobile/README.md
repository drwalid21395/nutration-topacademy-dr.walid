# Top Academy — جسر الساعات الذكية (تطبيق موبايل)

تطبيق Flutter يقرأ بيانات **أي ساعة مرتبطة بالهاتف** من المجمّع الصحي
(Apple Health على آيفون / Health Connect على أندرويد) ويرسلها تلقائيًا إلى الموقع
عبر نفس نقاط الاستقبال — دون حاجة لشراكات خاصة مع الشركات المصنّعة.

## البنية

```
المستخدم يلبس أي ساعة → تطبيق الشركة على الهاتف → Apple Health / Health Connect
                                                        ↓ (هذا التطبيق)
                                              الموقع (API) → تحديث الخطة الغذائية
```

## الخطوات للبناء والتشغيل

### 1) تثبيت Flutter
- من https://docs.flutter.dev/get-started/install (ويندوز/ماك)
- بعد التثبيت شغّل: `flutter doctor`

### 2) توليد مجلدات المنصات (أول مرة فقط)
الدليل `mobile/` يحتوي الكود وإعدادات الأذونات. افتح طرفية داخل `mobile/`:

```
flutter create . --platforms=android,ios --org com.topacademy --project-name top_academy_bridge
```

> لن يمسح الملفات الموجودة (الرمز، pubspec، الأذونات) — يضيف فقط مجلدات المنصات الناقصة.

### 3) تثبيت الحزم
```
flutter pub get
```

### 4) التشغيل
- **أندرويد:** `flutter run` (مع جهاز مفعّل أو محاكي)
- **آيفون:** افتح `ios/Runner.xcworkspace` في Xcode ثم شغّل، أو `flutter run`

### 5) العنوان (اختياري)
المتجر مضبوط على عنوان الإنتاج. لبيئة أخرى:
```
flutter run --dart-define=API_BASE=https://YOUR-DOMAIN.com
```

## الأذونات

- **أندرويد (Health Connect):** `AndroidManifest.xml` مُعدّ مسبقًا بأذونات القراءة
  (خطوات/مسافة/سعرات/نوم/نبض/تدريب). Health Connect متاحة على أندرويد 8+ —
  يجب على المستخدم تثبيت تطبيق Health Connect من متجر Play إن لم يكن موجودًا.
- **آيفون (HealthKit):** `Info.plist` مُعدّ بوصف طلب الأذونات.

## المزامنة

- زر «مزامنة الآن» يرسل آخر ٧ أيام.
- بعد منح الأذونات، يبدأ التطبيق **مزامنة تلقائية كل ٣٠ دقيقة** أثناء فتحه.
- أول يوم يُحذف من تلقاء نفسه عند الحفظ بعد ٩٠ يومًا — التوكن يُجدَّد بتسجيل الدخول من جديد.

## الحساب

التطبيق يستخدم نفس بريد وكلمة مرور حساب الموقع. يرسل التوكن عبر `Authorization: Bearer …`
إلى `/api/mobile/login` ثم `/api/health/activity` و `/api/health/workouts`.

## الملفات الرئيسية

| الملف | الوظيفة |
| --- | --- |
| `lib/services/health_service.dart` | قراءة المجمّع الصحي (الخطوات/النوم/النبض/التدريبات) |
| `lib/services/api_client.dart` | الدخول وإرسال البيانات للموقع |
| `lib/services/sync_manager.dart` | تنسيق القراءة ثم الإرسال |
| `lib/screens/login_screen.dart` | شاشة الدخول |
| `lib/screens/home_screen.dart` | منح الأذونات + المزامنة |
| `lib/config.dart` | الإعدادات (عنوان الموقع، أيام المزامنة) |
