# Spacetime — Code Map

> **Purpose**: Method-level index of every public API in the engine, stores, and composables.
> Use this to find what to call, what it expects, and what it returns — without reading full source files.
> For file locations and architectural rules, see `Structure.md`.
> For game formulas and mechanic rules, see `Specs.md`.

---

## How to Read This Document

Each section lists a file's **exported functions** with their signatures, a one-line description, and any
error codes they can return. Internal helpers (prefixed `_` or not exported) are omitted.

**Result pattern used throughout the engine:**
```typescript
// Actions return a discriminated union, never throw
{ success: true,  /* payload */ }
{ success: false, error: 'ERROR_CODE', message: string }
```

---

## Call Stacks

Visual traces of the most common operations, top-to-bottom (UI → Engine).

---

### End Turn

```
User clicks "End Turn" button
└─> useTurnActions.ts :: endTurn()
    └─> gameStore.endTurn()
        ├─> phase = 'resolving'
        ├─> getFullGameState()                         // snapshot all 11 stores → GameState
        ├─> resolveTurn(gameState)                     // PURE: 10 phases in order
        │   ├─> resolveDebtPhase(state)                // Phase 1
        │   ├─> resolveIncomePhase(state)              // Phase 2
        │   │   ├─> calculatePlanetTax(popLevel, hab)  //   formulas/tax.ts
        │   │   └─> calculateCorpTax(corpLevel)        //   formulas/tax.ts
        │   ├─> resolveExpensePhase(state)             // Phase 3
        │   ├─> resolveContractPhase(state)            // Phase 4
        │   ├─> resolveMissionPhase(state)             // Phase 5
        │   ├─> resolveSciencePhase(state)             // Phase 6
        │   ├─> resolveCorpPhase(state)                // Phase 7
        │   │   └─> corp-ai.ts (autonomous decisions)
        │   ├─> resolveColonyPhase(state)              // Phase 8
        │   │   └─> colony-sim.ts (attributes, growth)
        │   ├─> resolveMarketPhase(state)              // Phase 9
        │   │   └─> market-resolver.ts (5-phase market)
        │   └─> resolveEventPhase(state)               // Phase 10
        ├─> _distributeResults(updatedState)           // write back to all stores
        ├─> autosave(updatedState)                     // utils/save.ts → LocalStorage
        ├─> eventStore.addEvents(events)
        └─> turn++, phase = 'player_action'

UI re-renders automatically (Pinia reactive stores)
```

---

### Player Invests in Infrastructure

```
User clicks "Invest" on InfraPanel (e.g. HeavyIndustry on Terra Nova)
└─> InfraPanel.vue emits invest event
    └─> ColonyDetailView.vue calls colonyStore.investInfrastructure(colonyId, domain, currentBP, deposits)
        └─> colony.store.ts :: investInfrastructure()
            ├─> engine/actions/invest-planet.ts :: investPlanet(params)
            │   ├─> Validates colony exists
            │   ├─> Validates currentBP >= INVEST_COST_BP (3)
            │   ├─> For extraction domains: validates deposit exists on planet
            │   ├─> Computes effective cap (deposit type cap OR popLevel × 2)
            │   ├─> Validates domain is below cap
            │   └─> Returns { success: true, updatedColony, bpSpent: 3 }
            ├─> On success: colonies.value.set(colonyId, updatedColony)
            └─> Caller deducts bpSpent from budgetStore.currentBP

UI re-renders (colony infrastructure panel updates automatically)
```

---

### Player Creates a Contract

```
User completes contract wizard → clicks "Confirm"
└─> ContractWizard.vue calls useContractCreation composable
    └─> composables/useContractCreation.ts :: submitContract()
        └─> contract.store.ts :: addContract(params)
            └─> engine/actions/create-contract.ts :: createContract(params)
                ├─> Looks up corp
                ├─> validateTarget() — checks entity exists + correct status
                ├─> isCorpEligible() — checks corp type/level rules
                ├─> calculateBpPerTurn() — from contract type definition or colony type
                ├─> calculateDuration() — from corp level + contract type
                └─> Returns { success: true, contract: Contract }
            ├─> contracts.value.set(contract.id, contract)
            └─> budgetStore.addExpense(contract.id, contract.bpPerTurn)
```

---

### Player Creates a Mission

