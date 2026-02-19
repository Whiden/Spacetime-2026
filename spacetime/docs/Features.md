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

Initialize the Vue 3 + TypeScript project with Vite, Pinia, Vue Router, Tailwind CSS, and Vitest. Configure all tooling.

### Story 1.2: Core Types — Common 🔧

Define shared types used across the entire project: Id types, TurnNumber, BPAmount, enums for planet types, sizes, resource types, etc.

### Story 1.3: Core Types — All Entities 🔧

Define TypeScript interfaces for every game entity.

### Story 1.3b: Modifier System Types & Resolver 🔧🧪

Define the modifier type system and implement the resolver function that colony attributes and ship stats use for local per-entity variation. Also define the EmpireBonuses type for global cumulative values.

### Story 1.4: Utility Functions 🔧🧪

Implement shared utility functions for random number generation, math helpers, formatting, and ID generation.

### Story 1.5: Static Data Files 🔧

Create all static data files containing game constants, tables, and templates as defined in Data.md.

## Epic 2: Game Shell & Navigation

> Build the application shell: sidebar navigation, header with turn/BP display, router configuration, and empty view scaffolds. The player can navigate between screens but everything is empty.

### Story 2.1: Router Configuration 🖥️

Set up Vue Router with routes for all primary screens.

### Story 2.2: App Layout Shell 🖥️

Create the main application layout with sidebar navigation, top header bar, and main content area.

### Story 2.3: Empty View Scaffolds 🖥️

Create placeholder views for all screens with titles and empty states.

### Story 2.4: Shared UI Components 🖥️

Build reusable UI components used across multiple screens.

## Epic 3: Galaxy Generation & Sectors

> Generate the galaxy (sector network) at game start. Display sectors in the Galaxy screen. This is foundational — sectors are the container for everything else.

### Story 3.1: Sector Generator 🔧🧪

Implement sector generation: name, density, threat modifier.

### Story 3.2: Galaxy Generator 🔧🧪

Generate the full galaxy: 10-15 sectors with adjacency graph.

### Story 3.3: Galaxy Store 🔧

Create Pinia store for galaxy state.

### Story 3.4: Galaxy View 🖥️

Display sector list with adjacency connections, exploration status, and basic info.

## Epic 4: Planets & Colonies — Data Model

> Implement planet generation and colony data structures. Create Terra Nova as the starting colony. Display colonies in the UI. No simulation yet — just data display.

### Story 4.1: Planet Generator 🔧🧪

Generate planets with type, size, features, and deposits according to Data.md rules.

### Story 4.2: Colony Generator 🔧🧪

Initialize a colony from a planet and colony type selection.

### Story 4.3: Planet & Colony Stores 🔧

Create Pinia stores for planets and colonies.

### Story 4.4: Colony List View 🖥️

Display all colonies in a list with summary information.

### Story 4.5: Colony Detail View 🖥️

Display full colony information: attributes, infrastructure, deposits, features, corporations present.

## Epic 5: Budget System

> Implement the BP economy: income calculation, expense tracking, debt tokens. Display budget in header and dedicated section of dashboard.

### Story 5.1: Tax Formulas 🔧🧪

Implement planet tax and corporation tax calculations.

### Story 5.2: Budget Store 🔧

Create Pinia store for budget state: balance, income, expenses, debt tokens.

### Story 5.3: Budget Display 🖥️

Show budget information in the header and on the dashboard.

## Epic 6: Corporations — Data Model & Lifecycle

> Implement corporation generation, data model, capital system, and display. No AI behavior yet — just creating corps and viewing them.

### Story 6.1: Corporation Generator 🔧🧪

Generate corporations with name, type, personality traits, and starting stats.

### Story 6.2: Corporation Store 🔧

Create Pinia store for all corporations.

### Story 6.3: Corporation Capital Formulas 🔧🧪

Implement capital gain calculations.

### Story 6.4: Corporations View 🖥️

