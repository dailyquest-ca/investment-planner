'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { maxDownPaymentFromBalances, type BuyingScenarioInputs, type RetirementAccountType } from '../types/buying';
import { purchaseTimeBalances, allocateClosingCash, type BuyingYearRow } from '../lib/buyingProjection';
import { calculateMortgageInsurance, minimumDownPaymentForPrice } from '../lib/canadianMortgageInsurance';
import { computePurchaseCosts } from '../lib/bcPurchaseTaxes';
import { calcMonthlyPayment } from '../lib/domain/mortgage';
import { CollapsibleSection } from './CollapsibleSection';

const RETIREMENT_ACCOUNT_OPTIONS: { value: RetirementAccountType; label: string }[] = [
  { value: 'TFSA', label: 'TFSA' },
  { value: 'RRSP', label: 'RRSP' },
  { value: 'NonRegistered', label: 'Non-Registered' },
  { value: 'HELOC', label: 'HELOC Investments' },
];

interface BuyingInputPanelProps {
  values: BuyingScenarioInputs;
  onChange: (field: keyof BuyingScenarioInputs, value: number | boolean) => void;
  onWithdrawalOrderChange: (order: RetirementAccountType[]) => void;
  retirementMonthlyHousing?: number;
  firstYearRow?: BuyingYearRow;
}

function fmtCurrency(value: number): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(value);
}

type FieldConfig = {
  key: keyof BuyingScenarioInputs;
  label: string;
  unit?: '$' | '%' | 'yr';
  secondary?: boolean;
};

type CardGroup = { id: string; title: string; fields: FieldConfig[] };

const PERSONAL_AND_INCOME: FieldConfig[] = [
  { key: 'currentAge', label: 'Current age', unit: 'yr' },
  { key: 'lifeExpectancy', label: 'Life expectancy', unit: 'yr' },
  { key: 'householdGrossIncome', label: 'Household gross income', unit: '$' },
  { key: 'monthlyNonHousingExpenses', label: 'Monthly expenses', unit: '$' },
  { key: 'yearlyRateOfIncrease', label: 'Income growth', unit: '%', secondary: true },
  { key: 'expenseInflationRate', label: 'Expense inflation', unit: '%', secondary: true },
];

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

const MARKET_ASSUMPTIONS_BASE: FieldConfig[] = [
  { key: 'investmentGrowthRate', label: 'Investment growth rate', unit: '%' },
  { key: 'dividendGrowthRatePercent', label: 'Dividend growth rate', unit: '%', secondary: true },
  { key: 'dividendYieldPercent', label: 'Dividend yield', unit: '%', secondary: true },
];

const MARKET_PROPERTY_FIELDS: FieldConfig[] = [
  { key: 'appreciationYoY', label: 'Property appreciation', unit: '%' },
  { key: 'inflationTaxesYoY', label: 'Tax inflation', unit: '%', secondary: true },
  { key: 'inflationStrataYoY', label: 'Strata inflation', unit: '%', secondary: true },
];

const RETIREMENT_GOALS: CardGroup = {
  id: 'retirement',
  title: 'Retirement goals',
  fields: [
    { key: 'retirementAge', label: 'Retirement age', unit: 'yr' },
    { key: 'monthlyMoneyNeededDuringRetirement', label: 'Monthly need (non-housing)', unit: '$' },
    { key: 'monthlyMoneyMadeDuringRetirement', label: 'Part-time income', unit: '$', secondary: true },
    { key: 'partTimeRetirementYears', label: 'Years of part-time work', unit: 'yr', secondary: true },
  ],
};

const INVESTMENT_ACCOUNTS: FieldConfig[] = [
  { key: 'currentFHSABalance', label: 'Current FHSA', unit: '$' },
  { key: 'currentTFSABalance', label: 'Current TFSA', unit: '$' },
  { key: 'currentRRSPBalance', label: 'Current RRSP', unit: '$' },
  { key: 'householdTFSAContributionRoom', label: 'TFSA room (household)', unit: '$', secondary: true },
  { key: 'annualTFSARoomIncrease', label: 'TFSA room increase', unit: '$', secondary: true },
  { key: 'currentRRSPRoom', label: 'RRSP room (household)', unit: '$', secondary: true },
  { key: 'numberOfIncomeEarners', label: 'Income earners', unit: undefined, secondary: true },
];

function getStep(key: keyof BuyingScenarioInputs): number {
  if (key === 'downPaymentAmount') return 500;
  if (key.includes('Rate') || key.includes('Percent') || key.includes('YoY') || key === 'expenseInflationRate') return 0.1;
  if (key.includes('Amount') || key.includes('Balance') || key.includes('Room') || key.includes('Strata') || key.includes('Taxes') || key === 'householdGrossIncome' || key === 'monthlyNonHousingExpenses' || key === 'monthlyRent') return 100;
  return 1;
}

