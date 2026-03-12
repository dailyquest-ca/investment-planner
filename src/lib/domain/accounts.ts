/**
 * Canadian registered account rules: TFSA, RRSP, FHSA.
 *
 * Sources: CRA (2026 limits), Income Tax Act.
 */

/** 2026 CRA RRSP annual contribution maximum. */
export const RRSP_ANNUAL_MAX = 33_810;

/** RRSP room growth rate: 18% of prior year earned income, capped at RRSP_ANNUAL_MAX. */
export const RRSP_ROOM_RATE = 0.18;

/** 2026 TFSA annual contribution limit per person. */
export const TFSA_ANNUAL_LIMIT_PER_PERSON = 7_000;

/** FHSA annual contribution limit. */
export const FHSA_ANNUAL_LIMIT = 8_000;

/** FHSA lifetime contribution limit. */
export const FHSA_LIFETIME_LIMIT = 40_000;

/** Home Buyers' Plan (HBP) RRSP withdrawal limit per person. */
export const HBP_WITHDRAWAL_LIMIT = 60_000;

/**
 * Calculate new RRSP room earned for a year based on prior year's gross income.
 * Room = min(18% of prior year income, annual max).
 */
export function newRrspRoom(priorYearEarnedIncome: number): number {
  return Math.min(RRSP_ROOM_RATE * priorYearEarnedIncome, RRSP_ANNUAL_MAX);
}

/**
 * Compute TFSA room available for a household.
 * Accounts for initial room, annual increases, cumulative usage, and withdrawal regain.
 */
export function tfsaRoomAvailable(
  initialRoom: number,
  annualIncrease: number,
  yearsElapsed: number,
  roomUsed: number,
  roomRegained: number,
): number {
  return Math.max(0, initialRoom + annualIncrease * yearsElapsed - roomUsed + roomRegained);
}

/**
 * Down-payment allocation: FHSA -> RRSP (up to HBP limit) -> TFSA -> Non-registered.
 * Follows CRA ordering for tax efficiency.
 */
export function allocateDownPayment(
  downPayment: number,
  fhsaBalance: number,
  rrspBalance: number,
  tfsaBalance: number,
  nonRegisteredBalance = 0,
): { amountFromFHSA: number; amountFromRRSP: number; amountFromTFSA: number; amountFromNonRegistered: number; remainder: number } {
  let remaining = downPayment;

  const amountFromFHSA = Math.min(remaining, fhsaBalance);
  remaining -= amountFromFHSA;

  const amountFromRRSP = Math.min(remaining, HBP_WITHDRAWAL_LIMIT, rrspBalance);
  remaining -= amountFromRRSP;

  const amountFromTFSA = Math.min(remaining, tfsaBalance);
  remaining -= amountFromTFSA;

  const amountFromNonRegistered = Math.min(remaining, nonRegisteredBalance);
  remaining -= amountFromNonRegistered;

  return { amountFromFHSA, amountFromRRSP, amountFromTFSA, amountFromNonRegistered, remainder: remaining };
}
