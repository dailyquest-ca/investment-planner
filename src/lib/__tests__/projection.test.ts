import { describe, it, expect } from 'vitest';
import { runProjection, type ProjectionInputs } from '../projection';

const BASE_INPUTS: ProjectionInputs = {
  initialBalance: 50_000,
  monthlyContribution: 1_000,
  annualReturnPercent: 7,
  inflationPercent: 2.5,
  currentAge: 35,
  retirementAge: 60,
  annualSpendingRetirement: 50_000,
  projectionYears: 55,
};

describe('runProjection — basic structure', () => {
  const result = runProjection(BASE_INPUTS);

  it('returns the correct number of yearly projections', () => {
    expect(result.yearly).toHaveLength(BASE_INPUTS.projectionYears);
  });

  it('ages increment by 1 each year', () => {
    for (let i = 1; i < result.yearly.length; i++) {
      expect(result.yearly[i].age).toBe(result.yearly[i - 1].age + 1);
    }
  });

  it('marks years before retirement as not retired', () => {
    const workingYears = BASE_INPUTS.retirementAge - BASE_INPUTS.currentAge;
    for (let i = 0; i < workingYears; i++) {
      expect(result.yearly[i].isRetired).toBe(false);
    }
  });

  it('marks years at or after retirement as retired', () => {
    const workingYears = BASE_INPUTS.retirementAge - BASE_INPUTS.currentAge;
    for (let i = workingYears; i < result.yearly.length; i++) {
      expect(result.yearly[i].isRetired).toBe(true);
    }
  });
});

describe('runProjection — growth and contributions', () => {
  const result = runProjection(BASE_INPUTS);

  it('balance grows during working years', () => {
    const workingYears = BASE_INPUTS.retirementAge - BASE_INPUTS.currentAge;
    expect(result.yearly[workingYears - 1].balanceNominal).toBeGreaterThan(BASE_INPUTS.initialBalance);
  });

  it('contributions are positive during working years', () => {
    const workingYears = BASE_INPUTS.retirementAge - BASE_INPUTS.currentAge;
    for (let i = 0; i < workingYears; i++) {
      expect(result.yearly[i].contributions).toBeGreaterThan(0);
    }
  });

  it('contributions are zero during retirement', () => {
    const workingYears = BASE_INPUTS.retirementAge - BASE_INPUTS.currentAge;
    for (let i = workingYears; i < result.yearly.length; i++) {
      expect(result.yearly[i].contributions).toBe(0);
    }
  });

  it('withdrawals occur during retirement', () => {
    const workingYears = BASE_INPUTS.retirementAge - BASE_INPUTS.currentAge;
    for (let i = workingYears; i < result.yearly.length; i++) {
      if (result.yearly[i].balanceNominal > 0 || result.yearly[i].withdrawals > 0) {
        expect(result.yearly[i].withdrawals).toBeGreaterThan(0);
      }
    }
  });
});

describe('runProjection — balance at retirement', () => {
  it('returns the inflation-adjusted balance at retirement age', () => {
    const result = runProjection(BASE_INPUTS);
    expect(result.balanceAtRetirement).toBeGreaterThan(0);
  });
});

describe('runProjection — nominal balance never goes negative', () => {
  it('balances stay at zero or above', () => {
    const result = runProjection(BASE_INPUTS);
    for (const year of result.yearly) {
      expect(year.balanceNominal).toBeGreaterThanOrEqual(0);
    }
  });
});
