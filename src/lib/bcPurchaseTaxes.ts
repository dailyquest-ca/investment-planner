/**
 * BC Property Transfer Tax (PTT) and federal new-build GST relief calculations.
 *
 * PTT rates (general):
 *   1% on the first $200K
 *   2% on $200K–$2M
 *   3% on $2M+
 *   Further 2% surcharge on residential property > $3M (not modeled — rare for first homes)
 *
 * PTT exemptions:
 *   First-time home buyer: full exemption up to $835K, partial $835K–$860K
 *   Newly built home: full exemption up to $1.1M, partial $1.1M–$1.15M
 *   These stack: a first-time buyer of a new build gets whichever saves more
 *
 * Federal GST on new builds (contracts signed May 27 2025+):
 *   5% GST on purchase price
 *   First-time buyer relief: 100% of GST rebated for homes ≤ $1M,
 *   phasing out linearly between $1M and $1.5M
 *   Non-first-time buyers: legacy rebate of 36% of GST (max ~$6,300) for ≤ $350K,
 *   phasing out $350K–$450K. For simplicity, we model the current (May 2025+) rules only.
 */

// ---------------------------------------------------------------------------
// BC Property Transfer Tax
// ---------------------------------------------------------------------------

const PTT_TIER_1 = 200_000;
const PTT_RATE_1 = 0.01;
const PTT_TIER_2 = 2_000_000;
const PTT_RATE_2 = 0.02;
const PTT_RATE_3 = 0.03;

export function calculateBcPtt(fairMarketValue: number): number {
  if (fairMarketValue <= 0) return 0;
  let ptt = 0;
  const t1 = Math.min(fairMarketValue, PTT_TIER_1);
  ptt += t1 * PTT_RATE_1;
  const t2 = Math.min(Math.max(fairMarketValue - PTT_TIER_1, 0), PTT_TIER_2 - PTT_TIER_1);
  ptt += t2 * PTT_RATE_2;
  const t3 = Math.max(fairMarketValue - PTT_TIER_2, 0);
  ptt += t3 * PTT_RATE_3;
  return Math.round(ptt);
}

// ---------------------------------------------------------------------------
// BC PTT — First-time home buyer exemption
// ---------------------------------------------------------------------------

const FTHB_PTT_FULL_EXEMPT = 835_000;
const FTHB_PTT_PHASE_OUT = 860_000;

export function bcFirstTimeBuyerPttExemption(fairMarketValue: number): number {
  if (fairMarketValue <= 0) return 0;
  if (fairMarketValue <= FTHB_PTT_FULL_EXEMPT) return calculateBcPtt(fairMarketValue);
  if (fairMarketValue >= FTHB_PTT_PHASE_OUT) return 0;
  const fullExempt = calculateBcPtt(fairMarketValue);
  const ratio = (FTHB_PTT_PHASE_OUT - fairMarketValue) / (FTHB_PTT_PHASE_OUT - FTHB_PTT_FULL_EXEMPT);
  return Math.round(fullExempt * ratio);
}

// ---------------------------------------------------------------------------
// BC PTT — Newly built home exemption
// ---------------------------------------------------------------------------

const NEW_BUILD_PTT_FULL_EXEMPT = 1_100_000;
const NEW_BUILD_PTT_PHASE_OUT = 1_150_000;

export function bcNewlyBuiltHomePttExemption(fairMarketValue: number): number {
  if (fairMarketValue <= 0) return 0;
  if (fairMarketValue <= NEW_BUILD_PTT_FULL_EXEMPT) return calculateBcPtt(fairMarketValue);
  if (fairMarketValue >= NEW_BUILD_PTT_PHASE_OUT) return 0;
  const fullExempt = calculateBcPtt(fairMarketValue);
  const ratio = (NEW_BUILD_PTT_PHASE_OUT - fairMarketValue) / (NEW_BUILD_PTT_PHASE_OUT - NEW_BUILD_PTT_FULL_EXEMPT);
  return Math.round(fullExempt * ratio);
}

// ---------------------------------------------------------------------------
// Federal GST relief on new builds (May 2025+ contracts)
// ---------------------------------------------------------------------------

const GST_RATE = 0.05;
const GST_FTHB_FULL_RELIEF_CAP = 1_000_000;
const GST_FTHB_PHASE_OUT_CAP = 1_500_000;

export function newBuildGst(purchasePrice: number): number {
  if (purchasePrice <= 0) return 0;
  return Math.round(purchasePrice * GST_RATE);
}

/**
 * GST rebate for first-time buyers of new builds (May 2025+ rules).
 * 100% relief up to $1M, linearly phasing out $1M–$1.5M, $0 above $1.5M.
 */
export function newBuildGstFirstTimeBuyerRelief(purchasePrice: number): number {
  if (purchasePrice <= 0) return 0;
  const gst = newBuildGst(purchasePrice);
  if (purchasePrice <= GST_FTHB_FULL_RELIEF_CAP) return gst;
  if (purchasePrice >= GST_FTHB_PHASE_OUT_CAP) return 0;
  const ratio = (GST_FTHB_PHASE_OUT_CAP - purchasePrice) / (GST_FTHB_PHASE_OUT_CAP - GST_FTHB_FULL_RELIEF_CAP);
  return Math.round(gst * ratio);
}

// ---------------------------------------------------------------------------
// Structured purchase-cost breakdown
// ---------------------------------------------------------------------------

export interface PurchaseCostBreakdown {
  purchasePrice: number;
  downPayment: number;
  baseMortgage: number;
  cmhcPremium: number;
  finalMortgage: number;

  pttGross: number;
  pttExemption: number;
  pttNet: number;

  gstGross: number;
  gstRelief: number;
  gstNet: number;

  manualFees: number;
  totalCashAtClosing: number;
}

export function computePurchaseCosts(opts: {
  purchasePrice: number;
  downPayment: number;
  cmhcPremium: number;
  isFirstTimeHomeBuyer: boolean;
  isNewBuild: boolean;
  manualLegalFees: number;
  manualInspectionFees: number;
  manualOtherClosingCosts: number;
}): PurchaseCostBreakdown {
  const { purchasePrice, downPayment, cmhcPremium, isFirstTimeHomeBuyer, isNewBuild } = opts;
  const baseMortgage = purchasePrice - downPayment;
  const finalMortgage = baseMortgage + cmhcPremium;

  const pttGross = calculateBcPtt(purchasePrice);
  let pttExemption = 0;
  if (isNewBuild) {
    pttExemption = Math.max(pttExemption, bcNewlyBuiltHomePttExemption(purchasePrice));
  }
  if (isFirstTimeHomeBuyer) {
    pttExemption = Math.max(pttExemption, bcFirstTimeBuyerPttExemption(purchasePrice));
  }
  const pttNet = Math.max(0, pttGross - pttExemption);

  let gstGross = 0;
  let gstRelief = 0;
  if (isNewBuild) {
    gstGross = newBuildGst(purchasePrice);
    if (isFirstTimeHomeBuyer) {
      gstRelief = newBuildGstFirstTimeBuyerRelief(purchasePrice);
    }
  }
  const gstNet = Math.max(0, gstGross - gstRelief);

  const manualFees = opts.manualLegalFees + opts.manualInspectionFees + opts.manualOtherClosingCosts;
  const totalCashAtClosing = downPayment + pttNet + gstNet + manualFees;

  return {
    purchasePrice,
    downPayment,
    baseMortgage,
    cmhcPremium,
    finalMortgage,
    pttGross,
    pttExemption,
    pttNet,
    gstGross,
    gstRelief,
    gstNet,
    manualFees,
    totalCashAtClosing,
  };
}
