'use client';

import type { BuyingScenarioInputs, RetirementAccountType } from '../../types/buying';
import { FieldGrid, fmtCurrency, type FieldConfig } from './shared';

const RETIREMENT_FIELDS: FieldConfig[] = [
  { key: 'retirementAge', label: 'Retirement age', unit: 'yr' },
  { key: 'monthlyMoneyNeededDuringRetirement', label: 'Monthly need (non-housing)', unit: '$' },
  { key: 'monthlyMoneyMadeDuringRetirement', label: 'Part-time income', unit: '$', secondary: true },
  { key: 'partTimeRetirementYears', label: 'Years of part-time work', unit: 'yr', secondary: true },
];

const RETIREMENT_ACCOUNT_OPTIONS: { value: RetirementAccountType; label: string }[] = [
  { value: 'TFSA', label: 'TFSA' },
  { value: 'RRSP', label: 'RRSP' },
  { value: 'NonRegistered', label: 'Non-Registered' },
  { value: 'HELOC', label: 'HELOC Investments' },
];

interface RetirementSectionProps {
  values: BuyingScenarioInputs;
  onChange: (field: keyof BuyingScenarioInputs, value: number | boolean) => void;
  onWithdrawalOrderChange: (order: RetirementAccountType[]) => void;
  retirementMonthlyHousing?: number;
}

export function RetirementSection({
  values,
  onChange,
  onWithdrawalOrderChange,
  retirementMonthlyHousing,
}: RetirementSectionProps) {
  const order: RetirementAccountType[] =
    values.retirementWithdrawalOrder?.length === 4
      ? values.retirementWithdrawalOrder
      : ['RRSP', 'NonRegistered', 'HELOC', 'TFSA'];

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
    <div className="space-y-3">
      <FieldGrid fields={RETIREMENT_FIELDS} values={values} onChange={onChange} />

      <div className="mt-3 pt-3 border-t border-slate-700/80 space-y-2">
        <p className="text-[11px] text-slate-500">Withdrawal order in retirement</p>
        <div className="flex flex-wrap items-center gap-2">
          {order.map((_, idx) => (
            <div key={idx} className="flex items-center gap-1">
              <span className="text-slate-500 text-xs">
                {idx === 0 ? '1st' : idx === 1 ? '2nd' : idx === 2 ? '3rd' : '4th'}
              </span>
              <select
                value={order[idx]}
                onChange={(e) => handleOrderChange(idx, e.target.value as RetirementAccountType)}
                className="rounded-md bg-slate-800 border border-slate-600 text-slate-100 px-2 py-1.5 text-xs focus:border-emerald-500 outline-none min-h-[36px]"
                aria-label={`Withdrawal priority ${idx + 1}`}
              >
                {RETIREMENT_ACCOUNT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
        {retirementMonthlyHousing != null && (
          <p className="text-[11px] text-slate-500 pt-1">
            Monthly need (incl. housing):{' '}
            {fmtCurrency(values.monthlyMoneyNeededDuringRetirement + retirementMonthlyHousing)}/mo
          </p>
        )}
      </div>
    </div>
  );
}

export function retirementSummary(values: BuyingScenarioInputs): string {
  return `Age ${values.retirementAge} · $${values.monthlyMoneyNeededDuringRetirement.toLocaleString()}/mo`;
}
