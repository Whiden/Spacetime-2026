# Spacetime — Changelog

---

## Epic 10: Colony Simulation

### Story 10.3 — Colony Phase: Turn Resolution (2026-02-18)

**What changed:**
- Created `src/engine/turn/colony-phase.ts` — full colony simulation turn phase
- Created `src/__tests__/engine/turn/colony-phase.test.ts` — 33 unit tests

**Function implemented:**

- `resolveColonyPhase(state)` → `PhaseResult` — processes every colony once per turn:
  1. **Infrastructure cap recalculation** — for each domain, calls `calculateInfraCap()` from `attributes.ts`; extraction domains get `min(pop_cap, richness_cap)`; extraction domains with no matching deposit get cap = 0; Civilian = Infinity
  2. **Attribute recalculation** — calls all six attribute formulas from `attributes.ts` in cascade order (hab → access → dynamism → QoL → stability → growthPerTurn); shortage modifiers from market-phase are already on `colony.modifiers` and flow through naturally
  3. **Growth tick** — preserves the existing growth accumulator, delegates to `applyGrowthTick()` from `colony-sim.ts` which adds `growthPerTurn` and checks transitions
  4. **Population events** — level-up emits `EventPriority.Positive`; level-down emits `EventPriority.Warning`
  5. **Organic infrastructure growth** — delegates to `applyOrganicInfraGrowth()` with shortage resources derived from `state.sectorMarkets[colony.sectorId].netSurplus`
  6. **Attribute warning events** — emits `Warning` events for stability ≤ 2 or qualityOfLife ≤ 2

