import { runBuyingProjection, type BuyingYearRow } from './buyingProjection';
import type { BuyingScenarioInputs } from '../types/buying';

export type SuggestionKind = 'warning' | 'tip' | 'success';

export interface Suggestion {
  kind: SuggestionKind;
  title: string;
  description: string;
  action?: string;
}

function fmtCurrency(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `$${Math.round(value / 1_000)}k`;
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(value);
}

export function getSuggestions(inputs: BuyingScenarioInputs, rows: BuyingYearRow[]): Suggestion[] {
  const out: Suggestion[] = [];
  if (rows.length === 0) return out;

  const projectionYears = rows.length;
  const yearsUntilRetirement = Math.max(0, inputs.retirementAge - inputs.currentAge);
  const retirementYear = new Date().getFullYear() + yearsUntilRetirement;
  const firstRow = rows[0];
  const lastRow = rows[rows.length - 1];
  const atRetirement = rows.find((r) => r.year === retirementYear);

  // Shortfall in retirement
  const shortfallRows = rows.filter((r) => r.amountNotCoveredByInvestments > 0);
  if (shortfallRows.length > 0) {
    const maxShortfall = Math.max(...shortfallRows.map((r) => r.amountNotCoveredByInvestments));
    out.push({
      kind: 'warning',
      title: 'Retirement shortfall',
      description: `In ${shortfallRows.length} year(s) your investments can't cover needs (up to ${fmtCurrency(maxShortfall)}/year). This includes living expenses, housing, and HELOC interest not covered by dividends.`,
      action: 'Increase pre-retirement savings, reduce retirement spending, raise dividend yield to cover more HELOC interest, or adjust withdrawal order.',
    });
  } else if (atRetirement && yearsUntilRetirement > 0) {
    out.push({
      kind: 'success',
      title: 'Retirement funded',
      description: 'Your investments cover retirement needs (living + housing + HELOC interest shortfall) through the full projection.',
    });
  }

  // HELOC interest coverage
  if (rows.some((r) => r.helocBalance > 0)) {
    const retiredRows = rows.filter((_, i) => i >= yearsUntilRetirement);
    const uncoveredInterest = retiredRows.filter((r) => r.yearlyDividendIncome < r.yearlyHelocInterest);
    if (uncoveredInterest.length > 0) {
      const worstGap = Math.max(...uncoveredInterest.map((r) => r.yearlyHelocInterest - r.yearlyDividendIncome));
      out.push({
        kind: 'tip',
        title: 'Dividends don\'t fully cover HELOC interest in retirement',
        description: `In ${uncoveredInterest.length} retirement year(s), dividends fall short by up to ${fmtCurrency(worstGap)}/year. That shortfall is drawn from your investment accounts.`,
        action: 'A higher dividend yield or lower HELOC rate would reduce the cash drag.',
      });
    }
  }

  // Down payment comparison
  if (inputs.percentageDownpayment < 25 && inputs.buyAmount > 0) {
    const altInputs: BuyingScenarioInputs = { ...inputs, percentageDownpayment: Math.min(100, inputs.percentageDownpayment + 5) };
    const altRows = runBuyingProjection(altInputs);
    const totalInterestCurrent = rows.reduce((sum, r) => sum + r.yearlyMortgageInterestPaid, 0);
    const totalInterestAlt = altRows.reduce((sum, r) => sum + r.yearlyMortgageInterestPaid, 0);
    const saved = totalInterestCurrent - totalInterestAlt;
    if (saved > 500) {
      out.push({
        kind: 'tip',
        title: 'Higher down payment could save interest',
        description: `Putting 5% more down (${fmtCurrency(inputs.buyAmount * 0.05)}) saves ~${fmtCurrency(saved)} in mortgage interest.`,
        action: 'Only if you keep enough liquidity for emergencies.',
      });
    }
  }

  // Net worth trajectory
  const growth = lastRow.netWorth - firstRow.netWorth;
  if (growth > 0) {
    out.push({
      kind: 'success',
      title: 'Net worth trajectory',
      description: `Net worth grows from ${fmtCurrency(firstRow.netWorth)} to ${fmtCurrency(lastRow.netWorth)} over ${projectionYears} years (+${fmtCurrency(growth)}).`,
    });
  } else if (growth < 0) {
    out.push({
      kind: 'warning',
      title: 'Net worth declining',
      description: `Net worth drops from ${fmtCurrency(firstRow.netWorth)} to ${fmtCurrency(lastRow.netWorth)} by end of projection.`,
    });
  }

  // Cash-flow deficit during working years
  const workingRows = rows.slice(0, Math.min(yearsUntilRetirement, rows.length));
  const deficitRows = workingRows.filter((r) => r.remainingForInvestment < 0);
  if (deficitRows.length > 0) {
    const worstDeficit = Math.min(...deficitRows.map((r) => r.remainingForInvestment));
    out.push({
      kind: 'warning',
      title: 'Cash-flow negative in working years',
      description: `In ${deficitRows.length} working year(s), expenses + housing + HELOC interest exceeds your net income (worst: ${fmtCurrency(worstDeficit)}/year). You'd need to dip into savings or other income to cover costs.`,
      action: 'Consider a lower purchase price, higher income, or lower expenses to keep cash flow positive.',
    });
  }

  // Low investment room early
  const earlyYears = rows.slice(0, Math.min(5, rows.length));
  const avgRemaining = earlyYears.reduce((s, r) => s + r.remainingForInvestment, 0) / earlyYears.length;
  if (avgRemaining < 500 && avgRemaining >= 0 && yearsUntilRetirement > 2) {
    out.push({
      kind: 'tip',
      title: 'Little left for investments early on',
      description: 'Most of your income goes to expenses, housing, and HELOC interest, leaving little for TFSA/RRSP in the early years.',
      action: 'Contributions tend to rise as income grows and mortgage principal is paid.',
    });
  }

  // RRSP room maxed out (non-reg overflow growing)
  const nonRegYears = workingRows.filter((r) => r.nonRegisteredContributions > 0 && r.rrspRoom <= 0);
  if (nonRegYears.length >= 3) {
    out.push({
      kind: 'tip',
      title: 'RRSP room maxed out',
      description: `In ${nonRegYears.length} working year(s), your RRSP room is fully used and excess goes to the non-registered account. This is normal once income outpaces the 18% room growth.`,
    });
  }

  // High effective tax rate
  const taxableWorkingRows = workingRows.filter((r) => r.grossIncome > 0);
  if (taxableWorkingRows.length > 0) {
    const avgEffectiveRate = taxableWorkingRows.reduce((s, r) => s + r.incomeTax / r.grossIncome, 0) / taxableWorkingRows.length;
    if (avgEffectiveRate > 0.35) {
      out.push({
        kind: 'tip',
        title: 'High effective tax rate',
        description: `Your average effective tax rate during working years is ${(avgEffectiveRate * 100).toFixed(1)}%. RRSP contributions and HELOC interest deductions help reduce this.`,
        action: 'Maximizing RRSP contributions provides the biggest tax deduction benefit.',
      });
    }
  }

  return out;
}
