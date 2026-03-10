import { useState, useRef, useEffect, useCallback } from 'react';
import { getDownPaymentAllocation, type BuyingScenarioInputs, type RetirementAccountType } from '../types/buying';
import type { BuyingYearRow } from '../lib/buyingProjection';
import { calculateMortgageInsurance } from '../lib/canadianMortgageInsurance';
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

const BUYING_FIELDS: FieldConfig[] = [
  { key: 'yearsUntilPurchase', label: 'Years until purchase (0 = now)', unit: 'yr' },
  { key: 'buyAmount', label: 'Purchase price', unit: '$' },
  { key: 'percentageDownpayment', label: 'Down payment', unit: '%' },
  { key: 'startingYearlyTaxes', label: 'Property taxes (yearly)', unit: '$', secondary: true },
  { key: 'startingMonthlyStrata', label: 'Strata (monthly)', unit: '$', secondary: true },
];

const LOAN_AND_MORTGAGE: CardGroup = {
  id: 'loan',
  title: 'Loan & mortgage',
  fields: [
    { key: 'mortgageRateInitial', label: 'Mortgage rate', unit: '%' },
    { key: 'mortgageAmortizationYears', label: 'Amortization (years)', unit: 'yr' },
    { key: 'mortgageRateAfterTerm', label: 'Rate after term', unit: '%', secondary: true },
    { key: 'mortgageRateChangeAfterYears', label: 'Term length (years)', unit: 'yr', secondary: true },
    { key: 'helocInterestRate', label: 'HELOC rate', unit: '%', secondary: true },
    { key: 'helocGrowthFirst', label: 'Growth-first HELOC', unit: undefined, secondary: true },
  ],
};

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

export function BuyingInputPanel({ values, onChange, onWithdrawalOrderChange, retirementMonthlyHousing, firstYearRow }: BuyingInputPanelProps) {
  const allocation = getDownPaymentAllocation(values);
  const insurance = calculateMortgageInsurance(values.buyAmount, values.percentageDownpayment, values.mortgageAmortizationYears);
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
          <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Purchase</p>
          <FieldGrid fields={BUYING_FIELDS} values={values} onChange={onChange} />
          {isBuying && (
            <div className="pt-2 border-t border-slate-700/80 text-xs space-y-1.5">
              <div>
                <p className="text-slate-500">Down payment</p>
                <p className="text-slate-300 mt-0.5">
                  {fmtCurrency(allocation.downPayment)} → FHSA {fmtCurrency(allocation.amountFromFHSA)}, RRSP {fmtCurrency(allocation.amountFromRRSP)}, TFSA {fmtCurrency(allocation.amountFromTFSA)}
                </p>
              </div>
              {values.percentageDownpayment < 20 && (
                <div>
                  <p className="text-slate-500">Mortgage insurance (CMHC)</p>
                  {insurance.eligible ? (
                    <p className="text-amber-400 mt-0.5">
                      {fmtCurrency(insurance.premiumAmount)} ({(insurance.premiumRate * 100).toFixed(1)}% of mortgage) — added to loan
                    </p>
                  ) : (
                    <p className="text-rose-400 mt-0.5">{insurance.reason}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* Loan & mortgage — only when buying */}
      {isBuying && (
        <CollapsibleSection title={LOAN_AND_MORTGAGE.title} defaultOpen={false}>
          <FieldGrid fields={LOAN_AND_MORTGAGE.fields} values={values} onChange={onChange} />
          <label className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-700/80 cursor-pointer min-h-[44px]">
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
        </CollapsibleSection>
      )}

      {/* Market assumptions */}
      <CollapsibleSection title="Market assumptions" defaultOpen={false}>
        <FieldGrid fields={marketFields} values={values} onChange={onChange} />
      </CollapsibleSection>

      {/* Investments & accounts */}
      <CollapsibleSection title="Investments & accounts" defaultOpen={false}>
        <FieldGrid fields={INVESTMENT_ACCOUNTS} values={values} onChange={onChange} />
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
