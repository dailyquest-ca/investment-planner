/**
 * Canonical localStorage key management for Finpath.
 *
 * All localStorage access should go through this module so key names
 * are defined once and legacy-to-finpath migration happens automatically.
 */

/* ── Canonical keys ──────────────────────────────────────────────── */

export const KEYS = {
  BUYING_INPUTS: 'finpath-buying-inputs',
  ACTIVE_SCENARIO_ID: 'finpath-active-scenario-id',
  SETUP_DONE: 'finpath-setup-done',
  MONTHLY_ACTUALS: 'finpath-monthly-actuals',
} as const;

/* ── Legacy keys (read-only, for migration) ──────────────────────── */

const LEGACY = {
  BUYING_INPUTS: ['net-worth-planner-inputs'],
  ACTIVE_SCENARIO_ID: ['ip-active-scenario-id'],
  SETUP_DONE: [] as string[],
  MONTHLY_ACTUALS: [] as string[],
} as const;

/* ── Helpers ─────────────────────────────────────────────────────── */

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch { /* quota or private browsing */ }
}

function safeRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch { /* */ }
}

/**
 * Read from the canonical key first. If empty, try each legacy key in
 * order. On a legacy hit, migrate the value forward and delete the
 * legacy key so subsequent reads are fast.
 */
function getWithMigration(
  canonical: string,
  legacyKeys: readonly string[],
): string | null {
  const current = safeGet(canonical);
  if (current !== null) return current;

  for (const legacy of legacyKeys) {
    const val = safeGet(legacy);
    if (val !== null) {
      safeSet(canonical, val);
      safeRemove(legacy);
      return val;
    }
  }
  return null;
}

/* ── Public API ──────────────────────────────────────────────────── */

export function getBuyingInputs(): string | null {
  return getWithMigration(KEYS.BUYING_INPUTS, LEGACY.BUYING_INPUTS);
}

export function setBuyingInputs(json: string): void {
  safeSet(KEYS.BUYING_INPUTS, json);
}

export function removeBuyingInputs(): void {
  safeRemove(KEYS.BUYING_INPUTS);
  for (const k of LEGACY.BUYING_INPUTS) safeRemove(k);
}

export function getActiveScenarioId(): string | null {
  return getWithMigration(KEYS.ACTIVE_SCENARIO_ID, LEGACY.ACTIVE_SCENARIO_ID);
}

export function setActiveScenarioId(id: string): void {
  safeSet(KEYS.ACTIVE_SCENARIO_ID, id);
}

export function isSetupDone(): boolean {
  return getWithMigration(KEYS.SETUP_DONE, LEGACY.SETUP_DONE) === '1';
}

export function markSetupDone(): void {
  safeSet(KEYS.SETUP_DONE, '1');
}

export function getMonthlyActuals(): string | null {
  return getWithMigration(KEYS.MONTHLY_ACTUALS, LEGACY.MONTHLY_ACTUALS);
}

export function setMonthlyActuals(json: string): void {
  safeSet(KEYS.MONTHLY_ACTUALS, json);
}

/**
 * Remove all Finpath and legacy localStorage keys.
 * Used by the Settings "reset to defaults" action.
 */
export function clearAllLocalData(): void {
  for (const canonical of Object.values(KEYS)) safeRemove(canonical);
  for (const legacyList of Object.values(LEGACY)) {
    for (const k of legacyList) safeRemove(k);
  }
}