**Key architecture decisions:**
- Shortage resources for organic growth are derived from `state.sectorMarkets` (previous turn's data) because colony-phase (#8) runs before market-phase (#9) in the turn order
- Infra caps are recalculated before attribute calculation so `currentCap` values are accurate for organic growth cap checks
- The growth accumulator in `colony.attributes.growth` is intentionally preserved when building `colonyWithAttrs` — `applyGrowthTick` owns the responsibility of adding `growthPerTurn` and triggering transitions
- Attribute warnings (stability/QoL ≤ 2) are structural issues (debt, habitability, features) distinct from shortage warnings already emitted by market-phase
- Colonies with no matching planet in `state.planets` are silently skipped (orphan guard)

**Acceptance criteria met:**
- Recalculates all attributes for every colony (using current market data, infra, etc.) ✓
- Applies growth tick ✓
- Checks population level transitions ✓
- Checks organic infrastructure growth ✓
- Returns updated colonies + events (population milestones, attribute warnings) ✓
- Unit tests: full colony turn with attribute changes ✓, population growth event ✓, population decline event ✓, infra cap recalculation ✓, organic growth check ✓, shortage resource derivation ✓, attribute warnings ✓, multiple colonies ✓, state immutability ✓
- `npx vue-tsc --noEmit` — zero TypeScript errors ✓
- `npx vitest run` — 584/584 tests pass ✓

---

### Story 10.2 — Colony Simulation: Growth & Population (2026-02-18)

**What changed:**
- Extended `src/engine/formulas/growth.ts` — added three colony growth formula functions
- Extended `src/engine/simulation/colony-sim.ts` — added growth tick and organic infra growth functions
- Extended `src/__tests__/engine/formulas/growth.test.ts` — 24 new tests for colony formulas
- Extended `src/__tests__/engine/simulation/colony-sim.test.ts` — 22 new tests for growth simulation

**Functions added to `growth.ts`:**

- `shouldPopLevelUp(growth, popLevel, maxPopLevel, civilianInfra)` — returns true when all three level-up conditions are met: `growth >= 10`, pop is below planet size cap, and `civilianInfra >= (popLevel + 1) × 2`
- `shouldPopLevelDown(growth, popLevel)` — returns true when `growth <= -1` and `popLevel > 1`
- `calculateOrganicInfraChance(dynamism)` — returns `dynamism × 5` as an integer percentage (0-50)

**Types + functions added to `colony-sim.ts`:**

- `GrowthTickResult` — `{ updatedColony, populationChanged, changeType: 'levelUp' | 'levelDown' | null }`
- `applyGrowthTick(colony, growthPerTurn, maxPopLevel)` → `GrowthTickResult` — applies one turn of growth accumulation; triggers level-up (pop+1, growth→0) or level-down (pop-1, growth→9) when conditions are met; never mutates input colony
- `OrganicGrowthResult` — `{ triggered, domain, updatedColony }`
- `applyOrganicInfraGrowth(colony, dynamism, shortageResources, rng?)` → `OrganicGrowthResult` — rolls `dynamism × 5%` chance; on success picks a demand-weighted eligible domain (shortage domains get 3× weight, Civilian excluded, capped domains excluded) and adds +1 public level; accepts optional `rng` for deterministic testing

**Key architecture decisions:**
- Growth tick is pure and returns a new colony object — caller (colony-phase.ts, Story 10.3) is responsible for event generation from `changeType`
- Organic growth uses `colony.infrastructure[domain].currentCap` for cap checks — correctly gated once colony-phase.ts starts populating it (Story 10.3)
- `shortageResources: ResourceType[]` is a parameter so the caller can pass live market data; the function itself is pure
- Civilian, Science, and Military are excluded from organic domain selection — Civilian grows via population mechanics; Science/Military do not produce tradeable resources with shortages
- Science and Military domains with existing levels participate at base weight 1 (could benefit from organic growth even without a resource shortage)

**Acceptance criteria met:**
- Growth accumulates each turn based on growth formula ✓
- At growth 10 + civilian infra requirement met → pop level +1, growth resets to 0 ✓
- At growth -1 → pop level -1, growth resets to 9 ✓
- Population capped by planet size max ✓
- Organic infra growth: `dynamism × 5%` chance per turn, +1 to random demand-weighted domain ✓
- Unit tests: growth accumulation ✓, level up trigger ✓, level down trigger ✓, pop cap ✓, organic growth probability ✓
- `npx vue-tsc --noEmit` — zero TypeScript errors ✓
- `npx vitest run` — 551/551 tests pass ✓

---

### Story 10.1 — Attribute Formulas (2026-02-18)

**What changed:**
- Created `src/engine/formulas/attributes.ts` — all six colony attribute calculation functions
- Created `src/__tests__/engine/formulas/attributes.test.ts` — 67 unit tests

**Functions implemented:**

- `calculateHabitability(basePlanetHab, colonyModifiers)` — resolves base planet habitability through local 'habitability' modifiers (planet features); clamped 0–10
- `calculateAccessibility(transportInfra, colonyModifiers)` — `3 + floor(transport/2)` resolved through local 'accessibility' modifiers; clamped 0–10
- `calculateDynamism(accessibility, populationLevel, totalCorporateInfra, colonyModifiers)` — `floor((access+pop)/2) + min(3, floor(corpInfra/10))` resolved through local 'dynamism' modifiers; clamped 0–10
- `calculateQualityOfLife(habitability, colonyModifiers)` — `10 - floor(max(0,10-hab)/3)` resolved through local 'qualityOfLife' modifiers (shortage maluses from market-phase already on colony); clamped 0–10
- `calculateStability(qualityOfLife, militaryInfra, debtTokens, colonyModifiers)` — reads `debtTokens` **directly** from the caller (not from modifiers); `10 - max(0,5-qol) - floor(debt/2) + min(3,floor(military/3))` resolved through local 'stability' modifiers; clamped 0–10
- `calculateGrowthPerTurn(qualityOfLife, stability, accessibility, habitability, colonyModifiers)` — `floor((qol+stab+access)/3) - 3 - floor(max(0,10-hab)/3)` resolved through local 'growth' modifiers; **not clamped** (accumulator transitions at −1/+10)
- `calculateInfraCap(popLevel, domain, empireBonuses, colonyModifiers)` — `popLevel×2 + empireBonuses.infraCaps[domain]` resolved through local 'max{Domain}' modifiers (e.g., Mineral Veins → 'maxMining'); returns Infinity for Civilian; floor + max(0) for all others

**Key architecture decisions:**
- All attribute functions use `resolveModifiers()` for local per-entity bonuses — no inline bonus hardcoding
- `debtTokens` is read directly from the passed-in state value, never expressed as a per-colony modifier (empire-wide value, applies uniformly — see Structure.md § Empire Bonuses vs Local Modifiers)
- Empire infra cap bonuses are plain numbers from `EmpireInfraCapBonuses`, combined before resolveModifiers, not stored as modifiers
- `calculateInfraCap` returns the pop-derived cap only; the tighter deposit richness cap (from `calculateExtractionCap` in production.ts) is the caller's responsibility to enforce in colony-sim.ts
- Growth is intentionally unclamped — it is a progress accumulator, not an attribute; transitions are handled by colony-sim.ts (Story 10.2)

**Acceptance criteria met:**
- All attribute functions use `resolveModifiers` for local per-entity bonuses ✓
- All attribute functions read empire-wide values directly from state (debt tokens, empire bonuses) — not from modifiers ✓
- `calculateHabitability(basePlanetHab, colonyModifiers)` ✓
- `calculateAccessibility(transportInfra, colonyModifiers)` — base is `3 + floor(transport/2)` ✓
- `calculateStability(...)` reads `gameState.debtTokens` directly for debt malus, uses local modifiers for everything else ✓
- `calculateInfraCap(popLevel, domain, empireBonuses, colonyModifiers)` — base is `popLevel×2 + empireBonuses.infraCaps[domain]`, then resolves through local modifiers ✓
- Formula implementations match Specs.md Section 5 ✓
- Unit tests verify local modifiers and empire bonuses combine correctly ✓
- Unit tests verify debt is read from state not modifiers ✓
- `npx vue-tsc --noEmit` — zero TypeScript errors ✓
- `npx vitest run` — 511/511 tests pass ✓

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
