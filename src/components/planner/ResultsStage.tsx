'use client';

import { useState } from 'react';
import type { BuyingYearRow } from '../../lib/buyingProjection';
import type { Suggestion } from '../../lib/suggestions';
import { SummaryBanner } from '../SummaryBanner';
import { BuyingNetWorthChart } from '../BuyingNetWorthChart';
import { SummaryStats } from '../SummaryStats';
import { SuggestionsPanel } from '../SuggestionsPanel';
import { BuyingForecastTable } from '../BuyingForecastTable';

interface ResultsStageProps {
  rows: BuyingYearRow[];
  buyNowRows: BuyingYearRow[] | null;
  comparisonYear: number;
  retirementYear: number;
  suggestions: Suggestion[];
}

export function ResultsStage({
  rows,
  buyNowRows,
  comparisonYear,
  retirementYear,
  suggestions,
}: ResultsStageProps) {
  const [tableOpen, setTableOpen] = useState(false);

  return (
    <div className="space-y-4">
      <SummaryBanner
        rows={rows}
        buyNowRows={buyNowRows}
        comparisonYear={comparisonYear}
        retirementYear={retirementYear}
      />

      <section className="flex-shrink-0">
        <BuyingNetWorthChart rows={rows} retirementYear={retirementYear} />
      </section>

      <section>
        <SummaryStats rows={rows} retirementYear={retirementYear} />
      </section>

      <section>
        <SuggestionsPanel suggestions={suggestions} />
      </section>

      <section>
        <div className="rounded-xl bg-slate-800/60 border border-slate-700/80 overflow-x-auto shadow-lg">
          <button
            type="button"
            onClick={() => setTableOpen((o) => !o)}
            className="w-full flex items-center justify-between px-3 py-2.5 text-left border-b border-slate-700 hover:bg-slate-700/30 transition min-h-[44px]"
            aria-expanded={tableOpen}
          >
            <span className="font-display text-sm font-semibold text-slate-100">Detailed forecast</span>
            <span
              className="text-slate-500 transition-transform inline-block text-xs"
              style={{ transform: tableOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
              aria-hidden
            >
              ▼
            </span>
          </button>
          {tableOpen && <BuyingForecastTable rows={rows} />}
        </div>
      </section>
    </div>
  );
}
