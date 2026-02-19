# Spacetime — Project Structure & Architecture

> This document defines the project's file organization, naming conventions, architectural boundaries, and implementation rules. Any developer (human or AI) working on this project should read this document before writing code.

---

## Tech Stack

| Layer            | Choice                            | Version             |
| ---------------- | --------------------------------- | ------------------- |
| Framework        | Vue 3 + TypeScript                | Latest stable       |
| State Management | Pinia                             | Latest stable       |
| Styling          | Tailwind CSS                      | Latest stable (v4+) |
| Build Tool       | Vite                              | Latest stable       |
| Persistence      | LocalStorage + JSON export/import | Native browser API  |
| Backend          | None                              | Client-side only    |

### Setup Commands

```bash
npm create vue@latest spacetime    # Select: TypeScript, Vue Router, Pinia, Vitest
cd spacetime
npm install
npm install -D tailwindcss @tailwindcss/vite
```

### VS Code Extensions (Recommended)

- **Vue - Official** (formerly Volar) — Vue 3 + TypeScript support
- **Tailwind CSS IntelliSense** — class autocomplete
- **ESLint** — code quality
- **Vitest** — test runner integration

---

## Architecture Overview

The project follows a strict separation between **game engine** (pure logic) and **presentation** (Vue UI).

```
Vue UI Layer (views, components, composables, router) Reads from stores, dispatches player actions
└─> Pinia Stores (one per domain — the single source of truth) Hold all game state, expose actions
	└─> Game Engine (pure TypeScript — zero Vue dependencies) Turn resolution, simulation, market, combat, corporation AI, generation, calculations
```

### The Golden Rule

**`engine/` and `data/` never import from Vue, Pinia, or any UI code.** They are pure TypeScript modules that accept typed inputs and return typed outputs. This ensures the entire simulation is testable without mounting components.

Stores call engine functions. Views read stores. Views never call engine functions directly.

---

## File Structure

