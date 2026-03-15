/**
 * Finpath Domain Schema
 *
 * This file defines the target product model. It separates observed reality,
 * stable household facts, math assumptions, goals, ongoing behavior rules,
 * discrete future actions, what-if packages, adopted plans, and derived
 * projections into distinct concepts.
 *
 * The existing BuyingScenarioInputs type in ./buying.ts remains the internal
 * engine input shape. An adapter at the bottom of this file composes the new
 * domain objects into that shape so the projection engine keeps working
 * unchanged.
 */

/* ═══════════════════════════════════════════════════════════════════
   1. MonthlyActuals — observed month-based financial reality
   ═══════════════════════════════════════════════════════════════════ */

export interface AccountBalances {
  tfsa: number;
  rrsp: number;
  fhsa: number;
  nonRegistered: number;
  cashOnHand: number;
}

export interface DebtBalances {
  mortgageBalance?: number;
  helocBalance?: number;
}

export interface AssetValues {
  propertyValue?: number;
}

export interface MonthlyActuals {
  id: string;
  householdId: string;
  /** ISO month: "2026-03" */
  yearMonth: string;

  accountBalances: AccountBalances;
  debtBalances: DebtBalances;
  assetValues: AssetValues;

  /** Override baseline income for this month when reality differs. */
  actualGrossIncome?: number;
  /** Override baseline expenses for this month when reality differs. */
  actualMonthlyExpenses?: number;
  /** Override baseline housing cost for this month when reality differs. */
  actualMonthlyHousingCost?: number;

  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/* ═══════════════════════════════════════════════════════════════════
   2. HouseholdProfile — stable facts about the household
   ═══════════════════════════════════════════════════════════════════ */

export type Province = 'BC' | 'AB' | 'ON' | 'QC' | 'OTHER';

export type HouseholdType = 'single' | 'couple';

export type HousingStatus = 'renting' | 'own' | 'planning_to_buy';

export interface HouseholdMember {
  label: string;
  currentAge: number;
}

export interface HouseholdProfile {
  id: string;

  householdType: HouseholdType;
  members: HouseholdMember[];
  province: Province;
  housingStatus: HousingStatus;
  numberOfIncomeEarners: 1 | 2;

  baselineGrossIncome: number;
  baselineMonthlyExpenses: number;
  currentMonthlyRent: number;

  /** Household-level TFSA contribution room remaining. */
  currentTFSARoom: number;
  annualTFSARoomIncrease: number;
  currentRRSPRoom: number;

  createdAt: string;
  updatedAt: string;
}

/* ═══════════════════════════════════════════════════════════════════
   3. ProjectionAssumptions — forecasting math knobs
   ═══════════════════════════════════════════════════════════════════ */

export interface ProjectionAssumptions {
  id: string;

  lifeExpectancy: number;

  investmentGrowthRate: number;
  dividendYieldPercent: number;
  dividendGrowthRatePercent: number;

  incomeGrowthRate: number;
  expenseInflationRate: number;
  rentIncreasePercent: number;

  /** House price appreciation (percent per year). */
  homeAppreciationRate: number;
  propertyTaxInflationRate: number;
  strataInflationRate: number;

  /** Mortgage renewal rate assumption after initial term expires. */
  mortgageRenewalRate: number;
  /** Years until initial mortgage rate changes to renewal rate. */
  mortgageRateChangeAfterYears: number;

  helocInterestRate: number;

