'use client';

import { useMemo } from 'react';
import {
  maxDownPaymentFromBalances,
  type BuyingScenarioInputs,
} from '../../types/buying';
import {
  purchaseTimeBalances,
  allocateClosingCash,
} from '../../lib/buyingProjection';
import { calculateMortgageInsurance, minimumDownPaymentForPrice } from '../../lib/canadianMortgageInsurance';
import { computePurchaseCosts } from '../../lib/bcPurchaseTaxes';
import { calcMonthlyPayment } from '../../lib/domain/mortgage';
import { FieldGrid, SummaryRow, fmtCurrency, type FieldConfig } from './shared';

const RENT_FIELDS: FieldConfig[] = [
  { key: 'monthlyRent', label: 'Monthly rent', unit: '$' },
  { key: 'rentIncreasePercent', label: 'Rent increase (YoY)', unit: '%', secondary: true },
];

const PURCHASE_PRICE_FIELD: FieldConfig[] = [
  { key: 'buyAmount', label: 'Purchase price', unit: '$' },
  { key: 'mortgageRateInitial', label: 'Mortgage rate', unit: '%' },
];

const PROPERTY_COST_FIELDS: FieldConfig[] = [
  { key: 'startingYearlyTaxes', label: 'Property taxes (yearly)', unit: '$', secondary: true },
  { key: 'startingMonthlyStrata', label: 'Strata (monthly)', unit: '$', secondary: true },
];

const SECONDARY_MORTGAGE_FIELDS: FieldConfig[] = [
  { key: 'mortgageRateAfterTerm', label: 'Rate after term', unit: '%', secondary: true },
  { key: 'mortgageRateChangeAfterYears', label: 'Term length (years)', unit: 'yr', secondary: true },
  { key: 'helocInterestRate', label: 'HELOC rate', unit: '%', secondary: true },
];

const CLOSING_FEE_FIELDS: FieldConfig[] = [
  { key: 'futurePurchaseCash', label: 'Cash on hand', unit: '$' },
  { key: 'manualLegalFees', label: 'Legal & notary', unit: '$', secondary: true },
  { key: 'manualInspectionFees', label: 'Inspection', unit: '$', secondary: true },
  { key: 'manualOtherClosingCosts', label: 'Other fees', unit: '$', secondary: true },
];

interface HousingSectionProps {
  values: BuyingScenarioInputs;
  onChange: (field: keyof BuyingScenarioInputs, value: number | boolean) => void;
}

