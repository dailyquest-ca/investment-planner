'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { runBuyingProjection } from '../lib/buyingProjection';
import { getSuggestions } from '../lib/suggestions';
import { DEFAULT_BUYING_INPUTS, type BuyingScenarioInputs, type RetirementAccountType } from '../types/buying';
import { SummaryBanner } from './SummaryBanner';
import { BuyingInputPanel } from './BuyingInputPanel';
import { BuyingForecastTable } from './BuyingForecastTable';
import { BuyingNetWorthChart } from './BuyingNetWorthChart';
import { SummaryStats } from './SummaryStats';
import { SuggestionsPanel } from './SuggestionsPanel';
import { SyncPanel } from './SyncPanel';
import {
  getActiveScenarioId,
  listScenarios,
  saveScenario,
  type SavedScenario,
} from '../lib/sync';

const STORAGE_KEY = 'net-worth-planner-inputs';
const LOCAL_SAVE_DEBOUNCE_MS = 400;
const CLOUD_SAVE_DEBOUNCE_MS = 2000;

function loadStoredInputs(): BuyingScenarioInputs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_BUYING_INPUTS;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
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

export default function Planner() {
  const [inputs, setInputs] = useState<BuyingScenarioInputs>(loadStoredInputs);
  const [tableOpen, setTableOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [, setScenarios] = useState<SavedScenario[]>([]);
  const [activeScenarioId, setActiveScenarioIdState] = useState<string | null>(getActiveScenarioId);
  const localSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cloudSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadFromCloud = useCallback(async () => {
    try {
      const list = await listScenarios();
      setScenarios(list);
      const active = getActiveScenarioId();
      const match = active ? list.find((s) => s.id === active) : list.find((s) => s.is_default) ?? list[0];
      if (match) {
        const merged = { ...DEFAULT_BUYING_INPUTS, ...match.inputs };
        setInputs(merged);
        setActiveScenarioIdState(match.id);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(merged)); } catch { /* */ }
      }
    } catch {
      // API not available or user is offline; fall back to localStorage
    }
  }, []);

  useEffect(() => { loadFromCloud(); }, [loadFromCloud]);

  useEffect(() => {
    if (localSaveRef.current) clearTimeout(localSaveRef.current);
    localSaveRef.current = setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs)); } catch { /* */ }
    }, LOCAL_SAVE_DEBOUNCE_MS);
    return () => { if (localSaveRef.current) clearTimeout(localSaveRef.current); };
  }, [inputs]);

  useEffect(() => {
    if (cloudSaveRef.current) clearTimeout(cloudSaveRef.current);
    cloudSaveRef.current = setTimeout(async () => {
      try {
        setSyncStatus('saving');
        const saved = await saveScenario(inputs, 'My Scenario', activeScenarioId ?? undefined, true);
        setActiveScenarioIdState(saved.id);
        setSyncStatus('saved');
        setTimeout(() => setSyncStatus('idle'), 2000);
      } catch {
        setSyncStatus('error');
      }
    }, CLOUD_SAVE_DEBOUNCE_MS);
    return () => { if (cloudSaveRef.current) clearTimeout(cloudSaveRef.current); };
  }, [inputs, activeScenarioId]);

  const rows = useMemo(() => runBuyingProjection(inputs), [inputs]);
  const buyNowRows = useMemo(() => {
    if (inputs.yearsUntilPurchase <= 0) return null;
    return runBuyingProjection({ ...inputs, yearsUntilPurchase: 0 });
  }, [inputs]);
  const suggestions = useMemo(() => getSuggestions(inputs, rows), [inputs, rows]);
  const retirementYear = new Date().getFullYear() + Math.max(0, inputs.retirementAge - inputs.currentAge);
  const retirementRow = rows.find((r) => r.year === retirementYear);
  const retirementMonthlyHousing = retirementRow?.monthlyHousingCosts;
  const firstRow = rows[0];
  const comparisonYear = retirementYear ?? (rows.length > 0 ? rows[rows.length - 1].year : new Date().getFullYear());

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
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* */ }
    setInputs(DEFAULT_BUYING_INPUTS);
  };

  const sidebarContent = (
    <>
      <div className="p-3 border-b border-slate-800 flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold text-slate-200">Assumptions</h2>
        <div className="flex items-center gap-3">
          <SyncPanel status={syncStatus} />
          <button
            type="button"
            onClick={handleResetToDefaults}
            className="text-xs text-slate-500 hover:text-slate-300 underline"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-slate-400 hover:text-slate-200 p-1"
            aria-label="Close assumptions panel"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
      <BuyingInputPanel
        values={inputs}
        onChange={handleChange}
        onWithdrawalOrderChange={handleWithdrawalOrderChange}
        retirementMonthlyHousing={retirementMonthlyHousing}
        firstYearRow={firstRow}
      />
    </>
  );

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <div className="flex flex-1 min-h-0 w-full max-w-[1800px] mx-auto">
        <aside className="hidden lg:flex w-[320px] shrink-0 border-r border-slate-800 bg-slate-900/30 overflow-y-auto flex-col">
          {sidebarContent}
        </aside>

        {sidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-sm">
            <div className="flex-1 overflow-y-auto">
              {sidebarContent}
            </div>
          </div>
        )}

        <main className="flex-1 min-w-0 flex flex-col overflow-auto">
          <div className="p-3 sm:p-4 lg:p-6 space-y-4">
            <header>
              <h1 className="font-display text-xl sm:text-2xl font-bold text-white tracking-tight">
                Your net worth, mapped
              </h1>
              <p className="mt-0.5 text-slate-400 text-sm">
                See how housing, investments, and tax choices play out. Your data syncs automatically.
              </p>
            </header>

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
                  <span className="font-display text-base font-semibold text-slate-100">
                    Year-by-year forecast
                  </span>
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
        </main>
      </div>

      <button
        type="button"
        onClick={() => setSidebarOpen(true)}
        className="lg:hidden fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-3 shadow-lg shadow-emerald-900/40 transition active:scale-95"
        aria-label="Open assumptions"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
        </svg>
        <span className="text-sm font-medium">Assumptions</span>
      </button>

      <footer className="border-t border-slate-800 py-2 px-3 sm:px-4 shrink-0">
        <p className="text-center text-xs text-slate-600">
          Built by <span className="text-slate-500">Zak</span>
        </p>
      </footer>
    </div>
  );
}
