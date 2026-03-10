'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { YearProjection } from '../lib/projection';

interface NetWorthChartProps {
  data: YearProjection[];
  retirementAge?: number;
  currentAge?: number;
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}k`;
  return `$${Math.round(value)}`;
}

export function NetWorthChart({ data, retirementAge, currentAge }: NetWorthChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    balanceRealRounded: Math.round(d.balanceReal),
    yearLabel: d.year.toString(),
  }));

  const retirementYear = retirementAge != null && currentAge != null
    ? data.find((d) => d.age >= retirementAge)?.year
    : undefined;

  return (
    <div className="rounded-2xl bg-slate-800/60 border border-slate-700/80 p-6 shadow-xl h-[360px]">
      <h2 className="font-display text-lg font-semibold text-slate-100 mb-4">Net worth over time (today&apos;s $)</h2>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="fillReal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="yearLabel"
            stroke="#94a3b8"
            tick={{ fontSize: 12 }}
            axisLine={{ stroke: '#475569' }}
          />
          <YAxis
            stroke="#94a3b8"
            tick={{ fontSize: 12 }}
            axisLine={{ stroke: '#475569' }}
            tickFormatter={formatCurrency}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
            labelStyle={{ color: '#e2e8f0' }}
            formatter={(value: number) => [formatCurrency(value), 'Net worth (real)']}
            labelFormatter={(label) => `Year ${label}`}
          />
          {retirementYear != null && (
            <ReferenceLine
              x={retirementYear.toString()}
              stroke="#f59e0b"
              strokeDasharray="4 4"
              label={{ value: 'Retirement', fill: '#f59e0b', fontSize: 11 }}
            />
          )}
          <Area
            type="monotone"
            dataKey="balanceRealRounded"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#fillReal)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
