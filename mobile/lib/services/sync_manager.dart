import '../config.dart';
import 'api_client.dart';
import 'health_service.dart';
import 'token_store.dart';

/// نتيجة عملية مزامنة.
class SyncReport {
  final int days;
  final int workouts;
  final String message;
  SyncReport({required this.days, required this.workouts, required this.message});
}

/// منسّق المزامنة: يقرأ من المجمّع الصحي ويرسل إلى الخادم.
class SyncManager {
  final ApiClient api;
  final HealthBridge health;
  final TokenStore store;

  SyncManager({required this.api, required this.health, required this.store});

  /// مزامنة كاملة لآخر [days] يومًا.
  Future<SyncReport> run({int? days}) async {
    final n = days ?? AppConfig.backfillDays;
    final reads = await health.readRange(n);

    int sentDays = 0;
    int sentWorkouts = 0;
    final allWorkouts = <Map<String, dynamic>>[];

    for (final read in reads.values) {
      if (read.hasData) {
        await api.pushActivity(read.toApi());
        sentDays += 1;
      }
    }

    final now = DateTime.now();
    final workouts = await health.readWorkouts(now.subtract(Duration(days: n)), now);
    for (final w in workouts) {
      allWorkouts.add(w.toApi());
      sentWorkouts += 1;
    }
    await api.pushWorkouts(allWorkouts);

    await store.setLastSync(DateTime.now());
    return SyncReport(
      days: sentDays,
      workouts: sentWorkouts,
      message: 'تمت مزامنة $sentDays يوم و $sentWorkouts تمرين.',
    );
  }
}
