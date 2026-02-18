# Spacetime — Changelog

---

## Epic 12: Turn Resolution Pipeline

### Story 12.6 — Event Phase Placeholder (2026-02-19)

**What changed:**
- `src/engine/turn/event-phase.ts` — placeholder implementation already in place from Story 12.1; verified and finalized.

**Features implemented:**

- `resolveEventPhase(state)`: accepts `GameState`, returns `{ updatedState: state, events: [] }` unchanged. No threat or event logic.
- Wired as phase #10 in `turn-resolver.ts`.
- Inline comments document future responsibilities (piracy, corp conflict, colony unrest, natural disasters, resource crises, unknown encounters).

**Acceptance criteria met:**
- Accepts game state, returns it unchanged with empty event list ✓
- Structure in place for future threat/event implementation ✓
- No actual threat logic ✓

---

### Story 12.5 — End Turn UI Flow (2026-02-19)

**What changed:**
- Created `src/composables/useTurnActions.ts` — composable encapsulating end turn button state and actions.
- Updated `src/stores/game.store.ts` — added `lastTurnEvents` state populated by `endTurn()`.
- Updated `src/components/layout/AppHeader.vue` — wired turn number, enabled End Turn button, added confirmation dialog.
- Updated `src/views/DashboardView.vue` — added turn events panel shown during reviewing phase.

**Features implemented:**

- `useTurnActions` composable: `canEndTurn` (enabled during player_action), `isResolving`, `isReviewing`, `currentTurn`, `income/expenses/net` for dialog summary, `willCreateDebt` flag, `sortedEvents` (priority-sorted), `requestEndTurn`, `cancelEndTurn`, `confirmEndTurn`, `acknowledgeResults`.
- `AppHeader.vue`: Turn number now live from game store. End Turn button enabled/disabled by game phase. Shows "Resolving..." label during resolve. Clicking opens `ConfirmDialog` with budget summary (income − expenses = net). Deficit shows debt warning in dialog message.
- `DashboardView.vue`: Turn Events panel appears at top during reviewing phase, showing all events from the resolved turn via `EventCard` components (priority-sorted, Critical first). Acknowledge button returns to player_action.
- `game.store.ts`: `lastTurnEvents` ref stores events from `resolveTurn()` result; exposed in store return object.

**Acceptance criteria met:**
- End Turn button enabled during player_action phase ✓
- Confirmation dialog with budget summary (income − expenses = net) ✓
- Deficit warning shown if net < 0 ✓
- Button shows "Resolving..." state during resolution ✓
- Turn number increments after resolution ✓
- New turn events appear as priority-sorted notification cards on dashboard ✓
- `npx vue-tsc --noEmit` — zero TypeScript errors ✓
- `npx vitest run` — 754/754 tests pass ✓

---

### Story 12.4 — Game Store & End Turn Flow (2026-02-18)

**What changed:**
- Created `src/stores/game.store.ts` — master game store that orchestrates turn resolution and state distribution.
- Created `src/__tests__/stores/game.store.test.ts` — 28 unit tests covering all acceptance criteria.

**Actions implemented:**

- `initializeGame()` — generates galaxy, creates Terra Nova (planet + colony), initializes budget, spawns 4 starting corporations (1 Exploration, 1 Construction, 2 Science each owning 1 Science infra level on Terra Nova), sets turn 1 and player_action phase.
- `getFullGameState()` — assembles `GameState` from all domain stores (galaxy, colonies, planets, corporations, contracts, budget, market).
- `endTurn()` — transitions through resolving phase, calls `resolveTurn()`, distributes results back to all domain stores via `$patch` and store actions, increments turn, transitions to reviewing phase.
- `acknowledgeResults()` — transitions from reviewing → player_action.

**Getters:** `currentTurn`, `gamePhase`

**Test scenarios:**
- Initial state: turn 1, player_action phase
- `initializeGame()`: galaxy generated, Terra Nova colony created, budget = 10 BP, 4 corps spawned (correct types, level 1, Science corps own infra)
- `getFullGameState()`: all entities present in assembled state
- `endTurn()`: turn increments, phase transitions, no-op when not in player_action
- `acknowledgeResults()`: reviewing → player_action, no-op otherwise
- Multi-turn: sequential end-turn cycles work correctly

**Test status**: 754/754 tests passing

---

### Story 12.3 — Debt Phase (2026-02-18)

