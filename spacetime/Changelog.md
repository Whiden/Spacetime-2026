# Spacetime — Changelog

---

## Epic 9: Sector Market & Trade

### Story 9.3 — Market Store (2026-02-18)

**What changed:**
- Created `src/stores/market.store.ts` — Pinia store for sector market state
- Created `src/__tests__/stores/market.store.test.ts` — 30 unit tests

**Store state:**
- `sectorMarkets: Map<SectorId, SectorMarketState>` — per-sector market snapshot (production, consumption, net surplus, trade flows) after each market resolution
- `colonyShortages: Map<ColonyId, Shortage[]>` — per-colony shortage index derived from colony modifiers; queried without scanning all modifiers
- `colonyExportBonuses: Map<ColonyId, ExportBonus[]>` — per-colony export bonus index derived from colony modifiers

**Getters:**
- `getSectorMarket(sectorId)` — returns `SectorMarketState | undefined` for a sector
- `getColonyShortages(colonyId)` — returns `Shortage[]` (empty array if no shortages)
- `getColonyExportBonuses(colonyId)` — returns `ExportBonus[]`
- `colonyHasShortage(colonyId)` — boolean convenience getter
- `colonyHasResourceShortage(colonyId, resource)` — per-resource shortage check
- `sectorsWithShortages` — computed list of sector IDs that have market data

**Actions:**
- `resolveMarkets(gameState)` — calls `resolveMarketPhase()` engine function, updates all three state maps, returns `PhaseResult` for caller chaining through the turn pipeline
- `reset()` — clears all state (for new game)

**Key design decisions:**
- Shortage and export bonus data are re-derived from colony modifiers (sourceType `'shortage'`, sourceId prefixed `shortage_` or `export_`) rather than stored separately in the engine result — single source of truth stays on the colony, store provides indexed access for UI
- Store does NOT call `resolveMarketPhase` on its own initiative — it wraps the engine call and distributes results; game.store.ts (Story 12.4) will orchestrate the full turn pipeline
- `deficitAmount` is set to 0 in the shortage index (modifier doesn't carry amount); callers needing the exact deficit use `getSectorMarket()` → shortages list

**Acceptance criteria met:**
- Holds per-sector market state (production totals, consumption totals, surpluses, deficits) ✓
- Holds per-colony shortage flags ✓
- Action `resolveMarkets(gameState)` runs market phase and updates state ✓
- Getter `getSectorMarket(sectorId)` ✓
- Getter `getColonyShortages(colonyId)` ✓
- `npx vue-tsc --noEmit` — zero TypeScript errors ✓
- `npx vitest run` — 444/444 tests pass ✓

---

### Story 9.2 — Market Phase — Turn Resolution (2026-02-18)

**What changed:**
- Created `src/engine/turn/market-phase.ts` — `resolveMarketPhase(state: GameState): PhaseResult` pure engine function
- Created `src/__tests__/engine/turn/market-phase.test.ts` — 26 unit tests

**Function implemented:**
- `resolveMarketPhase(state): PhaseResult`
- Returns `{ updatedState, events }` with updated colony modifiers and shortage events

**Phase logic:**
1. Clears all transient market-phase modifiers (`sourceType === 'shortage'`) from every colony — this removes last turn's shortage maluses and export bonuses so they don't stack
2. For each sector in `state.galaxy.sectors`, collects colonies and builds the deposits map from `state.planets`
3. Calls `resolveMarket()` from `market-resolver.ts` for each sector
4. Applies shortage malus modifiers onto affected colonies (additive, `sourceType: 'shortage'`):
   - Food shortage → `qualityOfLife` −2
   - ConsumerGoods shortage → `qualityOfLife` −1
   - TransportCapacity shortage → `accessibility` −1
   - (Industrial input shortages affect production output via colony-sim, not colony attributes)
5. Applies export bonus modifiers onto exporting colonies (`dynamism` +1 per exported resource type, `sourceType: 'shortage'` for uniform transient clearing)
6. Updates `state.sectorMarkets` with a `SectorMarketState` per sector (trade flows empty until Story 17.2)
7. Generates `GameEvent`s for shortage colonies: Critical priority if food shortage, Warning otherwise; one event per colony

**Key architecture decisions:**
- Shortage and export-bonus modifiers both use `sourceType: 'shortage'` so they are cleared atomically at the start of each market phase — no stale values persist
- Food shortage events are Critical (population decline risk per Specs.md § 7); all others are Warning
- Events are generated per colony (not per resource) to avoid event spam
- Industrial input shortages (CommonMaterials, RareMaterials, etc.) do NOT create attribute modifiers — they halve manufacturing output in colony-sim
- `sectorMarkets` stores `inboundFlows: []` / `outboundFlows: []` until Story 17.2

**Acceptance criteria met:**
- Calls market resolver for each sector ✓
- Applies shortage maluses to colony attributes (food → -2 QoL, CG → -1 QoL, TC → -1 Accessibility) ✓
- Applies export bonuses to colony attributes (+1 Dynamism per exported resource type) ✓
- Returns updated colony states + market summary events ✓
- Unit tests: shortage maluses applied correctly ✓
- Unit tests: export bonuses applied ✓
- `npx vue-tsc --noEmit` — zero TypeScript errors ✓
- `npx vitest run` — 407/407 tests pass ✓

---

### Story 9.1 — Market Resolver (2026-02-18)

**What changed:**
- Created `src/engine/simulation/market-resolver.ts` — `resolveMarket(sectorId, colonies, depositsMap)` pure engine function
- Created `src/__tests__/engine/simulation/market-resolver.test.ts` — 24 unit tests

**Function implemented:**
- `resolveMarket(sectorId, colonies, depositsMap): MarketResolverResult`
- Returns `{ colonyFlows, sectorSummary, exportBonuses }`

**Five-phase resolution (Specs.md § 7):**
1. Phase 1: `calculateColonyResourceFlow` called for every colony in the sector
2. Phase 2+3: Internal consumption already embedded in `colony-sim` output (`surplus = produced − consumed`); positive surpluses pool to the sector market
3. Phase 4: Colonies sorted by dynamism (descending), each draws `min(deficit, pool)` from the market pool
4. Phase 5: Remaining deficits become `Shortage` records with `deficitAmount`
5. Export bonuses: colony earns `+1 dynamism` for each resource type it contributed to the pool that was consumed by another colony

**Transport Capacity special case:**
- TC is local-only — never enters the market pool
- TC shortage detected immediately when `produced < consumed`

**Export bonus design:**
- `attributeTarget: 'dynamism'`, `bonusAmount: 1` per exported resource type
- Bonus only granted if pool[resource] actually decreased (i.e., another colony consumed from it)
- TODO (Story 9.4 / Market View): Define a proper export bonus table in Data.md

**Acceptance criteria met:**
- Phase 1: Collects production from all colonies in sector ✓
- Phase 2: Each colony consumes own production first (internal consumption) ✓
- Phase 3: Remaining production goes to sector market pool ✓
- Phase 4: Colonies sorted by dynamism (highest first) attempt to fill deficits from pool ✓
- Phase 5: Remaining deficits become shortages with appropriate deficit amounts ✓
- Returns per-colony: resources received (`imported`), shortage flags, export bonuses ✓
- Returns per-sector: total production, consumption, surplus, deficit per resource ✓
- Unit tests: single colony (no trade needed), two colonies complementary production, shortage scenario, dynamism priority ordering ✓
- `npx vue-tsc --noEmit` — zero TypeScript errors ✓
- `npx vitest run` — 381/381 tests pass ✓

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
