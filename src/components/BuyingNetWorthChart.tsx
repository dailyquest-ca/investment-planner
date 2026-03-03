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

const assetColors: Record<string, string> = {
  houseEquity: '#0ea5e9',
  tfsa: '#10b981',
  rrsp: '#a855f7',
  nonRegistered: '#f472b6',
  helocDividend: '#eab308',
  helocGrowth: '#f59e0b',
  helocDebt: '#ef4444',
};

const assetLabels: Record<string, string> = {
  houseEquity: 'House equity',
  tfsa: 'TFSA',
  rrsp: 'RRSP',
  nonRegistered: 'Non-registered',
  helocDividend: 'HELOC dividend',
  helocGrowth: 'HELOC growth',
  helocDebt: 'HELOC debt',
};

const BREAKDOWN_KEYS = ['houseEquity', 'tfsa', 'rrsp', 'nonRegistered', 'helocDividend', 'helocGrowth', 'helocDebt'] as const;

function NetWorthTooltip({
  active,
  payload,
  label,
  data,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; dataKey: string }>;
  label?: string;
  data?: Array<Record<string, unknown>>;
}) {
  if (!active || !label) return null;
  const point = data?.find((d) => d.yearLabel === label) as Record<string, number> | undefined;
  const total = point?.netWorth ?? payload?.[0]?.value ?? 0;
  const isPositive = total >= 0;
  const breakdown = point
    ? BREAKDOWN_KEYS.filter((k) => typeof point[k] === 'number' && point[k] !== 0).map((k) => ({ key: k, value: point[k] as number }))
    : payload
        ?.filter((p) => p.dataKey !== 'netWorth' && typeof p.value === 'number')
        .map((p) => ({ key: p.dataKey, value: p.value })) ?? [];

  return (
    <div className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2.5 shadow-xl min-w-[200px]">
      <p className="text-xs font-medium text-slate-400 border-b border-slate-700 pb-1.5 mb-2">{label}</p>
      <div className="space-y-1">
        {breakdown.map(({ key, value }) => (
          <div key={key} className="flex justify-between gap-4 text-xs">
            <span className="text-slate-400" style={{ color: assetColors[key] ?? '#94a3b8' }}>
              {assetLabels[key] ?? key}
            </span>
            <span className={key === 'helocDebt' ? 'text-rose-400' : 'text-slate-200'} tabular-nums>
              {formatCurrency(value)}
            </span>
          </div>
        ))}
      </div>
      <div className="flex justify-between gap-4 mt-2 pt-2 border-t border-slate-700">
        <span className="text-xs font-semibold text-slate-300">Net worth</span>
        <span className={`text-sm font-bold tabular-nums ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
          {formatCurrency(total)}
        </span>
      </div>
    </div>
  );
}

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
    <div className="rounded-xl bg-slate-800/50 border border-slate-700/80 overflow-hidden shadow-lg">
      <div className="px-3 py-2 border-b border-slate-700/80 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-base font-semibold text-slate-100">
          {mode === 'cashflow' ? 'Cash flow' : 'Net worth'}
        </h2>
        <div className="flex rounded-md bg-slate-900/80 p-0.5 border border-slate-600">
          {TAB_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={`px-2.5 py-1 text-xs rounded transition ${mode === value ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400 hover:text-slate-200'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="p-3 h-[240px] sm:h-[320px]">
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
                content={({ active, payload, label }) => (
                  <NetWorthTooltip
                    active={active}
                    payload={payload as Array<{ name: string; value: number; dataKey: string }>}
                    label={label as string}
                    data={netWorthData}
                  />
                )}
                contentStyle={{ backgroundColor: 'transparent', border: 'none', padding: 0 }}
              />
              {retirementXValue && (
                <ReferenceLine
                  x={retirementXValue}
                  stroke="#f472b6"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  label={{ value: 'Retirement', fill: '#f472b6', fontSize: 11, fontWeight: 600 }}
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
