/*
=================================================
ملف اختبار (Test) — تحويلات Oura
=================================================
يختبر دوال oura-mapping.ts (تصنيف الرياضة، تحويل الثواني إلى
دقائق، وتحميل النشاط/النوم/التدريب).
اسم الملف:
src/lib/wearables/oura-mapping.test.ts
=================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================

// describe/it/expect: من vitest (مكتبة اختبارات خارجية).
// الدوال: من الملف المحلي ./oura-mapping (الهدف من الاختبار).
import { describe, it, expect } from 'vitest';
import {
  mapOuraSport,
  ouraSecondsToMinutes,
  mapOuraDailyActivity,
  mapOuraDailySleep,
  mapOuraWorkout,
} from './oura-mapping';

// ========================================
// 2. اختبار تصنيف الرياضة
// ========================================

describe('mapOuraSport', () => {
  it('classifies swimming', () => {
    expect(mapOuraSport('swimming')).toBe('swim');
    expect(mapOuraSport('Swim')).toBe('swim');
  });
  it('classifies run / cycle / walk / gym / other', () => {
    expect(mapOuraSport('running')).toBe('run');
    expect(mapOuraSport('cycling')).toBe('cycle');
    expect(mapOuraSport('walking')).toBe('walk');
    expect(mapOuraSport('strength_training')).toBe('gym');
    expect(mapOuraSport('rowing')).toBe('other');
  });
});

// ========================================
// 3. اختبار تحويل الثواني إلى دقائق
// ========================================

describe('ouraSecondsToMinutes', () => {
  it('converts seconds to minutes', () => {
    expect(ouraSecondsToMinutes(3600)).toBe(60);
    expect(ouraSecondsToMinutes(90)).toBe(2);
  });
  it('returns undefined for nullish/invalid', () => {
    expect(ouraSecondsToMinutes(null)).toBeUndefined();
    expect(ouraSecondsToMinutes(-10)).toBeUndefined();
  });
});

// ========================================
// 4. اختبار تحويل نشاط اليوم
// ========================================

describe('mapOuraDailyActivity', () => {
  it('maps steps, calories and distance', () => {
    const out = mapOuraDailyActivity({
      steps: 9500,
      distance_meters: 7400,
      calories_active: 620,
      calories_resting: 1680,
      calories_total: 2400,
      average_heart_rate: 63,
    });
    expect(out.steps).toBe(9500);
    expect(out.distanceM).toBe(7400);
    expect(out.activeCalories).toBe(620);
    expect(out.restingCalories).toBe(1680);
    expect(out.totalCaloriesBurned).toBe(2400);
    expect(out.avgHeartRate).toBe(63);
  });
});

// ========================================
// 5. اختبار استخراج النوم
// ========================================

describe('mapOuraDailySleep', () => {
  it('extracts sleep minutes and HR', () => {
    const out = mapOuraDailySleep({
      total_sleep_duration: 25200,
      average_heart_rate: 58,
      resting_heart_rate: 50,
    });
    expect(out.sleepMinutes).toBe(420);
    expect(out.avgHeartRate).toBe(58);
    expect(out.restingHeartRate).toBe(50);
  });
});

// ========================================
// 6. اختبار تحويل التمرين
// ========================================

describe('mapOuraWorkout', () => {
  it('maps a swim session', () => {
    const out = mapOuraWorkout({
      id: 'abc123',
      activity: 'swimming',
      start_datetime: '2026-08-10T07:00:00+00:00',
      duration: 2400,
      calories: 390,
      distance_meters: 1500,
      average_heart_rate: 142,
      intensity: 'moderate',
    });
    expect(out.sportType).toBe('swim');
    expect(out.durationMin).toBe(40);
    expect(out.caloriesBurned).toBe(390);
    expect(out.distanceM).toBe(1500);
    expect(out.avgHeartRate).toBe(142);
    expect(out.externalId).toBe('oura-abc123');
    expect(out.intensity).toBe('moderate');
  });
});
