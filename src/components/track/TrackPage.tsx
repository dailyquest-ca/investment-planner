'use client';

import Link from 'next/link';

export default function TrackPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12 space-y-8">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">
          Track your progress
        </h1>
        <p className="mt-1 text-slate-400 text-sm">
          Record your actual balances and see how reality compares to your plan.
        </p>
      </div>

      <div className="rounded-xl border border-slate-700/80 bg-slate-800/40 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-700/60 flex items-center justify-center">
            <span className="text-lg" aria-hidden>📊</span>
          </div>
          <div>
            <h2 className="font-display text-base font-semibold text-white">Coming soon</h2>
            <p className="text-xs text-slate-500">This feature is under development</p>
          </div>
        </div>

        <p className="text-sm text-slate-400 leading-relaxed">
          Track mode will let you:
        </p>
        <ul className="text-sm text-slate-400 space-y-2 ml-4">
          <li className="flex items-start gap-2">
            <span className="text-emerald-500 mt-0.5">&#x2022;</span>
            Enter your real account balances, income, and expenses periodically
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-500 mt-0.5">&#x2022;</span>
            Compare your actual trajectory against your chosen plan
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-500 mt-0.5">&#x2022;</span>
            See a projected future based on your real position and plan assumptions
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-500 mt-0.5">&#x2022;</span>
            Get alerts when you're ahead or behind your savings targets
          </li>
        </ul>

        <div className="pt-3 border-t border-slate-700/60">
          <p className="text-xs text-slate-500">
            In the meantime, use{' '}
            <Link href="/plan" className="text-emerald-400 hover:text-emerald-300 transition">
              Plan mode
            </Link>{' '}
            to model different scenarios and find your optimal strategy.
          </p>
        </div>
      </div>
    </div>
  );
}
