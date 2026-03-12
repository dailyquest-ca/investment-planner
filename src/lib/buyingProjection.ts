/**
 * Buying scenario projection: mortgage, HELOC (Smith Maneuver), TFSA, RRSP, non-registered, net worth.
 *
 * HELOC rules (Canada):
 * - HELOC ≤ 65% of property value AND mortgage + HELOC ≤ 80% of property value.
 * - Interest is tax-deductible only when borrowed funds are used for non-registered investments.
 * - Selling investments and using proceeds for consumption breaks deductibility on that portion.
 *
 * Strategy modeled:
 * - HELOC split into dividend bucket (never sold; dividends pay interest) and growth bucket
 *   (sold in retirement; proceeds used for living expenses).
 * - During working years: new room goes dividend-first (cover interest), rest to growth.
 * - During retirement: new room goes 100% dividend (no sense buying growth while selling it);
 *   withdrawals come only from the growth bucket.
 *
 * Income flow (working years):
 *   Gross Income → minus Income Tax (Fed+BC, after RRSP + HELOC deductions) → Net Income
 *   → minus Non-Housing Expenses → minus Housing → minus HELOC interest shortfall
 *   → TFSA (up to room) → RRSP (up to room) → Non-Registered (overflow)
 */

import {
  RRSP_FTHB_LIMIT,
  type BuyingScenarioInputs,
} from '../types/buying';
import { minimumDownPaymentForPrice } from './canadianMortgageInsurance';
import { calculateIncomeTax } from './canadianTax';
import { calculateMortgageInsurance } from './canadianMortgageInsurance';
import { calcMonthlyPayment, monthlyAmortizationSplit } from './domain/mortgage';
import { maxHelocBalance } from './domain/heloc';
import { newRrspRoom } from './domain/accounts';
import { computePurchaseCosts, type PurchaseCostBreakdown } from './bcPurchaseTaxes';

export interface ClosingCashFunding {
  totalCashNeeded: number;
  fromCashOnHand: number;
  fromFHSA: number;
  fromRRSP: number;
  fromTFSA: number;
  fromNonRegistered: number;
  shortfall: number;
}

const MONTHS_PER_YEAR = 12;

export interface BuyingYearRow {
  year: number;
  age: number;
  netWorth: number;
  propertyValue: number;
  mortgageInterestRate: number;
  monthlyPayment: number;
  yearlyPayment: number;
  monthlyTaxes: number;
  yearlyTaxes: number;
  monthlyStrata: number;
  yearlyStrata: number;
  yearlyMortgagePrinciplePaid: number;
  yearlyMortgageInterestPaid: number;
  totalMortgagePrinciplePaid: number;
  totalMortgageInterestPaid: number;
  mortgageBalance: number;
  houseEquity: number;
  helocBalance: number;
  yearlyHelocInterest: number;
  yearlyDividendIncome: number;
  grossIncome: number;
  excessDividendIncome: number;
  totalWithdrawals: number;
  incomeTax: number;
  effectiveTaxRate: number;
  netIncome: number;
  nonHousingExpenses: number;
  monthlyHousingCosts: number;
  yearlyHousingCosts: number;
  remainingForInvestment: number;
  amountNotCoveredByInvestments: number;
  tfsaContributions: number;
  tfsaContributionRoom: number;
  rrspContributions: number;
  rrspRoom: number;
  nonRegisteredContributions: number;
  helocInvestmentContributions: number;
  helocDividendContributions: number;
  helocGrowthContributions: number;
  tfsaWithdrawals: number;
  tfsaBalance: number;
  rrspWithdrawals: number;
  rrspBalance: number;
  nonRegisteredWithdrawals: number;
  nonRegisteredBalance: number;
  helocWithdrawals: number;
  helocInvestmentsBalance: number;
  helocDividendBalance: number;
  helocGrowthBalance: number;
  helocNetEquity: number;
  /** One-time CMHC mortgage insurance premium (non-zero only in the purchase year). */
  mortgageInsurancePremium: number;

  /** BC PTT paid (non-zero only in the purchase year). */
  closingPtt: number;
  /** GST on new build paid (non-zero only in the purchase year). */
  closingGst: number;
  /** Total cash needed at closing, excluding mortgage (non-zero only in the purchase year). */
  closingCashRequired: number;
  /** Final mortgage amount after CMHC premium (non-zero only in the purchase year). */
  finalMortgageAmount: number;

  /** Full purchase-cost breakdown (non-null only in the purchase year). */
  purchaseCosts: PurchaseCostBreakdown | null;
  /** How closing cash was funded (non-null only in the purchase year). */
  closingCashFunding: ClosingCashFunding | null;
}