```
spacetime/
├── public/                        # Static assets served as-is
│   └── favicon.ico
├── src/
│   ├── App.vue                    # Root component, layout shell
│   ├── main.ts                    # App entry point, plugin registration
│   │
│   ├── types/                     # TypeScript interfaces and type definitions
│   │   ├── common.ts              # Shared types (Id, TurnNumber, BPAmount, etc.)
│   │   ├── colony.ts              # Colony, ColonyAttributes, ColonyType
│   │   ├── planet.ts              # Planet, PlanetType, PlanetSize, Deposit, Feature
│   │   ├── corporation.ts         # Corporation, CorpType, Personality, CapitalAction
│   │   ├── contract.ts            # Contract, ContractType, ContractStatus
│   │   ├── resource.ts            # Resource, ResourceType, ProductionEntry, Shortage
│   │   ├── infrastructure.ts      # Infrastructure, InfraDomain, InfraOwnership
│   │   ├── science.ts             # ScienceSector, Discovery, SectorLevel
│   │   ├── ship.ts                # Ship, ShipRole, Captain, ServiceRecord, Schematic, SizeVariant, ShipAbilities (Fight/Investigation/Support)
│   │   ├── mission.ts             # Mission, MissionType, MissionPhase, TaskForce
│   │   ├── combat.ts              # CombatResult, CombatRound, CombatPhase
│   │   ├── sector.ts              # Sector, SectorAdjacency, SectorMarket
│   │   ├── budget.ts              # BudgetState, DebtToken, IncomeSource, ExpenseEntry
│   │   ├── event.ts               # GameEvent, EventPriority, EventCategory
│   │   ├── trade.ts               # TradeRoute, SectorMarketState, TradeFlow
│   │   ├── game.ts                # GameState (master type combining all stores, includes EmpireBonuses)
│   │   ├── modifier.ts            # Modifier, ModifierCondition, ModifierOperation (local per-entity modifiers only)
│   │   └── empire.ts              # EmpireBonuses (simple cumulative state from discoveries), global tracked malus and bonus
│   │
│   ├── data/                      # Static game data (constants, tables, templates)
│   │   ├── planet-types.ts        # Planet type definitions, spawn weights, base stats
│   │   ├── planet-features.ts     # Feature definitions, modifiers, spawn rules
│   │   ├── planet-deposits.ts     # Deposit types, resource mappings, richness levels
│   │   ├── planet-sizes.ts        # Planet size definitions, habitability and slot modifiers
│   │   ├── colony-types.ts        # Colony type packages, bonuses, starting infra
│   │   ├── resources.ts           # Resource definitions, categories
│   │   ├── infrastructure.ts      # Domain definitions, production/consumption rules
│   │   ├── corporation-types.ts   # Corp type definitions, investment preferences
│   │   ├── corporation-names.ts   # Name generation pools (prefixes, suffixes, patterns)
│   │   ├── personality-traits.ts  # Trait definitions, mechanical effects
│   │   ├── contracts.ts           # Contract type templates, base costs, durations
│   │   ├── ship-roles.ts          # Ship role definitions, base stats, size ranges
│   │   ├── schematics.ts          # Schematic categories, stat scaling by level, name pools
│   │   ├── mission-types.ts       # Mission type definitions, base costs, durations
│   │   ├── science-sectors.ts     # Science sector definitions, discovery pools
│   │   ├── discoveries.ts         # Discovery definitions per science sector per level
│   │   ├── patents.ts             # Patent definitions (placeholder for future corp differentiation)
│   │   ├── threats.ts             # Threat category definitions (placeholder for prototype)
│   │   ├── sector-names.ts        # Sector name generation pools
│   │   └── start-conditions.ts    # Terra Nova, starting colony, starting budget, galaxy seed, starting corporations
│   │
│   ├── engine/                    # Pure game logic (NO Vue/Pinia imports)
│   │   ├── turn/                  # Turn resolution pipeline
│   │   │   ├── turn-resolver.ts   # Master turn resolution: calls phases in order
│   │   │   ├── income-phase.ts    # Calculate all income sources
│   │   │   ├── expense-phase.ts   # Calculate all expenses
│   │   │   ├── contract-phase.ts  # Advance contracts, check completion, fire events
│   │   │   ├── mission-phase.ts   # Advance missions, resolve travel/execution
│   │   │   ├── colony-phase.ts    # Colony attribute recalculation, growth, pop changes
│   │   │   ├── market-phase.ts    # Sector market resolution (production → consumption → trade)
│   │   │   ├── corp-phase.ts      # Corporation AI: capital spending, investment, mergers
│   │   │   ├── science-phase.ts   # Science advancement, discovery rolls
│   │   │   ├── debt-phase.ts      # Debt token resolution
│   │   │   └── event-phase.ts     # Threat escalation, event generation (placeholder)
│   │   │
│   │   ├── simulation/            # Simulation subsystems
│   │   │   ├── market-resolver.ts # Full sector market resolution logic
│   │   │   ├── combat-resolver.ts # Combat resolution (phases, rounds, outcomes)
│   │   │   ├── corp-ai.ts         # Corporation decision-making logic
│   │   │   ├── colony-sim.ts      # Colony attribute calculations, growth formulas
│   │   │   └── science-sim.ts     # Science distribution, discovery chance
│   │   │
│   │   ├── formulas/              # Pure calculation functions
│   │   │   ├── tax.ts             # Planet tax, corp tax formulas
│   │   │   ├── attributes.ts      # Colony attribute formulas (QoL, stability, etc.)
│   │   │   ├── production.ts      # Resource production/consumption calculations
│   │   │   ├── combat.ts          # Damage, initiative, retreat calculations
│   │   │   ├── growth.ts          # Colony growth, corp capital gain
│   │   │   ├──  exploration.ts    # Exploration gain, POI discovery chance
│   │   │   └── modifiers.ts       # resolveModifiers(), getModifierTotal(), filterByTarget()
│   │   │
│   │   └── actions/               # Player action handlers
│   │       ├── create-contract.ts 	# Validate + create a new contract
│   │       ├── create-mission.ts  	# Validate + create a new mission
│   │       ├── invest-planet.ts   	# Direct BP investment in colony infrastructure
│   │       ├── accept-planet.ts   	# Accept/reject discovered planet
│   │       └── create-trade-route.ts  	# Create cross-sector trade route contract
│   │
│   ├── generators/                # Procedural generation
│   │   ├── planet-generator.ts    # Generate planet (type, size, features, deposits)
│   │   ├── colony-generator.ts    # Initialize colony from colonization contract
│   │   ├── corp-generator.ts      # Generate corporation (name, type, personality)
│   │   ├── sector-generator.ts    # Generate sector (name, density, adjacency)
│   │   ├── galaxy-generator.ts    # Generate full galaxy (sectors + adjacency graph)
│   │   ├── captain-generator.ts   # Generate ship captain (name, experience, personality)
│   │   ├── name-generator.ts      # Shared name generation utilities
│   │   ├── patent-generator.ts    # Generate patent from discovery for a corporation
│   │   ├── ship-generator.ts      # Generate ship stats from role + tech + corp + patents
│   │   └── schematic-generator.ts # Generate schematic from discovery for a shipbuilding corp
│   │
│   ├── stores/                    # Pinia stores (one per domain)
│   │   ├── game.store.ts          # Master game state, turn counter, save/load
│   │   ├── budget.store.ts        # BP balance, income, expenses, debt tokens
│   │   ├── colony.store.ts        # All colonies, attribute state, population
│   │   ├── corporation.store.ts   # All corporations, capital, assets
│   │   ├── contract.store.ts      # Active/completed/failed contracts
│   │   ├── fleet.store.ts         # All ships, empire tech bonuses
│   │   ├── mission.store.ts       # Active/completed missions
│   │   ├── science.store.ts       # Sector levels, discoveries
│   │   ├── market.store.ts        # Per-sector market state, trade routes
│   │   ├── galaxy.store.ts        # Sectors, adjacency, exploration state
│   │   ├── planet.store.ts        # Discovered planets (pre-colonization)
│   │   └── event.store.ts         # Event queue, notifications, history
│   │
│   ├── composables/               # Vue composition functions (shared UI logic)
│   │   ├── useTurnActions.ts      # End turn, undo, turn state
│   │   ├── useNotifications.ts    # Event feed, priority filtering
│   │   ├── useBudgetDisplay.ts    # Formatted budget, income/expense breakdown
│   │   ├── useContractCreation.ts # Multi-step contract creation flow
│   │   ├── useMissionCreation.ts  # Multi-step mission creation flow
│   │   └── useSaveLoad.ts         # Save/load/export/import
│   │
│   ├── views/                     # Top-level route views (one per screen)
│   │   ├── DashboardView.vue      # Home screen — turn info, events, summary
│   │   ├── ColoniesView.vue       # Colony list + detail
│   │   ├── ColonyDetailView.vue   # Single colony deep dive
│   │   ├── CorporationsView.vue   # Corporation list + detail
│   │   ├── CorpDetailView.vue     # Single corporation deep dive
│   │   ├── ContractsView.vue      # Active contracts, creation flow
│   │   ├── FleetView.vue          # Ships, missions, blueprints
│   │   ├── ScienceView.vue        # Science sectors, discoveries, schematics
│   │   ├── MarketView.vue         # Sector market dashboard
│   │   ├── GalaxyView.vue         # Sector list, exploration, adjacency
│   │   └── SettingsView.vue       # Save/load, export, game settings
│   │
│   ├── components/                # Reusable UI components
│   │   ├── layout/                # App shell components
│   │   │   ├── AppHeader.vue      # Top bar — turn number, BP, quick actions
│   │   │   ├── AppSidebar.vue     # Navigation sidebar
│   │   │   └── AppNotifications.vue # Event feed overlay/panel
│   │   │
│   │   ├── shared/                # Generic reusable components
│   │   │   ├── ProgressBar.vue    # Used for contracts, exploration, growth
│   │   │   ├── AttributeBar.vue   # Colony attribute display (0-10 scale)
│   │   │   ├── StatCard.vue       # Key-value stat display
│   │   │   ├── ResourceBadge.vue  # Resource icon + amount
│   │   │   ├── EventCard.vue      # Single event/notification display
│   │   │   ├── ConfirmDialog.vue  # Confirmation modal
│   │   │   ├── Tooltip.vue        # Hover tooltip with explanation
│   │   │   ├── DataTable.vue      # Sortable data table
│   │   │   └── EmptyState.vue     # "Nothing here yet" with guidance text
│   │   │
│   │   ├── colony/                # Colony-specific components
│   │   │   ├── ColonyCard.vue     # Colony summary card for list view
│   │   │   ├── InfraPanel.vue     # Infrastructure domains with levels
│   │   │   ├── AttributePanel.vue # Colony attributes with explanations
│   │   │   └── ResourceFlow.vue   # Production/consumption visual
│   │   │
│   │   ├── corporation/           # Corporation-specific components
│   │   │   ├── CorpCard.vue       # Corp summary card for list view
│   │   │   ├── CorpAssets.vue     # Infrastructure, ships, schematics owned
│   │   │   └── CorpHistory.vue    # Contract history, mergers, events
│   │   │
│   │   ├── contract/              # Contract-specific components
│   │   │   ├── ContractCard.vue   # Active contract display
│   │   │   ├── ContractWizard.vue # Multi-step contract creation
│   │   │   └── CorpSelector.vue   # Corporation selection for contract
│   │   │
│   │   ├── fleet/                 # Fleet-specific components
│   │   │   ├── ShipCard.vue       # Ship summary with stats
│   │   │   ├── MissionCard.vue    # Active mission display
│   │   │   └── MissionWizard.vue  # Mission creation flow
│   │   │
│   │   ├── science/               # Science-specific components
│   │   │   ├── SectorProgress.vue # Science sector level + progress bar
│   │   │   ├── DiscoveryCard.vue  # Discovery announcement/detail
│   │   │   └── SchematicCard.vue  # Schematic stats display
│   │   │
│   │   ├── market/                # Market-specific components
│   │   │   ├── ResourceRow.vue    # Single resource in market table
│   │   │   └── MarketSummary.vue  # Sector market overview
│   │   │
│   │   └── galaxy/                # Galaxy-specific components
│   │       ├── SectorCard.vue     # Sector summary
│   │       └── SectorGraph.vue    # Adjacency visualization (text-based)
│   │
│   ├── router/
│   │   └── index.ts               # Vue Router configuration
│   │
│   ├── utils/                     # Shared utilities
│   │   ├── random.ts              # Seeded random, weighted random, dice rolls
│   │   ├── math.ts                # Clamping, rounding, scaling helpers
│   │   ├── format.ts              # Number formatting, BP display, percentage
│   │   ├── id.ts                  # Unique ID generation
│   │   └── save.ts                # Serialization, LocalStorage, JSON export/import
│   │
│   └── assets/
│       └── styles/
│           └── main.css            # Tailwind imports + custom CSS variables
│
├── index.html                     # Vite entry HTML
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── docs/                          # Design documents
│   ├── Specs.md                   # Detailed mechanical specifications
│   ├── Structure.md               # This document
│   ├── Data.md                    # Static game data tables and spawn rules
│   ├── Features.md                # Epics, stories, acceptance criteria
│   ├── Vision.md                  # Core pillars, vision
│   └── Changelog.md               # Development update log
└── CLAUDE.md                      # Important instructions

```

