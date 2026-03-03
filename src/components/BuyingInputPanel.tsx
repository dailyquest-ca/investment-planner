import { useState, useRef, useEffect } from 'react';
import { getDownPaymentAllocation, type BuyingScenarioInputs, type RetirementAccountType } from '../types/buying';
import type { BuyingYearRow } from '../lib/buyingProjection';
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
};

const PERSONAL_FIELDS: FieldConfig[] = [
  { key: 'currentAge', label: 'Current age', unit: 'yr' },
  { key: 'lifeExpectancy', label: 'Life expectancy', unit: 'yr' },
  { key: 'retirementAge', label: 'Retirement age', unit: 'yr' },
];

const INCOME_EXPENSE_FIELDS: FieldConfig[] = [
  { key: 'householdGrossIncome', label: 'Household gross income (annual)', unit: '$' },
  { key: 'yearlyRateOfIncrease', label: 'Income growth (YoY)', unit: '%' },
  { key: 'monthlyNonHousingExpenses', label: 'Monthly non-housing expenses', unit: '$' },
  { key: 'expenseInflationRate', label: 'Expense inflation (YoY)', unit: '%' },
];

const PURCHASE_TIMING_FIELDS: FieldConfig[] = [
  { key: 'yearsUntilPurchase', label: 'Years until purchase (0 = now)', unit: 'yr' },
  { key: 'monthlyRent', label: 'Monthly rent until purchase', unit: '$' },
  { key: 'rentIncreasePercent', label: 'Rent increase (YoY)', unit: '%' },
];

const PROPERTY_FIELDS: FieldConfig[] = [
  { key: 'buyAmount', label: 'Purchase price', unit: '$' },
  { key: 'percentageDownpayment', label: 'Down payment', unit: '%' },
];

const RETIREMENT_FIELDS: FieldConfig[] = [
  { key: 'monthlyMoneyNeededDuringRetirement', label: 'Monthly non-housing expenses (retirement)', unit: '$' },
  { key: 'monthlyMoneyMadeDuringRetirement', label: 'Monthly part-time income (taxable)', unit: '$' },
  { key: 'partTimeRetirementYears', label: 'Years of part-time work', unit: 'yr' },
];

const HOUSING_FIELDS: FieldConfig[] = [
  { key: 'startingYearlyTaxes', label: 'Yearly property taxes', unit: '$' },
  { key: 'startingMonthlyStrata', label: 'Monthly strata', unit: '$' },
  { key: 'appreciationYoY', label: 'Property appreciation (YoY)', unit: '%' },
  { key: 'inflationTaxesYoY', label: 'Tax inflation (YoY)', unit: '%' },
  { key: 'inflationStrataYoY', label: 'Strata inflation (YoY)', unit: '%' },
];

const MORTGAGE_FIELDS: FieldConfig[] = [
  { key: 'helocInterestRate', label: 'HELOC rate', unit: '%' },
  { key: 'mortgageRateInitial', label: 'Initial mortgage rate', unit: '%' },
  { key: 'mortgageRateAfterTerm', label: 'Rate after term', unit: '%' },
  { key: 'mortgageRateChangeAfterYears', label: 'Term length (years)', unit: 'yr' },
  { key: 'mortgageAmortizationYears', label: 'Amortization', unit: 'yr' },
];

const INVESTMENT_FIELDS: FieldConfig[] = [
  { key: 'currentFHSABalance', label: 'Current FHSA', unit: '$' },
  { key: 'currentTFSABalance', label: 'Current TFSA', unit: '$' },
  { key: 'currentRRSPBalance', label: 'Current RRSP', unit: '$' },
  { key: 'householdTFSAContributionRoom', label: 'TFSA room (household)', unit: '$' },
  { key: 'annualTFSARoomIncrease', label: 'Annual TFSA room increase (household)', unit: '$' },
  { key: 'currentRRSPRoom', label: 'RRSP room (household)', unit: '$' },
  { key: 'investmentGrowthRate', label: 'Growth rate (TFSA, RRSP, growth stocks)', unit: '%' },
  { key: 'dividendGrowthRatePercent', label: 'Dividend stock growth rate', unit: '%' },
  { key: 'dividendYieldPercent', label: 'HELOC dividend yield', unit: '%' },
  { key: 'numberOfIncomeEarners', label: 'Number of income earners', unit: undefined },
];

function getStep(key: keyof BuyingScenarioInputs): number {
  if (key.includes('Rate') || key.includes('Percent') || key.includes('YoY') || key === 'expenseInflationRate') return 0.1;
  if (key.includes('Amount') || key.includes('Balance') || key.includes('Room') || key.includes('Strata') || key.includes('Taxes') || key === 'householdGrossIncome' || key === 'monthlyNonHousingExpenses' || key === 'monthlyRent') return 100;
  return 1;
}

