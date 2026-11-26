import { describe, expect, it } from 'vitest';
import { nameChangeAvailableAt, nameChangeLockHelp } from '../names';

const NOW = new Date('2026-11-26T00:00:00.000Z');
const daysAgo = (n) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

describe('name change cooldown', () => {
  it('is free when the name was never changed', () => {
    expect(nameChangeAvailableAt(null, NOW)).toBeNull();
    expect(nameChangeLockHelp(undefined, NOW)).toBeNull();
  });

  it('locks for 30 days after a change', () => {
    expect(nameChangeAvailableAt(daysAgo(10), NOW)).not.toBeNull();
    expect(nameChangeLockHelp(daysAgo(10), NOW)).toMatch(/^You can change your name again on /);
  });

  it('releases at the 30-day boundary', () => {
    expect(nameChangeAvailableAt(daysAgo(30), NOW)).toBeNull();
    expect(nameChangeAvailableAt(daysAgo(31), NOW)).toBeNull();
  });
});
