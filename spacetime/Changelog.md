# Spacetime — Changelog

---

## Epic 1: Project Foundation

### Story 1.1 — Project Scaffolding (2026-02-17)

**What changed:**
- Removed default Vue scaffolding (demo `counter.ts` store, `App.spec.ts` test, `You did it!` template)
- Replaced `App.vue` with a clean `<RouterView />` shell
- Created the full source folder structure matching `Structure.md`:
  - `src/types/`, `src/data/`, `src/engine/turn/`, `src/engine/simulation/`, `src/engine/formulas/`, `src/engine/actions/`
  - `src/generators/`, `src/stores/`, `src/composables/`, `src/views/`, `src/utils/`
  - `src/components/layout/`, `shared/`, `colony/`, `corporation/`, `contract/`, `fleet/`, `science/`, `market/`, `galaxy/`
  - `src/assets/styles/`
- Moved Tailwind CSS import to `src/assets/styles/main.css` (`@import "tailwindcss"`)
- Updated `main.ts` to import from the CSS file instead of directly
- Enabled TypeScript strict mode explicitly in `tsconfig.app.json` (`strict: true`, `noUncheckedIndexedAccess: true`)
- Added `passWithNoTests: true` to `vitest.config.ts` so empty test suite exits cleanly

**Acceptance criteria met:**
- `npm run dev` — starts dev server ✓
- `npm run build` — production build with no errors ✓
- `npm run test:unit` — Vitest runs with empty suite (exit code 0) ✓
- TypeScript strict mode enabled ✓
- Folder structure matches `Structure.md` ✓

---

### Story 1.2 — Core Types: Common (2026-02-17)

**What changed:**
- Created `src/types/common.ts` — the shared type foundation for the entire project

**Contents:**
- **Branded ID types** for all 13 entity types: `ColonyId`, `CorpId`, `ContractId`, `ShipId`, `MissionId`, `SectorId`, `PlanetId`, `PatentId`, `SchematicId`, `DiscoveryId`, `CaptainId`, `EventId`, `ModifierId`
- **Branded scalar types**: `TurnNumber`, `BPAmount`
- **Enums**:
  - `PlanetType` (10 types), `PlanetSize` (5 sizes), `PlanetStatus` (6 lifecycle states)
  - `DepositType` (16 deposit types), `RichnessLevel` (4 levels)
  - `ResourceType` (9 resources), `InfraDomain` (12 domains)
  - `ColonyType` (4 types), `CorpType` (9 types), `CorpPersonalityTrait` (8 traits)
  - `ContractType` (5 types), `ContractStatus` (3 statuses)
  - `MissionType` (5 types), `MissionPhase` (4 phases)
  - `ShipRole` (7 roles), `SizeVariant` (3 variants), `ShipStatus` (4 statuses), `CaptainExperience` (4 levels)
  - `SchematicCategory` (13 categories), `ScienceSectorType` (9 sectors)
  - `EventPriority` (4 levels), `SectorDensity` (3 densities)

**Acceptance criteria met:**
- All entity ID types defined with branded string pattern ✓
- `TurnNumber`, `BPAmount` as branded number types ✓
- All required enums defined ✓
- File compiles with zero errors ✓

---

### Story 1.3 — Core Types: All Entities (2026-02-17)

**What changed:**
- Created 15 entity type files in `src/types/`:

| File | Key exports |
|---|---|
| `modifier.ts` | `Modifier`, `ModifierCondition`, `ModifierBreakdownEntry` |
| `empire.ts` | `EmpireBonuses`, `EmpireShipStatBonuses`, `EmpireInfraCapBonuses`, `createEmptyEmpireBonuses()` |
| `planet.ts` | `Planet`, `Deposit`, `PlanetFeature` |
| `infrastructure.ts` | `InfraOwnership`, `InfraState`, `ColonyInfrastructure`, `getTotalLevels()`, `getCorporateLevels()` |
| `colony.ts` | `Colony`, `ColonyAttributes` (7 attributes) |
| `resource.ts` | `ResourceFlow`, `ColonyResourceSummary`, `Shortage`, `SectorMarketSummary`, `ExportBonus` |
| `corporation.ts` | `Corporation`, `CorpAssets`, `CapitalAction` |
| `contract.ts` | `Contract`, `ContractTarget` (discriminated union), `ColonizationParams`, `ShipCommissionParams`, `ContractSummary` |
| `science.ts` | `ScienceDomainState`, `Discovery`, `Schematic`, `Patent` |
| `ship.ts` | `Ship`, `Captain`, `ServiceRecord`, `ShipPrimaryStats`, `ShipDerivedStats` |
| `mission.ts` | `Mission`, `TaskForce`, `MissionReport` |
| `combat.ts` | `CombatPhase`, `CombatRound`, `ShipCombatOutcome`, `CombatResult` |
| `sector.ts` | `Sector`, `Galaxy`, `SectorPresence` |
| `budget.ts` | `BudgetState`, `IncomeSource`, `ExpenseEntry`, `BudgetHistoryEntry` |
| `event.ts` | `GameEvent`, `EventCategory` |
| `trade.ts` | `TradeRoute`, `TradeFlow`, `SectorMarketState` |
| `game.ts` | `GameState`, `PhaseResult`, `SaveFile`, `GamePhase` |

**Key design decisions:**
- `Modifier[]` stored directly on entities (colony, ship, planet) for local per-entity adjustments
- `EmpireBonuses` on `GameState` holds cumulative empire-wide bonuses as plain numbers (from discoveries)
- `ColonyInfrastructure` is `Record<InfraDomain, InfraState>` with public/corporate ownership tracked separately
- `PhaseResult = { updatedState: GameState; events: GameEvent[] }` is the return type for all turn phase functions

**Acceptance criteria met:**
- All entity interfaces defined ✓
- `GameState` has typed Maps for all entity collections ✓
- `Modifier` and `EmpireBonuses` pattern matches `Structure.md` modifier system spec ✓
- All files compile with zero errors ✓

---

### Story 1.3b — Modifier Resolver (2026-02-17)

**What changed:**
- Created `src/engine/formulas/modifiers.ts` — pure TS modifier resolution engine
- Created `src/__tests__/engine/formulas/modifiers.test.ts` — 19 unit tests

**Functions:**
- `resolveModifiers(baseValue, target, modifiers, clampMin?, clampMax?, conditionContext?)` — applies all matching modifiers and returns final value
- `getModifierBreakdown(target, modifiers, conditionContext?)` — returns per-modifier attribution list
- `filterByTarget(target, modifiers)` — filters modifier list by target string

**Resolution order:** additive modifiers sum first → multiplicative apply sequentially → clamp applied last

**Acceptance criteria met:**
- Additive modifiers stack correctly ✓
- Multiplicative modifiers chain correctly ✓
- Mixed order (add before multiply) works ✓
- Conditional modifiers (lte/gte) activate/deactivate based on context ✓
- Missing condition context = modifier inactive ✓
- Clamp (min/max) applied after all modifiers ✓
- All 19 tests pass ✓

---

### Story 1.4 — Utility Functions (2026-02-17)

**What changed:**
- Created 4 utility modules in `src/utils/`
- Created 4 test files in `src/__tests__/utils/` — 55 new tests (74 total)

**Utilities:**
- `random.ts` — `createSeededRandom()` (mulberry32 PRNG), `randomInt()`, `randomFloat()`, `chance()`, `weightedRandom()`
- `math.ts` — `clamp()`, `roundDown()`, `scale()`
- `format.ts` — `formatBP()`, `formatPercent()`, `formatTurns()`
- `id.ts` — `generateId(prefix)` (nanoid-based) + 13 typed generators: `generateColonyId()`, `generateCorpId()`, `generateContractId()`, `generateShipId()`, `generateMissionId()`, `generateSectorId()`, `generatePlanetId()`, `generatePatentId()`, `generateSchematicId()`, `generateDiscoveryId()`, `generateCaptainId()`, `generateEventId()`, `generateModifierId()`

