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
  /** Years from now until purchase (0 = buying now). */
  yearsUntilPurchase: number;
  /** Monthly rent until purchase (only when yearsUntilPurchase > 0). */
  monthlyRent: number;
  /** Rent increase per year (e.g. Vancouver-style). */
  rentIncreasePercent: number;
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

  // TFSA (household totals)
  householdTFSAContributionRoom: number;
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

/** Generic defaults for first-time visitors (no personal data). */
export const DEFAULT_BUYING_INPUTS: BuyingScenarioInputs = {
  currentAge: 35,
  lifeExpectancy: 90,
  retirementAge: 60,
  yearsUntilPurchase: 0,
  monthlyRent: 2_000,
  rentIncreasePercent: 4,
  buyAmount: 600_000,
  percentageDownpayment: 20,
  startingYearlyTaxes: 2_800,
  startingMonthlyStrata: 400,
  appreciationYoY: 4,
  inflationTaxesYoY: 4,
  inflationStrataYoY: 3,
  currentFHSABalance: 0,
  currentTFSABalance: 25_000,
  currentRRSPBalance: 35_000,
  householdGrossIncome: 100_000,
  numberOfIncomeEarners: 2,
  yearlyRateOfIncrease: 2.5,
  monthlyNonHousingExpenses: 3_000,
  expenseInflationRate: 2.5,
  helocInterestRate: 5.5,
  helocGrowthFirst: false,
  monthlyMoneyNeededDuringRetirement: 3_500,
  monthlyMoneyMadeDuringRetirement: 0,
  partTimeRetirementYears: 0,
  retirementWithdrawalOrder: ['RRSP', 'NonRegistered', 'HELOC', 'TFSA'],
  householdTFSAContributionRoom: 14_000,
  annualTFSARoomIncrease: 14_000,
  currentRRSPRoom: 20_000,
  investmentGrowthRate: 8,
  dividendGrowthRatePercent: 5,
  dividendYieldPercent: 4,
  mortgageRateInitial: 4.5,
  mortgageRateAfterTerm: 5,
  mortgageRateChangeAfterYears: 5,
  mortgageAmortizationYears: 25,
};

/** Computed down payment allocation: FHSA first, then RRSP up to FTHB limit, then TFSA. */
export function getDownPaymentAllocation(inputs: BuyingScenarioInputs): {
  downPayment: number;
  amountFromFHSA: number;
  amountFromRRSP: number;
  amountFromTFSA: number;
} {
  const downPayment = (inputs.buyAmount * inputs.percentageDownpayment) / 100;
  return getDownPaymentAllocationFromBalances(
    downPayment,
    inputs.currentFHSABalance,
    inputs.currentRRSPBalance,
    inputs.currentTFSABalance,
  );
}

/** Same allocation logic using explicit balances (e.g. after years of saving). */
export function getDownPaymentAllocationFromBalances(
  downPayment: number,
  fhsaBalance: number,
  rrspBalance: number,
  tfsaBalance: number,
): { downPayment: number; amountFromFHSA: number; amountFromRRSP: number; amountFromTFSA: number } {
  let remaining = downPayment;
  const amountFromFHSA = Math.min(remaining, fhsaBalance);
  remaining -= amountFromFHSA;
  const amountFromRRSP = Math.min(remaining, RRSP_FTHB_LIMIT, rrspBalance);
  remaining -= amountFromRRSP;
  const amountFromTFSA = Math.min(remaining, tfsaBalance);
  return { downPayment, amountFromFHSA, amountFromRRSP, amountFromTFSA };
}