const INPUT_DEBOUNCE_MS = 150;

function DebouncedInput({
  value,
  unit,
  step,
  onChange,
  label,
  secondary,
  id,
  fieldKey,
}: {
  value: number;
  unit?: '$' | '%' | 'yr';
  step: number;
  onChange: (v: number) => void;
  label: string;
  secondary?: boolean;
  id: string;
  fieldKey: keyof BuyingScenarioInputs;
}) {
  const [local, setLocal] = useState(value);
  const [focused, setFocused] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!focused && local !== value) setLocal(value);
  }, [value, focused]);

  const flush = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (local !== value) onChange(local);
  }, [local, value, onChange]);

  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);

  const handleChange = useCallback(
    (v: number) => {
      setLocal(v);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => onChange(v), INPUT_DEBOUNCE_MS);
    },
    [onChange],
  );

  const handleBlur = () => {
    setFocused(false);
    flush();
  };

  if (fieldKey === 'helocGrowthFirst' || label.includes('Growth-first')) {
    return null;
  }

  return (
    <label
      htmlFor={id}
      className={`block ${secondary ? 'opacity-75' : ''}`}
    >
      <span className={`block truncate mb-1 ${secondary ? 'text-slate-500 text-xs' : 'text-slate-400 text-xs'}`}>
        {label}
      </span>
      <input
        id={id}
        type="number"
        min={0}
        step={step}
        value={local === 0 && unit !== '%' ? '' : local}
        onChange={(e) => handleChange(e.target.value === '' ? 0 : Number(e.target.value))}
        onFocus={() => setFocused(true)}
        onBlur={handleBlur}
        className="w-full rounded-md bg-slate-800 border border-slate-600 text-slate-100 px-2.5 py-2 text-sm tabular-nums focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 outline-none transition min-h-[44px]"
        aria-label={label}
      />
    </label>
  );
}

function FieldGrid({
  fields,
  values,
  onChange,
}: {
  fields: FieldConfig[];
  values: BuyingScenarioInputs;
  onChange: (k: keyof BuyingScenarioInputs, v: number) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-x-2 gap-y-3">
      {fields.map(({ key, label, unit, secondary }) => {
        if (key === 'helocGrowthFirst') {
          return null;
        }
        return (
          <DebouncedInput
            key={key}
            id={`input-${key}`}
            fieldKey={key}
            label={label}
            value={values[key] as number}
            unit={unit}
            step={getStep(key)}
            onChange={(v) => onChange(key, v)}
            secondary={secondary}
          />
        );
      })}
    </div>
  );
}

const CLOSING_FEE_FIELDS: FieldConfig[] = [
  { key: 'futurePurchaseCash', label: 'Cash on hand', unit: '$' },
  { key: 'manualLegalFees', label: 'Legal & notary', unit: '$', secondary: true },
  { key: 'manualInspectionFees', label: 'Inspection', unit: '$', secondary: true },
  { key: 'manualOtherClosingCosts', label: 'Other fees', unit: '$', secondary: true },
];

