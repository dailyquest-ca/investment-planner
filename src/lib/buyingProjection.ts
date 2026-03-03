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
  getDownPaymentAllocation,
  getDownPaymentAllocationFromBalances,
  RRSP_ANNUAL_MAX,
  type BuyingScenarioInputs,
} from '../types/buying';
import { calculateIncomeTax } from './canadianTax';

const MONTHS_PER_YEAR = 12;

/** HELOC cap: (1) mortgage + HELOC ≤ 80% of property value; (2) HELOC ≤ 65% of property value. */
function maxHelocBalance(propertyValue: number, mortgageBalance: number): number {
  const cap80LTV = Math.max(0, 0.8 * propertyValue - mortgageBalance);
  const cap65Property = 0.65 * propertyValue;
  return Math.min(cap80LTV, cap65Property);
}

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
}

function calcMonthlyPayment(principal: number, annualRatePercent: number, remainingMonths: number): number {
  if (remainingMonths <= 0 || principal <= 0) return 0;
  const r = (annualRatePercent / 100) / MONTHS_PER_YEAR;
  if (r === 0) return principal / remainingMonths;
  return (principal * r * Math.pow(1 + r, remainingMonths)) / (Math.pow(1 + r, remainingMonths) - 1);
}

export function runBuyingProjection(inputs: BuyingScenarioInputs): BuyingYearRow[] {
  const projectionYears = Math.max(1, inputs.lifeExpectancy - inputs.currentAge);
  const yearsUntilRetirement = Math.max(0, inputs.retirementAge - inputs.currentAge);
  const yearsUntilPurchase = Math.max(0, inputs.yearsUntilPurchase ?? 0);

  const startYear = new Date().getFullYear();
  const downPayment = (inputs.buyAmount * inputs.percentageDownpayment) / 100;

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

  const growthFirstRampYears = inputs.helocGrowthFirst ? 3 : 0;
  const growthFirstCutoffYear = inputs.helocGrowthFirst
    ? Math.max(0, yearsUntilRetirement - growthFirstRampYears)
    : 0;

  const rows: BuyingYearRow[] = [];

  // --- Pre-purchase (renting) years ---
  if (yearsUntilPurchase > 0) {
    const monthlyRent = inputs.monthlyRent ?? 2000;
    for (let y = 0; y < yearsUntilPurchase; y++) {
      const year = startYear + y;
      const age = inputs.currentAge + y;
      const isRetired = y >= yearsUntilRetirement;
      tfsaRoomRegained += pendingTfsaRegain;
      pendingTfsaRegain = 0;
      if (y > 0) {
        rrspRoomAvailable += Math.min(0.18 * priorYearGrossIncome, RRSP_ANNUAL_MAX);
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
        const surplus = incomeAfterTax - retireNeed;
        if (surplus > 0) {
          tfsaContrib = Math.min(surplus, Math.max(0, tfsaRoomAvailable));
          tfsaRoomUsed += tfsaContrib;
          nonRegContrib = surplus - tfsaContrib;
        }
        available = 0;
      }
      tfsaBalance = tfsaBalance * invGrowth + tfsaContrib;
      rrspBalance = rrspBalance * invGrowth + rrspContrib;
      nonRegisteredBalance = nonRegisteredBalance * invGrowth + nonRegContrib;
      nonRegisteredCostBasis += nonRegContrib;
      const totalIncome = currentGrossIncome;
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
        totalWithdrawals: 0,
        incomeTax,
        effectiveTaxRate,
        netIncome,
        nonHousingExpenses: yearlyExpenses,
        monthlyHousingCosts: yearlyRent / MONTHS_PER_YEAR,
        yearlyHousingCosts: yearlyRent,
        remainingForInvestment: available,
        amountNotCoveredByInvestments: 0,
        tfsaContributions: tfsaContrib,
        tfsaContributionRoom: tfsaRoomAvailable,
        rrspContributions: rrspContrib,
        rrspRoom: rrspRoomAvailable + rrspContrib,
        nonRegisteredContributions: nonRegContrib,
        helocInvestmentContributions: 0,
        helocDividendContributions: 0,
        helocGrowthContributions: 0,
        tfsaWithdrawals: 0,
        tfsaBalance,
        rrspWithdrawals: 0,
        rrspBalance,
        nonRegisteredWithdrawals: 0,
        nonRegisteredBalance,
        helocWithdrawals: 0,
        helocInvestmentsBalance: 0,
        helocDividendBalance: 0,
        helocGrowthBalance: 0,
        helocNetEquity: 0,
      });
      priorYearGrossIncome = grossIncome;
      grossIncome *= incomeGrowth;
      yearlyExpenses *= expenseInflation;
    }
    const { amountFromRRSP, amountFromTFSA } = getDownPaymentAllocationFromBalances(
      downPayment,
      inputs.currentFHSABalance,
      rrspBalance,
      tfsaBalance,
    );
    tfsaBalance -= amountFromTFSA;
    rrspBalance -= amountFromRRSP;
    pendingTfsaRegain = amountFromTFSA;
    loanBalance = inputs.buyAmount - downPayment;
    totalMonths = inputs.mortgageAmortizationYears * MONTHS_PER_YEAR;
    monthsRemaining = totalMonths;
    mortgageRate = inputs.mortgageRateInitial;
    payment = calcMonthlyPayment(loanBalance, mortgageRate, totalMonths);
    propertyValue = inputs.buyAmount;
    yearlyTaxes = inputs.startingYearlyTaxes;
    yearlyStrata = inputs.startingMonthlyStrata * MONTHS_PER_YEAR;
  } else {
    const { amountFromRRSP, amountFromTFSA } = getDownPaymentAllocation(inputs);
    tfsaBalance -= amountFromTFSA;
    rrspBalance -= amountFromRRSP;
    pendingTfsaRegain = amountFromTFSA;
    loanBalance = inputs.buyAmount - downPayment;
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
      const newRoom = Math.min(0.18 * priorYearGrossIncome, RRSP_ANNUAL_MAX);
      rrspRoomAvailable += newRoom;
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
      const monthInterest = (loanBalance * (mortgageRate / 100)) / MONTHS_PER_YEAR;
      const monthPrinciple = Math.min(payment - monthInterest, loanBalance);
      yearInterest += monthInterest;
      yearPrinciple += monthPrinciple;
      loanBalance -= monthPrinciple;
      monthsRemaining--;
    }
    if (loanBalance < 0) loanBalance = 0;
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
        // Dividend-first: fill dividend bucket to cover interest (+ TFSA if not growth-first)
        const divBalAfterGrowth = helocDividendBalance * dividendGrowth;
        const totalHelocAfter = helocBalance + helocRoom;
        const interestNeeded = helocRate * totalHelocAfter;
        const tfsaTarget = inputs.helocGrowthFirst ? 0 : Math.max(0, tfsaRoomAvailable);
        const totalTarget = interestNeeded + tfsaTarget;
        const dividendCoverage = dividendYield * divBalAfterGrowth;
        const shortfall = totalTarget - dividendCoverage;
        const minDividendNeeded = dividendYield > 0 ? Math.max(0, shortfall / dividendYield) : helocRoom;
        helocDividendContrib = Math.min(helocRoom, minDividendNeeded);
        helocGrowthContrib = helocRoom - helocDividendContrib;
      }
    }

    // Growth-first ramp: sell growth stocks → buy dividend stocks
    // HELOC money must stay invested, so conversion keeps the loan intact.
    if (inputs.helocGrowthFirst && !isRetired && y >= growthFirstCutoffYear && helocGrowthBalance > 0 && dividendYield > 0) {
      const totalHelocAfter = helocBalance + helocRoom;
      const interestNeeded = helocRate * totalHelocAfter;
      const currentDivBal = helocDividendBalance * dividendGrowth + helocDividendContrib;
      const dividendCoverage = dividendYield * currentDivBal;
      const shortfall = interestNeeded - dividendCoverage;
      if (shortfall > 0) {
        const neededDivBal = shortfall / dividendYield;
        growthToDividendConversion = Math.min(helocGrowthBalance, neededDivBal);
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

      // Excess dividends reduce how much we need to withdraw from accounts
      const expenseNeed = retirementNonHousingExpenses + yearlyHousing + helocInterestFromCash;
      const incomeAfterTax = Math.max(0, netIncome) + excessDividends;
      totalRetirementDraw = Math.max(0, expenseNeed - incomeAfterTax);

      // Any leftover excess after covering expenses + tax → TFSA then non-registered
      const retireSurplus = Math.max(0, incomeAfterTax - expenseNeed);
      if (retireSurplus > 0) {
        tfsaContrib = Math.min(retireSurplus, Math.max(0, tfsaRoomAvailable));
        tfsaRoomUsed += tfsaContrib;
        nonRegContrib = retireSurplus - tfsaContrib;
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
    });

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
