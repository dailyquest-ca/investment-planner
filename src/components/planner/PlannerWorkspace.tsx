'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { runBuyingProjection } from '../../lib/buyingProjection';
import { getSuggestions } from '../../lib/suggestions';
import { DEFAULT_BUYING_INPUTS, type BuyingScenarioInputs, type RetirementAccountType } from '../../types/buying';
import { ResultsStage } from './ResultsStage';
import { SectionNav, type PlannerSection } from './SectionNav';
import { BudgetSection } from './BudgetSection';
import { HousingSection } from './HousingSection';
import { InvestmentsSection } from './InvestmentsSection';
import { RetirementSection } from './RetirementSection';
import {
  getActiveScenarioId,
  listScenarios,
  saveScenario,
  type SavedScenario,
} from '../../lib/sync';

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
    if (parsed.downPaymentAmount == null && typeof parsed.percentageDownpayment === 'number' && typeof parsed.buyAmount === 'number') {
      parsed.downPaymentAmount = (parsed.buyAmount * parsed.percentageDownpayment) / 100;
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

export default function PlannerWorkspace() {
  const { data: session, status: authStatus } = useSession();
  const isAuthenticated = authStatus === 'authenticated' && !!session?.user;
  const [inputs, setInputs] = useState<BuyingScenarioInputs>(loadStoredInputs);
  const [activeSection, setActiveSection] = useState<PlannerSection>('budget');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [, setScenarios] = useState<SavedScenario[]>([]);
  const [activeScenarioId, setActiveScenarioIdState] = useState<string | null>(getActiveScenarioId);
  const localSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cloudSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const migrationDoneRef = useRef(false);

  const loadFromCloud = useCallback(async () => {
    try {
      const list = await listScenarios();
      setScenarios(list);

      if (list.length === 0 && !migrationDoneRef.current) {
        migrationDoneRef.current = true;
        const localDraft = loadStoredInputs();
        const isNonDefault = JSON.stringify(localDraft) !== JSON.stringify(DEFAULT_BUYING_INPUTS);
        if (isNonDefault) {
          try {
            const saved = await saveScenario(localDraft, 'My Scenario', undefined, true);
            setActiveScenarioIdState(saved.id);
            setSyncStatus('saved');
            setTimeout(() => setSyncStatus('idle'), 2000);
          } catch { /* migration failed, continue with local */ }
        }
        return;
      }

      const active = getActiveScenarioId();
      const match = active ? list.find((s) => s.id === active) : list.find((s) => s.is_default) ?? list[0];
      if (match) {
        const merged = { ...DEFAULT_BUYING_INPUTS, ...match.inputs };
        setInputs(merged);
        setActiveScenarioIdState(match.id);
        try { localStorage.removeItem(STORAGE_KEY); } catch { /* */ }
      }
    } catch { /* fallback to localStorage */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (authStatus !== 'loading') loadFromCloud();
  }, [loadFromCloud, authStatus]);

  useEffect(() => {
    if (isAuthenticated) return;
    if (localSaveRef.current) clearTimeout(localSaveRef.current);
    localSaveRef.current = setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs)); } catch { /* */ }
    }, LOCAL_SAVE_DEBOUNCE_MS);
    return () => { if (localSaveRef.current) clearTimeout(localSaveRef.current); };
  }, [inputs, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
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
  }, [inputs, activeScenarioId, isAuthenticated]);

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
      setInputs((prev) => {
        const next = { ...prev, [field]: value };
        if (
          (field === 'isFirstTimeHomeBuyer' || field === 'isNewBuild') &&
          !next.isFirstTimeHomeBuyer &&
          !next.isNewBuild &&
          next.mortgageAmortizationYears > 25
        ) {
          next.mortgageAmortizationYears = 25;
        }
        return next;
      });
    }
  };

  const handleWithdrawalOrderChange = (order: typeof inputs.retirementWithdrawalOrder) => {
    setInputs((prev) => ({ ...prev, retirementWithdrawalOrder: order }));
  };

  const handleResetToDefaults = () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* */ }
    setInputs(DEFAULT_BUYING_INPUTS);
  };

  const renderActiveSection = () => {
    switch (activeSection) {
      case 'budget':
        return <BudgetSection values={inputs} onChange={handleChange} firstYearRow={firstRow} />;
      case 'housing':
        return <HousingSection values={inputs} onChange={handleChange} />;
      case 'investments':
        return <InvestmentsSection values={inputs} onChange={handleChange} />;
      case 'retirement':
        return (
          <RetirementSection
            values={inputs}
            onChange={handleChange}
            onWithdrawalOrderChange={handleWithdrawalOrderChange}
            retirementMonthlyHousing={retirementMonthlyHousing}
          />
        );
    }
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-slate-800 flex items-center justify-between shrink-0">
        <h2 className="font-display text-sm font-semibold text-slate-200">Assumptions</h2>
        <div className="flex items-center gap-3">
          {isAuthenticated && (
            <span className="flex items-center gap-1 text-xs">
              {syncStatus === 'saving' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
              {syncStatus === 'saved' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />}
              {syncStatus === 'error' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-400" />}
              {syncStatus === 'idle' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-500" />}
              <span className="text-slate-500">Saved</span>
            </span>
          )}
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
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Section nav */}
      <div className="p-2 border-b border-slate-800 shrink-0">
        <SectionNav active={activeSection} onSelect={setActiveSection} values={inputs} />
      </div>

      {/* Active section inputs */}
      <div className="flex-1 overflow-y-auto p-3">
        {renderActiveSection()}
      </div>
    </div>
  );

  return (
    <div className="flex flex-1 min-h-0 w-full max-w-[1800px] mx-auto">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-[340px] shrink-0 border-r border-slate-800 bg-slate-900/30 flex-col overflow-hidden">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-x-0 top-12 bottom-0 z-40 flex flex-col bg-slate-950/95 backdrop-blur-sm">
          {sidebarContent}
        </div>
      )}

      {/* Main results stage */}
      <main className="flex-1 min-w-0 flex flex-col overflow-auto">
        <div className="p-3 sm:p-4 lg:p-6 space-y-4">
          <header>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-white tracking-tight">
              Your net worth, mapped
            </h1>
            <p className="mt-0.5 text-slate-400 text-xs sm:text-sm">
              Model housing, investments, and taxes over your lifetime. Adjust assumptions on the left.
            </p>
          </header>

          <ResultsStage
            rows={rows}
            buyNowRows={buyNowRows}
            comparisonYear={comparisonYear}
            retirementYear={retirementYear}
            suggestions={suggestions}
          />
        </div>
      </main>

      {/* Mobile floating button */}
      <button
        type="button"
        onClick={() => setSidebarOpen(true)}
        className="lg:hidden fixed bottom-4 right-4 z-30 flex items-center gap-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-3 shadow-lg shadow-emerald-900/40 transition active:scale-95"
        aria-label="Edit assumptions"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
        </svg>
        <span className="text-sm font-medium">Edit</span>
      </button>
    </div>
  );
}
