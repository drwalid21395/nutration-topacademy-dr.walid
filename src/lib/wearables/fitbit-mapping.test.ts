import { describe, it, expect } from 'vitest';
import {
  mapFitbitSport,
  parseFitbitDuration,
  fitbitDistanceToMeters,
  mapFitbitActivitySummary,
  mapFitbitSleep,
  mapFitbitHeart,
  mapFitbitWorkout,
} from './fitbit-mapping';

describe('mapFitbitSport', () => {
  it('classifies swimming', () => {
    expect(mapFitbitSport('Lap Swimming', 1357)).toBe('swim');
    expect(mapFitbitSport('Swimming')).toBe('swim');
  });
  it('classifies run / cycle / walk / gym / other', () => {
    expect(mapFitbitSport('Outdoor Run')).toBe('run');
    expect(mapFitbitSport('Bike')).toBe('cycle');
    expect(mapFitbitSport('Walk')).toBe('walk');
    expect(mapFitbitSport('Weights')).toBe('gym');
    expect(mapFitbitSport('Ergometer')).toBe('other');
  });
});

describe('parseFitbitDuration', () => {
  it('converts ms to minutes', () => {
    expect(parseFitbitDuration(1800000)).toBe(30);
    expect(parseFitbitDuration(3725000)).toBe(62);
  });
  it('returns undefined for nullish/invalid', () => {
    expect(parseFitbitDuration(null)).toBeUndefined();
    expect(parseFitbitDuration(-5)).toBeUndefined();
  });
});

describe('fitbitDistanceToMeters', () => {
  it('converts km to meters', () => {
    expect(fitbitDistanceToMeters(1.5)).toBe(1500);
  });
  it('returns undefined for nullish', () => {
    expect(fitbitDistanceToMeters(null)).toBeUndefined();
  });
});

describe('mapFitbitActivitySummary', () => {
  it('maps steps, calories and distance', () => {
    const raw = {
      summary: {
        steps: 8234,
        caloriesOut: 2400,
        caloriesBMR: 1700,
        activityCalories: 700,
        distances: [{ activity: 'total', distance: 6.2 }],
      },
    };
    const out = mapFitbitActivitySummary(raw);
    expect(out.steps).toBe(8234);
    expect(out.activeCalories).toBe(700);
    expect(out.restingCalories).toBe(1700);
    expect(out.totalCaloriesBurned).toBe(2400);
    expect(out.distanceM).toBe(6200);
  });
});

describe('mapFitbitSleep', () => {
  it('extracts sleep minutes and resting HR', () => {
    const out = mapFitbitSleep({ summary: { totalMinutesAsleep: 420, restingHeartRate: 52 } });
    expect(out.sleepMinutes).toBe(420);
    expect(out.restingHeartRate).toBe(52);
  });
});

describe('mapFitbitHeart', () => {
  it('extracts resting heart rate', () => {
    const out = mapFitbitHeart({ 'activities-heart': [{ value: { restingHeartRate: 51 } }] });
    expect(out.restingHeartRate).toBe(51);
  });
});

describe('mapFitbitWorkout', () => {
  it('maps a swim session', () => {
    const out = mapFitbitWorkout({
      name: 'Lap Swimming',
      activityTypeId: 1357,
      startTime: '2026-08-10T07:30:00.000+02:00',
      duration: 3600000,
      calories: 480,
      distance: 1.8,
      logId: 992233,
    });
    expect(out.sportType).toBe('swim');
    expect(out.durationMin).toBe(60);
    expect(out.caloriesBurned).toBe(480);
    expect(out.distanceM).toBe(1800);
    expect(out.externalId).toBe('fitbit-992233');
  });
});
