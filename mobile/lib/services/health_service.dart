import 'dart:io';
import 'package:health/health.dart';
import 'package:intl/intl.dart';

/// نتيجة قراءة يوم واحد من بيانات التليفون (المجمّع الصحي).
class DayRead {
  final DateTime date;
  final int steps;
  final double distanceMeters;
  final double activeCalories;
  final double restingCalories;
  final double workoutCalories;
  final double totalCalories;
  final int workoutMinutes;
  final int? sleepMinutes;
  final int? avgHeartRate;
  final int? restingHeartRate;
  final int? avgSpo2;

  DayRead({
    required this.date,
    this.steps = 0,
    this.distanceMeters = 0,
    this.activeCalories = 0,
    this.restingCalories = 0,
    this.workoutCalories = 0,
    this.totalCalories = 0,
    this.workoutMinutes = 0,
    this.sleepMinutes,
    this.avgHeartRate,
    this.restingHeartRate,
    this.avgSpo2,
  });

  Map<String, dynamic> toApi() {
    final m = <String, dynamic>{
      'date': date.toIso8601String(),
      'steps': steps,
      'distanceM': distanceMeters > 0 ? distanceMeters.roundToDouble() : null,
      'activeCalories': activeCalories > 0 ? activeCalories.roundToDouble() : null,
      'restingCalories': restingCalories > 0 ? restingCalories.roundToDouble() : null,
      'workoutCalories': workoutCalories > 0 ? workoutCalories.roundToDouble() : null,
      'totalCaloriesBurned': totalCalories > 0 ? totalCalories.roundToDouble() : null,
      'workoutMinutes': workoutMinutes,
      'sleepMinutes': sleepMinutes,
      'avgHeartRate': avgHeartRate,
      'restingHeartRate': restingHeartRate,
      'avgSpo2': avgSpo2,
    };
    return m;
  }

  bool get hasData =>
      steps > 0 ||
      distanceMeters > 0 ||
      activeCalories > 0 ||
      sleepMinutes != null ||
      avgHeartRate != null ||
      avgSpo2 != null;
}

/// تمرين/جلسة مقروءة من المجمّع الصحي.
class WorkoutRead {
  final String? id;
  final DateTime start;
  final DateTime end;
  final String sportType; // swim | gym | run | cycle | walk | other
  final double? calories;
  final double? distanceMeters;
  final int? avgHeartRate;

  WorkoutRead({
    this.id,
    required this.start,
    required this.end,
    required this.sportType,
    this.calories,
    this.distanceMeters,
    this.avgHeartRate,
  });

  Map<String, dynamic> toApi() {
    final durationMin = end.difference(start).inMinutes;
    return {
      'sportType': sportType,
      'startTime': start.toIso8601String(),
      'durationMin': durationMin > 0 ? durationMin : null,
      'caloriesBurned': calories != null && calories! > 0 ? calories!.roundToDouble() : null,
      'distanceM': distanceMeters != null && distanceMeters! > 0 ? distanceMeters!.roundToDouble() : null,
      'avgHeartRate': avgHeartRate,
      'externalId': id != null ? 'health-${id!}' : null,
    };
  }
}

/// الجسر الفعلي للمجمّع الصحي: Apple Health (iOS) / Health Connect (أندرويد).
/// يقرأ بيانات أي ساعة مرتبطة بالتليفون — دون الحاجة لشراكات خاصة.
///
/// مبني على health 13.x: Health() + configure() + getHealthDataFromTypes.
class HealthBridge {
  Health? _health;
  bool _available = false;
  String _lastError = '';

  bool get available => _available;
  String get lastError => _lastError;

