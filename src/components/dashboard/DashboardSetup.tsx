'use client';

import { useState } from 'react';
import {
  DEFAULT_SETUP_INPUTS,
  type HousingStatus,
  type SetupInputs,
} from '../../types/buying';

function CurrencyInput({
  id,
  label,
  value,
  step,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label htmlFor={id} className="block">
      <span className="block text-xs text-slate-400 mb-1">{label}</span>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
        <input
          id={id}
          type="number"
          min={0}
          step={step ?? 1000}
          value={value || ''}
          onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
          className="w-full rounded-lg bg-slate-800 border border-slate-700 text-slate-100 pl-7 pr-3 py-2.5 text-sm tabular-nums focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 outline-none transition"
        />
      </div>
    </label>
  );
}

function NumberInput({
  id,
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min?: number;
  max?: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label htmlFor={id} className="block">
      <span className="block text-xs text-slate-400 mb-1">{label}</span>
      <div className="relative">
        <input
          id={id}
          type="number"
          min={min ?? 0}
          max={max}
          step={1}
          value={value || ''}
          onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
          className="w-full rounded-lg bg-slate-800 border border-slate-700 text-slate-100 px-3 py-2.5 text-sm tabular-nums focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 outline-none transition"
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">{suffix}</span>
        )}
      </div>
    </label>
  );
}

const HOUSING_OPTIONS: { value: HousingStatus; label: string; desc: string }[] = [
  { value: 'renting', label: 'Renting', desc: 'I rent my home' },
  { value: 'own', label: 'Homeowner', desc: 'I own my home' },
  { value: 'planning_to_buy', label: 'Planning to buy', desc: 'I rent now, buying soon' },
];

export function DashboardSetup({ onComplete }: { onComplete: (setup: SetupInputs) => void }) {
  const [form, setForm] = useState<SetupInputs>({ ...DEFAULT_SETUP_INPUTS });

  const set = <K extends keyof SetupInputs>(key: K, value: SetupInputs[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
      <div className="text-center mb-10">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">
          Let&apos;s map your financial path
        </h1>
        <p className="mt-2 text-slate-400 text-sm sm:text-base max-w-lg mx-auto">
          Answer a few questions and we&apos;ll show you a projected net worth over time.
          You can fine-tune everything later.
        </p>
      </div>

      <div className="space-y-8">
        {/* About you */}
        <section className="rounded-xl border border-slate-700/80 bg-slate-800/40 p-5 space-y-4">
          <h2 className="font-display text-sm font-semibold text-slate-300 uppercase tracking-wider">About you</h2>

          <div>
            <span className="block text-xs text-slate-400 mb-2">Household type</span>
            <div className="flex gap-2">
              {([1, 2] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => set('numberOfIncomeEarners', n)}
                  className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition ${
                    form.numberOfIncomeEarners === n
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                      : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  {n === 1 ? 'Single' : 'Household (2)'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <NumberInput id="setup-age" label="Current age" value={form.currentAge} min={18} max={100} suffix="yrs" onChange={(v) => set('currentAge', v)} />
            <NumberInput id="setup-retire" label="Target retirement age" value={form.retirementAge} min={30} max={100} suffix="yrs" onChange={(v) => set('retirementAge', v)} />
          </div>

          <CurrencyInput id="setup-income" label="Household gross annual income" value={form.householdGrossIncome} step={5000} onChange={(v) => set('householdGrossIncome', v)} />
        </section>

        {/* Accounts */}
        <section className="rounded-xl border border-slate-700/80 bg-slate-800/40 p-5 space-y-4">
          <div>
            <h2 className="font-display text-sm font-semibold text-slate-300 uppercase tracking-wider">Current balances</h2>
            <p className="text-xs text-slate-500 mt-0.5">Rough numbers are fine &mdash; you can update these later.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <CurrencyInput id="setup-tfsa" label="TFSA" value={form.currentTFSABalance} onChange={(v) => set('currentTFSABalance', v)} />
            <CurrencyInput id="setup-rrsp" label="RRSP" value={form.currentRRSPBalance} onChange={(v) => set('currentRRSPBalance', v)} />
            <CurrencyInput id="setup-fhsa" label="FHSA" value={form.currentFHSABalance} onChange={(v) => set('currentFHSABalance', v)} />
          </div>
        </section>

        {/* Housing */}
        <section className="rounded-xl border border-slate-700/80 bg-slate-800/40 p-5 space-y-4">
          <h2 className="font-display text-sm font-semibold text-slate-300 uppercase tracking-wider">Housing</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {HOUSING_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => set('housingStatus', opt.value)}
                className={`rounded-lg border px-4 py-3 text-left transition ${
                  form.housingStatus === opt.value
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                }`}
              >
                <span className={`block text-sm font-medium ${form.housingStatus === opt.value ? 'text-emerald-400' : 'text-slate-300'}`}>
                  {opt.label}
                </span>
                <span className="block text-xs text-slate-500 mt-0.5">{opt.desc}</span>
              </button>
            ))}
          </div>

          {form.housingStatus !== 'own' && (
            <CurrencyInput
              id="setup-rent"
              label="Monthly rent"
              value={form.monthlyRent}
              step={100}
              onChange={(v) => set('monthlyRent', v)}
            />
          )}
        </section>

        {/* Expenses */}
        <section className="rounded-xl border border-slate-700/80 bg-slate-800/40 p-5 space-y-4">
          <div>
            <h2 className="font-display text-sm font-semibold text-slate-300 uppercase tracking-wider">Monthly expenses</h2>
            <p className="text-xs text-slate-500 mt-0.5">Everything except housing &mdash; food, transport, subscriptions, etc.</p>
          </div>
          <CurrencyInput
            id="setup-expenses"
            label="Non-housing expenses"
            value={form.monthlyNonHousingExpenses}
            step={100}
            onChange={(v) => set('monthlyNonHousingExpenses', v)}
          />
        </section>

        {/* Submit */}
        <button
          type="button"
          onClick={() => onComplete(form)}
          className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3.5 text-sm transition active:scale-[0.98]"
        >
          Show my projection &rarr;
        </button>
      </div>
    </div>
  );
}
