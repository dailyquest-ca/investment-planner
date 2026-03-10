import { describe, it, expect } from 'vitest';
import {
  calculateIncomeTax,
  getMarginalRate,
  federalBPA,
  taxableCapitalGains,
  eligibleDividendTax,
  FEDERAL_BPA_MAX,
  FEDERAL_BPA_MIN,
  BC_BPA,
} from '../domain/tax';

describe('calculateIncomeTax', () => {
  it('returns zero federal tax for income below the federal BPA ($16,452)', () => {
    const result = calculateIncomeTax(16_000, 1);
    expect(result.federalTax).toBe(0);
  });

  it('returns non-zero BC tax for income above BC BPA ($13,216) but below federal BPA', () => {
    const result = calculateIncomeTax(16_000, 1);
    expect(result.provincialTax).toBeGreaterThan(0);
  });

  it('returns zero total tax for income at or below BC BPA ($13,216)', () => {
    const result = calculateIncomeTax(13_000, 1);
    expect(result.totalTax).toBe(0);
  });

  it('returns zero tax for zero income', () => {
    const result = calculateIncomeTax(0, 1);
    expect(result.totalTax).toBe(0);
    expect(result.federalTax).toBe(0);
    expect(result.provincialTax).toBe(0);
  });

  it('calculates federal tax in the first bracket correctly for a single earner', () => {
    const income = 50_000;
    const result = calculateIncomeTax(income, 1);
    const expectedFederal = income * 0.14 - FEDERAL_BPA_MAX * 0.14;
    expect(result.federalTax).toBeCloseTo(expectedFederal, 0);
  });

  it('calculates BC provincial tax in the first bracket for a single earner', () => {
    const income = 40_000;
    const result = calculateIncomeTax(income, 1);
    const expectedBC = income * 0.056 - BC_BPA * 0.056;
    expect(result.provincialTax).toBeCloseTo(expectedBC, 0);
  });

  it('splits income across two earners and applies brackets per person', () => {
    const household = 200_000;
    const result2 = calculateIncomeTax(household, 2);
    const result1 = calculateIncomeTax(household, 1);
    expect(result2.totalTax).toBeLessThan(result1.totalTax);
  });

  it('applies the top federal bracket (33%) for income above $258,482', () => {
    const marginal = getMarginalRate(400_000, 1);
    expect(marginal).toBeCloseTo(0.33 + 0.205, 3);
  });

  it('household of $100k with 2 earners pays less than ~$15k total tax', () => {
    const result = calculateIncomeTax(100_000, 2);
    expect(result.totalTax).toBeLessThan(15_000);
    expect(result.totalTax).toBeGreaterThan(0);
  });

  it('totalTax equals federalTax + provincialTax', () => {
    const result = calculateIncomeTax(120_000, 1);
    expect(result.totalTax).toBeCloseTo(result.federalTax + result.provincialTax, 2);
  });

  it('handles negative income gracefully', () => {
    const result = calculateIncomeTax(-10_000, 1);
    expect(result.totalTax).toBe(0);
  });
});

describe('federalBPA', () => {
  it('returns full BPA ($16,452) for income under $181,440', () => {
    expect(federalBPA(100_000)).toBe(FEDERAL_BPA_MAX);
  });

  it('returns minimum BPA ($14,829) for income above $258,482', () => {
    expect(federalBPA(300_000)).toBe(FEDERAL_BPA_MIN);
  });

  it('returns a value between min and max for income in the phase-out range', () => {
    const bpa = federalBPA(220_000);
    expect(bpa).toBeGreaterThan(FEDERAL_BPA_MIN);
    expect(bpa).toBeLessThan(FEDERAL_BPA_MAX);
  });

  it('phases out linearly', () => {
    const midpoint = (181_440 + 258_482) / 2;
    const bpa = federalBPA(midpoint);
    const expectedMid = (FEDERAL_BPA_MAX + FEDERAL_BPA_MIN) / 2;
    expect(bpa).toBeCloseTo(expectedMid, 0);
  });
});

describe('getMarginalRate', () => {
  it('returns the lowest combined rate for low income', () => {
    const rate = getMarginalRate(30_000, 1);
    expect(rate).toBeCloseTo(0.14 + 0.056, 3);
  });

  it('returns the top combined rate for very high income', () => {
    const rate = getMarginalRate(500_000, 1);
    expect(rate).toBeCloseTo(0.33 + 0.205, 3);
  });

  it('income splitting reduces the marginal rate', () => {
    const rate1 = getMarginalRate(200_000, 1);
    const rate2 = getMarginalRate(200_000, 2);
    expect(rate2).toBeLessThan(rate1);
  });
});

describe('taxableCapitalGains', () => {
  it('returns zero for zero gains', () => {
    expect(taxableCapitalGains(0)).toBe(0);
  });

  it('returns zero for negative gains', () => {
    expect(taxableCapitalGains(-5_000)).toBe(0);
  });

  it('applies 50% inclusion for gains under $250,000', () => {
    expect(taxableCapitalGains(100_000)).toBe(50_000);
  });

  it('applies 50% inclusion up to $250,000 boundary exactly', () => {
    expect(taxableCapitalGains(250_000)).toBe(125_000);
  });

  it('applies 66.67% inclusion for gains above $250,000', () => {
    const gains = 350_000;
    const expected = 250_000 * 0.5 + 100_000 * (2 / 3);
    expect(taxableCapitalGains(gains)).toBeCloseTo(expected, 2);
  });

  it('handles very large gains correctly', () => {
    const gains = 1_000_000;
    const expected = 250_000 * 0.5 + 750_000 * (2 / 3);
    expect(taxableCapitalGains(gains)).toBeCloseTo(expected, 2);
  });
});

describe('eligibleDividendTax', () => {
  it('grosses up eligible dividends by 38%', () => {
    const result = eligibleDividendTax(10_000, 0.205, 0.077);
    expect(result.grossedUp).toBeCloseTo(13_800, 0);
  });

  it('applies federal dividend tax credit at 15.0198%', () => {
    const result = eligibleDividendTax(10_000, 0.205, 0.077);
    expect(result.federalCredit).toBeCloseTo(13_800 * 0.150198, 0);
  });

  it('applies BC dividend tax credit at 12%', () => {
    const result = eligibleDividendTax(10_000, 0.205, 0.077);
    expect(result.provincialCredit).toBeCloseTo(13_800 * 0.12, 0);
  });

  it('net tax on eligible dividends is lower than on equivalent employment income', () => {
    const dividendResult = eligibleDividendTax(10_000, 0.205, 0.077);
    const employmentTax = 10_000 * (0.205 + 0.077);
    expect(dividendResult.netTax).toBeLessThan(employmentTax);
  });

  it('returns non-negative net tax', () => {
    const result = eligibleDividendTax(5_000, 0.14, 0.056);
    expect(result.netTax).toBeGreaterThanOrEqual(0);
  });
});