  static const _types = [
    HealthDataType.STEPS,
    HealthDataType.ACTIVE_ENERGY_BURNED,
    HealthDataType.BASAL_ENERGY_BURNED,
    HealthDataType.DISTANCE_WALKING_RUNNING,
    HealthDataType.DISTANCE_DELTA,
    HealthDataType.DISTANCE_CYCLING,
    HealthDataType.DISTANCE_SWIMMING,
    HealthDataType.SLEEP_ASLEEP,
    HealthDataType.SLEEP_IN_BED,
    HealthDataType.HEART_RATE,
    HealthDataType.RESTING_HEART_RATE,
    HealthDataType.OXYGEN_SATURATION,
    HealthDataType.WORKOUT,
  ];

  /// تهيئة والتحقق من دعم المنصة ثم طلب أذونات القراءة.
  Future<bool> init() async {
    try {
      final health = Health();
      await health.configure();
      _health = health;

      if (Platform.isAndroid) {
        final connected = await health.isHealthConnectAvailable();
        if (!connected) {
          _available = false;
          _lastError = 'ثبّت تطبيق Health Connect من متجر التطبيقات لقراءة بيانات الساعة.';
          return false;
        }
      }

      final requested = _types.where((t) => health.isDataTypeAvailable(t)).toList();
      final ok = await health.requestAuthorization(requested, permissions: const [HealthDataAccess.READ]);
      _available = ok;
      if (!ok) _lastError = 'لم تُمنح أذونات القراءة بعد';
      return ok;
    } catch (e) {
      _available = false;
      _lastError = 'تعذر الوصول للمجمّع الصحي: ${e.toString().split('\n').first}';
      return false;
    }
  }

  bool get isAndroid => Platform.isAndroid;

  /// استعلام عام يفلتر الأنواع غير المدعومة على المنصة الحالية.
  Future<List<HealthDataPoint>> _query(
    List<HealthDataType> types,
    DateTime start,
    DateTime end, {
    Map<HealthDataType, HealthDataUnit>? preferredUnits,
  }) async {
    final h = _health;
    if (h == null) return const [];
    try {
      final available = types.where((t) => h.isDataTypeAvailable(t)).toList();
      if (available.isEmpty) return const [];
      Map<HealthDataType, HealthDataUnit>? units;
      if (preferredUnits != null) {
        units = <HealthDataType, HealthDataUnit>{
          for (final t in available)
            if (preferredUnits.containsKey(t)) t: preferredUnits[t]!,
        };
      }
      return await h.getHealthDataFromTypes(
        types: available,
        preferredUnits: units,
        startTime: start,
        endTime: end,
      );
    } catch (_) {
      return const [];
    }
  }

  double _sumNumeric(List<HealthDataPoint> points) {
    var s = 0.0;
    for (final p in points) {
      final v = p.value;
      if (v is NumericHealthValue) s += v.numericValue.toDouble();
    }
    return s;
  }

  double _avgNumeric(List<HealthDataPoint> points) {
    if (points.isEmpty) return 0;
    return _sumNumeric(points) / points.length;
  }

  /// استعلام عام للقراءات الصحية — للاستعمال من خدمات المراقبة.
  Future<List<HealthDataPoint>> queryPoints(
    List<HealthDataType> types,
    DateTime start,
    DateTime end, {
    Map<HealthDataType, HealthDataUnit>? preferredUnits,
  }) async {
    return _query(types, start, end, preferredUnits: preferredUnits);
  }