**What changed:**
- Created `src/__tests__/engine/turn/debt-phase.test.ts` — 20 unit tests for the debt phase.
- Removed Story 12.3 TODO comment from `src/engine/turn/debt-phase.ts` (implementation was already complete from Story 12.1).

**Functions covered by tests:**

- `resolveDebtPhase(state: GameState): PhaseResult` — Phase #1 of turn resolution:
  - If `debtTokens === 0`: returns state unchanged with no events.
  - If `debtTokens > 0`: decrements `debtTokens` by 1, deducts 1 BP from `currentBP`.
  - Keeps `budget.debtTokens`, `budget.currentBP`, and `budget.stabilityMalus` in sync.
  - Emits a `Positive` event when the last token is cleared; `Info` event while tokens remain.
  - BP can go negative (debt payment is unconditional).

**Test scenarios:**

- No tokens: state returned unchanged, same reference, no events emitted
- Token clearing: 1 token cleared, 1 BP deducted, 1 event emitted with correct category
- Event priority: `Positive` when last token cleared, `Info` when tokens remain
- Many tokens: exactly 1 cleared regardless of count (5 or 10 tokens)
- BP edge cases: BP allowed to go negative; BP 1→0 when clearing last token
- Budget sync: `budget.debtTokens`, `budget.currentBP`, `budget.stabilityMalus` match state
- Immutability: input state not mutated

**Acceptance criteria met:**
- If debt tokens > 0: clear 1 token, deduct 1 BP from income ✓
- Returns updated debt token count and BP adjustment ✓
- Unit tests: token clearing ✓, no tokens scenario ✓, many tokens scenario ✓
- `npx vue-tsc --noEmit` — zero TypeScript errors ✓
- `npx vitest run` — 726/726 tests pass ✓

---

### Story 12.2 — Income & Expense Phases (2026-02-18)

**What changed:**
- Created `src/__tests__/engine/turn/income-phase.test.ts` — 26 unit tests for income phase.
- Created `src/__tests__/engine/turn/expense-phase.test.ts` — 33 unit tests for expense phase.
- Removed Story 12.2 TODO comments from `income-phase.ts` and `expense-phase.ts` (stubs were already complete from Story 12.1).

**Functions covered by tests:**

- `resolveIncomePhase(state: GameState): PhaseResult` — Phase #2 of turn resolution:
  - Iterates all colonies: calculates planet tax via `calculatePlanetTax`; skips colonies with pop < 5 or zero tax result.
  - Iterates all corporations: calculates corp tax via `calculateCorpTax`; skips level 1-2 startups (tax = 0).
  - Produces itemized `IncomeSource[]` with per-source attribution (type, sourceId, sourceName, amount).
  - Credits `totalIncome` to `state.currentBP`.
  - Updates `budget.incomeSources`, `budget.totalIncome`, and `budget.calculatedTurn`.
  - Emits no events.

- `resolveExpensePhase(state: GameState): PhaseResult` — Phase #3 of turn resolution:
  - Iterates all contracts: adds `contract` expense entry for each with `status === Active`; skips Completed contracts.
  - Iterates all missions: adds `mission` expense entry for each with `completedTurn === null`; skips finished missions.
  - Produces itemized `ExpenseEntry[]` with per-source attribution.
  - Deducts `totalExpenses` from `state.currentBP`.
  - Deficit handling: if `newBP < 0`, gains `max(1, floor(deficit / 3))` debt tokens, capped at 10 total.
  - Updates `budget.expenseEntries`, `budget.totalExpenses`, `budget.currentBP`, `budget.netBP`, `budget.debtTokens`, `budget.stabilityMalus`, `budget.calculatedTurn`.
  - Emits no events.

**Test scenarios:**

Income phase:
- Zero income: no colonies or corps → empty incomeSources, BP unchanged, totalIncome = 0
- Planet tax: pop ≥ 5 taxable; pop < 5 exempt; low habitability increases hab_cost reducing tax to 0; full tax amount verified at pop 7/hab 8; hab 10 zero cost; colony name attribution
- Corp tax: level 3+ taxable; level 1 exempt; level 2 exempt; level 5 and level 10 amounts verified; corp name attribution
- Multiple sources: two colonies summed; two corps summed; combined planet + corp income; mixed taxable/non-taxable sources; totalIncome as aggregate sum
- BP balance: income credited; no-income BP unchanged; income added on top of existing BP
- Budget state: totalIncome updated; expenseEntries untouched; calculatedTurn stamped

