/**
 * Investment projection engine.
 * Models: compound growth, regular contributions, inflation, retirement & wind-down.
 */

export interface ProjectionInputs {
  /** Current investable assets (today's dollars) */
  initialBalance: number;
  /** Monthly contribution (can be 0 after wind-down) */
  monthlyContribution: number;
  /** Expected annual return (e.g. 7 for 7%) */
  annualReturnPercent: number;
  /** Expected annual inflation (e.g. 2.5 for 2.5%) */
  inflationPercent: number;
  /** Current age */
  currentAge: number;
  /** Target retirement age (contributions can stop here) */
  retirementAge: number;
  /** Annual spending in retirement (today's dollars) */
  annualSpendingRetirement: number;
  /** Max years to project (e.g. to age 95) */
  projectionYears: number;
}

export interface YearProjection {
  year: number;
  age: number;
  /** End-of-year balance in nominal dollars */
  balanceNominal: number;
  /** End-of-year balance in today's dollars (inflation-adjusted) */
  balanceReal: number;
  /** Total contributions made that year */
  contributions: number;
  /** Withdrawals that year (e.g. in retirement) */
  withdrawals: number;
  /** Whether user is "retired" (past retirement age) */
  isRetired: boolean;
}

export interface ProjectionResult {
  yearly: YearProjection[];
  /** First year balance (real) exceeds 25x annual spending (4% rule) */
  retirementReadyYear: number | null;
  /** First year where growth alone exceeds contributions (can wind down) */
  windDownYear: number | null;
  /** Balance at retirement age (real) */
  balanceAtRetirement: number;
}

const MONTHS_PER_YEAR = 12;

/**
 * Project net worth year-by-year with compound growth and contributions.
 * After retirement age, contributions stop and withdrawals begin (annual spending).
 */
export function runProjection(inputs: ProjectionInputs): ProjectionResult {
  const monthlyReturn = Math.pow(1 + inputs.annualReturnPercent / 100, 1 / MONTHS_PER_YEAR) - 1;
  const yearlyInflationFactor = 1 + inputs.inflationPercent / 100;
  const startYear = new Date().getFullYear();

  const yearly: YearProjection[] = [];
  let balance = inputs.initialBalance;
  let retirementReadyYear: number | null = null;
  let windDownYear: number | null = null;
  let cumulativeInflation = 1;

  for (let y = 0; y < inputs.projectionYears; y++) {
    const year = startYear + y;
    const age = inputs.currentAge + y;
    const isRetired = age >= inputs.retirementAge;

    // Contributions: only before retirement (or until user "winds down" — we treat wind-down as optional; here we stop at retirement)
    const monthsContributing = isRetired ? 0 : MONTHS_PER_YEAR;
    let yearContributions = 0;

    // Simulate month-by-month for this year (compound + contributions)
    for (let m = 0; m < MONTHS_PER_YEAR; m++) {
      balance *= 1 + monthlyReturn;
      if (m < monthsContributing) {
        const contrib = inputs.monthlyContribution;
        balance += contrib;
        yearContributions += contrib;
      }
    }

    // Withdrawals: at end of year in retirement (spending in that year's dollars)
    const spendingNominal = isRetired ? inputs.annualSpendingRetirement * cumulativeInflation : 0;
    if (spendingNominal > 0) {
      balance = Math.max(0, balance - spendingNominal);
    }

    cumulativeInflation *= yearlyInflationFactor;
    const balanceReal = balance / cumulativeInflation;

    yearly.push({
      year,
      age,
      balanceNominal: balance,
      balanceReal,
      contributions: yearContributions,
      withdrawals: spendingNominal,
      isRetired,
    });

    // 4% rule: need 25x annual spending (in real terms)
    const targetReal = inputs.annualSpendingRetirement * 25;
    if (retirementReadyYear == null && balanceReal >= targetReal) {
      retirementReadyYear = year;
    }

    // Wind-down: growth this year (without new contributions) would still push balance up
    const balanceBeforeContributions = balance - yearContributions + (isRetired ? spendingNominal : 0);
    const growthOnlyBalance = balanceBeforeContributions * Math.pow(1 + monthlyReturn, MONTHS_PER_YEAR);
    if (windDownYear == null && !isRetired && yearContributions > 0 && growthOnlyBalance >= balanceBeforeContributions) {
      // Simpler: year where annualized growth on current balance >= annual contributions
      const annualGrowth = balance * (inputs.annualReturnPercent / 100);
      if (annualGrowth >= yearContributions) {
        windDownYear = year;
      }
    }
  }

  const retirementIndex = yearly.findIndex((p) => p.age >= inputs.retirementAge);
  const balanceAtRetirement =
    retirementIndex >= 0 ? yearly[retirementIndex].balanceReal : yearly[yearly.length - 1].balanceReal;

  return {
    yearly,
    retirementReadyYear,
    windDownYear,
    balanceAtRetirement,
  };
}