```
User selects ships + target sector → clicks "Launch Mission"
└─> MissionWizard.vue calls mission.store.ts :: addMission(params)
    └─> engine/actions/create-mission.ts :: createMission(params, state, randFn)
        ├─> Validates shipIds.length > 0
        ├─> Validates target sector exists
        ├─> For each ship: validates Stationed + government-owned
        ├─> BFS shortest path (adjacency graph) → travelTurns
        ├─> selectCommander() — highest-experience captain
        ├─> calculateMissionCost() — base + fleet surcharge (size >= 7)
        ├─> sampleExecutionDuration() — random from [min, max] range
        └─> Returns { success: true, mission, updatedShips }
    ├─> missions.value.set(mission.id, mission)
    └─> fleetStore.updateShips(updatedShips)  // ships set to OnMission
```

---

### Save to LocalStorage

```
gameStore.endTurn() → autosave(updatedState)
└─> composables/useSaveLoad.ts :: autosave(state)
    └─> utils/save.ts :: serializeGameState(state)
        ├─> Maps → Records (mapToRecord for each entity collection)
        ├─> Wraps in { version: 1, timestamp, gameState }
        └─> JSON.stringify()
    └─> localStorage.setItem('spacetime_autosave', json)
```

---

### Load from LocalStorage

```
SettingsView.vue → useSaveLoad.ts :: loadFromLocalStorage(slot)
└─> localStorage.getItem(key) → json string
    └─> utils/save.ts :: deserializeGameState(json)
        ├─> JSON.parse()
        ├─> Validates version === SAVE_VERSION (throws if mismatch)
        └─> Records → Maps (recordToMap for each entity collection)
    └─> gameStore.loadGame(state)
        ├─> _distributeResults(state)   // populate all domain stores
        ├─> turn.value = state.turn
        └─> phase = 'player_action'
```

---

## Engine — Turn Phases (`engine/turn/`)

All phase functions follow the same contract:
```typescript
function resolveXPhase(state: GameState): PhaseResult
// PhaseResult = { updatedState: GameState, events: GameEvent[] }
```

| Function | File | Phase # | What it does |
|---|---|---|---|
| `resolveTurn(state)` | `turn-resolver.ts` | — | Master entry point. Calls all 10 phases, threads state, returns `TurnResult` |
| `resolveDebtPhase(state)` | `debt-phase.ts` | 1 | Clears one debt token if any, deducts 1 BP |
| `resolveIncomePhase(state)` | `income-phase.ts` | 2 | Sums planet tax + corp tax, credits BP, itemises income sources |
| `resolveExpensePhase(state)` | `expense-phase.ts` | 3 | Deducts contract + mission costs, issues debt token on deficit |
| `resolveContractPhase(state)` | `contract-phase.ts` | 4 | Advances `turnsRemaining`, fires completion effects (new colony, new ship, etc.) |
| `resolveMissionPhase(state)` | `mission-phase.ts` | 5 | Advances travel → execution → return phases, runs combat on execution |
| `resolveSciencePhase(state)` | `science-phase.ts` | 6 | Advances science domains, rolls discoveries, generates schematics/patents |
| `resolveCorpPhase(state)` | `corp-phase.ts` | 7 | Corp AI: capital gain, infrastructure investment decisions, organic corp emergence |
| `resolveColonyPhase(state)` | `colony-phase.ts` | 8 | Recalculates infra caps, all colony attributes, growth ticks, organic infra growth |
| `resolveMarketPhase(state)` | `market-phase.ts` | 9 | Delegates to `market-resolver.ts`, writes `SectorMarketState` for all sectors |
| `resolveEventPhase(state)` | `event-phase.ts` | 10 | Placeholder — generates events from current state (no active threat logic yet) |

`resolveTurn` returns:
```typescript
TurnResult {
  updatedState: GameState    // complete state after all phases
  events: GameEvent[]        // all events from all phases, in phase order
  completedTurn: TurnNumber  // the turn number that just resolved
}
```

---

## Engine — Player Actions (`engine/actions/`)

These are called by stores when the player acts. They never mutate state directly — they return a result and the store writes it.

---

### `investPlanet(params)` — `invest-planet.ts`

```typescript
investPlanet(params: InvestPlanetParams): InvestPlanetResult
```

**Params:**
```typescript
{
  colonyId:  ColonyId
  domain:    InfraDomain
  currentBP: BPAmount          // must be >= INVEST_COST_BP (3)
  colonies:  Map<string, Colony>
  deposits:  Deposit[]         // deposits on the colony's planet
}
```

