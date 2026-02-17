# Spacetime — Changelog

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

## Epic 2: Game Shell & Navigation (Completed 2026-02-17)

Built the application shell (Stories 2.1-2.4). Configured Vue Router with 11 lazy-loaded routes (default `/` → Dashboard). Created collapsible sidebar (AppSidebar.vue) with active route highlighting and top header bar (AppHeader.vue) with placeholder turn/BP/End Turn button. All 11 view scaffolds have styled titles and contextual empty-state messages. Built 9 shared UI components: ProgressBar, AttributeBar, StatCard, ResourceBadge, EventCard, ConfirmDialog, Tooltip, DataTable, EmptyState.

**Key architecture decisions:**
- Dark theme: zinc-950 background, zinc-900 sidebar/header, zinc-800 borders
- Sidebar: 224px expanded / 64px collapsed, indigo accent for active route
- Header values are hardcoded placeholders — wired to stores in Stories 5.3 and 12.5
- All components use Tailwind CSS only, TypeScript typed props

---

## Epic 3: Galaxy Generation & Sectors (Completed 2026-02-17)

Implemented galaxy generation and display (Stories 3.1-3.4). Built sector generator (`generateSector` — unique name from pool, density by spawn weight, threat modifier 0.5-1.5) and galaxy generator (`generateGalaxy` — 10-15 sectors, adjacency graph with 2-4 connections per sector, 1-2 bottlenecks, max 5 hops, all reachable). Created Pinia galaxy store with `sectors`, `adjacency`, `startingSectorId`, and getters for adjacent/explorable sectors. Built Galaxy View with sector list (expandable cards showing density, exploration %, adjacency connections, presence indicators), adjacency graph visualization, and summary bar.

**Key architecture decisions:**
- Galaxy generator uses layered approach: spanning tree → bottleneck designation → edge augmentation → constraint validation with retry
- `explorableSectors` getter initially used starting sector as only presence source (colony store wired in Story 4.3, fleet store deferred to Story 15.4)
- Sector cards show green/indigo/gray dots for presence/explorable/unreachable status

**Tests:** 101 passing (sector-generator: 11, galaxy-generator: 16, prior: 74)

---

## Epic 4: Planets & Colonies — Data Model

### Story 4.3 — Planet & Colony Stores (2026-02-17)

**What changed:**
- Created `src/stores/planet.store.ts` — Pinia store for discovered planets
- Created `src/stores/colony.store.ts` — Pinia store for all colonies with Terra Nova initialization
- Updated `src/stores/galaxy.store.ts` — wired colony store into `explorableSectors` getter for presence detection

**Planet store API:**
- **State**: `planets` (Map by ID)
- **Actions**: `addPlanet`, `removePlanet`, `updatePlanet`, `initialize`
- **Getters**: `getPlanet(id)`, `getPlanetsByStatus(status)`, `getPlanetsBySector(sectorId)`, computed `orbitScannedPlanets`, `groundSurveyedPlanets`, `acceptedPlanets`, `rejectedPlanets`, `colonizedPlanets`

**Colony store API:**
- **State**: `colonies` (Map by ID)
- **Actions**: `addColony`, `updateColony`, `removeColony`, `initializeTerraNova(sectorId)`
- **Getters**: `getColony(id)`, `getColoniesBySector(sectorId)`, computed `allColonies`, `sectorsWithColonies`, `colonyCount`
- `initializeTerraNova()` builds Terra Nova planet from start-conditions data (fixed features, deposits, habitability), adds it to planet store, then generates the colony with override infrastructure and population level 7

**Galaxy store update:**
- `explorableSectors` now reads `colonyStore.sectorsWithColonies` for presence detection (resolves Story 3.3 TODO)

**Acceptance criteria met:**
- Planet store: holds discovered planets, actions to add/remove, getter by ID, getter by status ✓
- Colony store: holds all colonies, actions to add/update, getter by ID, getter by sector ✓
- Colony store initializes Terra Nova on game start using start-conditions data ✓
- `npm run test` — 153/153 tests pass ✓
- `npx vue-tsc --noEmit` — zero TypeScript errors ✓

---

### Story 4.2 — Colony Generator (2026-02-17)

**What changed:**
- Created `src/generators/colony-generator.ts` — initializes a colony from a planet and colony type
- Created `src/__tests__/generators/colony-generator.test.ts` — 27 unit tests

**Generator details:**
- `generateColony(options)` accepts planet, colonyType, optional overrides (name, populationLevel, infrastructure)
- Builds infrastructure map: initializes all 12 domains to zero, then applies starting infra from colony type definition
- Deposit-dependent infrastructure (e.g., Agricultural for Frontier Colony, Mining/DeepMining/GasExtraction for Mining Outpost) only added if planet has a matching deposit
- Registers planet feature modifiers onto `colony.modifiers` with fresh IDs (independent of planet object)
- Registers colony type passive bonus as modifiers with `sourceType: 'colonyType'`
- Calculates initial attributes using `resolveModifiers()` (simplified — full formulas deferred to Story 10.1)
- Does NOT register empire-wide bonuses as modifiers
- Supports `overrideInfrastructure` for Terra Nova's custom starting state

**Acceptance criteria met:**
- Accepts planet + colony type as input ✓
- Creates colony with population level from colony type (or override) ✓
- Applies starting infrastructure from colony type definition ✓
- Calculates initial attributes using attribute formulas ✓
- Applies colony type passive bonus ✓
- Returns fully typed Colony object ✓
- Registers planet feature modifiers onto `colony.modifiers` with correct sourceType/sourceId ✓
- Registers colony type passive bonus as a modifier onto `colony.modifiers` ✓
- Does NOT register empire-wide bonuses as modifiers ✓
- Unit tests: starting infra matches colony type, attributes calculate correctly ✓
- `npm run test` — 153/153 tests pass ✓
- `npx vue-tsc --noEmit` — zero TypeScript errors ✓

---

### Story 4.1 — Planet Generator (2026-02-17)

**What changed:**
- Created `src/generators/planet-generator.ts` — generates planets with type, size, features, deposits, and feature modifiers
- Created `src/__tests__/generators/planet-generator.test.ts` — 25 unit tests

**Key details:**
- Selects planet type and size by spawn weight (verified over 1000 runs at ±5%)
- Rolls features from eligible pool (type/size match + spawn chance), shuffled to avoid bias, up to size's feature slot count
- Rolls deposits from type's deposit pool: guaranteed first, then shuffled non-guaranteed with tier chances
- Each deposit gets random richness by spawn weight; builds `Modifier[]` from feature templates
- Supports `forcedType`, `forcedSize`, `usedNames`, and `initialStatus` options for Terra Nova and testing

---