export function runBuyingProjection(inputs: BuyingScenarioInputs): BuyingYearRow[] {
  const projectionYears = Math.max(1, inputs.lifeExpectancy - inputs.currentAge);
  const yearsUntilRetirement = Math.max(0, inputs.retirementAge - inputs.currentAge);
  const yearsUntilPurchase = Math.max(0, inputs.yearsUntilPurchase ?? 0);
  const buyingHouse = inputs.buyingHouse !== false;
  /** When rent-only, run the rent loop for the full projection; otherwise only until purchase. */
  const rentYears = buyingHouse ? yearsUntilPurchase : projectionYears;

  const startYear = new Date().getFullYear();
  const minDP = minimumDownPaymentForPrice(inputs.buyAmount);
  const downPayment = Math.max(minDP, inputs.downPaymentAmount);
  const dpPercent = inputs.buyAmount > 0 ? (downPayment / inputs.buyAmount) * 100 : 0;
  const mortgageInsurance = buyingHouse
    ? calculateMortgageInsurance(inputs.buyAmount, dpPercent, inputs.mortgageAmortizationYears, {
        isFirstTimeHomeBuyer: inputs.isFirstTimeHomeBuyer,
        isNewBuild: inputs.isNewBuild,
      })
    : null;
  const insurancePremium = mortgageInsurance?.eligible ? mortgageInsurance.premiumAmount : 0;

  const incomeGrowth = 1 + inputs.yearlyRateOfIncrease / 100;
  const expenseInflation = 1 + inputs.expenseInflationRate / 100;
  const appreciation = 1 + inputs.appreciationYoY / 100;
  const inflationTaxes = 1 + inputs.inflationTaxesYoY / 100;
  const inflationStrata = 1 + inputs.inflationStrataYoY / 100;
  const invGrowth = 1 + inputs.investmentGrowthRate / 100;
  const dividendGrowth = 1 + inputs.dividendGrowthRatePercent / 100;
  const helocRate = inputs.helocInterestRate / 100;
  const dividendYield = inputs.dividendYieldPercent / 100;
  const rentGrowth = 1 + (inputs.rentIncreasePercent ?? 4) / 100;

  const totalTfsaRoomInitial = inputs.householdTFSAContributionRoom;
  const annualTfsaRoomIncrease = inputs.annualTFSARoomIncrease;
  const retirementMonthlyNeed = inputs.monthlyMoneyNeededDuringRetirement;
  const retirementMonthlyMade = inputs.monthlyMoneyMadeDuringRetirement;
  const partTimeYears = inputs.partTimeRetirementYears;

  let grossIncome = inputs.householdGrossIncome;
  let yearlyExpenses = inputs.monthlyNonHousingExpenses * MONTHS_PER_YEAR;
  let tfsaBalance = inputs.currentTFSABalance;
  let rrspBalance = inputs.currentRRSPBalance;
  let nonRegisteredBalance = 0;
  let nonRegisteredCostBasis = 0;
  let tfsaRoomUsed = 0;
  let tfsaRoomRegained = 0;
  let pendingTfsaRegain = 0;
  let rrspRoomAvailable = inputs.currentRRSPRoom;
  let priorYearGrossIncome = grossIncome;

  let loanBalance = 0;
  let totalMonths = inputs.mortgageAmortizationYears * MONTHS_PER_YEAR;
  let mortgageRate = inputs.mortgageRateInitial;
  let payment = 0;
  let monthsRemaining = 0;
  let totalPrinciplePaid = 0;
  let totalInterestPaid = 0;
  let propertyValue = 0;
  let yearlyTaxes = 0;
  let yearlyStrata = 0;
  let helocBalance = 0;
  let helocDividendBalance = 0;
  let helocGrowthBalance = 0;
  let purchaseYearCosts: PurchaseCostBreakdown | null = null;
  let purchaseYearFunding: ClosingCashFunding | null = null;

  const growthFirstRampYears = inputs.helocGrowthFirst ? 5 : 0;
  const growthFirstCutoffYear = inputs.helocGrowthFirst
    ? Math.max(0, yearsUntilRetirement - growthFirstRampYears)
    : 0;

  const rows: BuyingYearRow[] = [];

  // --- Renting years (pre-purchase, or rent-only for full projection) ---
  if (rentYears > 0) {
    const monthlyRent = inputs.monthlyRent ?? 2000;
    for (let y = 0; y < rentYears; y++) {
      const year = startYear + y;
      const age = inputs.currentAge + y;
      const isRetired = y >= yearsUntilRetirement;
      tfsaRoomRegained += pendingTfsaRegain;
      pendingTfsaRegain = 0;
      if (y > 0) {
        rrspRoomAvailable += newRrspRoom(priorYearGrossIncome);
      }
      const yearlyRent = monthlyRent * MONTHS_PER_YEAR * Math.pow(rentGrowth, y);
      const tfsaRoomAvailable = totalTfsaRoomInitial + annualTfsaRoomIncrease * y - tfsaRoomUsed + tfsaRoomRegained;
      const retirementYearsElapsed = isRetired ? y - yearsUntilRetirement : 0;
      const hasPartTimeIncome = isRetired && retirementYearsElapsed < partTimeYears;
      const currentGrossIncome = isRetired ? (hasPartTimeIncome ? retirementMonthlyMade * MONTHS_PER_YEAR : 0) : grossIncome;
      const netInvIncome = 0;
      let incomeTax: number;
      let netIncome: number;
      let available: number;
      let totalRetirementDraw = 0;
      let tfsaContrib = 0;
      let rrspContrib = 0;
      let nonRegContrib = 0;
      if (!isRetired) {
        const conservativeTax = calculateIncomeTax(Math.max(0, currentGrossIncome + netInvIncome), inputs.numberOfIncomeEarners).totalTax;
        const conservativeNet = currentGrossIncome - conservativeTax;
        const conservativeAvailable = conservativeNet - yearlyExpenses - yearlyRent;
        if (conservativeAvailable > 0) {
          tfsaContrib = Math.min(conservativeAvailable, Math.max(0, tfsaRoomAvailable));
          tfsaRoomUsed += tfsaContrib;
          rrspContrib = Math.min(conservativeAvailable - tfsaContrib, Math.max(0, rrspRoomAvailable));
          rrspRoomAvailable -= rrspContrib;
          nonRegContrib = Math.max(0, conservativeAvailable - tfsaContrib - rrspContrib);
        }
        const actualTaxable = Math.max(0, currentGrossIncome + netInvIncome - rrspContrib);
        incomeTax = calculateIncomeTax(actualTaxable, inputs.numberOfIncomeEarners).totalTax;
        netIncome = currentGrossIncome - incomeTax;
        available = netIncome - yearlyExpenses - yearlyRent;
        const taxSaved = calculateIncomeTax(Math.max(0, currentGrossIncome + netInvIncome), inputs.numberOfIncomeEarners).totalTax - incomeTax;
        let surplus = Math.max(0, taxSaved);
        const additionalRrsp = Math.min(surplus, Math.max(0, rrspRoomAvailable));
        if (additionalRrsp > 0) {
          rrspContrib += additionalRrsp;
          rrspRoomAvailable -= additionalRrsp;
          surplus -= additionalRrsp;
          incomeTax = calculateIncomeTax(Math.max(0, currentGrossIncome + netInvIncome - rrspContrib), inputs.numberOfIncomeEarners).totalTax;
          netIncome = currentGrossIncome - incomeTax;
          available = netIncome - yearlyExpenses - yearlyRent;
        }
        nonRegContrib += Math.max(0, surplus);
      } else {
        incomeTax = calculateIncomeTax(Math.max(0, currentGrossIncome + netInvIncome), inputs.numberOfIncomeEarners).totalTax;
        netIncome = currentGrossIncome - incomeTax;
        const retireNeed = retirementMonthlyNeed * MONTHS_PER_YEAR + yearlyRent;
        const incomeAfterTax = Math.max(0, netIncome);
        totalRetirementDraw = Math.max(0, retireNeed - incomeAfterTax);
        const retireSurplus = Math.max(0, incomeAfterTax - retireNeed);
        if (retireSurplus > 0) {
          tfsaContrib = Math.min(retireSurplus, Math.max(0, tfsaRoomAvailable));
          tfsaRoomUsed += tfsaContrib;
          nonRegContrib = retireSurplus - tfsaContrib;
        }
        available = 0;
      }

      // Grow balances, then add contributions
      tfsaBalance = tfsaBalance * invGrowth + tfsaContrib;
      rrspBalance = rrspBalance * invGrowth + rrspContrib;
      nonRegisteredBalance = nonRegisteredBalance * invGrowth + nonRegContrib;
      nonRegisteredCostBasis += nonRegContrib;

      // Retirement withdrawals (two-pass: base draw then cover withdrawal tax)
      let tfsaWithdrawals = 0;
      let rrspWithdrawals = 0;
      let nonRegWithdrawals = 0;
      let amountNotCovered = 0;

      if (isRetired && totalRetirementDraw > 0) {
        const order = inputs.retirementWithdrawalOrder?.length === 4
          ? inputs.retirementWithdrawalOrder
          : (['RRSP', 'NonRegistered', 'HELOC', 'TFSA'] as const);
        let withdrawalTax = 0;

        for (let pass = 0; pass < 2; pass++) {
          const target = pass === 0 ? totalRetirementDraw : withdrawalTax;
          let needed = target;
          if (needed <= 0) continue;

          for (const account of order) {
            if (needed <= 0) break;
            if (account === 'TFSA') {
              const take = Math.min(needed, tfsaBalance);
              tfsaWithdrawals += take;
              tfsaBalance -= take;
              needed -= take;
            } else if (account === 'RRSP') {
              const take = Math.min(needed, rrspBalance);
              rrspWithdrawals += take;
              rrspBalance -= take;
              needed -= take;
            } else if (account === 'NonRegistered') {
              const take = Math.min(needed, nonRegisteredBalance);
              nonRegWithdrawals += take;
              if (nonRegisteredBalance > 0) {
                nonRegisteredCostBasis *= (nonRegisteredBalance - take) / nonRegisteredBalance;
              }
              nonRegisteredBalance -= take;
              needed -= take;
            }
            // HELOC account skipped in rent-only (no HELOC without a house)
          }

          if (pass === 1) {
            amountNotCovered = Math.max(0, needed);
          }

          if (pass === 0) {
            amountNotCovered = Math.max(0, needed);
            const nonRegGainRatio = nonRegWithdrawals > 0 && (nonRegisteredBalance + nonRegWithdrawals) > 0
              ? Math.max(0, 1 - (nonRegisteredCostBasis / (nonRegisteredBalance + nonRegWithdrawals)))
              : 0;
            const taxableCapGains = nonRegWithdrawals * nonRegGainRatio * 0.5;
            const totalTaxableFromWithdrawals = rrspWithdrawals + taxableCapGains;
            const taxableWithWithdrawals = currentGrossIncome + netInvIncome + totalTaxableFromWithdrawals;
            const taxOnAll = calculateIncomeTax(Math.max(0, taxableWithWithdrawals), inputs.numberOfIncomeEarners).totalTax;
            withdrawalTax = Math.max(0, taxOnAll - incomeTax);
            incomeTax = taxOnAll;
            netIncome = currentGrossIncome - incomeTax;
          }
        }
      }

      pendingTfsaRegain = tfsaWithdrawals;

      const totalWithdrawals = tfsaWithdrawals + rrspWithdrawals + nonRegWithdrawals;
      const totalIncome = currentGrossIncome + totalWithdrawals;
      const effectiveTaxRate = totalIncome > 0 ? (incomeTax / totalIncome) * 100 : 0;
      const netWorth = tfsaBalance + rrspBalance + nonRegisteredBalance;
      rows.push({
        year,
        age,
        netWorth,
        propertyValue: 0,
        mortgageInterestRate: 0,
        monthlyPayment: 0,
        yearlyPayment: 0,
        monthlyTaxes: 0,
        yearlyTaxes: 0,
        monthlyStrata: 0,
        yearlyStrata: 0,
        yearlyMortgagePrinciplePaid: 0,
        yearlyMortgageInterestPaid: 0,
        totalMortgagePrinciplePaid: 0,
        totalMortgageInterestPaid: 0,
        mortgageBalance: 0,
        houseEquity: 0,
        helocBalance: 0,
        yearlyHelocInterest: 0,
        yearlyDividendIncome: 0,
        grossIncome: currentGrossIncome,
        excessDividendIncome: 0,
        totalWithdrawals,
        incomeTax,
        effectiveTaxRate,
        netIncome,
        nonHousingExpenses: yearlyExpenses,
        monthlyHousingCosts: yearlyRent / MONTHS_PER_YEAR,
        yearlyHousingCosts: yearlyRent,
        remainingForInvestment: isRetired ? -totalRetirementDraw : available,
        amountNotCoveredByInvestments: amountNotCovered,
        tfsaContributions: tfsaContrib,
        tfsaContributionRoom: tfsaRoomAvailable,
        rrspContributions: rrspContrib,
        rrspRoom: rrspRoomAvailable + rrspContrib,
        nonRegisteredContributions: nonRegContrib,
        helocInvestmentContributions: 0,
        helocDividendContributions: 0,
        helocGrowthContributions: 0,
        tfsaWithdrawals,
        tfsaBalance,
        rrspWithdrawals,
        rrspBalance,
        nonRegisteredWithdrawals: nonRegWithdrawals,
        nonRegisteredBalance,
        helocWithdrawals: 0,
        helocInvestmentsBalance: 0,
        helocDividendBalance: 0,
        helocGrowthBalance: 0,
        helocNetEquity: 0,
        mortgageInsurancePremium: 0,
        closingPtt: 0,
        closingGst: 0,
        closingCashRequired: 0,
        finalMortgageAmount: 0,
        purchaseCosts: null,
        closingCashFunding: null,
      });
      priorYearGrossIncome = grossIncome;
      grossIncome *= incomeGrowth;
      yearlyExpenses *= expenseInflation;
    }
    // Purchase event only when buying and we had a pre-purchase phase
    if (buyingHouse && yearsUntilPurchase > 0) {
      purchaseYearCosts = computePurchaseCosts({
        purchasePrice: inputs.buyAmount,
        downPayment,
        cmhcPremium: insurancePremium,
        isFirstTimeHomeBuyer: inputs.isFirstTimeHomeBuyer,
        isNewBuild: inputs.isNewBuild,
        manualLegalFees: inputs.manualLegalFees,
        manualInspectionFees: inputs.manualInspectionFees,
        manualOtherClosingCosts: inputs.manualOtherClosingCosts,
      });

      purchaseYearFunding = allocateClosingCash(
        purchaseYearCosts.totalCashAtClosing,
        inputs.futurePurchaseCash,
        inputs.currentFHSABalance,
        rrspBalance,
        tfsaBalance,
        nonRegisteredBalance,
      );

      tfsaBalance -= purchaseYearFunding.fromTFSA;
      rrspBalance -= purchaseYearFunding.fromRRSP;
      if (purchaseYearFunding.fromNonRegistered > 0 && nonRegisteredBalance > 0) {
        nonRegisteredCostBasis *= (nonRegisteredBalance - purchaseYearFunding.fromNonRegistered) / nonRegisteredBalance;
        nonRegisteredBalance -= purchaseYearFunding.fromNonRegistered;
      }
      pendingTfsaRegain = purchaseYearFunding.fromTFSA;

      loanBalance = purchaseYearCosts.finalMortgage;
      totalMonths = inputs.mortgageAmortizationYears * MONTHS_PER_YEAR;
      monthsRemaining = totalMonths;
      mortgageRate = inputs.mortgageRateInitial;
      payment = calcMonthlyPayment(loanBalance, mortgageRate, totalMonths);
      propertyValue = inputs.buyAmount;
      yearlyTaxes = inputs.startingYearlyTaxes;
      yearlyStrata = inputs.startingMonthlyStrata * MONTHS_PER_YEAR;
    }
  }

  // Rent-only: no purchase or owning phase
  if (!buyingHouse) return rows;

  // Buy now (no prior rent years): unified allocation covers DP + closing costs
  if (rentYears === 0) {
    purchaseYearCosts = computePurchaseCosts({
      purchasePrice: inputs.buyAmount,
      downPayment,
      cmhcPremium: insurancePremium,
      isFirstTimeHomeBuyer: inputs.isFirstTimeHomeBuyer,
      isNewBuild: inputs.isNewBuild,
      manualLegalFees: inputs.manualLegalFees,
      manualInspectionFees: inputs.manualInspectionFees,
      manualOtherClosingCosts: inputs.manualOtherClosingCosts,
    });

    purchaseYearFunding = allocateClosingCash(
      purchaseYearCosts.totalCashAtClosing,
      inputs.futurePurchaseCash,
      inputs.currentFHSABalance,
      inputs.currentRRSPBalance,
      inputs.currentTFSABalance,
      nonRegisteredBalance,
    );

    tfsaBalance -= purchaseYearFunding.fromTFSA;
    rrspBalance -= purchaseYearFunding.fromRRSP;
    if (purchaseYearFunding.fromNonRegistered > 0 && nonRegisteredBalance > 0) {
      nonRegisteredCostBasis *= (nonRegisteredBalance - purchaseYearFunding.fromNonRegistered) / nonRegisteredBalance;
      nonRegisteredBalance -= purchaseYearFunding.fromNonRegistered;
    }
    pendingTfsaRegain = purchaseYearFunding.fromTFSA;

    loanBalance = purchaseYearCosts.finalMortgage;
    totalMonths = inputs.mortgageAmortizationYears * MONTHS_PER_YEAR;
    monthsRemaining = totalMonths;
    mortgageRate = inputs.mortgageRateInitial;
    payment = calcMonthlyPayment(loanBalance, mortgageRate, totalMonths);
    propertyValue = inputs.buyAmount;
    yearlyTaxes = inputs.startingYearlyTaxes;
    yearlyStrata = inputs.startingMonthlyStrata * MONTHS_PER_YEAR;
  }

  const yStart = yearsUntilPurchase;
  for (let y = yStart; y < projectionYears; y++) {
    const year = startYear + y;
    const age = inputs.currentAge + y;
    const isRetired = y >= yearsUntilRetirement;

    tfsaRoomRegained += pendingTfsaRegain;
    pendingTfsaRegain = 0;

    // --- RRSP room accumulation (18% of prior year income, capped) ---
    if (y > 0) {
      rrspRoomAvailable += newRrspRoom(priorYearGrossIncome);
    }

    // --- Mortgage rate change (years from purchase) ---
    if (y - yStart === inputs.mortgageRateChangeAfterYears) {
      mortgageRate = inputs.mortgageRateAfterTerm;
      payment = calcMonthlyPayment(loanBalance, mortgageRate, monthsRemaining);
    }

    // --- Mortgage amortization ---
    let yearPrinciple = 0;
    let yearInterest = 0;
    for (let m = 0; m < MONTHS_PER_YEAR; m++) {
      if (loanBalance <= 0) break;
      const split = monthlyAmortizationSplit(loanBalance, mortgageRate, payment);
      yearInterest += split.interest;
      yearPrinciple += split.principal;
      loanBalance = split.newBalance;
      monthsRemaining--;
    }
    if (loanBalance <= 0) payment = 0;

    totalPrinciplePaid += yearPrinciple;
    totalInterestPaid += yearInterest;

    const yearlyPaymentAmt = yearPrinciple + yearInterest;
    const monthlyHousing = (yearlyPaymentAmt + yearlyTaxes + yearlyStrata) / MONTHS_PER_YEAR;
    const yearlyHousing = monthlyHousing * MONTHS_PER_YEAR;

    // --- Dividend income (from start-of-year dividend balance) ---
    const yearlyDividendIncome = dividendYield * helocDividendBalance;

    // --- HELOC: borrow up to cap ---
    const maxHeloc = maxHelocBalance(propertyValue, loanBalance);
    const helocRoom = Math.max(0, maxHeloc - helocBalance);

    // Allocate new HELOC room: dividend first (cover interest + TFSA), rest to growth
    const tfsaRoomAvailable = totalTfsaRoomInitial + annualTfsaRoomIncrease * y - tfsaRoomUsed + tfsaRoomRegained;

    let helocDividendContrib = 0;
    let helocGrowthContrib = 0;
    let growthToDividendConversion = 0;
    if (helocRoom > 0) {
      if (isRetired) {
        helocDividendContrib = helocRoom;
        helocGrowthContrib = 0;
      } else if (inputs.helocGrowthFirst && y < growthFirstCutoffYear) {
        helocDividendContrib = 0;
        helocGrowthContrib = helocRoom;
      } else {
        // Dividend-first: fill dividend bucket to cover interest + housing + expenses + TFSA
        const divBalAfterGrowth = helocDividendBalance * dividendGrowth;
        const totalHelocAfter = helocBalance + helocRoom;
        const interestNeeded = helocRate * totalHelocAfter;
        const retirementExpenses = retirementMonthlyNeed * MONTHS_PER_YEAR;
        const yearsToRetirement = Math.max(1, yearsUntilRetirement - y);
        const estRetirementHousing = yearlyHousing * Math.pow(inflationStrata, yearsToRetirement);
        const tfsaTarget = Math.max(0, tfsaRoomAvailable);
        const totalTarget = interestNeeded + estRetirementHousing + retirementExpenses + tfsaTarget;
        const dividendCoverage = dividendYield * divBalAfterGrowth;
        const shortfall = totalTarget - dividendCoverage;
        const minDividendNeeded = dividendYield > 0 ? Math.max(0, shortfall / dividendYield) : helocRoom;
        helocDividendContrib = Math.min(helocRoom, minDividendNeeded);
        helocGrowthContrib = helocRoom - helocDividendContrib;
      }
    }

    // Growth-first ramp: sell growth stocks → buy dividend stocks.
    // HELOC money must stay invested, so conversion keeps the loan intact.
    // Target: dividends cover interest + housing + non-housing expenses + TFSA room.
    if (inputs.helocGrowthFirst && !isRetired && y >= growthFirstCutoffYear && helocGrowthBalance > 0 && dividendYield > 0) {
      const totalHelocAfter = helocBalance + helocRoom;
      const interestNeeded = helocRate * totalHelocAfter;
      const yearsToRetirement = Math.max(1, yearsUntilRetirement - y);
      const retirementHousing = yearlyHousing * Math.pow(inflationStrata, yearsToRetirement);
      const retirementExpenses = retirementMonthlyNeed * MONTHS_PER_YEAR;
      const tfsaTarget = Math.max(0, tfsaRoomAvailable);
      const totalCoverageTarget = interestNeeded + retirementHousing + retirementExpenses + tfsaTarget;

      const currentDivBal = helocDividendBalance * dividendGrowth + helocDividendContrib;
      const projectedDivBal = currentDivBal * Math.pow(dividendGrowth, yearsToRetirement);
      const projectedCoverage = dividendYield * projectedDivBal;
      const shortfall = totalCoverageTarget - projectedCoverage;
      if (shortfall > 0) {
        const neededDivBal = shortfall / dividendYield;
        const rampYearsLeft = Math.max(1, yearsToRetirement);
        const yearlyConversion = Math.max(neededDivBal, helocGrowthBalance / rampYearsLeft);
        growthToDividendConversion = Math.min(helocGrowthBalance, yearlyConversion);
      }
    }

    helocBalance += helocRoom;
    const yearlyHelocInterest = helocBalance * helocRate;

    const helocInterestFromCash = Math.max(0, yearlyHelocInterest - yearlyDividendIncome);
    const excessDividends = Math.max(0, yearlyDividendIncome - yearlyHelocInterest);

    // --- Income & tax ---
    const retirementYearsElapsed = isRetired ? y - yearsUntilRetirement : 0;
    const hasPartTimeIncome = isRetired && retirementYearsElapsed < partTimeYears;
    const retirementGrossIncome = hasPartTimeIncome ? retirementMonthlyMade * MONTHS_PER_YEAR : 0;
    const currentGrossIncome = isRetired ? retirementGrossIncome : grossIncome;

    // Dividends are taxable income; HELOC interest is deductible. Net effect:
    //   positive → excess dividends taxed as income
    //   negative → net deduction reduces other income
    const netInvestmentIncome = yearlyDividendIncome - yearlyHelocInterest;

    const retirementNonHousingExpenses = retirementMonthlyNeed * MONTHS_PER_YEAR;

    let incomeTax: number;
    let netIncome: number;
    let available: number;
    let tfsaContrib = 0;
    let rrspContrib = 0;
    let nonRegContrib = 0;
    let totalRetirementDraw = 0;

    if (!isRetired) {
      // Pass 1: conservative tax (no RRSP deduction) to find safe available cash
      const conservativeTaxableIncome = Math.max(0, currentGrossIncome + netInvestmentIncome);
      const conservativeTax = calculateIncomeTax(conservativeTaxableIncome, inputs.numberOfIncomeEarners).totalTax;
      const conservativeNet = currentGrossIncome - conservativeTax;
      const conservativeAvailable = conservativeNet - yearlyExpenses - yearlyHousing - helocInterestFromCash + excessDividends;

      if (conservativeAvailable > 0) {
        tfsaContrib = Math.min(conservativeAvailable, Math.max(0, tfsaRoomAvailable));
        tfsaRoomUsed += tfsaContrib;
        const afterTfsa = conservativeAvailable - tfsaContrib;

        rrspContrib = Math.min(afterTfsa, Math.max(0, rrspRoomAvailable));
        rrspRoomAvailable -= rrspContrib;
        const afterRrsp = afterTfsa - rrspContrib;

        nonRegContrib = Math.max(0, afterRrsp);
      }

      // Pass 2: actual tax with real RRSP deduction
      const actualTaxableIncome = Math.max(0, currentGrossIncome + netInvestmentIncome - rrspContrib);
      incomeTax = calculateIncomeTax(actualTaxableIncome, inputs.numberOfIncomeEarners).totalTax;
      netIncome = currentGrossIncome - incomeTax;
      available = netIncome - yearlyExpenses - yearlyHousing - helocInterestFromCash + excessDividends;

      // Tax savings from RRSP deduction → additional RRSP, then non-registered
      const taxSaved = conservativeTax - incomeTax;
      let surplus = Math.max(0, taxSaved);
      const additionalRrsp = Math.min(surplus, Math.max(0, rrspRoomAvailable));
      if (additionalRrsp > 0) {
        rrspContrib += additionalRrsp;
        rrspRoomAvailable -= additionalRrsp;
        surplus -= additionalRrsp;
        const finalTaxableIncome = Math.max(0, currentGrossIncome + netInvestmentIncome - rrspContrib);
        incomeTax = calculateIncomeTax(finalTaxableIncome, inputs.numberOfIncomeEarners).totalTax;
        netIncome = currentGrossIncome - incomeTax;
        available = netIncome - yearlyExpenses - yearlyHousing - helocInterestFromCash + excessDividends;
        surplus = Math.max(0, conservativeTax - incomeTax - (tfsaContrib + rrspContrib + nonRegContrib - conservativeAvailable));
      }
      nonRegContrib += Math.max(0, surplus);
    } else {
      // Retirement: tax on part-time income + net investment income
      const retireTaxableIncome = Math.max(0, currentGrossIncome + netInvestmentIncome);
      incomeTax = calculateIncomeTax(retireTaxableIncome, inputs.numberOfIncomeEarners).totalTax;
      netIncome = currentGrossIncome - incomeTax;

      // Priority: dividends cover interest → housing → expenses → TFSA
      const expenseNeed = retirementNonHousingExpenses + yearlyHousing + helocInterestFromCash;
      const incomeAfterTax = Math.max(0, netIncome) + excessDividends;
      totalRetirementDraw = Math.max(0, expenseNeed - incomeAfterTax);

      // Only contribute to TFSA from surplus if no withdrawals needed.
      // Withdrawing from taxable accounts just to fund TFSA is inefficient.
      const retireSurplus = Math.max(0, incomeAfterTax - expenseNeed);
      if (retireSurplus > 0 && totalRetirementDraw <= 0) {
        tfsaContrib = Math.min(retireSurplus, Math.max(0, tfsaRoomAvailable));
        tfsaRoomUsed += tfsaContrib;
        nonRegContrib = retireSurplus - tfsaContrib;
      } else if (retireSurplus > 0) {
        nonRegContrib = retireSurplus;
      }
      available = 0;
    }

    const remainingForInvestmentDisplay = isRetired
      ? -totalRetirementDraw
      : available;

    // --- Grow balances, then add contributions ---
    helocGrowthBalance = helocGrowthBalance * invGrowth + helocGrowthContrib;
    // Growth-first ramp: sell growth → buy dividend (HELOC money stays invested)
    const actualConversion = Math.min(growthToDividendConversion, helocGrowthBalance);
    helocGrowthBalance -= actualConversion;
    helocDividendBalance = helocDividendBalance * dividendGrowth + helocDividendContrib + actualConversion;
    tfsaBalance = tfsaBalance * invGrowth + tfsaContrib;
    rrspBalance = rrspBalance * invGrowth + rrspContrib;
    nonRegisteredBalance = nonRegisteredBalance * invGrowth + nonRegContrib;
    nonRegisteredCostBasis += nonRegContrib;

    // --- Retirement withdrawals (two-pass: base draw then cover withdrawal tax) ---
    let tfsaWithdrawals = 0;
    let rrspWithdrawals = 0;
    let helocWithdrawals = 0;
    let nonRegWithdrawals = 0;
    let amountNotCovered = 0;
    let withdrawalTax = 0;

    if (isRetired && totalRetirementDraw > 0) {
      const order = inputs.retirementWithdrawalOrder?.length === 4
        ? inputs.retirementWithdrawalOrder
        : (['RRSP', 'NonRegistered', 'HELOC', 'TFSA'] as const);

      // Two passes: first covers the base need, second covers tax on taxable withdrawals
      for (let pass = 0; pass < 2; pass++) {
        const target = pass === 0 ? totalRetirementDraw : withdrawalTax;
        let needed = target;
        if (needed <= 0) continue;

        for (const account of order) {
          if (needed <= 0) break;
          if (account === 'TFSA') {
            const take = Math.min(needed, tfsaBalance);
            tfsaWithdrawals += take;
            tfsaBalance -= take;
            needed -= take;
          } else if (account === 'RRSP') {
            const take = Math.min(needed, rrspBalance);
            rrspWithdrawals += take;
            rrspBalance -= take;
            needed -= take;
          } else if (account === 'NonRegistered') {
            const take = Math.min(needed, nonRegisteredBalance);
            nonRegWithdrawals += take;
            if (nonRegisteredBalance > 0) {
              nonRegisteredCostBasis *= (nonRegisteredBalance - take) / nonRegisteredBalance;
            }
            nonRegisteredBalance -= take;
            needed -= take;
          } else {
            const take = Math.min(needed, helocGrowthBalance);
            helocWithdrawals += take;
            helocGrowthBalance -= take;
            needed -= take;
          }
        }
        if (pass === 1) {
          amountNotCovered = Math.max(0, needed);
        }

        // After pass 0, compute tax on taxable withdrawals for pass 1
        if (pass === 0) {
          amountNotCovered = Math.max(0, needed);
          // RRSP withdrawals are fully taxable income
          // Non-reg & HELOC growth: capital gains at 50% inclusion
          const nonRegGainRatio = nonRegWithdrawals > 0 && (nonRegisteredBalance + nonRegWithdrawals) > 0
            ? Math.max(0, 1 - (nonRegisteredCostBasis / (nonRegisteredBalance + nonRegWithdrawals)))
            : 0;
          const taxableCapGains = (nonRegWithdrawals * nonRegGainRatio + helocWithdrawals) * 0.5;
          const totalTaxableFromWithdrawals = rrspWithdrawals + taxableCapGains;
          const taxableWithWithdrawals = currentGrossIncome + netInvestmentIncome + totalTaxableFromWithdrawals;
          const taxOnAll = calculateIncomeTax(Math.max(0, taxableWithWithdrawals), inputs.numberOfIncomeEarners).totalTax;
          withdrawalTax = Math.max(0, taxOnAll - incomeTax);
          incomeTax = taxOnAll;
          netIncome = currentGrossIncome - incomeTax;
        }
      }
    }

    pendingTfsaRegain = tfsaWithdrawals;

    // --- Net worth (raw balances; tax only applied when actually withdrawn) ---
    const helocInvestmentsBalance = helocDividendBalance + helocGrowthBalance;
    const helocNetEquity = helocInvestmentsBalance - helocBalance;
    const houseEquity = propertyValue - loanBalance;
    const netWorth = houseEquity + tfsaBalance + rrspBalance + nonRegisteredBalance + helocNetEquity;

    rows.push({
      year,
      age,
      netWorth,
      propertyValue,
      mortgageInterestRate: mortgageRate,
      monthlyPayment: payment,
      yearlyPayment: yearlyPaymentAmt,
      monthlyTaxes: yearlyTaxes / MONTHS_PER_YEAR,
      yearlyTaxes,
      monthlyStrata: yearlyStrata / MONTHS_PER_YEAR,
      yearlyStrata,
      yearlyMortgagePrinciplePaid: yearPrinciple,
      yearlyMortgageInterestPaid: yearInterest,
      totalMortgagePrinciplePaid: totalPrinciplePaid,
      totalMortgageInterestPaid: totalInterestPaid,
      mortgageBalance: loanBalance,
      houseEquity,
      helocBalance,
      yearlyHelocInterest,
      yearlyDividendIncome,
      grossIncome: currentGrossIncome,
      excessDividendIncome: excessDividends,
      totalWithdrawals: tfsaWithdrawals + rrspWithdrawals + nonRegWithdrawals + helocWithdrawals,
      incomeTax,
      effectiveTaxRate: (() => {
        const totalIncome = currentGrossIncome + excessDividends + tfsaWithdrawals + rrspWithdrawals + nonRegWithdrawals + helocWithdrawals;
        return totalIncome > 0 ? (incomeTax / totalIncome) * 100 : 0;
      })(),
      netIncome,
      nonHousingExpenses: yearlyExpenses,
      monthlyHousingCosts: monthlyHousing,
      yearlyHousingCosts: yearlyHousing,
      remainingForInvestment: remainingForInvestmentDisplay,
      amountNotCoveredByInvestments: amountNotCovered,
      tfsaContributions: tfsaContrib,
      tfsaContributionRoom: tfsaRoomAvailable,
      rrspContributions: rrspContrib,
      rrspRoom: rrspRoomAvailable + rrspContrib,
      nonRegisteredContributions: nonRegContrib,
      helocInvestmentContributions: helocDividendContrib + helocGrowthContrib,
      helocDividendContributions: helocDividendContrib,
      helocGrowthContributions: helocGrowthContrib,
      tfsaWithdrawals,
      tfsaBalance,
      rrspWithdrawals,
      rrspBalance,
      nonRegisteredWithdrawals: nonRegWithdrawals,
      nonRegisteredBalance,
      helocWithdrawals,
      helocInvestmentsBalance,
      helocDividendBalance,
      helocGrowthBalance,
      helocNetEquity,
      mortgageInsurancePremium: y === yStart ? insurancePremium : 0,
      closingPtt: y === yStart && purchaseYearCosts ? purchaseYearCosts.pttNet : 0,
      closingGst: y === yStart && purchaseYearCosts ? purchaseYearCosts.gstNet : 0,
      closingCashRequired: y === yStart && purchaseYearCosts ? purchaseYearCosts.totalCashAtClosing : 0,
      finalMortgageAmount: y === yStart && purchaseYearCosts ? purchaseYearCosts.finalMortgage : 0,
      purchaseCosts: y === yStart ? purchaseYearCosts : null,
      closingCashFunding: y === yStart ? purchaseYearFunding : null,
    });

    if (y === yStart) {
      purchaseYearCosts = null;
      purchaseYearFunding = null;
    }

    // --- End-of-year escalation ---
    priorYearGrossIncome = grossIncome;
    propertyValue *= appreciation;
    yearlyTaxes *= inflationTaxes;
    yearlyStrata *= inflationStrata;
    grossIncome *= incomeGrowth;
    yearlyExpenses *= expenseInflation;
  }

  return rows;
}

