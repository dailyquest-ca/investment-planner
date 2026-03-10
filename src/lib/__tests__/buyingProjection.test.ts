import { describe, it, expect } from 'vitest';
import { runBuyingProjection, type BuyingYearRow } from '../buyingProjection';
import { DEFAULT_BUYING_INPUTS, type BuyingScenarioInputs } from '../../types/buying';

function scenario(overrides: Partial<BuyingScenarioInputs> = {}): BuyingYearRow[] {
  return runBuyingProjection({ ...DEFAULT_BUYING_INPUTS, ...overrides });
}

describe('runBuyingProjection — basic structure', () => {
  it('returns one row per year from current age to life expectancy', () => {
    const rows = scenario();
    const expectedYears = DEFAULT_BUYING_INPUTS.lifeExpectancy - DEFAULT_BUYING_INPUTS.currentAge;
    expect(rows).toHaveLength(expectedYears);
  });

  it('ages increment by 1 each year', () => {
    const rows = scenario();
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].age).toBe(rows[i - 1].age + 1);
    }
  });

  it('years increment by 1 each year', () => {
    const rows = scenario();
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].year).toBe(rows[i - 1].year + 1);
    }
  });
});

describe('runBuyingProjection — buy-now scenario', () => {
  const rows = scenario();

  it('first year has a positive mortgage balance', () => {
    expect(rows[0].mortgageBalance).toBeGreaterThan(0);
  });

  it('mortgage balance decreases over time', () => {
    const earlyBalance = rows[0].mortgageBalance;
    const laterBalance = rows[10].mortgageBalance;
    expect(laterBalance).toBeLessThan(earlyBalance);
  });

  it('mortgage is paid off within amortization period', () => {
    const amortYears = DEFAULT_BUYING_INPUTS.mortgageAmortizationYears;
    if (rows.length > amortYears) {
      expect(rows[amortYears].mortgageBalance).toBeCloseTo(0, 0);
    }
  });

  it('property value grows each year by appreciation rate', () => {
    const rate = 1 + DEFAULT_BUYING_INPUTS.appreciationYoY / 100;
    expect(rows[1].propertyValue).toBeCloseTo(rows[0].propertyValue * rate, 0);
  });

  it('house equity = property value - mortgage balance', () => {
    for (const row of rows.slice(0, 10)) {
      expect(row.houseEquity).toBeCloseTo(row.propertyValue - row.mortgageBalance, 0);
    }
  });

  it('HELOC balance never exceeds 65% of property value', () => {
    for (const row of rows) {
      expect(row.helocBalance).toBeLessThanOrEqual(0.65 * row.propertyValue + 1);
    }
  });

  it('mortgage + HELOC never exceeds 80% of property value', () => {
    for (const row of rows) {
      expect(row.mortgageBalance + row.helocBalance).toBeLessThanOrEqual(0.8 * row.propertyValue + 1);
    }
  });

  it('income tax is never negative', () => {
    for (const row of rows) {
      expect(row.incomeTax).toBeGreaterThanOrEqual(0);
    }
  });

  it('net worth includes all asset classes minus debts', () => {
    const row = rows[0];
    const expected = row.houseEquity + row.tfsaBalance + row.rrspBalance
      + row.nonRegisteredBalance + row.helocNetEquity;
    expect(row.netWorth).toBeCloseTo(expected, 0);
  });
});

describe('runBuyingProjection — rent-only scenario', () => {
  const rows = scenario({ buyingHouse: false });

  it('returns rows for the full projection period', () => {
    const expectedYears = DEFAULT_BUYING_INPUTS.lifeExpectancy - DEFAULT_BUYING_INPUTS.currentAge;
    expect(rows).toHaveLength(expectedYears);
  });

  it('has zero property value and mortgage in all years', () => {
    for (const row of rows) {
      expect(row.propertyValue).toBe(0);
      expect(row.mortgageBalance).toBe(0);
    }
  });

  it('has zero HELOC balance in all years', () => {
    for (const row of rows) {
      expect(row.helocBalance).toBe(0);
    }
  });

  it('has positive housing costs from rent', () => {
    expect(rows[0].yearlyHousingCosts).toBeGreaterThan(0);
  });

  it('accounts grow during working years', () => {
    const workingYears = DEFAULT_BUYING_INPUTS.retirementAge - DEFAULT_BUYING_INPUTS.currentAge;
    const midPoint = Math.floor(workingYears / 2);
    const totalInvested = rows[midPoint].tfsaBalance + rows[midPoint].rrspBalance + rows[midPoint].nonRegisteredBalance;
    expect(totalInvested).toBeGreaterThan(
      DEFAULT_BUYING_INPUTS.currentTFSABalance + DEFAULT_BUYING_INPUTS.currentRRSPBalance,
    );
  });
});

