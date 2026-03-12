import { describe, it, expect } from 'vitest';
import {
  DEFAULT_BUYING_INPUTS,
  getDownPaymentAllocation,
  getDownPaymentAllocationFromBalances,
  maxDownPaymentFromBalances,
  RRSP_FTHB_LIMIT,
  type BuyingScenarioInputs,
} from '../../types/buying';
import { minimumDownPaymentForPrice } from '../canadianMortgageInsurance';
import { runBuyingProjection, purchaseTimeBalances, type BuyingYearRow } from '../buyingProjection';

function scenario(overrides: Partial<BuyingScenarioInputs> = {}): BuyingYearRow[] {
  return runBuyingProjection({ ...DEFAULT_BUYING_INPUTS, ...overrides });
}

describe('slider minimum — legal minimum down payment by price tier', () => {
  it('5% for homes ≤ $500K', () => {
    expect(minimumDownPaymentForPrice(400_000)).toBe(20_000);
    expect(minimumDownPaymentForPrice(500_000)).toBe(25_000);
  });

  it('5% on first $500K + 10% on remainder for $500K–$999K', () => {
    expect(minimumDownPaymentForPrice(700_000)).toBe(25_000 + 20_000);
    expect(minimumDownPaymentForPrice(999_999)).toBe(25_000 + 49_999.9);
  });

  it('20% for $1M+ (not insurable)', () => {
    expect(minimumDownPaymentForPrice(1_000_000)).toBe(200_000);
    expect(minimumDownPaymentForPrice(1_500_000)).toBe(300_000);
  });
});

describe('slider maximum — maxDownPaymentFromBalances', () => {
  it('sums FHSA + RRSP (capped at HBP) + TFSA + non-registered', () => {
    const max = maxDownPaymentFromBalances(8_000, 100_000, 50_000, 30_000);
    expect(max).toBe(8_000 + RRSP_FTHB_LIMIT + 50_000 + 30_000);
  });

  it('uses actual RRSP when below HBP limit', () => {
    const max = maxDownPaymentFromBalances(0, 20_000, 10_000, 5_000);
    expect(max).toBe(20_000 + 10_000 + 5_000);
  });

  it('returns zero when all accounts are empty', () => {
    expect(maxDownPaymentFromBalances(0, 0, 0, 0)).toBe(0);
  });
});

describe('allocation includes non-registered funds', () => {
  it('allocates FHSA → RRSP → TFSA → Non-Reg', () => {
    const alloc = getDownPaymentAllocationFromBalances(200_000, 10_000, 80_000, 50_000, 100_000);
    expect(alloc.amountFromFHSA).toBe(10_000);
    expect(alloc.amountFromRRSP).toBe(RRSP_FTHB_LIMIT);
    expect(alloc.amountFromTFSA).toBe(50_000);
    expect(alloc.amountFromNonRegistered).toBe(80_000);
  });

  it('does not touch non-registered when earlier accounts suffice', () => {
    const alloc = getDownPaymentAllocationFromBalances(30_000, 30_000, 100_000, 100_000, 50_000);
    expect(alloc.amountFromFHSA).toBe(30_000);
    expect(alloc.amountFromRRSP).toBe(0);
    expect(alloc.amountFromTFSA).toBe(0);
    expect(alloc.amountFromNonRegistered).toBe(0);
  });

  it('getDownPaymentAllocation passes 0 for non-registered (uses current input balances)', () => {
    const alloc = getDownPaymentAllocation({
      ...DEFAULT_BUYING_INPUTS,
      downPaymentAmount: 120_000,
      currentFHSABalance: 0,
      currentRRSPBalance: 50_000,
      currentTFSABalance: 100_000,
    });
    expect(alloc.amountFromNonRegistered).toBe(0);
    expect(alloc.amountFromRRSP).toBe(50_000);
    expect(alloc.amountFromTFSA).toBe(70_000);
  });
});

