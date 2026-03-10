import { useState, useRef, useEffect } from 'react';
import type { BuyingYearRow } from '../lib/buyingProjection';

type ColumnKey = keyof BuyingYearRow;

function fmtCurrency(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(value);
}

function fmtPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

interface Column {
  key: ColumnKey;
  label: string;
  format: 'currency' | 'percent' | 'number';
  formula: string;
  defaultVisible?: boolean;
}

interface ColumnGroup {
  id: string;
  label: string;
  color: string;
  columns: Column[];
}

const COLUMN_GROUPS: ColumnGroup[] = [
  {
    id: 'overview',
    label: 'Overview',
    color: '#10b981',
    columns: [
      { key: 'year', label: 'Year', format: 'number', formula: 'Calendar year', defaultVisible: true },
      { key: 'age', label: 'Age', format: 'number', formula: 'Current age + year offset', defaultVisible: true },
      { key: 'netWorth', label: 'Net Worth', format: 'currency', formula: 'House equity + all account balances − HELOC debt', defaultVisible: true },
    ],
  },
  {
    id: 'income',
    label: 'Income & Tax',
    color: '#3b82f6',
    columns: [
      { key: 'grossIncome', label: 'Salary', format: 'currency', formula: 'Working: salary (grows yearly). Retired: part-time income or $0', defaultVisible: true },
      { key: 'excessDividendIncome', label: 'Dividends', format: 'currency', formula: 'Excess dividend income after paying HELOC interest (taxable)', defaultVisible: true },
      { key: 'totalWithdrawals', label: 'Inv. Withdrawals', format: 'currency', formula: 'TFSA + RRSP + non-reg + HELOC growth withdrawals (retirement only)', defaultVisible: true },
      { key: 'incomeTax', label: 'Income Tax', format: 'currency', formula: 'Federal + BC tax on (salary + excess dividends + taxable withdrawals − RRSP)', defaultVisible: true },
      { key: 'effectiveTaxRate', label: 'Eff. Tax Rate', format: 'percent', formula: 'Income tax ÷ total income (salary + dividends + withdrawals)', defaultVisible: true },
      { key: 'netIncome', label: 'Net Income', format: 'currency', formula: 'Salary − income tax (does not include dividends or withdrawals)', defaultVisible: true },
    ],
  },
  {
    id: 'expenses',
    label: 'Expenses',
    color: '#f59e0b',
    columns: [
      { key: 'nonHousingExpenses', label: 'Living Expenses', format: 'currency', formula: 'Monthly non-housing × 12, grows at expense inflation rate', defaultVisible: true },
      { key: 'yearlyHousingCosts', label: 'Housing', format: 'currency', formula: 'Mortgage payment + property tax + strata', defaultVisible: true },
      { key: 'yearlyHelocInterest', label: 'HELOC Interest', format: 'currency', formula: 'HELOC balance × rate (paid by dividends first, then cash)', defaultVisible: true },
      { key: 'yearlyDividendIncome', label: 'Dividend Income', format: 'currency', formula: 'Yield × dividend bucket balance (offsets HELOC interest)', defaultVisible: true },
      { key: 'remainingForInvestment', label: 'Available to Save', format: 'currency', formula: 'Net income − expenses − housing − HELOC shortfall + excess dividends', defaultVisible: true },
    ],
  },
  {
    id: 'contributions',
    label: 'Contributions',
    color: '#a855f7',
    columns: [
      { key: 'tfsaContributions', label: 'TFSA', format: 'currency', formula: 'min(available, TFSA room)', defaultVisible: true },
      { key: 'tfsaContributionRoom', label: 'TFSA Room', format: 'currency', formula: 'Cumulative room − used + regained from withdrawals' },
      { key: 'rrspContributions', label: 'RRSP', format: 'currency', formula: 'min(remaining after TFSA, RRSP room)', defaultVisible: true },
      { key: 'rrspRoom', label: 'RRSP Room', format: 'currency', formula: 'Prior room + min(18% prior income, $33,810) − contributions' },
      { key: 'nonRegisteredContributions', label: 'Non-Reg', format: 'currency', formula: 'Overflow after TFSA + RRSP room filled', defaultVisible: true },
    ],
  },
  {
    id: 'balances',
    label: 'Account Balances',
    color: '#06b6d4',
    columns: [
      { key: 'tfsaBalance', label: 'TFSA', format: 'currency', formula: '(Prior × growth) + contributions − withdrawals', defaultVisible: true },
      { key: 'rrspBalance', label: 'RRSP', format: 'currency', formula: '(Prior × growth) + contributions − withdrawals', defaultVisible: true },
      { key: 'nonRegisteredBalance', label: 'Non-Reg', format: 'currency', formula: '(Prior × growth) + contributions − withdrawals', defaultVisible: true },
      { key: 'helocDividendBalance', label: 'HELOC Dividend', format: 'currency', formula: 'Grows at dividend rate; never sold; dividends pay HELOC interest' },
      { key: 'helocGrowthBalance', label: 'HELOC Growth', format: 'currency', formula: 'Grows at investment rate; sold during retirement' },
      { key: 'helocNetEquity', label: 'HELOC Net Equity', format: 'currency', formula: '(Dividend + Growth buckets) − HELOC loan balance', defaultVisible: true },
    ],
  },
  {
    id: 'property',
    label: 'Property & Mortgage',
    color: '#0ea5e9',
    columns: [
      { key: 'propertyValue', label: 'Property Value', format: 'currency', formula: 'Grows at appreciation rate yearly', defaultVisible: true },
      { key: 'mortgageInsurancePremium', label: 'CMHC Insurance', format: 'currency', formula: 'One-time premium for <20% down, added to mortgage' },
      { key: 'mortgageBalance', label: 'Mortgage Bal.', format: 'currency', formula: 'Prior balance − principal paid this year (includes insurance premium)', defaultVisible: true },
      { key: 'houseEquity', label: 'House Equity', format: 'currency', formula: 'Property value − mortgage balance', defaultVisible: true },
      { key: 'mortgageInterestRate', label: 'Rate', format: 'percent', formula: 'Initial rate → new rate after term' },
      { key: 'yearlyPayment', label: 'Yearly Payment', format: 'currency', formula: 'Principal + interest paid this year' },
      { key: 'yearlyMortgagePrinciplePaid', label: 'Principal Paid', format: 'currency', formula: 'Sum of 12 monthly principal payments' },
      { key: 'yearlyMortgageInterestPaid', label: 'Interest Paid', format: 'currency', formula: 'Sum of 12 monthly interest payments' },
      { key: 'totalMortgagePrinciplePaid', label: 'Total Principal', format: 'currency', formula: 'Cumulative principal paid to date' },
      { key: 'totalMortgageInterestPaid', label: 'Total Interest', format: 'currency', formula: 'Cumulative interest paid to date' },
      { key: 'yearlyTaxes', label: 'Property Tax', format: 'currency', formula: 'Grows at property tax inflation rate' },
      { key: 'yearlyStrata', label: 'Strata', format: 'currency', formula: 'Grows at strata inflation rate' },
    ],
  },
  {
    id: 'heloc',
    label: 'HELOC (Smith Maneuver)',
    color: '#ec4899',
    columns: [
      { key: 'helocBalance', label: 'Loan Balance', format: 'currency', formula: 'Capped at min(65% property, 80% LTV − mortgage)', defaultVisible: true },
      { key: 'helocInvestmentsBalance', label: 'Investments', format: 'currency', formula: 'Dividend bucket + growth bucket (market value)' },
      { key: 'helocDividendContributions', label: 'Div. Contrib', format: 'currency', formula: 'New borrowing → dividend bucket first (cover interest + TFSA)' },
      { key: 'helocGrowthContributions', label: 'Growth Contrib', format: 'currency', formula: 'Remaining new borrowing → growth bucket' },
      { key: 'helocInvestmentContributions', label: 'Total Contrib', format: 'currency', formula: 'Dividend + growth contributions this year' },
    ],
  },
  {
    id: 'withdrawals',
    label: 'Retirement Withdrawals',
    color: '#ef4444',
    columns: [
      { key: 'tfsaWithdrawals', label: 'TFSA', format: 'currency', formula: 'Tax-free; room regained next year' },
      { key: 'rrspWithdrawals', label: 'RRSP', format: 'currency', formula: 'Taxed as income at marginal rate' },
      { key: 'nonRegisteredWithdrawals', label: 'Non-Reg', format: 'currency', formula: 'Capital gains taxed at 50% inclusion' },
      { key: 'helocWithdrawals', label: 'HELOC Growth', format: 'currency', formula: 'Growth bucket sold; loan stays (deductibility maintained)' },
      { key: 'amountNotCoveredByInvestments', label: 'Shortfall', format: 'currency', formula: 'Expenses not covered after draining all accounts' },
    ],
  },
];

