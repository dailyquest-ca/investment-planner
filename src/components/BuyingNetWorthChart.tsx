import { useState } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts';
import type { BuyingYearRow } from '../lib/buyingProjection';

interface BuyingNetWorthChartProps {
  rows: BuyingYearRow[];
  retirementYear: number | null;
}

function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  return `$${Math.round(value)}`;
}

type ChartMode = 'total' | 'stacked' | 'cashflow';

const assetColors = {
  houseEquity: '#0ea5e9',
  tfsa: '#10b981',
  rrsp: '#a855f7',
  nonRegistered: '#f472b6',
  helocDividend: '#eab308',
  helocGrowth: '#f59e0b',
  helocDebt: '#ef4444',
};

const cashflowColors = {
  salary: '#10b981',
  partTime: '#34d399',
  dividends: '#eab308',
  withdrawals: '#f472b6',
  taxes: '#ef4444',
  housing: '#0ea5e9',
  expenses: '#f59e0b',
  savings: '#a855f7',
  helocInterest: '#c084fc',
};

const TAB_OPTIONS: { value: ChartMode; label: string }[] = [
  { value: 'total', label: 'Total' },
  { value: 'stacked', label: 'By asset' },
  { value: 'cashflow', label: 'Cash flow' },
];

export function BuyingNetWorthChart({ rows, retirementYear }: BuyingNetWorthChartProps) {
  const [mode, setMode] = useState<ChartMode>('total');

  const retirementLabel = retirementYear != null
    ? rows.find(r => r.year === retirementYear)
    : null;
  const retirementXValue = retirementLabel
    ? `${retirementLabel.year} (${retirementLabel.age})`
    : undefined;

  const xInterval = Math.max(0, Math.floor(rows.length / 10) - 1);

  const netWorthData = rows.map((r) => ({
    yearLabel: `${r.year} (${r.age})`,
    netWorth: Math.round(r.netWorth),
    houseEquity: Math.round(r.houseEquity),
    tfsa: Math.round(r.tfsaBalance),
    rrsp: Math.round(r.rrspBalance),
    nonRegistered: Math.round(r.nonRegisteredBalance),
    helocDividend: Math.round(r.helocDividendBalance),
    helocGrowth: Math.round(r.helocGrowthBalance),
    helocDebt: -Math.round(r.helocBalance),
  }));

  const yearsUntilRetirement = retirementYear != null
    ? retirementYear - new Date().getFullYear()
    : rows.length;

  const cashflowData = rows.map((r, i) => {
    const isRetired = i >= yearsUntilRetirement;
    const totalSavings = r.tfsaContributions + r.rrspContributions + r.nonRegisteredContributions;
    const withdrawals = r.tfsaWithdrawals + r.rrspWithdrawals + r.nonRegisteredWithdrawals + r.helocWithdrawals;
    return {
      yearLabel: `${r.year} (${r.age})`,
      salary: Math.round(isRetired ? 0 : r.grossIncome),
      partTime: Math.round(isRetired ? r.grossIncome : 0),
      dividends: Math.round(r.yearlyDividendIncome),
      withdrawals: Math.round(withdrawals),
      taxes: Math.round(r.incomeTax),
      housing: Math.round(r.yearlyHousingCosts),
      expenses: Math.round(r.nonHousingExpenses),
      savings: Math.round(totalSavings),
      helocInterest: Math.round(Math.max(0, r.yearlyHelocInterest - r.yearlyDividendIncome)),
    };
  });

  return (
    <div className="rounded-2xl bg-slate-800/60 border border-slate-700/80 overflow-hidden shadow-xl">
      <div className="px-4 py-3 border-b border-slate-700 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold text-slate-100">
          {mode === 'cashflow' ? 'Cash flow over time' : 'Net worth over time'}
        </h2>
        <div className="flex rounded-lg bg-slate-900/80 p-0.5 border border-slate-600">
          {TAB_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={`px-3 py-1.5 text-sm rounded-md transition ${mode === value ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400 hover:text-slate-200'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="p-4 h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          {mode === 'cashflow' ? (
            <BarChart data={cashflowData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="yearLabel"
                stroke="#94a3b8"
                tick={{ fontSize: 11 }}
                axisLine={{ stroke: '#475569' }}
                interval={xInterval}
              />
              <YAxis
                stroke="#94a3b8"
                tick={{ fontSize: 11 }}
                axisLine={{ stroke: '#475569' }}
                tickFormatter={formatCurrency}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                labelStyle={{ color: '#e2e8f0' }}
                formatter={(value: number, name: string) => [formatCurrency(value), name]}
              />
              {retirementXValue && (
                <ReferenceLine
                  x={retirementXValue}
                  stroke="#f59e0b"
                  strokeDasharray="4 4"
                  label={{ value: 'Retirement', fill: '#f59e0b', fontSize: 10 }}
                />
              )}
              <Bar dataKey="salary" name="Salary" stackId="in" fill={cashflowColors.salary} fillOpacity={0.85} />
              <Bar dataKey="partTime" name="Part-time" stackId="in" fill={cashflowColors.partTime} fillOpacity={0.85} />
              <Bar dataKey="dividends" name="Dividends" stackId="in" fill={cashflowColors.dividends} fillOpacity={0.85} />
              <Bar dataKey="withdrawals" name="Withdrawals" stackId="in" fill={cashflowColors.withdrawals} fillOpacity={0.85} />
              <Bar dataKey="taxes" name="Taxes" stackId="out" fill={cashflowColors.taxes} fillOpacity={0.85} />
              <Bar dataKey="housing" name="Housing" stackId="out" fill={cashflowColors.housing} fillOpacity={0.85} />
              <Bar dataKey="expenses" name="Expenses" stackId="out" fill={cashflowColors.expenses} fillOpacity={0.85} />
              <Bar dataKey="helocInterest" name="HELOC interest" stackId="out" fill={cashflowColors.helocInterest} fillOpacity={0.85} />
              <Bar dataKey="savings" name="Savings" stackId="out" fill={cashflowColors.savings} fillOpacity={0.85} />
              <Legend wrapperStyle={{ fontSize: 11 }} formatter={(value) => <span className="text-slate-300">{value}</span>} />
            </BarChart>
          ) : (
            <AreaChart data={netWorthData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="fillNetWorth" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="fillHouse" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={assetColors.houseEquity} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={assetColors.houseEquity} stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="fillTfsa" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={assetColors.tfsa} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={assetColors.tfsa} stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="fillRrsp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={assetColors.rrsp} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={assetColors.rrsp} stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="fillNonReg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={assetColors.nonRegistered} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={assetColors.nonRegistered} stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="fillHelocDividend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={assetColors.helocDividend} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={assetColors.helocDividend} stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="fillHelocGrowth" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={assetColors.helocGrowth} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={assetColors.helocGrowth} stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="yearLabel"
                stroke="#94a3b8"
                tick={{ fontSize: 11 }}
                axisLine={{ stroke: '#475569' }}
                interval={xInterval}
              />
              <YAxis
                stroke="#94a3b8"
                tick={{ fontSize: 11 }}
                axisLine={{ stroke: '#475569' }}
                tickFormatter={formatCurrency}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                labelStyle={{ color: '#e2e8f0' }}
                labelFormatter={(label) => `${label}`}
                formatter={(value: number, name: string) => [formatCurrency(value), name || 'Net worth']}
              />
              {retirementXValue && (
                <ReferenceLine
                  x={retirementXValue}
                  stroke="#f59e0b"
                  strokeDasharray="4 4"
                  label={{ value: 'Retirement', fill: '#f59e0b', fontSize: 10 }}
                />
              )}
              {mode === 'total' ? (
                <Area
                  type="monotone"
                  dataKey="netWorth"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#fillNetWorth)"
                  name="Net worth"
                />
              ) : (
                <>
                  <Area type="monotone" dataKey="houseEquity" stackId="1" stroke={assetColors.houseEquity} fill="url(#fillHouse)" name="House equity" />
                  <Area type="monotone" dataKey="tfsa" stackId="1" stroke={assetColors.tfsa} fill="url(#fillTfsa)" name="TFSA" />
                  <Area type="monotone" dataKey="rrsp" stackId="1" stroke={assetColors.rrsp} fill="url(#fillRrsp)" name="RRSP (after tax)" />
                  <Area type="monotone" dataKey="nonRegistered" stackId="1" stroke={assetColors.nonRegistered} fill="url(#fillNonReg)" name="Non-Registered" />
                  <Area type="monotone" dataKey="helocDividend" stackId="1" stroke={assetColors.helocDividend} fill="url(#fillHelocDividend)" name="HELOC dividend" />
                  <Area type="monotone" dataKey="helocGrowth" stackId="1" stroke={assetColors.helocGrowth} fill="url(#fillHelocGrowth)" name="HELOC growth" />
                  <Area type="monotone" dataKey="helocDebt" stackId="1" stroke={assetColors.helocDebt} fill={assetColors.helocDebt} fillOpacity={0.3} name="HELOC debt" />
                  <Legend wrapperStyle={{ fontSize: 11 }} formatter={(value) => <span className="text-slate-300">{value}</span>} />
                </>
              )}
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