Expense phase:
- Zero expenses: no contracts or missions → empty expenseEntries, BP unchanged, totalExpenses = 0, no debt tokens
- Contract expenses: single active contract deducted; sourceId attribution; completed contracts skipped; multiple active contracts summed
- Mission expenses: single active mission deducted; sourceId attribution; completed missions skipped; multiple active missions summed
- Multiple types: combined contract + mission in expenseEntries; totalExpenses as aggregate; combined deduction from BP
- BP deduction: contract cost subtracted; mission cost subtracted; BP allowed to go negative
- Debt tokens: deficit triggers tokens; minimum 1 token for any deficit; floor(deficit/3) formula; accumulates on existing tokens; capped at 10; exactly-zero BP no tokens; surplus no tokens
- Budget state: totalExpenses updated; budget.currentBP matches state.currentBP; debtTokens reflected; stabilityMalus = floor(debtTokens/2); netBP = totalIncome - totalExpenses; incomeSources preserved

**Acceptance criteria met:**
- Income phase: sums all planet taxes + corp taxes, returns itemized income ✓
- Expense phase: sums all active contract costs + mission costs, returns itemized expenses ✓
- Both return typed result objects with per-source breakdowns ✓
- Unit tests: multiple income sources ✓, multiple expense types ✓, zero income scenario ✓
- `npx vue-tsc --noEmit` — zero TypeScript errors ✓
- `npx vitest run` — 706/706 tests pass ✓

---

### Story 12.1 — Turn Resolver (2026-02-18)

**What changed:**
- Created `src/engine/turn/turn-resolver.ts` — master turn resolution function.
- Created stub phases for all phases not yet fully implemented:
  - `src/engine/turn/debt-phase.ts` — clears 1 debt token per turn, deducts 1 BP
  - `src/engine/turn/income-phase.ts` — sums planet taxes + corp taxes, credits BP
  - `src/engine/turn/expense-phase.ts` — deducts contract/mission costs, handles deficit → debt tokens
  - `src/engine/turn/mission-phase.ts` — stub (deferred to Story 16.3)
  - `src/engine/turn/science-phase.ts` — stub (deferred to Story 14.4)
  - `src/engine/turn/event-phase.ts` — placeholder (deferred to post-prototype)
- Created `src/__tests__/engine/turn/turn-resolver.test.ts` — 24 unit tests.

**Functions implemented / exported:**

- `resolveTurn(state: GameState): TurnResult` — calls all 10 phases in exact order:
  1. `resolveDebtPhase` — clear 1 token, deduct 1 BP
  2. `resolveIncomePhase` — planet taxes + corp taxes → BP
  3. `resolveExpensePhase` — contract + mission costs deducted; deficit → new debt tokens
  4. `resolveContractPhase` — advance contracts (existing, Story 7.3)
  5. `resolveMissionPhase` — stub passthrough
  6. `resolveSciencePhase` — stub passthrough
  7. `resolveCorpPhase` — corp investment AI + organic emergence (existing, Stories 11.2–11.3)
  8. `resolveColonyPhase` — attribute recalculation + growth (existing, Story 10.3)
  9. `resolveMarketPhase` — sector market resolution (existing, Story 9.2)
  10. `resolveEventPhase` — placeholder passthrough
  - Increments turn number after all phases complete.
  - Appends new turn events to `state.events` history.
  - Returns `TurnResult { updatedState, events, completedTurn }`.

**Stub phases (functional but minimal):**

- `resolveDebtPhase`: clears 1 token if any exist, deducts 1 BP, emits debt event.
- `resolveIncomePhase`: iterates colonies/corps, applies planet/corp tax formulas, credits BP.
- `resolveExpensePhase`: iterates active contracts/missions, deducts BP costs, creates debt tokens on deficit (`floor(deficit/3)`, min 1, cap 10).
- `resolveMissionPhase`: passthrough stub with TODO (Story 16.3).
- `resolveSciencePhase`: passthrough stub with TODO (Story 14.4).
- `resolveEventPhase`: passthrough stub with TODO (post-prototype).

**Acceptance criteria met:**
- Calls phases in exact order: debt → income → expense → contract → mission → science → corp → colony → market → event ✓
- Each phase receives current state accumulated from previous phases ✓
- Collects events from all phases into unified event list (phase order preserved) ✓
- Returns complete updated GameState + all events ✓
- Increments turn number ✓
- Pure function: no side effects, no store access ✓
- Unit tests: phase order verification ✓, state flow between phases ✓, turn number increment ✓
- `npx vue-tsc --noEmit` — zero TypeScript errors ✓
- `npx vitest run` — 670/670 tests pass ✓