**Returns:**
```typescript
{ success: true;  updatedColony: Colony; bpSpent: BPAmount }  // bpSpent always = 3
{ success: false; error: InvestPlanetError; message: string }
```

**Error codes:**

| Code | When |
|---|---|
| `COLONY_NOT_FOUND` | `colonyId` not in provided map |
| `INSUFFICIENT_BP` | `currentBP < 3` |
| `NO_MATCHING_DEPOSIT` | Extraction domain has no deposit on this planet |
| `AT_CAP` | Domain already at its effective cap |

**Note:** Caller must deduct `bpSpent` from budget store on success.

---

### `createContract(params)` — `create-contract.ts`

```typescript
createContract(params: CreateContractParams): ContractCreationResult
```

**Params:**
```typescript
{
  type:               ContractType
  target:             ContractTarget          // { type: 'sector' | 'planet' | 'colony' | 'sector_pair', ...id }
  assignedCorpId:     CorpId
  currentTurn:        TurnNumber
  sectors:            Map<string, Sector>
  sectorAdjacency:    Map<string, string[]>
  colonySectorIds:    Set<string>             // sectors that contain a player colony
  colonies:           Map<string, Colony>
  planets:            Map<string, Planet>
  corporations:       Map<string, Corporation>
  colonizationParams?: { colonyType: ColonyType }
  shipCommissionParams?: { role: ShipRole; sizeVariant: SizeVariant }
}
```

**Returns:**
```typescript
{ success: true;  contract: Contract }
{ success: false; error: ContractValidationError; message: string }
```

**Error codes:**

| Code | When |
|---|---|
| `CORP_NOT_FOUND` | `assignedCorpId` not in corporations map |
| `CORP_NOT_ELIGIBLE` | Corp type/level cannot do this contract type |
| `INVALID_TARGET_TYPE` | Target shape doesn't match contract type |
| `TARGET_NOT_FOUND` | Sector / planet / colony ID not found |
| `INVALID_PLANET_STATUS` | Planet not in correct status for this contract |
| `SECTOR_OUT_OF_RANGE` | Exploration target not adjacent to any colony sector |
| `SECTORS_NOT_ADJACENT` | Trade route sectors are not adjacent |
| `MISSING_COLONY_TYPE` | Colonization contract missing `colonizationParams` |
| `MISSING_SHIP_PARAMS` | Ship commission missing `shipCommissionParams` |
| `INSUFFICIENT_SPACE_INFRA` | Colony lacks space industry levels for ship size |

**Eligibility rules:**
- Own corp type → always eligible
- Level 3+ → eligible for Exploration and GroundSurvey (cross-type)
- Level 6+ (Megacorp) → eligible for everything
- Colonization, ShipCommission, TradeRoute → own type only, no cross-type

---

### `createMission(params, state, randFn?)` — `create-mission.ts`

```typescript
createMission(
  params: { missionType: MissionType; targetSectorId: SectorId; shipIds: string[] },
  state: GameState,
  randFn?: () => number          // injectable RNG, defaults to Math.random
): CreateMissionResult
```

**Returns:**
```typescript
{ success: true;  mission: Mission; updatedShips: Map<string, Ship> }  // ships set to OnMission
{ success: false; error: CreateMissionError }
```

**Error codes:**

| Code | When |
|---|---|
| `NO_SHIPS_SELECTED` | `shipIds` is empty |
| `SHIP_NOT_FOUND` | A ship ID not found in state |
| `SHIP_NOT_AVAILABLE` | Ship status is not `Stationed` |
| `SHIP_NOT_GOVERNMENT` | Ship `ownerCorpId !== 'government'` |
| `SECTOR_NOT_FOUND` | Target sector not in galaxy |
| `NO_HOME_SECTOR` | BFS finds no path from home to target (should never happen) |

**Cost:** `base_bp_per_turn + fleet_surcharge` where surcharge = +1 per ship with `size >= 7`.
**Travel time:** BFS hop count from first ship's `homeSectorId` to `targetSectorId`.
**Commander:** Highest-experience captain in the task force (Elite > Veteran > Regular > Green).

---

### `acceptPlanet(planetId, planets)` — `accept-planet.ts`

```typescript
acceptPlanet(planetId: PlanetId, planets: Map<string, Planet>): AcceptPlanetResult
```

Changes planet status to `Accepted`. Planet must be `OrbitScanned` or `GroundSurveyed`.