const ALL_COLUMNS = COLUMN_GROUPS.flatMap((g) => g.columns);
const DEFAULT_VISIBLE = new Set<ColumnKey>(ALL_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key));

interface BuyingForecastTableProps {
  rows: BuyingYearRow[];
}

export function BuyingForecastTable({ rows }: BuyingForecastTableProps) {
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(() => new Set(DEFAULT_VISIBLE));
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  function toggleColumn(key: ColumnKey) {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleGroup(group: ColumnGroup) {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      const groupKeys = group.columns.map((c) => c.key);
      const allVisible = groupKeys.every((k) => next.has(k));
      if (allVisible) {
        groupKeys.forEach((k) => next.delete(k));
      } else {
        groupKeys.forEach((k) => next.add(k));
      }
      return next;
    });
  }

  function showDefaults() {
    setVisibleColumns(new Set(DEFAULT_VISIBLE));
  }

  function showAll() {
    setVisibleColumns(new Set(ALL_COLUMNS.map((c) => c.key)));
  }

  const visibleGroups = COLUMN_GROUPS.map((g) => ({
    ...g,
    visibleCols: g.columns.filter((c) => visibleColumns.has(c.key)),
  })).filter((g) => g.visibleCols.length > 0);

  function cellValue(row: BuyingYearRow, col: Column): string | number {
    const v = row[col.key] as number;
    if (col.key === 'year' || col.key === 'age') return v;
    if (col.format === 'currency') return fmtCurrency(v);
    if (col.format === 'percent') return fmtPercent(v);
    return v.toLocaleString('en-CA');
  }

  return (
    <div className="rounded-2xl bg-slate-800/60 border border-slate-700/80 overflow-hidden shadow-xl">
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between gap-2 flex-wrap">
        <h2 className="font-display text-lg font-semibold text-slate-100">{rows.length}-year forecast</h2>
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="text-sm text-slate-400 hover:text-slate-200 px-2 py-1 rounded border border-slate-600 hover:border-slate-500 transition"
          >
            Columns
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 z-10 w-72 max-h-[420px] overflow-y-auto rounded-lg bg-slate-800 border border-slate-600 shadow-xl py-2">
              <div className="px-3 pb-2 border-b border-slate-600 flex gap-2 items-center">
                <span className="text-xs text-slate-400 flex-1">Toggle columns</span>
                <button type="button" onClick={showDefaults} className="text-xs text-sky-400 hover:text-sky-300">
                  Defaults
                </button>
                <button type="button" onClick={showAll} className="text-xs text-emerald-400 hover:text-emerald-300">
                  All
                </button>
              </div>
              {COLUMN_GROUPS.map((group) => {
                const groupKeys = group.columns.map((c) => c.key);
                const allChecked = groupKeys.every((k) => visibleColumns.has(k));
                const someChecked = groupKeys.some((k) => visibleColumns.has(k));
                return (
                  <div key={group.id} className="mt-1">
                    <label className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-slate-700/50">
                      <input
                        type="checkbox"
                        checked={allChecked}
                        ref={(el) => { if (el) el.indeterminate = someChecked && !allChecked; }}
                        onChange={() => toggleGroup(group)}
                        className="rounded border-slate-500 text-emerald-500 focus:ring-emerald-500"
                      />
                      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: group.color }}>
                        {group.label}
                      </span>
                    </label>
                    <div className="pl-6">
                      {group.columns.map((col) => (
                        <label
                          key={col.key}
                          className="flex items-center gap-2 py-1 px-2 rounded hover:bg-slate-700/50 cursor-pointer text-sm text-slate-300"
                        >
                          <input
                            type="checkbox"
                            checked={visibleColumns.has(col.key)}
                            onChange={() => toggleColumn(col.key)}
                            className="rounded border-slate-500 text-emerald-500 focus:ring-emerald-500"
                          />
                          <span className="truncate">{col.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            {/* Category header row */}
            <tr className="bg-slate-900/80">
              {visibleGroups.map((g) => (
                <th
                  key={g.id}
                  colSpan={g.visibleCols.length}
                  className="text-center text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 border-b border-slate-700"
                  style={{ color: g.color, borderLeft: `2px solid ${g.color}22` }}
                >
                  {g.label}
                </th>
              ))}
            </tr>
            {/* Column header row */}
            <tr className="bg-slate-800">
              {visibleGroups.map((g, gi) =>
                g.visibleCols.map((col, ci) => (
                  <th
                    key={col.key}
                    title={col.formula}
                    className="text-left text-slate-400 font-medium px-3 py-2 whitespace-nowrap border-b border-slate-700 cursor-help text-xs"
                    style={ci === 0 && gi > 0 ? { borderLeft: '1px solid rgb(51 65 85 / 0.6)' } : undefined}
                  >
                    {col.label}
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.year} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                {visibleGroups.map((g, gi) =>
                  g.visibleCols.map((col, ci) => (
                    <td
                      key={col.key}
                      className="px-3 py-1.5 text-slate-200 whitespace-nowrap tabular-nums text-xs"
                      style={ci === 0 && gi > 0 ? { borderLeft: '1px solid rgb(51 65 85 / 0.3)' } : undefined}
                    >
                      {cellValue(row, col)}
                    </td>
                  ))
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
