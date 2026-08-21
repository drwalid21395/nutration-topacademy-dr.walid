import 'dart:async';
import 'dart:developer' as dev;
import 'package:health/health.dart';
import 'package:url_launcher/url_launcher.dart';
import 'api_client.dart';
import 'health_service.dart';

/// خدمة مراقبة السلامة في الخلفية:
/// تقرأ النبض + الأكسجين كل 15 ثانية وتُرسل للخادم،
/// وعند رصد حالة طوارئ → تتصل بالرقم المسجل تلقائيًا.
class SafetyMonitor {
  final ApiClient api;
  final HealthBridge health;
  Timer? _timer;
  bool _active = false;
  bool _inCooldown = false;
  String? _lastAlertId;

  SafetyMonitor({required this.api, required this.health});

  bool get isActive => _active;

  void start() {
    if (_active) return;
    _active = true;
    dev.log('SafetyMonitor: started', name: 'safety');
    _tick();
    _timer = Timer.periodic(const Duration(seconds: 15), (_) => _tick());
  }

  void stop() {
    _active = false;
    _timer?.cancel();
    _timer = null;
    dev.log('SafetyMonitor: stopped', name: 'safety');
  }

  void dispose() {
    stop();
  }

  Future<void> _tick() async {
    if (!_active) return;
    try {
      final now = DateTime.now();
      // توسيع النافذة إلى 30 دقيقة لضمان التقاط أحدث قراءة من الساعة
      final start = now.subtract(const Duration(minutes: 30));

      final hrPoints = await health.queryPoints(
        const [HealthDataType.HEART_RATE],
        start,
        now,
        preferredUnits: const {HealthDataType.HEART_RATE: HealthDataUnit.BEATS_PER_MINUTE},
      );

      final spoPoints = await health.queryPoints(
        const [HealthDataType.OXYGEN_SATURATION],
        start,
        now,
        preferredUnits: const {HealthDataType.OXYGEN_SATURATION: HealthDataUnit.PERCENTAGE},
      );

      int? hr;
      if (hrPoints.isNotEmpty) {
        double sum = 0;
        for (final p in hrPoints) {
          final v = p.value;
          if (v is NumericHealthValue) sum += v.numericValue.toDouble();
        }
        final avg = sum / hrPoints.length;
        if (avg > 0) hr = avg.round();
        dev.log('SafetyMonitor: HR=$hr from ${hrPoints.length} points', name: 'safety');
      }

      int? spo;
      if (spoPoints.isNotEmpty) {
        double sum = 0;
        for (final p in spoPoints) {
          final v = p.value;
          if (v is NumericHealthValue) sum += v.numericValue.toDouble();
        }
        final avg = (sum / spoPoints.length) * 100;
        if (avg > 0 && avg <= 100) spo = avg.round();
        dev.log('SafetyMonitor: SpO2=$spo from ${spoPoints.length} points', name: 'safety');
      }

      if (hr == null && spo == null) {
        dev.log('SafetyMonitor: no HR or SpO2 data available', name: 'safety');
        return;
      }

      final payload = <String, dynamic>{
        'timestamp': now.toIso8601String(),
        'source': 'mobile',
      };
      if (hr != null) payload['heartRate'] = hr;
      if (spo != null) payload['spo2'] = spo;

      final res = await api.post('/api/safety/vitals', payload);

      if (res is Map && res['alertId'] != null && !_inCooldown) {
        final alertId = res['alertId'] as String;
        if (alertId != _lastAlertId) {
          _lastAlertId = alertId;
          await _handleEmergency(alertId);
        }
      }

      // إرسال النبض أيضًا كنشاط يومي (DailyActivity) لضمان ظهوره في الداشبورد
      if (hr != null) {
        try {
          await api.pushActivity({
            'date': now.toIso8601String(),
            'avgHeartRate': hr,
            if (spo != null) 'avgSpo2': spo,
          });
        } catch (_) {
          // فشل إرسال النشاط اليومي — غير حرج
        }
      }
    } catch (e) {
      dev.log('SafetyMonitor tick error: $e', name: 'safety');
    }
  }

  Future<void> _handleEmergency(String alertId) async {
    try {
      final check = await api.post('/api/safety/emergency-check', {});
      if (check is Map && check['shouldCall'] == true) {
        final phone = check['phone'] as String?;
        if (phone != null && phone.isNotEmpty) {
          await api.post('/api/safety/emergency-check/call-initiated', {
            'alertId': alertId,
            'phone': phone,
            'contactName': check['contactName'],
          });
          final uri = Uri(scheme: 'tel', path: phone);
          if (await canLaunchUrl(uri)) {
            await launchUrl(uri, mode: LaunchMode.externalApplication);
          }
        }
      }
    } catch (_) {
      // فشل الاتصال — نحاول في المرة القادمة
    }
    _inCooldown = true;
    Timer(const Duration(minutes: 3), () {
      _inCooldown = false;
    });
  }
}