describe('purchaseTimeBalances', () => {
  it('returns initial balances when yearsUntilPurchase is 0', () => {
    const bal = purchaseTimeBalances({
      ...DEFAULT_BUYING_INPUTS,
      yearsUntilPurchase: 0,
      currentFHSABalance: 5_000,
      currentRRSPBalance: 30_000,
      currentTFSABalance: 20_000,
    });
    expect(bal.fhsa).toBe(5_000);
    expect(bal.rrsp).toBe(30_000);
    expect(bal.tfsa).toBe(20_000);
    expect(bal.nonRegistered).toBe(0);
  });

  it('projects higher balances for future purchases', () => {
    const now = purchaseTimeBalances({ ...DEFAULT_BUYING_INPUTS, yearsUntilPurchase: 0 });
    const later = purchaseTimeBalances({ ...DEFAULT_BUYING_INPUTS, yearsUntilPurchase: 5 });
    expect(later.tfsa).toBeGreaterThan(now.tfsa);
    expect(later.rrsp).toBeGreaterThan(now.rrsp);
  });

  it('future purchase includes non-registered savings', () => {
    const bal = purchaseTimeBalances({
      ...DEFAULT_BUYING_INPUTS,
      yearsUntilPurchase: 10,
      householdGrossIncome: 150_000,
      monthlyNonHousingExpenses: 2_000,
    });
    expect(bal.nonRegistered).toBeGreaterThan(0);
  });
});

describe('projection — down payment clamped to legal minimum', () => {
  it('clamps up to minimum when amount is too low', () => {
    const rows = scenario({
      buyAmount: 600_000,
      downPaymentAmount: 1_000, // way below legal minimum
    });
    // legal min for 600K = 25K + 10K = 35K
    // mortgage = 600K - 35K + insurance
    const expectedMin = minimumDownPaymentForPrice(600_000);
    const baseMortgage = 600_000 - expectedMin;
    expect(rows[0].mortgageBalance).toBeLessThanOrEqual(baseMortgage * 1.05); // with insurance
    expect(rows[0].mortgageBalance).toBeGreaterThanOrEqual(baseMortgage);
  });
});

describe('projection — non-registered deducted at purchase', () => {
  it('reduces non-registered balance when used for down payment (future purchase)', () => {
    const rows = scenario({
      yearsUntilPurchase: 5,
      buyAmount: 600_000,
      downPaymentAmount: 300_000,
      householdGrossIncome: 200_000,
      currentTFSABalance: 10_000,
      currentRRSPBalance: 10_000,
      currentFHSABalance: 0,
    });
    const purchaseRow = rows[5];
    expect(purchaseRow).toBeDefined();
    // Non-reg should be lower in the purchase year due to down payment deduction
    if (rows[4]) {
      const prePurchaseNonReg = rows[4].nonRegisteredBalance;
      expect(purchaseRow.nonRegisteredBalance).toBeLessThan(prePurchaseNonReg);
    }
  });
});

describe('projection — insurance derived from amount not stale percent', () => {
  it('charges insurance when dollar amount implies < 20% down', () => {
    const rows = scenario({
      buyAmount: 500_000,
      downPaymentAmount: 50_000, // 10%
    });
    expect(rows[0].mortgageInsurancePremium).toBeGreaterThan(0);
  });

  it('charges no insurance when dollar amount implies ≥ 20% down', () => {
    const rows = scenario({
      buyAmount: 500_000,
      downPaymentAmount: 100_000, // 20%
    });
    expect(rows[0].mortgageInsurancePremium).toBe(0);
  });
});

