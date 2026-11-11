import { describe, it, expect } from 'vitest';
import { FEE_BLOCK_TERMS, FEE_HOLD_TERMS, extractScannableText, scanJobText, scanJob } from './jobFeeFilter.js';

describe('jobFeeFilter', () => {
  it('blocks registration fee', () => {
    const r = scanJobText('We charge a registration fee');
    expect(r.severity).toBe('blocked');
    expect(r.matchedTerms).toContain('registration fee');
  });
  it('blocks processing payment', () => {
    const r = scanJobText('500 processing payment required');
    expect(r.severity).toBe('blocked');
    expect(r.matchedTerms).toContain('processing payment');
  });
  it('holds bayad muna', () => {
    const r = scanJobText('bayad muna bago interview');
    expect(r.severity).toBe('held');
    expect(r.matchedTerms).toContain('bayad');
  });
  it('de-spaces letter-spaced registration fee -> blocked', () => {
    const r = scanJobText('r e g i s t r a t i o n   f e e');
    expect(r.severity).toBe('blocked');
    expect(r.matchedTerms).toContain('registration fee');
  });
  it('reg.fee -> held via reg fee', () => {
    const r = scanJobText('reg.fee');
    expect(r.severity).toBe('held');
    expect(r.matchedTerms).toContain('reg fee');
  });
  it('clean post -> none', () => {
    const r = scanJobText('Hiring nurses for clinic');
    expect(r.severity).toBe('none');
    expect(r.matchedTerms).toEqual([]);
  });
  it('multi-field sourceFields', () => {
    const r = scanJob({ title: 'Dev', description: 'clean', requirements: 'pay deposit' });
    expect(r.severity).toBe('held');
    expect(r.sourceFields).toContain('requirements');
    expect(r.sourceFields).not.toContain('title');
  });
  it('held-vs-blocked precedence', () => {
    const r = scanJobText('registration fee and donation');
    expect(r.severity).toBe('blocked');
  });
  it('extractScannableText joins fields', () => {
    const t = extractScannableText({ title: 'T', tags: ['a', 'b'] });
    expect(t).toContain('T');
    expect(t).toContain('a b');
  });
  it('exports arrays', () => {
    expect(FEE_BLOCK_TERMS.length).toBe(5);
    expect(FEE_HOLD_TERMS.length).toBe(15);
  });
});