import { describe, it, expect } from 'vitest';
import { allocateClosingCash, runBuyingProjection } from '../buyingProjection';
import { DEFAULT_BUYING_INPUTS, type BuyingScenarioInputs } from '../../types/buying';

// ---------------------------------------------------------------------------
// allocateClosingCash — unified waterfall (cash on hand -> FHSA -> RRSP -> TFSA -> non-reg)
// ---------------------------------------------------------------------------
describe('allocateClosingCash', () => {
  it('uses cash on hand first', () => {
    const f = allocateClosingCash(5_000, 10_000, 0, 0, 50_000, 50_000);
    expect(f.fromCashOnHand).toBe(5_000);
    expect(f.fromTFSA).toBe(0);
    expect(f.fromNonRegistered).toBe(0);
    expect(f.shortfall).toBe(0);
  });

  it('falls back to accounts when cash on hand is insufficient', () => {
    const f = allocateClosingCash(10_000, 3_000, 0, 0, 20_000, 20_000);
    expect(f.fromCashOnHand).toBe(3_000);
    expect(f.fromTFSA).toBe(7_000);
    expect(f.shortfall).toBe(0);
  });

  it('reports shortfall when all sources are insufficient', () => {
    const f = allocateClosingCash(100_000, 1_000, 0, 5_000, 2_000, 3_000);
    expect(f.fromCashOnHand).toBe(1_000);
    expect(f.fromRRSP).toBe(5_000);
    expect(f.fromTFSA).toBe(2_000);
    expect(f.fromNonRegistered).toBe(3_000);
    expect(f.shortfall).toBe(100_000 - 1_000 - 5_000 - 2_000 - 3_000);
  });

  it('caps RRSP at HBP limit', () => {
    // Need $200K, cash=0, FHSA=0, RRSP=$200K, TFSA=$200K
    const f = allocateClosingCash(200_000, 0, 0, 200_000, 200_000, 0);
    expect(f.fromRRSP).toBe(60_000); // HBP limit
    expect(f.fromTFSA).toBe(140_000);
    expect(f.shortfall).toBe(0);
  });

  it('uses FHSA before RRSP', () => {
    const f = allocateClosingCash(50_000, 0, 20_000, 100_000, 100_000, 0);
    expect(f.fromFHSA).toBe(20_000);
    expect(f.fromRRSP).toBe(30_000);
    expect(f.fromTFSA).toBe(0);
    expect(f.shortfall).toBe(0);
  });

  it('handles zero cash needed', () => {
    const f = allocateClosingCash(0, 5_000, 0, 0, 10_000, 10_000);
    expect(f.totalCashNeeded).toBe(0);
    expect(f.fromCashOnHand).toBe(0);
    expect(f.shortfall).toBe(0);
  });

  it('cash on hand covers full amount including down payment portion', () => {
    // Total $130K needed, cash on hand = $130K — everything from cash
    const f = allocateClosingCash(130_000, 130_000, 10_000, 50_000, 50_000, 0);
    expect(f.fromCashOnHand).toBe(130_000);
    expect(f.fromFHSA).toBe(0);
    expect(f.fromRRSP).toBe(0);
    expect(f.fromTFSA).toBe(0);
    expect(f.shortfall).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Projection integration: closing costs flow through purchase year
// ---------------------------------------------------------------------------
describe('projection closing costs', () => {
  const baseInputs: BuyingScenarioInputs = {
    ...DEFAULT_BUYING_INPUTS,
    buyingHouse: true,
    yearsUntilPurchase: 0,
    buyAmount: 600_000,
    downPaymentAmount: 120_000,
    isFirstTimeHomeBuyer: true,
    isNewBuild: false,
    futurePurchaseCash: 5_000,
    manualLegalFees: 1_500,
    manualInspectionFees: 500,
    manualOtherClosingCosts: 500,
  };

  it('attaches purchase costs to the first row when buying now', () => {
    const rows = runBuyingProjection(baseInputs);
    const first = rows[0];
    expect(first.purchaseCosts).not.toBeNull();
    expect(first.closingCashFunding).not.toBeNull();
    expect(first.purchaseCosts!.purchasePrice).toBe(600_000);
    expect(first.purchaseCosts!.downPayment).toBe(120_000);
    expect(first.purchaseCosts!.finalMortgage).toBe(480_000);
  });

  it('has null purchase costs on non-purchase years', () => {
    const rows = runBuyingProjection(baseInputs);
    expect(rows[1].purchaseCosts).toBeNull();
    expect(rows[1].closingCashFunding).toBeNull();
  });

  it('CMHC premium is added to mortgage, not to closing cash', () => {
    const rows = runBuyingProjection({
      ...baseInputs,
      downPaymentAmount: 30_000,
    });
    const first = rows[0];
    expect(first.purchaseCosts).not.toBeNull();
    expect(first.mortgageInsurancePremium).toBeGreaterThan(0);
    expect(first.purchaseCosts!.cmhcPremium).toBe(first.mortgageInsurancePremium);
    expect(first.purchaseCosts!.finalMortgage).toBe(
      first.purchaseCosts!.baseMortgage + first.purchaseCosts!.cmhcPremium
    );
  });

  it('FTHB gets full PTT exemption for $600K resale', () => {
    const rows = runBuyingProjection(baseInputs);
    expect(rows[0].closingPtt).toBe(0);
    expect(rows[0].purchaseCosts!.pttExemption).toBe(rows[0].purchaseCosts!.pttGross);
  });

  it('non-FTHB pays full PTT on an $860K+ resale', () => {
    const rows = runBuyingProjection({
      ...baseInputs,
      buyAmount: 900_000,
      downPaymentAmount: 180_000,
      isFirstTimeHomeBuyer: false,
    });
    const pttNet = rows[0].closingPtt;
    expect(pttNet).toBeGreaterThan(0);
    expect(rows[0].purchaseCosts!.pttExemption).toBe(0);
  });

  it('new-build FTHB gets GST relief for home under $1M', () => {
    const rows = runBuyingProjection({
      ...baseInputs,
      isNewBuild: true,
    });
    expect(rows[0].closingGst).toBe(0);
    expect(rows[0].purchaseCosts!.gstRelief).toBe(rows[0].purchaseCosts!.gstGross);
  });

  it('new-build non-FTHB pays full GST', () => {
    const rows = runBuyingProjection({
      ...baseInputs,
      isNewBuild: true,
      isFirstTimeHomeBuyer: false,
    });
    expect(rows[0].closingGst).toBe(30_000);
    expect(rows[0].purchaseCosts!.gstRelief).toBe(0);
  });

  it('cash on hand is consumed first for total cash at closing', () => {
    const rows = runBuyingProjection(baseInputs);
    const funding = rows[0].closingCashFunding!;
    // totalCashNeeded = DP + PTT(0, FTHB exemption) + GST(0, resale) + manualFees
    const manualFees = baseInputs.manualLegalFees + baseInputs.manualInspectionFees + baseInputs.manualOtherClosingCosts;
    expect(funding.totalCashNeeded).toBe(baseInputs.downPaymentAmount + manualFees);
    expect(funding.fromCashOnHand).toBe(baseInputs.futurePurchaseCash);
  });

  it('closing cash fields are zero for rent-only simulation', () => {
    const rows = runBuyingProjection({
      ...baseInputs,
      buyingHouse: false,
    });
    for (const row of rows) {
      expect(row.closingPtt).toBe(0);
      expect(row.closingGst).toBe(0);
      expect(row.closingCashRequired).toBe(0);
      expect(row.purchaseCosts).toBeNull();
    }
  });

  it('attaches purchase costs when buying in the future', () => {
    const rows = runBuyingProjection({
      ...baseInputs,
      yearsUntilPurchase: 3,
    });
    // First 3 rows are rent years
    for (let i = 0; i < 3; i++) {
      expect(rows[i].purchaseCosts).toBeNull();
    }
    // 4th row is the purchase year
    expect(rows[3].purchaseCosts).not.toBeNull();
    expect(rows[3].purchaseCosts!.purchasePrice).toBe(600_000);
  });

  it('down payment and closing costs do not double-spend the same funds', () => {
    const inputs: BuyingScenarioInputs = {
      ...baseInputs,
      buyAmount: 900_000,
      downPaymentAmount: 180_000,
      isFirstTimeHomeBuyer: false,
      isNewBuild: true,
      futurePurchaseCash: 0,
      currentTFSABalance: 100_000,
      currentRRSPBalance: 0,
      currentFHSABalance: 0,
    };
    const rows = runBuyingProjection(inputs);
    const first = rows[0];
    // TFSA should fund both DP and closing costs, but should not go negative
    expect(first.tfsaBalance).toBeGreaterThanOrEqual(0);
  });
});
