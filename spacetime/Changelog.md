# Spacetime — Changelog

---

## Epic 8: Infrastructure & Production

### Story 8.4 — Infrastructure UI Updates (2026-02-18)

**What changed:**
- Updated `src/stores/colony.store.ts` — added `investInfrastructure(colonyId, domain, currentBP, deposits)` action that calls `investPlanet` and updates the colony in-store on success
- Updated `src/components/colony/InfraPanel.vue` — wired the Invest button: deposits prop added, per-domain effective cap computed dynamically, button enabled when below cap and player has ≥ 3 BP, click calls `colonyStore.investInfrastructure` then `budgetStore.adjustBP(-3)`
- Updated `src/components/colony/ResourceFlow.vue` — replaced manual infra-level traversal with `calculateColonyResourceFlow(colony, deposits)` output; deposits prop added; produced/consumed/surplus shown per resource with tooltip
- Updated `src/views/ColonyDetailView.vue` — passes `planet.deposits` to both `InfraPanel` and `ResourceFlow`

**Key design decisions:**
- `investInfrastructure` lives in the colony store (not the view) so the engine function is never called directly from a component — the view only calls store actions
- BP deduction stays in the view (calling `budgetStore.adjustBP`) to avoid a circular module import between colony.store and budget.store
- Effective cap is mirrored in `InfraPanel` (Civilian → Infinity; extraction → max richness cap of deposits; others → popLevel × 2) for the button enabled state; `currentCap` on `InfraState` (still Infinity everywhere) is not used for display — TODO Story 10.1
- `ResourceFlow` now calls `calculateColonyResourceFlow` directly (pure calculation, no state mutation) instead of manually summing infra levels

**Acceptance criteria met:**
- Each infrastructure domain shows: current level, effective cap, ownership breakdown (public/corporate) ✓
- "Invest" button enabled when below cap AND player has ≥ 3 BP; disabled with tooltip explaining reason ✓
- Clicking Invest deducts 3 BP, adds +1 public infrastructure, UI updates immediately ✓
- Resource flow panel uses real production/consumption formulas from `calculateColonyResourceFlow` ✓
- Surplus shown in green, deficit in red ✓
- Tooltip on each resource shows produced / consumed / surplus breakdown ✓
- `npx vue-tsc --noEmit` — zero TypeScript errors ✓
- `npx vitest run` — 357/357 tests pass ✓

---

### Story 8.3 — Player Investment Action (2026-02-18)

**What changed:**
- Created `src/engine/actions/invest-planet.ts` — `investPlanet(params)` pure engine action
- Created `src/__tests__/engine/actions/invest-planet.test.ts` — 20 unit tests

**Function implemented:**
- `investPlanet(params: InvestPlanetParams): InvestPlanetResult`
- On success: returns `{ success: true, updatedColony, bpSpent: 3 }` with +1 public level on the target domain
- On failure: returns `{ success: false, error, message }` with one of 4 typed error codes

**Validation order:**
1. Colony ID must exist in provided colonies map → `COLONY_NOT_FOUND`
2. Player must have ≥ 3 BP → `INSUFFICIENT_BP`
3. Extraction domains: must have a matching deposit on the planet → `NO_MATCHING_DEPOSIT`
4. Domain must be below its effective cap → `AT_CAP`

**Cap calculation (`computeEffectiveCap`):**
- Civilian: `Infinity` (always allowed)
- Extraction domains (Mining, DeepMining, GasExtraction, Agricultural): max richness cap among all matching deposits (`RICHNESS_CAPS[richness]` = 5/10/15/20); returns 0 if no deposit
- All other domains: `calculateInfraCap(popLevel, domain)` = `popLevel × 2`
- NOTE: `currentCap` on InfraState is set to Infinity everywhere until Story 10.1, so caps are computed dynamically from live colony data here

**Key design decisions:**
- The function is pure — the store deducts `bpSpent` from the budget after a successful call
- Extraction domain deposit check precedes the cap check so the user gets a clear `NO_MATCHING_DEPOSIT` error rather than a misleading `AT_CAP` (which would also fire since cap=0 with no deposit)
- When multiple deposits exist for the same domain, the highest richness cap is used as the effective ceiling
- Feature bonuses to extraction caps (e.g., "Mineral Veins" +5 max Mining) deferred to Story 10.1 when `resolveModifiers` is applied to infra cap targets
- `bpSpent` exported constant `INVEST_COST_BP = 3` — referenced by the store and UI

**Acceptance criteria met:**
- Validates: target colony exists → `COLONY_NOT_FOUND` ✓
- Validates: player has sufficient BP → `INSUFFICIENT_BP` ✓
- Cost: 3 BP for +1 public infrastructure level ✓
- For extraction domains: validates matching deposit exists → `NO_MATCHING_DEPOSIT` ✓
- For extraction domains: validates not at deposit richness cap → `AT_CAP` ✓
- Returns updated colony infrastructure or validation error ✓
- Unit tests: valid investment, at population cap, at deposit cap, no deposit, insufficient BP, colony not found ✓
- `npx vue-tsc --noEmit` — zero TypeScript errors ✓
- `npx vitest run` — 357/357 tests pass ✓

---

### Story 8.2 — Colony Resource Flow Calculator (2026-02-18)

**What changed:**
- Created `src/engine/simulation/colony-sim.ts` — `calculateColonyResourceFlow(colony, deposits)`
- Created `src/__tests__/engine/simulation/colony-sim.test.ts` — 25 unit tests

