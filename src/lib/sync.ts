import type { BuyingScenarioInputs } from '../types/buying';
import {
  getActiveScenarioId as storageGetActiveId,
  setActiveScenarioId as storageSetActiveId,
} from './storage';

export function getActiveScenarioId(): string | null {
  return storageGetActiveId();
}

export function setActiveScenarioId(id: string): void {
  storageSetActiveId(id);
}

export interface SavedScenario {
  id: string;
  name: string;
  inputs: BuyingScenarioInputs;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

const API_BASE = '/api/scenarios';

export async function listScenarios(): Promise<SavedScenario[]> {
  const res = await fetch(API_BASE, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (res.status === 401) return [];
  if (!res.ok) throw new Error(`Failed to list scenarios: ${res.status}`);
  return res.json();
}

export async function saveScenario(
  inputs: BuyingScenarioInputs,
  name?: string,
  scenarioId?: string,
  isDefault?: boolean,
): Promise<SavedScenario> {
  const body: Record<string, unknown> = { inputs, name: name ?? 'My Scenario' };
  if (scenarioId) body.id = scenarioId;
  if (isDefault !== undefined) body.is_default = isDefault;

  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Failed to save scenario: ${res.status}`);
  const saved = await res.json();
  setActiveScenarioId(saved.id);
  return saved;
}

export async function deleteScenario(scenarioId: string): Promise<void> {
  const res = await fetch(`${API_BASE}?id=${scenarioId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`Failed to delete scenario: ${res.status}`);
}
