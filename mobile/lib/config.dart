/// إعدادات التطبيق — تُضبط عبر --dart-define عند البناء.
class AppConfig {
  /// عنوان الموقع (يُمرَّر من التطبيق، أو القيمة الافتراضية للإنتاج).
  static const String apiBase = String.fromEnvironment(
    'API_BASE',
    defaultValue: 'https://nutration-topacademy-dr-walid.vercel.app',
  );

  /// اسم المصدر المرسَل إلى الخادم (يظهر في سجلات المزامنة).
  static const String provider = 'mobile';

  /// عدد الأيام السابقة المراد مزامنتها في أول تشغيل.
  static const int backfillDays = 7;

  /// فترة إعادة المحاولة التلقائية للخلفية بالثواني (بين المزامنات).
  static const int autoSyncIntervalSeconds = 300;

  /// أقصى عدد أيام تُرسل في دفعة واحدة (حماية للحدود).
  static const int maxDaysPerBatch = 7;
}
