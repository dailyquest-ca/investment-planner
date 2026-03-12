import { describe, it, expect } from 'vitest';
import {
  calculateBcPtt,
  bcFirstTimeBuyerPttExemption,
  bcNewlyBuiltHomePttExemption,
  newBuildGst,
  newBuildGstFirstTimeBuyerRelief,
  computePurchaseCosts,
} from '../bcPurchaseTaxes';

// ---------------------------------------------------------------------------
// BC Property Transfer Tax — basic calculation
// ---------------------------------------------------------------------------
describe('calculateBcPtt', () => {
  it('returns 0 for zero or negative price', () => {
    expect(calculateBcPtt(0)).toBe(0);
    expect(calculateBcPtt(-100_000)).toBe(0);
  });

  it('applies 1% on the first $200K', () => {
    expect(calculateBcPtt(100_000)).toBe(1_000);
    expect(calculateBcPtt(200_000)).toBe(2_000);
  });

  it('applies 2% on $200K–$2M', () => {
    // $500K: 1% on $200K ($2K) + 2% on $300K ($6K) = $8K
    expect(calculateBcPtt(500_000)).toBe(8_000);
    // $2M: 1% on $200K ($2K) + 2% on $1.8M ($36K) = $38K
    expect(calculateBcPtt(2_000_000)).toBe(38_000);
  });

  it('applies 3% above $2M', () => {
    // $3M: $38K (first $2M) + 3% on $1M ($30K) = $68K
    expect(calculateBcPtt(3_000_000)).toBe(68_000);
  });

  it('handles a typical $600K condo', () => {
    // 1% on $200K ($2K) + 2% on $400K ($8K) = $10K
    expect(calculateBcPtt(600_000)).toBe(10_000);
  });

  it('handles a typical $835K home (FTHB threshold)', () => {
    // 1% on $200K ($2K) + 2% on $635K ($12.7K) = $14,700
    expect(calculateBcPtt(835_000)).toBe(14_700);
  });
});

