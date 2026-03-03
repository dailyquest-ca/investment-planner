import type { ProjectionResult } from '../lib/projection';

interface InsightsProps {
  result: ProjectionResult;
  retirementAge: number;
  currentAge: number;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

export function Insights({ result, retirementAge, currentAge }: InsightsProps) {
  const yearsToRetirement = Math.max(0, retirementAge - currentAge);
  const retirementReadyYear = result.retirementReadyYear;
  const windDownYear = result.windDownYear;

  return (
    <div className="rounded-2xl bg-slate-800/60 border border-slate-700/80 p-6 shadow-xl">
      <h2 className="font-display text-lg font-semibold text-slate-100 mb-4">Insights</h2>
      <ul className="space-y-3 text-slate-300">
        <li>
          <span className="text-slate-400">Balance at retirement (age {retirementAge}):</span>{' '}
          <strong className="text-emerald-400">{formatCurrency(result.balanceAtRetirement)}</strong>{' '}
          <span className="text-slate-500 text-sm">(in today&apos;s dollars)</span>
        </li>
        {retirementReadyYear != null && (
          <li>
            <span className="text-slate-400">Portfolio reaches 25× annual spending (4% rule) in:</span>{' '}
            <strong className="text-amber-400">{retirementReadyYear}</strong>
            {retirementReadyYear <= new Date().getFullYear() + yearsToRetirement && (
              <span className="text-emerald-400 ml-1">— on track for your target age</span>
            )}
          </li>
        )}
        {windDownYear != null && (
          <li>
            <span className="text-slate-400">You can consider winding down contributions from:</span>{' '}
            <strong className="text-sky-400">{windDownYear}</strong>
            <span className="text-slate-500 text-sm"> (growth then covers new money)</span>
          </li>
        )}
        {retirementReadyYear == null && (
          <li className="text-slate-500 text-sm">
            Increase savings, returns, or time horizon to reach 25× spending.
          </li>
        )}
      </ul>
    </div>
  );
}
