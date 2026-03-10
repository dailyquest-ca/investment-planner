import { describe, it, expect } from 'vitest';
import {
  calculateMortgageInsurance,
  minimumDownPaymentForPrice,
} from '../canadianMortgageInsurance';

describe('minimumDownPaymentForPrice', () => {
  it('requires 5% for purchase price at or below $500K', () => {
    expect(minimumDownPaymentForPrice(400_000)).toBe(20_000);
    expect(minimumDownPaymentForPrice(500_000)).toBe(25_000);
  });

  it('requires 5% on first $500K + 10% on remainder for $500K–$999K', () => {
    // $600K: 5% × 500K + 10% × 100K = 25K + 10K = 35K
    expect(minimumDownPaymentForPrice(600_000)).toBe(35_000);
    // $800K: 5% × 500K + 10% × 300K = 25K + 30K = 55K
    expect(minimumDownPaymentForPrice(800_000)).toBe(55_000);
  });

  it('requires 20% for purchase price at or above $1M', () => {
    expect(minimumDownPaymentForPrice(1_000_000)).toBe(200_000);
    expect(minimumDownPaymentForPrice(1_500_000)).toBe(300_000);
  });
});

describe('calculateMortgageInsurance', () => {
  it('returns no premium when down payment is 20% or more', () => {
    const result = calculateMortgageInsurance(600_000, 20, 25);
    expect(result.premiumRate).toBe(0);
    expect(result.premiumAmount).toBe(0);
    expect(result.eligible).toBe(true);
    expect(result.insuredMortgage).toBe(result.baseMortgage);
  });

  it('applies 2.8% premium for 15-19.99% down payment', () => {
    const result = calculateMortgageInsurance(600_000, 15, 25);
    expect(result.eligible).toBe(true);
    expect(result.premiumRate).toBe(0.028);
    const expectedBase = 600_000 * 0.85;
    expect(result.baseMortgage).toBe(expectedBase);
    expect(result.premiumAmount).toBe(Math.round(expectedBase * 0.028));
    expect(result.insuredMortgage).toBe(expectedBase + result.premiumAmount);
  });

  it('applies 3.1% premium for 10-14.99% down payment', () => {
    const result = calculateMortgageInsurance(600_000, 10, 25);
    expect(result.eligible).toBe(true);
    expect(result.premiumRate).toBe(0.031);
  });

  it('applies 4.0% premium for 5-9.99% down payment', () => {
    const result = calculateMortgageInsurance(400_000, 5, 25);
    expect(result.eligible).toBe(true);
    expect(result.premiumRate).toBe(0.04);
  });

  it('is not eligible when purchase price is $1M or above', () => {
    const result = calculateMortgageInsurance(1_000_000, 10, 25);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it('is not eligible when amortization exceeds 25 years', () => {
    const result = calculateMortgageInsurance(600_000, 10, 30);
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('25');
  });

  it('is not eligible when down payment is below the minimum', () => {
    // $600K needs $35K minimum (5.83%), so 5% ($30K) is not enough
    const result = calculateMortgageInsurance(600_000, 5, 25);
    expect(result.eligible).toBe(false);
  });

  it('is eligible for $600K at 6% down (above minimum 5.83%)', () => {
    const result = calculateMortgageInsurance(600_000, 6, 25);
    expect(result.eligible).toBe(true);
    expect(result.premiumRate).toBe(0.04);
  });

  it('rolls premium into insured mortgage', () => {
    const result = calculateMortgageInsurance(500_000, 10, 25);
    expect(result.insuredMortgage).toBe(result.baseMortgage + result.premiumAmount);
    expect(result.insuredMortgage).toBeGreaterThan(result.baseMortgage);
  });
});