---

## Epic 11: Corporation AI

### Story 11.3 — Organic Corporation Emergence (2026-02-18)

**What changed:**
- Updated `src/engine/turn/corp-phase.ts` — added organic emergence logic as a fourth step in `resolveCorpPhase`, after the existing corp investment/acquisition loop.
- Created `src/__tests__/engine/turn/corp-phase-emergence.test.ts` — 30 unit tests.

**Functions implemented / exported:**

- `calculateEmergenceChance(dynamism)` — pure formula: `(dynamism - 5) × 10%`; returns 0 for dynamism < 6. Exported for direct testing.
- `determineCorpTypeFromDomain(domain)` — maps an `InfraDomain` to the matching `CorpType` (e.g., Science → Science, Mining/DeepMining/GasExtraction → Exploitation, Civilian → Construction). Returns `null` for unmapped domains. Exported for direct testing.
- `findMostProminentPublicDomain(colony)` — scans all infra domains and returns the one with the most `publicLevels`; returns `null` if every domain is at 0. Exported for direct testing.
- `tryOrganicEmergence(colony, turn)` — internal; checks all four conditions (dynamism threshold, probability roll, public levels exist, domain maps to a corp type), then generates a new level-1 corporation, transfers one public infra level to corporate ownership, and returns the updated colony + new corp + event.

**Organic emergence loop in `resolveCorpPhase`:**
After all existing corps have acted (investment + acquisition), the phase iterates every colony in `updatedColonies`. For each colony a single call to `tryOrganicEmergence` is made — this enforces the max-one-emergence-per-colony-per-turn constraint naturally.

**Domain → Corp Type mapping:**

| Domains | Corp Type |
|---|---|
| Agricultural | Agriculture |
| Mining, DeepMining, GasExtraction | Exploitation |
| Civilian | Construction |
| LowIndustry, HeavyIndustry, HighTechIndustry | Industrial |
| SpaceIndustry | Shipbuilding |
| Science | Science |
| Transport | Transport |
| Military | Military |

Exploration corps cannot emerge organically (no primary infrastructure domain).

**Key architecture decisions:**
- Three helper functions are exported from `corp-phase.ts` to allow direct unit testing of the pure logic without needing to call the full phase function.
- `tryOrganicEmergence` is an internal function (not exported) — it is tested indirectly via `resolveCorpPhase` with `vi.spyOn(Math, 'random').mockReturnValue(0)` to guarantee the probability roll fires.
- `clearNameRegistry()` is called in `beforeEach` in the test file to prevent the name-uniqueness registry from exhausting across test cases.

**Acceptance criteria met:**
- Colonies with dynamism ≥ 6 have a chance to spawn a new corp each turn ✓
- Chance: `(dynamism - 5) × 10%` ✓
- New corp type determined by colony's most prominent public infrastructure domain ✓
- New corp receives one public infrastructure level as its first asset (transfers from public to corporate) ✓
- Max one organic emergence per colony per turn ✓
- Unit tests: emergence chance calculation ✓, type determination ✓, infrastructure transfer ✓
- `npx vue-tsc --noEmit` — zero TypeScript errors ✓
- `npx vitest run` — 650/650 tests pass ✓

---

### Story 11.2 — Corp Phase: Turn Resolution (2026-02-18)

**What changed:**
- Created `src/engine/turn/corp-phase.ts` — corp phase integrating investment AI into the turn pipeline
- Created `src/__tests__/engine/turn/corp-phase.test.ts` — 12 unit tests

**Function implemented:**

- `resolveCorpPhase(state: GameState): PhaseResult` — runs the full corporation AI phase each turn:
  1. **Sort by level descending** — highest-level corps act first (biggest players have first pick of investment targets).
  2. **Apply capital gain** — each corp receives `calculateCapitalGain(totalOwnedInfra)` before decisions.
  3. **Run corp AI** — calls `runCorpInvestmentAI` (from corp-ai.ts, Story 11.1) with the most up-to-date colony and corporation state, so each corp sees investments made by previously-processed corps this turn.
  4. **Merge results** — updates the running corporation map (new capital/level/assets), updates touched colonies (new corporate ownership), removes absorbed corporations.
  5. **Skip absorbed corps** — if a corp is acquired mid-turn, it is removed from the map and skipped if it appears later in the processing queue.

