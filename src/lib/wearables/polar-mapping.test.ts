import { describe, it, expect } from 'vitest';
import { mapPolarSport, parsePolarDuration } from './polar-mapping';

describe('mapPolarSport', () => {
  it('classifies swimming', () => {
    expect(mapPolarSport('SWIMMING')).toBe('swim');
    expect(mapPolarSport('POOL SWIMMING')).toBe('swim');
  });
  it('classifies run / cycle / walk / gym / other', () => {
    expect(mapPolarSport('RUNNING')).toBe('run');
    expect(mapPolarSport('ROAD CYCLING')).toBe('cycle');
    expect(mapPolarSport('WALKING')).toBe('walk');
    expect(mapPolarSport('WEIGHT TRAINING')).toBe('gym');
    expect(mapPolarSport('YOGA')).toBe('other');
  });
});

describe('parsePolarDuration', () => {
  it('parses HH:MM:SS', () => {
    expect(parsePolarDuration('00:47:25')).toBe(47);
    expect(parsePolarDuration('01:30:00')).toBe(90);
  });
  it('handles numeric milliseconds', () => {
    expect(parsePolarDuration(1800000)).toBe(30);
  });
  it('returns undefined for nullish/invalid', () => {
    expect(parsePolarDuration(undefined)).toBeUndefined();
    expect(parsePolarDuration('abc')).toBeUndefined();
  });
});