**Error codes:** `PLANET_NOT_FOUND`, `INVALID_STATUS`

---

### `rejectPlanet(planetId, planets)` — `accept-planet.ts`

```typescript
rejectPlanet(planetId: PlanetId, planets: Map<string, Planet>): AcceptPlanetResult
```

Changes planet status to `Rejected`. Same validation as `acceptPlanet`.

---

### `createTradeRoute(params)` — `create-trade-route.ts`

```typescript
createTradeRoute(params: CreateTradeRouteParams): TradeRouteCreationResult
```

Thin wrapper around `createContract()` for `ContractType.TradeRoute`. Duration is set to sentinel `9999` (ongoing until cancelled). Requires Transport corp or Megacorp.

**Params:**
```typescript
{
  sectorIdA:       SectorId
  sectorIdB:       SectorId
  assignedCorpId:  CorpId
  currentTurn:     TurnNumber
  sectors:         Map<string, Sector>
  sectorAdjacency: Map<string, string[]>
  corporations:    Map<string, Corporation>
}
```

**Error codes:** Same as `createContract` (`SECTORS_NOT_ADJACENT`, `CORP_NOT_ELIGIBLE`, etc.)

---

## Engine — Formulas (`engine/formulas/`)

Pure math functions. No state, no side effects, always return numbers.

---

### `tax.ts`

```typescript
calculatePlanetTax(popLevel: number, habitability: number): number
// Returns 0 if popLevel < 5
// Formula: max(0, floor(pop² / 4) - habitability_cost)
//   where habitability_cost = max(0, 10 - hab) × max(1, floor(pop / 3))

calculateCorpTax(corpLevel: number): number
// Returns 0 for level 1-2 (startup exemption)
// Formula: floor(corpLevel² / 5)
```

---

### `attributes.ts`

```typescript
calculateHabitability(basePlanetHab: number, colonyModifiers: Modifier[]): number
// Applies 'habitability' modifiers. Clamps 0–10.

calculateAccessibility(transport: number, colonyModifiers: Modifier[]): number
// Based on transport infra levels. Clamps 0–10.

calculateDynamism(colony: Colony, colonyModifiers: Modifier[]): number
// Based on corp activity, market activity. Clamps 0–10.

calculateQualityOfLife(colony: Colony, colonyModifiers: Modifier[]): number
// Based on consumer goods, habitability, civilian infra. Clamps 0–10.

calculateStability(colony: Colony, debtTokens: number, colonyModifiers: Modifier[]): number
// Based on QoL, shortage maluses, debt malus. Clamps 0–10.

calculateGrowth(colony: Colony, colonyModifiers: Modifier[]): number
// Unbounded accumulator. Transitions at >= 10 (pop up) and <= -1 (pop down).

calculateInfraCap(popLevel: number, domain: InfraDomain, empireBonuses?: EmpireInfraCapBonuses): number
// For non-extraction domains: popLevel × 2 + empireBonuses.infraCaps[domain]
```

---

### `modifiers.ts`

```typescript
resolveModifiers(
  baseValue: number,
  target: string,           // stat key: 'habitability', 'speed', 'stability', etc.
  modifiers: Modifier[],
  clampMin?: number,
  clampMax?: number,
  conditionContext?: Record<string, number>  // current attribute values for condition evaluation
): number
// Resolution order: additive sum first, then multiplicative chain, then clamp.
// (base + Σadds) × m1 × m2 × ... → clamp

getModifierBreakdown(
  target: string,
  modifiers: Modifier[],
  conditionContext?: Record<string, number>
): ModifierBreakdownEntry[]
// Returns [{ source: string, operation: 'add'|'multiply', value: number }]
// Used by UI tooltips to show stat breakdown.

filterByTarget(target: string, modifiers: Modifier[]): Modifier[]
// Returns modifiers targeting a specific stat, without applying them.
```

---

### `growth.ts`