**Key architecture decisions:**
- State is threaded through incrementally: each corp AI call receives a state snapshot with all previous corps' changes applied, so investment competition is accurate within the same turn.
- Absorbed corps are tracked in a `Set<CorpId>` and skipped via an early `continue` guard.
- The sort order snapshots levels at turn start — level changes from acquisitions do not reorder the queue mid-turn.

**Acceptance criteria met:**
- Processes corps in order: highest level first ✓
- Each corp: calculates capital gain, then runs AI decisions ✓
- Handles infrastructure ownership updates ✓
- Handles mergers/acquisitions and asset transfers ✓
- Returns updated corporations + events ✓
- Unit tests: multi-corp turn with investments ✓, acquisition ✓, processing order ✓, absorbed corp skipped ✓
- `npx vue-tsc --noEmit` — zero TypeScript errors ✓
- `npx vitest run` — 620/620 tests pass ✓

---

### Story 11.1 — Corporation Investment AI (2026-02-18)

**What changed:**
- Created `src/engine/simulation/corp-ai.ts` — corporation decision-making engine
- Created `src/__tests__/engine/simulation/corp-ai.test.ts` — 24 unit tests

**Function implemented:**

- `runCorpInvestmentAI(corp, state)` → `CorpAIResult` — processes one corporation per turn:
  1. **Infrastructure investment** — if capital ≥ 2: scans all sector markets for resource deficits; filters to allowed domains (specialty-only below level 3, any domain at level 3+); selects a deficit weighted by severity; finds highest-dynamism eligible colony; buys 1 infra level (cost: 2 capital).
  2. **Acquisition** (level 6+ only) — if capital ≥ target_level × 5 and target is 3+ levels below: absorbs target corp (merges all infra holdings, schematics, patents, planetsPresent), buyer gains 1 level (capped at 10).

**Key architecture decisions:**
- `RESOURCE_TO_DOMAIN` map drives deficit → domain selection; manufacturing domains also check required inputs are not in deficit (no point building factories with no raw materials)
- Extraction domains (Mining, DeepMining, GasExtraction, Agricultural) require a matching deposit via `DEPOSIT_DEFINITIONS[depositType].extractedBy === domain`
- Acquisition picks the most asset-rich eligible target (highest total infra owned)
- Returns `CorpAIResult { updatedCorp, updatedColonies: Map, absorbedCorpId?, events[] }` — caller (corp-phase.ts, Story 11.2) merges partial updates into full state

**Acceptance criteria met:**
- Corps with capital ≥ 2 consider investing ✓
- Investment priority: sector market resource deficits ✓
- Deficit selected weighted by severity ✓
- Highest-dynamism planet with available infra slots and required inputs not in deficit ✓
- Level 3+ corps invest in any domain, lower corps only their specialty ✓
- Level 6+ corps consider acquisitions if capital ≥ target × 5 ✓
- Target must be 3+ levels below buyer; target can refuse if within 2 levels ✓
- On acquisition: buyer gains all target assets, buyer gains 1 level ✓
- Returns list of actions as events ✓
- Unit tests: investment with clear deficit ✓, no suitable planet ✓, acquisition ✓, level restrictions ✓
- `npx vue-tsc --noEmit` — zero TypeScript errors ✓
- `npx vitest run` — 608/608 tests pass ✓

---

## Epic 10: Colony Simulation (Completed 2026-02-18)

Implemented colony attribute calculation, population growth, organic infrastructure growth, and UI updates (Stories 10.1–10.4). Built six attribute formulas (`calculateHabitability`, `calculateAccessibility`, `calculateDynamism`, `calculateQualityOfLife`, `calculateStability`, `calculateGrowthPerTurn`, `calculateInfraCap` — all pure, using `resolveModifiers` for local modifiers; `debtTokens` read directly from state). Built growth simulation (`shouldPopLevelUp`, `shouldPopLevelDown`, `calculateOrganicInfraChance`; `applyGrowthTick` — level-up resets growth to 0, level-down to 9; `applyOrganicInfraGrowth` — `dynamism × 5%` chance, demand-weighted domain selection excluding Civilian). Built colony turn phase (`resolveColonyPhase` — recalculates infra caps → all six attributes → growth tick → organic infra growth → events; extraction domains with no deposit get cap = 0; shortage modifiers from previous market-phase flow through naturally; population-milestone and attribute-warning events). Updated UI: `AttributePanel` trend arrows + derivation tooltips; `ColonyCard` warning borders; `ColonyDetailView` growth progress bar in header.