  /// قراءة يوم واحد كامل (نشاط + نوم + نبض) من المجمّع الصحي.
  Future<DayRead> readDay(DateTime day) async {
    final health = _health;
    if (health == null) throw StateError('لم تتم التهيئة');
    final start = DateTime(day.year, day.month, day.day);
    final end = DateTime(day.year, day.month, day.day + 1);

    int steps = 0;
    double distance = 0, active = 0, resting = 0, total = 0, workoutCals = 0;
    int workoutMin = 0;
    int? sleepMin, avgHr, restHr, avgSpo;

    try {
      final s = await health.getTotalStepsInInterval(start, end);
      if (s != null) steps = s;
    } catch (_) {}

    try {
      final pts = await _query(
        const [
          HealthDataType.DISTANCE_WALKING_RUNNING,
          HealthDataType.DISTANCE_DELTA,
          HealthDataType.DISTANCE_CYCLING,
          HealthDataType.DISTANCE_SWIMMING,
        ],
        start,
        end,
        preferredUnits: const {
          HealthDataType.DISTANCE_WALKING_RUNNING: HealthDataUnit.METER,
          HealthDataType.DISTANCE_DELTA: HealthDataUnit.METER,
          HealthDataType.DISTANCE_CYCLING: HealthDataUnit.METER,
          HealthDataType.DISTANCE_SWIMMING: HealthDataUnit.METER,
        },
      );
      distance = _sumNumeric(pts);
    } catch (_) {}

    try {
      final pts = await _query(const [HealthDataType.ACTIVE_ENERGY_BURNED], start, end,
          preferredUnits: const {HealthDataType.ACTIVE_ENERGY_BURNED: HealthDataUnit.KILOCALORIE});
      active = _sumNumeric(pts);
    } catch (_) {}

    try {
      final pts = await _query(const [HealthDataType.BASAL_ENERGY_BURNED], start, end,
          preferredUnits: const {HealthDataType.BASAL_ENERGY_BURNED: HealthDataUnit.KILOCALORIE});
      resting = _sumNumeric(pts);
    } catch (_) {}

    try {
      final pts = await _query(
        const [HealthDataType.SLEEP_ASLEEP, HealthDataType.SLEEP_IN_BED],
        start,
        end,
        preferredUnits: const {
          HealthDataType.SLEEP_ASLEEP: HealthDataUnit.MINUTE,
          HealthDataType.SLEEP_IN_BED: HealthDataUnit.MINUTE,
        },
      );
      final minutes = pts.fold<int>(0, (a, p) => a + p.dateTo.difference(p.dateFrom).inMinutes);
      if (minutes > 0) sleepMin = minutes > 24 * 60 ? 24 * 60 : minutes;
    } catch (_) {}

    try {
      final pts = await _query(const [HealthDataType.HEART_RATE], start, end,
          preferredUnits: const {HealthDataType.HEART_RATE: HealthDataUnit.BEATS_PER_MINUTE});
      final avg = _avgNumeric(pts);
      if (avg > 0) avgHr = avg.round();
    } catch (_) {}

    try {
      final pts = await _query(const [HealthDataType.RESTING_HEART_RATE], start, end,
          preferredUnits: const {HealthDataType.RESTING_HEART_RATE: HealthDataUnit.BEATS_PER_MINUTE});
      final avg = _avgNumeric(pts);
      if (avg > 0) restHr = avg.round();
    } catch (_) {}

    try {
      final pts = await _query(const [HealthDataType.OXYGEN_SATURATION], start, end,
          preferredUnits: const {HealthDataType.OXYGEN_SATURATION: HealthDataUnit.PERCENTAGE});
      final avg = _avgNumeric(pts);
      if (avg > 0) avgSpo = avg.round();
    } catch (_) {}

    // استخراج دقائق التدريب والسعرات من الجلسات المسجلة.
    try {
      final workouts = await readWorkouts(start, end);
      for (final w in workouts) {
        workoutMin += w.end.difference(w.start).inMinutes;
        workoutCals += w.calories ?? 0;
      }
    } catch (_) {}

    total = active + resting;
    return DayRead(
      date: day,
      steps: steps,
      distanceMeters: distance,
      activeCalories: active,
      restingCalories: resting,
      workoutCalories: workoutCals,
      totalCalories: total,
      workoutMinutes: workoutMin,
      sleepMinutes: sleepMin,
      avgHeartRate: avgHr,
      restingHeartRate: restHr,
      avgSpo2: avgSpo,
    );
  }