```typescript
getTotalOwnedInfra(infrastructureByColony: Map<string, CorpInfrastructureHoldings>): number
// Sums all owned infrastructure levels across all colonies for a corp.

calculateCapitalGain(totalOwnedInfra: number): number
// Formula: random(0,1) + floor(totalOwnedInfra / 10)
// Called each turn in corp-phase.ts for each corporation.

calculateContractBonus(bpPerTurn: BPAmount, durationTurns: number): number
// Formula: floor((bpPerTurn × duration) / 5)
// Capital bonus given to a corp when it completes a contract.

calculateLevelUpCost(currentLevel: number): number
// Formula: currentLevel × 3

calculateAcquisitionCost(targetLevel: number): number
// Formula: targetLevel × 5

getMaxInfraForLevel(corpLevel: number): number
// Formula: corpLevel × 4

shouldPopLevelUp(growth: number, colony: Colony): boolean
// True if growth >= 10 AND civilian infra >= next pop level AND pop < cap.

shouldPopLevelDown(growth: number, popLevel: number): boolean
// True if growth <= -1 AND popLevel > 1.

calculateOrganicInfraChance(dynamism: number): number
// Formula: dynamism × 5 (returns a percentage, 0-50)
```

---

### `tax.ts`, `production.ts`, `exploration.ts`, `combat.ts`

```typescript
// production.ts
calculateInfraCap(popLevel: number, domain: InfraDomain): number

// exploration.ts
calculateExplorationGain(corpLevel: number): number
calculatePoiDiscoveryChance(sector: Sector): number

// combat.ts
calculateFightScore(ship: Ship, captain: Captain): number
calculateDamage(attacker: Ship, defender: Ship): number
```

---

## Pinia Stores (`stores/`)

Stores are Vue-reactive. Reading `.value` inside a component creates an automatic subscription — the component re-renders when the value changes. **Never access stores from engine code.**

---

### `game.store.ts` — Master orchestrator

```typescript
// State (reactive)
turn: Ref<TurnNumber>
phase: Ref<GamePhase>          // 'player_action' | 'resolving' | 'reviewing'
lastTurnEvents: Ref<GameEvent[]>

// Getters (computed)
currentTurn: ComputedRef<TurnNumber>
gamePhase: ComputedRef<GamePhase>

// Actions
initializeGame(): void
// Full new-game setup: galaxy, Terra Nova, budget, starting corps, event reset.

getFullGameState(): GameState
// Assembles a complete GameState snapshot from all 11 stores.
// Called immediately before resolveTurn().

endTurn(): void
// Full turn cycle: snapshot → resolveTurn → distribute results → autosave → turn++.
// Guards against calling during non-player_action phase.

loadGame(state: GameState): void
// Restores full game state from a deserialized save (populate all stores).

acknowledgeResults(): void
// Transitions 'reviewing' → 'player_action' (unused in current flow).
```

---

### `colony.store.ts`

```typescript
// State
colonies: Ref<Map<ColonyId, Colony>>

// Getters
getColoniesBySector(sectorId: SectorId): Colony[]
getColony(id: ColonyId): Colony | undefined

// Actions
addColony(colony: Colony): void
updateColony(colony: Colony): void
removeColony(id: ColonyId): void

investInfrastructure(
  colonyId: ColonyId,
  domain: InfraDomain,
  currentBP: BPAmount,
  deposits: Deposit[]
): InvestPlanetResult
// Calls engine investPlanet(), writes result, returns result to caller.
// Caller must deduct bpSpent from budget store.

initializeTerraNova(sectorId: SectorId): void
// Called once at game start. Creates Terra Nova planet + colony from start-conditions.ts.
```

---

### `contract.store.ts`

```typescript
// State
contracts: Ref<Map<ContractId, Contract>>

// Getters
activeContracts: ComputedRef<Contract[]>
completedContracts: ComputedRef<Contract[]>   // sorted most-recent first
failedContracts: ComputedRef<Contract[]>
totalContractExpenses: ComputedRef<number>    // sum of bpPerTurn for all active contracts
getContract(id: ContractId): Contract | undefined
contractsByColony(colonyId: ColonyId): Contract[]
contractsByCorp(corpId: CorpId): Contract[]

// Actions
addContract(params: CreateContractParams): ContractCreationResult
// Calls engine createContract(), adds to store, registers expense in budget store.

cancelContract(id: ContractId): void
// Marks contract as Failed, removes expense from budget store.
```

---

### `budget.store.ts`

```typescript
// State
currentBP: Ref<number>
incomeSources: Ref<IncomeSource[]>
expenseEntries: Ref<ExpenseEntry[]>
debtTokens: Ref<number>

// Getters
totalIncome: ComputedRef<number>
totalExpenses: ComputedRef<number>
netBP: ComputedRef<number>                  // income - expenses (negative = deficit)
stabilityMalus: ComputedRef<number>         // floor(debtTokens / 2) — applied to colony stability

// Actions
initialize(): void                          // called once at game start, sets BP to STARTING_BP (10)
addIncome(source: IncomeSource): void
addExpense(entry: ExpenseEntry): void
deductBP(amount: BPAmount): void            // immediate deduction (e.g., invest action)
recalculate(): void                         // re-sums income/expenses from colonies + corps
$patch({ currentBP, debtTokens, ... })      // used by game.store after turn distribution
```

