'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { BuyingScenarioInputs } from '../../types/buying';

export type FieldConfig = {
  key: keyof BuyingScenarioInputs;
  label: string;
  unit?: '$' | '%' | 'yr';
  secondary?: boolean;
};

export function fmtCurrency(value: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  }).format(value);
}

export function getStep(key: keyof BuyingScenarioInputs): number {
  if (key === 'downPaymentAmount') return 500;
  if (key.includes('Rate') || key.includes('Percent') || key.includes('YoY') || key === 'expenseInflationRate')
    return 0.1;
  if (
    key.includes('Amount') ||
    key.includes('Balance') ||
    key.includes('Room') ||
    key.includes('Strata') ||
    key.includes('Taxes') ||
    key === 'householdGrossIncome' ||
    key === 'monthlyNonHousingExpenses' ||
    key === 'monthlyRent'
  )
    return 100;
  return 1;
}

const INPUT_DEBOUNCE_MS = 150;

export function DebouncedInput({
  value,
  unit,
  step,
  onChange,
  label,
  secondary,
  id,
  fieldKey,
}: {
  value: number;
  unit?: '$' | '%' | 'yr';
  step: number;
  onChange: (v: number) => void;
  label: string;
  secondary?: boolean;
  id: string;
  fieldKey: keyof BuyingScenarioInputs;
}) {
  const [local, setLocal] = useState(value);
  const [focused, setFocused] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!focused && local !== value) setLocal(value);
  }, [value, focused]); // eslint-disable-line react-hooks/exhaustive-deps

  const flush = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (local !== value) onChange(local);
  }, [local, value, onChange]);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

  const handleChange = useCallback(
    (v: number) => {
      setLocal(v);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => onChange(v), INPUT_DEBOUNCE_MS);
    },
    [onChange],
  );

  const handleBlur = () => {
    setFocused(false);
    flush();
  };

  if (fieldKey === 'helocGrowthFirst' || label.includes('Growth-first')) {
    return null;
  }

  return (
    <label htmlFor={id} className={`block ${secondary ? 'opacity-75' : ''}`}>
      <span className={`block truncate mb-1 ${secondary ? 'text-slate-500 text-xs' : 'text-slate-400 text-xs'}`}>
        {label}
      </span>
      <input
        id={id}
        type="number"
        min={0}
        step={step}
        value={local === 0 && unit !== '%' ? '' : local}
        onChange={(e) => handleChange(e.target.value === '' ? 0 : Number(e.target.value))}
        onFocus={() => setFocused(true)}
        onBlur={handleBlur}
        className="w-full rounded-md bg-slate-800 border border-slate-600 text-slate-100 px-2.5 py-2 text-sm tabular-nums focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 outline-none transition min-h-[44px]"
        aria-label={label}
      />
    </label>
  );
}

export function FieldGrid({
  fields,
  values,
  onChange,
}: {
  fields: FieldConfig[];
  values: BuyingScenarioInputs;
  onChange: (k: keyof BuyingScenarioInputs, v: number) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-x-2 gap-y-3">
      {fields.map(({ key, label, unit, secondary }) => {
        if (key === 'helocGrowthFirst') return null;
        return (
          <DebouncedInput
            key={key}
            id={`input-${key}`}
            fieldKey={key}
            label={label}
            value={values[key] as number}
            unit={unit}
            step={getStep(key)}
            onChange={(v) => onChange(key, v)}
            secondary={secondary}
          />
        );
      })}
    </div>
  );
}

export function SummaryRow({
  label,
  value,
  bold,
  positive,
  negative,
  warn,
}: {
  label: string;
  value: number;
  bold?: boolean;
  positive?: boolean;
  negative?: boolean;
  warn?: boolean;
}) {
  let textColor = 'text-slate-400';
  if (bold) textColor = 'text-slate-200';
  if (positive) textColor = 'text-emerald-400/90';
  if (negative) textColor = 'text-emerald-400/90';
  if (warn) textColor = 'text-amber-400/90';
  return (
    <div className={`flex justify-between ${bold ? 'font-medium pt-0.5' : ''}`}>
      <span className={bold ? 'text-slate-300' : 'text-slate-400'}>{label}</span>
      <span className={`tabular-nums ${textColor}`}>{fmtCurrency(value)}</span>
    </div>
  );
}
