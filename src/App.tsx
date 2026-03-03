import { useEffect, useMemo, useRef, useState } from 'react';
import { runBuyingProjection } from './lib/buyingProjection';
import { getSuggestions } from './lib/suggestions';
import { DEFAULT_BUYING_INPUTS, type BuyingScenarioInputs, type RetirementAccountType } from './types/buying';
import { BuyingInputPanel } from './components/BuyingInputPanel';
import { BuyingForecastTable } from './components/BuyingForecastTable';
import { BuyingNetWorthChart } from './components/BuyingNetWorthChart';
import { SummaryStats } from './components/SummaryStats';
import { SuggestionsPanel } from './components/SuggestionsPanel';

const STORAGE_KEY = 'net-worth-planner-inputs';
const SAVE_DEBOUNCE_MS = 400;

function loadStoredInputs(): BuyingScenarioInputs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_BUYING_INPUTS;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    // Migrate old field names
    if (parsed.householdTFSAContributionRoom == null) {
      const p1 = Number(parsed.person1CurrentTFSAContributionRoom ?? parsed.zakCurrentTFSAContributionRoom ?? 0);
      const p2 = Number(parsed.person2CurrentTFSAContributionRoom ?? parsed.annaCurrentTFSAContributionRoom ?? 0);
      if (p1 + p2 > 0) parsed.householdTFSAContributionRoom = p1 + p2;
    }
    const keys = Object.keys(DEFAULT_BUYING_INPUTS) as (keyof BuyingScenarioInputs)[];
    const merged = { ...DEFAULT_BUYING_INPUTS };
    for (const k of keys) {
      const v = parsed[k];
      if (v === undefined) continue;
      if (k === 'retirementWithdrawalOrder') {
        if (Array.isArray(v) && v.length === 4 && v.every((x) => ['TFSA', 'RRSP', 'NonRegistered', 'HELOC'].includes(x)))
          merged[k] = v as RetirementAccountType[];
        continue;
      }
      if (k === 'numberOfIncomeEarners') {
        merged[k] = v === 1 ? 1 : 2;
        continue;
      }
      if (typeof v === 'number' || typeof v === 'boolean') (merged as Record<string, unknown>)[k] = v;
    }
    return merged;
  } catch {
    return DEFAULT_BUYING_INPUTS;
  }
}

function App() {
  const [inputs, setInputs] = useState<BuyingScenarioInputs>(loadStoredInputs);
  const [tableOpen, setTableOpen] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs));
      } catch {
        // ignore quota or private mode
      }
      saveTimeoutRef.current = null;
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [inputs]);

  const rows = useMemo(() => runBuyingProjection(inputs), [inputs]);
  const suggestions = useMemo(() => getSuggestions(inputs, rows), [inputs, rows]);
  const retirementYear = new Date().getFullYear() + Math.max(0, inputs.retirementAge - inputs.currentAge);
  const retirementRow = rows.find((r) => r.year === retirementYear);
  const retirementMonthlyHousing = retirementRow?.monthlyHousingCosts;
  const firstRow = rows[0];

  const handleChange = (field: keyof BuyingScenarioInputs, value: number | boolean) => {
    if (field === 'numberOfIncomeEarners') {
      setInputs((prev) => ({ ...prev, [field]: value === 1 ? 1 : 2 }));
    } else {
      setInputs((prev) => ({ ...prev, [field]: value }));
    }
  };

  const handleWithdrawalOrderChange = (order: typeof inputs.retirementWithdrawalOrder) => {
    setInputs((prev) => ({ ...prev, retirementWithdrawalOrder: order }));
  };

  const handleResetToDefaults = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setInputs(DEFAULT_BUYING_INPUTS);
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-[1600px] mx-auto px-4 py-6 sm:py-10">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Net Worth Planner
            </h1>
            <p className="mt-1 text-slate-400 text-sm sm:text-base">
              See how your net worth builds over time. Adjust inputs and use suggestions to optimize. Your data is saved in this browser.
            </p>
          </div>
          <button
            type="button"
            onClick={handleResetToDefaults}
            className="text-sm text-slate-500 hover:text-slate-300 underline"
          >
            Reset to defaults
          </button>
        </header>

        {/* Hero: Net worth over time */}
        <section className="mb-6">
          <BuyingNetWorthChart rows={rows} retirementYear={retirementYear} />
        </section>

        {/* Summary stats */}
        <section className="mb-6">
          <SummaryStats rows={rows} retirementYear={retirementYear} />
        </section>

        {/* Inputs + Suggestions */}
        <section className="grid gap-6 lg:grid-cols-[360px_1fr] mb-8">
          <aside className="min-w-0">
            <BuyingInputPanel
              values={inputs}
              onChange={handleChange}
              onWithdrawalOrderChange={handleWithdrawalOrderChange}
              retirementMonthlyHousing={retirementMonthlyHousing}
              firstYearRow={firstRow}
            />
          </aside>
          <div className="min-w-0">
            <SuggestionsPanel suggestions={suggestions} />
          </div>
        </section>

        {/* Detailed table (collapsible) */}
        <section>
          <div className="rounded-2xl bg-slate-800/60 border border-slate-700/80 overflow-hidden shadow-xl">
            <button
              type="button"
              onClick={() => setTableOpen((o) => !o)}
              className="w-full flex items-center justify-between px-4 py-3 text-left border-b border-slate-700 hover:bg-slate-700/30 transition"
            >
              <span className="font-display text-lg font-semibold text-slate-100">
                Year-by-year forecast
              </span>
              <span
                className="text-slate-500 transition-transform inline-block"
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
    </div>
  );
}

export default App;