describe('runBuyingProjection — retirement withdrawals (regression)', () => {
  it('withdraws from accounts during retirement to cover expenses', () => {
    const rows = scenario();
    const retirementStart = DEFAULT_BUYING_INPUTS.retirementAge - DEFAULT_BUYING_INPUTS.currentAge;
    const retirementRows = rows.slice(retirementStart);
    const hasWithdrawals = retirementRows.some(r => r.totalWithdrawals > 0);
    expect(hasWithdrawals).toBe(true);
  });

  it('rent-only scenario also withdraws during retirement', () => {
    const rows = scenario({ buyingHouse: false });
    const retirementStart = DEFAULT_BUYING_INPUTS.retirementAge - DEFAULT_BUYING_INPUTS.currentAge;
    const retirementRows = rows.slice(retirementStart);
    const hasWithdrawals = retirementRows.some(r => r.totalWithdrawals > 0);
    expect(hasWithdrawals).toBe(true);
  });
});

describe('runBuyingProjection — future purchase', () => {
  const rows = scenario({ yearsUntilPurchase: 5 });

  it('first 5 years show rent and no mortgage', () => {
    for (let i = 0; i < 5; i++) {
      expect(rows[i].mortgageBalance).toBe(0);
      expect(rows[i].yearlyHousingCosts).toBeGreaterThan(0);
    }
  });

  it('year 6 onwards has a mortgage balance', () => {
    expect(rows[5].mortgageBalance).toBeGreaterThan(0);
  });

  it('total rows still equals projection period', () => {
    const expectedYears = DEFAULT_BUYING_INPUTS.lifeExpectancy - DEFAULT_BUYING_INPUTS.currentAge;
    expect(rows).toHaveLength(expectedYears);
  });
});

describe('runBuyingProjection — mortgage insurance', () => {
  it('shows zero insurance premium when down payment is 20%', () => {
    const rows = scenario({ percentageDownpayment: 20 });
    expect(rows[0].mortgageInsurancePremium).toBe(0);
  });

  it('shows non-zero insurance premium when down payment is below 20%', () => {
    const rows = scenario({ percentageDownpayment: 10, buyAmount: 500_000 });
    expect(rows[0].mortgageInsurancePremium).toBeGreaterThan(0);
  });

  it('insurance premium only appears in the purchase year', () => {
    const rows = scenario({ percentageDownpayment: 10, buyAmount: 500_000 });
    const premiumRows = rows.filter(r => r.mortgageInsurancePremium > 0);
    expect(premiumRows).toHaveLength(1);
  });

  it('insured mortgage balance is higher than base mortgage', () => {
    const insuredRows = scenario({ percentageDownpayment: 10, buyAmount: 500_000 });
    const uninsuredRows = scenario({ percentageDownpayment: 20, buyAmount: 500_000 });
    // 10% down = 450K base + premium vs 20% down = 400K
    // Insured should be higher even accounting for the different base
    expect(insuredRows[0].mortgageBalance).toBeGreaterThan(uninsuredRows[0].mortgageBalance);
  });
});

describe('runBuyingProjection — HELOC growth-first strategy', () => {
  it('growth bucket grows during working years', () => {
    const rows = scenario({ helocGrowthFirst: true });
    const retirementStart = DEFAULT_BUYING_INPUTS.retirementAge - DEFAULT_BUYING_INPUTS.currentAge;
    const workingRows = rows.slice(0, retirementStart);
    const hasGrowth = workingRows.some(r => r.helocGrowthBalance > 0);
    expect(hasGrowth).toBe(true);
  });

  it('dividend bucket builds before retirement', () => {
    const rows = scenario({ helocGrowthFirst: true });
    const retirementStart = DEFAULT_BUYING_INPUTS.retirementAge - DEFAULT_BUYING_INPUTS.currentAge;
    expect(rows[retirementStart - 1].helocDividendBalance).toBeGreaterThan(0);
  });
});

describe('runBuyingProjection — TFSA regain timing', () => {
  it('TFSA withdrawals do not immediately create new room in the same year', () => {
    const rows = scenario();
    const retirementStart = DEFAULT_BUYING_INPUTS.retirementAge - DEFAULT_BUYING_INPUTS.currentAge;
    for (let i = retirementStart; i < rows.length - 1; i++) {
      if (rows[i].tfsaWithdrawals > 0) {
        // Room should not spike in the same year as the withdrawal
        // It should appear the following year
        const roomThisYear = rows[i].tfsaContributionRoom;
        const roomNextYear = rows[i + 1].tfsaContributionRoom;
        expect(roomNextYear).toBeGreaterThanOrEqual(roomThisYear);
        break;
      }
    }
  });
});

describe('runBuyingProjection — RRSP room growth', () => {
  it('RRSP room grows each year based on prior year income', () => {
    const rows = scenario();
    // After the first year, RRSP room should have increased
    expect(rows[1].rrspRoom).toBeGreaterThan(0);
  });
});

describe('runBuyingProjection — income tax during working years', () => {
  it('working years have positive income tax', () => {
    const rows = scenario();
    const retirementStart = DEFAULT_BUYING_INPUTS.retirementAge - DEFAULT_BUYING_INPUTS.currentAge;
    for (let i = 0; i < Math.min(retirementStart, rows.length); i++) {
      expect(rows[i].incomeTax).toBeGreaterThan(0);
    }
  });

  it('effective tax rate is between 0% and 50%', () => {
    const rows = scenario();
    for (const row of rows) {
      expect(row.effectiveTaxRate).toBeGreaterThanOrEqual(0);
      expect(row.effectiveTaxRate).toBeLessThan(50);
    }
  });
});