/**
 * Allocate the full cash needed at closing (DP + PTT + GST + manual fees) from
 * available sources in priority order.
 *
 * Order: Cash on hand -> FHSA -> RRSP (capped at HBP limit) -> TFSA -> Non-Registered.
 */
export function allocateClosingCash(
  totalCashNeeded: number,
  cashOnHand: number,
  fhsaBalance: number,
  rrspBalance: number,
  tfsaBalance: number,
  nonRegisteredBalance: number,
): ClosingCashFunding {
  let remaining = totalCashNeeded;

  const fromCashOnHand = Math.min(remaining, Math.max(0, cashOnHand));
  remaining -= fromCashOnHand;

  const fromFHSA = Math.min(remaining, Math.max(0, fhsaBalance));
  remaining -= fromFHSA;

  const fromRRSP = Math.min(remaining, RRSP_FTHB_LIMIT, Math.max(0, rrspBalance));
  remaining -= fromRRSP;

  const fromTFSA = Math.min(remaining, Math.max(0, tfsaBalance));
  remaining -= fromTFSA;

  const fromNonRegistered = Math.min(remaining, Math.max(0, nonRegisteredBalance));
  remaining -= fromNonRegistered;

  return {
    totalCashNeeded,
    fromCashOnHand,
    fromFHSA,
    fromRRSP,
    fromTFSA,
    fromNonRegistered,
    shortfall: Math.max(0, remaining),
  };
}

