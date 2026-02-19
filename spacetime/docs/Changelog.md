# Spacetime — Changelog

---

## Epic 14: Science & Discoveries (Completed 2026-02-19)

Implemented full science system: domain advancement, discovery rolling, schematic generation, patent development, science phase integration, and the Science UI store and view (Stories 14.1–14.5).

**Engine** (`src/engine/simulation/science-sim.ts`): `calculateEmpireSciencePerTurn` sums all science infra levels; `distributeScience` distributes evenly across 9 domains (`floor(total / 9)`) with focus doubling, accumulates points, and level-ups at `level × 15` threshold with carry-over; `createInitialScienceDomains` initializes all 9 domains at level 0; `setDomainFocus` enforces single-domain focus. Discovery system: `getCorporationScienceInfra`, `calculateDiscoveryChance` (`corpLevel × 5 + scienceInfra × 2`, doubled if focused), `getAvailableDiscoveries`, `applyDiscoveryEffects` (increments `EmpireBonuses` by key), `rollForDiscovery` (draw random definition, check focus, roll, create `Discovery`, update domains and empire bonuses). Pool exhaustion tracked via `alreadyDiscoveredDefinitionIds`.

**Schematic generator** (`src/generators/schematic-generator.ts`): `calculateSchematicChance` (`corpLevel × 2 %`), `getMaxSchematics` (`floor(corpLevel / 2)` cap), `generateSchematic` (level-based stat bonus + random modifier), `rollForSchematic` (chance → cap check → category selection → same-category replacement), `updateSchematicsOnDomainLevelUp` (recalculates bonus, preserves random modifier, increments iteration, adds MkN suffix).

**Patent generator** (`src/generators/patent-generator.ts`): `rollForPatent` (`patentChance = corpLevel × 2 %`, cap `floor(corpLevel / 2)`, deduplicates by `bonusTarget`).

**Science phase** (`src/engine/turn/science-phase.ts`): Phase #6 of turn resolution. Full pipeline: distribute science → level-up → schematic versioning → discovery rolls (science corps) → schematic rolls (shipbuilding corps) → patent rolls (all corps). Returns updated state + all events.

**Science store** (`src/stores/science.store.ts`): holds domain states, discoveries, schematics, patents, and `empireBonuses`. Actions: `setFocus(domain | null)`, `applyDiscovery(def)`, `updateScienceDomains`, `updateEmpireBonuses`, `addDiscovery`, `addSchematic`, `updateSchematic`, `addPatent`. Computed: `allDomains`, `focusedDomain`, `allDiscoveries`, `schematicsByCategory`, `discoveredDefinitionIds`.

**Science view** (`src/views/ScienceView.vue` + 3 components):
- `DomainProgress.vue` — domain name, level, tier label, progress bar, schematic categories unlocked, Focus toggle button (highlighted when focused with "2× output" label).
- `DiscoveryCard.vue` — name, domain badge, turn, description, corp attribution, empire bonus grants, unlocked schematic categories.
- `SchematicCard.vue` — name + MkN iteration, domain, level badge, stat bonus, owning corp.
- `ScienceView.vue` — 9 domains in responsive grid, empire tech bonus summary (non-zero stats only), discoveries list chronologically, schematics by category. All sections have empty states.

**Game store wiring** (`src/stores/game.store.ts`): `getFullGameState` reads from science store; `_distributeResults` writes domains, empire bonuses, discoveries, schematics, and patents back to science store after each turn. `initializeGame` calls `scienceStore.updateScienceDomains(createInitialScienceDomains())`.

**Key decisions**: Focus toggle clears if same domain clicked again (unfocus). `empireBonuses` in `GameState` now sourced from `scienceStore.empireBonuses` rather than a fresh empty object. Science domain states and all discovery/schematic/patent records survive turn boundaries via the science store.

**Tests**: 898/898 passing (18 new science-phase tests in prior story)
**TypeScript**: zero errors

---

## Epic 13: Exploration (Completed 2026-02-19)

Implemented the full exploration gameplay loop: exploration gain, planet discovery, orbit scan quality by corp level, ground survey reveal, accept/reject actions, and exploration UI (Stories 13.1–13.5).

**Engine** (`src/engine/formulas/exploration.ts`): `calculateExplorationGain()` returns `randomInt(5, 15)`; `calculatePOICount()` returns `2 + weightedRandom(0:40%, 1:40%, 2:20%)`; `generateOrbitScan(planet, corpLevel)` returns partial planet data by tier (Tier 1: type/size only; Tier 2: + deposit types + orbit features; Tier 3: + exact habitability).