  createdAt: string;
  updatedAt: string;
}

/* ═══════════════════════════════════════════════════════════════════
   4. Goal — desired outcomes used to evaluate plans
   ═══════════════════════════════════════════════════════════════════ */

export interface RetirementAgeGoal {
  type: 'retirement_age';
  targetAge: number;
}

export interface RetirementIncomeGoal {
  type: 'retirement_income';
  monthlyAmount: number;
}

export interface HomePurchaseGoal {
  type: 'home_purchase';
  targetPrice: number;
  targetDate?: string;
}

export interface NetWorthGoal {
  type: 'net_worth';
  targetAmount: number;
  targetDate?: string;
}

export interface DebtPayoffGoal {
  type: 'debt_payoff';
  debtType: 'mortgage' | 'heloc' | 'other';
  targetDate?: string;
}

export type GoalDefinition =
  | RetirementAgeGoal
  | RetirementIncomeGoal
  | HomePurchaseGoal
  | NetWorthGoal
  | DebtPayoffGoal;

export interface Goal {
  id: string;
  definition: GoalDefinition;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

/* ═══════════════════════════════════════════════════════════════════
   5. Policy — ongoing financial behavior rules
   ═══════════════════════════════════════════════════════════════════ */

export type AccountType = 'TFSA' | 'RRSP' | 'FHSA' | 'NonRegistered' | 'HELOC' | 'Cash';

export interface SavingsPriorityPolicy {
  type: 'savings_priority';
  /** Ordered list: surplus cash flows into the first account with room, then the next. */
  order: AccountType[];
}

export interface WithdrawalOrderPolicy {
  type: 'withdrawal_order';
  /** Ordered list: retire from the first account first. */
  order: AccountType[];
}

export interface HelocAllocationPolicy {
  type: 'heloc_allocation';
  /** When true, new HELOC room goes to growth-first investments. */
  growthFirst: boolean;
}

export interface CashReservePolicy {
  type: 'cash_reserve';
  /** Minimum months of expenses to keep liquid. */
  minimumMonths: number;
}

export interface ContributionCapPolicy {
  type: 'contribution_cap';
  /** Max monthly amount directed toward investments. null = no cap. */
  maxMonthlyContribution: number | null;
}

export type PolicyDefinition =
  | SavingsPriorityPolicy
  | WithdrawalOrderPolicy
  | HelocAllocationPolicy
  | CashReservePolicy
  | ContributionCapPolicy;

export interface Policy {
  id: string;
  definition: PolicyDefinition;
  /** ISO month when this policy becomes effective. null = always active. */
  effectiveStart: string | null;
  /** ISO month when this policy ceases. null = no end date. */
  effectiveEnd: string | null;
  createdAt: string;
  updatedAt: string;
}

/* ═══════════════════════════════════════════════════════════════════
   6. PlannedEvent — discrete future actions at a date or condition
   ═══════════════════════════════════════════════════════════════════ */

export interface HomePurchaseEvent {
  type: 'home_purchase';
  purchasePrice: number;
  downPaymentAmount: number;
  mortgageRateInitial: number;
  mortgageAmortizationYears: number;
  isFirstTimeHomeBuyer: boolean;
  isNewBuild: boolean;
  startingYearlyTaxes: number;
  startingMonthlyStrata: number;
  estimatedLegalFees: number;
  estimatedInspectionFees: number;
  estimatedOtherClosingCosts: number;
}

export interface PropertySaleEvent {
  type: 'property_sale';
  estimatedSalePrice?: number;
}

export interface RetirementEvent {
  type: 'retirement';
  partTimeYears: number;
  partTimeMonthlyIncome: number;
}

export interface MortgageRefinanceEvent {
  type: 'mortgage_refinance';
  newRate: number;
  newAmortizationYears: number;
}

export type PlannedEventDefinition =
  | HomePurchaseEvent
  | PropertySaleEvent
  | RetirementEvent
  | MortgageRefinanceEvent;

export interface PlannedEvent {
  id: string;
  definition: PlannedEventDefinition;
  /** ISO month when the event occurs. null = trigger-based. */
  scheduledFor: string | null;
  createdAt: string;
  updatedAt: string;
}

/* ═══════════════════════════════════════════════════════════════════
   7. Strategy — a named what-if package
   ═══════════════════════════════════════════════════════════════════ */

export interface Strategy {
  id: string;
  name: string;
  description: string;
  policies: Policy[];
  plannedEvents: PlannedEvent[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

/* ═══════════════════════════════════════════════════════════════════
   8. Plan — the adopted intended path
   ═══════════════════════════════════════════════════════════════════ */

export type PlanStatus = 'draft' | 'active' | 'archived';

export interface Plan {
  id: string;
  name: string;

  householdProfileId: string;
  projectionAssumptionsId: string;

  goalIds: string[];
  adoptedPolicyIds: string[];
  adoptedPlannedEventIds: string[];
  /** Strategies this plan was assembled from (informational). */
  sourceStrategyIds: string[];

  status: PlanStatus;
  chosenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/* ═══════════════════════════════════════════════════════════════════
   9. Projection — derived forecast output
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Projection rows reuse the existing BuyingYearRow shape from
 * ../lib/buyingProjection.ts until the engine is generalized.
 */
import type { BuyingYearRow } from '../lib/buyingProjection';

export type ProjectionType =
  | 'current_trajectory'
  | 'strategy'
  | 'plan';

export interface ProjectionSummary {
  netWorthAtRetirement: number | null;
  peakNetWorth: number;
  peakNetWorthAge: number;
  endNetWorth: number;
  endAge: number;
}

export interface Projection {
  id: string;
  type: ProjectionType;

  /** What produced this projection. */
  sourceId: string;
  sourceLabel: string;

  startYearMonth: string;
  rows: BuyingYearRow[];
  summary: ProjectionSummary;

  createdAt: string;
}

/* ═══════════════════════════════════════════════════════════════════
   10. Field mapping — BuyingScenarioInputs → new domain entities
   ═══════════════════════════════════════════════════════════════════

   This section documents where every current BuyingScenarioInputs
   field belongs in the new model. The mapping is the authoritative
   reference for the adapter function below.

   ┌──────────────────────────────────────┬───────────────────────────────────┐
   │ BuyingScenarioInputs field           │ New home                          │
   ├──────────────────────────────────────┼───────────────────────────────────┤
   │ currentAge                           │ HouseholdProfile.members[0].age   │
   │ lifeExpectancy                       │ ProjectionAssumptions             │
   │ retirementAge                        │ Goal (RetirementAgeGoal)          │
   │                                      │                                   │
   │ buyingHouse                          │ PlannedEvent (HomePurchaseEvent)  │
   │ yearsUntilPurchase                   │ PlannedEvent.scheduledFor         │
   │ monthlyRent                          │ HouseholdProfile.currentRent      │
   │ rentIncreasePercent                  │ ProjectionAssumptions             │
   │ buyAmount                            │ PlannedEvent (HomePurchaseEvent)  │
   │ downPaymentAmount                    │ PlannedEvent (HomePurchaseEvent)  │
   │ startingYearlyTaxes                  │ PlannedEvent (HomePurchaseEvent)  │
   │ startingMonthlyStrata                │ PlannedEvent (HomePurchaseEvent)  │
   │ appreciationYoY                      │ ProjectionAssumptions             │
   │                                      │                                   │
   │ inflationTaxesYoY                    │ ProjectionAssumptions             │
   │ inflationStrataYoY                   │ ProjectionAssumptions             │
   │                                      │                                   │
   │ currentFHSABalance                   │ MonthlyActuals.accountBalances    │
   │ currentTFSABalance                   │ MonthlyActuals.accountBalances    │
   │ currentRRSPBalance                   │ MonthlyActuals.accountBalances    │
   │                                      │                                   │
   │ householdGrossIncome                 │ HouseholdProfile.baselineIncome   │
   │ numberOfIncomeEarners                │ HouseholdProfile                  │
   │ yearlyRateOfIncrease                 │ ProjectionAssumptions             │
   │ monthlyNonHousingExpenses            │ HouseholdProfile.baselineExpenses │
   │ expenseInflationRate                 │ ProjectionAssumptions             │
   │                                      │                                   │
   │ helocInterestRate                    │ ProjectionAssumptions             │
   │ helocGrowthFirst                     │ Policy (HelocAllocationPolicy)    │
   │                                      │                                   │
   │ monthlyMoneyNeededDuringRetirement   │ Goal (RetirementIncomeGoal)       │
   │ monthlyMoneyMadeDuringRetirement     │ PlannedEvent (RetirementEvent)    │
   │ partTimeRetirementYears              │ PlannedEvent (RetirementEvent)    │
   │                                      │                                   │
   │ retirementWithdrawalOrder            │ Policy (WithdrawalOrderPolicy)    │
   │                                      │                                   │
   │ householdTFSAContributionRoom        │ HouseholdProfile.currentTFSARoom  │
   │ annualTFSARoomIncrease               │ HouseholdProfile                  │
   │ currentRRSPRoom                      │ HouseholdProfile                  │
   │                                      │                                   │
   │ investmentGrowthRate                 │ ProjectionAssumptions             │
   │ dividendGrowthRatePercent            │ ProjectionAssumptions             │
   │ dividendYieldPercent                 │ ProjectionAssumptions             │
   │                                      │                                   │
   │ mortgageRateInitial                  │ PlannedEvent (HomePurchaseEvent)  │
   │ mortgageRateAfterTerm                │ ProjectionAssumptions             │
   │ mortgageRateChangeAfterYears         │ ProjectionAssumptions             │
   │ mortgageAmortizationYears            │ PlannedEvent (HomePurchaseEvent)  │
   │                                      │                                   │
   │ isFirstTimeHomeBuyer                 │ PlannedEvent (HomePurchaseEvent)  │
   │ isNewBuild                           │ PlannedEvent (HomePurchaseEvent)  │
   │                                      │                                   │
   │ futurePurchaseCash                   │ MonthlyActuals.cashOnHand         │
   │ manualLegalFees                      │ PlannedEvent (HomePurchaseEvent)  │
   │ manualInspectionFees                 │ PlannedEvent (HomePurchaseEvent)  │
   │ manualOtherClosingCosts              │ PlannedEvent (HomePurchaseEvent)  │
   └──────────────────────────────────────┴───────────────────────────────────┘
*/

/* ═══════════════════════════════════════════════════════════════════
   11. Adapter — compose domain objects into the legacy engine input
   ═══════════════════════════════════════════════════════════════════ */

import {
  DEFAULT_BUYING_INPUTS,
  type BuyingScenarioInputs,
  type RetirementAccountType,
} from './buying';

/**
 * Resolve the household's primary age from the profile members list.
 * Falls back to the first member or a sensible default.
 */
function primaryAge(profile: HouseholdProfile): number {
  return profile.members[0]?.currentAge ?? 35;
}

/**
 * Find the first PlannedEvent of a given type from a list.
 */
function findEvent<T extends PlannedEventDefinition['type']>(
  events: PlannedEvent[],
  type: T,
): Extract<PlannedEventDefinition, { type: T }> | null {
  const match = events.find((e) => e.definition.type === type);
  if (!match) return null;
  return match.definition as Extract<PlannedEventDefinition, { type: T }>;
}

/**
 * Find the first Policy of a given type from a list.
 */
function findPolicy<T extends PolicyDefinition['type']>(
  policies: Policy[],
  type: T,
): Extract<PolicyDefinition, { type: T }> | null {
  const match = policies.find((p) => p.definition.type === type);
  if (!match) return null;
  return match.definition as Extract<PolicyDefinition, { type: T }>;
}

/**
 * Find the first Goal of a given type from a list.
 */
function findGoal<T extends GoalDefinition['type']>(
  goals: Goal[],
  type: T,
): Extract<GoalDefinition, { type: T }> | null {
  const match = goals.find((g) => g.definition.type === type);
  if (!match) return null;
  return match.definition as Extract<GoalDefinition, { type: T }>;
}

export interface ComposeInputs {
  actuals: MonthlyActuals;
  profile: HouseholdProfile;
  assumptions: ProjectionAssumptions;
  goals: Goal[];
  policies: Policy[];
  plannedEvents: PlannedEvent[];
}

/**
 * Compose the new domain objects into a BuyingScenarioInputs shape
 * that the existing runBuyingProjection() engine accepts.
 *
 * This adapter is temporary. As the engine is refactored to accept
 * domain objects directly, this function shrinks and eventually
 * disappears.
 */
export function composeEngineInputs(input: ComposeInputs): BuyingScenarioInputs {
  const { actuals, profile, assumptions, goals, policies, plannedEvents } = input;

  const retirementAgeGoal = findGoal(goals, 'retirement_age');
  const retirementIncomeGoal = findGoal(goals, 'retirement_income');
  const homePurchase = findEvent(plannedEvents, 'home_purchase');
  const retirement = findEvent(plannedEvents, 'retirement');
  const withdrawalOrder = findPolicy(policies, 'withdrawal_order');
  const helocAllocation = findPolicy(policies, 'heloc_allocation');

  const age = primaryAge(profile);
  const retirementAge = retirementAgeGoal?.targetAge ?? DEFAULT_BUYING_INPUTS.retirementAge;

  const purchaseEvent = plannedEvents.find((e) => e.definition.type === 'home_purchase');
  const yearsUntilPurchase = purchaseEvent?.scheduledFor
    ? yearMonthDiffYears(currentYearMonth(), purchaseEvent.scheduledFor)
    : DEFAULT_BUYING_INPUTS.yearsUntilPurchase;

  return {
    currentAge: age,
    lifeExpectancy: assumptions.lifeExpectancy,
    retirementAge,

    buyingHouse: homePurchase != null,
    yearsUntilPurchase: Math.max(0, yearsUntilPurchase),
    monthlyRent: profile.currentMonthlyRent,
    rentIncreasePercent: assumptions.rentIncreasePercent,
    buyAmount: homePurchase?.purchasePrice ?? DEFAULT_BUYING_INPUTS.buyAmount,
    downPaymentAmount: homePurchase?.downPaymentAmount ?? DEFAULT_BUYING_INPUTS.downPaymentAmount,
    startingYearlyTaxes: homePurchase?.startingYearlyTaxes ?? DEFAULT_BUYING_INPUTS.startingYearlyTaxes,
    startingMonthlyStrata: homePurchase?.startingMonthlyStrata ?? DEFAULT_BUYING_INPUTS.startingMonthlyStrata,
    appreciationYoY: assumptions.homeAppreciationRate,

    inflationTaxesYoY: assumptions.propertyTaxInflationRate,
    inflationStrataYoY: assumptions.strataInflationRate,

    currentFHSABalance: actuals.accountBalances.fhsa,
    currentTFSABalance: actuals.accountBalances.tfsa,
    currentRRSPBalance: actuals.accountBalances.rrsp,

    householdGrossIncome: actuals.actualGrossIncome ?? profile.baselineGrossIncome,
    numberOfIncomeEarners: profile.numberOfIncomeEarners,
    yearlyRateOfIncrease: assumptions.incomeGrowthRate,
    monthlyNonHousingExpenses: actuals.actualMonthlyExpenses ?? profile.baselineMonthlyExpenses,
    expenseInflationRate: assumptions.expenseInflationRate,

    helocInterestRate: assumptions.helocInterestRate,
    helocGrowthFirst: helocAllocation?.growthFirst ?? DEFAULT_BUYING_INPUTS.helocGrowthFirst,

    monthlyMoneyNeededDuringRetirement:
      retirementIncomeGoal?.monthlyAmount ?? DEFAULT_BUYING_INPUTS.monthlyMoneyNeededDuringRetirement,
    monthlyMoneyMadeDuringRetirement:
      retirement?.partTimeMonthlyIncome ?? DEFAULT_BUYING_INPUTS.monthlyMoneyMadeDuringRetirement,
    partTimeRetirementYears:
      retirement?.partTimeYears ?? DEFAULT_BUYING_INPUTS.partTimeRetirementYears,

    retirementWithdrawalOrder:
      (withdrawalOrder?.order.filter((a): a is RetirementAccountType =>
        ['TFSA', 'RRSP', 'NonRegistered', 'HELOC'].includes(a),
      ) ?? DEFAULT_BUYING_INPUTS.retirementWithdrawalOrder),

    householdTFSAContributionRoom: profile.currentTFSARoom,
    annualTFSARoomIncrease: profile.annualTFSARoomIncrease,
    currentRRSPRoom: profile.currentRRSPRoom,

    investmentGrowthRate: assumptions.investmentGrowthRate,
    dividendGrowthRatePercent: assumptions.dividendGrowthRatePercent,
    dividendYieldPercent: assumptions.dividendYieldPercent,

    mortgageRateInitial: homePurchase?.mortgageRateInitial ?? DEFAULT_BUYING_INPUTS.mortgageRateInitial,
    mortgageRateAfterTerm: assumptions.mortgageRenewalRate,
    mortgageRateChangeAfterYears: assumptions.mortgageRateChangeAfterYears,
    mortgageAmortizationYears: homePurchase?.mortgageAmortizationYears ?? DEFAULT_BUYING_INPUTS.mortgageAmortizationYears,

    isFirstTimeHomeBuyer: homePurchase?.isFirstTimeHomeBuyer ?? DEFAULT_BUYING_INPUTS.isFirstTimeHomeBuyer,
    isNewBuild: homePurchase?.isNewBuild ?? DEFAULT_BUYING_INPUTS.isNewBuild,

    futurePurchaseCash: actuals.accountBalances.cashOnHand,
    manualLegalFees: homePurchase?.estimatedLegalFees ?? DEFAULT_BUYING_INPUTS.manualLegalFees,
    manualInspectionFees: homePurchase?.estimatedInspectionFees ?? DEFAULT_BUYING_INPUTS.manualInspectionFees,
    manualOtherClosingCosts: homePurchase?.estimatedOtherClosingCosts ?? DEFAULT_BUYING_INPUTS.manualOtherClosingCosts,
  };
}

/* ═══════════════════════════════════════════════════════════════════
   12. Helpers
   ═══════════════════════════════════════════════════════════════════ */

function currentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function yearMonthDiffYears(from: string, to: string): number {
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  return (ty - fy) + (tm - fm) / 12;
}

/* ═══════════════════════════════════════════════════════════════════
   13. Boundary rules — pressure-test reference
   ═══════════════════════════════════════════════════════════════════

   MonthlyActuals vs HouseholdProfile
   -----------------------------------
   MonthlyActuals holds values that change month-to-month due to
   markets, contributions, or spending: account balances, debt
   balances, asset values, and optional income/expense overrides.

   HouseholdProfile holds facts that are stable across months and
   only change when the user's life situation changes: age,
   household composition, province, baseline income/expenses,
   housing status, and contribution room.

   Rule: if a value drifts every month due to external forces,
   it belongs in MonthlyActuals. If it is a standing fact about the
   household, it belongs in HouseholdProfile.

   HouseholdProfile vs ProjectionAssumptions
   ------------------------------------------
   HouseholdProfile describes what IS. ProjectionAssumptions
   describes what the engine ESTIMATES about unknowns.

   "My household earns $120k" → HouseholdProfile.
   "Income will grow 2.5% per year" → ProjectionAssumptions.

   Policy vs PlannedEvent
   ----------------------
   A Policy is continuous behavior without a single trigger date:
   "always contribute to TFSA first." A PlannedEvent is a discrete
   one-time action: "buy a house in 2029-06."

   If it has a start/end range but is otherwise ongoing behavior,
   it is a Policy with effectiveStart/effectiveEnd.

   Strategy vs Plan
   ----------------
   A Strategy is a candidate what-if package the user explores.
   A Plan is the adopted configuration the user intends to follow.
   Multiple strategies can exist; only one plan is active.

   A Plan may adopt policies and events from multiple strategies,
   or define its own policies and events directly. Plans reference
   individual policies and events, not necessarily whole strategies.

   Projections
   -----------
   All projections are derived and ephemeral. None are persisted
   as canonical data in v1. They can always be recalculated from
   actuals + profile + assumptions + policies + events.

   CurrentTrajectoryProjection uses only baseline data with no
   strategy or plan applied — it answers "where am I headed if
   nothing changes?"

   StrategyProjection applies a candidate strategy to see its
   impact before adopting it.

   PlanProjection applies the adopted plan to show the intended
   future path.
*/