/**
 * Compute account balances at the time of purchase so the UI can determine
 * slider max (all available funds). For buy-now (yearsUntilPurchase === 0)
 * this returns initial balances directly.
 */
export function purchaseTimeBalances(inputs: BuyingScenarioInputs): {
  fhsa: number;
  rrsp: number;
  tfsa: number;
  nonRegistered: number;
} {
  const yup = Math.max(0, inputs.yearsUntilPurchase ?? 0);
  if (yup === 0) {
    return {
      fhsa: inputs.currentFHSABalance,
      rrsp: inputs.currentRRSPBalance,
      tfsa: inputs.currentTFSABalance,
      nonRegistered: 0,
    };
  }

  // Run a lightweight forward simulation of the rent years to get balances at purchase
  const invGrowth = 1 + inputs.investmentGrowthRate / 100;
  const incomeGrowth = 1 + inputs.yearlyRateOfIncrease / 100;
  const expenseInflation = 1 + inputs.expenseInflationRate / 100;
  const rentGrowth = 1 + (inputs.rentIncreasePercent ?? 4) / 100;

  let grossIncome = inputs.householdGrossIncome;
  let yearlyExpenses = inputs.monthlyNonHousingExpenses * MONTHS_PER_YEAR;
  let tfsaBalance = inputs.currentTFSABalance;
  let rrspBalance = inputs.currentRRSPBalance;
  let nonRegisteredBalance = 0;
  let tfsaRoomUsed = 0;
  let rrspRoomAvailable = inputs.currentRRSPRoom;
  let priorYearGrossIncome = grossIncome;

  for (let y = 0; y < yup; y++) {
    if (y > 0) {
      rrspRoomAvailable += newRrspRoom(priorYearGrossIncome);
    }
    const yearlyRent = (inputs.monthlyRent ?? 2000) * MONTHS_PER_YEAR * Math.pow(rentGrowth, y);
    const tfsaRoomAvailable = inputs.householdTFSAContributionRoom + inputs.annualTFSARoomIncrease * y - tfsaRoomUsed;
    const conservativeTax = calculateIncomeTax(Math.max(0, grossIncome), inputs.numberOfIncomeEarners).totalTax;
    const conservativeNet = grossIncome - conservativeTax;
    const available = conservativeNet - yearlyExpenses - yearlyRent;

    let tfsaContrib = 0;
    let rrspContrib = 0;
    let nonRegContrib = 0;
    if (available > 0) {
      tfsaContrib = Math.min(available, Math.max(0, tfsaRoomAvailable));
      tfsaRoomUsed += tfsaContrib;
      rrspContrib = Math.min(available - tfsaContrib, Math.max(0, rrspRoomAvailable));
      rrspRoomAvailable -= rrspContrib;
      nonRegContrib = Math.max(0, available - tfsaContrib - rrspContrib);
    }

    tfsaBalance = tfsaBalance * invGrowth + tfsaContrib;
    rrspBalance = rrspBalance * invGrowth + rrspContrib;
    nonRegisteredBalance = nonRegisteredBalance * invGrowth + nonRegContrib;

    priorYearGrossIncome = grossIncome;
    grossIncome *= incomeGrowth;
    yearlyExpenses *= expenseInflation;
  }

  return {
    fhsa: inputs.currentFHSABalance,
    rrsp: rrspBalance,
    tfsa: tfsaBalance,
    nonRegistered: nonRegisteredBalance,
  };
}
