import type { BuyingYearRow } from '../lib/buyingProjection';

interface SummaryBannerProps {
  /** Current scenario (rent then buy, or buy now) */
  rows: BuyingYearRow[];
  /** When yearsUntilPurchase > 0: rows for "buy now" scenario */
  buyNowRows?: BuyingYearRow[] | null;
  /** Year to compare (e.g. retirement year or last year) */
  comparisonYear: number;
  retirementYear: number | null;
}

function fmt(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(value);
}

export function SummaryBanner({ rows, buyNowRows, comparisonYear, retirementYear }: SummaryBannerProps) {
  if (rows.length === 0) return null;

  const currentAtCompare = rows.find((r) => r.year === comparisonYear);
  const currentNetWorth = currentAtCompare?.netWorth ?? rows[rows.length - 1]?.netWorth ?? 0;

  const hasComparison = buyNowRows != null && buyNowRows.length > 0;
  const buyNowAtCompare = hasComparison ? buyNowRows.find((r) => r.year === comparisonYear) : null;
  const buyNowNetWorth = buyNowAtCompare?.netWorth ?? (hasComparison ? buyNowRows[buyNowRows.length - 1]?.netWorth ?? 0 : 0);

  const difference = currentNetWorth - buyNowNetWorth;
  const winner = difference >= 0 ? 'Rent then buy' : 'Buy now';
  const diffLabel = Math.abs(difference) >= 1_000_000
    ? `$${(Math.abs(difference) / 1_000_000).toFixed(2)}M`
    : `$${Math.round(Math.abs(difference)).toLocaleString()}`;

  return (
    <div
      className="rounded-xl border px-4 py-3 sm:px-5 sm:py-4"
      style={{
        backgroundColor: 'rgba(15, 23, 42, 0.8)',
        borderColor: difference >= 0 ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)',
      }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
            {retirementYear === comparisonYear ? 'At retirement' : `Year ${comparisonYear}`}
          </p>
          <p className="mt-0.5 text-2xl sm:text-3xl font-display font-bold tabular-nums text-white">
            {fmt(currentNetWorth)}
          </p>
          <p className="text-xs text-slate-400">Projected net worth</p>
        </div>
        {hasComparison && (
          <div className="text-right">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Strategy comparison</p>
            <p
              className={`mt-0.5 text-xl sm:text-2xl font-display font-bold tabular-nums ${
                difference >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {winner} +{diffLabel}
            </p>
            <p className="text-[11px] text-slate-500">
              vs.&nbsp;{difference >= 0 ? 'buying immediately' : 'renting then buying'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