function formatWithUnit(value: number, unit?: '$' | '%' | 'yr'): string {
  if (value === 0 && unit !== '%') return '';
  if (unit === '$') return value.toLocaleString('en-CA', { maximumFractionDigits: 0 }) + ' CAD';
  if (unit === '%') return value + ' %';
  if (unit === 'yr') return value + ' yr';
  return String(value);
}

function InputWithUnit({
  value,
  unit,
  step,
  onChange,
  label,
}: {
  value: number;
  unit?: '$' | '%' | 'yr';
  step: number;
  onChange: (v: number) => void;
  label: string;
}) {
  const [focused, setFocused] = useState(false);
  const [display, setDisplay] = useState(() => formatWithUnit(value, unit));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!focused) setDisplay(formatWithUnit(value, unit));
  }, [value, unit, focused]);

  return (
    <label className="block">
      <span className="text-sm text-slate-400 line-clamp-2 min-h-[2rem] flex items-center">{label}</span>
      <div className="mt-1">
        {focused ? (
          <input
            ref={inputRef}
            type="number"
            min={0}
            step={step}
            autoFocus
            value={value === 0 && unit !== '%' ? '' : value}
            onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
            onBlur={() => setFocused(false)}
            className="w-full rounded-lg bg-slate-900/80 border border-slate-600 text-slate-100 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition"
          />
        ) : (
          <button
            type="button"
            onClick={() => setFocused(true)}
            className="w-full text-left rounded-lg bg-slate-900/80 border border-slate-600 text-slate-100 px-3 py-2 text-sm hover:border-slate-500 transition tabular-nums"
          >
            {display || (unit === '%' ? '0 %' : '0')}
          </button>
        )}
      </div>
    </label>
  );
}

function FieldGrid({ fields, values, onChange }: { fields: FieldConfig[]; values: BuyingScenarioInputs; onChange: (k: keyof BuyingScenarioInputs, v: number) => void }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-3">
      {fields.map(({ key, label, unit }) => (
        <InputWithUnit
          key={key}
          label={label}
          value={values[key] as number}
          unit={unit}
          step={getStep(key)}
          onChange={(v) => onChange(key, v)}
        />
      ))}
    </div>
  );
}

function BudgetBreakdownBar({ label, amount, total, color }: { label: string; amount: number; total: number; color: string }) {
  const pct = total > 0 ? (amount / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-[90px] text-slate-400 truncate">{label}</span>
      <div className="flex-1 h-3 bg-slate-900 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: color }} />
      </div>
      <span className="w-[70px] text-right text-slate-300 tabular-nums">{fmtCurrency(amount)}</span>
      <span className="w-[32px] text-right text-slate-500 tabular-nums">{pct.toFixed(0)}%</span>
    </div>
  );
}

