# Spacetime — Changelog

---

## Epic 7: Contract System

### Story 7.5 — Contracts View (2026-02-18)

**What changed:**
- Created `src/components/contract/ContractCard.vue` — expandable contract card
- Updated `src/views/ContractsView.vue` — full grouped view with summary bar

**ContractCard:**
- Active: type badge (color-coded), resolved target name, corp name + level, BP/turn, progress bar, turns remaining
- Completed: same header, outcome summary (e.g. "Frontier Colony founded."), completion turn
- Click anywhere to expand/collapse full details: status, corp, BP/turn, progress, start/completion turns, colony type or ship params

**ContractsView:**
- Summary stats bar: Active count, Completed count, Total BP/turn cost
- Active section with `ContractCard` list; empty state with inline "Create Contract" button
- Completed section collapsible (collapsed by default)
- "+ New Contract" always visible in page header

**Acceptance criteria met:**
- Active contracts show type, target, corp, BP/turn, progress bar, turns remaining ✓
- Completed contracts show type, target, corp, outcome summary ✓
- "Create Contract" prominent on empty state, always accessible in header ✓
- Contracts grouped by status (Active / Completed) ✓
- Contract card click expands to full details ✓
- `npx vue-tsc --noEmit` — zero TypeScript errors ✓
- `npx vitest run` — 278/278 tests pass ✓

---

### Story 7.4 — Contract Creation UI: Wizard Flow (2026-02-18)

**What changed:**
- Created `src/composables/useContractCreation.ts` — composable managing all 4-step wizard state
- Created `src/components/contract/CorpSelector.vue` — corporation selection list component
- Created `src/components/contract/ContractWizard.vue` — 4-step modal wizard
- Updated `src/views/ContractsView.vue` — wired in wizard, shows active contract list with progress bars

**Wizard steps:**
1. **Type** — grid of 5 contract type cards (name, description, cost badge, color-coded border)
2. **Target** — context-aware target list by contract type: sectors for Exploration, OrbitScanned/Accepted planets for GroundSurvey, Accepted/GroundSurveyed planets + colony type cards for Colonization, colonies for ShipCommission, adjacent sector pair for TradeRoute
3. **Corporation** — `CorpSelector` shows eligible corps (sorted by level desc) with quality tier (Base/Improved/Elite), traits, type badge; Kickstart New Corporation button when none exist
4. **Confirm** — cost summary table (BP/turn, duration, total, net BP impact), error display, Create Contract button

**Key design decisions:**
- Composable holds all wizard state; components are purely presentational
- `resolvedTarget` computed guards trade route sector pair assembly and colonization colony-type selection
- `eligibleCorps` mirrors engine eligibility rules (megacorp ≥6, cross-type ≥3 except specialized)
- `kickstartCorp` uses first colony's planet as home; `currentTurn` hardcoded to 1 (TODO Story 12.5)
- Cancel / backdrop click at any step resets and closes without changes
- ContractsView now shows active contracts with type-colored progress bars; full list deferred to Story 7.5

**Acceptance criteria met:**
- Step 1: Select contract type grid with descriptions ✓
- Step 2: Context-aware target selection per contract type ✓
- Step 3: Corp selector with level, personality, quality tier ✓
- Kickstart New Corporation option when no eligible corps exist ✓
- Step 4: Confirm creates contract, registers BP/turn, returns to list ✓
- Cancel at any step returns without changes ✓
- Budget preview (net BP/turn) updates at each step ✓
- `npx vue-tsc --noEmit` — zero TypeScript errors ✓
- `npx vitest run` — 278/278 tests pass ✓

---

### Story 7.3 — Contract Phase: Turn Resolution (2026-02-18)

**What changed:**
- Created `src/engine/turn/contract-phase.ts` — pure engine phase function
- Created `src/__tests__/engine/turn/contract-phase.test.ts` — 17 unit tests

**Function implemented:**
- `resolveContractPhase(state: GameState): PhaseResult` — iterates all active contracts, decrements `turnsRemaining`, completes contracts at 0, returns updated state + events

**Completion effects by type:**
- `GroundSurvey`: advances planet status from `OrbitScanned` → `GroundSurveyed`, sets `groundSurveyTurn`
- `Colonization`: calls `generateColony()` to create a new colony, marks planet as `Colonized`
- `Exploration`: stub — POI generation deferred to Epic 13
- `ShipCommission`: stub — ship generation deferred to Epic 15
- `TradeRoute` (sentinel 9999): skipped — never auto-completes; cancelled by player (Story 17.1)

**Key design decisions:**
- Pure function: no store imports, returns new Maps (does not mutate input state)
- Trade routes filtered out before processing — the 9999 sentinel is transparent to the phase
- Completion events: `EventPriority.Positive`, category `'contract'`, linked to contract ID + corp ID
- `resolveGroundSurveyCompletion` guards against double-promotion (only advances `OrbitScanned`)

