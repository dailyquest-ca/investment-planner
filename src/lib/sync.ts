import type { BuyingScenarioInputs } from '../types/buying';

const USER_ID_KEY = 'ip-user-id';
const ACTIVE_SCENARIO_KEY = 'ip-active-scenario-id';

function generateId(): string {
  return crypto.randomUUID();
}

export function getUserId(): string {
  let id = localStorage.getItem(USER_ID_KEY);
  if (!id) {
    id = generateId();
    localStorage.setItem(USER_ID_KEY, id);
  }
  return id;
}

export function setUserId(id: string): void {
  localStorage.setItem(USER_ID_KEY, id);
}

export function getActiveScenarioId(): string | null {
  return localStorage.getItem(ACTIVE_SCENARIO_KEY);
}

export function setActiveScenarioId(id: string): void {
  localStorage.setItem(ACTIVE_SCENARIO_KEY, id);
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

function headers(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'x-user-id': getUserId(),
  };
}

export async function listScenarios(): Promise<SavedScenario[]> {
  const res = await fetch(API_BASE, { headers: headers() });
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
    headers: headers(),
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
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Failed to delete scenario: ${res.status}`);
}

export function getSyncCode(): string {
  return getUserId();
}

export function applySyncCode(code: string): void {
  setUserId(code);
  localStorage.removeItem(ACTIVE_SCENARIO_KEY);
}