  /// قراءة التدريبات المسجلة في نطاق زمني.
  Future<List<WorkoutRead>> readWorkouts(DateTime start, DateTime end) async {
    if (_health == null) throw StateError('لم تتم التهيئة');
    try {
      final data = await _query(const [HealthDataType.WORKOUT], start, end);
      final out = <WorkoutRead>[];
      for (final p in data) {
        final v = p.value;
        if (v is! WorkoutHealthValue) continue;
        final cal = _caloriesToKcal(v.totalEnergyBurned, v.totalEnergyBurnedUnit);
        final dist = _distanceToMeters(v.totalDistance, v.totalDistanceUnit);
        out.add(WorkoutRead(
          id: p.uuid,
          start: p.dateFrom,
          end: p.dateTo,
          sportType: _mapWorkoutType(v.workoutActivityType),
          calories: cal != null && cal > 0 ? cal : null,
          distanceMeters: dist != null && dist > 0 ? dist : null,
          avgHeartRate: v.averageHeartRate?.toInt(),
        ));
      }
      return out;
    } catch (_) {
      return [];
    }
  }

  double? _caloriesToKcal(int? value, HealthDataUnit? unit) {
    if (value == null) return null;
    final v = value.toDouble();
    switch (unit) {
      case HealthDataUnit.SMALL_CALORIE:
        return v / 1000;
      case HealthDataUnit.JOULE:
        return v / 4184;
      default:
        return v;
    }
  }

  double? _distanceToMeters(int? value, HealthDataUnit? unit) {
    if (value == null) return null;
    final v = value.toDouble();
    switch (unit) {
      case HealthDataUnit.MILE:
        return v * 1609.344;
      case HealthDataUnit.CENTIMETER:
        return v / 100;
      case HealthDataUnit.FOOT:
        return v * 0.3048;
      case HealthDataUnit.INCH:
        return v * 0.0254;
      case HealthDataUnit.YARD:
        return v * 0.9144;
      default:
        return v;
    }
  }

  String _mapWorkoutType(HealthWorkoutActivityType type) {
    switch (type) {
      case HealthWorkoutActivityType.SWIMMING:
      case HealthWorkoutActivityType.SWIMMING_POOL:
      case HealthWorkoutActivityType.SWIMMING_OPEN_WATER:
      case HealthWorkoutActivityType.WATER_POLO:
      case HealthWorkoutActivityType.WATER_FITNESS:
      case HealthWorkoutActivityType.WATER_SPORTS:
        return 'swim';
      case HealthWorkoutActivityType.RUNNING:
      case HealthWorkoutActivityType.RUNNING_TREADMILL:
        return 'run';
      case HealthWorkoutActivityType.BIKING:
      case HealthWorkoutActivityType.BIKING_STATIONARY:
      case HealthWorkoutActivityType.HAND_CYCLING:
        return 'cycle';
      case HealthWorkoutActivityType.WALKING:
      case HealthWorkoutActivityType.WALKING_TREADMILL:
      case HealthWorkoutActivityType.HIKING:
        return 'walk';
      case HealthWorkoutActivityType.FUNCTIONAL_STRENGTH_TRAINING:
      case HealthWorkoutActivityType.TRADITIONAL_STRENGTH_TRAINING:
      case HealthWorkoutActivityType.STRENGTH_TRAINING:
      case HealthWorkoutActivityType.WEIGHTLIFTING:
      case HealthWorkoutActivityType.CROSS_TRAINING:
      case HealthWorkoutActivityType.CALISTHENICS:
      case HealthWorkoutActivityType.CORE_TRAINING:
      case HealthWorkoutActivityType.YOGA:
      case HealthWorkoutActivityType.PILATES:
        return 'gym';
      default:
        return 'other';
    }
  }

  /// قراءة آخر n يومًا (شاملة اليوم) — للمزامنة الأولية.
  Future<Map<String, DayRead>> readRange(int days) async {
    final out = <String, DayRead>{};
    final fmt = DateFormat('yyyy-MM-dd');
    for (var i = days - 1; i >= 0; i--) {
      final d = DateTime.now().subtract(Duration(days: i));
      try {
        final read = await readDay(d);
        if (read.hasData) out[fmt.format(d)] = read;
      } catch (_) {}
    }
    return out;
  }
}