---

### `corporation.store.ts`

```typescript
// State
corporations: Ref<Map<CorpId, Corporation>>

// Getters
activeCorporations: ComputedRef<Corporation[]>
getCorporation(id: CorpId): Corporation | undefined
getCorporationsByType(type: CorpType): Corporation[]
getCorpsOnColony(colonyId: ColonyId): Corporation[]   // corps with infra on that colony

// Actions
addCorporation(corp: Corporation): void
updateCorporation(corp: Corporation): void
```

---

### `galaxy.store.ts`

```typescript
// State
sectors: Ref<Map<SectorId, Sector>>
adjacency: Ref<Map<SectorId, SectorId[]>>
startingSectorId: Ref<SectorId | null>

// Getters
getSector(id: SectorId): Sector | undefined
getAdjacentSectors(id: SectorId): Sector[]
exploredSectors: ComputedRef<Sector[]>
unexploredSectors: ComputedRef<Sector[]>

// Actions
generate(): void                            // procedural galaxy generation, sets startingSectorId
updateSector(sector: Sector): void
```

---

### `planet.store.ts`

```typescript
// State
planets: Ref<Map<PlanetId, Planet>>

// Getters
getPlanet(id: PlanetId): Planet | undefined
getPlanetsByStatus(status: PlanetStatus): Planet[]
getDepositsForPlanet(id: PlanetId): Deposit[]       // convenience: planet.deposits

// Actions
addPlanet(planet: Planet): void
updatePlanet(planet: Planet): void
```

---

### `market.store.ts`

```typescript
// State
sectorMarkets: Ref<Map<SectorId, SectorMarketState>>

// Getters
getMarket(sectorId: SectorId): SectorMarketState | undefined
getSurplusResources(sectorId: SectorId): ResourceType[]
getShortageResources(sectorId: SectorId): ResourceType[]

// Actions
$patch({ sectorMarkets })                   // used by game.store after turn distribution
```

---

### `science.store.ts`

```typescript
// State
scienceDomains: Ref<Map<string, ScienceDomainState>>
discoveries: Ref<Map<DiscoveryId, Discovery>>
schematics: Ref<Map<SchematicId, Schematic>>
patents: Ref<Map<PatentId, Patent>>
empireBonuses: Ref<EmpireBonuses>

// Getters
getDomain(type: ScienceSectorType): ScienceDomainState | undefined
allDiscoveries: ComputedRef<Discovery[]>
discoveriesByDomain(type: ScienceSectorType): Discovery[]

// Actions
updateScienceDomains(domains: Map<string, ScienceDomainState>): void
updateEmpireBonuses(bonuses: EmpireBonuses): void
addDiscovery(discovery: Discovery): void
updateSchematic(schematic: Schematic): void
addPatent(patent: Patent): void
```

---

### `fleet.store.ts`

```typescript
// State
ships: Ref<Map<ShipId, Ship>>

// Getters
getShip(id: ShipId): Ship | undefined
availableShips: ComputedRef<Ship[]>         // status === Stationed
shipsOnMission: ComputedRef<Ship[]>
getShipsByRole(role: ShipRole): Ship[]

// Actions
addShip(ship: Ship): void
updateShips(ships: Map<string, Ship>): void // bulk update after turn or mission creation
```

---

### `mission.store.ts`

```typescript
// State
missions: Ref<Map<MissionId, Mission>>

// Getters
activeMissions: ComputedRef<Mission[]>
completedMissions: ComputedRef<Mission[]>
getMission(id: MissionId): Mission | undefined

// Actions
addMission(
  params: { missionType: MissionType; targetSectorId: SectorId; shipIds: string[] },
  state: GameState
): CreateMissionResult
// Calls engine createMission(), writes mission, updates ship statuses.

updateMissions(missions: Map<string, Mission>): void   // bulk update after turn distribution
```

---

### `event.store.ts`

