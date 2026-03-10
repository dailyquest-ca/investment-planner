/**
 * Canadian mortgage payment calculations.
 *
 * Canadian mortgages compound semi-annually by law (Interest Act, s.6).
 * The effective monthly rate is: (1 + annual_rate/2)^(1/6) - 1
 */

const MONTHS_PER_YEAR = 12;
const COMPOUNDING_PERIODS_PER_YEAR = 2;
const MONTHS_PER_COMPOUNDING = MONTHS_PER_YEAR / COMPOUNDING_PERIODS_PER_YEAR;

/**
 * Convert a nominal annual rate (compounded semi-annually) to an effective monthly rate.
 * This is the correct Canadian convention.
 */
export function effectiveMonthlyRate(annualRatePercent: number): number {
  const semiAnnualRate = annualRatePercent / 100 / COMPOUNDING_PERIODS_PER_YEAR;
  return Math.pow(1 + semiAnnualRate, 1 / MONTHS_PER_COMPOUNDING) - 1;
}

/**
 * Calculate the fixed monthly mortgage payment for a Canadian mortgage.
 * Uses semi-annual compounding as required by Canadian law.
 */
export function calcMonthlyPayment(
  principal: number,
  annualRatePercent: number,
  remainingMonths: number,
): number {
  if (remainingMonths <= 0 || principal <= 0) return 0;
  const r = effectiveMonthlyRate(annualRatePercent);
  if (r === 0) return principal / remainingMonths;
  return (principal * r * Math.pow(1 + r, remainingMonths)) / (Math.pow(1 + r, remainingMonths) - 1);
}

/**
 * Calculate a single month's interest and principal split.
 */
export function monthlyAmortizationSplit(
  balance: number,
  annualRatePercent: number,
  monthlyPayment: number,
): { interest: number; principal: number; newBalance: number } {
  const r = effectiveMonthlyRate(annualRatePercent);
  const interest = balance * r;
  const principal = Math.min(monthlyPayment - interest, balance);
  const newBalance = Math.max(0, balance - principal);
  return { interest, principal, newBalance };
}