**Function implemented:**
- `calculateColonyResourceFlow(colony: Colony, deposits: Deposit[]): ColonyResourceSummary`
- Returns a `ResourceFlow` (produced / consumed / surplus / imported / inShortage) for all 9 `ResourceType` values

**Processing order inside the function:**
1. Resolve extraction output modifiers via `resolveModifiers('miningOutput', ...)` etc.
2. Extract production: food, common materials, rare materials, volatiles — gated by deposit presence
3. Tier-1 manufacturing (LowIndustry, HeavyIndustry, HighTechIndustry): compare extracted supply to total demand → set `hasInputs` flag → `calculateManufacturing(level, hasInputs)`
4. Tier-2 manufacturing (SpaceIndustry): compare tier-1 outputs to space demand → cascade shortage → halved if insufficient
5. Transport: 1 TC per level (no inputs)
6. Population consumption: `calculateFoodConsumption / calculateConsumerGoodsConsumption / calculateTCConsumption`
7. Assemble `ColonyResourceSummary` — `imported=0`, `inShortage=false` until market phase (Story 9.1)

**Key design decisions:**
- Extraction requires a matching deposit (`hasDepositFor` guard) — defensive even though the generator enforces this
- Shortage detected at the pooled level: if CommonMaterials supply < LowIndustry + HeavyIndustry demand combined → both industries halved
- `consumed` tracks full demand (not actual throughput) — `surplus = produced − consumed` exposes the deficit for the market to fill
- Transport Capacity is produced and consumed locally; `inShortage` for TC set by market-phase.ts (Story 9.2)
- TODOs added for Story 9.1 (`imported` / `inShortage`) and Story 10.2 (growth section)

**Acceptance criteria met:**
- Takes colony + infrastructure + deposits as input ✓
- Returns per-resource: production amount, consumption amount, surplus/deficit ✓
- Handles extraction (deposit-dependent, with output modifiers) ✓
- Handles manufacturing (input-dependent, hasInputs flag) ✓
- Handles shortage cascading: Common Materials shortage → Low Industry halved ✓
- Cascade to tier-2: HighTech/Heavy shortage → Space Industry halved ✓
- Returns typed ColonyResourceSummary per colony ✓
- Unit tests: extraction, population consumption, full chain, shortage cascading, no deposit, modifiers ✓
- `npx vue-tsc --noEmit` — zero TypeScript errors ✓
- `npx vitest run` — 337/337 tests pass ✓

---

### Story 8.1 — Production & Consumption Formulas (2026-02-18)

**What changed:**
- Created `src/engine/formulas/production.ts` — 8 pure production/consumption formula functions
- Created `src/__tests__/engine/formulas/production.test.ts` — 34 unit tests with boundary values

**Functions implemented:**
- `calculateExtraction(infraLevel, richnessModifier)` — `infraLevel × richnessModifier`; richnessModifier is the resolved colony output modifier (default 1.0, increased by planet features like Metallic Core +0.5)
- `calculateExtractionCap(richness)` — maps `RichnessLevel` to cap: Poor=5, Moderate=10, Rich=15, Exceptional=20 (reads from `RICHNESS_CAPS` in planet-deposits data)
- `calculateManufacturing(infraLevel, hasInputs)` — returns `infraLevel` when inputs available, `floor(infraLevel / 2)` on shortage
- `calculateIndustrialInput(infraLevel)` — returns `infraLevel` (1 unit consumed per level per input type)
- `calculateFoodConsumption(popLevel)` — returns `popLevel × 2`
- `calculateConsumerGoodsConsumption(popLevel)` — returns `popLevel × 1`
- `calculateTCConsumption(popLevel)` — returns `popLevel` (TC consumed locally, not traded)
- `calculateInfraCap(popLevel, domain)` — Civilian → `Infinity`; all other domains → `popLevel × 2`

**Key design decisions:**
- `richnessModifier` in `calculateExtraction` is the resolved modifier (not the richness level directly) — callers pass the output of `resolveModifiers()` on `miningOutput` / `agriculturalOutput` etc.
- Extraction domains pass through `calculateInfraCap` returning `popLevel × 2` as a population-based baseline; caller takes `min(extractionCap, populationCap)` for the effective cap
- `calculateInfraCap` returns `Infinity` for Civilian to express "uncapped" cleanly; callers guard with `isFinite()` checks
- TODOs added referencing Story 8.2 (colony flow assembler) and Story 10.1 (attribute version with empire bonuses + local modifiers)

**Acceptance criteria met:**
- `calculateExtraction(infraLevel, richnessModifier)` returns `infraLevel × richnessModifier` ✓
- `calculateManufacturing(infraLevel, hasInputs)` returns `infraLevel` / `floor(infraLevel/2)` ✓
- `calculateFoodConsumption(popLevel)` returns `popLevel × 2` ✓
- `calculateConsumerGoodsConsumption(popLevel)` returns `popLevel × 1` ✓
- `calculateTCConsumption(popLevel)` returns `popLevel` ✓
- `calculateIndustrialInput(infraLevel)` returns `infraLevel` ✓
- `calculateInfraCap(popLevel, domain)` returns `popLevel × 2` for non-civilian, uncapped for civilian ✓
- `calculateExtractionCap(richness)` returns 5/10/15/20 per richness level ✓
- All functions have unit tests with boundary values ✓
- `npx vue-tsc --noEmit` — zero TypeScript errors ✓
- `npx vitest run` — 312/312 tests pass ✓

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