**Key architecture decisions:**
- `previousAttributes` is optional on `Colony` — undefined on turn 0, no generator changes needed
- Infra caps recalculated before attributes so `currentCap` is accurate for organic growth cap checks
- Shortage resources for organic growth derived from `state.sectorMarkets` (last turn data — colony-phase runs before market-phase)
- Growth is an unclamped progress accumulator; transitions handled by `applyGrowthTick`

**Tests:** 584 passing (attributes: 67, growth colony: 24, colony-sim: 22, colony-phase: 33, prior: 438)

---

## Epic 9: Sector Market & Trade (Completed 2026-02-18)

Implemented the full sector market resolution system and UI (Stories 9.1–9.4). Built five-phase market resolver (`resolveMarket` — production pooling, internal consumption, dynamism-priority purchasing, shortage detection, export bonuses; TC is local-only). Built market turn phase (`resolveMarketPhase` — clears transient shortage modifiers, runs resolver per sector, applies shortage maluses to colony attributes: food→−2 QoL, CG→−1 QoL, TC→−1 Accessibility; export bonus →+1 Dynamism; generates Critical/Warning events per colony). Created market Pinia store (per-sector `SectorMarketState`, per-colony shortage/export-bonus indexes, `resolveMarkets(gameState)` action, `colonyFlows` cache for UI). Built MarketView with sector tabs (shortage dot indicators), per-resource production/consumption/net table (ResourceRow — color-coded, SHORTAGE badge), and per-colony resource breakdown (MarketSummary — sorted by dynamism, stacked cell format, export indicators).

**Key architecture decisions:**
- Shortage and export-bonus modifiers both use `sourceType: 'shortage'` — cleared atomically at the start of each market phase, never stale
- TC never enters the market pool — local shortage only
- Events generated per colony (not per resource) to avoid spam
- Store re-derives shortage/export data from colony modifiers; single source of truth stays on the colony

**Tests:** 444 passing (market-resolver: 24, market-phase: 26, market-store: 30, prior: 364)

---

## Epic 8: Infrastructure & Production (Completed 2026-02-18)

Implemented infrastructure levels, resource production/consumption, and player investment (Stories 8.1–8.4). Built production formulas (`calculateExtraction`, `calculateManufacturing`, `calculateFoodConsumption`, `calculateConsumerGoodsConsumption`, `calculateTCConsumption`, `calculateIndustrialInput`, `calculateInfraCap`, `calculateExtractionCap` — all pure, all tested). Built colony resource flow calculator (`calculateColonyResourceFlow` — 5-step pipeline: extraction → tier-1 manufacturing → tier-2 cascade → transport → population consumption; shortage cascading; resolveModifiers applied for output modifiers). Built player invest action (`investPlanet` — 4-error validation: COLONY_NOT_FOUND, INSUFFICIENT_BP, NO_MATCHING_DEPOSIT, AT_CAP; returns updated colony + bpSpent). Updated UI: `InfraPanel` with per-domain caps, enabled Invest button (deducts 3 BP); `ResourceFlow` using real production formulas with surplus/deficit color coding and tooltips.

**Key architecture decisions:**
- `consumed` tracks full demand even under shortage — `surplus` exposes the true deficit for the market to fill
- BP deduction stays in the view (budgetStore.adjustBP) to avoid circular store imports
- Effective infra cap computed dynamically from live colony data; `currentCap` on InfraState still Infinity everywhere (wired in Story 10.1)

**Tests:** 357 passing (production: 34, colony-sim: 25, invest-planet: 20, prior: 278)

---

## Epic 7: Contract System (Completed 2026-02-18)

Implemented the full contract system (Stories 7.1–7.5). Built contract engine (`create-contract.ts` — validates type/target/eligibility/BP, calculates BP/turn and duration, returns Contract or typed error; 9 error codes; exploration scales with corp level, trade route uses sentinel 9999). Created contract Pinia store (Map by ID; actions: `createNewContract`, `advanceContract`, `completeContract`, `failContract`; computed: `activeContracts`, `completedContracts`; BP/turn expense registered on creation, removed on completion/failure). Built contract turn phase (`resolveContractPhase` — decrements turnsRemaining, completes at 0; GroundSurvey advances planet status, Colonization calls colony generator, Exploration/ShipCommission stubs with Epic 13/15 TODOs, TradeRoute sentinel skipped). Built 4-step ContractWizard (Type → Target → Corp → Confirm); CorpSelector shows level/quality tier/traits; `useContractCreation` composable holds all wizard state; corp eligibility mirrors engine rules. Built ContractsView with grouped Active/Completed sections, summary stats bar, expandable ContractCard with type badge/progress bar/turns remaining/outcome summary. Wired CorpHistory.vue to contract store.

