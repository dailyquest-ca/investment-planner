'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { runBuyingProjection } from '../../lib/buyingProjection';
import { DEFAULT_BUYING_INPUTS, type BuyingScenarioInputs } from '../../types/buying';
import { listScenarios } from '../../lib/sync';

const STORAGE_KEY = 'net-worth-planner-inputs';

function fmt(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}k`;
  return `$${value}`;
}

function loadLocalInputs(): BuyingScenarioInputs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_BUYING_INPUTS;
    return { ...DEFAULT_BUYING_INPUTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_BUYING_INPUTS;
  }
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [inputs, setInputs] = useState<BuyingScenarioInputs | null>(null);

  useEffect(() => {
    async function load() {
      if (status === 'authenticated') {
        try {
          const list = await listScenarios();
          const match = list.find((s) => s.is_default) ?? list[0];
          if (match) {
            setInputs({ ...DEFAULT_BUYING_INPUTS, ...match.inputs });
            return;
          }
        } catch { /* fall through to local */ }
      }
      setInputs(loadLocalInputs());
    }
    if (status !== 'loading') load();
  }, [status]);

  const rows = useMemo(() => (inputs ? runBuyingProjection(inputs) : []), [inputs]);

  if (status === 'loading' || !inputs) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <h1 className="font-display text-2xl font-bold text-white">Welcome to Finpath</h1>
          <p className="text-slate-400 max-w-md mx-auto">
            Model housing, investments, and taxes over your lifetime. Start by setting up your plan.
          </p>
          <Link
            href="/plan"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition"
          >
            Start planning
            <span aria-hidden>&rarr;</span>
          </Link>
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
            ? `Welcome back`
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
        <Link href="/plan" className="inline-block text-xs text-emerald-400 hover:text-emerald-300 transition">
          Edit plan &rarr;
        </Link>
      </div>

    </div>
  );
}