**Acceptance criteria met:**
- Iterates all active contracts, decrements turnsRemaining ✓
- When turnsRemaining hits 0, marks as completed and generates completion event ✓
- Colonization contracts: on completion, calls colony generator, creates new colony ✓
- Exploration contracts: stub with TODO referencing Epic 13 ✓
- Ship commission: stub with TODO referencing Epic 15 ✓
- TradeRoute: never auto-completed (ongoing sentinel) ✓
- Returns updated contract list + events generated ✓
- Unit tests: contract advances correctly, completion triggers effects ✓
- `npx vue-tsc --noEmit` — zero TypeScript errors ✓
- `npx vitest run` — 278/278 tests pass ✓

---

### Story 7.2 — Contract Store (2026-02-18)

**What changed:**
- Created `src/stores/contract.store.ts` — Pinia store for all contracts
- Updated `src/stores/budget.store.ts` — added `removeContractExpense(contractId)` to clean up BP/turn entries on contract completion/failure
- Updated `src/components/corporation/CorpHistory.vue` — wired to contract store; shows active (indigo dot) and completed (green dot) contracts per corp

**Store API:**
- **State**: `contracts` (Map by ID)
- **Computed**: `activeContracts`, `completedContracts`, `failedContracts`, `totalContractExpenses`
- **Getters**: `getContract(id)`, `contractsByColony(colonyId)`, `contractsByCorp(corpId)`
- **Actions**: `createNewContract(params)` calls engine, adds to store, registers BP/turn expense in budget; `advanceContract(id, turn)` decrements turnsRemaining, auto-completes at 0; `completeContract(id, turn)` marks Completed and removes expense; `failContract(id)` marks Failed and removes expense

**Key design decisions:**
- `createNewContract` delegates all validation to `createContract()` engine action, returning the same success/failure shape to the UI
- BP/turn expense registered immediately on creation; removed on completion/failure so `totalExpenses` stays accurate in real time
- `contractsByCorp` returns both active and completed (for history display); `contractsByColony` is active-only
- Trade route ongoing sentinel (9999 turns) transparent to the store — future cancel action will call `failContract`

**Acceptance criteria met:**
- Holds active, completed, and failed contracts ✓
- Action: `createNewContract(params)` calls engine, adds to active list, registers BP/turn in budget ✓
- Action: `advanceContract(id)` decrements turns remaining, checks completion ✓
- Action: `completeContract(id)` moves to completed, removes budget expense ✓
- Getter: `activeContracts`, `contractsByColony(id)`, `contractsByCorp(id)` ✓
- `CorpHistory.vue` now shows active and completed contracts from the store ✓
- `npx vue-tsc --noEmit` — zero TypeScript errors ✓
- `npx vitest run` — 261/261 tests pass ✓

---

### Story 7.1 — Contract Engine: Creation & Validation (2026-02-18)

**What changed:**
- Created `src/engine/actions/create-contract.ts` — pure engine function for contract creation and validation
- Created `src/__tests__/engine/actions/create-contract.test.ts` — 36 unit tests

**Functions implemented:**
- `createContract(params)`: validates all inputs and returns a new `Contract` object or a typed validation error
- `isCorpEligible(corp, contractType)`: checks corp type eligibility; cross-type allowed at level 3+ except specialized contracts; megacorp (level 6+) unrestricted
- `validateTarget(params)`: validates target type matches contract type, entity exists, and entity status is valid
- `calculateBpPerTurn(params)`: returns cost from contract definition; colonization defers to colony type definition
- `calculateDuration(params, corp)`: exploration scales with corp level (max(2, 4−floor(level/2))); colonization uses colony type duration; trade route sentinel 9999

**Validation error codes:**
- `CORP_NOT_FOUND`, `INVALID_TARGET_TYPE`, `TARGET_NOT_FOUND`, `INVALID_PLANET_STATUS`, `SECTORS_NOT_ADJACENT`, `CORP_NOT_ELIGIBLE`, `INSUFFICIENT_BP`, `MISSING_COLONY_TYPE`, `MISSING_SHIP_PARAMS`

**Key design decisions:**
- Colonization requires Accepted or GroundSurveyed status (not OrbitScanned)
- Ground survey accepts OrbitScanned or Accepted planets
- Cross-type (level 3+) does NOT apply to Colonization, ShipCommission, or TradeRoute — specialized only
- `sectorAdjacency` passed separately (Galaxy.adjacency map) since Sector itself has no adjacency field
- Trade route duration uses sentinel 9999 — contract store handles "ongoing until cancelled" (Story 17.1)
- Ship commission cost/duration are placeholders — full calculation deferred to Story 15.2

**Acceptance criteria met:**
- Validates contract type + target combination ✓
- Calculates BP/turn and duration based on contract type and corp level ✓
- Validates player has sufficient BP for at least first turn ✓
- Validates corp eligibility (correct type or level 3+ cross-type, level 6+ megacorp) ✓
- Returns new Contract object or validation error ✓
- Unit tests: valid creation, invalid target, insufficient BP, ineligible corp ✓
- `npx vue-tsc --noEmit` — zero TypeScript errors ✓
- `npx vitest run` — 261/261 tests pass ✓

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