**Key architecture decisions:**
- Trade route "ongoing" expressed via sentinel duration 9999 — cancel action (Story 17.1) will call `failContract`
- Cross-type investment (level 3+) not applied to Colonization, ShipCommission, TradeRoute — specialized only
- `currentTurn` hardcoded to 1 in kickstart path (wired in Story 12.5)

**Tests:** 278 passing (contract-phase: 17, create-contract: 36, prior: 225)

---

## Epic 6: Corporations — Data Model & Lifecycle (Completed 2026-02-17)

Implemented corporation generation, capital system, store, and display (Stories 6.1-6.4). Built name generator (`generateCorpName` — prefix+suffix or prefix+connector+suffix, uniqueness registry, `clearNameRegistry()` for new games) and corp generator (`generateCorporation` — unique name, type from param or random, 1-2 traits with conflict exclusion: Cautious/Aggressive, Innovative/Conservative, Ethical/Ruthless, level 1, capital 0). Created capital formulas (`growth.ts` — `calculateCapitalGain`, `calculateCompletionBonus`, `calculateLevelUpCost`, `calculateAcquisitionCost`, `calculateMaxInfra`, `getTotalOwnedInfra`). Built corporation Pinia store (Map by ID; actions: `addCorporation`, `kickstartCorp`, `addCapital`, `spendCapital`, `levelUp`; getters: `getCorp`, `getCorpsByType`, `getCorpsByPlanet`, `getCorpTax`, `allCorporations`, `corpCount`; wired corp taxes into budget store). Built `CorporationsView.vue` (sorted by level descending, empty state), `CorpDetailView.vue` (two-column: stats+traits+capital left, assets+history+planets right), `CorpCard.vue` (color-coded type badge, level, capital, tax, infra bar, traits, home planet), `CorpAssets.vue` (infra holdings by colony), `CorpHistory.vue` (contract history placeholder — wired in Story 7.2).

**Key architecture decisions:**
- Level 1-2 corps show "Exempt" for tax (startup exemption)
- Corp type badges color-coded: amber=Exploitation, sky=Shipbuilding, violet=Science, etc.
- `getTotalOwnedInfra` helper sums all infra levels across all colonies for capital gain calculation

**Tests:** 225 passing (corp-generator: 23, growth: 28, prior: 174)

---

## Epic 5: Budget System (Completed 2026-02-17)

Implemented the BP economy (Stories 5.1-5.3). Built tax formulas (`calculatePlanetTax` using `floor(pop²/4) - habitability_cost` with pop < 5 returning 0; `calculateCorpTax` using `floor(corpLevel²/5)` with level 1-2 exemption). Created budget Pinia store (`budget.store.ts` — state: `currentBP`, itemized `incomeSources`/`expenseEntries`, `debtTokens`; actions: `calculateIncome()`, `addExpense()`, `applyDebt()` with `floor(deficit/3)` min 1 capped at 10, `clearDebtToken()` costs 1 BP; getters: `netBP`, `stabilityMalus`). Built budget display composable and wired into header (live BP/income/expenses/net with green/yellow/red color coding) and dashboard (itemized breakdowns per colony/corp/contract/mission, debt warning panel with stability malus).

**Key architecture decisions:**
- Budget store initializes with 10 BP and income from Terra Nova
- Corp tax wiring deferred to Story 6.2 (TODO in store)
- Turn number still hardcoded (wired in Story 12.5)

**Tests:** 174 passing (tax: 21, prior: 153)

---

## Epic 4: Planets & Colonies — Data Model (Completed 2026-02-17)

