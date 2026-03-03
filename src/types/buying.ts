/** Account types that can be drained in retirement. HELOC = growth bucket only; dividend bucket is never sold (dividends pay interest). */
export type RetirementAccountType = 'TFSA' | 'RRSP' | 'NonRegistered' | 'HELOC';

/**
 * Inputs for the Buying Scenario.
 * All dollar amounts in dollars; all rates in percent (e.g. 5.5 for 5.5%).
 */
export interface BuyingScenarioInputs {
  // Personal
  currentAge: number;
  lifeExpectancy: number;
  retirementAge: number;

  // Purchase & property
  buyAmount: number;
  percentageDownpayment: number;
  startingYearlyTaxes: number;
  startingMonthlyStrata: number;
  appreciationYoY: number;

  // Inflation
  inflationTaxesYoY: number;
  inflationStrataYoY: number;

  // Current account balances (down payment sources)
  currentFHSABalance: number;
  currentTFSABalance: number;
  currentRRSPBalance: number;

  // Income & expenses
  householdGrossIncome: number;
  numberOfIncomeEarners: 1 | 2;
  yearlyRateOfIncrease: number;
  monthlyNonHousingExpenses: number;
  expenseInflationRate: number;

  // HELOC
  helocInterestRate: number;
  /** When true, new HELOC room goes to growth first (paid from salary), switching to dividends before retirement. */
  helocGrowthFirst: boolean;

  // Retirement
  monthlyMoneyNeededDuringRetirement: number;
  monthlyMoneyMadeDuringRetirement: number;
  partTimeRetirementYears: number;

  /** Order to withdraw from accounts in retirement: first drained first. */
  retirementWithdrawalOrder: RetirementAccountType[];

  // TFSA
  zakCurrentTFSAContributionRoom: number;
  annaCurrentTFSAContributionRoom: number;
  annualTFSARoomIncrease: number;

  // RRSP
  currentRRSPRoom: number;

  // Investment rates
  investmentGrowthRate: number;
  dividendGrowthRatePercent: number;
  dividendYieldPercent: number;

  // Mortgage
  mortgageRateInitial: number;
  mortgageRateAfterTerm: number;
  mortgageRateChangeAfterYears: number;
  mortgageAmortizationYears: number;
}

/** First-time home buyer RRSP withdrawal limit (Canada). */
export const RRSP_FTHB_LIMIT = 60_000;

/** 2026 CRA RRSP annual contribution maximum. */
export const RRSP_ANNUAL_MAX = 33_810;

export const DEFAULT_BUYING_INPUTS: BuyingScenarioInputs = {
  currentAge: 30,
  lifeExpectancy: 90,
  retirementAge: 55,
  buyAmount: 950_000,
  percentageDownpayment: 20,
  startingYearlyTaxes: 4_300,
  startingMonthlyStrata: 550,
  appreciationYoY: 5,
  inflationTaxesYoY: 5,
  inflationStrataYoY: 3.5,
  currentFHSABalance: 48_000,
  currentTFSABalance: 130_000,
  currentRRSPBalance: 80_000,
  householdGrossIncome: 200_000,
  numberOfIncomeEarners: 2,
  yearlyRateOfIncrease: 3,
  monthlyNonHousingExpenses: 4_000,
  expenseInflationRate: 2.5,
  helocInterestRate: 5.5,
  helocGrowthFirst: false,
  monthlyMoneyNeededDuringRetirement: 5_000,
  monthlyMoneyMadeDuringRetirement: 0,
  partTimeRetirementYears: 5,
  retirementWithdrawalOrder: ['RRSP', 'NonRegistered', 'HELOC', 'TFSA'],
  zakCurrentTFSAContributionRoom: 21_000,
  annaCurrentTFSAContributionRoom: 21_000,
  annualTFSARoomIncrease: 7_000,
  currentRRSPRoom: 50_000,
  investmentGrowthRate: 9,
  dividendGrowthRatePercent: 5,
  dividendYieldPercent: 4,
  mortgageRateInitial: 4,
  mortgageRateAfterTerm: 5,
  mortgageRateChangeAfterYears: 5,
  mortgageAmortizationYears: 30,
};

/** Computed down payment allocation: FHSA first, then RRSP up to FTHB limit, then TFSA. */
export function getDownPaymentAllocation(inputs: BuyingScenarioInputs): {
  downPayment: number;
  amountFromFHSA: number;
  amountFromRRSP: number;
  amountFromTFSA: number;
} {
  const downPayment = (inputs.buyAmount * inputs.percentageDownpayment) / 100;
  let remaining = downPayment;

  const amountFromFHSA = Math.min(remaining, inputs.currentFHSABalance);
  remaining -= amountFromFHSA;

  const amountFromRRSP = Math.min(remaining, RRSP_FTHB_LIMIT, inputs.currentRRSPBalance);
  remaining -= amountFromRRSP;

  const amountFromTFSA = Math.min(remaining, inputs.currentTFSABalance);

  return { downPayment, amountFromFHSA, amountFromRRSP, amountFromTFSA };
}
