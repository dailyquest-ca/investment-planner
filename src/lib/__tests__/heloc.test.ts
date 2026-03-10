import { describe, it, expect } from 'vitest';
import {
  maxHelocBalance,
  yearlyHelocInterest,
  newHelocRoom,
} from '../domain/heloc';

describe('maxHelocBalance', () => {
  it('caps at 65% of property value when mortgage is zero', () => {
    expect(maxHelocBalance(1_000_000, 0)).toBe(650_000);
  });

  it('caps at 80% LTV minus mortgage when that is the binding constraint', () => {
    // Property: $500K, mortgage: $350K → 80% = $400K → room = $50K (< 65% = $325K)
    expect(maxHelocBalance(500_000, 350_000)).toBe(50_000);
  });

  it('returns zero when mortgage already exceeds 80% LTV', () => {
    expect(maxHelocBalance(500_000, 450_000)).toBe(0);
  });

  it('returns the lower of 65% property and (80% property - mortgage)', () => {
    // Property: $800K, mortgage: $100K
    // 65% = $520K, 80% - $100K = $540K → capped at $520K
    expect(maxHelocBalance(800_000, 100_000)).toBe(520_000);
  });

  it('returns zero for zero property value', () => {
    expect(maxHelocBalance(0, 0)).toBe(0);
  });
});

describe('yearlyHelocInterest', () => {
  it('calculates simple interest on the balance', () => {
    expect(yearlyHelocInterest(100_000, 5.5)).toBeCloseTo(5_500, 0);
  });

  it('returns zero for zero balance', () => {
    expect(yearlyHelocInterest(0, 5.5)).toBe(0);
  });

  it('returns zero for zero rate', () => {
    expect(yearlyHelocInterest(100_000, 0)).toBe(0);
  });
});

describe('newHelocRoom', () => {
  it('returns available room up to the max cap', () => {
    // Property: $600K, mortgage: $200K, current HELOC: $100K
    // Max HELOC: min(65% × 600K = 390K, 80% × 600K - 200K = 280K) = 280K
    // Room: 280K - 100K = 180K
    expect(newHelocRoom(600_000, 200_000, 100_000)).toBe(180_000);
  });

  it('returns zero when HELOC is already at the cap', () => {
    const max = maxHelocBalance(600_000, 200_000);
    expect(newHelocRoom(600_000, 200_000, max)).toBe(0);
  });

  it('returns zero when HELOC exceeds the cap', () => {
    expect(newHelocRoom(600_000, 200_000, 300_000)).toBe(0);
  });
});
