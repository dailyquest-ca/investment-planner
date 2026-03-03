import type { BuyingYearRow } from '../lib/buyingProjection';

interface SummaryStatsProps {
  rows: BuyingYearRow[];
  retirementYear: number | null;
}

function fmtCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(value);
}

export function SummaryStats({ rows, retirementYear }: SummaryStatsProps) {
  if (rows.length === 0) return null;

  const first = rows[0];
  const atRetirement = retirementYear != null ? rows.find((r) => r.year === retirementYear) : null;
  const last = rows[rows.length - 1];

  const workingRows = rows.filter((r) => r.grossIncome > 0);
  const avgTaxRate = workingRows.length > 0
    ? workingRows.reduce((s, r) => s + r.incomeTax, 0) / workingRows.reduce((s, r) => s + r.grossIncome, 0)
    : 0;

  const stats = [
    { label: 'Net worth today', value: fmtCurrency(first.netWorth), sub: `Age ${first.age}` },
    ...(atRetirement ? [{ label: 'Net worth at retirement', value: fmtCurrency(atRetirement.netWorth), sub: `Age ${atRetirement.age}` }] : []),
    { label: `Net worth at age ${last.age}`, value: fmtCurrency(last.netWorth), sub: `Year ${last.year}` },
    ...(workingRows.length > 0 ? [{ label: 'Avg effective tax rate', value: `${(avgTaxRate * 100).toFixed(1)}%`, sub: 'Federal + BC' }] : []),
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map(({ label, value, sub }) => (
        <div
          key={label}
          className="rounded-xl bg-slate-800/80 border border-slate-700/80 px-4 py-3"
        >
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</p>
          <p className="mt-1 text-xl font-display font-semibold text-white tabular-nums">
            {value}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
        </div>
      ))}
    </div>
  );
}
