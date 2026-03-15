'use client';

import type { BuyingScenarioInputs } from '../../types/buying';
import { FieldGrid, type FieldConfig } from './shared';

const INVESTMENT_ACCOUNTS: FieldConfig[] = [
  { key: 'currentFHSABalance', label: 'Current FHSA', unit: '$' },
  { key: 'currentTFSABalance', label: 'Current TFSA', unit: '$' },
  { key: 'currentRRSPBalance', label: 'Current RRSP', unit: '$' },
  { key: 'householdTFSAContributionRoom', label: 'TFSA room (household)', unit: '$', secondary: true },
  { key: 'annualTFSARoomIncrease', label: 'TFSA room increase', unit: '$', secondary: true },
  { key: 'currentRRSPRoom', label: 'RRSP room (household)', unit: '$', secondary: true },
  { key: 'numberOfIncomeEarners', label: 'Income earners', unit: undefined, secondary: true },
];

const MARKET_ASSUMPTIONS_BASE: FieldConfig[] = [
  { key: 'investmentGrowthRate', label: 'Investment growth rate', unit: '%' },
  { key: 'dividendGrowthRatePercent', label: 'Dividend growth rate', unit: '%', secondary: true },
  { key: 'dividendYieldPercent', label: 'Dividend yield', unit: '%', secondary: true },
];

const MARKET_PROPERTY_FIELDS: FieldConfig[] = [
  { key: 'appreciationYoY', label: 'Property appreciation', unit: '%' },
  { key: 'inflationTaxesYoY', label: 'Tax inflation', unit: '%', secondary: true },
  { key: 'inflationStrataYoY', label: 'Strata inflation', unit: '%', secondary: true },
];

interface InvestmentsSectionProps {
  values: BuyingScenarioInputs;
  onChange: (field: keyof BuyingScenarioInputs, value: number | boolean) => void;
}

export function InvestmentsSection({ values, onChange }: InvestmentsSectionProps) {
  const marketFields = values.buyingHouse
    ? [...MARKET_ASSUMPTIONS_BASE, ...MARKET_PROPERTY_FIELDS]
    : MARKET_ASSUMPTIONS_BASE;

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Account balances</p>
        <FieldGrid fields={INVESTMENT_ACCOUNTS} values={values} onChange={onChange} />
      </div>

      <div className="pt-3 border-t border-slate-700/80 space-y-3">
        <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Market assumptions</p>
        <FieldGrid fields={marketFields} values={values} onChange={onChange} />
      </div>
    </div>
  );
}

export function investmentsSummary(values: BuyingScenarioInputs): string {
  const tfsa = values.currentTFSABalance >= 1000
    ? `$${Math.round(values.currentTFSABalance / 1000)}k`
    : `$${values.currentTFSABalance}`;
  const rrsp = values.currentRRSPBalance >= 1000
    ? `$${Math.round(values.currentRRSPBalance / 1000)}k`
    : `$${values.currentRRSPBalance}`;
  return `TFSA ${tfsa} · RRSP ${rrsp} · ${values.investmentGrowthRate}% growth`;
}
