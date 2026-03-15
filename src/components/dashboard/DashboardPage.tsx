'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { runBuyingProjection } from '../../lib/buyingProjection';
import {
  DEFAULT_BUYING_INPUTS,
  setupToScenarioInputs,
  type BuyingScenarioInputs,
  type SetupInputs,
} from '../../types/buying';
import { listScenarios, saveScenario } from '../../lib/sync';
import {
  getBuyingInputs,
  setBuyingInputs,
  isSetupDone,
  markSetupDone,
} from '../../lib/storage';
import {
  saveActuals,
  getLatestActuals,
  currentYearMonth,
  type MonthlyActualsData,
  type MonthlyActualsRecord,
} from '../../lib/actuals';
import { BuyingNetWorthChart } from '../BuyingNetWorthChart';
import { DashboardSetup } from './DashboardSetup';

function fmt(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}k`;
  return `$${value}`;
}

function loadLocalInputs(): BuyingScenarioInputs | null {
  const raw = getBuyingInputs();
  if (!raw) return null;
  try {
    return { ...DEFAULT_BUYING_INPUTS, ...JSON.parse(raw) };
  } catch {
    return null;
  }
}

/**
 * Overlay the latest actuals balances onto a scenario input so the
 * projection starts from observed reality rather than stale setup values.
 */
function applyActualsToInputs(
  inputs: BuyingScenarioInputs,
  actuals: MonthlyActualsRecord,
): BuyingScenarioInputs {
  const d = actuals.data;
  const merged = { ...inputs };
  if (d.accountBalances) {
    merged.currentTFSABalance = d.accountBalances.tfsa;
    merged.currentRRSPBalance = d.accountBalances.rrsp;
    merged.currentFHSABalance = d.accountBalances.fhsa;
  }
  if (d.actualGrossIncome != null) merged.householdGrossIncome = d.actualGrossIncome;
  if (d.actualMonthlyExpenses != null) merged.monthlyNonHousingExpenses = d.actualMonthlyExpenses;
  return merged;
}

type DashboardState = 'loading' | 'setup' | 'summary';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [inputs, setInputs] = useState<BuyingScenarioInputs | null>(null);
  const [dashState, setDashState] = useState<DashboardState>('loading');

  useEffect(() => {
    async function load() {
      const isAuth = status === 'authenticated';
      let base: BuyingScenarioInputs | null = null;

      if (isAuth) {
        try {
          const list = await listScenarios();
          const match = list.find((s) => s.is_default) ?? list[0];
          if (match) base = { ...DEFAULT_BUYING_INPUTS, ...match.inputs };
        } catch { /* fall through */ }
      }

      if (!base) {
        const local = loadLocalInputs();
        if (local && isSetupDone()) base = local;
      }

      if (!base) {
        setDashState('setup');
        return;
      }

      try {
        const latest = await getLatestActuals(isAuth);
        if (latest) base = applyActualsToInputs(base, latest);
      } catch { /* proceed with scenario-only data */ }

      setInputs(base);
      setDashState('summary');
    }
    if (status !== 'loading') load();
  }, [status]);

  const handleSetupComplete = async (setup: SetupInputs) => {
    const scenario = setupToScenarioInputs(setup);
    setInputs(scenario);
    markSetupDone();

    setBuyingInputs(JSON.stringify(scenario));

    const isAuth = status === 'authenticated';

    if (isAuth) {
      try {
        await saveScenario(scenario, 'My Scenario', undefined, true);
      } catch { /* local draft is fine */ }
    }

    const actualsData: MonthlyActualsData = {
      accountBalances: {
        tfsa: setup.currentTFSABalance,
        rrsp: setup.currentRRSPBalance,
        fhsa: setup.currentFHSABalance,
        nonRegistered: 0,
        cashOnHand: 0,
      },
      actualGrossIncome: setup.householdGrossIncome,
      actualMonthlyExpenses: setup.monthlyNonHousingExpenses,
      actualMonthlyHousingCost: setup.monthlyRent,
    };
    try {
      await saveActuals(currentYearMonth(), actualsData, isAuth);
    } catch { /* best effort */ }

    setDashState('summary');
  };

  const rows = useMemo(() => (inputs ? runBuyingProjection(inputs) : []), [inputs]);

  if (dashState === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (dashState === 'setup') {
    return <DashboardSetup onComplete={handleSetupComplete} />;
  }

  if (!inputs || rows.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <h1 className="font-display text-2xl font-bold text-white">Welcome to Finpath</h1>
          <p className="text-slate-400 max-w-md mx-auto">
            Something went wrong loading your plan. Try starting fresh.
          </p>
          <button
            type="button"
            onClick={() => setDashState('setup')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition"
          >
            Start over
          </button>
        </div>
      </div>
    );
  }

  const retirementYear = new Date().getFullYear() + Math.max(0, inputs.retirementAge - inputs.currentAge);
  const atRetirement = rows.find((r) => r.year === retirementYear);
  const last = rows[rows.length - 1];
  const peak = rows.reduce((best, r) => (r.netWorth > best.netWorth ? r : best), rows[0]);

  const cards = [
    {
      label: 'Net worth at retirement',
      value: atRetirement ? fmt(atRetirement.netWorth) : '—',
      sub: atRetirement ? `Age ${atRetirement.age}` : '',
      positive: atRetirement ? atRetirement.netWorth >= 0 : undefined,
    },
    {
      label: 'Peak net worth',
      value: fmt(peak.netWorth),
      sub: `Age ${peak.age}`,
      positive: peak.netWorth >= 0,
    },
    {
      label: 'End of plan',
      value: fmt(last.netWorth),
      sub: `Age ${last.age}`,
      positive: last.netWorth >= 0,
    },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12 space-y-8">
      {/* Hero */}
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">
          {session?.user?.email
            ? 'Welcome back'
            : 'Your financial snapshot'}
        </h1>
        <p className="mt-1 text-slate-400 text-sm">
          {session?.user
            ? 'Your plan is synced across devices. Dive deeper in Plan or Track mode.'
            : 'A quick overview of your projected plan. Sign in to sync across devices.'}
        </p>
      </div>

      {/* Sign-in prompt for anonymous users */}
      {!session?.user && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-medium text-emerald-400">Save your progress</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Sign in to sync your plan across devices and keep your data safe.
            </p>
          </div>
          <Link
            href="/auth/signin"
            className="shrink-0 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition"
          >
            Sign in
          </Link>
        </div>
      )}

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {cards.map(({ label, value, sub, positive }) => (
          <div
            key={label}
            className="rounded-xl bg-slate-800/60 border border-slate-700/80 px-4 py-3"
          >
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">{label}</p>
            <p
              className={`mt-1 text-2xl font-display font-bold tabular-nums ${
                positive === true ? 'text-emerald-400' : positive === false ? 'text-rose-400' : 'text-white'
              }`}
            >
              {value}
            </p>
            <p className="text-xs text-slate-500">{sub}</p>
          </div>
        ))}
      </div>

      {/* Net worth projection chart */}
      <section className="rounded-xl bg-slate-800/60 border border-slate-700/80 overflow-hidden shadow-lg">
        <BuyingNetWorthChart rows={rows} retirementYear={retirementYear} />
      </section>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link
          href="/plan"
          className="group rounded-xl border border-slate-700/80 bg-slate-800/40 hover:bg-slate-800/70 p-5 transition"
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl" aria-hidden>&#x1F4D0;</span>
            <h2 className="font-display text-lg font-semibold text-white group-hover:text-emerald-400 transition">
              Plan
            </h2>
          </div>
          <p className="text-sm text-slate-400">
            Explore different scenarios. Adjust income, housing, investments, and retirement assumptions to find your
            optimal path.
          </p>
        </Link>

        <Link
          href="/track"
          className="group rounded-xl border border-slate-700/80 bg-slate-800/40 hover:bg-slate-800/70 p-5 transition"
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl" aria-hidden>&#x1F4CA;</span>
            <h2 className="font-display text-lg font-semibold text-white group-hover:text-emerald-400 transition">
              Track
            </h2>
          </div>
          <p className="text-sm text-slate-400">
            Log your real balances, income, and expenses. See how your actual progress compares to your plan.
          </p>
        </Link>
      </div>

      {/* Plan summary */}
      <div className="rounded-xl border border-slate-700/80 bg-slate-800/40 p-5 space-y-3">
        <h2 className="font-display text-sm font-semibold text-slate-300">Current plan assumptions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <p className="text-slate-500">Income</p>
            <p className="text-slate-200 font-medium">{fmt(inputs.householdGrossIncome)}/yr</p>
          </div>
          <div>
            <p className="text-slate-500">Housing</p>
            <p className="text-slate-200 font-medium">
              {inputs.buyingHouse ? fmt(inputs.buyAmount) : `${fmt(inputs.monthlyRent * 12)}/yr rent`}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Retirement age</p>
            <p className="text-slate-200 font-medium">{inputs.retirementAge}</p>
          </div>
          <div>
            <p className="text-slate-500">Growth rate</p>
            <p className="text-slate-200 font-medium">{inputs.investmentGrowthRate}%</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Link href="/plan" className="inline-block text-xs text-emerald-400 hover:text-emerald-300 transition">
            Adjust advanced assumptions &rarr;
          </Link>
          <button
            type="button"
            onClick={() => setDashState('setup')}
            className="inline-block text-xs text-slate-500 hover:text-slate-300 transition"
          >
            Redo setup
          </button>
        </div>
      </div>
    </div>
  );
}
