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

## Epic 3: Galaxy Generation & Sectors

### Story 3.4 — Galaxy View (2026-02-17)

**What changed:**
- Created `src/components/galaxy/SectorCard.vue` — expandable sector card with name, density, exploration %, adjacency, and presence indicators
- Created `src/components/galaxy/SectorGraph.vue` — text-based adjacency visualization with color-coded nodes and legend
- Updated `src/views/GalaxyView.vue` — full implementation with galaxy store integration, auto-generation on first load

**UI details:**
- Sector list (2/3 width) + adjacency graph sidebar (1/3 width) on large screens
- Each sector card shows: presence dot (green=presence, indigo=explorable, gray=unreachable), name, Home/Explorable badges, density, exploration progress bar
- Click to expand: adjacency connections, threat modifier, presence info (Terra Nova colony indicator for starting sector)
- Summary bar shows total sectors, explorable count, presence count
- Empty state shown when no galaxy exists

**Acceptance criteria met:**
- Lists all sectors with name, density, exploration %, presence indicators ✓
- Shows adjacency connections (text-based) ✓
- Explorable sectors visually distinguished from unexplorable ✓
- Starting sector shown with Terra Nova colony indicator ✓
- Clicking a sector shows expanded detail ✓
- `npm run test:unit` — 101/101 tests pass ✓
- `npx vue-tsc --noEmit` — zero TypeScript errors ✓

---

### Story 3.3 — Galaxy Store (2026-02-17)

**What changed:**
- Created `src/stores/galaxy.store.ts` — Pinia store for galaxy state
- Updated `src/types/sector.ts` — resolved completed TODOs for Stories 3.1-3.3

**Store API:**
- **State**: `sectors` (Map by ID), `adjacency` (Map of connections), `startingSectorId`
- **Action**: `generate()` — calls galaxy generator, stores result
- **Action**: `updateSector(sector)` — updates a sector (e.g., after exploration)
- **Getter**: `getSector(id)` — returns sector by ID
- **Getter**: `getAdjacentSectors(id)` — returns adjacent sector IDs
- **Getter**: `allSectors` — all sectors sorted by name
- **Getter**: `startingSector` — the starting sector object
- **Getter**: `explorableSectors` — sectors adjacent to those with player presence, not yet at 100% explored

**Notes:**
- `explorableSectors` currently uses starting sector as the only presence. Colony and fleet store integration deferred to Stories 4.3 and 15.4 (noted with TODOs).

---

### Story 3.2 — Galaxy Generator (2026-02-17)

**What changed:**
- Created `src/generators/galaxy-generator.ts` — generates the full galaxy with 10-15 sectors and adjacency graph
- Created `src/__tests__/generators/galaxy-generator.test.ts` — 16 unit tests

**Algorithm:**
1. Generates 10-15 sectors and assigns them to distance layers from start (max 5 hops)
2. Builds spanning tree connecting each sector to one in the previous layer
3. Designates 1-2 leaf sectors as bottlenecks (exactly 2 connections)
4. Adds edges to bring all non-bottleneck sectors to 3+ connections
5. Validates all constraints; retries if needed (generate-and-test approach)

**Key details:**
- `generateGalaxy()` returns a typed `Galaxy` object with `sectors` Map, `adjacency` Map, and `startingSectorId`
- Adjacency is always bidirectional — if A→B exists, B→A exists
- Starting sector exploration set to `GALAXY_GENERATION_PARAMS.startingSectorExplorationPercent` (10%)
- All other sectors start at 0% exploration

---

### Story 3.1 — Sector Generator (2026-02-17)

**What changed:**
- Created `src/generators/sector-generator.ts` — generates individual sector objects for the galaxy
- Created `src/__tests__/generators/sector-generator.test.ts` — 11 unit tests

**Generator details:**
- `generateSector(options?)` produces a fully typed `Sector` object
- Picks a unique name from the `SECTOR_NAMES` pool (avoids duplicates via `usedNames` set)
- Assigns density (`Sparse`/`Moderate`/`Dense`) by spawn weight (30%/50%/20%)
- Assigns threat modifier as a random float in [0.5, 1.5], rounded to 2 decimal places
- Starting sector gets exploration percentage from `GALAXY_GENERATION_PARAMS.startingSectorExplorationPercent` (10%); all others default to 0%

## Epic 4: Planets & Colonies — Data Model

### Story 4.1 — Planet Generator (2026-02-17)

**What changed:**
- Created `src/generators/planet-generator.ts` — generates planets with type, size, features, deposits, and feature modifiers
- Created `src/__tests__/generators/planet-generator.test.ts` — 25 unit tests

**Generator algorithm:**
1. Selects planet type by spawn weight (or forced type for Terra Nova)
2. Selects planet size by spawn weight (or forced size)
3. Rolls features from eligible pool (type/size match + spawn chance), up to the size's feature slot count
4. Rolls deposits from the type's deposit pool: guaranteed deposits always appear, then common/uncommon/rare roll against tier chances
5. Each deposit gets a random richness level by spawn weight (Poor 30%, Moderate 40%, Rich 20%, Exceptional 10%)
6. Builds `Modifier[]` from rolled feature templates for future colony application

**Key details:**
- `generatePlanet(options)` returns a fully typed `Planet` object
- Procedural name generation from prefix + suffix pools (540+ combinations)
- Features are shuffled before rolling to avoid ordering bias
- Deposits: guaranteed first, then shuffled non-guaranteed with tier chances
- Feature modifiers have `sourceType: 'feature'` and `sourceId` pointing to the feature ID for traceability
- All features start `revealed: false`; all deposits start `richnessRevealed: false`
- Supports `forcedType`, `forcedSize`, `usedNames`, and `initialStatus` options for Terra Nova and testing

**Acceptance criteria met:**
- Selects planet type by spawn weight ✓
- Selects size by spawn weight ✓
- Rolls features from eligible pool up to feature slot count ✓
- Rolls deposits from type's deposit pool with likelihood chances ✓
- Each spawned deposit gets random richness by spawn weight ✓
- Returns fully typed Planet object ✓
- Unit tests: types match spawn weights over 1000 runs (±5%), deposits match planet type pools, feature count within slot limits ✓
- `npm run test` — 126/126 tests pass ✓
- `npx vue-tsc --noEmit` — zero TypeScript errors ✓

---