Display corporation list and detail views.

## Epic 7: Contract System

> Implement the contract creation flow, contract execution (progress tracking), and contract completion. This is the player's primary interaction — it must feel smooth.

### Story 7.1: Contract Engine — Creation & Validation 🔧🧪

Implement contract creation logic: validate inputs, calculate costs, check eligibility.

### Story 7.2: Contract Store 🔧

Create Pinia store for contracts.

### Story 7.3: Contract Phase — Turn Resolution 🔧🧪

Implement contract advancement during turn resolution.

### Story 7.4: Contract Creation UI — Wizard Flow 🖥️

Build the multi-step contract creation interface.

### Story 7.5: Contracts View 🖥️

Display active and completed contracts.

## Epic 8: Infrastructure & Production

> Implement infrastructure levels, resource production and consumption calculations, and player investment in infrastructure. This connects colonies to the economy.

### Story 8.1: Production & Consumption Formulas 🔧🧪

Implement all resource production and consumption calculations.

### Story 8.2: Colony Resource Flow Calculator 🔧🧪

Calculate complete production and consumption for a single colony.

### Story 8.3: Player Investment Action 🔧🧪

Implement direct BP investment in colony infrastructure.

### Story 8.4: Infrastructure UI Updates 🖥️

Update colony detail view with functional infrastructure investment.

## Epic 9: Sector Market & Trade

> Implement the sector market resolution system: production pooling, dynamism-priority purchasing, shortage resolution. This is the economic engine of the game.

### Story 9.1: Market Resolver 🔧🧪

Implement full sector market resolution logic.

### Story 9.2: Market Phase — Turn Resolution 🔧🧪

Integrate market resolver into turn resolution pipeline.

### Story 9.3: Market Store 🔧

Create Pinia store for market state.

### Story 9.4: Market View 🖥️

Display sector market dashboard.

## Epic 10: Colony Simulation

> Implement colony attribute calculation, population growth, and organic infrastructure growth. Colonies become living, evolving entities.

### Story 10.1: Attribute Formulas 🔧🧪

Implement all colony attribute calculations.

### Story 10.2: Colony Simulation — Growth & Population 🔧🧪

Implement population growth logic and organic

### Story 10.3: Colony Phase — Turn Resolution 🔧🧪

Integrate colony simulation into turn resolution.

### Story 10.4: Colony UI Updates 🖥️

Update colony views to show live simulation data.

## Epic 11: Corporation AI

> Implement autonomous corporation behavior: capital spending decisions, infrastructure investment, acquisition logic. Corps become alive.

### Story 11.1: Corporation Investment AI 🔧🧪

Implement corporation decision-making for capital spending each turn.

### Story 11.2: Corp Phase — Turn Resolution 🔧🧪

Integrate corporation AI into turn resolution pipeline.

### Story 11.3: Organic Corporation Emergence 🔧🧪

Implement natural corporation spawning on high-dynamism colonies.

---

## Epic 12: Turn Resolution Pipeline

> Wire all phases together into the master turn resolver. Implement the End Turn flow: player confirms → all phases run in order → new turn state. This is the game loop.

### Story 12.1: Turn Resolver 🔧🧪

Implement the master turn resolution function that calls all phases in order.

### Story 12.2: Income & Expense Phases 🔧🧪

Implement income and expense calculation phases.

### Story 12.3: Debt Phase 🔧🧪

Implement debt token resolution.

### Story 12.4: Game Store & End Turn Flow 🔧

Create master game store that orchestrates turn resolution and state distribution.

### Story 12.5: End Turn UI Flow 🖥️

Implement the End Turn button and turn transition experience.

### Story 12.6: Event Phase (Placeholder) 🔧

Create placeholder event phase that passes through without generating events.

## Epic 13: Exploration

> Implement the exploration gameplay loop: explore sectors, discover planets, orbit scan, ground survey, accept/reject.

### Story 13.1: Exploration Engine 🔧🧪