// ---------------------------------------------------------------------------
// BC PTT — First-time home buyer exemption
// ---------------------------------------------------------------------------
describe('bcFirstTimeBuyerPttExemption', () => {
  it('returns 0 for zero price', () => {
    expect(bcFirstTimeBuyerPttExemption(0)).toBe(0);
  });

  it('provides full exemption at or below $835K', () => {
    expect(bcFirstTimeBuyerPttExemption(600_000)).toBe(calculateBcPtt(600_000));
    expect(bcFirstTimeBuyerPttExemption(835_000)).toBe(calculateBcPtt(835_000));
  });

  it('provides partial exemption between $835K and $860K', () => {
    const exemption = bcFirstTimeBuyerPttExemption(847_500);
    const fullPtt = calculateBcPtt(847_500);
    expect(exemption).toBeGreaterThan(0);
    expect(exemption).toBeLessThan(fullPtt);
    // Midpoint of phase-out: should be ~50% of full PTT
    expect(exemption).toBe(Math.round(fullPtt * 0.5));
  });

  it('provides no exemption at or above $860K', () => {
    expect(bcFirstTimeBuyerPttExemption(860_000)).toBe(0);
    expect(bcFirstTimeBuyerPttExemption(1_000_000)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// BC PTT — Newly built home exemption
// ---------------------------------------------------------------------------
describe('bcNewlyBuiltHomePttExemption', () => {
  it('returns 0 for zero price', () => {
    expect(bcNewlyBuiltHomePttExemption(0)).toBe(0);
  });

  it('provides full exemption at or below $1.1M', () => {
    expect(bcNewlyBuiltHomePttExemption(600_000)).toBe(calculateBcPtt(600_000));
    expect(bcNewlyBuiltHomePttExemption(1_100_000)).toBe(calculateBcPtt(1_100_000));
  });

  it('provides partial exemption between $1.1M and $1.15M', () => {
    const exemption = bcNewlyBuiltHomePttExemption(1_125_000);
    const fullPtt = calculateBcPtt(1_125_000);
    expect(exemption).toBeGreaterThan(0);
    expect(exemption).toBeLessThan(fullPtt);
    expect(exemption).toBe(Math.round(fullPtt * 0.5));
  });

  it('provides no exemption at or above $1.15M', () => {
    expect(bcNewlyBuiltHomePttExemption(1_150_000)).toBe(0);
    expect(bcNewlyBuiltHomePttExemption(2_000_000)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Federal GST on new builds
// ---------------------------------------------------------------------------
describe('newBuildGst', () => {
  it('returns 0 for zero price', () => {
    expect(newBuildGst(0)).toBe(0);
  });

  it('applies 5% GST', () => {
    expect(newBuildGst(600_000)).toBe(30_000);
    expect(newBuildGst(1_000_000)).toBe(50_000);
  });
});

// ---------------------------------------------------------------------------
// GST first-time buyer relief (May 2025+ rules)
// ---------------------------------------------------------------------------
describe('newBuildGstFirstTimeBuyerRelief', () => {
  it('returns 0 for zero price', () => {
    expect(newBuildGstFirstTimeBuyerRelief(0)).toBe(0);
  });

  it('provides 100% relief up to $1M', () => {
    expect(newBuildGstFirstTimeBuyerRelief(600_000)).toBe(newBuildGst(600_000));
    expect(newBuildGstFirstTimeBuyerRelief(1_000_000)).toBe(newBuildGst(1_000_000));
  });

  it('phases out linearly between $1M and $1.5M', () => {
    const relief = newBuildGstFirstTimeBuyerRelief(1_250_000);
    const gst = newBuildGst(1_250_000);
    // Midpoint: 50% of GST
    expect(relief).toBe(Math.round(gst * 0.5));
  });

  it('provides $0 relief at or above $1.5M', () => {
    expect(newBuildGstFirstTimeBuyerRelief(1_500_000)).toBe(0);
    expect(newBuildGstFirstTimeBuyerRelief(2_000_000)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computePurchaseCosts — integrated breakdown
// ---------------------------------------------------------------------------
describe('computePurchaseCosts', () => {
  const base = {
    purchasePrice: 600_000,
    downPayment: 120_000,
    cmhcPremium: 0,
    isFirstTimeHomeBuyer: true,
    isNewBuild: false,
    manualLegalFees: 1_500,
    manualInspectionFees: 500,
    manualOtherClosingCosts: 500,
  };

  it('computes base mortgage and final mortgage correctly', () => {
    const costs = computePurchaseCosts(base);
    expect(costs.baseMortgage).toBe(480_000);
    expect(costs.finalMortgage).toBe(480_000); // no CMHC
  });

  it('adds CMHC to final mortgage', () => {
    const costs = computePurchaseCosts({ ...base, cmhcPremium: 14_880 });
    expect(costs.finalMortgage).toBe(480_000 + 14_880);
  });

  it('applies FTHB PTT exemption for a $600K resale', () => {
    const costs = computePurchaseCosts(base);
    expect(costs.pttGross).toBe(10_000);
    expect(costs.pttExemption).toBe(10_000); // full exemption
    expect(costs.pttNet).toBe(0);
  });

  it('has no GST for resale (non-new-build)', () => {
    const costs = computePurchaseCosts(base);
    expect(costs.gstGross).toBe(0);
    expect(costs.gstRelief).toBe(0);
    expect(costs.gstNet).toBe(0);
  });

  it('computes GST with relief for first-time buyer new build', () => {
    const costs = computePurchaseCosts({ ...base, isNewBuild: true });
    expect(costs.gstGross).toBe(30_000);
    expect(costs.gstRelief).toBe(30_000); // 100% relief under $1M
    expect(costs.gstNet).toBe(0);
  });

  it('computes GST without relief for non-first-time buyer new build', () => {
    const costs = computePurchaseCosts({ ...base, isNewBuild: true, isFirstTimeHomeBuyer: false });
    expect(costs.gstGross).toBe(30_000);
    expect(costs.gstRelief).toBe(0);
    expect(costs.gstNet).toBe(30_000);
  });

  it('uses new-build PTT exemption when it gives a better result', () => {
    const costs = computePurchaseCosts({
      ...base,
      purchasePrice: 1_000_000,
      downPayment: 200_000,
      isNewBuild: true,
    });
    // $1M is above FTHB threshold ($860K) so FTHB exemption = 0
    // $1M is below new-build threshold ($1.1M) so full new-build exemption
    expect(costs.pttExemption).toBe(costs.pttGross);
    expect(costs.pttNet).toBe(0);
  });

  it('includes manual fees in total cash at closing', () => {
    const costs = computePurchaseCosts(base);
    expect(costs.manualFees).toBe(2_500);
    // Total = down payment + PTT net + GST net + fees = 120K + 0 + 0 + 2.5K
    expect(costs.totalCashAtClosing).toBe(120_000 + 2_500);
  });

  it('handles high-value new build with partial exemptions', () => {
    const costs = computePurchaseCosts({
      ...base,
      purchasePrice: 1_250_000,
      downPayment: 250_000,
      isNewBuild: true,
    });
    // PTT: $1.25M is above new-build threshold ($1.15M) → no exemption
    expect(costs.pttExemption).toBe(0);
    expect(costs.pttNet).toBe(costs.pttGross);
    // GST: $1.25M is in phase-out → partial relief
    expect(costs.gstRelief).toBeGreaterThan(0);
    expect(costs.gstRelief).toBeLessThan(costs.gstGross);
  });
});