function ClosingCostSummary({
  values,
  onChange,
  dpAmount,
  insurancePremium,
  ptBalances,
}: {
  values: BuyingScenarioInputs;
  onChange: (k: keyof BuyingScenarioInputs, v: number) => void;
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
    [values.buyAmount, dpAmount, insurancePremium, values.isFirstTimeHomeBuyer, values.isNewBuild, values.manualLegalFees, values.manualInspectionFees, values.manualOtherClosingCosts],
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
          const funded = funding.fromCashOnHand + funding.fromFHSA + funding.fromRRSP + funding.fromTFSA + funding.fromNonRegistered;
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

function SummaryRow({ label, value, bold, positive, negative, warn }: {
  label: string;
  value: number;
  bold?: boolean;
  positive?: boolean;
  negative?: boolean;
  warn?: boolean;
}) {
  let textColor = 'text-slate-400';
  if (bold) textColor = 'text-slate-200';
  if (positive) textColor = 'text-emerald-400/90';
  if (negative) textColor = 'text-emerald-400/90';
  if (warn) textColor = 'text-amber-400/90';
  return (
    <div className={`flex justify-between ${bold ? 'font-medium pt-0.5' : ''}`}>
      <span className={bold ? 'text-slate-300' : 'text-slate-400'}>{label}</span>
      <span className={`tabular-nums ${textColor}`}>{fmtCurrency(value)}</span>
    </div>
  );
}

export function BuyingInputPanel({ values, onChange, onWithdrawalOrderChange, retirementMonthlyHousing, firstYearRow }: BuyingInputPanelProps) {
  const ptBalances = useMemo(() => purchaseTimeBalances(values), [
    values.currentFHSABalance, values.currentRRSPBalance, values.currentTFSABalance,
    values.yearsUntilPurchase, values.householdGrossIncome, values.yearlyRateOfIncrease,
    values.monthlyNonHousingExpenses, values.expenseInflationRate, values.monthlyRent,
    values.rentIncreasePercent, values.investmentGrowthRate, values.householdTFSAContributionRoom,
    values.annualTFSARoomIncrease, values.currentRRSPRoom, values.numberOfIncomeEarners,
  ]);
  const maxYearsUntilPurchase = useMemo(
    () => Math.max(0, Math.min(values.lifeExpectancy - values.currentAge - 1, values.retirementAge - values.currentAge)),
    [values.lifeExpectancy, values.currentAge, values.retirementAge],
  );
  const yearsUntilPurchase = Math.min(values.yearsUntilPurchase, maxYearsUntilPurchase);

  const sliderMin = useMemo(() => minimumDownPaymentForPrice(values.buyAmount), [values.buyAmount]);
  const sliderMax = useMemo(
    () => Math.max(sliderMin, Math.min(values.buyAmount, values.futurePurchaseCash + maxDownPaymentFromBalances(ptBalances.fhsa, ptBalances.rrsp, ptBalances.tfsa, ptBalances.nonRegistered))),
    [sliderMin, values.buyAmount, values.futurePurchaseCash, ptBalances],
  );
  const dpAmount = Math.max(sliderMin, Math.min(sliderMax, values.downPaymentAmount));
  const dpPercent = values.buyAmount > 0 ? (dpAmount / values.buyAmount) * 100 : 0;
  const insurance = calculateMortgageInsurance(values.buyAmount, dpPercent, values.mortgageAmortizationYears, {
    isFirstTimeHomeBuyer: values.isFirstTimeHomeBuyer,
    isNewBuild: values.isNewBuild,
  });
  const order: RetirementAccountType[] =
    values.retirementWithdrawalOrder?.length === 4 ? values.retirementWithdrawalOrder : ['RRSP', 'NonRegistered', 'HELOC', 'TFSA'];

  const handleOrderChange = (index: number, value: RetirementAccountType) => {
    const prev = order[index];
    const newOrder: RetirementAccountType[] = [...order];
    newOrder[index] = value;
    for (let i = 0; i < newOrder.length; i++) {
      if (i !== index && newOrder[i] === value) newOrder[i] = prev;
    }
    onWithdrawalOrderChange(newOrder);
  };

  const isBuying = values.buyingHouse;
  const marketFields = isBuying
    ? [...MARKET_ASSUMPTIONS_BASE, ...MARKET_PROPERTY_FIELDS]
    : MARKET_ASSUMPTIONS_BASE;

  return (
    <div className="p-2 space-y-2 flex-1">
      {/* Personal & income */}
      <div className="rounded-lg bg-slate-800/50 border border-slate-700/80 p-3 space-y-3">
        <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Personal & income</p>
        <FieldGrid fields={PERSONAL_AND_INCOME} values={values} onChange={onChange} />
        {firstYearRow && firstYearRow.grossIncome > 0 && (() => {
          const taxes = Math.round(firstYearRow.incomeTax / 12);
          const housing = Math.round(firstYearRow.yearlyHousingCosts / 12);
          const expenses = Math.round(firstYearRow.nonHousingExpenses / 12);
          const savings = Math.round((firstYearRow.tfsaContributions + firstYearRow.rrspContributions + firstYearRow.nonRegisteredContributions) / 12);
          const total = taxes + housing + expenses + savings;
          const gross = Math.round(firstYearRow.grossIncome / 12);
          const overBudget = taxes + housing + expenses > gross;
          const shortfall = taxes + housing + expenses - gross;
          return (
            <div className={`rounded-md border px-2.5 py-2 text-[11px] space-y-1 mt-2 ${overBudget ? 'bg-rose-950/40 border-rose-500/40' : 'bg-slate-900/80 border-slate-700'}`}>
              <p className="text-slate-500 font-medium">Year 1 budget (monthly)</p>
              <div className="flex justify-between text-slate-400">
                <span>Taxes</span>
                <span className="text-rose-400/90 tabular-nums">{fmtCurrency(taxes)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Housing</span>
                <span className="tabular-nums">{fmtCurrency(housing)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Expenses</span>
                <span className="tabular-nums">{fmtCurrency(expenses)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Savings</span>
                <span className="text-emerald-400/90 tabular-nums">{fmtCurrency(savings)}</span>
              </div>
              <div className="flex justify-between text-slate-300 pt-1 mt-1 border-t border-slate-700">
                <span className="font-medium">Total</span>
                <span className="tabular-nums font-medium">{fmtCurrency(total)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Gross income</span>
                <span className="tabular-nums">{fmtCurrency(gross)}</span>
              </div>
              {overBudget && (
                <p className="text-rose-400 font-medium pt-1 mt-1 border-t border-rose-500/30">
                  Over budget by {fmtCurrency(shortfall)}/mo — reduce expenses or housing, or increase income.
                </p>
              )}
            </div>
          );
        })()}
      </div>

      {/* Housing */}
      <CollapsibleSection title="Housing" defaultOpen={true}>
        {/* Rent — always visible */}
        <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-2">Rent</p>
        <FieldGrid fields={RENT_FIELDS} values={values} onChange={onChange} />

        {/* Buy toggle */}
        <label className="flex items-center gap-3 mt-4 mb-2 cursor-pointer min-h-[44px]">
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

        {/* Purchase details — disabled overlay when not buying */}
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

          {/* Purchase price + mortgage rate — decision cluster */}
          <FieldGrid fields={PURCHASE_PRICE_FIELD} values={values} onChange={onChange} />

          {isBuying && (
            <div className="text-xs space-y-3">
              {/* Amortization — constrained 25/30 toggle */}
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
                        : (values.isFirstTimeHomeBuyer || values.isNewBuild)
                          ? 'border-slate-600 bg-slate-800 text-slate-400 hover:border-slate-500'
                          : 'border-slate-700 bg-slate-800/40 text-slate-600 cursor-not-allowed'
                    }`}
                    title={!(values.isFirstTimeHomeBuyer || values.isNewBuild) ? 'Available for first-time buyers or new builds only' : undefined}
                  >
                    30 years
                  </button>
                </div>
                {!(values.isFirstTimeHomeBuyer || values.isNewBuild) && (
                  <p className="text-[10px] text-slate-500 mt-1">30-year amortization requires first-time buyer or new build</p>
                )}
              </div>

              {/* Eligibility toggles — beside amortization */}
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

              {/* Property costs (secondary) */}
              <FieldGrid fields={PROPERTY_COST_FIELDS} values={values} onChange={onChange} />

              {/* Closing costs & purchase summary */}
              <ClosingCostSummary values={values} onChange={onChange} dpAmount={dpAmount} insurancePremium={insurance.eligible ? insurance.premiumAmount : 0} ptBalances={ptBalances} />

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
      </CollapsibleSection>

      {/* Investments & accounts */}
      <CollapsibleSection title="Investments & accounts" defaultOpen={false}>
        <FieldGrid fields={INVESTMENT_ACCOUNTS} values={values} onChange={onChange} />
      </CollapsibleSection>

      {/* Market assumptions */}
      <CollapsibleSection title="Market assumptions" defaultOpen={false}>
        <FieldGrid fields={marketFields} values={values} onChange={onChange} />
      </CollapsibleSection>

      {/* Retirement goals */}
      <CollapsibleSection title={RETIREMENT_GOALS.title} defaultOpen={false}>
        <FieldGrid fields={RETIREMENT_GOALS.fields} values={values} onChange={onChange} />
        <div className="mt-3 pt-3 border-t border-slate-700/80 space-y-2">
          <p className="text-[11px] text-slate-500">Withdrawal order in retirement</p>
          <div className="flex flex-wrap items-center gap-2">
            {order.map((_, idx) => (
              <div key={idx} className="flex items-center gap-1">
                <span className="text-slate-500 text-xs">{idx === 0 ? '1st' : idx === 1 ? '2nd' : idx === 2 ? '3rd' : '4th'}</span>
                <select
                  value={order[idx]}
                  onChange={(e) => handleOrderChange(idx, e.target.value as RetirementAccountType)}
                  className="rounded-md bg-slate-800 border border-slate-600 text-slate-100 px-2 py-1.5 text-xs focus:border-emerald-500 outline-none min-h-[36px]"
                  aria-label={`Withdrawal priority ${idx + 1}`}
                >
                  {RETIREMENT_ACCOUNT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          {retirementMonthlyHousing != null && (
            <p className="text-[11px] text-slate-500 pt-1">
              Monthly need (incl. housing): {fmtCurrency(values.monthlyMoneyNeededDuringRetirement + retirementMonthlyHousing)}/mo
            </p>
          )}
        </div>
      </CollapsibleSection>
    </div>
  );
}
