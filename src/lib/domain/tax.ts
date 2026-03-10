/**
 * Canadian income tax calculation: 2026 Federal + BC brackets.
 *
 * Splits household income across earners, applies progressive brackets per person,
 * then sums. Basic personal amounts are applied as non-refundable credits.
 *
 * Sources:
 *  - Federal: CRA 2026 tax rates (14% lowest bracket)
 *  - BC: gov.bc.ca 2026 rates (5.06% proposed to 5.60%)
 *  - Federal BPA: $16,452 (phases out above $181,440)
 *  - BC BPA: $13,216
 */

interface TaxBracket {
  upTo: number;
  rate: number;
}

export const FEDERAL_BRACKETS: TaxBracket[] = [
  { upTo: 58_523, rate: 0.14 },
  { upTo: 117_045, rate: 0.205 },
  { upTo: 181_440, rate: 0.26 },
  { upTo: 258_482, rate: 0.29 },
  { upTo: Infinity, rate: 0.33 },
];

export const FEDERAL_BPA_MAX = 16_452;
export const FEDERAL_BPA_MIN = 14_829;
export const FEDERAL_BPA_PHASEOUT_START = 181_440;
export const FEDERAL_BPA_PHASEOUT_END = 258_482;
export const FEDERAL_BPA_CREDIT_RATE = 0.14;

export const BC_BRACKETS: TaxBracket[] = [
  { upTo: 50_363, rate: 0.056 },
  { upTo: 100_728, rate: 0.077 },
  { upTo: 115_648, rate: 0.105 },
  { upTo: 140_430, rate: 0.1229 },
  { upTo: 190_405, rate: 0.147 },
  { upTo: 265_545, rate: 0.168 },
  { upTo: Infinity, rate: 0.205 },
];

export const BC_BPA = 13_216;
export const BC_BPA_CREDIT_RATE = 0.056;

function applyBrackets(income: number, brackets: TaxBracket[]): number {
  if (income <= 0) return 0;
  let tax = 0;
  let prev = 0;
  for (const { upTo, rate } of brackets) {
    const taxable = Math.min(income, upTo) - prev;
    if (taxable <= 0) break;
    tax += taxable * rate;
    prev = upTo;
  }
  return tax;
}

/**
 * Compute the federal BPA for a given net income, accounting for the phase-out
 * that reduces BPA from $16,452 to $14,829 between $181,440 and $258,482.
 */
export function federalBPA(netIncome: number): number {
  if (netIncome <= FEDERAL_BPA_PHASEOUT_START) return FEDERAL_BPA_MAX;
  if (netIncome >= FEDERAL_BPA_PHASEOUT_END) return FEDERAL_BPA_MIN;
  const ratio = (netIncome - FEDERAL_BPA_PHASEOUT_START) / (FEDERAL_BPA_PHASEOUT_END - FEDERAL_BPA_PHASEOUT_START);
  return FEDERAL_BPA_MAX - ratio * (FEDERAL_BPA_MAX - FEDERAL_BPA_MIN);
}

function federalTaxPerPerson(taxableIncome: number): number {
  const gross = applyBrackets(taxableIncome, FEDERAL_BRACKETS);
  const bpa = federalBPA(taxableIncome);
  const credit = bpa * FEDERAL_BPA_CREDIT_RATE;
  return Math.max(0, gross - credit);
}

function bcTaxPerPerson(taxableIncome: number): number {
  const gross = applyBrackets(taxableIncome, BC_BRACKETS);
  const credit = BC_BPA * BC_BPA_CREDIT_RATE;
  return Math.max(0, gross - credit);
}

export interface TaxResult {
  federalTax: number;
  provincialTax: number;
  totalTax: number;
}

/**
 * Calculate combined Federal + BC income tax for a household.
 * Income is split evenly across `earners` and brackets applied per person.
 */
export function calculateIncomeTax(
  householdTaxableIncome: number,
  earners: number,
): TaxResult {
  const n = Math.max(1, earners);
  const perPerson = Math.max(0, householdTaxableIncome) / n;
  const fed = federalTaxPerPerson(perPerson) * n;
  const prov = bcTaxPerPerson(perPerson) * n;
  return { federalTax: fed, provincialTax: prov, totalTax: fed + prov };
}

function bracketRate(income: number, brackets: TaxBracket[]): number {
  for (const { upTo, rate } of brackets) {
    if (income <= upTo) return rate;
  }
  return brackets[brackets.length - 1].rate;
}

/**
 * Combined Federal + BC marginal tax rate for one extra dollar at the given
 * household income level (split across earners).
 */
export function getMarginalRate(householdIncome: number, earners: number): number {
  const n = Math.max(1, earners);
  const perPerson = Math.max(0, householdIncome) / n;
  return bracketRate(perPerson, FEDERAL_BRACKETS) + bracketRate(perPerson, BC_BRACKETS);
}

/**
 * Capital gains inclusion for tax purposes.
 * 2026 rules: 50% on first $250K, 66.67% above $250K.
 */
export function taxableCapitalGains(totalGains: number): number {
  if (totalGains <= 0) return 0;
  const TIER_BOUNDARY = 250_000;
  const LOW_RATE = 0.5;
  const HIGH_RATE = 2 / 3;
  if (totalGains <= TIER_BOUNDARY) return totalGains * LOW_RATE;
  return TIER_BOUNDARY * LOW_RATE + (totalGains - TIER_BOUNDARY) * HIGH_RATE;
}

/**
 * Eligible dividend gross-up and tax credit calculation.
 * Eligible dividends are grossed up by 38%, then a federal credit of 15.0198%
 * and BC credit of 12% of the grossed-up amount offset the tax.
 */
export function eligibleDividendTax(
  dividendAmount: number,
  marginalFederalRate: number,
  marginalProvincialRate: number,
): { grossedUp: number; federalCredit: number; provincialCredit: number; netTax: number } {
  const GROSS_UP_RATE = 0.38;
  const FEDERAL_DTC_RATE = 0.150198;
  const BC_DTC_RATE = 0.12;

  const grossedUp = dividendAmount * (1 + GROSS_UP_RATE);
  const federalTaxOnGrossedUp = grossedUp * marginalFederalRate;
  const provincialTaxOnGrossedUp = grossedUp * marginalProvincialRate;
  const federalCredit = grossedUp * FEDERAL_DTC_RATE;
  const provincialCredit = grossedUp * BC_DTC_RATE;
  const netTax = Math.max(0, federalTaxOnGrossedUp - federalCredit + provincialTaxOnGrossedUp - provincialCredit);

  return { grossedUp, federalCredit, provincialCredit, netTax };
}
