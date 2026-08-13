import { describe, it, expect } from 'vitest';
import { classifyStravaSport, mapStravaActivity } from './strava-mapping';

describe('classifyStravaSport', () => {
  it('classifies swim activities', () => {
    expect(classifyStravaSport('Swim', 'Morning Pool Swim')).toBe('swim');
    expect(classifyStravaSport('Ride', 'Pool Swim — Lane 3')).toBe('swim');
  });
  it('classifies run / ride / walk / gym', () => {
    expect(classifyStravaSport('Run', 'Easy Run')).toBe('run');
    expect(classifyStravaSport('VirtualRide', 'Zwift')).toBe('cycle');
    expect(classifyStravaSport('Walk', 'Walk')).toBe('walk');
    expect(classifyStravaSport('WeightTraining', 'Push day')).toBe('gym');
    expect(classifyStravaSport('Workout', 'Elliptical')).toBe('gym');
    expect(classifyStravaSport('Other', 'Rock Climbing')).toBe('other');
  });
});

describe('mapStravaActivity', () => {
  it('converts seconds to minutes and keeps metric meters', () => {
    const out = mapStravaActivity({
      id: 123456789,
      type: 'Run',
      name: 'Easy Run',
      distance: 5000, // متر
      moving_time: 1800, // ثانية
      elapsed_time: 2000,
      start_date_local: '2026-08-12T06:30:00Z',
      average_heartrate: 142,
      calories: 350,
    });
    expect(out.sportType).toBe('run');
    expect(out.durationMin).toBe(30);
    expect(out.distanceM).toBe(5000);
    expect(out.externalId).toBe('123456789');
    expect(out.avgHeartRate).toBe(142);
    expect(out.caloriesBurned).toBe(350);
    expect(new Date(out.startTime as string).toISOString()).toBe('2026-08-12T06:30:00.000Z');
  });

  it('attaches swim details (laps / swolf / pool length)', () => {
    const out = mapStravaActivity(
      {
        id: 99,
        type: 'Swim',
        name: 'Lap Swim',
        distance: 1500,
        moving_time: 2400,
        start_date_local: '2026-08-12T06:30:00Z',
      },
      { laps: 60, average_swolf: 42, pool_length: 25 }
    );
    expect(out.sportType).toBe('swim');
    expect(out.durationMin).toBe(40);
    expect(out.laps).toBe(60);
    expect(out.swolf).toBe(42);
    expect(out.poolLengthM).toBe(25);
  });
});