```typescript
// State
events: Ref<GameEvent[]>                    // full history (capped at last 50 turns)
currentTurnEvents: Ref<GameEvent[]>         // events from the most recent turn

// Getters
eventsByPriority(priority: EventPriority): GameEvent[]
recentEvents(n: number): GameEvent[]

// Actions
addEvents(events: GameEvent[], turn: TurnNumber): void
loadEvents(events: GameEvent[], turn: TurnNumber): void  // called on game load
resetEvents(): void                                       // called on new game
```

---

## Composables (`composables/`)

Vue composition functions. Call stores. Return reactive state + action functions. Used only by views and components.

---

### `useTurnActions.ts`

```typescript
// Returns
{
  canEndTurn: ComputedRef<boolean>        // false while resolving
  endTurn(): void                         // calls gameStore.endTurn()
  currentTurn: ComputedRef<TurnNumber>
  gamePhase: ComputedRef<GamePhase>
}
```

---

### `useContractCreation.ts`

Multi-step wizard (4 steps) for contract creation. Manages form state across steps.

```typescript
// Returns
{
  step: Ref<1 | 2 | 3 | 4>
  selectedType: Ref<ContractType | null>
  selectedCorpId: Ref<CorpId | null>
  selectedTarget: Ref<ContractTarget | null>
  colonizationParams: Ref<ColonizationParams | null>
  shipCommissionParams: Ref<ShipCommissionParams | null>

  canProceed: ComputedRef<boolean>        // validates current step
  availableCorps: ComputedRef<Corporation[]>  // eligible corps for selected type
  estimatedCost: ComputedRef<number>      // live cost preview

  nextStep(): void
  prevStep(): void
  reset(): void
  submitContract(): ContractCreationResult
}
```

---

### `useMissionCreation.ts`

```typescript
// Returns
{
  selectedShipIds: Ref<string[]>
  targetSectorId: Ref<SectorId | null>
  missionType: Ref<MissionType | null>

  availableShips: ComputedRef<Ship[]>     // Stationed, government-owned
  estimatedCost: ComputedRef<number>
  canSubmit: ComputedRef<boolean>

  toggleShip(shipId: string): void
  submitMission(): CreateMissionResult
  reset(): void
}
```

---

### `useBudgetDisplay.ts`

```typescript
// Returns
{
  currentBP: ComputedRef<number>
  netBP: ComputedRef<number>
  totalIncome: ComputedRef<number>
  totalExpenses: ComputedRef<number>
  debtTokens: ComputedRef<number>
  stabilityMalus: ComputedRef<number>
  incomeSources: ComputedRef<IncomeSource[]>
  expenseEntries: ComputedRef<ExpenseEntry[]>
  formattedBP: ComputedRef<string>        // e.g., "+5 BP"
}
```

---

### `useSaveLoad.ts`

```typescript
// Returns
{
  saveSlots: ComputedRef<SaveSlot[]>      // metadata for all saved slots
  autosave(state: GameState): void
  saveToSlot(slot: number, state: GameState): void
  loadFromSlot(slot: number): GameState | null
  exportToFile(state: GameState): void    // triggers browser download
  importFromFile(file: File): Promise<GameState>
}
```

---

### `useNotifications.ts`

```typescript
// Returns
{
  recentEvents: ComputedRef<GameEvent[]>
  criticalEvents: ComputedRef<GameEvent[]>
  unreadCount: ComputedRef<number>
  markAllRead(): void
}
```

---

## Engine — Simulation Subsystems (`engine/simulation/`)

Called by turn phases — not directly by stores. Each is a large pure module.

| Function | File | Called by | Description |
|---|---|---|---|
| `resolveMarket(state, sectorId)` | `market-resolver.ts` | `market-phase.ts` | 5-phase sector market: production → consumption → surplus pool → deficit purchase → shortage |
| `calculateColonyAttributes(colony, state)` | `colony-sim.ts` | `colony-phase.ts` | Full attribute recalculation for one colony |
| `tickColonyGrowth(colony, state)` | `colony-sim.ts` | `colony-phase.ts` | Growth accumulator tick, population level transitions |
| `runCorpAI(corp, state)` | `corp-ai.ts` | `corp-phase.ts` | Corp scans deficits, selects eligible colony, buys infrastructure |
| `resolveScience(state)` | `science-sim.ts` | `science-phase.ts` | Advances science domains, rolls discovery chance, generates schematics/patents |
| `resolveCombat(mission, state)` | `combat-resolver.ts` | `mission-phase.ts` | Prototype combat: Fight score vs difficulty, captain modifier, condition degradation |

---

## Generators (`generators/`)