---

## Naming Conventions

### Files

| Category         | Convention                       | Example                                  |
| ---------------- | -------------------------------- | ---------------------------------------- |
| Type definitions | `kebab-case.ts`                  | `corporation.ts`, `ship.ts`              |
| Static data      | `kebab-case.ts`                  | `planet-types.ts`, `ship-classes.ts`     |
| Engine modules   | `kebab-case.ts`                  | `market-resolver.ts`, `corp-ai.ts`       |
| Generators       | `kebab-case.ts`                  | `planet-generator.ts`                    |
| Stores           | `kebab-case.store.ts`            | `colony.store.ts`, `budget.store.ts`     |
| Vue views        | `PascalCase` + `View.vue`        | `DashboardView.vue`, `ColoniesView.vue`  |
| Vue components   | `PascalCase.vue`                 | `ColonyCard.vue`, `ProgressBar.vue`      |
| Composables      | `camelCase.ts` with `use` prefix | `useTurnActions.ts`                      |
| Utils            | `kebab-case.ts`                  | `random.ts`, `format.ts`                 |
| Tests            | mirror source path + `.test.ts`  | `tax.test.ts`, `market-resolver.test.ts` |

### Code

| Element               | Convention              | Example                                       |
| --------------------- | ----------------------- | --------------------------------------------- |
| Interfaces / Types    | `PascalCase`            | `Colony`, `Corporation`, `ShipClass`          |
| Enums                 | `PascalCase`            | `PlanetType`, `ResourceType`                  |
| Enum values           | `PascalCase`            | `PlanetType.Continental`, `ResourceType.Food` |
| Variables / functions | `camelCase`             | `calculateTax()`, `colonyGrowth`              |
| Constants             | `UPPER_SNAKE_CASE`      | `MAX_DEBT_TOKENS`, `BASE_STABILITY`           |
| Store IDs             | `camelCase`             | `useColonyStore`, `useBudgetStore`            |
| Component props       | `camelCase`             | `colonyId`, `showDetails`                     |
| Component events      | `kebab-case`            | `@contract-created`, `@turn-ended`            |
| CSS classes           | Tailwind utilities only | No custom class names unless unavoidable      |

