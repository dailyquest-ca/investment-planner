import type { FormState } from '../types';

interface InputPanelProps {
  values: FormState;
  onChange: (field: keyof FormState, value: number) => void;
}

const defaultLabels: Record<keyof FormState, string> = {
  initialBalance: 'Current savings ($)',
  monthlyContribution: 'Monthly contribution ($)',
  annualReturnPercent: 'Expected annual return (%)',
  inflationPercent: 'Expected inflation (%)',
  currentAge: 'Current age',
  retirementAge: 'Target retirement age',
  annualSpendingRetirement: 'Annual spending in retirement ($)',
  projectionYears: 'Years to project',
};

export function InputPanel({ values, onChange }: InputPanelProps) {
  return (
    <div className="rounded-2xl bg-slate-800/60 border border-slate-700/80 p-6 shadow-xl">
      <h2 className="font-display text-lg font-semibold text-slate-100 mb-4">Your numbers</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {(Object.keys(defaultLabels) as (keyof FormState)[]).map((key) => (
          <label key={key} className="block">
            <span className="text-sm text-slate-400">{defaultLabels[key]}</span>
            <input
              type="number"
              min={key.includes('Age') || key === 'projectionYears' ? 18 : 0}
              max={key.includes('Age') ? 100 : undefined}
              step={key.includes('Percent') ? 0.1 : key.includes('Balance') || key.includes('Contribution') || key.includes('Spending') ? 100 : 1}
              value={values[key] === 0 ? '' : values[key]}
              onChange={(e) => onChange(key, e.target.value === '' ? 0 : Number(e.target.value))}
              className="mt-1 block w-full rounded-lg bg-slate-900/80 border border-slate-600 text-slate-100 px-3 py-2 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition"
            />
          </label>
        ))}
      </div>
    </div>
  );
}
