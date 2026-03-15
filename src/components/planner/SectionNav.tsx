'use client';

import type { BuyingScenarioInputs } from '../../types/buying';
import { budgetSummary } from './BudgetSection';
import { housingSummary } from './HousingSection';
import { investmentsSummary } from './InvestmentsSection';
import { retirementSummary } from './RetirementSection';

export type PlannerSection = 'budget' | 'housing' | 'investments' | 'retirement';

const SECTION_META: {
  id: PlannerSection;
  label: string;
  icon: string;
  summary: (v: BuyingScenarioInputs) => string;
}[] = [
  { id: 'budget', label: 'Budget', icon: '💰', summary: budgetSummary },
  { id: 'housing', label: 'Housing', icon: '🏠', summary: housingSummary },
  { id: 'investments', label: 'Investments', icon: '📈', summary: investmentsSummary },
  { id: 'retirement', label: 'Retirement', icon: '🎯', summary: retirementSummary },
];

interface SectionNavProps {
  active: PlannerSection;
  onSelect: (section: PlannerSection) => void;
  values: BuyingScenarioInputs;
  orientation?: 'vertical' | 'horizontal';
}

export function SectionNav({ active, onSelect, values, orientation = 'vertical' }: SectionNavProps) {
  if (orientation === 'horizontal') {
    return (
      <div className="flex gap-1 overflow-x-auto scrollbar-none pb-1 -mx-1 px-1">
        {SECTION_META.map(({ id, label, icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition whitespace-nowrap ${
              active === id
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
            }`}
          >
            <span aria-hidden className="text-sm">{icon}</span>
            {label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      {SECTION_META.map(({ id, label, icon, summary }) => (
        <button
          key={id}
          type="button"
          onClick={() => onSelect(id)}
          className={`w-full text-left px-3 py-2.5 rounded-lg transition ${
            active === id
              ? 'bg-emerald-500/10 border border-emerald-500/30'
              : 'hover:bg-slate-800/60 border border-transparent'
          }`}
        >
          <div className="flex items-center gap-2">
            <span aria-hidden className="text-sm">{icon}</span>
            <span
              className={`text-xs font-medium ${
                active === id ? 'text-emerald-400' : 'text-slate-300'
              }`}
            >
              {label}
            </span>
          </div>
          {active !== id && (
            <p className="text-[10px] text-slate-500 mt-0.5 ml-6 truncate">{summary(values)}</p>
          )}
        </button>
      ))}
    </div>
  );
}