export function HousingSection({ values, onChange }: HousingSectionProps) {
  const isBuying = values.buyingHouse;

  const ptBalances = useMemo(() => purchaseTimeBalances(values), [
    values.currentFHSABalance, values.currentRRSPBalance, values.currentTFSABalance,
    values.yearsUntilPurchase, values.householdGrossIncome, values.yearlyRateOfIncrease,
    values.monthlyNonHousingExpenses, values.expenseInflationRate, values.monthlyRent,
    values.rentIncreasePercent, values.investmentGrowthRate, values.householdTFSAContributionRoom,
    values.annualTFSARoomIncrease, values.currentRRSPRoom, values.numberOfIncomeEarners,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  const maxYearsUntilPurchase = useMemo(
    () => Math.max(0, Math.min(values.lifeExpectancy - values.currentAge - 1, values.retirementAge - values.currentAge)),
    [values.lifeExpectancy, values.currentAge, values.retirementAge],
  );
  const yearsUntilPurchase = Math.min(values.yearsUntilPurchase, maxYearsUntilPurchase);

  const sliderMin = useMemo(() => minimumDownPaymentForPrice(values.buyAmount), [values.buyAmount]);
  const sliderMax = useMemo(
    () =>
      Math.max(
        sliderMin,
        Math.min(
          values.buyAmount,
          values.futurePurchaseCash +
            maxDownPaymentFromBalances(ptBalances.fhsa, ptBalances.rrsp, ptBalances.tfsa, ptBalances.nonRegistered),
        ),
      ),
    [sliderMin, values.buyAmount, values.futurePurchaseCash, ptBalances],
  );
  const dpAmount = Math.max(sliderMin, Math.min(sliderMax, values.downPaymentAmount));
  const dpPercent = values.buyAmount > 0 ? (dpAmount / values.buyAmount) * 100 : 0;
  const insurance = calculateMortgageInsurance(values.buyAmount, dpPercent, values.mortgageAmortizationYears, {
    isFirstTimeHomeBuyer: values.isFirstTimeHomeBuyer,
    isNewBuild: values.isNewBuild,
  });

  return (
    <div className="space-y-3">
      {/* Rent */}
      <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Rent</p>
      <FieldGrid fields={RENT_FIELDS} values={values} onChange={onChange} />

      {/* Buy toggle */}
      <label className="flex items-center gap-3 mt-3 mb-1 cursor-pointer min-h-[44px]">
        <input
          type="checkbox"
          checked={isBuying}
          onChange={(e) => onChange('buyingHouse', e.target.checked)}
          className="rounded border-slate-500 text-emerald-500 focus:ring-emerald-500/50 w-4 h-4"
          aria-label="Planning to buy a home"
        />
        <div>
          <span className="text-xs font-medium text-slate-200">Planning to buy a home</span>
          <p className="text-[11px] text-slate-500">{isBuying ? 'Purchase details below' : 'Rent-only simulation'}</p>
        </div>
      </label>

      {/* Purchase details */}
      <div className={`space-y-3 transition-opacity ${isBuying ? '' : 'opacity-30 pointer-events-none select-none'}`}>
        <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Purchase & financing</p>

        {/* Years until purchase slider */}
        <div>
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-slate-400 text-xs">Years until purchase</span>
            <span className="text-slate-300 text-xs tabular-nums font-medium">
              {yearsUntilPurchase === 0 ? 'Now' : `${yearsUntilPurchase} yr`}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={maxYearsUntilPurchase}
            step={1}
            value={yearsUntilPurchase}
            onChange={(e) => onChange('yearsUntilPurchase', Number(e.target.value))}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-emerald-500 bg-slate-700"
            aria-label="Years until purchase"
          />
          <div className="flex justify-between text-[10px] text-slate-500 mt-1">
            <span>Now</span>
            <span>{maxYearsUntilPurchase} yr</span>
          </div>
        </div>

        <FieldGrid fields={PURCHASE_PRICE_FIELD} values={values} onChange={onChange} />

        {isBuying && (
          <div className="text-xs space-y-3">
            {/* Amortization toggle */}
            <div>
              <span className="block text-slate-400 text-xs mb-1.5">Amortization</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onChange('mortgageAmortizationYears', 25)}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition min-h-[44px] ${
                    values.mortgageAmortizationYears === 25
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                      : 'border-slate-600 bg-slate-800 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  25 years
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (values.isFirstTimeHomeBuyer || values.isNewBuild) onChange('mortgageAmortizationYears', 30);
                  }}
                  disabled={!(values.isFirstTimeHomeBuyer || values.isNewBuild)}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition min-h-[44px] ${
                    values.mortgageAmortizationYears === 30
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                      : values.isFirstTimeHomeBuyer || values.isNewBuild
                        ? 'border-slate-600 bg-slate-800 text-slate-400 hover:border-slate-500'
                        : 'border-slate-700 bg-slate-800/40 text-slate-600 cursor-not-allowed'
                  }`}
                  title={
                    !(values.isFirstTimeHomeBuyer || values.isNewBuild)
                      ? 'Available for first-time buyers or new builds only'
                      : undefined
                  }
                >
                  30 years
                </button>
              </div>
              {!(values.isFirstTimeHomeBuyer || values.isNewBuild) && (
                <p className="text-[10px] text-slate-500 mt-1">30-year amortization requires first-time buyer or new build</p>
              )}
            </div>

            {/* Eligibility toggles */}
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              <label className="flex items-center gap-2 cursor-pointer min-h-[36px]">
                <input
                  type="checkbox"
                  checked={values.isFirstTimeHomeBuyer}
                  onChange={(e) => onChange('isFirstTimeHomeBuyer', e.target.checked)}
                  className="rounded border-slate-500 text-emerald-500 focus:ring-emerald-500/50 w-3.5 h-3.5"
                  aria-label="First-time home buyer"
                />
                <span className="text-xs text-slate-400">First-time buyer</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer min-h-[36px]">
                <input
                  type="checkbox"
                  checked={values.isNewBuild}
                  onChange={(e) => onChange('isNewBuild', e.target.checked)}
                  className="rounded border-slate-500 text-emerald-500 focus:ring-emerald-500/50 w-3.5 h-3.5"
                  aria-label="New build"
                />
                <span className="text-xs text-slate-400">New build</span>
              </label>
            </div>

            {/* Down payment slider */}
            <div>
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-slate-400 text-xs">Down payment</span>
                <span className="text-slate-300 text-xs tabular-nums font-medium">
                  {fmtCurrency(dpAmount)} ({dpPercent.toFixed(1)}%)
                </span>
              </div>
              <input
                type="range"
                min={sliderMin}
                max={sliderMax}
                step={500}
                value={dpAmount}
                onChange={(e) => onChange('downPaymentAmount', Number(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-emerald-500 bg-slate-700"
                aria-label="Down payment amount"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                <span>Min {fmtCurrency(sliderMin)}</span>
                <span>Max {fmtCurrency(sliderMax)}</span>
              </div>
            </div>

            {/* Expected monthly housing payment */}
            {(() => {
              const principal = values.buyAmount - dpAmount + (insurance.eligible ? insurance.premiumAmount : 0);
              const monthly = calcMonthlyPayment(principal, values.mortgageRateInitial, values.mortgageAmortizationYears * 12);
              const strata = values.startingMonthlyStrata;
              const propTax = Math.round(values.startingYearlyTaxes / 12);
              const total = Math.round(monthly + strata + propTax);
              return (
                <div className="rounded-md bg-emerald-500/5 border border-emerald-500/20 px-2.5 py-2 text-[11px]">
                  <div className="flex justify-between text-slate-400">
                    <span>Mortgage payment</span>
                    <span className="tabular-nums">{fmtCurrency(Math.round(monthly))}/mo</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Strata + property tax</span>
                    <span className="tabular-nums">{fmtCurrency(strata + propTax)}/mo</span>
                  </div>
                  <div className="flex justify-between font-medium text-emerald-400 pt-1 mt-1 border-t border-emerald-500/15">
                    <span>Expected monthly housing</span>
                    <span className="tabular-nums">{fmtCurrency(total)}/mo</span>
                  </div>
                </div>
              );
            })()}

            <FieldGrid fields={PROPERTY_COST_FIELDS} values={values} onChange={onChange} />

            {/* Closing costs */}
            <ClosingCostSummary
              values={values}
              onChange={onChange}
              dpAmount={dpAmount}
              insurancePremium={insurance.eligible ? insurance.premiumAmount : 0}
              ptBalances={ptBalances}
            />

            {/* Secondary mortgage terms + HELOC */}
            <div className="pt-3 mt-3 border-t border-slate-700/80 space-y-3">
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Mortgage terms & HELOC</p>
              <FieldGrid fields={SECONDARY_MORTGAGE_FIELDS} values={values} onChange={onChange} />
              <label className="flex items-center gap-3 pt-2 border-t border-slate-700/60 cursor-pointer min-h-[44px]">
                <input
                  type="checkbox"
                  checked={values.helocGrowthFirst}
                  onChange={(e) => onChange('helocGrowthFirst', e.target.checked)}
                  className="rounded border-slate-500 text-emerald-500 focus:ring-emerald-500/50 w-4 h-4"
                  aria-label="Growth-first HELOC strategy"
                />
                <div>
                  <span className="text-xs text-slate-300">Growth-first HELOC</span>
                  <p className="text-[11px] text-slate-500">Growth early, then dividends before retirement</p>
                </div>
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ClosingCostSummary({
  values,
  onChange,
  dpAmount,
  insurancePremium,
  ptBalances,
}: {
  values: BuyingScenarioInputs;
  onChange: (k: keyof BuyingScenarioInputs, v: number | boolean) => void;
  dpAmount: number;
  insurancePremium: number;
  ptBalances: { fhsa: number; rrsp: number; tfsa: number; nonRegistered: number };
}) {
  const costs = useMemo(
    () =>
      computePurchaseCosts({
        purchasePrice: values.buyAmount,
        downPayment: dpAmount,
        cmhcPremium: insurancePremium,
        isFirstTimeHomeBuyer: values.isFirstTimeHomeBuyer,
        isNewBuild: values.isNewBuild,
        manualLegalFees: values.manualLegalFees,
        manualInspectionFees: values.manualInspectionFees,
        manualOtherClosingCosts: values.manualOtherClosingCosts,
      }),
    [
      values.buyAmount, dpAmount, insurancePremium, values.isFirstTimeHomeBuyer,
      values.isNewBuild, values.manualLegalFees, values.manualInspectionFees, values.manualOtherClosingCosts,
    ],
  );

  const funding = useMemo(
    () =>
      allocateClosingCash(
        costs.totalCashAtClosing,
        values.futurePurchaseCash,
        ptBalances.fhsa,
        ptBalances.rrsp,
        ptBalances.tfsa,
        ptBalances.nonRegistered,
      ),
    [costs.totalCashAtClosing, values.futurePurchaseCash, ptBalances],
  );

  return (
    <div className="pt-3 mt-3 border-t border-slate-700/80 space-y-3">
      <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Closing costs</p>
      <FieldGrid fields={CLOSING_FEE_FIELDS} values={values} onChange={onChange} />

      <div className="rounded-md bg-slate-900/80 border border-slate-700 px-2.5 py-2 text-[11px] space-y-1">
        <p className="text-slate-500 font-medium mb-1.5">Purchase cost summary</p>

        <SummaryRow label="Purchase price" value={costs.purchasePrice} />
        <SummaryRow label="Down payment" value={-costs.downPayment} negative />
        <SummaryRow label="Base mortgage" value={costs.baseMortgage} />
        {costs.cmhcPremium > 0 && <SummaryRow label="CMHC premium (added to loan)" value={costs.cmhcPremium} warn />}
        <SummaryRow label="Final mortgage" value={costs.finalMortgage} bold />

        <div className="border-t border-slate-700/60 my-1.5" />
        <p className="text-slate-500 font-medium">Cash required at closing</p>
        <SummaryRow label="Down payment" value={costs.downPayment} />
        {costs.pttGross > 0 && (
          <>
            <SummaryRow label="BC Property Transfer Tax" value={costs.pttGross} />
            {costs.pttExemption > 0 && <SummaryRow label="PTT exemption" value={-costs.pttExemption} positive />}
          </>
        )}
        {costs.gstGross > 0 && (
          <>
            <SummaryRow label="GST (new build)" value={costs.gstGross} />
            {costs.gstRelief > 0 && <SummaryRow label="GST rebate" value={-costs.gstRelief} positive />}
          </>
        )}
        {costs.manualFees > 0 && <SummaryRow label="Fees (legal/inspection/other)" value={costs.manualFees} />}
        <SummaryRow label="Total cash required" value={costs.totalCashAtClosing} bold />

        {(() => {
          const funded =
            funding.fromCashOnHand + funding.fromFHSA + funding.fromRRSP + funding.fromTFSA + funding.fromNonRegistered;
          return (
            <>
              <div className="border-t border-slate-700/60 my-1.5" />
              <p className="text-slate-500 font-medium">How it's funded</p>
              {funding.fromCashOnHand > 0 && <SummaryRow label="Cash on hand" value={funding.fromCashOnHand} />}
              {funding.fromFHSA > 0 && <SummaryRow label="FHSA" value={funding.fromFHSA} />}
              {funding.fromRRSP > 0 && <SummaryRow label="RRSP (HBP)" value={funding.fromRRSP} />}
              {funding.fromTFSA > 0 && <SummaryRow label="TFSA" value={funding.fromTFSA} />}
              {funding.fromNonRegistered > 0 && <SummaryRow label="Non-registered" value={funding.fromNonRegistered} />}
              <SummaryRow label="Total funded" value={funded} bold />
              {funding.shortfall > 0 && (
                <div className="flex justify-between text-rose-400 font-medium">
                  <span>Shortfall</span>
                  <span className="tabular-nums">{fmtCurrency(funding.shortfall)}</span>
                </div>
              )}
            </>
          );
        })()}
      </div>
    </div>
  );
}

export function housingSummary(values: BuyingScenarioInputs): string {
  if (!values.buyingHouse) return `Renting $${values.monthlyRent.toLocaleString()}/mo`;
  const price = values.buyAmount >= 1_000_000
    ? `$${(values.buyAmount / 1_000_000).toFixed(1)}M`
    : `$${Math.round(values.buyAmount / 1000)}k`;
  return `${price} purchase · ${values.mortgageRateInitial}% rate`;
}
