'use client';

import type { BuyingScenarioInputs } from '../../types/buying';
import type { BuyingYearRow } from '../../lib/buyingProjection';
import { FieldGrid, fmtCurrency, type FieldConfig } from './shared';

const PERSONAL_AND_INCOME: FieldConfig[] = [
  { key: 'currentAge', label: 'Current age', unit: 'yr' },
  { key: 'lifeExpectancy', label: 'Life expectancy', unit: 'yr' },
  { key: 'householdGrossIncome', label: 'Household gross income', unit: '$' },
  { key: 'monthlyNonHousingExpenses', label: 'Monthly expenses', unit: '$' },
  { key: 'yearlyRateOfIncrease', label: 'Income growth', unit: '%', secondary: true },
  { key: 'expenseInflationRate', label: 'Expense inflation', unit: '%', secondary: true },
];

interface BudgetSectionProps {
  values: BuyingScenarioInputs;
  onChange: (field: keyof BuyingScenarioInputs, value: number | boolean) => void;
  firstYearRow?: BuyingYearRow;
}

export function BudgetSection({ values, onChange, firstYearRow }: BudgetSectionProps) {
  return (
    <div className="space-y-3">
      <FieldGrid fields={PERSONAL_AND_INCOME} values={values} onChange={onChange} />

      {firstYearRow && firstYearRow.grossIncome > 0 && (() => {
        const taxes = Math.round(firstYearRow.incomeTax / 12);
        const housing = Math.round(firstYearRow.yearlyHousingCosts / 12);
        const expenses = Math.round(firstYearRow.nonHousingExpenses / 12);
        const savings = Math.round(
          (firstYearRow.tfsaContributions + firstYearRow.rrspContributions + firstYearRow.nonRegisteredContributions) / 12,
        );
        const total = taxes + housing + expenses + savings;
        const gross = Math.round(firstYearRow.grossIncome / 12);
        const overBudget = taxes + housing + expenses > gross;
        const shortfall = taxes + housing + expenses - gross;
        return (
          <div
            className={`rounded-md border px-2.5 py-2 text-[11px] space-y-1 ${
              overBudget ? 'bg-rose-950/40 border-rose-500/40' : 'bg-slate-900/80 border-slate-700'
            }`}
          >
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
  );
}

export function budgetSummary(values: BuyingScenarioInputs): string {
  const income = values.householdGrossIncome >= 1000
    ? `$${Math.round(values.householdGrossIncome / 1000)}k/yr`
    : `$${values.householdGrossIncome}/yr`;
  return `${income} income · $${values.monthlyNonHousingExpenses.toLocaleString()}/mo expenses`;
}
