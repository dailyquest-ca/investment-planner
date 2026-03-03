/**
 * Canadian income tax calculation: 2026 Federal + BC brackets.
 *
 * Splits household income across earners, applies progressive brackets per person,
 * then sums. Basic personal amounts are applied as non-refundable credits.
 */

interface TaxBracket {
  upTo: number;
  rate: number;
}

const FEDERAL_BRACKETS: TaxBracket[] = [
  { upTo: 58_523, rate: 0.14 },
  { upTo: 117_045, rate: 0.205 },
  { upTo: 181_440, rate: 0.26 },
  { upTo: 258_482, rate: 0.29 },
  { upTo: Infinity, rate: 0.33 },
];

const FEDERAL_BPA = 16_452;
const FEDERAL_BPA_CREDIT_RATE = 0.14;

const BC_BRACKETS: TaxBracket[] = [
  { upTo: 50_363, rate: 0.056 },
  { upTo: 100_728, rate: 0.077 },
  { upTo: 115_648, rate: 0.105 },
  { upTo: 140_430, rate: 0.1229 },
  { upTo: 190_405, rate: 0.147 },
  { upTo: 265_545, rate: 0.168 },
  { upTo: Infinity, rate: 0.205 },
];

const BC_BPA = 12_932;
const BC_BPA_CREDIT_RATE = 0.056;

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

function federalTaxPerPerson(taxableIncome: number): number {
  const gross = applyBrackets(taxableIncome, FEDERAL_BRACKETS);
  const credit = FEDERAL_BPA * FEDERAL_BPA_CREDIT_RATE;
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
