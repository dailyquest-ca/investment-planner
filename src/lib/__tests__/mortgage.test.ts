import { describe, it, expect } from 'vitest';
import {
  effectiveMonthlyRate,
  calcMonthlyPayment,
  monthlyAmortizationSplit,
} from '../domain/mortgage';

describe('effectiveMonthlyRate', () => {
  it('returns zero for a 0% annual rate', () => {
    expect(effectiveMonthlyRate(0)).toBe(0);
  });

  it('converts semi-annual compounding to monthly correctly for 5%', () => {
    // (1 + 0.05/2)^(1/6) - 1 ≈ 0.004124
    const rate = effectiveMonthlyRate(5);
    expect(rate).toBeCloseTo(0.004124, 5);
  });

  it('produces a lower effective monthly rate than simple division by 12', () => {
    const semiAnnual = effectiveMonthlyRate(6);
    const simpleMonthly = 0.06 / 12;
    expect(semiAnnual).toBeLessThan(simpleMonthly);
  });

  it('converts 4.5% correctly', () => {
    // (1 + 0.045/2)^(1/6) - 1 ≈ 0.003716
    const rate = effectiveMonthlyRate(4.5);
    expect(rate).toBeCloseTo(0.003716, 4);
  });
});

describe('calcMonthlyPayment', () => {
  it('returns zero for zero principal', () => {
    expect(calcMonthlyPayment(0, 5, 300)).toBe(0);
  });

  it('returns zero for zero remaining months', () => {
    expect(calcMonthlyPayment(500_000, 5, 0)).toBe(0);
  });

  it('returns principal / months when rate is 0%', () => {
    const payment = calcMonthlyPayment(240_000, 0, 240);
    expect(payment).toBeCloseTo(1_000, 2);
  });

  it('calculates a 25-year mortgage at 5% using semi-annual compounding', () => {
    const payment = calcMonthlyPayment(400_000, 5, 300);
    // With semi-annual compounding, payment should be ~$2,326
    expect(payment).toBeGreaterThan(2_300);
    expect(payment).toBeLessThan(2_400);
  });

  it('a higher rate produces a higher monthly payment', () => {
    const low = calcMonthlyPayment(400_000, 4, 300);
    const high = calcMonthlyPayment(400_000, 6, 300);
    expect(high).toBeGreaterThan(low);
  });

  it('shorter amortization produces a higher monthly payment', () => {
    const long = calcMonthlyPayment(400_000, 5, 300);
    const short = calcMonthlyPayment(400_000, 5, 180);
    expect(short).toBeGreaterThan(long);
  });

  it('total payments over the life of the mortgage exceed the principal', () => {
    const payment = calcMonthlyPayment(400_000, 5, 300);
    const totalPaid = payment * 300;
    expect(totalPaid).toBeGreaterThan(400_000);
  });
});

describe('monthlyAmortizationSplit', () => {
  it('interest + principal equals the payment amount (approximately)', () => {
    const payment = calcMonthlyPayment(400_000, 5, 300);
    const split = monthlyAmortizationSplit(400_000, 5, payment);
    expect(split.interest + split.principal).toBeCloseTo(payment, 2);
  });

  it('new balance equals old balance minus principal', () => {
    const payment = calcMonthlyPayment(400_000, 5, 300);
    const split = monthlyAmortizationSplit(400_000, 5, payment);
    expect(split.newBalance).toBeCloseTo(400_000 - split.principal, 2);
  });

  it('early payments have more interest than principal', () => {
    const payment = calcMonthlyPayment(400_000, 5, 300);
    const split = monthlyAmortizationSplit(400_000, 5, payment);
    expect(split.interest).toBeGreaterThan(split.principal);
  });

  it('interest portion decreases as balance decreases', () => {
    const payment = calcMonthlyPayment(400_000, 5, 300);
    const splitEarly = monthlyAmortizationSplit(400_000, 5, payment);
    const splitLate = monthlyAmortizationSplit(100_000, 5, payment);
    expect(splitLate.interest).toBeLessThan(splitEarly.interest);
  });

  it('never produces a negative balance', () => {
    const payment = calcMonthlyPayment(1_000, 5, 12);
    let balance = 1_000;
    for (let m = 0; m < 15; m++) {
      const split = monthlyAmortizationSplit(balance, 5, payment);
      expect(split.newBalance).toBeGreaterThanOrEqual(0);
      balance = split.newBalance;
    }
  });
});