**Acceptance criteria met:**
- All functions defined and exported ✓
- Seeded PRNG is deterministic (same seed → same output) ✓
- All 74 unit tests pass ✓

---

### Story 1.5 — Static Data Files (2026-02-17)

**What changed:**
- Created 20 static data files in `src/data/`

| File | Contents |
|---|---|
| `resources.ts` | `ResourceDefinition`, `RESOURCES` (all 9 ResourceTypes) |
| `planet-deposits.ts` | `DepositDefinition`, `DEPOSIT_DEFINITIONS` (16), `RICHNESS_CAPS`, `RICHNESS_SPAWN_WEIGHTS` |
| `planet-types.ts` | `PlanetTypeDefinition` with tiered deposit pools, `PLANET_TYPE_DEFINITIONS` (10), `PLANET_TYPE_SPAWN_WEIGHTS` |
| `planet-sizes.ts` | `PlanetSizeDefinition` (5), `PLANET_SIZE_SPAWN_WEIGHTS` |
| `planet-features.ts` | `PlanetFeatureDefinition` with `FeatureModifierTemplate[]`, 40+ features, `PLANET_FEATURE_BY_ID` lookup |
| `colony-types.ts` | `ColonyTypeDefinition` with starting infra + passive bonus modifiers (4 types) |
| `infrastructure.ts` | `InfraDomainDefinition` with `InfraCapRule`, `INFRA_DOMAIN_DEFINITIONS` (12), `EXTRACTION_DOMAINS`, `MANUFACTURING_DOMAINS` |
| `corporation-types.ts` | `CorpTypeDefinition`, `CORP_TYPE_DEFINITIONS` (9 types) |
| `corporation-names.ts` | `CORP_NAME_PREFIXES` (100+), `CORP_NAME_SUFFIXES` (50+), `CORP_NAME_CONNECTORS` |
| `personality-traits.ts` | `PersonalityTraitDefinition`, `PERSONALITY_TRAIT_DEFINITIONS`, `CONFLICTING_TRAIT_PAIRS`, `TRAIT_SPAWN_WEIGHTS` |
| `contracts.ts` | `ContractTypeDefinition`, `CONTRACT_TYPE_DEFINITIONS` (5), `calculateExplorationDuration()` |
| `ship-roles.ts` | `ShipRoleDefinition`, `SHIP_ROLE_DEFINITIONS` (7), `SIZE_VARIANT_MULTIPLIERS`, `CAPTAIN_EXPERIENCE_MODIFIERS`, `CAPTAIN_EXPERIENCE_THRESHOLDS` |
| `schematics.ts` | `SchematicCategoryDefinition`, `SCHEMATIC_CATEGORY_DEFINITIONS` (13), name pools, `SCHEMATIC_LEVEL_LABEL()` |
| `mission-types.ts` | `MissionTypeDefinition`, `MISSION_TYPE_DEFINITIONS` (5), `MISSION_SIZE_SURCHARGE_THRESHOLD = 7` |
| `science-sectors.ts` | `ScienceDomainDefinition`, `SCIENCE_DOMAIN_DEFINITIONS` (9), `getScienceLevelThreshold()` = level × 15 |
| `discoveries.ts` | `DiscoveryDefinition`, `DISCOVERY_DEFINITIONS` (9 Level 1 entries), `getDiscoveryPool()` |
| `patents.ts` | `PatentDefinition`, `PATENT_DEFINITIONS` (placeholder for future stories) |
| `sector-names.ts` | `SECTOR_NAMES` (50+ names) |
| `threats.ts` | `ThreatCategoryDefinition`, `THREAT_CATEGORY_DEFINITIONS` (7 categories, deferred) |
| `start-conditions.ts` | `TERRA_NOVA_PLANET`, `STARTING_COLONY`, `STARTING_INFRASTRUCTURE`, `STARTING_BP = 10`, `GALAXY_GENERATION_PARAMS`, `MAX_DEBT_TOKENS = 10`, `DIRECT_INVEST_COST_BP = 3`, `DEBT_TOKEN_CLEAR_COST_BP = 1` |

