/**
 * Client persistence for MonthlyActuals.
 *
 * Authenticated users store actuals in the cloud via /api/actuals.
 * Anonymous users store actuals in localStorage via the storage module.
 */

import type { AccountBalances } from '../types/domain';
import { getMonthlyActuals, setMonthlyActuals } from './storage';

/* ── Lightweight client-side shape ───────────────────────────────── */

export interface MonthlyActualsRecord {
  id?: string;
  yearMonth: string;
  data: MonthlyActualsData;
  created_at?: string;
  updated_at?: string;
}

export interface MonthlyActualsData {
  accountBalances: AccountBalances;
  mortgageBalance?: number;
  propertyValue?: number;
  actualGrossIncome?: number;
  actualMonthlyExpenses?: number;
  actualMonthlyHousingCost?: number;
  notes?: string;
}

/* ── Helpers ─────────────────────────────────────────────────────── */

export function currentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/* ── Cloud API ───────────────────────────────────────────────────── */

const API_BASE = '/api/actuals';

interface ApiActualsRow {
  id: string;
  year_month: string;
  data: MonthlyActualsData;
  created_at: string;
  updated_at: string;
}

function fromApi(row: ApiActualsRow): MonthlyActualsRecord {
  return {
    id: row.id,
    yearMonth: row.year_month,
    data: row.data,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function listActualsCloud(): Promise<MonthlyActualsRecord[]> {
  const res = await fetch(API_BASE, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (res.status === 401) return [];
  if (!res.ok) throw new Error(`Failed to list actuals: ${res.status}`);
  const rows: ApiActualsRow[] = await res.json();
  return rows.map(fromApi);
}

export async function saveActualsCloud(
  yearMonth: string,
  data: MonthlyActualsData,
): Promise<MonthlyActualsRecord> {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ year_month: yearMonth, data }),
  });
  if (!res.ok) throw new Error(`Failed to save actuals: ${res.status}`);
  return fromApi(await res.json());
}

export async function getLatestActualsCloud(): Promise<MonthlyActualsRecord | null> {
  const list = await listActualsCloud();
  return list[0] ?? null;
}

/* ── Local storage ───────────────────────────────────────────────── */

function loadLocalActuals(): MonthlyActualsRecord[] {
  const raw = getMonthlyActuals();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as MonthlyActualsRecord[];
  } catch {
    return [];
  }
}

function persistLocalActuals(records: MonthlyActualsRecord[]): void {
  setMonthlyActuals(JSON.stringify(records));
}

export function listActualsLocal(): MonthlyActualsRecord[] {
  return loadLocalActuals().sort((a, b) => b.yearMonth.localeCompare(a.yearMonth));
}

export function saveActualsLocal(
  yearMonth: string,
  data: MonthlyActualsData,
): MonthlyActualsRecord {
  const records = loadLocalActuals();
  const idx = records.findIndex((r) => r.yearMonth === yearMonth);
  const record: MonthlyActualsRecord = { yearMonth, data };
  if (idx >= 0) {
    records[idx] = record;
  } else {
    records.push(record);
  }
  persistLocalActuals(records);
  return record;
}

export function getLatestActualsLocal(): MonthlyActualsRecord | null {
  const sorted = listActualsLocal();
  return sorted[0] ?? null;
}

/* ── Unified helpers (pick cloud vs local) ───────────────────────── */

export async function saveActuals(
  yearMonth: string,
  data: MonthlyActualsData,
  isAuthenticated: boolean,
): Promise<MonthlyActualsRecord> {
  if (isAuthenticated) {
    try {
      return await saveActualsCloud(yearMonth, data);
    } catch { /* fall through to local */ }
  }
  return saveActualsLocal(yearMonth, data);
}

export async function getLatestActuals(
  isAuthenticated: boolean,
): Promise<MonthlyActualsRecord | null> {
  if (isAuthenticated) {
    try {
      return await getLatestActualsCloud();
    } catch { /* fall through to local */ }
  }
  return getLatestActualsLocal();
}