Implement exploration gain and planet discovery logic.

### Story 13.2: Exploration Contract Completion 🔧🧪

Wire exploration results into contract completion.

### Story 13.3: Accept/Reject Planet Action 🔧

Implement player accepting or rejecting discovered planets.

### Story 13.4: Ground Survey Contract 🔧

Wire ground survey contract to reveal full planet data.

### Story 13.5: Exploration UI 🖥️

Build exploration interface within Galaxy view and contract creation.

## Epic 14: Science & Discoveries

> Implement science advancement, discovery system, and schematic generation. The technology layer that feeds into ships.

### Story 14.1: Science Simulation 🔧🧪

Implement science point accumulation and domain advancement.

### Story 14.2: Discovery System 🔧🧪

Implement discovery rolling for science corporations.

### Story 14.3: Schematic Generation 🔧🧪

Implement schematic development for shipbuilding corporations from discoveries.

### Story 14.4: Science Phase — Turn Resolution 🔧🧪

Integrate science into turn resolution pipeline.

### Story 14.5: Science Store & View 🖥️

Create science store and display screen.

## Epic 15: Ships & Blueprints

> Implement ship blueprints, ship construction, and fleet display. Ships become real entities.

### Story 15.1: Blueprint System 🔧🧪

**Description**: Implement ship stat generation from role, tech, corp level, schematics, and size variant.

**Files**: `src/engine/actions/design-blueprint.ts`

**Acceptance Criteria**:

- Accepts: role, size variant (Light/Standard/Heavy), building corp, empire tech bonuses, corp schematics
- Main stat generation per stat (size, speed, firepower, defence, detection, evasion):
  ```
  effective_base = role_base_stat + empire_tech_bonus[stat]
  corp_modifier = 0.7 + (corp_level × 0.06)
  final_stat = floor((floor(effective_base × corp_modifier) + schematic_bonuses) × random(0.8, 1.2))
  ```
- Size variant multiplier applied to the `size` stat: Light ×0.75, Standard ×1.0, Heavy ×1.25
- Secondary stats derived after main stats:
  ```
  hull_points = size × 5 + defence × 10 + schematic_bonuses + role_bonuses
  power_projection = floor(size × 1.5) + schematic_bonuses + role_bonuses
  bp_per_turn = max(1, floor(size / 3)) + schematic_bonuses + role_bonuses
  base_build_time = max(3, floor(size × 1)) + schematic_bonuses + role_bonuses
  ```
- Size variant multiplier also applied to `bp_per_turn` and `base_build_time` (Light ×0.75, Heavy ×1.25, floored)
- Ship abilities calculated from final stats:
  ```
  Fight = floor((Firepower + floor(Defence × 0.75) + floor(Evasion × 0.5)) × Size / 2)
  Investigation = floor((floor(Speed × 0.75) + Detection) × Size / 2)
  Support = floor((floor(Firepower × 0.5) + floor(Detection × 0.75)) × Size / 2)
  ```
- Reads empire bonuses as plain additive values; stores schematics on ship for attribution
- Returns fully typed Ship object with all stats, secondary stats, abilities, schematics applied list, build turn, and owning corp
- Unit tests: stat formula at corp level 1/5/10, tech bonus additive effect, variant multiplier on size and derived stats, schematic bonus stacking, randomness bounded to [0.8, 1.2], derived stat calculations, ability score calculations

### Story 15.2: Ship Construction 🔧🧪

**Description**: Implement ship building as a contract.

**Files**: Update contract system for ship commission type

**Acceptance Criteria**:

- Ship commission contract requires: role selection, size variant (Light/Standard/Heavy), colony with sufficient space infrastructure, shipbuilding corp
- Space infrastructure requirement: `required_space_infra = base_size × size_multiplier` (where base_size is the role's Base Size from Data.md and size_multiplier is 0.75/1.0/1.25)
- Contract cost (BP/turn) = `bp_per_turn` from blueprint (already includes size variant multiplier)
- Contract duration = `base_build_time` from blueprint (already includes size variant multiplier); actual build time further reduced by corp level: `actual_build_time = max(1, floor(base_build_time × (1 - corp_level × 0.05)))`
- On completion: ship generated using blueprint engine (Story 15.1), captain assigned at Green experience
- Ship added to fleet store with status "Stationed" at the colony's sector
- Building corp receives contract completion bonus as per normal contract rules
- Unit tests: space infra validation per role and variant, build time reduction across corp levels, cost calculation, ship object correctness on completion

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
- Ship card: name, role, size (with descriptive label), stat bars with labels (Poor/Average/Good/Excellent/Exceptional), ability scores (Fight / Investigation / Support), captain name and experience, condition bar, status, schematics applied
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

- Player selects mission type (Escort/Assault/Defense/Rescue/Investigation), target sector, and ships for task force
- Task force: ships from any government-owned fleet may combine; highest-experience captain becomes commander; commander's personality trait determines retreat threshold in combat
- Validates: all selected ships are available (status "Stationed", not on another mission), target sector is valid
- Calculates: travel time (sector hops × 1 turn per hop), execution duration (from Data.md mission durations), total BP/turn cost (mission base cost + fleet surcharge of +1 BP/turn per ship with size ≥ 7)
- Returns typed Mission object or validation error
- On creation: ships status set to "On Mission"
- Unit tests: valid creation, ship already on mission rejected, non-owned ship rejected, cost calculation with and without surcharge, commander selection by experience

### Story 16.2: Combat Resolver 🔧🧪

**Description**: Implement semi-abstracted combat resolution.

> **Note**: Specs.md marks full combat resolution as post-prototype ("This is a TODO"). Implement a simplified version for the prototype: use task force `Fight` ability score vs a difficulty value to determine win/loss, with partial ship damage as outcome. Full phase-by-phase combat can be revisited in Epic 20.

**Files**: `src/engine/simulation/combat-resolver.ts`, `src/engine/formulas/combat.ts`

**Acceptance Criteria (simplified prototype)**:

- Receives task force Fight score and mission difficulty (derived from mission type and target sector threat modifier)
- Rolls outcome: win if `Fight × random(0.85, 1.15) > difficulty`, partial losses possible even on win
- Applies captain combat modifier to Fight score (`Green ×0.8`, `Regular ×1.0`, `Veteran ×1.1`, `Elite ×1.2`)
- Condition degradation: winning task force takes 5-20% condition loss per ship; losing task force takes 30-60%
- Ship destruction: if condition reaches 0%, ship is permanently lost
- Returns CombatResult with: win/loss, per-ship condition deltas, destroyed ship IDs, round narrative summary
- Unit tests: win/loss calculation, captain modifier application, condition delta range, ship destruction at 0%

> **TODO (post-prototype)**: Replace with full phase-by-phase resolution: Initiative (avg sensors), Targeting (damaged → smallest), Exchange Rounds (3-5), Retreat Check (cautious 50% / normal 40% / aggressive 25%), Aftermath (disabled recovery 50%)

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
- Risk assessment shown: task force ability scores (Fight / Investigation / Support) surfaced per mission type — the relevant ability score determines mission fitness (Fight for Assault/Defense, Investigation for Investigation/Rescue, Support for Escort)
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
- Budget summary: income, expenses, net BP, debt warning (red banner if in debt)
- Event feed (current turn, priority-sorted: Critical → Warning → Info → Positive)
- Empire summary cards: colony count, corp count, ship count, active contract count — each card links to the relevant screen
- Quick actions: Create Contract, View Colonies, View Corporations, View Fleet
- "No active contracts" state prompts contract creation with a clear call-to-action
- Starting corporations (1 Exploration, 1 Construction, 2× Science) are visible immediately at game start — no empty state for corporations
- Science summary card shows highest domain level and number of discoveries made (links to Science view)

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
