import { describe, it, expect } from 'vitest';
import { BRIEFS } from './briefs.js';

describe('AI help role briefs', () => {
  it('exposes exactly three role briefs', () => {
    expect(Object.keys(BRIEFS).sort()).toEqual(['employer', 'job-seeker', 'super-admin']);
    for (const brief of Object.values(BRIEFS)) {
      expect(typeof brief).toBe('string');
      expect(brief.trim().length).toBeGreaterThan(0);
    }
  });

  it('job-seeker brief matches the live route copy', () => {
    expect(
      BRIEFS['job-seeker'].startsWith(
        'You are the in-app help assistant for PESO JobLinked, a job-matching site run by PESO Santa Maria.',
      ),
    ).toBe(true);
  });

  it('new briefs end with a PESO-contact guard line', () => {
    const guards = {
      employer: 'tell the employer to contact PESO Santa Maria.',
      'super-admin': 'tell the user to follow internal PESO channels.',
    };
    for (const [role, guard] of Object.entries(guards)) {
      expect(BRIEFS[role]).toContain('never claim to look something up');
      expect(BRIEFS[role].endsWith(guard)).toBe(true);
    }
  });
});