export function BuyingInputPanel({ values, onChange, onWithdrawalOrderChange, retirementMonthlyHousing, firstYearRow }: BuyingInputPanelProps) {
  const allocation = getDownPaymentAllocation(values);
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

  return (
    <div className="rounded-2xl bg-slate-800/60 border border-slate-700/80 p-4 shadow-xl space-y-2 max-h-[85vh] overflow-y-auto">
      <h2 className="font-display text-lg font-semibold text-slate-100 sticky top-0 bg-slate-800/95 py-2 z-10">
        Scenario inputs
      </h2>

      {/* Personal */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Personal</p>
        <FieldGrid fields={PERSONAL_FIELDS} values={values} onChange={onChange} />
      </div>

      {/* Income & Expenses */}
      <div className="space-y-3 pt-2">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Income & Expenses</p>
        <FieldGrid fields={INCOME_EXPENSE_FIELDS} values={values} onChange={onChange} />
        {firstYearRow && firstYearRow.grossIncome > 0 && (() => {
          const gross = firstYearRow.grossIncome;
          const taxes = firstYearRow.incomeTax;
          const housing = firstYearRow.yearlyHousingCosts;
          const expenses = firstYearRow.nonHousingExpenses;
          const helocInt = Math.max(0, firstYearRow.yearlyHelocInterest - firstYearRow.yearlyDividendIncome);
          const savings = firstYearRow.tfsaContributions + firstYearRow.rrspContributions + firstYearRow.nonRegisteredContributions;
          return (
            <div className="rounded-lg bg-slate-900/80 border border-slate-600 px-3 py-2.5 text-sm space-y-1.5">
              <p className="text-slate-400 font-medium">Year 1 monthly budget breakdown</p>
              <div className="space-y-1">
                <BudgetBreakdownBar label="Taxes" amount={Math.round(taxes / 12)} total={Math.round(gross / 12)} color="#ef4444" />
                <BudgetBreakdownBar label="Housing" amount={Math.round(housing / 12)} total={Math.round(gross / 12)} color="#0ea5e9" />
                <BudgetBreakdownBar label="Expenses" amount={Math.round(expenses / 12)} total={Math.round(gross / 12)} color="#f59e0b" />
                {helocInt > 0 && (
                  <BudgetBreakdownBar label="HELOC int." amount={Math.round(helocInt / 12)} total={Math.round(gross / 12)} color="#f472b6" />
                )}
                <BudgetBreakdownBar label="Savings" amount={Math.round(savings / 12)} total={Math.round(gross / 12)} color="#a855f7" />
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-700">
                <span className="text-slate-400 text-xs">Gross income</span>
                <span className="text-slate-200 text-xs font-semibold tabular-nums">{fmtCurrency(Math.round(gross / 12))}/mo</span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Purchase timing (when & rent until then) */}
      <div className="space-y-3 pt-2">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Purchase timing</p>
        <FieldGrid fields={PURCHASE_TIMING_FIELDS} values={values} onChange={onChange} />
        {values.yearsUntilPurchase > 0 && (
          <p className="text-xs text-slate-500">
            Rent increases each year by {values.rentIncreasePercent}% (Vancouver-style). After {values.yearsUntilPurchase} years you buy with accumulated savings.
          </p>
        )}
      </div>

      {/* Property */}
      <div className="space-y-3 pt-2">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Property</p>
        <FieldGrid fields={PROPERTY_FIELDS} values={values} onChange={onChange} />
        <div className="rounded-lg bg-slate-900/80 border border-slate-600 px-3 py-2 text-sm">
          <p className="text-slate-400 font-medium">Down payment allocation</p>
          <p className="text-slate-300 mt-0.5">
            {fmtCurrency(allocation.downPayment)} → FHSA {fmtCurrency(allocation.amountFromFHSA)}, RRSP {fmtCurrency(allocation.amountFromRRSP)}, TFSA {fmtCurrency(allocation.amountFromTFSA)}
          </p>
        </div>
      </div>

      {/* Retirement */}
      <div className="space-y-3 pt-2">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Retirement</p>
        <FieldGrid fields={RETIREMENT_FIELDS} values={values} onChange={onChange} />
        <div className="rounded-lg bg-slate-900/80 border border-slate-600 px-3 py-2 text-sm space-y-1">
          <p className="text-slate-400 font-medium">Estimated total monthly need at retirement</p>
          {retirementMonthlyHousing != null ? (
            <>
              <p className="text-slate-500 text-xs">
                Non-housing: {fmtCurrency(values.monthlyMoneyNeededDuringRetirement)} + Housing (mortgage, strata, taxes): {fmtCurrency(retirementMonthlyHousing)}
              </p>
              <p className="text-slate-200 font-semibold">
                {fmtCurrency(values.monthlyMoneyNeededDuringRetirement + retirementMonthlyHousing)}/mo
              </p>
            </>
          ) : (
            <p className="text-slate-500 text-xs">Housing costs are added automatically from the projection.</p>
          )}
          <p className="text-slate-500 text-xs mt-1">
            Part-time income ({fmtCurrency(values.monthlyMoneyMadeDuringRetirement)}/mo for {values.partTimeRetirementYears} yr) is taxed via brackets, then offsets investment withdrawals.
          </p>
        </div>
      </div>

      <CollapsibleSection title="Retirement withdrawal order" defaultOpen={true}>
        <p className="text-xs text-slate-500 mb-2">Order to drain accounts in retirement. HELOC = growth bucket only (sell and repay); dividend bucket is never sold.</p>
        <div className="flex flex-wrap items-center gap-2">
          {order.map((_, idx) => (
            <div key={idx} className="flex items-center gap-1">
              <span className="text-slate-500 text-sm">{idx === 0 ? '1st' : idx === 1 ? '2nd' : idx === 2 ? '3rd' : '4th'}</span>
              <select
                value={order[idx]}
                onChange={(e) => handleOrderChange(idx, e.target.value as RetirementAccountType)}
                className="rounded-lg bg-slate-900/80 border border-slate-600 text-slate-100 px-2 py-1.5 text-sm focus:border-emerald-500 outline-none"
              >
                {RETIREMENT_ACCOUNT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Housing costs & inflation" defaultOpen={false}>
        <FieldGrid fields={HOUSING_FIELDS} values={values} onChange={onChange} />
      </CollapsibleSection>

      <CollapsibleSection title="Mortgage & HELOC" defaultOpen={false}>
        <FieldGrid fields={MORTGAGE_FIELDS} values={values} onChange={onChange} />
        <label className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={values.helocGrowthFirst}
            onChange={(e) => onChange('helocGrowthFirst', e.target.checked)}
            className="rounded border-slate-500 text-emerald-500 focus:ring-emerald-500"
          />
          <div>
            <span className="text-sm text-slate-200">Growth-first HELOC strategy</span>
            <p className="text-xs text-slate-500">Prioritize growth stocks early, auto-switch to dividends before retirement</p>
          </div>
        </label>
      </CollapsibleSection>

      <CollapsibleSection title="Investments (TFSA, RRSP, etc.)" defaultOpen={false}>
        <FieldGrid fields={INVESTMENT_FIELDS} values={values} onChange={onChange} />
      </CollapsibleSection>
    </div>
  );
}