**Acceptance criteria met:**
- All required data files present ✓
- No Vue/Pinia imports in any data file ✓
- All files compile with zero TypeScript errors ✓
- `npm run build` — production build passes ✓
- `npm run test:unit` — 74/74 tests pass ✓

---

## Epic 2: Game Shell & Navigation

### Story 2.1 — Router Configuration (2026-02-17)

**What changed:**
- Configured Vue Router in `src/router/index.ts` with all 11 primary routes
- Created 11 placeholder view components in `src/views/`:

| Route | Name | View Component |
|---|---|---|
| `/` | `dashboard` | `DashboardView.vue` |
| `/colonies` | `colonies` | `ColoniesView.vue` |
| `/colonies/:id` | `colony-detail` | `ColonyDetailView.vue` |
| `/corporations` | `corporations` | `CorporationsView.vue` |
| `/corporations/:id` | `corp-detail` | `CorpDetailView.vue` |
| `/contracts` | `contracts` | `ContractsView.vue` |
| `/fleet` | `fleet` | `FleetView.vue` |
| `/science` | `science` | `ScienceView.vue` |
| `/market` | `market` | `MarketView.vue` |
| `/galaxy` | `galaxy` | `GalaxyView.vue` |
| `/settings` | `settings` | `SettingsView.vue` |

**Key decisions:**
- All routes use lazy loading (`() => import(...)`) for code splitting
- Detail views (`ColonyDetailView`, `CorpDetailView`) read `:id` param from route
- Each placeholder view includes a TODO comment referencing the future story that will implement its full content
- Default route `/` points to Dashboard

**Acceptance criteria met:**
- Routes defined for all primary screens ✓
- Default route is Dashboard (`/`) ✓
- Route transitions work without errors (`npm run build` passes) ✓
- All 74 existing tests still pass ✓

---

### Story 2.2 — App Layout Shell (2026-02-17)

**What changed:**
- Created `src/components/layout/AppSidebar.vue` — collapsible sidebar with navigation links to all 9 primary screens
- Created `src/components/layout/AppHeader.vue` — top bar with placeholder turn number, BP balance, income/expenses/net display, and disabled End Turn button
- Updated `src/App.vue` — assembled layout shell with sidebar + header + scrollable content area

**Layout structure:**
- Full-height flex layout: sidebar (left) + main area (right)
- Sidebar: 224px expanded / 64px collapsed, toggle button at bottom, active route highlighted with indigo accent
- Header: fixed 56px height, turn info (left), budget stats (center), End Turn button (right)
- Content: flex-1 with overflow scroll and padding
- Dark theme: zinc-950 background, zinc-900 sidebar/header, zinc-800 borders

**Key decisions:**
- Sidebar collapse state managed in `App.vue` via `ref`, passed as prop to `AppSidebar`
- Navigation uses `RouterLink` with active state detection (exact match for `/`, prefix match for others)
- Text-based icon placeholders (Unicode symbols) — can be replaced with an icon library later
- Header values are hardcoded placeholders — wired to stores in Story 5.3 and Story 12.5
- End Turn button disabled until budget system is connected
- Tailwind CSS only, no custom class names

**Acceptance criteria met:**
- Sidebar with navigation links to all primary screens, visually indicating active route ✓
- Header displays: turn number (placeholder), BP balance (placeholder), End Turn button (disabled) ✓
- Main content area renders current route view ✓
- Clean, modern aesthetic: dark theme, clear typography, proper spacing ✓
- Responsive layout (sidebar collapses) ✓
- Tailwind CSS only ✓
- `npm run build` passes ✓
