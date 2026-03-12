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

  const peakRow = rows.reduce((best, r) => (r.netWorth > best.netWorth ? r : best), rows[0]);

  const stats = [
    { label: 'Starting net worth', value: fmtCurrency(first.netWorth), sub: `Age ${first.age}`, positive: first.netWorth >= 0 },
    ...(atRetirement ? [{ label: 'At retirement', value: fmtCurrency(atRetirement.netWorth), sub: `Age ${atRetirement.age}`, positive: atRetirement.netWorth >= 0 }] : []),
    { label: 'Peak net worth', value: fmtCurrency(peakRow.netWorth), sub: `Age ${peakRow.age}`, positive: peakRow.netWorth >= 0 },
    { label: `End of plan`, value: fmtCurrency(last.netWorth), sub: `Age ${last.age} (${last.year})`, positive: last.netWorth >= 0 },
    ...(workingRows.length > 0 ? [{ label: 'Avg tax rate', value: `${(avgTaxRate * 100).toFixed(1)}%`, sub: 'Federal + BC combined', positive: undefined as boolean | undefined }] : []),
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
      {stats.map(({ label, value, sub, positive }) => (
        <div
          key={label}
          className="rounded-lg bg-slate-800/60 border border-slate-700/80 px-3 py-2"
        >
          <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">{label}</p>
          <p
            className={`mt-0.5 text-lg font-display font-semibold tabular-nums ${
              positive === true ? 'text-emerald-400' : positive === false ? 'text-rose-400' : 'text-white'
            }`}
          >
            {value}
          </p>
          <p className="text-[11px] text-slate-500">{sub}</p>
        </div>
      ))}
    </div>
  );
}