### IDs

All game entities use string IDs with a type prefix for debuggability:

| Entity      | ID Format        | Example       |
| ----------- | ---------------- | ------------- |
| Colony      | `col_` + nanoid  | `col_a1b2c3`  |
| Corporation | `corp_` + nanoid | `corp_x7y8z9` |
| Contract    | `ctr_` + nanoid  | `ctr_m4n5o6`  |
| Ship        | `ship_` + nanoid | `ship_p1q2r3` |
| Mission     | `msn_` + nanoid  | `msn_d4e5f6`  |
| Sector      | `sec_` + nanoid  | `sec_g7h8i9`  |
| Planet      | `pln_` + nanoid  | `pln_j1k2l3`  |
| Patent      | `pat_` + nanoid  | `pat_s4t5u6`  |
| Schematic   | `sch_` + nanoid  | `sch_v7w8x9`  |
| Discovery   | `dsc_` + nanoid  | `dsc_y1z2a3`  |
| Captain     | `cpt_` + nanoid  | `cpt_b4c5d6`  |
| Event       | `evt_` + nanoid  | `evt_e7f8g9`  |
| Modifier    | `mod_` + nanoid  | `mod_a1b2c3`  |

Use a small ID generation utility (nanoid or similar, 6-8 chars). Prefix makes it trivial to identify entity type in logs and debugging.