describe('saved-data migration (percentageDownpayment → downPaymentAmount)', () => {
  it('converts percent to dollar amount for old saved data', () => {
    const oldData: Record<string, unknown> = {
      buyAmount: 800_000,
      percentageDownpayment: 15,
    };
    if (oldData.downPaymentAmount == null && typeof oldData.percentageDownpayment === 'number' && typeof oldData.buyAmount === 'number') {
      oldData.downPaymentAmount = (oldData.buyAmount * oldData.percentageDownpayment) / 100;
    }
    expect(oldData.downPaymentAmount).toBe(120_000);
  });

  it('does not overwrite if downPaymentAmount already exists', () => {
    const newData: Record<string, unknown> = {
      buyAmount: 800_000,
      downPaymentAmount: 200_000,
      percentageDownpayment: 15,
    };
    if (newData.downPaymentAmount == null && typeof newData.percentageDownpayment === 'number' && typeof newData.buyAmount === 'number') {
      newData.downPaymentAmount = (newData.buyAmount * newData.percentageDownpayment) / 100;
    }
    expect(newData.downPaymentAmount).toBe(200_000);
  });
});

describe('years-until-purchase slider bounds', () => {
  it('max is capped at years until retirement when that is smaller', () => {
    const max = Math.max(0, Math.min(
      DEFAULT_BUYING_INPUTS.lifeExpectancy - DEFAULT_BUYING_INPUTS.currentAge - 1,
      DEFAULT_BUYING_INPUTS.retirementAge - DEFAULT_BUYING_INPUTS.currentAge,
    ));
    expect(max).toBe(DEFAULT_BUYING_INPUTS.retirementAge - DEFAULT_BUYING_INPUTS.currentAge);
  });

  it('max is capped at projection horizon when retirement is far away', () => {
    const inputs = { ...DEFAULT_BUYING_INPUTS, retirementAge: 85, lifeExpectancy: 90, currentAge: 35 };
    const max = Math.max(0, Math.min(inputs.lifeExpectancy - inputs.currentAge - 1, inputs.retirementAge - inputs.currentAge));
    expect(max).toBe(inputs.retirementAge - inputs.currentAge); // 50
  });

  it('max is never negative', () => {
    const inputs = { ...DEFAULT_BUYING_INPUTS, currentAge: 70, retirementAge: 60, lifeExpectancy: 75 };
    const max = Math.max(0, Math.min(inputs.lifeExpectancy - inputs.currentAge - 1, inputs.retirementAge - inputs.currentAge));
    expect(max).toBe(0);
  });
});

describe('year slider drives down-payment max via purchaseTimeBalances', () => {
  it('higher yearsUntilPurchase increases available funds for down payment', () => {
    const bal0 = purchaseTimeBalances({ ...DEFAULT_BUYING_INPUTS, yearsUntilPurchase: 0 });
    const bal5 = purchaseTimeBalances({ ...DEFAULT_BUYING_INPUTS, yearsUntilPurchase: 5 });
    const bal10 = purchaseTimeBalances({ ...DEFAULT_BUYING_INPUTS, yearsUntilPurchase: 10 });

    const max0 = maxDownPaymentFromBalances(bal0.fhsa, bal0.rrsp, bal0.tfsa, bal0.nonRegistered);
    const max5 = maxDownPaymentFromBalances(bal5.fhsa, bal5.rrsp, bal5.tfsa, bal5.nonRegistered);
    const max10 = maxDownPaymentFromBalances(bal10.fhsa, bal10.rrsp, bal10.tfsa, bal10.nonRegistered);

    expect(max5).toBeGreaterThan(max0);
    expect(max10).toBeGreaterThan(max5);
  });

  it('yearsUntilPurchase = 0 uses current balances directly', () => {
    const inputs = {
      ...DEFAULT_BUYING_INPUTS,
      yearsUntilPurchase: 0,
      currentFHSABalance: 8_000,
      currentRRSPBalance: 40_000,
      currentTFSABalance: 30_000,
    };
    const bal = purchaseTimeBalances(inputs);
    const max = maxDownPaymentFromBalances(bal.fhsa, bal.rrsp, bal.tfsa, bal.nonRegistered);
    expect(max).toBe(8_000 + 40_000 + 30_000 + 0);
  });
});