**Contract completion** (`src/engine/turn/contract-phase.ts`): `resolveExplorationCompletion` adds exploration gain to sector (capped at 100), generates 2–4 planets via `generatePlanet` with `OrbitScanned` status, applies orbit scan quality, emits one discovery event per planet. `resolveGroundSurveyCompletion` reveals all features and deposit richness. `resolveContractPhase` now also returns updated `galaxy.sectors`.

**Accept/Reject** (`src/engine/actions/accept-planet.ts`): `acceptPlanet` / `rejectPlanet` — pure validation (OrbitScanned or GroundSurveyed required), returns updated planet with new status.

**Exploration UI**: `SectorCard.vue` — planets panel with status badges, Accept/Reject buttons, tier-aware scan display, Explore button pre-fills contract wizard. `GalaxyView.vue` — planet filtering per sector, wizard integration. `ContractWizard.vue` — `presetType` / `presetSectorId` props for deep-link from explore button.

**Playability fixes** applied alongside Epic 13: extraction caps now based on deposit type (`DEPOSIT_DEFINITIONS[type].maxInfraBonus`), not richness; growth accumulator capped at 10; organic emergence skips Civilian domain; CorpCard compact single-line layout; BP no longer carries over between turns (`turn-resolver.ts` resets `currentBP` to 0); Terra Nova starting deposits and infrastructure corrected to match Data.md § 17 (7 deposits, HighTechIndustry added, Low Industry raised to 8, Science correctly corporate-owned).

**Tests**: 67+ exploration tests, 38 contract-phase tests, 15 accept-planet tests — all passing.
**TypeScript**: zero errors

---

## Epic 12: Turn Resolution Pipeline (Completed 2026-02-18/19)

Implemented the master turn resolver, all income/expense/debt phases, game store, and End Turn UI (Stories 12.1–12.6).

**Turn resolver** (`src/engine/turn/turn-resolver.ts`): `resolveTurn(state)` calls 10 phases in order — debt → income → expense → contract → mission → science → corp → colony → market → event — resets `currentBP` to 0 before debt/income/expense cycle (BP is not a stock), collects all events, increments turn number, returns `TurnResult`. Pure function, no store access.

**Phases**: `resolveDebtPhase` — clears 1 token/turn, deducts 1 BP, emits Positive when last cleared. `resolveIncomePhase` — planet taxes + corp taxes, itemized `IncomeSource[]`. `resolveExpensePhase` — active contract + mission costs, deficit → debt tokens (`floor(deficit/3)`, min 1, cap 10). `resolveEventPhase` — placeholder passthrough.

**Game store** (`src/stores/game.store.ts`): `initializeGame()` — generates galaxy, creates Terra Nova, initializes budget and science domains, spawns 4 starting corps (1 Exploration, 1 Construction, 2 Science each owning 1 Science infra level). `getFullGameState()` — assembles `GameState` from all domain stores. `endTurn()` — resolves turn, distributes results to all stores, advances turn. `acknowledgeResults()` (now no-op, events are non-blocking).

**End Turn UI** (`src/composables/useTurnActions.ts`): `canEndTurn`, `isResolving`, `willCreateDebt`, `sortedEvents`; `AppHeader.vue` wired with confirmation dialog showing income/expense/net; `DashboardView.vue` shows turn events panel non-blocking.

**Tests**: 670→754 passing across all stories (turn-resolver: 24, debt-phase: 20, income-phase: 26, expense-phase: 33, game.store: 28+).
**TypeScript**: zero errors

---

## Epic 11: Corporation AI (Completed 2026-02-18)

Implemented autonomous corporation behavior: investment AI, corp phase turn resolution, and organic emergence (Stories 11.1–11.3).

**Corp AI** (`src/engine/simulation/corp-ai.ts`): `runCorpInvestmentAI(corp, state)` — capital ≥ 2 triggers investment: scans sector market deficits, selects weighted by severity, finds highest-dynamism eligible colony, buys 1 infra level (cost 2 capital); specialty-only below level 3, any domain at 3+. Level 6+: considers acquisitions if capital ≥ `target_level × 5` and target 3+ levels below; buyer gains all assets + 1 level.

**Corp phase** (`src/engine/turn/corp-phase.ts`): `resolveCorpPhase` — sorts by level descending (highest acts first), applies capital gain, runs AI per corp with incremental state threading (each corp sees previous corps' investments), skips absorbed corps via `Set<CorpId>`. Organic emergence: `calculateEmergenceChance` (`(dynamism - 5) × 10%`), `determineCorpTypeFromDomain`, `findMostProminentPublicDomain` (Civilian excluded), max one emergence per colony per turn.

**Tests**: 608→650 passing (corp-ai: 24, corp-phase: 12, corp-phase-emergence: 30).
**TypeScript**: zero errors

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