---

## Architectural Rules

### 1. Engine Purity

Files in `engine/`, `data/`, `generators/`, `types/`, and `utils/` must NEVER import from:

- `vue`
- `pinia`
- Any file in `stores/`, `views/`, `components/`, `composables/`, or `router/`

This is testable and enforceable. If an engine function needs game state, it receives it as a typed parameter — it never reaches into a store.

### 2. Store Responsibility

Stores are the bridge between engine and UI. A store:

- Holds the current state for its domain
- Exposes **getters** for derived data (formatted values, filtered lists, computed stats)
- Exposes **actions** that call engine functions and update state with the results
- Never contains game logic — that lives in `engine/`

Example flow for ending a turn:

```
View calls → gameStore.endTurn()
gameStore.endTurn() calls → turnResolver.resolve(fullGameState)
turnResolver returns → updated state
gameStore.endTurn() writes → updated state back to all stores
```

### 3. View Simplicity

Views and components should be thin. They:

- Read from stores (via `storeToRefs` or `computed`)
- Call store actions on user interaction
- Handle layout, display logic, and transitions
- Do NOT contain formulas, simulation logic, or complex calculations

### 4. Data Immutability in Engine

Engine functions should treat input state as read-only and return new state objects. This makes turn resolution predictable and debuggable. Stores handle the mutation.

### 5. Component Granularity

- `views/` = one per route, handles layout and data fetching from stores
- `components/` = reusable pieces, receive data via props, emit events upward
- A component should do ONE thing. If a component file exceeds ~150 lines, split it.

### 6. Save Compatibility

The game state serialization format must be versioned. Each save file includes a `version` number. When the state shape changes, a migration function converts old saves to the new format. This is critical for a game that players will play over weeks.

```typescript
interface SaveFile {
  version: number
  timestamp: string
  gameState: GameState
}
```

### 87. Empire Bonuses vs Local Modifiers

Empire-wide bonuses (from discoveries, affecting all entities uniformly) are stored as simple cumulative values on `gameState.empireBonuses` and read directly by formulas. Local per-entity variation (planet features, schematics, shortage maluses) uses the modifier system. Never use modifiers for values that apply identically to every entity — use empire state instead.

---

## Turn Resolution Order

The turn resolver calls phases in this exact order. This order matters because later phases depend on earlier phase results.

```
1. debt-phase        → Clear one debt token, apply BP cost
2. income-phase      → Calculate all income (corp tax + planet tax)
3. expense-phase     → Calculate all expenses (contracts + missions + empire)
4. contract-phase    → Advance contracts, check completion, spawn events
5. mission-phase     → Advance missions, resolve combat if triggered
6. science-phase     → Advance science sectors, roll discoveries, roll schematic/patent development
7. corp-phase        → Corporation AI: spend capital, invest, merge
8. colony-phase      → Recalculate all colony attributes, growth ticks
9. market-phase      → Resolve sector markets (production → consumption → trade)
10. event-phase      → Generate events based on current state (placeholder)
```

