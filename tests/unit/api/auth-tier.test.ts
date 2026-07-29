import { describe, it, expect } from 'vitest';
import { resolveEffectiveTier } from '../../../api/_lib/auth';

const DAY = 24 * 60 * 60 * 1000;
const ts = (millis: number) => ({ toMillis: () => millis }); // Firestore Timestamp shape

describe('resolveEffectiveTier', () => {
  it('returns free for missing or invalid data', () => {
    expect(resolveEffectiveTier(undefined)).toBe('free');
    expect(resolveEffectiveTier({})).toBe('free');
    expect(resolveEffectiveTier({ tier: 'enterprise' })).toBe('free');
  });

  it('keeps a paid tier inside the period and inside the grace window', () => {
    expect(resolveEffectiveTier({ tier: 'pro', proEndDate: ts(Date.now() + DAY) })).toBe('pro');
    expect(resolveEffectiveTier({ tier: 'builder', proEndDate: ts(Date.now() - 2 * DAY) })).toBe(
      'builder'
    ); // grace: webhook may still land
  });

  it('drops to free past proEndDate + 3-day grace', () => {
    expect(resolveEffectiveTier({ tier: 'pro', proEndDate: ts(Date.now() - 4 * DAY) })).toBe(
      'free'
    );
    expect(resolveEffectiveTier({ tier: 'builder', proEndDate: ts(Date.now() - 400 * DAY) })).toBe(
      'free'
    );
  });

  it('never expires manual grants without a proEndDate', () => {
    expect(resolveEffectiveTier({ tier: 'builder' })).toBe('builder');
    expect(resolveEffectiveTier({ tier: 'builder', proEndDate: null })).toBe('builder');
  });

  it('accepts a plain Date as well as a Firestore Timestamp', () => {
    expect(resolveEffectiveTier({ tier: 'pro', proEndDate: new Date(Date.now() + DAY) })).toBe(
      'pro'
    );
    expect(resolveEffectiveTier({ tier: 'pro', proEndDate: new Date(Date.now() - 4 * DAY) })).toBe(
      'free'
    );
  });

  // An unparseable date must not silently revoke a paying user's access.
  it('keeps the paid tier when proEndDate is unparseable', () => {
    expect(resolveEffectiveTier({ tier: 'pro', proEndDate: 'not-a-date' })).toBe('pro');
  });
});
