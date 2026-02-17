# Spacetime — Features & Implementation Plan

> This document defines the implementation roadmap broken into epics and user stories. Each story has a short description and acceptance criteria to guide development. Epics are ordered by dependency — later epics build on earlier ones.
>
> **Convention**: Stories marked 🧪 require unit tests. Stories marked 🖥️ are UI-only. Stories marked 🔧 are engine-only.

---

## Table of Contents

1. [Epic 1: Project Foundation](#epic-1-project-foundation)
2. [Epic 2: Game Shell & Navigation](#epic-2-game-shell--navigation)
3. [Epic 3: Galaxy Generation & Sectors](#epic-3-galaxy-generation--sectors)
4. [Epic 4: Planets & Colonies — Data Model](#epic-4-planets--colonies--data-model)
5. [Epic 5: Budget System](#epic-5-budget-system)
6. [Epic 6: Corporations — Data Model & Lifecycle](#epic-6-corporations--data-model--lifecycle)
7. [Epic 7: Contract System](#epic-7-contract-system)
8. [Epic 8: Infrastructure & Production](#epic-8-infrastructure--production)
9. [Epic 9: Sector Market & Trade](#epic-9-sector-market--trade)
10. [Epic 10: Colony Simulation](#epic-10-colony-simulation)
11. [Epic 11: Corporation AI](#epic-11-corporation-ai)
12. [Epic 12: Turn Resolution Pipeline](#epic-12-turn-resolution-pipeline)
13. [Epic 13: Exploration](#epic-13-exploration)
14. [Epic 14: Science & Discoveries](#epic-14-science--discoveries)
15. [Epic 15: Ships & Blueprints](#epic-15-ships--blueprints)
16. [Epic 16: Missions & Combat](#epic-16-missions--combat)
17. [Epic 17: Cross-Sector Trade](#epic-17-cross-sector-trade)
18. [Epic 18: Save & Load System](#epic-18-save--load-system)
19. [Epic 19: Event System Foundation](#epic-19-event-system-foundation)
20. [Epic 20: Polish & Playtesting](#epic-20-polish--playtesting)

---

## Epic 1: Project Foundation

> Set up the project, define all TypeScript types, create utility functions, and establish static data files. No game logic yet — just the skeleton.

### Story 1.1: Project Scaffolding 🔧
**Description**: Initialize the Vue 3 + TypeScript project with Vite, Pinia, Vue Router, Tailwind CSS, and Vitest. Configure all tooling.

**Acceptance Criteria**:
- `npm run dev` starts dev server with hot reload
- `npm run build` produces production build with no errors
- `npm run test` runs Vitest with zero tests passing (empty suite)
- Tailwind CSS classes render correctly in a test component
- TypeScript strict mode enabled
- Folder structure matches Structure.md

### Story 1.2: Core Types — Common 🔧
**Description**: Define shared types used across the entire project: Id types, TurnNumber, BPAmount, enums for planet types, sizes, resource types, etc.

**Files**: `src/types/common.ts`

**Acceptance Criteria**:
- All entity ID types defined with branded string pattern (ColonyId, CorpId, etc.)
- TurnNumber, BPAmount as branded number types
- All shared enums defined: PlanetType, PlanetSize, ResourceType, InfraDomain, CorpType, ContractType, ContractStatus, MissionType, MissionPhase, ShipRole, SizeVariant, SchematicCategory, ScienceSectorType, EventPriority
- File compiles with zero errors

### Story 1.3: Core Types — All Entities 🔧
**Description**: Define TypeScript interfaces for every game entity.

**Files**: `src/types/colony.ts`, `src/types/planet.ts`, `src/types/corporation.ts`, `src/types/contract.ts`, `src/types/resource.ts`, `src/types/infrastructure.ts`, `src/types/science.ts`, `src/types/ship.ts`, `src/types/mission.ts`, `src/types/combat.ts`, `src/types/sector.ts`, `src/types/budget.ts`, `src/types/event.ts`, `src/types/trade.ts`, `src/types/game.ts`

**Acceptance Criteria**:
- Every entity from Specs.md and Data.md has a corresponding interface
- `GameState` master type in `game.ts` combines all domain states
- All interfaces use proper ID types from `common.ts`
- All files compile with zero errors and zero `any` types
- Interfaces match the properties listed in Specs.md tables

### Story 1.3b: Modifier System Types & Resolver 🔧🧪
**Description**: Define the modifier type system and implement the resolver function that colony attributes and ship stats use for local per-entity variation. Also define the EmpireBonuses type for global cumulative values.

**Files**: `src/types/modifier.ts`, `src/types/empire.ts`, `src/engine/formulas/modifiers.ts`

**Acceptance Criteria**:
- `Modifier` interface defined with: id, target (string), operation ('add' | 'multiply'), value (number), sourceType ('feature' | 'colonyType' | 'schematic' | 'shortage' | 'event'), sourceId (string)
- `ModifierCondition` interface defined with optional fields: attribute, comparison ('lte' | 'gte'), value, scope ('colony')
- `EmpireBonuses` interface defined with: shipStats (per-stat cumulative bonuses), infraCaps (per-domain cumulative bonuses)
- `resolveModifiers(baseValue, target, modifiers)` function: filters modifiers by target, applies all additive modifiers first, then all multiplicative modifiers, returns final value
- `getModifierBreakdown(baseValue, target, modifiers)` function: returns array of `{ source, operation, value }` for UI tooltip display
- Additive modifiers sum, multiplicative modifiers multiply sequentially
- Result clamped to provided min/max bounds when specified
- Conditional modifiers only apply when condition is met
- Unit tests: additive stacking, multiplicative stacking, mixed add+multiply order, empty modifier list returns base value, conditional modifier applies/doesn't apply, breakdown returns correct attribution
- `EmpireBonuses` initializes with all zeros, is a plain object (not modifiers)

### Story 1.4: Utility Functions 🔧🧪
**Description**: Implement shared utility functions for random number generation, math helpers, formatting, and ID generation.

**Files**: `src/utils/random.ts`, `src/utils/math.ts`, `src/utils/format.ts`, `src/utils/id.ts`

**Acceptance Criteria**:
- `random.ts`: seeded random, `randomInt(min, max)`, `weightedRandom(options)`, `randomFloat(min, max)`, `chance(percent)` — all accept optional seed
- `math.ts`: `clamp(value, min, max)`, `roundDown(value)`, `scale(value, fromRange, toRange)`
- `format.ts`: `formatBP(amount)`, `formatPercent(value)`, `formatTurns(count)`
- `id.ts`: `generateId(prefix)` returning prefixed nanoid strings
- All functions have unit tests
- No Vue or Pinia imports

### Story 1.5: Static Data Files 🔧
**Description**: Create all static data files containing game constants, tables, and templates as defined in Data.md.

**Files**: All files in `src/data/`

**Acceptance Criteria**:
- `planet-types.ts`: all 10 planet types with base habitability, deposit pools, spawn weights
- `planet-features.ts`: all 20 features with modifiers, visibility, spawn conditions
- `planet-deposits.ts`: all 6 deposit types with richness levels and production modifiers
- `colony-types.ts`: all 7 colony types with starting infra, passive bonuses, costs
- `resources.ts`: all 9 resources + TC with categories
- `infrastructure.ts`: all 10 domains with production/consumption rules
- `corporation-types.ts`: all 8 corp types with investment priorities
- `corporation-names.ts`: name generation pools (50+ prefixes, 50+ suffixes minimum)
- `personality-traits.ts`: all 8 traits with effects and spawn weights
- `contracts.ts`: all 8 contract type templates with base costs and durations
- `ship-roles.ts`: all 7 roles with base stats, size variants, derived stat formulas
- `schematics.ts`: all 10 schematic categories with stat affinities, level scaling, name pools
- `patents.ts`: patent definitions (placeholder structure for future corp differentiation)
- `mission-types.ts`: all 5 mission types with costs and durations
- `science-sectors.ts`: all 9 sectors with level thresholds
- `sector-names.ts`: name generation pool (50+ names)
- `start-conditions.ts`: Terra Nova, starting colony, starting budget
- All files export typed constants matching Data.md tables
- No Vue or Pinia imports

---

## Epic 2: Game Shell & Navigation

> Build the application shell: sidebar navigation, header with turn/BP display, router configuration, and empty view scaffolds. The player can navigate between screens but everything is empty.

### Story 2.1: Router Configuration 🖥️
**Description**: Set up Vue Router with routes for all primary screens.

**Files**: `src/router/index.ts`

**Acceptance Criteria**:
- Routes defined: `/` (Dashboard), `/colonies` , `/colonies/:id`, `/corporations`, `/corporations/:id`, `/contracts`, `/fleet`, `/science`, `/market`, `/galaxy`, `/settings`
- Default route is Dashboard
- Route transitions work without errors

### Story 2.2: App Layout Shell 🖥️
**Description**: Create the main application layout with sidebar navigation, top header bar, and main content area.

**Files**: `src/App.vue`, `src/components/layout/AppHeader.vue`, `src/components/layout/AppSidebar.vue`

**Acceptance Criteria**:
- Sidebar with navigation links to all primary screens, visually indicating active route
- Header displays: turn number (placeholder), BP balance (placeholder), End Turn button (disabled)
- Main content area renders current route view
- Clean, modern aesthetic: dark or light theme, clear typography, proper spacing
- Responsive layout (sidebar collapses on small screens)
- Tailwind CSS only, no custom class names

### Story 2.3: Empty View Scaffolds 🖥️
**Description**: Create placeholder views for all screens with titles and empty states.

**Files**: All files in `src/views/`

**Acceptance Criteria**:
- Each view renders with its screen title
- Each view shows an appropriate empty state message (e.g., "No colonies yet", "No active contracts")
- Views use a consistent layout pattern
- All routes render without errors

### Story 2.4: Shared UI Components 🖥️
**Description**: Build reusable UI components used across multiple screens.

**Files**: `src/components/shared/ProgressBar.vue`, `AttributeBar.vue`, `StatCard.vue`, `ResourceBadge.vue`, `EventCard.vue`, `ConfirmDialog.vue`, `Tooltip.vue`, `DataTable.vue`, `EmptyState.vue`

**Acceptance Criteria**:
- `ProgressBar`: accepts value (0-100), color, optional label. Renders filled bar.
- `AttributeBar`: accepts value (0-10), label, color coding (green >6, yellow 4-6, red <4)
- `StatCard`: accepts label + value, optional trend indicator (up/down/neutral)
- `ResourceBadge`: accepts resource type + amount, shows icon/symbol + formatted number
- `EventCard`: accepts event object, shows priority-colored indicator + summary + expandable detail
- `ConfirmDialog`: modal with message, confirm/cancel buttons, emits result
- `Tooltip`: hover-triggered info box, accepts text content
- `DataTable`: accepts columns definition + row data, supports sorting by column
- `EmptyState`: accepts message + optional action button text, emits action click
- All components use props with TypeScript types
- All components use Tailwind CSS only

---

## Epic 3: Galaxy Generation & Sectors

> Generate the galaxy (sector network) at game start. Display sectors in the Galaxy screen. This is foundational — sectors are the container for everything else.

### Story 3.1: Sector Generator 🔧🧪
**Description**: Implement sector generation: name, density, threat modifier.

**Files**: `src/generators/sector-generator.ts`

**Acceptance Criteria**:
- Generates sector with unique name from name pool
- Assigns density (Sparse/Moderate/Dense) by spawn weight
- Assigns threat modifier (0.5-1.5)
- Assigns exploration percentage (0% default, 100% for starting sector)
- Returns typed Sector object
- Unit tests verify valid output ranges

### Story 3.2: Galaxy Generator 🔧🧪
**Description**: Generate the full galaxy: 10-15 sectors with adjacency graph.

**Files**: `src/generators/galaxy-generator.ts`

**Acceptance Criteria**:
- Generates 10-15 sectors
- Builds adjacency graph: 2-4 connections per sector, all sectors reachable from start
- Starting sector has 2-3 connections
- 1-2 bottleneck sectors (exactly 2 connections)
- Max 4 connections per sector
- Max 5 hops from start to furthest sector
- Starting sector at 100% explored
- Unit tests verify: connectivity (all reachable), connection limits, bottleneck count
- No Vue or Pinia imports

### Story 3.3: Galaxy Store 🔧
**Description**: Create Pinia store for galaxy state.

**Files**: `src/stores/galaxy.store.ts`

**Acceptance Criteria**:
- Holds array of Sector objects and adjacency map
- Action: `generateGalaxy()` calls galaxy generator, stores result
- Getter: `getSector(id)` returns sector by ID
- Getter: `getAdjacentSectors(id)` returns adjacent sector IDs
- Getter: `explorableSectors` returns sectors adjacent to those with player presence

### Story 3.4: Galaxy View 🖥️
**Description**: Display sector list with adjacency connections, exploration status, and basic info.

**Files**: `src/views/GalaxyView.vue`, `src/components/galaxy/SectorCard.vue`, `src/components/galaxy/SectorGraph.vue`

**Acceptance Criteria**:
- Lists all sectors with name, density, exploration %, fleet/colony presence indicators
- Shows adjacency connections (text-based: "Connected to: Sector A, Sector B")
- Explorable sectors visually distinguished from unexplorable
- Starting sector shown with Terra Nova colony indicator
- Clicking a sector shows expanded detail (POIs discovered, contracts active)

---

## Epic 4: Planets & Colonies — Data Model

> Implement planet generation and colony data structures. Create Terra Nova as the starting colony. Display colonies in the UI. No simulation yet — just data display.

### Story 4.1: Planet Generator 🔧🧪
**Description**: Generate planets with type, size, features, and deposits according to Data.md rules.

**Files**: `src/generators/planet-generator.ts`

**Acceptance Criteria**:
- Selects planet type by spawn weight
- Selects size by spawn weight
- Rolls features from eligible pool up to feature slot count
- Rolls deposits from type's deposit pool with likelihood chances
- Each spawned deposit gets random richness by spawn weight
- Returns fully typed Planet object
- Unit tests: verify types match spawn weights over 1000 runs (±5%), deposits match planet type pools, feature count within slot limits

### Story 4.2: Colony Generator 🔧🧪
**Description**: Initialize a colony from a planet and colony type selection.

**Files**: `src/generators/colony-generator.ts`

**Acceptance Criteria**:
- Accepts planet + colony type as input
- Creates colony with population level 1
- Applies starting infrastructure from colony type definition
- Calculates initial attributes using attribute formulas
- Applies colony type passive bonus
- Returns fully typed Colony object
- Unit tests: verify starting infra matches colony type, attributes calculate correctly
- On colony creation, registers planet feature modifiers onto `colony.modifiers` array
- Registers colony type passive bonus as a modifier onto `colony.modifiers` array
- Each modifier has correct sourceType and sourceId for traceability
- Does NOT register any empire-wide bonuses as modifiers

### Story 4.3: Planet & Colony Stores 🔧
**Description**: Create Pinia stores for planets and colonies.

**Files**: `src/stores/planet.store.ts`, `src/stores/colony.store.ts`

**Acceptance Criteria**:
- Planet store: holds discovered planets, actions to add/remove, getter by ID, getter by status (orbit scanned, ground surveyed, colonized, rejected)
- Colony store: holds all colonies, actions to add/update, getter by ID, getter by sector
- Colony store initializes Terra Nova on game start using start-conditions data

### Story 4.4: Colony List View 🖥️
**Description**: Display all colonies in a list with summary information.

**Files**: `src/views/ColoniesView.vue`, `src/components/colony/ColonyCard.vue`

**Acceptance Criteria**:
- Lists all colonies showing: name, type, population level, attribute bars, alert icons for shortages
- Colony cards are clickable, navigate to detail view
- Shows "1 colony" initially (Terra Nova)
- Attribute bars use color coding (green/yellow/red)

### Story 4.5: Colony Detail View 🖥️
**Description**: Display full colony information: attributes, infrastructure, deposits, features, corporations present.

**Files**: `src/views/ColonyDetailView.vue`, `src/components/colony/InfraPanel.vue`, `src/components/colony/AttributePanel.vue`, `src/components/colony/ResourceFlow.vue`

**Acceptance Criteria**:
- Shows all 6 attributes with current value, bar visualization, and tooltip explaining formula
- Infrastructure panel: lists all domains with current level, ownership (public/corporate), cap
- Resource flow: shows production and consumption per resource for this colony
- Features list with modifiers shown
- Deposits list with richness and current extraction level
- Corporations present (empty initially)
- "Invest" button per infrastructure domain (disabled until budget system works)
- Attribute tooltips use `getModifierBreakdown()` to show: "Habitability 9: Base 8 (Continental) + 1 (Temperate Climate)"
- Each modifier source displayed with name and value

---

## Epic 5: Budget System

> Implement the BP economy: income calculation, expense tracking, debt tokens. Display budget in header and dedicated section of dashboard.

### Story 5.1: Tax Formulas 🔧🧪
**Description**: Implement planet tax and corporation tax calculations.

**Files**: `src/engine/formulas/tax.ts`

**Acceptance Criteria**:
- calculatePlanetTax(popLevel, habitability): implements the planet tax formula from Specs.md Section 3
- Higher population yields more tax, low habitability reduces it
- Returns 0 for very low population or very low habitability
- Verifies: pop 7 hab 9 = 10 BP, pop 5 hab 2 = 0 BP, pop 7 hab 2 = 0 BP- Returns 0 if popLevel < 5

### Story 5.2: Budget Store 🔧
**Description**: Create Pinia store for budget state: balance, income, expenses, debt tokens.

**Files**: `src/stores/budget.store.ts`

**Acceptance Criteria**:
- State: currentBP, income (itemized), expenses (itemized), debtTokens
- Action: `calculateIncome()` sums all planet taxes + corp taxes
- Action: `addExpense(source, amount)` tracks expense by source
- Action: `applyDebt(deficit)` creates debt tokens: `floor(deficit / 3)`, min 1, capped at 10 total
- Action: `clearDebtToken()` removes 1 token, costs 1 BP
- Getter: `netBP` returns income - expenses
- Getter: `stabilityMalus` returns `floor(debtTokens / 2)`
- Initializes with 10 BP, income from Terra Nova

### Story 5.3: Budget Display 🖥️
**Description**: Show budget information in the header and on the dashboard.

**Files**: `src/composables/useBudgetDisplay.ts`, update `AppHeader.vue`, update `DashboardView.vue`

**Acceptance Criteria**:
- Header shows: current BP (prominent), income/turn, expenses/turn, net/turn
- BP display color-coded: green (positive net), yellow (near zero), red (deficit)
- Dashboard shows itemized income breakdown (per colony, per corp)
- Dashboard shows itemized expense breakdown (per contract, per mission)
- Debt tokens displayed if any exist, with stability malus warning

---

## Epic 6: Corporations — Data Model & Lifecycle

> Implement corporation generation, data model, capital system, and display. No AI behavior yet — just creating corps and viewing them.

### Story 6.1: Corporation Generator 🔧🧪
**Description**: Generate corporations with name, type, personality traits, and starting stats.

**Files**: `src/generators/corp-generator.ts`, `src/generators/name-generator.ts`

**Acceptance Criteria**:
- Generates unique name from name pools (prefix + suffix or pattern)
- Assigns type (from parameter or random)
- Assigns 1 trait (70%) or 2 traits (30%), excluding conflicting pairs
- Sets level 1, capital 0, home planet from parameter
- Returns typed Corporation object
- Unit tests: name uniqueness over 100 generations, trait conflict exclusion, valid type assignment

### Story 6.2: Corporation Store 🔧
**Description**: Create Pinia store for all corporations.

**Files**: `src/stores/corporation.store.ts`

**Acceptance Criteria**:
- Holds all corporations in a map by ID
- Action: `addCorporation(corp)` adds to store
- Action: `kickstartCorp(type, homePlanet)` generates and adds a new level 1 corp
- Action: `addCapital(corpId, amount)` increases corp capital
- Action: `spendCapital(corpId, amount)` decreases corp capital, validates sufficient funds
- Action: `levelUp(corpId)` increases level if capital sufficient (cost = level × 3)
- Getter: `getCorp(id)`, `getCorpsByType(type)`, `getCorpsByPlanet(planetId)`
- Getter: `getCorpTax(id)` returns calculated tax for corp

### Story 6.3: Corporation Capital Formulas 🔧🧪
**Description**: Implement capital gain calculations.

**Files**: `src/engine/formulas/growth.ts` (corp section)

**Acceptance Criteria**:
- `calculateCapitalGain(corp)`: returns `random(0,1) + floor(totalInfra / 10)`
- `calculateCompletionBonus(contractBPPerTurn, duration)`: returns `floor((bpPerTurn × duration) / 5)`
- `calculateLevelUpCost(currentLevel)`: returns `currentLevel × 3`
- `calculateAcquisitionCost(targetLevel)`: returns `targetLevel × 5`
- `calculateMaxInfra(corpLevel)`: returns `corpLevel × 4`
- Unit tests for all functions with boundary values

### Story 6.4: Corporations View 🖥️
**Description**: Display corporation list and detail views.

**Files**: `src/views/CorporationsView.vue`, `src/views/CorpDetailView.vue`, `src/components/corporation/CorpCard.vue`, `src/components/corporation/CorpAssets.vue`, `src/components/corporation/CorpHistory.vue`

**Acceptance Criteria**:
- List view shows all corps: name, type icon/label, level, capital, personality traits, home planet
- Corps sorted by level (highest first)
- Detail view shows: full stats, personality trait descriptions, infrastructure owned (list by planet), contract history, capital breakdown
- Initially empty with "No corporations yet — post a contract to kickstart your first corporation" guidance

---

## Epic 7: Contract System

> Implement the contract creation flow, contract execution (progress tracking), and contract completion. This is the player's primary interaction — it must feel smooth.

### Story 7.1: Contract Engine — Creation & Validation 🔧🧪
**Description**: Implement contract creation logic: validate inputs, calculate costs, check eligibility.

**Files**: `src/engine/actions/create-contract.ts`

**Acceptance Criteria**:
- Validates contract type + target combination (e.g., can't explore a colony)
- Calculates BP/turn and duration based on contract type and corp level
- Validates player has sufficient BP for at least first turn
- Validates corp eligibility (correct type or level 3+ for cross-type)
- Returns new Contract object or validation error
- Unit tests: valid creation, invalid target, insufficient BP, ineligible corp

### Story 7.2: Contract Store 🔧
**Description**: Create Pinia store for contracts.

**Files**: `src/stores/contract.store.ts`

**Acceptance Criteria**:
- Holds active, completed, and failed contracts
- Action: `createContract(params)` calls engine, adds to active list, deducts from budget
- Action: `advanceContract(id)` decrements turns remaining, checks completion
- Action: `completeContract(id)` moves to completed, triggers completion effects
- Getter: `activeContracts`, `contractsByColony(id)`, `contractsByCorp(id)`

### Story 7.3: Contract Phase — Turn Resolution 🔧🧪
**Description**: Implement contract advancement during turn resolution.

**Files**: `src/engine/turn/contract-phase.ts`

**Acceptance Criteria**:
- Iterates all active contracts, decrements turnsRemaining
- When turnsRemaining hits 0, marks as completed and generates completion event
- Colonization contracts: on completion, calls colony generator, creates new colony
- Infrastructure contracts: on completion, adds infrastructure levels to target colony
- Exploration contracts: on completion, generates POIs (see Epic 13)
- Ship commission: on completion, generates ship using ship stat generator with role, variant, corp schematics, and empire tech bonuses (see Epic 15)
- Returns updated contract list + events generated
- Unit tests: contract advances correctly, completion triggers effects

### Story 7.4: Contract Creation UI — Wizard Flow 🖥️
**Description**: Build the multi-step contract creation interface.

**Files**: `src/components/contract/ContractWizard.vue`, `src/components/contract/CorpSelector.vue`, `src/composables/useContractCreation.ts`

**Acceptance Criteria**:
- Step 1: Select contract type (grid of type cards with descriptions)
- Step 2: Select target (planet/colony/sector depending on type)
- Step 3: Review cost (BP/turn, duration, total cost) and select corporation
- Corp selector shows eligible corps with level, personality, estimated quality
- Option to "Kickstart New Corporation" if no suitable corp exists (creates startup)
- Step 4: Confirm — creates contract, deducts BP, returns to contract list
- Cancel at any step returns without changes
- Budget preview updates at each step showing impact on net BP

### Story 7.5: Contracts View 🖥️
**Description**: Display active and completed contracts.

**Files**: `src/views/ContractsView.vue`, `src/components/contract/ContractCard.vue`

**Acceptance Criteria**:
- Active contracts: shows type, target, assigned corp, BP/turn cost, progress bar (turns remaining / total), status
- Completed contracts: shows type, target, corp, outcome summary
- "Create Contract" button prominent when no active contracts, accessible always
- Contracts grouped by status (Active, Completed)
- Contract card click expands to show full details

---

## Epic 8: Infrastructure & Production

> Implement infrastructure levels, resource production and consumption calculations, and player investment in infrastructure. This connects colonies to the economy.

### Story 8.1: Production & Consumption Formulas 🔧🧪
**Description**: Implement all resource production and consumption calculations.

**Files**: `src/engine/formulas/production.ts`

**Acceptance Criteria**:
- `calculateExtraction(infraLevel, richnessModifier)`: returns `infraLevel × richnessModifier`
- `calculateManufacturing(infraLevel, hasInputs)`: returns `infraLevel` if inputs available, `floor(infraLevel / 2)` if shortage
- `calculateFoodConsumption(popLevel)`: returns `popLevel × 2`
- `calculateConsumerGoodsConsumption(popLevel)`: returns `popLevel × 1`
- `calculateTCConsumption(popLevel)`: returns `popLevel`
- `calculateIndustrialInput(infraLevel)`: returns `infraLevel` (1 per level per input type)
- `calculateInfraCap(popLevel, domain)`: returns `popLevel × 2` for non-civilian, uncapped for civilian
- `calculateExtractionCap(richness)`: returns cap from richness level (5/10/15/20)
- All functions have unit tests with boundary values

### Story 8.2: Colony Resource Flow Calculator 🔧🧪
**Description**: Calculate complete production and consumption for a single colony.

**Files**: `src/engine/simulation/colony-sim.ts` (production section)

**Acceptance Criteria**:
- Takes colony + infrastructure + deposits as input
- Returns per-resource: production amount, consumption amount, surplus/deficit
- Handles extraction (deposit-dependent) and manufacturing (input-dependent)
- Handles shortage cascading: if Common Materials shortage → Low Industry output halved
- Returns typed ResourceFlow object per colony
- Unit tests: full production chain from extraction through manufacturing, shortage cascading

### Story 8.3: Player Investment Action 🔧🧪
**Description**: Implement direct BP investment in colony infrastructure.

**Files**: `src/engine/actions/invest-planet.ts`

**Acceptance Criteria**:
- Validates: target colony exists, domain is valid, infra not at cap
- Cost: 3 BP for +1 infrastructure level (public-owned)
- Validates player has sufficient BP
- For extraction domains: validates matching deposit exists and not at deposit cap
- Returns updated colony infrastructure or validation error
- Unit tests: valid investment, at cap, no deposit, insufficient BP

### Story 8.4: Infrastructure UI Updates 🖥️
**Description**: Update colony detail view with functional infrastructure investment.

**Files**: Update `src/components/colony/InfraPanel.vue`, `src/components/colony/ResourceFlow.vue`

**Acceptance Criteria**:
- Each infrastructure domain shows: current level, cap, ownership breakdown (public/corporate)
- "Invest" button per domain: enabled when below cap and player has 3+ BP
- Clicking Invest deducts 3 BP, adds +1 public infrastructure, UI updates immediately
- Resource flow panel shows live production/consumption per resource
- Surplus shown in green, deficit in red
- Tooltip on each resource shows calculation breakdown

---

## Epic 9: Sector Market & Trade

> Implement the sector market resolution system: production pooling, dynamism-priority purchasing, shortage resolution. This is the economic engine of the game.

### Story 9.1: Market Resolver 🔧🧪
**Description**: Implement full sector market resolution logic.

**Files**: `src/engine/simulation/market-resolver.ts`

**Acceptance Criteria**:
- Phase 1: Collects production from all colonies in sector
- Phase 2: Each colony consumes own production first (internal consumption)
- Phase 3: Remaining production goes to sector market pool
- Phase 4: Colonies sorted by dynamism (highest first) attempt to fill deficits from pool
- Phase 5: Remaining deficits become shortages with appropriate maluses
- Returns per-colony: resources received, shortages, export bonuses
- Returns per-sector: total production, consumption, surplus, deficit per resource
- Unit tests: single colony (no trade needed), two colonies with complementary production, shortage scenario, dynamism priority ordering

### Story 9.2: Market Phase — Turn Resolution 🔧🧪
**Description**: Integrate market resolver into turn resolution pipeline.

**Files**: `src/engine/turn/market-phase.ts`

**Acceptance Criteria**:
- Calls market resolver for each sector
- Applies shortage maluses to colony attributes (food shortage → -2 QoL, etc.)
- Applies export bonuses to colony attributes
- Returns updated colony states + market summary events
- Unit tests: shortage maluses applied correctly, export bonuses applied

### Story 9.3: Market Store 🔧
**Description**: Create Pinia store for market state.

**Files**: `src/stores/market.store.ts`

**Acceptance Criteria**:
- Holds per-sector market state: production totals, consumption totals, surpluses, deficits
- Holds per-colony: shortage flags, export bonuses
- Action: `resolveMarkets(gameState)` runs market phase, updates state
- Getter: `getSectorMarket(sectorId)`, `getColonyShortages(colonyId)`

### Story 9.4: Market View 🖥️
**Description**: Display sector market dashboard.

**Files**: `src/views/MarketView.vue`, `src/components/market/ResourceRow.vue`, `src/components/market/MarketSummary.vue`

**Acceptance Criteria**:
- Sector selector (dropdown or tabs) to switch between sectors
- Per resource: production total, consumption total, surplus/deficit with color coding
- Planet-by-planet breakdown: which colony produces/consumes what
- Shortage warnings prominent
- Export bonus indicators shown per colony

---

## Epic 10: Colony Simulation

> Implement colony attribute calculation, population growth, and organic infrastructure growth. Colonies become living, evolving entities.

### Story 10.1: Attribute Formulas 🔧🧪
**Description**: Implement all colony attribute calculations.

**Files**: `src/engine/formulas/attributes.ts`

**Acceptance Criteria**:
- All attribute functions use `resolveModifiers` for local per-entity bonuses (planet features, colony type)
- All attribute functions read empire-wide values directly from state (debt tokens, empire bonuses) — not from modifiers
- `calculateHabitability(basePlanetHab, colonyModifiers)`: resolves base through local modifiers targeting 'habitability'
- `calculateAccessibility(transportInfra, colonyModifiers)`: resolves `3 + floor(transport/2)` through local modifiers targeting 'accessibility'
- `calculateStability(...)`: reads `gameState.debtTokens` directly for debt malus, uses local modifiers for everything else
- `calculateInfraCap(popLevel, domain, empireBonuses, colonyModifiers)`: base is `popLevel × 2 + empireBonuses.infraCaps[domain]`, then resolves through local modifiers for planet feature bonuses (e.g., Mineral Veins +5 max Mining)
- Formula implementations match Specs.md Section 5
- Unit tests verify that local modifiers and empire bonuses combine correctly, that debt is read from state not modifiers

### Story 10.2: Colony Simulation — Growth & Population 🔧🧪
**Description**: Implement population growth logic and organic infrastructure growth.

**Files**: `src/engine/simulation/colony-sim.ts` (growth section), `src/engine/formulas/growth.ts` (colony section)

**Acceptance Criteria**:
- Growth accumulates each turn based on growth formula
- At growth 10 + civilian infra requirement met → pop level +1, growth resets to 0
- At growth -1 → pop level -1, growth resets to 9
- Population capped by planet size max
- Organic infra growth: `dynamism × 5%` chance per turn, +1 to random demand-weighted domain
- Unit tests: growth accumulation, level up trigger, level down trigger, pop cap, organic growth probability

### Story 10.3: Colony Phase — Turn Resolution 🔧🧪
**Description**: Integrate colony simulation into turn resolution.

**Files**: `src/engine/turn/colony-phase.ts`

**Acceptance Criteria**:
- Recalculates all attributes for every colony (using current market data, infra, etc.)
- Applies growth tick
- Checks population level transitions
- Checks organic infrastructure growth
- Returns updated colonies + events (population milestones, attribute warnings)
- Unit tests: full colony turn with attribute changes, population growth event

### Story 10.4: Colony UI Updates 🖥️
**Description**: Update colony views to show live simulation data.

**Files**: Update `ColonyCard.vue`, `ColonyDetailView.vue`, `AttributePanel.vue`

**Acceptance Criteria**:
- Attribute panel shows current value + trend arrow (up/down/stable compared to last turn)
- Growth bar shows progress toward next population level
- Population level shown with progress indicator
- Tooltips on each attribute explain current value derivation (e.g., "QoL: 10 base, -2 food shortage = 8")
- Warnings shown for declining attributes

---

## Epic 11: Corporation AI

> Implement autonomous corporation behavior: capital spending decisions, infrastructure investment, acquisition logic. Corps become alive.

### Story 11.1: Corporation Investment AI 🔧🧪
**Description**: Implement corporation decision-making for capital spending each turn.

**Files**: `src/engine/simulation/corp-ai.ts`

**Acceptance Criteria**:
- Each turn, corps with capital ≥ 2 consider investing
- Investment priority: check sector market for resource deficits
- Select deficit weighted by severity
- Find highest-dynamism planet in sector with available infra slots and required inputs
- If found and corp has capital: buy infrastructure level (cost 2)
- Level 3+ corps can invest in any domain, lower corps only their specialty
- Level 6+ corps consider acquisitions if capital ≥ target × 5
- Acquisition: target must be 3+ levels below buyer, target can refuse if within 2 levels
- On acquisition: buyer gains all target infrastructure and assets, buyer gains 1 level
- Returns list of actions taken (investments, acquisitions) as events
- Unit tests: investment decision with clear deficit, no suitable planet scenario, acquisition scenario, level restrictions

### Story 11.2: Corp Phase — Turn Resolution 🔧🧪
**Description**: Integrate corporation AI into turn resolution pipeline.

**Files**: `src/engine/turn/corp-phase.ts`

**Acceptance Criteria**:
- Processes corps in order: highest level first (biggest corps act first)
- Each corp: calculates capital gain, then runs AI decisions
- Handles infrastructure ownership updates
- Handles mergers/acquisitions and asset transfers
- Returns updated corporations + events
- Unit tests: multi-corp turn with investments and acquisition

### Story 11.3: Organic Corporation Emergence 🔧🧪
**Description**: Implement natural corporation spawning on high-dynamism colonies.

**Files**: Add to `src/engine/turn/corp-phase.ts` or `colony-phase.ts`

**Acceptance Criteria**:
- Each turn, colonies with dynamism ≥ 6 have a chance to spawn a new corp
- Chance: `(dynamism - 5) × 10%` — so dynamism 6 = 10%, dynamism 10 = 50%
- New corp type determined by colony's most prominent infrastructure domain
- New corp receives one colony infrastructure level as its first asset (transfers from public to corporate)
- Max one organic emergence per colony per turn
- Unit tests: emergence chance calculation, type determination, infrastructure transfer

---

## Epic 12: Turn Resolution Pipeline

> Wire all phases together into the master turn resolver. Implement the End Turn flow: player confirms → all phases run in order → new turn state. This is the game loop.

### Story 12.1: Turn Resolver 🔧🧪
**Description**: Implement the master turn resolution function that calls all phases in order.

**Files**: `src/engine/turn/turn-resolver.ts`

**Acceptance Criteria**:
- Calls phases in exact order: debt → income → expense → contract → mission → science → corp → colony → market → event
- Each phase receives current state (accumulated from previous phases)
- Collects events from all phases into unified event list
- Returns complete updated GameState + all events
- Increments turn number
- Pure function: no side effects, no store access
- Unit tests: verify phase order, verify state flows between phases, verify turn number increment

### Story 12.2: Income & Expense Phases 🔧🧪
**Description**: Implement income and expense calculation phases.

**Files**: `src/engine/turn/income-phase.ts`, `src/engine/turn/expense-phase.ts`

**Acceptance Criteria**:
- Income phase: sums all planet taxes + corp taxes, returns itemized income
- Expense phase: sums all active contract costs + mission costs + player investments, returns itemized expenses
- Both return typed result objects with per-source breakdowns
- Unit tests: multiple income sources, multiple expense types, zero income scenario

### Story 12.3: Debt Phase 🔧🧪
**Description**: Implement debt token resolution.

**Files**: `src/engine/turn/debt-phase.ts`

**Acceptance Criteria**:
- If debt tokens > 0: clear 1 token, deduct 1 BP from income
- Returns updated debt token count and BP adjustment
- Unit tests: token clearing, no tokens scenario, many tokens scenario

### Story 12.4: Game Store & End Turn Flow 🔧
**Description**: Create master game store that orchestrates turn resolution and state distribution.

**Files**: `src/stores/game.store.ts`

**Acceptance Criteria**:
- State: turn number, game phase (player-action / resolving / reviewing)
- Action: `initializeGame()` generates galaxy, creates Terra Nova, sets turn 1
- Action: `endTurn()` — collects full state from all stores → calls turn resolver → distributes results back to all stores → increments turn
- Action: `getFullGameState()` assembles GameState from all stores
- Getter: `currentTurn`, `gamePhase`

### Story 12.5: End Turn UI Flow 🖥️
**Description**: Implement the End Turn button and turn transition experience.

**Files**: Update `AppHeader.vue`, `DashboardView.vue`, `src/composables/useTurnActions.ts`

**Acceptance Criteria**:
- End Turn button in header: enabled during player-action phase
- Clicking End Turn: shows confirmation dialog with budget summary (income - expenses = net)
- If deficit: warning about debt tokens that will be created
- On confirm: button shows "Resolving..." state, turn resolver runs
- After resolution: turn number increments, dashboard shows new turn events
- New turn events appear as notification cards on dashboard, priority-sorted

### Story 12.6: Event Phase (Placeholder) 🔧
**Description**: Create placeholder event phase that passes through without generating events.

**Files**: `src/engine/turn/event-phase.ts`

**Acceptance Criteria**:
- Accepts game state, returns it unchanged with empty event list
- Structure in place for future threat/event implementation
- No actual threat logic

---

## Epic 13: Exploration

> Implement the exploration gameplay loop: explore sectors, discover planets, orbit scan, ground survey, accept/reject.

### Story 13.1: Exploration Engine 🔧🧪
**Description**: Implement exploration gain and planet discovery logic.

**Files**: `src/engine/formulas/exploration.ts`

**Acceptance Criteria**:
- `calculateExplorationGain()`: returns `randomInt(5, 15)` (percentage)
- `calculatePOICount()`: returns `2 + weightedRandom(0:40%, 1:40%, 2:20%)`
- `generateOrbitScan(planet, corpLevel)`: returns partial planet data based on corp level tiers
- Functions are pure, testable
- Unit tests: gain range validation, POI count distribution over 1000 runs, scan quality by corp level

### Story 13.2: Exploration Contract Completion 🔧🧪
**Description**: Wire exploration results into contract completion.

**Files**: Update `src/engine/turn/contract-phase.ts`

**Acceptance Criteria**:
- When exploration contract completes: add exploration gain to sector
- Generate POI count planets using planet generator
- Add planets to planet store with "Orbit Scanned" status
- Orbit scan reveals info based on corp level
- Generate events for each discovery
- Unit tests: exploration contract completes, planets generated, sector exploration increases

### Story 13.3: Accept/Reject Planet Action 🔧
**Description**: Implement player accepting or rejecting discovered planets.

**Files**: `src/engine/actions/accept-planet.ts`

**Acceptance Criteria**:
- Accept: planet status changes to "Accepted", available for ground survey and colonization contracts
- Reject: planet status changes to "Rejected", hidden from player UI, available for corp independent settlement (future)
- Validation: planet must be in orbit-scanned or ground-surveyed status

### Story 13.4: Ground Survey Contract 🔧
**Description**: Wire ground survey contract to reveal full planet data.

**Files**: Update contract completion logic

**Acceptance Criteria**:
- On ground survey completion: planet status changes to "Ground Surveyed"
- All features revealed (including ground-only features)
- Exact deposit richness revealed
- Exact habitability revealed
- Planet data updated in store

### Story 13.5: Exploration UI 🖥️
**Description**: Build exploration interface within Galaxy view and contract creation.

**Files**: Update `GalaxyView.vue`, `SectorCard.vue`

**Acceptance Criteria**:
- Sector detail shows exploration percentage with progress bar
- Discovered planets listed under sector with status indicators
- Planet cards show orbit scan data (partial info based on corp level)
- Accept/Reject buttons on discovered planets
- Ground survey info shown for surveyed planets (full data)
- "Explore" quick action on explorable sectors leads to contract creation pre-filled with exploration type

---

## Epic 14: Science & Discoveries

> Implement science advancement, discovery system, and schematic generation. The technology layer that feeds into ships.

### Story 14.1: Science Simulation 🔧🧪
**Description**: Implement science point accumulation and sector advancement.

**Files**: `src/engine/simulation/science-sim.ts`

**Acceptance Criteria**:
- Calculates empire_science
- Distributes points for domains
- Accumulates points per domain, checks against threshold
- On level up: activates discovery pool for that domain
- Returns updated science state + level-up events
- Unit tests: accumulation, level up at threshold, distribution with and without corps

### Story 14.2: Discovery System 🔧🧪
**Description**: Implement discovery rolling for science corporations.

**Files**: Add to `src/engine/simulation/science-sim.ts`

**Acceptance Criteria**:
- Each science corp rolls for discovery each turn
- If successful: draws random undiscovered item from available pools (sectors at level 1+)
- Discovery is permanent and empire-wide
- Generates discovery event with name and description
- Unit tests: discovery chance calculation, pool exhaustion, no available discoveries scenario
- On discovery, directly increments `gameState.empireBonuses` values (shipStats and/or infraCaps) — does NOT create modifiers
- Each discovery specifies: which empireBonuses keys to increment and by how much, whether it enables schematics (boolean), and which schematic categories it unlocks
- Discovery effects update the empire tech bonus table (cumulative, permanent, non-retroactive for existing ships)
- Unit tests verify that empireBonuses values increment correctly and persist across turns


### Story 14.3: Schematic Generation 🔧🧪
**Description**: Implement schematic development for shipbuilding corporations from discoveries.

**Files**: `src/generators/schematic-generator.ts`

**Acceptance Criteria**:
- Shipbuilding corps roll for schematic development each turn
- Max schematics per corp
- Schematic level determined by corresponding science domain level
- Schematic category selected randomly from unlocked categories
- Same-category schematic replaces the older version
- Stat bonuses by level
- Name generated from tier prefix + category name pool
- Returns typed Schematic object with category, level, stat bonuses, source discovery, owner corp
- Unit tests: chance calculation, max schematic cap, level determination from science domain, category replacement logic, stat scaling by level, name generation

### Story 14.4: Science Phase — Turn Resolution 🔧🧪
**Description**: Integrate science into turn resolution pipeline.

**Files**: `src/engine/turn/science-phase.ts`

**Acceptance Criteria**:
- Runs science accumulation and level checks
- Runs discovery rolls for all science corps
-  Runs schematic development rolls for shipbuilding corps based on unlocked science domain levels
-  Runs patent development rolls for all corps (placeholder — patent mechanics to be detailed later)
- Returns updated science state + events

### Story 14.5: Science Store & View 🖥️
**Description**: Create science store and display screen.

**Files**: `src/stores/science.store.ts`, `src/views/ScienceView.vue`, `src/components/science/SectorProgress.vue`, `src/components/science/DiscoveryCard.vue`, `src/components/science/SchematicCard.vue`

**Acceptance Criteria**:
- Store holds: domain levels, accumulated progress, discoveries list, empire tech bonuses (reads from gameState.empireBonuses)
- Action: `applyDiscovery(discovery)` increments empireBonuses directly and unlocks schematic categories
- View shows: 9 science domains with level + progress bar + schematic categories unlocked per domain
- Discoveries listed chronologically with name, domain, description, bonus contributions
- Empire bonus summary: current cumulative bonuses per ship stat and per infra cap
- Empty states for no discoveries

---

## Epic 15: Ships & Blueprints

> Implement ship blueprints, ship construction, and fleet display. Ships become real entities.

### Story 15.1: Blueprint System 🔧
**Description**: Implement blueprint creation from schematics.

**Files**: `src/engine/actions/design-blueprint.ts`

**Acceptance Criteria**:
- Accepts: role, size variant, building corp, empire tech bonuses, corp schematics
- Calculate ship stats
- Applies size variant multiplier to size stat
- Derives hull points and power projection 
- Calculates BP/turn cost
- Reads empire bonuses as plain values, stores schematics as ship.modifiers for per-ship attribution
- Returns fully typed Ship object with all stats, schematics applied list, build turn, and owning corp
- Unit tests: stat scaling with corp level (level 1 vs level 5 vs level 10), tech bonus application, variant multiplier effect on size and derived stats, schematic bonus stacking, randomness within bounds, derived stat calculations

### Story 15.2: Ship Construction 🔧🧪
**Description**: Implement ship building as a contract.

**Files**: Update contract system for ship commission type

**Acceptance Criteria**:
- Ship commission contract requires: role selection, size variant (Light/Standard/Heavy), colony with sufficient space infrastructure, shipbuilding corp
- Space infra requirement
- BP/turn
- Base build time anda ctual build time
- Size variant multiplier applied to cost and build time as well (Light ×0.75, Heavy ×1.25)
- On completion: ship generated using ship stat generator, captain assigned (Green experience)
- Ship added to fleet store with status "Stationed" at colony's sector
- Building corp receives completion bonus as normal contract
- Unit tests: build time calculation across corp levels, space infra validation, cost scaling by variant, ship creation on completion with correct stats

### Story 15.3: Captain Generator 🔧🧪
**Description**: Generate ship captains with names and experience.

**Files**: `src/generators/captain-generator.ts`

**Acceptance Criteria**:
- Generates unique name from name pools
- Starts at Green experience (×0.8 combat modifier)
- Experience tracks missions completed (2 → Regular, 5 → Veteran, 10 → Elite)
- Returns typed Captain object
- Unit tests: name generation, default experience level, experience progression thresholds

### Story 15.4: Fleet Store & View 🖥️
**Description**: Create fleet store and display screen.

**Files**: `src/stores/fleet.store.ts`, `src/views/FleetView.vue`, `src/components/fleet/ShipCard.vue`

**Acceptance Criteria**:
- Store holds: ships (by ID), empire tech bonuses (cumulative from discoveries, per-stat)
- Action: `addShip(ship)` adds completed ship to fleet
- Action: `removeShip(id)` removes ship (on destruction), preserves service record in memorial
- Getter: `getShip(id)`, `getShipsBySector(sectorId)`, `getShipsByStatus(status)`, `getAvailableShips()` (stationed, not on mission)
- View shows: ships grouped by sector with status indicators, ship construction contracts in progress
- Ship card: name, role, size (with descriptive label), stat bars with labels (Poor/Average/Good/Excellent/Exceptional), captain name and experience, condition bar, status, schematics applied
- Ship detail (expanded or separate panel): full stat breakdown showing "Base 6 + Tech 2 + Corp ×1.0 + Schematic +2 + Random +1 = 11 (Exceptional)", schematics list with names and bonuses, captain service record, build turn, owning corp
- "Commission Ship" button leads to contract creation: select role → select variant (Light/Standard/Heavy) → select colony (filtered by space infra) → select corp (shows level, schematics they'll apply, estimated stat ranges) → review estimated cost and build time → confirm
- Empty state: "No ships yet. Commission your first ship by creating a Ship Commission contract. You'll need a Shipbuilding corporation, a colony with Space Industry infrastructure, and Ship Parts production."

---

## Epic 16: Missions & Combat

> Implement mission creation, execution, and combat resolution. The military gameplay loop.

### Story 16.1: Mission Creation 🔧🧪
**Description**: Implement mission creation and validation.

**Files**: `src/engine/actions/create-mission.ts`

**Acceptance Criteria**:
- Player selects mission type, target sector, and ships for task force
- Validates: ships are available (not on another mission), target is valid
- Calculates: travel time (sector hops), execution duration, total cost
- Fleet surcharge: +1 BP/turn per ship with size ≥ 7
- Returns Mission object or validation error
- Ships marked as "On Mission"
- Unit tests: valid creation, ship already on mission, cost calculation

### Story 16.2: Combat Resolver 🔧🧪
**Description**: Implement semi-abstracted combat resolution.

**Files**: `src/engine/simulation/combat-resolver.ts`, `src/engine/formulas/combat.ts`

**Acceptance Criteria**:
- Initiative: higher average sensor rating goes first
- Targeting: priority order (damaged → smallest size), modified by personality
- Exchange rounds (3-5): damage = firepower × captain_mod × random(0.85,1.15), absorbed = armor × random(0.9,1.1)
- Condition tracking per ship, destruction at 0%
- Retreat check after round 3 (threshold by personality: cautious 50%, normal 40%, aggressive 25%)
- Disabled ship recovery: 50% if holding field
- Returns CombatResult with per-ship outcomes, round log, overall result
- Unit tests: initiative calculation, damage/armor interaction, retreat trigger, ship destruction, recovery roll

### Story 16.3: Mission Phase — Turn Resolution 🔧🧪
**Description**: Integrate missions into turn resolution.

**Files**: `src/engine/turn/mission-phase.ts`

**Acceptance Criteria**:
- Travel phase: decrement travel turns remaining
- Execution phase: run mission logic (combat if applicable)
- Return phase: decrement return travel turns
- On completion: ships return to stationed status, generate mission report
- On ship loss: remove ship, update corp, generate loss event
- Captain experience gain: increment after mission completion
- Returns updated missions + ships + events

### Story 16.4: Mission Store 🔧
**Description**: Create Pinia store for missions.

**Files**: `src/stores/mission.store.ts`

**Acceptance Criteria**:
- Holds active and completed missions
- Action: `createMission(params)` validates and creates
- Action: `advanceMissions(gameState)` calls mission phase
- Getter: `activeMissions`, `missionsByShip(id)`

### Story 16.5: Mission UI 🖥️
**Description**: Build mission creation and tracking interface.

**Files**: Update `FleetView.vue`, `src/components/fleet/MissionCard.vue`, `src/components/fleet/MissionWizard.vue`, `src/composables/useMissionCreation.ts`

**Acceptance Criteria**:
- Mission card: type, target, task force ships, phase (travel/execution/return), turns remaining, cost/turn
- Mission wizard: select type → select target → select ships (multi-select from available) → review cost/risk → confirm
- Risk assessment shown: estimated combat power vs. known threats
- Mission reports expandable: outcome, losses, damage, rounds summary
- "Task Force has not returned" shown for worst-case outcomes

---

## Epic 17: Cross-Sector Trade

> Implement trade route contracts connecting adjacent sectors for resource sharing.

### Story 17.1: Trade Route Contract 🔧🧪
**Description**: Implement trade route as an ongoing contract type.

**Files**: `src/engine/actions/create-trade-route.ts`, update market resolver

**Acceptance Criteria**:
- Player creates trade route contract between two adjacent sectors
- Requires Transport corporation
- Cost: 2 BP/turn, ongoing (no end date)
- Player can cancel trade route (ends contract)
- Unit tests: valid creation, non-adjacent sectors rejected, cancellation

### Story 17.2: Cross-Sector Market Integration 🔧🧪
**Description**: Integrate trade routes into market resolution.

**Files**: Update `src/engine/simulation/market-resolver.ts`

**Acceptance Criteria**:
- After internal sector market resolves, connected sectors share surplus at 50% efficiency
- Surplus from Sector A available to Sector B's deficit planets (by dynamism order) and vice versa
- Trade route must be active (contract not cancelled)
- Unit tests: surplus sharing, efficiency rate, bidirectional flow

### Story 17.3: Trade Route UI 🖥️
**Description**: Display trade routes in market and galaxy views.

**Files**: Update `MarketView.vue`, `GalaxyView.vue`

**Acceptance Criteria**:
- Active trade routes shown on galaxy view as connections between sectors
- Market view shows cross-sector imports/exports when trade route active
- Trade route creation accessible from galaxy view (sector context menu)

---

## Epic 18: Save & Load System

> Implement game persistence: autosave, manual saves, JSON export/import.

### Story 18.1: Serialization 🔧🧪
**Description**: Implement game state serialization and deserialization.

**Files**: `src/utils/save.ts`

**Acceptance Criteria**:
- `serializeGameState(state): string` — converts full GameState to JSON string
- `deserializeGameState(json): GameState` — parses JSON back to typed state
- Save file format includes version number and timestamp
- Handles all entity types with proper ID preservation
- Unit tests: round-trip serialization (serialize → deserialize → compare), invalid JSON handling

### Story 18.2: Save/Load Store & Actions 🔧
**Description**: Implement save/load via LocalStorage with multiple slots.

**Files**: `src/composables/useSaveLoad.ts`, update `src/stores/game.store.ts`

**Acceptance Criteria**:
- Autosave: triggers after every turn resolution, saves to dedicated autosave slot
- Manual save: player can save to 3 named slots
- Load: restores full game state from any save slot
- JSON export: downloads save as .json file
- JSON import: loads .json file, validates format, restores state
- Save slot list shows: slot name, turn number, date saved

### Story 18.3: Settings View 🖥️
**Description**: Build settings screen with save/load interface.

**Files**: `src/views/SettingsView.vue`

**Acceptance Criteria**:
- Save slots displayed with turn number and timestamp
- "Save" button per slot (with overwrite confirmation)
- "Load" button per slot (with confirmation)
- "Export to File" button downloads JSON
- "Import from File" button with file picker
- "New Game" button with confirmation (starts fresh)
- Autosave slot shown separately (load only, no overwrite)

---

## Epic 19: Event System Foundation

> Build the event infrastructure: event store, notification display, event feed. No threat generation yet — just the piping for events generated by other systems.

### Story 19.1: Event Store 🔧
**Description**: Create event store to collect and display events from all systems.

**Files**: `src/stores/event.store.ts`

**Acceptance Criteria**:
- Holds current turn events and historical events (last 50 turns)
- Each event: id, turn, priority (Critical/Warning/Info/Positive), category, title, description, related entity IDs
- Action: `addEvents(events[])` bulk adds from turn resolution
- Action: `dismissEvent(id)` marks as read
- Getter: `currentTurnEvents` (sorted by priority), `unreadCount`, `eventHistory`

### Story 19.2: Notification Display 🖥️
**Description**: Build event notification UI on dashboard and as overlay.

**Files**: `src/components/layout/AppNotifications.vue`, update `DashboardView.vue`

**Acceptance Criteria**:
- Dashboard shows current turn events as cards, priority-sorted
- Critical events (red) at top, cannot be dismissed without viewing
- Event cards expandable for full detail
- Notification badge on header shows unread count
- Notification panel (overlay) accessible from header, shows recent events across turns
- Events link to relevant entity (clicking colony event navigates to colony detail)

### Story 19.3: Dashboard — Full Implementation 🖥️
**Description**: Complete the dashboard with all summary information.

**Files**: `src/views/DashboardView.vue`

**Acceptance Criteria**:
- Turn number prominent
- Budget summary: income, expenses, net, debt warning
- Event feed (current turn, priority-sorted)
- Empire summary cards: colony count, corp count, ship count, active contracts, science highlights
- Quick actions: Create Contract, View Colonies, View Corporations, View Fleet
- Each summary card links to relevant screen
- "No active contracts" prompts contract creation
- "No corporations" explains they emerge from contracts

---

## Epic 20: Polish & Playtesting -> To Define later

---

## Notes for Developers

- **Always check Specs.md and Data.md** for formula values and data tables before implementing
- **Always check Structure.md** for file paths, naming conventions, and architectural rules
- **Engine code must be pure** — no Vue, no Pinia, no side effects
- **Code must be easy to read** - comment, name variable with straightforward names, make the codebase beginner friendly
- **UI can be built incrementally** — skeleton first, data binding second, polish third
- **Update Changelog.md** after completing each story
- **Request the current version of a file** When a story says "update" for it
- **Always add Todo referencing the future implementation** to make sure the codebase itself is the documentation for all the implementation.