Each phase function signature follows the same pattern:

```typescript
function resolvePhase(state: GameState): PhaseResult {
  // Pure logic, no side effects
  return { updatedState, events }
}
```

---

## Modifier System

### Overview

Modifiers are the universal mechanism for adjusting game values. Instead of hardcoding bonuses and maluses into formulas, all variable adjustments are expressed as modifiers attached to entities. This keeps formulas clean, makes bonuses traceable in the UI, and allows any system to affect any value without coupling.

### Modifier Properties

Every modifier has:

- **id**: unique identifier (mod\_ prefix)
- **target**: the stat or attribute being modified (string key, e.g., 'habitability', 'speed', 'stability')
- **operation**: either 'add' (flat adjustment) or 'multiply' (percentage scaling)
- **value**: the numeric value (e.g., +1 for additive, 1.1 for 10% multiplicative boost)
- **sourceType**: what created this modifier ('feature', 'colonyType', 'discovery', 'schematic', 'corpTrait', 'debt', 'event')
- **sourceId**: the specific entity that created it (e.g., the feature ID, discovery ID)
- **condition** (optional): a condition that must be met for the modifier to apply

### Modifier Conditions

Some modifiers only apply in specific circumstances. A condition specifies:

- **attribute**: which attribute to check (e.g., 'habitability', 'populationLevel')
- **comparison**: 'lte' (less than or equal) or 'gte' (greater than or equal)
- **value**: the threshold value
- **scope**: 'colony' (check on the colony) or 'empire' (check on empire-wide state)

Example: A discovery might grant "+1 growth on colonies with habitability ≤ 4" — this would have condition `{ attribute: 'habitability', comparison: 'lte', value: 4, scope: 'colony' }`.

### Resolution Order

When calculating a final value, modifiers resolve in a fixed order:

1. Start with the **base value** (from static data or formula)
2. Collect all modifiers targeting this stat on this entity
3. Filter out any modifiers whose conditions are not met
4. Sum all **additive** modifiers: `adjusted = base + sum(additive_values)`
5. Apply all **multiplicative** modifiers sequentially: `final = adjusted × mult1 × mult2 × ...`
6. Clamp to valid range if applicable (e.g., 0-10 for colony attributes)

Additive always resolves before multiplicative. This means a +2 bonus and a ×1.5 multiplier on a base of 4 yields `(4 + 2) × 1.5 = 9`, not `(4 × 1.5) + 2 = 8`.

### Where Modifiers Live

Modifiers are stored on the entity they affect. They are only used for per-entity variation — values that differ between entities of the same type.

| Entity          | Modifier Sources                                                                                                |
| --------------- | --------------------------------------------------------------------------------------------------------------- |
| **Colony**      | Planet features, colony type passive bonus, shortage maluses (transient, recalculated each turn), event effects |
| **Ship**        | Schematics from building corp (applied at construction, permanent on the ship)                                  |
| **Corporation** | Patents (future), personality traits (future), event effects                                                    |

### Empire-Wide Bonuses (Not Modifiers)

Empire-wide bonuses from discoveries and other permanent global effects are NOT modifiers. They are cumulative values stored on `gameState.empireBonuses` and read directly by formulas. This avoids unnecessary modifier resolution for values that apply uniformly to the entire empire.

```
empireBonuses: {
  shipStats: { size: 0, speed: 0, firepower: 0, armor: 0, sensors: 0, evasion: 0 },
  infraCaps: { maxMining: 0, maxDeepMining: 0, maxGasExtraction: 0, maxAgricultural: 0, maxScience: 0, maxSpaceIndustry: 0, maxLowIndustry: 0, maxHeavyIndustry: 0, maxHighTechIndustry: 0 },
}
```

These values are updated directly when discoveries are made (`empireBonuses.shipStats.speed += 1`) and persist permanently. They are never cleared or recalculated.

Similarly, values like debt tokens are stored as simple state (`gameState.debtTokens`) and read directly by formulas — not expressed as modifiers.

### When Modifiers Are Registered