Called at game start and on entity creation. All are pure; pass a `seed` for deterministic output.

| Function | File | Returns |
|---|---|---|
| `generateGalaxy(seed?)` | `galaxy-generator.ts` | `Galaxy` (sectors + adjacency graph) |
| `generateSector(opts)` | `sector-generator.ts` | `Sector` |
| `generatePlanet(sectorId, seed?)` | `planet-generator.ts` | `Planet` (type, size, features, deposits) |
| `generateColony(planet, sectorId, type, turn)` | `colony-generator.ts` | `Colony` with starting infra + modifiers from features |
| `generateCorporation(opts)` | `corp-generator.ts` | `Corporation` (name, type, personality, level 1) |
| `generateCaptain(opts?)` | `captain-generator.ts` | `Captain` (name, experience: Green) |
| `generateShip(blueprint, corp, empireBonuses)` | `ship-generator.ts` | `Ship` with stats from role + corp + schematics |
| `generateSchematic(discovery, corp)` | `schematic-generator.ts` | `Schematic` |
| `generatePatent(discovery, corp)` | `patent-generator.ts` | `Patent` |

---

## Utilities (`utils/`)

| Function | File | Description |
|---|---|---|
| `generateColonyId()` / `generateCorpId()` / etc. | `id.ts` | Creates prefixed nanoid strings (`col_`, `corp_`, etc.) |
| `serializeGameState(state)` | `save.ts` | `GameState` → JSON string. Converts Maps to Records. |
| `deserializeGameState(json)` | `save.ts` | JSON string → `GameState`. Restores Maps. Throws on version mismatch. |
| `randomInt(min, max)` | `random.ts` | Inclusive integer random |
| `weightedRandom(options)` | `random.ts` | Picks from weighted option array |
| `seededRandom(seed)` | `random.ts` | Returns deterministic `() => number` function |
| `clamp(value, min, max)` | `math.ts` | Numeric clamp |
| `formatBP(amount)` | `format.ts` | `12 → "+12 BP"` |
| `formatPercent(value)` | `format.ts` | `0.75 → "75%"` |

---

## Key Constants

| Constant | File | Value | Meaning |
|---|---|---|---|
| `INVEST_COST_BP` | `invest-planet.ts` | 3 | BP cost for +1 public infra level |
| `MEGACORP_LEVEL` | `create-contract.ts` | 6 | Level at which a corp can take any contract |
| `CROSS_TYPE_MIN_LEVEL` | `create-contract.ts` | 3 | Level at which a corp can take cross-type contracts |
| `SURCHARGE_SIZE_THRESHOLD` | `create-mission.ts` | 7 | Ship size >= this adds +1 BP/turn fleet surcharge |
| `STARTING_BP` | `start-conditions.ts` | 10 | Initial BP at game start |
| `MAX_DEBT_TOKENS` | `start-conditions.ts` | 10 | Debt token cap before game over |
| `DEBT_TOKEN_CLEAR_COST_BP` | `start-conditions.ts` | 1 | BP deducted per debt token cleared per turn |
| `SAVE_VERSION` | `save.ts` | 1 | Save file format version |

---

## Type Quick Reference

| Type | File | What it is |
|---|---|---|
| `GameState` | `types/game.ts` | Master state object. Passed to `resolveTurn()`, assembled by `getFullGameState()`. |
| `PhaseResult` | `types/game.ts` | `{ updatedState: GameState, events: GameEvent[] }` — returned by every turn phase. |
| `TurnResult` | `turn-resolver.ts` | `{ updatedState, events, completedTurn }` — returned by `resolveTurn()`. |
| `Colony` | `types/colony.ts` | A colonized planet. Holds infra, attributes, population, modifiers. |
| `Corporation` | `types/corporation.ts` | An autonomous company. Holds level, capital, assets, type, personality. |
| `Contract` | `types/contract.ts` | An active engagement. Holds type, target, corp, cost/turn, turns remaining. |
| `Modifier` | `types/modifier.ts` | Per-entity stat adjustment. Has target, operation (add/multiply), value, optional condition. |
| `EmpireBonuses` | `types/empire.ts` | Global cumulative bonuses from discoveries. Applied uniformly, not through modifier system. |
| `GameEvent` | `types/event.ts` | A log entry from turn resolution. Has priority, message, turn, category. |
| `SaveFile` | `utils/save.ts` | `{ version, timestamp, gameState }` — the on-disk format. |
