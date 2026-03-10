/**
 * Canadian mortgage default insurance (CMHC-style) premium calculation.
 *
 * Rules (as of 2025-2026):
 *  - Required when down payment < 20% of purchase price.
 *  - Purchase price must be < $1,000,000.
 *  - Max amortization 25 years (30 for first-time buyers on new builds — not modelled here).
 *  - Minimum down payment: 5% on the first $500K, 10% on any portion above $500K.
 *  - Premium is a one-time percentage of the *mortgage amount* (not purchase price),
 *    typically rolled into the mortgage principal.
 */

const PRICE_TIER_BOUNDARY = 500_000;
const INSURABLE_PRICE_CAP = 1_000_000;
const MAX_INSURED_AMORTIZATION_YEARS = 25;

interface InsuranceResult {
  eligible: boolean;
  /** Why the purchase isn't eligible, if applicable. */
  reason?: string;
  /** Premium as a decimal (e.g. 0.04 for 4%). 0 when no insurance is needed. */
  premiumRate: number;
  /** Dollar amount of the premium. */
  premiumAmount: number;
  /** Mortgage amount before insurance. */
  baseMortgage: number;
  /** Mortgage amount after insurance premium is rolled in. */
  insuredMortgage: number;
  /** Minimum down-payment dollar amount required by regulation. */
  minimumDownPayment: number;
}

/** Return the minimum down payment required for a given purchase price. */
export function minimumDownPaymentForPrice(purchasePrice: number): number {
  if (purchasePrice <= PRICE_TIER_BOUNDARY) {
    return purchasePrice * 0.05;
  }
  if (purchasePrice < INSURABLE_PRICE_CAP) {
    return PRICE_TIER_BOUNDARY * 0.05 + (purchasePrice - PRICE_TIER_BOUNDARY) * 0.10;
  }
  return purchasePrice * 0.20;
}

function premiumRateForDownPaymentPercent(dpPercent: number): number {
  if (dpPercent >= 20) return 0;
  if (dpPercent >= 15) return 0.028;
  if (dpPercent >= 10) return 0.031;
  return 0.04;
}

export function calculateMortgageInsurance(
  purchasePrice: number,
  downPaymentPercent: number,
  amortizationYears: number,
): InsuranceResult {
  const downPayment = (purchasePrice * downPaymentPercent) / 100;
  const baseMortgage = purchasePrice - downPayment;

  if (downPaymentPercent >= 20) {
    return {
      eligible: true,
      premiumRate: 0,
      premiumAmount: 0,
      baseMortgage,
      insuredMortgage: baseMortgage,
      minimumDownPayment: minimumDownPaymentForPrice(purchasePrice),
    };
  }

  const minDP = minimumDownPaymentForPrice(purchasePrice);

  if (purchasePrice >= INSURABLE_PRICE_CAP) {
    return {
      eligible: false,
      reason: `Insured mortgages are not available for purchases of $${(INSURABLE_PRICE_CAP / 1000).toFixed(0)}K or above. A 20%+ down payment is required.`,
      premiumRate: 0,
      premiumAmount: 0,
      baseMortgage,
      insuredMortgage: baseMortgage,
      minimumDownPayment: minDP,
    };
  }

  if (downPayment < minDP - 0.01) {
    return {
      eligible: false,
      reason: `Minimum down payment is $${Math.ceil(minDP).toLocaleString()} (${purchasePrice <= PRICE_TIER_BOUNDARY ? '5%' : '5% on first $500K + 10% on remainder'}).`,
      premiumRate: 0,
      premiumAmount: 0,
      baseMortgage,
      insuredMortgage: baseMortgage,
      minimumDownPayment: minDP,
    };
  }

  if (amortizationYears > MAX_INSURED_AMORTIZATION_YEARS) {
    return {
      eligible: false,
      reason: `Insured mortgages require amortization of ${MAX_INSURED_AMORTIZATION_YEARS} years or less.`,
      premiumRate: 0,
      premiumAmount: 0,
      baseMortgage,
      insuredMortgage: baseMortgage,
      minimumDownPayment: minDP,
    };
  }

  const rate = premiumRateForDownPaymentPercent(downPaymentPercent);
  const premiumAmount = Math.round(baseMortgage * rate);

  return {
    eligible: true,
    premiumRate: rate,
    premiumAmount,
    baseMortgage,
    insuredMortgage: baseMortgage + premiumAmount,
    minimumDownPayment: minDP,
  };
}