Implemented planet generation and colony data structures (Stories 4.1-4.5). Built planet generator (`generatePlanet` — type/size by spawn weight, features from eligible pool with spawn chance, deposits from type's deposit pool with tiered chances and random richness). Built colony generator (`generateColony` — initializes colony from planet + colony type, applies starting infrastructure, registers planet feature modifiers and colony type passive bonus onto `colony.modifiers`, calculates initial attributes via `resolveModifiers()`). Created Pinia stores for planets (`planet.store.ts` — CRUD by ID/status/sector) and colonies (`colony.store.ts` — CRUD with Terra Nova initialization from start-conditions data). Wired colony presence into galaxy store's `explorableSectors` getter. Built Colony List View (`ColoniesView.vue` + `ColonyCard.vue` — clickable cards with attribute bars, growth progress, auto-initialization) and Colony Detail View (`ColonyDetailView.vue` + `AttributePanel.vue`, `InfraPanel.vue`, `ResourceFlow.vue` — two-column layout with modifier breakdown tooltips, infrastructure ownership, deposit/feature display, disabled Invest button).

**Key architecture decisions:**
- Colony generator supports `overrideInfrastructure` for Terra Nova's custom starting state
- Deposit-dependent starting infra only applied if planet has a matching deposit
- Attribute tooltips use `getModifierBreakdown()` for full source attribution
- Invest button disabled until budget system (Story 8.4)
- Shortage alerts deferred to Story 9.2

**Tests:** 153 passing (planet-generator: 25, colony-generator: 27, prior: 101)

---

## Epic 3: Galaxy Generation & Sectors (Completed 2026-02-17)

Implemented galaxy generation and display (Stories 3.1-3.4). Built sector generator (`generateSector` — unique name from pool, density by spawn weight, threat modifier 0.5-1.5) and galaxy generator (`generateGalaxy` — 10-15 sectors, adjacency graph with 2-4 connections per sector, 1-2 bottlenecks, max 5 hops, all reachable). Created Pinia galaxy store with `sectors`, `adjacency`, `startingSectorId`, and getters for adjacent/explorable sectors. Built Galaxy View with sector list (expandable cards showing density, exploration %, adjacency connections, presence indicators), adjacency graph visualization, and summary bar.

**Key architecture decisions:**
- Galaxy generator uses layered approach: spanning tree → bottleneck designation → edge augmentation → constraint validation with retry
- `explorableSectors` getter initially used starting sector as only presence source (colony store wired in Story 4.3, fleet store deferred to Story 15.4)
- Sector cards show green/indigo/gray dots for presence/explorable/unreachable status

**Tests:** 101 passing (sector-generator: 11, galaxy-generator: 16, prior: 74)

---

## Epic 2: Game Shell & Navigation (Completed 2026-02-17)

Built the application shell (Stories 2.1-2.4). Configured Vue Router with 11 lazy-loaded routes (default `/` → Dashboard). Created collapsible sidebar (AppSidebar.vue) with active route highlighting and top header bar (AppHeader.vue) with placeholder turn/BP/End Turn button. All 11 view scaffolds have styled titles and contextual empty-state messages. Built 9 shared UI components: ProgressBar, AttributeBar, StatCard, ResourceBadge, EventCard, ConfirmDialog, Tooltip, DataTable, EmptyState.

**Key architecture decisions:**
- Dark theme: zinc-950 background, zinc-900 sidebar/header, zinc-800 borders
- Sidebar: 224px expanded / 64px collapsed, indigo accent for active route
- Header values are hardcoded placeholders — wired to stores in Stories 5.3 and 12.5
- All components use Tailwind CSS only, TypeScript typed props

---

## Epic 1: Project Foundation (Completed 2026-02-17)

Scaffolded the Vue 3 + TypeScript + Pinia + Tailwind CSS project (Stories 1.1-1.5). Established full folder structure matching Structure.md, TypeScript strict mode, and Vitest. Created all type definitions in `src/types/` (15 files: branded IDs, all entity interfaces, `GameState`, `Modifier`, `EmpireBonuses`). Implemented modifier resolver (`resolveModifiers`, `getModifierBreakdown` — additive first, then multiplicative, then clamp). Built 4 utility modules (`random.ts` with seeded PRNG, `math.ts`, `format.ts`, `id.ts` with nanoid). Created 20 static data files in `src/data/` covering all game entities from Data.md.

**Key architecture decisions:**
- `Modifier[]` stored on entities for local per-entity variation; `EmpireBonuses` on `GameState` for global cumulative values (never modifiers)
- `PhaseResult = { updatedState: GameState; events: GameEvent[] }` is the standard return type for all turn phases
- `ColonyInfrastructure` is `Record<InfraDomain, InfraState>` with public/corporate ownership tracked separately
- Engine/data/generators/types/utils never import Vue or Pinia

**Tests:** 74 passing (modifiers: 19, utils: 55)

---