| Event                            | Modifiers Created                                                               |
| -------------------------------- | ------------------------------------------------------------------------------- |
| Colony founded                   | Planet feature modifiers → colony. Colony type passive bonus → colony           |
| Ship built                       | Building corp's schematics → ship (permanent snapshot at build time)            |
| Shortage detected (market phase) | Shortage malus modifiers → affected colony (cleared and recalculated each turn) |

### Transient vs Permanent Modifiers

Some modifiers are permanent (planet features, colony type bonuses, schematics on a built ship). Others are recalculated each turn (shortage maluses). Transient modifiers are cleared at the start of the relevant phase and reapplied based on current state.

Permanent modifiers are written once and persist in save files. Transient modifiers are derived from current state and never saved — they are recalculated on load and each turn.

### UI: Modifier Breakdown

Every modified value in the UI should support a tooltip showing the full breakdown:

```
Habitability: 9
  Base (Continental): 8
  Temperate Climate (feature): +1
  Harsh Radiation (feature): -2
  Breathable Atmosphere (feature): +2
```

```
Ship Firepower: 11 (Exceptional)
  Base (Assault role): 7
  Empire tech bonus: +2
  Corp scaling (×1.0): +0
  Hydra Missile (schematic): +2
  Random variation: +0
```

For empire-wide bonuses, the UI shows the aggregate value ("Tech +2") without per-discovery attribution. The discovery log provides the historical record of what was unlocked.

### Formula Patterns

**For values with local modifiers (colony attributes, ship stats):**

```
function calculateStat(baseValue, target, modifiers, clampMin, clampMax):
    filtered = modifiers.filter(m => m.target === target AND m.condition is met)
    additive = sum(filtered.filter(op === 'add').map(m => m.value))
    multiplicative = product(filtered.filter(op === 'multiply').map(m => m.value))
    result = (baseValue + additive) × multiplicative
    return clamp(result, clampMin, clampMax)
```

**For values with empire-wide bonuses (ship construction, infra caps):**

```
function calculateShipStat(roleBase, stat, empireBonuses, corpModifier, schematics):
    techBase = roleBase + empireBonuses.shipStats[stat]
    scaled = floor(techBase × corpModifier)
    schematicBonus = sum(schematics matching stat)
    return scaled + schematicBonus + random(-1, +1)

function calculateInfraCap(popLevel, domain, empireBonuses):
    base = popLevel × 2
    return base + empireBonuses.infraCaps[domain]
```

Engine code must never add bonuses inline. Local variation uses modifiers. Global bonuses use empire state directly.

### Modifier Targets (Reference)

Colony attribute targets (local modifiers):

- `habitability`, `accessibility`, `dynamism`, `qualityOfLife`, `stability`, `growth`

Colony infrastructure cap targets (local modifiers, e.g., from planet features):

- `maxMining`, `maxDeepMining`, `maxGasExtraction`, `maxAgricultural`, `maxScience`, `maxSpaceIndustry`

Colony production targets (local modifiers):

- `miningOutput`, `deepMiningOutput`, `gasExtractionOutput`, `agriculturalOutput`

Ship stat targets (local modifiers from schematics):

- `size`, `speed`, `firepower`, `armor`, `sensors`, `evasion`

Empire-wide bonus keys (simple state, not modifiers):

- `empireBonuses.shipStats.*`
- `empireBonuses.infraCaps.*`

## Key Implementation Notes

### When implementing a new feature:

1. Define types in `types/` first
2. Add static data to `data/` if needed
3. Write engine logic in `engine/`
4. Add or update the relevant store in `stores/`
5. Build UI in `components/` and `views/`
6. Update `Changelog.md`
7. Always add Todo referencing the future implementation that will be done through the future stories, epics or features, or when you half implement a system. This will make sure the codebase itself is the documentation for all the implementation.

### When you need a file you don't have access to:

Reference this structure document. Ask for the specific file by its path. Example: "I need `src/types/colony.ts` and `src/engine/formulas/attributes.ts` to implement the colony attribute calculation."

### When adding a new entity type:

1. Add type definition in `types/`
2. Add ID prefix to the ID convention table above
3. Create or update relevant store
4. Ensure it's included in `GameState` type and save serialization
5. Add generator if procedurally generated

### When modifying formulas:

1. Update the formula in `engine/formulas/`
2. Verify the formula matches `Specs.md` — if it doesn't, update `Specs.md` first
3. Check downstream effects (formulas often feed into other formulas)
4. If the formula involves modifiers, verify it uses `resolveModifiers()` from the modifier system — never hardcode bonuses inline
