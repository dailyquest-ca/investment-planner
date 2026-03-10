/**
 * HELOC (Home Equity Line of Credit) rules for Canadian readvanceable mortgages.
 *
 * OSFI guidelines:
 *  - HELOC portion capped at 65% of property value.
 *  - Combined mortgage + HELOC capped at 80% of property value.
 *  - Interest is tax-deductible only when borrowed funds are used for income-producing investments.
 */

const HELOC_LTV_CAP = 0.65;
const COMBINED_LTV_CAP = 0.80;

/**
 * Maximum HELOC balance given property value and outstanding mortgage.
 * Enforces both the 65% standalone cap and the 80% combined cap.
 */
export function maxHelocBalance(propertyValue: number, mortgageBalance: number): number {
  const cap65 = HELOC_LTV_CAP * propertyValue;
  const cap80 = Math.max(0, COMBINED_LTV_CAP * propertyValue - mortgageBalance);
  return Math.min(cap65, cap80);
}

/**
 * Calculate yearly HELOC interest.
 * HELOC interest in Canada is typically calculated on the outstanding balance
 * at the prime rate plus a margin, compounded monthly.
 */
export function yearlyHelocInterest(balance: number, annualRatePercent: number): number {
  return balance * (annualRatePercent / 100);
}

/**
 * Determine how much new HELOC room is available after a mortgage payment.
 * New room = min(maxBalance - currentBalance, principalPaid).
 * Ensures we don't exceed the cap.
 */
export function newHelocRoom(
  propertyValue: number,
  mortgageBalance: number,
  currentHelocBalance: number,
): number {
  const maxBal = maxHelocBalance(propertyValue, mortgageBalance);
  return Math.max(0, maxBal - currentHelocBalance);
}
