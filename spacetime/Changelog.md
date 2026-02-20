# Spacetime — Changelog

---

## Story 16.2: Combat Resolver (2026-02-20)

**Files**: `src/engine/formulas/combat.ts` (new), `src/engine/simulation/combat-resolver.ts` (new), `src/__tests__/engine/simulation/combat-resolver.test.ts` (new)

### Functions implemented

- `applyCommanderModifier(fightScore, experience)` — Applies captain experience multiplier to raw Fight score (`floor(fight × modifier)`).
- `resolveCombatRoll(effectiveFight, difficulty, roll)` — Returns true (victory) if `effectiveFight × variance > difficulty` where variance = `random(0.85, 1.15)`.
- `sampleWinConditionLoss(roll)` — Samples condition loss fraction for winners: `[0.05, 0.20]`.
- `sampleLoseConditionLoss(roll)` — Samples condition loss fraction for losers: `[0.30, 0.60]`.
- `applyConditionDamage(currentCondition, lossFraction)` — Returns new condition, rounded, clamped to `[0, 100]`.
- `resolveCombat(input)` — Main resolver: sums task force Fight scores, applies commander modifier, calculates difficulty from mission type base × sector `threatModifier`, rolls outcome, applies per-ship condition deltas, marks ships destroyed at condition 0.

### Algorithm

1. Sum all ship `abilities.fight` scores in the task force.
2. Apply commander experience modifier (`Green ×0.8 / Regular ×1.0 / Veteran ×1.1 / Elite ×1.2`).
3. Compute difficulty: `MISSION_BASE_DIFFICULTY[type] × sector.threatModifier`.
4. Roll: win if `effectiveFight × random(0.85, 1.15) > difficulty`.
5. Per ship: sample condition loss from win range (5–20%) or loss range (30–60%).
6. Ships with `conditionAfter ≤ 0` are marked `destroyed: true`.
7. Returns `CombatResult` with `outcome`, `shipOutcomes`, `narrative`, and empty `rounds` (post-prototype placeholder).

### Mission base difficulty values

| Type          | Base Difficulty |
|---------------|----------------|
| Escort        | 10              |
| Assault       | 20              |
| Defense       | 15              |
| Rescue        | 12              |
| Investigation | 8               |

### Key decisions

- `rounds: []` returned as a placeholder — full per-round exchange data is post-prototype (Epic 20).
- `disabledAndRecovered: false` on all `ShipCombatOutcome` — post-prototype feature.
- `randFn` injectable throughout for deterministic testing.
- Uses existing `CombatResult` and `ShipCombatOutcome` types from `src/types/combat.ts` unchanged.

### Acceptance criteria met

- Receives task force Fight score and mission difficulty (type × threat modifier) ✓
- Win if `Fight × random(0.85, 1.15) > difficulty` ✓
- Captain combat modifier applied to Fight score ✓
- Winning task force: 5–20% condition loss per ship ✓
- Losing task force: 30–60% condition loss per ship ✓
- Ship destroyed when condition reaches 0% ✓
- Returns `CombatResult` with win/loss, per-ship condition deltas, destroyed ship IDs, narrative ✓
- Unit tests: win/loss calculation ✓, captain modifier ✓, condition delta ranges ✓, ship destruction at 0% ✓

**Tests**: 12/12 passing (combat-resolver.test.ts)

---

## Story 16.1: Mission Creation (2026-02-20)

**Files**: `src/engine/actions/create-mission.ts` (new), `src/__tests__/engine/actions/create-mission.test.ts` (new)

### Functions implemented

- `createMission(params, state, randFn?)` — Pure function that validates and creates a `Mission` object:
  1. **Validation**: rejects empty ship list, missing sector, unknown ship IDs, non-Stationed ships, and corp-owned ships (must be `'government'`).
  2. **Travel time**: BFS on `galaxy.adjacency` to find the shortest hop count between the task force's home sector and the target sector. `travelTurnsRemaining = returnTurnsRemaining = hopCount`.
  3. **Execution duration**: sampled from each mission type's `[min, max]` range (injectable `randFn` for deterministic tests).
  4. **Cost**: `baseBPPerTurn[type] + count(ships where size ≥ 7)` — fleet surcharge per large ship.
  5. **Commander**: highest-experience captain across all task force ships. Ties broken by first occurrence.
  6. **Ship status**: returns a new `updatedShips` map with all task force ships set to `OnMission`. Does not mutate `state.ships`.
  7. Returns `{ success: true, mission, updatedShips }` or `{ success: false, error }`.

- Error codes: `NO_SHIPS_SELECTED`, `SHIP_NOT_FOUND`, `SHIP_NOT_AVAILABLE`, `SHIP_NOT_GOVERNMENT`, `SECTOR_NOT_FOUND`, `NO_HOME_SECTOR`.

### Mission data (from Data.md § 15)

| Type          | Base BP/turn | Duration range |
|---------------|-------------|----------------|
| Escort        | 1           | 1              |
| Assault       | 3           | 3–8            |
| Defense       | 2           | 1–3            |
| Rescue        | 2           | 2–5            |
| Investigation | 1           | 2–4            |

### Key decisions

- Travel time is computed via BFS on the adjacency graph rather than a flat hop count, supporting multi-hop routes correctly.
- The surcharge threshold (size ≥ 7) matches Data.md's definition of large ships requiring extended logistics.
- `randFn` injectable for all tests — execution duration is fully deterministic in test context.

### Acceptance criteria met

- Player selects mission type, target sector, and ships for task force ✓
- Highest-experience captain becomes commander ✓
- Validates all ships are Stationed and government-owned ✓
- Calculates travel time (sector hops × 1 turn per hop) ✓
- Calculates execution duration from Data.md mission durations ✓
- Calculates total BP/turn cost (base + fleet surcharge ≥ size 7) ✓
- Returns typed Mission object or validation error ✓
- Ships status set to OnMission on creation ✓
- Unit tests: valid creation ✓, ship already on mission rejected ✓, non-owned ship rejected ✓, cost calculation with and without surcharge ✓, commander selection by experience ✓

**Tests**: 20/20 passing (create-mission.test.ts)
**TypeScript**: zero errors

---

## Story 15.4: Fleet Store & View (2026-02-20)

**Files**: `src/stores/fleet.store.ts` (new), `src/views/FleetView.vue` (updated), `src/components/fleet/ShipCard.vue` (new), `src/stores/game.store.ts` (updated)

### Store implemented

- `useFleetStore` — holds all commissioned ships (`Map<ShipId, Ship>`) and a `memorial` map of destroyed ships' `ServiceRecord`.
- `addShip(ship)` — registers a completed ship in the fleet.
- `removeShip(id)` — destroys a ship, preserving its `ServiceRecord` in the memorial before deletion.
- `updateShips(map)` — bulk-replaces ship state after turn resolution (called by `game.store._distributeResults`).
- `getShip(id)` — O(1) lookup.
- `getShipsBySector(sectorId)` — filters by `homeSectorId`.
- `getShipsByStatus(status)` — filters by `ShipStatus`.
- `availableShips` (computed) — stationed ships (not on mission), eligible for new missions.

### game.store.ts wired

- `getFullGameState()` now reads `fleetStore.ships` instead of passing an empty `Map`.
- `_distributeResults()` calls `fleetStore.updateShips(state.ships)` after each turn resolution, so ships completed by `contract-phase` appear in the fleet UI immediately.

### ShipCard.vue

- Compact summary card: name · role · size label, captain name + experience badge (color-coded).
- Six stat bars (Size/Speed/Firepower/Armor/Sensors/Evasion): value, bar fill (capped at 15), color-coded Poor→Average→Good→Excellent→Exceptional labels.
- Ability scores row: Fight (red), Investigation (sky), Support (emerald), schematic count.
- Condition bar: color-coded green/amber/red, percentage shown.
- Status badge: Stationed/On Mission/Under Repair/Under Construction.
- Expandable detail panel: full stat breakdown, derived stats (HP/PP/BP/build time), schematics list, captain service record (missions/battles/experience), build turn and owning corp.

### FleetView.vue

- Ships grouped by sector with section headers.
- "Under Construction" section shows active `ShipCommission` contracts as `ContractCard` components.
- Summary bar: total ships, available count, under-construction count.
- "Commission Ship" button opens `ContractWizard` pre-filled with `ShipCommission` type.
- Empty state with full guidance text (matches acceptance criteria spec exactly).

### Acceptance criteria met

- Store holds ships by ID, `getShip`, `getShipsBySector`, `getShipsByStatus`, `availableShips` ✓
- `addShip` / `removeShip` (preserves service record in memorial) ✓
- View: ships grouped by sector with status indicators, ship commission contracts in progress ✓
- Ship card: name, role, size with label, stat bars with labels, ability scores, captain name + experience, condition bar, status, schematics applied ✓
- Ship detail (expanded): full stat breakdown, schematics list, captain service record, build turn, owning corp ✓
- "Commission Ship" button leads to contract creation (ShipCommission pre-fill) ✓
- Empty state with spec-matching guidance text ✓

**Tests**: 27/27 game.store.test.ts passing (no regressions)
**TypeScript**: zero errors

---

## Story 15.3: Captain Generator (2026-02-20)

**Files**: `src/generators/captain-generator.ts` (new), `src/data/captain-names.ts` (new), `src/engine/actions/design-blueprint.ts` (updated), `src/__tests__/generators/captain-generator.test.ts` (new)

### Functions implemented

- `generateCaptain(randFn?)` — Generates a new Captain with a random "FirstName LastName" from sci-fi/naval name pools, starting at `Green` experience, 0 missions, 0 battles, and a unique `cpt_`-prefixed ID.
- `getExperienceLevel(missionsCompleted)` — Pure function deriving experience tier from mission count:
  - 0–1 → `Green` (×0.8)
  - 2–4 → `Regular` (×1.0)
  - 5–9 → `Veteran` (×1.1)
  - 10+ → `Elite` (×1.2)

### Key decisions

- Name pools live in `src/data/captain-names.ts` (48 first names, 49 last names) — multicultural, naval-sci-fi blend.
- `randFn` injectable for deterministic testing (same pattern as blueprint/schematic generators).
- `design-blueprint.ts` now calls `generateCaptain(randFn)` instead of the hardcoded `'Unassigned'` placeholder. The same `randFn` is threaded through so tests remain deterministic.
- `getExperienceLevel` is exported for direct unit testing and future use in mission resolution (Story 16.3).

### Acceptance criteria met

- Generates unique name from name pools ✓
- Starts at Green experience (×0.8 combat modifier) ✓
- Experience tracks missions completed (2 → Regular, 5 → Veteran, 10 → Elite) ✓
- Returns typed Captain object ✓
- Unit tests: name generation ✓, default experience level ✓, experience progression thresholds ✓

**Tests**: 17/17 passing (captain-generator.test.ts) + 18/18 story-15-2-ship-commission (no regressions)
**TypeScript**: zero errors

---

## Story 15.2: Ship Construction (2026-02-20)

**Files**: `src/engine/actions/create-contract.ts` (updated), `src/engine/turn/contract-phase.ts` (updated), `src/__tests__/engine/story-15-2-ship-commission.test.ts` (new)

### Functions implemented / updated

- `createContract` — ShipCommission validation now:
  - Checks `required_space_infra = floor(role_base_size × size_variant_multiplier)` against colony's SpaceIndustry total levels.
  - Returns `INSUFFICIENT_SPACE_INFRA` error if colony falls short.
  - Computes `bpPerTurn` deterministically from role + variant + corp level (random=1.0 midpoint, no schematics at creation time).
  - Computes `durationTurns` as `max(1, floor(buildTimeTurns × (1 - corp_level × 0.05)))`.

- `resolveShipCommissionCompletion()` — New completion handler in `contract-phase.ts`:
  1. Looks up the target colony and assigned corp.
  2. Calls `designBlueprint()` with the contract's role/variant, corp schematics, and empire tech bonuses.
  3. Sets ship status to `Stationed` at the colony's sector.
  4. Adds ship to `updatedShips` map returned in phase result.
  5. Emits a `fleet`-category `Positive` event.

- `resolveContractPhase` — now copies and returns `state.ships` (previously passed through unchanged).

### Key decisions

- `bpPerTurn` and `durationTurns` at contract creation are deterministic estimates (random=1.0, no schematics). The actual ship built on completion varies due to randomness and uses the corp's real schematics.
- `actual_build_time = max(1, floor(base_build_time × (1 - corp_level × 0.05)))` reduces build time linearly, capped at 50% reduction at level 10.
- Ship name defaults to `"{corp.name} Vessel"` — Story 15.3 (Captain Generator) will provide a proper name.
- `ShipStatus.Stationed` is set at completion; no fleet store exists yet (Story 15.4).

### Acceptance criteria met

- Space infra requirement validated per role and variant ✓
- Build time reduction across corp levels 1–10 ✓
- Cost (bp_per_turn) scales with role and size variant ✓
- Ship object correctness on completion (role, variant, status, homeSectorId) ✓
- Ship added to `state.ships` on contract completion ✓
- Building corp receives completion bonus per normal contract rules ✓

**Tests**: 18/18 passing (story-15-2-ship-commission.test.ts) + 38/38 contract-phase.test.ts (no regressions)
**TypeScript**: zero errors

---

## Story 14.4: Science Phase — Turn Resolution (2026-02-19)

**Files**: `src/engine/turn/science-phase.ts` (full implementation), `src/generators/patent-generator.ts` (new)

### Functions implemented

- `resolveSciencePhase(state)` — Phase #6 of turn resolution. Full pipeline:
  1. `calculateEmpireSciencePerTurn` — sums all science infra levels.
  2. `distributeScience` — distributes points across 9 domains with focus doubling; checks level-up thresholds.
  3. On domain level-up: calls `updateSchematicsOnDomainLevelUp` for affected categories; versioned schematics written back to state.
  4. Discovery rolls — iterates Science corps; calls `rollForDiscovery`; accumulates updated empire bonuses and discovered definition IDs across corps.
  5. Schematic rolls — iterates Shipbuilding corps; calls `rollForSchematic`; handles replacements.
  6. Patent rolls — iterates all corps; calls `rollForPatent`; enforces cap.
  7. Returns `{ updatedState, events }` with all events combined.

- `calculatePatentChance(corpLevel)` — `corp_level × 2 %`.
- `getMaxPatents(corpLevel)` — `floor(corp_level / 2)`.
- `rollForPatent(corp, existingPatents, sourceDiscoveryId, turn, randFn?)` — rolls for patent development; respects cap, avoids duplicate bonus targets; creates `Patent` object with correct bonus from `PATENT_DEFINITIONS`.

### Key decisions

- Discovery rolls are sequential; each successful discovery updates `alreadyDiscoveredDefinitionIds` so the next corp cannot draw the same definition this turn.
- Schematic versioning runs before discovery/schematic rolls so new schematics generated this turn are at the latest domain level.
- Patent generator deduplicates by `bonusTarget` to prevent corps from holding duplicate-effect patents.

### Acceptance criteria met

- Science accumulation per domain (respecting focus doubling) ✓
- Domain level-up triggers schematic versioning for affected categories ✓
- Discovery rolls for all science corps (`discovery_chance = corp_level × 5 + corp_science_infrastructure × 2 %`) ✓
- Schematic development rolls for shipbuilding corps (`schematic_chance = corp_level × 2 %`, capped at `floor(corp_level / 2)`) ✓
- Patent development rolls for all corps (`patent_chance = corp_level × 2 %`, capped at `floor(corp_level / 2)`) ✓
- Returns updated science state + events (level-up, schematic versioning, discovery, schematic, patent events) ✓

**Tests**: 18/18 passing (science-phase.test.ts)
**TypeScript**: zero errors

---

## Story 14.2: Discovery System (2026-02-19)

**File**: `src/engine/simulation/science-sim.ts` (extended), `src/types/science.ts`

### Functions implemented

- `getCorporationScienceInfra(corp)`: sums all Science infrastructure levels a corp holds across all colonies.
- `calculateDiscoveryChance(corpLevel, corpScienceInfra, focused)`: returns `(corpLevel × 5) + (corpScienceInfra × 2)`, doubled if the drawn domain is focused.
- `getAvailableDiscoveries(scienceDomains, alreadyDiscoveredDefinitionIds)`: filters `DISCOVERY_DEFINITIONS` to those whose domain is at or above `poolLevel` and whose `definitionId` has not yet been discovered empire-wide.
- `applyDiscoveryEffects(def, empireBonuses)`: increments the `EmpireBonuses` fields specified in `def.empireBonusEffects` (key format `"shipStats.speed"`, `"infraCaps.maxMining"`). Returns a new object; does not mutate.
- `rollForDiscovery(corp, scienceDomains, alreadyDiscoveredDefinitionIds, empireBonuses, turn, randFn?)`: full discovery roll — picks a random available definition, checks focus for that domain, rolls against `discoveryChance`. On success: creates a `Discovery`, applies effects to `empireBonuses`, updates `scienceDomains.discoveredIds` and `unlockedSchematicCategories`, generates a `Positive` science event.
- `DiscoveryRollResult` interface: `{ discovery, updatedEmpireBonuses, updatedScienceDomains, events }`.

### Type changes

- `Discovery` (in `src/types/science.ts`): added `sourceDefinitionId: string` for pool exhaustion tracking.

### Key decisions

- `randFn` injectable parameter enables deterministic testing without seeded utilities.
- Pool exhaustion tracked via `alreadyDiscoveredDefinitionIds: string[]` — the caller (science-phase) maintains this list from `GameState.discoveries`.
- Focus bonus is applied to the *drawn definition's* domain, consistent with the spec wording "if the drawn domain is focused".
- `unlockedSchematicCategories` on `ScienceDomainState` is updated deduped via `Set`.

### Acceptance criteria met

- `discovery_chance = (corp_level × 5) + (corp_science_infrastructure × 2)` ✓
- Focus bonus doubles discovery chance for focused domain ✓
- Draws random undiscovered item from available pools (domains at level 1+) ✓
- Discovery is permanent and empire-wide (applied to `empireBonuses` directly) ✓
- Generates discovery event with name and description ✓
- Directly increments `gameState.empireBonuses` ship stat values ✓
- Pool exhaustion: no further discoveries once all definitions at a level are drawn ✓
- Unit tests: discovery chance (with/without focus) ✓, pool exhaustion ✓, no available discoveries ✓, empireBonuses persist across turns ✓

**Tests**: 55/55 passing (27 Story 14.1 + 28 Story 14.2)
**TypeScript**: zero errors

---

## Story 14.1: Science Simulation (2026-02-19)

**File**: `src/engine/simulation/science-sim.ts`

### Functions implemented

- `calculateEmpireSciencePerTurn(colonies)`: sums all science infrastructure levels (public + corporate) across all colonies.
- `distributeScience(domains, empireScience, turn)`: distributes science points evenly across 9 domains (`floor(total / 9)` per domain), doubles allocation for the focused domain, accumulates points, and checks level-up thresholds (`(current_level + 1) × 15`). Supports multiple level-ups per turn with point carry-over. Returns updated domain states + level-up events.
- `createInitialScienceDomains()`: creates all 9 domains at level 0 with threshold 15 for game initialization.
- `setDomainFocus(domains, domain | null)`: sets focus on one domain (or clears all). Only one domain may be focused at a time.

### Key decisions

- Threshold formula uses `(level + 1) × 15` (from `getScienceLevelThreshold`), matching Specs.md § 8 and `science-sectors.ts`. Level 0 → 1 requires 15 points; level 1 → 2 requires 30.
- Focus is a boolean on `ScienceDomainState`; `setDomainFocus` ensures mutual exclusivity.
- Level-up events are `Positive` priority, `science` category.

### Acceptance criteria met

- `empire_science_per_turn = sum of all science infrastructure levels` ✓
- Distributes evenly: `per_domain_base = floor(empire_science / 9)` ✓
- Focus doubles allocation ✓
- Only one domain focused at a time ✓
- Accumulates points, checks threshold `(level+1) × 15` ✓
- On level up: increments level, generates event ✓
- Unit tests: accumulation ✓, level up at threshold ✓, distribution with and without focus ✓, focus doubling effect ✓

**Tests**: 27/27 passing
**TypeScript**: zero errors

---

## Story 13.5: Exploration UI (2026-02-19)

**Files**: `src/components/galaxy/SectorCard.vue`, `src/views/GalaxyView.vue`, `src/components/contract/ContractWizard.vue`

### SectorCard.vue
- Added `planets: Planet[]` prop — list of visible (non-rejected, non-colonized) planets in the sector.
- Emits `explore(sectorId)`, `accept-planet(planetId)`, `reject-planet(planetId)`.
- **Explore button**: shown on explorable/present sectors; triggers contract wizard pre-filled with Exploration + the sector.
- **Planet count badge**: shown in header when planets are discovered in the sector.
- **Planets panel**: listed inside expanded detail under "Discovered Planets".
  - Each planet card shows: name, status badge (Orbit Scanned / Ground Surveyed / Accepted), type, size.
  - **Orbit Scanned**: reveals deposit types (richness hidden), orbit-visible features; "Low-quality scan" message if nothing revealed (tier-1 corp).
  - **Ground Surveyed / Accepted**: reveals deposits with richness, all revealed features, exact habitability.
  - **Accept/Reject buttons**: shown on OrbitScanned and GroundSurveyed planets; hidden once Accepted.

### GalaxyView.vue
- Imports `usePlanetStore`, `ContractWizard`, `acceptPlanet`/`rejectPlanet` engine actions.
- `getPlanetsForSector(sectorId)`: returns non-rejected, non-colonized, non-undiscovered planets per sector.
- `openExploreWizard(sectorId)`: sets `presetType = Exploration`, `presetSectorId`, opens wizard modal.
- `handleAcceptPlanet` / `handleRejectPlanet`: call engine actions then `planetStore.updatePlanet()`.
- Summary bar now includes "N planets discovered" count.

### ContractWizard.vue
- Added optional props: `presetType?: ContractType | null`, `presetSectorId?: SectorId | null`.
- `onMounted`: if `presetType` is set, calls `wizard.selectType()` and (for Exploration) `wizard.selectTarget()` then advances to step 2.

**TypeScript**: zero errors
**Tests**: 67 passing (exploration: 14, contract-phase: 38, accept-planet: 15 — all pre-existing, no regressions)

---

## Story 13.4: Ground Survey Contract (2026-02-19)

**File**: `src/engine/turn/contract-phase.ts`

- `resolveGroundSurveyCompletion()`: enhanced to fully reveal planet data on ground survey completion:
  - Planet status advances from `OrbitScanned` → `GroundSurveyed` (was already done).
  - All features revealed (`revealed: true`), including ground-only features not visible from orbit.
  - All deposits have `richnessRevealed: true` — exact richness visible to the player.
- `groundSurveyTurn` stamped from `contract.completedTurn`.

**Tests**: 2 new tests added to `contract-phase.test.ts` (38 total, all passing):
- Ground survey reveals all features (including ground-only).
- Ground survey reveals exact deposit richness for all deposits.
**TypeScript**: zero errors

---

## Story 13.3: Accept/Reject Planet Action (2026-02-19)

**File**: `src/engine/actions/accept-planet.ts`

- `acceptPlanet(planetId, planets)`: validates planet is `OrbitScanned` or `GroundSurveyed`, returns updated planet with `Accepted` status.
- `rejectPlanet(planetId, planets)`: same validation, returns updated planet with `Rejected` status; planet available for future independent corp settlement.
- `AcceptPlanetError`: `PLANET_NOT_FOUND` | `INVALID_STATUS`
- Both functions are pure with no side effects; caller (store) applies the updated planet.

**Tests**: 15/15 passing — accept/reject from both valid statuses, field preservation, PLANET_NOT_FOUND, INVALID_STATUS for Undiscovered/Accepted/Rejected/Colonized.
**TypeScript**: zero errors

---

## Story 13.2: Exploration Contract Completion (2026-02-19)

**File**: `src/engine/turn/contract-phase.ts`

- `resolveExplorationCompletion()`: Wired into `applyCompletionEffects` for `ContractType.Exploration`.
  1. Adds `calculateExplorationGain()` (random 5–15%) to the target sector's `explorationPercent`, capped at 100.
  2. Generates `calculatePOICount()` (2–4) new planets via `generatePlanet()` with `initialStatus: OrbitScanned`.
  3. Applies `generateOrbitScan(planet, corpLevel)` to mark orbit-visible features as `revealed` based on the assigned corp's level tier.
  4. Sets `orbitScanTurn` on each generated planet to the current turn.
  5. Emits one `exploration`-category `Positive`-priority discovery event per planet.
- `resolveContractPhase` now also returns updated `galaxy.sectors` in `updatedState`.
- Unit tests: 12 new tests (36 total, all passing) covering:
  - Sector exploration increases by 5–15 on completion
  - Exploration capped at 100
  - 2–4 planets generated per contract
  - All generated planets have `OrbitScanned` status and correct `sectorId`
  - `orbitScanTurn` set to current turn
  - One discovery event per planet (`exploration` category, `Positive` priority)
  - Tier-1 corp: no orbit-visible features revealed
  - Tier-2 corp: scan applied without error
  - Pre-existing planets unaffected; missing sector is a no-op
- 3 pre-existing tests updated to use `ShipCommission` (no side-effect events) to isolate contract event count from exploration discovery events.

**Tests**: 36/36 passing
**TypeScript**: zero errors

---

## Story 13.1: Exploration Engine (2026-02-19)

**File**: `src/engine/formulas/exploration.ts`

- `calculateExplorationGain()`: returns `randomInt(5, 15)` — exploration percentage gained per contract
- `calculatePOICount()`: returns `2 + weightedRandom(0:40%, 1:40%, 2:20%)` — planets discovered per contract (2-4)
- `generateOrbitScan(planet, corpLevel)`: returns `OrbitScanResult` with partial planet data based on corp level tier:
  - Tier 1 (level 1-2): planet type and size only
  - Tier 2 (level 3-6): + deposit types (not richness) + orbit-visible features
  - Tier 3 (level 7-10): + exact habitability
- `OrbitScanResult` type defined in the same file
- Unit tests: 14 passing — gain range, POI distribution over 1000 runs, scan quality by tier

---

## Playability Fixes #3 — Deposits, Growth, Corp Emergence, UI (2026-02-19)

### Bug Fixes

**1. Extraction cap now based on deposit type, not richness**
- Deposit richness no longer drives infrastructure caps. Per updated Specs.md, the cap is determined by the deposit TYPE via `DEPOSIT_DEFINITIONS[type].maxInfraBonus` (e.g., FertileGround=6, CommonOreVein=5, RichOcean=4). Richness is display-only.
- `colony-phase.ts`: Renamed `getBestDepositRichnessCap` → `getBestDepositCap`; now reads `def.maxInfraBonus` instead of `calculateExtractionCap(deposit.richness)`. Removed `calculateExtractionCap` import.
- `invest-planet.ts`: `computeEffectiveCap()` now uses `DEPOSIT_DEFINITIONS[d.type].maxInfraBonus` instead of `RICHNESS_CAPS[d.richness]`. Removed `RICHNESS_CAPS` import.
- Tests updated: `invest-planet.test.ts` (4 AT_CAP tests) and `colony-phase.test.ts` (3 extraction-cap tests) updated to use deposit-type cap terminology and correct values.

**2. Growth accumulator capped at 10**
- The growth accumulator on colonies was unclamped and could grow indefinitely. Per Specs.md § 5, max is 10.
- `colony-sim.ts` `applyGrowthTick()`: changed to `Math.min(10, colony.attributes.growth + growthPerTurn)`.
- The accumulator can still go negative — level-down triggers at −1.

**3. Organic emergence no longer Construction-only**
- After 20 turns, only Construction corps were spawning organically. Root cause: `findMostProminentPublicDomain()` iterated all `InfraDomain` values including `Civilian`. Terra Nova starts with 14 public Civilian levels, which always dominated all other domains (max 10). `Civilian → Construction` always won.
- `corp-phase.ts`: added `if (domain === InfraDomain.Civilian) continue` in the domain scan loop. Civilian has no meaningful corp type mapping for organic emergence.

**4. Corporations view — compact single-line layout**
- `CorpCard.vue` replaced with a compact single-line flex row: name · type badge (color-coded) · Lv + level · Cap + capital · Infra + total/max.
- `CorporationsView.vue`: changed list spacing from `space-y-3` to `space-y-1`.

---

## Playability Fixes #2 — Turn Loop & Start Conditions (2026-02-19)

### Bug Fixes

**1. Player no longer blocked by event acknowledgement**
- `DashboardView.vue` used `v-if="isReviewing"` to gate the Turn Events panel behind an Acknowledge button. If the player navigated away before clicking Acknowledge, the game was stuck in `reviewing` phase permanently.
- Fixed: `game.store.ts` `endTurn()` now transitions directly from `resolving` → `player_action` (skipping `reviewing`). Events are displayed as a non-blocking panel on the dashboard — the player can act immediately after turn resolution.
- `DashboardView.vue` updated: Turn Events panel shows whenever `sortedEvents.length > 0`, no Acknowledge button.
- `game.store.test.ts` updated: `endTurn()` now expects `player_action` phase, `acknowledgeResults()` is now a no-op test.

**2. BP is not a stock — unused BP no longer carries over**
- Each turn, `income-phase.ts` was adding income to the existing `currentBP` balance, causing BP to accumulate indefinitely across turns even with no expenses. Per spec: "BP not consumed are wasted."
- Fixed: `turn-resolver.ts` now resets `currentBP` to 0 before the debt/income/expense cycle. BP each turn = income − expenses. Player investments made during the player-action phase are deducted during the turn, and any unspent remainder is wiped at turn start.

**3. Terra Nova starting deposits updated to match Data.md § 17**
- `start-conditions.ts` had only 3 deposits (FertileGround Rich, CommonOreVein Moderate, RareOreVein Poor). Data.md specifies 7 deposits.
- Fixed: now includes `CommonOreVein (Moderate)`, `CarbonBasedLand (Moderate)`, `RareOreVein (Poor)`, `FertileGround (Rich)`, `FertileGround (Moderate)`, `RichOcean (Moderate)`, `GasPocket (Poor)`.

**4. High-Tech Industry missing from starting infrastructure**
- `start-conditions.ts` had no `HighTechIndustry` entry. Data.md § 17 lists it at level 1.
- Fixed: added `{ domain: InfraDomain.HighTechIndustry, publicLevels: 1 }`. With `GasPocket` now present, Gas Extraction 2 produces 2 volatiles, enabling High-Tech Industry to produce 1 High-Tech Goods per turn. Space Industry 1 now has all inputs available.

**5. Science infrastructure incorrectly marked as public — now correctly corporate-owned**
- `STARTING_INFRASTRUCTURE` had `Science: publicLevels: 1`. Data.md says Science = 2 levels, all Corp-owned (two science corps each own 1).
- Fixed: `publicLevels` set to 0 for Science in start conditions.
- Fixed: `_spawnStartingCorporations()` in `game.store.ts` now also updates the colony's `infrastructure[Science].ownership.corporateLevels` with 1 level per science corp, so `getTotalLevels()`, `getCorporateLevels()`, and the InfraPanel all display the correct 0p + 2c breakdown.
- `game.store.test.ts` now includes a test: `Terra Nova Science infra has 2 corporate levels and 0 public levels`.

**6. Low Industry raised to 8 (from 4)**
- With the corrected Low Industry level (8 from Data.md), pop 7 demands 7 Consumer Goods; 8 production gives 1 surplus. Mining 5 covers 5 of the 8 Common Materials demand; the remaining 3 come from market trade.

**Tests:** All existing tests updated to reflect new phase behavior. TypeScript: zero errors.

---

## Playability Fixes — Game Start & First Turns (2026-02-19)

### Bug Fixes

**What changed:**

**1. BP info not showing on Turn 1 — **
-  was manually initializing only the galaxy and colony stores, never calling . This meant income sources were never calculated on game start.
- Fixed by replacing the manual store initialization with a single  call, which correctly initializes all stores in order (galaxy → colony → budget → corporations).

**2. End Turn button stuck after first turn — **
- The Turn Events panel was conditionally rendered with . If a turn produced no events (or the events panel was empty), the Acknowledge button never appeared, leaving the game permanently in the  phase.
- Fixed by rendering the Turn Events panel whenever  is true regardless of event count. Shows "No notable events this turn." message when events are empty.

**3. Starting infrastructure updated to match Data.md — **
- Updated  to match the revised Data.md § 17 values:
  - Mining: 2 → 5 (enough to supply Low Industry 4 + Heavy Industry 1)
  - Deep Mining: 0 → 3 (provides Rare Materials for Heavy Industry)
  - Gas Extraction: 0 → 2 (visible; 0 production since no gas deposit on Terra Nova)
  - Agricultural: 3 → 10 (major food surplus for pop 7)
  - Low Industry: 2 → 4 (balanced with Mining 5 to avoid common material shortage)
  - HeavyIndustry: 1 → 1 (unchanged; now actually produces 1 Heavy Machinery per turn)
  - Military: 0 → 2 (stability bonus from turn 1)

**4. Gas Extraction now visible in infrastructure panel**
- Gas Extraction appears in InfraPanel because it now has 2 starting levels (total > 0 passes the display filter). Note: no gas deposit on Terra Nova means 0 volatiles produced until a gas-bearing planet is colonized.

**5. Manufacturing output at level 1 with shortage — **
-  returned  when a 1-level industry had input shortages, violating Specs.md § 6 rule "output is halved (not zero)".
- Fixed:  ensures any non-zero infrastructure always produces at least 1 unit even under shortage. Zero-level domains still return 0.
- This fixes Heavy Industry (level 1) and High-Tech Industry (level 1) each now producing 1 unit even when material inputs are partially short.

**6. Civilian infrastructure cap — , , , **
- Civilian was permanently uncapped (returned ) despite Specs.md § 6 clearly stating: "Civilian: Capped at ".
- Fixed:  now returns  for Civilian. At pop 7, cap = 16. Starting Civilian 14 is safely below cap.
-  ,  , and  all updated consistently.
- Six unit tests updated to reflect the new cap behavior (3 test files).

**Tests:** 754/754 passing
**TypeScript:** zero errors

---

## Epic 12: Turn Resolution Pipeline

### Story 12.6 — Event Phase Placeholder (2026-02-19)

**What changed:**
- `src/engine/turn/event-phase.ts` — placeholder implementation already in place from Story 12.1; verified and finalized.

**Features implemented:**

- `resolveEventPhase(state)`: accepts `GameState`, returns `{ updatedState: state, events: [] }` unchanged. No threat or event logic.
- Wired as phase #10 in `turn-resolver.ts`.
- Inline comments document future responsibilities (piracy, corp conflict, colony unrest, natural disasters, resource crises, unknown encounters).

**Acceptance criteria met:**
- Accepts game state, returns it unchanged with empty event list ✓
- Structure in place for future threat/event implementation ✓
- No actual threat logic ✓

---

### Story 12.5 — End Turn UI Flow (2026-02-19)

**What changed:**
- Created `src/composables/useTurnActions.ts` — composable encapsulating end turn button state and actions.
- Updated `src/stores/game.store.ts` — added `lastTurnEvents` state populated by `endTurn()`.
- Updated `src/components/layout/AppHeader.vue` — wired turn number, enabled End Turn button, added confirmation dialog.
- Updated `src/views/DashboardView.vue` — added turn events panel shown during reviewing phase.

**Features implemented:**

- `useTurnActions` composable: `canEndTurn` (enabled during player_action), `isResolving`, `isReviewing`, `currentTurn`, `income/expenses/net` for dialog summary, `willCreateDebt` flag, `sortedEvents` (priority-sorted), `requestEndTurn`, `cancelEndTurn`, `confirmEndTurn`, `acknowledgeResults`.
- `AppHeader.vue`: Turn number now live from game store. End Turn button enabled/disabled by game phase. Shows "Resolving..." label during resolve. Clicking opens `ConfirmDialog` with budget summary (income − expenses = net). Deficit shows debt warning in dialog message.
- `DashboardView.vue`: Turn Events panel appears at top during reviewing phase, showing all events from the resolved turn via `EventCard` components (priority-sorted, Critical first). Acknowledge button returns to player_action.
- `game.store.ts`: `lastTurnEvents` ref stores events from `resolveTurn()` result; exposed in store return object.

**Acceptance criteria met:**
- End Turn button enabled during player_action phase ✓
- Confirmation dialog with budget summary (income − expenses = net) ✓
- Deficit warning shown if net < 0 ✓
- Button shows "Resolving..." state during resolution ✓
- Turn number increments after resolution ✓
- New turn events appear as priority-sorted notification cards on dashboard ✓
- `npx vue-tsc --noEmit` — zero TypeScript errors ✓
- `npx vitest run` — 754/754 tests pass ✓

---

### Story 12.4 — Game Store & End Turn Flow (2026-02-18)

**What changed:**
- Created `src/stores/game.store.ts` — master game store that orchestrates turn resolution and state distribution.
- Created `src/__tests__/stores/game.store.test.ts` — 28 unit tests covering all acceptance criteria.

**Actions implemented:**

- `initializeGame()` — generates galaxy, creates Terra Nova (planet + colony), initializes budget, spawns 4 starting corporations (1 Exploration, 1 Construction, 2 Science each owning 1 Science infra level on Terra Nova), sets turn 1 and player_action phase.
- `getFullGameState()` — assembles `GameState` from all domain stores (galaxy, colonies, planets, corporations, contracts, budget, market).
- `endTurn()` — transitions through resolving phase, calls `resolveTurn()`, distributes results back to all domain stores via `$patch` and store actions, increments turn, transitions to reviewing phase.
- `acknowledgeResults()` — transitions from reviewing → player_action.

**Getters:** `currentTurn`, `gamePhase`

**Test scenarios:**
- Initial state: turn 1, player_action phase
- `initializeGame()`: galaxy generated, Terra Nova colony created, budget = 10 BP, 4 corps spawned (correct types, level 1, Science corps own infra)
- `getFullGameState()`: all entities present in assembled state
- `endTurn()`: turn increments, phase transitions, no-op when not in player_action
- `acknowledgeResults()`: reviewing → player_action, no-op otherwise
- Multi-turn: sequential end-turn cycles work correctly

**Test status**: 754/754 tests passing

---

### Story 12.3 — Debt Phase (2026-02-18)

**What changed:**
- Created `src/__tests__/engine/turn/debt-phase.test.ts` — 20 unit tests for the debt phase.
- Removed Story 12.3 TODO comment from `src/engine/turn/debt-phase.ts` (implementation was already complete from Story 12.1).

**Functions covered by tests:**

- `resolveDebtPhase(state: GameState): PhaseResult` — Phase #1 of turn resolution:
  - If `debtTokens === 0`: returns state unchanged with no events.
  - If `debtTokens > 0`: decrements `debtTokens` by 1, deducts 1 BP from `currentBP`.
  - Keeps `budget.debtTokens`, `budget.currentBP`, and `budget.stabilityMalus` in sync.
  - Emits a `Positive` event when the last token is cleared; `Info` event while tokens remain.
  - BP can go negative (debt payment is unconditional).

**Test scenarios:**

- No tokens: state returned unchanged, same reference, no events emitted
- Token clearing: 1 token cleared, 1 BP deducted, 1 event emitted with correct category
- Event priority: `Positive` when last token cleared, `Info` when tokens remain
- Many tokens: exactly 1 cleared regardless of count (5 or 10 tokens)
- BP edge cases: BP allowed to go negative; BP 1→0 when clearing last token
- Budget sync: `budget.debtTokens`, `budget.currentBP`, `budget.stabilityMalus` match state
- Immutability: input state not mutated

**Acceptance criteria met:**
- If debt tokens > 0: clear 1 token, deduct 1 BP from income ✓
- Returns updated debt token count and BP adjustment ✓
- Unit tests: token clearing ✓, no tokens scenario ✓, many tokens scenario ✓
- `npx vue-tsc --noEmit` — zero TypeScript errors ✓
- `npx vitest run` — 726/726 tests pass ✓

---

### Story 12.2 — Income & Expense Phases (2026-02-18)

**What changed:**
- Created `src/__tests__/engine/turn/income-phase.test.ts` — 26 unit tests for income phase.
- Created `src/__tests__/engine/turn/expense-phase.test.ts` — 33 unit tests for expense phase.
- Removed Story 12.2 TODO comments from `income-phase.ts` and `expense-phase.ts` (stubs were already complete from Story 12.1).

**Functions covered by tests:**

- `resolveIncomePhase(state: GameState): PhaseResult` — Phase #2 of turn resolution:
  - Iterates all colonies: calculates planet tax via `calculatePlanetTax`; skips colonies with pop < 5 or zero tax result.
  - Iterates all corporations: calculates corp tax via `calculateCorpTax`; skips level 1-2 startups (tax = 0).
  - Produces itemized `IncomeSource[]` with per-source attribution (type, sourceId, sourceName, amount).
  - Credits `totalIncome` to `state.currentBP`.
  - Updates `budget.incomeSources`, `budget.totalIncome`, and `budget.calculatedTurn`.
  - Emits no events.

- `resolveExpensePhase(state: GameState): PhaseResult` — Phase #3 of turn resolution:
  - Iterates all contracts: adds `contract` expense entry for each with `status === Active`; skips Completed contracts.
  - Iterates all missions: adds `mission` expense entry for each with `completedTurn === null`; skips finished missions.
  - Produces itemized `ExpenseEntry[]` with per-source attribution.
  - Deducts `totalExpenses` from `state.currentBP`.
  - Deficit handling: if `newBP < 0`, gains `max(1, floor(deficit / 3))` debt tokens, capped at 10 total.
  - Updates `budget.expenseEntries`, `budget.totalExpenses`, `budget.currentBP`, `budget.netBP`, `budget.debtTokens`, `budget.stabilityMalus`, `budget.calculatedTurn`.
  - Emits no events.

**Test scenarios:**

Income phase:
- Zero income: no colonies or corps → empty incomeSources, BP unchanged, totalIncome = 0
- Planet tax: pop ≥ 5 taxable; pop < 5 exempt; low habitability increases hab_cost reducing tax to 0; full tax amount verified at pop 7/hab 8; hab 10 zero cost; colony name attribution
- Corp tax: level 3+ taxable; level 1 exempt; level 2 exempt; level 5 and level 10 amounts verified; corp name attribution
- Multiple sources: two colonies summed; two corps summed; combined planet + corp income; mixed taxable/non-taxable sources; totalIncome as aggregate sum
- BP balance: income credited; no-income BP unchanged; income added on top of existing BP
- Budget state: totalIncome updated; expenseEntries untouched; calculatedTurn stamped

Expense phase:
- Zero expenses: no contracts or missions → empty expenseEntries, BP unchanged, totalExpenses = 0, no debt tokens
- Contract expenses: single active contract deducted; sourceId attribution; completed contracts skipped; multiple active contracts summed
- Mission expenses: single active mission deducted; sourceId attribution; completed missions skipped; multiple active missions summed
- Multiple types: combined contract + mission in expenseEntries; totalExpenses as aggregate; combined deduction from BP
- BP deduction: contract cost subtracted; mission cost subtracted; BP allowed to go negative
- Debt tokens: deficit triggers tokens; minimum 1 token for any deficit; floor(deficit/3) formula; accumulates on existing tokens; capped at 10; exactly-zero BP no tokens; surplus no tokens
- Budget state: totalExpenses updated; budget.currentBP matches state.currentBP; debtTokens reflected; stabilityMalus = floor(debtTokens/2); netBP = totalIncome - totalExpenses; incomeSources preserved

**Acceptance criteria met:**
- Income phase: sums all planet taxes + corp taxes, returns itemized income ✓
- Expense phase: sums all active contract costs + mission costs, returns itemized expenses ✓
- Both return typed result objects with per-source breakdowns ✓
- Unit tests: multiple income sources ✓, multiple expense types ✓, zero income scenario ✓
- `npx vue-tsc --noEmit` — zero TypeScript errors ✓
- `npx vitest run` — 706/706 tests pass ✓

---

### Story 12.1 — Turn Resolver (2026-02-18)

**What changed:**
- Created `src/engine/turn/turn-resolver.ts` — master turn resolution function.
- Created stub phases for all phases not yet fully implemented:
  - `src/engine/turn/debt-phase.ts` — clears 1 debt token per turn, deducts 1 BP
  - `src/engine/turn/income-phase.ts` — sums planet taxes + corp taxes, credits BP
  - `src/engine/turn/expense-phase.ts` — deducts contract/mission costs, handles deficit → debt tokens
  - `src/engine/turn/mission-phase.ts` — stub (deferred to Story 16.3)
  - `src/engine/turn/science-phase.ts` — stub (deferred to Story 14.4)
  - `src/engine/turn/event-phase.ts` — placeholder (deferred to post-prototype)
- Created `src/__tests__/engine/turn/turn-resolver.test.ts` — 24 unit tests.

**Functions implemented / exported:**

- `resolveTurn(state: GameState): TurnResult` — calls all 10 phases in exact order:
  1. `resolveDebtPhase` — clear 1 token, deduct 1 BP
  2. `resolveIncomePhase` — planet taxes + corp taxes → BP
  3. `resolveExpensePhase` — contract + mission costs deducted; deficit → new debt tokens
  4. `resolveContractPhase` — advance contracts (existing, Story 7.3)
  5. `resolveMissionPhase` — stub passthrough
  6. `resolveSciencePhase` — stub passthrough
  7. `resolveCorpPhase` — corp investment AI + organic emergence (existing, Stories 11.2–11.3)
  8. `resolveColonyPhase` — attribute recalculation + growth (existing, Story 10.3)
  9. `resolveMarketPhase` — sector market resolution (existing, Story 9.2)
  10. `resolveEventPhase` — placeholder passthrough
  - Increments turn number after all phases complete.
  - Appends new turn events to `state.events` history.
  - Returns `TurnResult { updatedState, events, completedTurn }`.

**Stub phases (functional but minimal):**

- `resolveDebtPhase`: clears 1 token if any exist, deducts 1 BP, emits debt event.
- `resolveIncomePhase`: iterates colonies/corps, applies planet/corp tax formulas, credits BP.
- `resolveExpensePhase`: iterates active contracts/missions, deducts BP costs, creates debt tokens on deficit (`floor(deficit/3)`, min 1, cap 10).
- `resolveMissionPhase`: passthrough stub with TODO (Story 16.3).
- `resolveSciencePhase`: passthrough stub with TODO (Story 14.4).
- `resolveEventPhase`: passthrough stub with TODO (post-prototype).

**Acceptance criteria met:**
- Calls phases in exact order: debt → income → expense → contract → mission → science → corp → colony → market → event ✓
- Each phase receives current state accumulated from previous phases ✓
- Collects events from all phases into unified event list (phase order preserved) ✓
- Returns complete updated GameState + all events ✓
- Increments turn number ✓
- Pure function: no side effects, no store access ✓
- Unit tests: phase order verification ✓, state flow between phases ✓, turn number increment ✓
- `npx vue-tsc --noEmit` — zero TypeScript errors ✓
- `npx vitest run` — 670/670 tests pass ✓

---

## Epic 11: Corporation AI

### Story 11.3 — Organic Corporation Emergence (2026-02-18)

**What changed:**
- Updated `src/engine/turn/corp-phase.ts` — added organic emergence logic as a fourth step in `resolveCorpPhase`, after the existing corp investment/acquisition loop.
- Created `src/__tests__/engine/turn/corp-phase-emergence.test.ts` — 30 unit tests.

**Functions implemented / exported:**

- `calculateEmergenceChance(dynamism)` — pure formula: `(dynamism - 5) × 10%`; returns 0 for dynamism < 6. Exported for direct testing.
- `determineCorpTypeFromDomain(domain)` — maps an `InfraDomain` to the matching `CorpType` (e.g., Science → Science, Mining/DeepMining/GasExtraction → Exploitation, Civilian → Construction). Returns `null` for unmapped domains. Exported for direct testing.
- `findMostProminentPublicDomain(colony)` — scans all infra domains and returns the one with the most `publicLevels`; returns `null` if every domain is at 0. Exported for direct testing.
- `tryOrganicEmergence(colony, turn)` — internal; checks all four conditions (dynamism threshold, probability roll, public levels exist, domain maps to a corp type), then generates a new level-1 corporation, transfers one public infra level to corporate ownership, and returns the updated colony + new corp + event.

**Organic emergence loop in `resolveCorpPhase`:**
After all existing corps have acted (investment + acquisition), the phase iterates every colony in `updatedColonies`. For each colony a single call to `tryOrganicEmergence` is made — this enforces the max-one-emergence-per-colony-per-turn constraint naturally.

**Domain → Corp Type mapping:**

| Domains | Corp Type |
|---|---|
| Agricultural | Agriculture |
| Mining, DeepMining, GasExtraction | Exploitation |
| Civilian | Construction |
| LowIndustry, HeavyIndustry, HighTechIndustry | Industrial |
| SpaceIndustry | Shipbuilding |
| Science | Science |
| Transport | Transport |
| Military | Military |

Exploration corps cannot emerge organically (no primary infrastructure domain).

**Key architecture decisions:**
- Three helper functions are exported from `corp-phase.ts` to allow direct unit testing of the pure logic without needing to call the full phase function.
- `tryOrganicEmergence` is an internal function (not exported) — it is tested indirectly via `resolveCorpPhase` with `vi.spyOn(Math, 'random').mockReturnValue(0)` to guarantee the probability roll fires.
- `clearNameRegistry()` is called in `beforeEach` in the test file to prevent the name-uniqueness registry from exhausting across test cases.

**Acceptance criteria met:**
- Colonies with dynamism ≥ 6 have a chance to spawn a new corp each turn ✓
- Chance: `(dynamism - 5) × 10%` ✓
- New corp type determined by colony's most prominent public infrastructure domain ✓
- New corp receives one public infrastructure level as its first asset (transfers from public to corporate) ✓
- Max one organic emergence per colony per turn ✓
- Unit tests: emergence chance calculation ✓, type determination ✓, infrastructure transfer ✓
- `npx vue-tsc --noEmit` — zero TypeScript errors ✓
- `npx vitest run` — 650/650 tests pass ✓

---

### Story 11.2 — Corp Phase: Turn Resolution (2026-02-18)

**What changed:**
- Created `src/engine/turn/corp-phase.ts` — corp phase integrating investment AI into the turn pipeline
- Created `src/__tests__/engine/turn/corp-phase.test.ts` — 12 unit tests

**Function implemented:**

- `resolveCorpPhase(state: GameState): PhaseResult` — runs the full corporation AI phase each turn:
  1. **Sort by level descending** — highest-level corps act first (biggest players have first pick of investment targets).
  2. **Apply capital gain** — each corp receives `calculateCapitalGain(totalOwnedInfra)` before decisions.
  3. **Run corp AI** — calls `runCorpInvestmentAI` (from corp-ai.ts, Story 11.1) with the most up-to-date colony and corporation state, so each corp sees investments made by previously-processed corps this turn.
  4. **Merge results** — updates the running corporation map (new capital/level/assets), updates touched colonies (new corporate ownership), removes absorbed corporations.
  5. **Skip absorbed corps** — if a corp is acquired mid-turn, it is removed from the map and skipped if it appears later in the processing queue.

**Key architecture decisions:**
- State is threaded through incrementally: each corp AI call receives a state snapshot with all previous corps' changes applied, so investment competition is accurate within the same turn.
- Absorbed corps are tracked in a `Set<CorpId>` and skipped via an early `continue` guard.
- The sort order snapshots levels at turn start — level changes from acquisitions do not reorder the queue mid-turn.

**Acceptance criteria met:**
- Processes corps in order: highest level first ✓
- Each corp: calculates capital gain, then runs AI decisions ✓
- Handles infrastructure ownership updates ✓
- Handles mergers/acquisitions and asset transfers ✓
- Returns updated corporations + events ✓
- Unit tests: multi-corp turn with investments ✓, acquisition ✓, processing order ✓, absorbed corp skipped ✓
- `npx vue-tsc --noEmit` — zero TypeScript errors ✓
- `npx vitest run` — 620/620 tests pass ✓

---

### Story 11.1 — Corporation Investment AI (2026-02-18)

**What changed:**
- Created `src/engine/simulation/corp-ai.ts` — corporation decision-making engine
- Created `src/__tests__/engine/simulation/corp-ai.test.ts` — 24 unit tests

**Function implemented:**

- `runCorpInvestmentAI(corp, state)` → `CorpAIResult` — processes one corporation per turn:
  1. **Infrastructure investment** — if capital ≥ 2: scans all sector markets for resource deficits; filters to allowed domains (specialty-only below level 3, any domain at level 3+); selects a deficit weighted by severity; finds highest-dynamism eligible colony; buys 1 infra level (cost: 2 capital).
  2. **Acquisition** (level 6+ only) — if capital ≥ target_level × 5 and target is 3+ levels below: absorbs target corp (merges all infra holdings, schematics, patents, planetsPresent), buyer gains 1 level (capped at 10).

**Key architecture decisions:**
- `RESOURCE_TO_DOMAIN` map drives deficit → domain selection; manufacturing domains also check required inputs are not in deficit (no point building factories with no raw materials)
- Extraction domains (Mining, DeepMining, GasExtraction, Agricultural) require a matching deposit via `DEPOSIT_DEFINITIONS[depositType].extractedBy === domain`
- Acquisition picks the most asset-rich eligible target (highest total infra owned)
- Returns `CorpAIResult { updatedCorp, updatedColonies: Map, absorbedCorpId?, events[] }` — caller (corp-phase.ts, Story 11.2) merges partial updates into full state

**Acceptance criteria met:**
- Corps with capital ≥ 2 consider investing ✓
- Investment priority: sector market resource deficits ✓
- Deficit selected weighted by severity ✓
- Highest-dynamism planet with available infra slots and required inputs not in deficit ✓
- Level 3+ corps invest in any domain, lower corps only their specialty ✓
- Level 6+ corps consider acquisitions if capital ≥ target × 5 ✓
- Target must be 3+ levels below buyer; target can refuse if within 2 levels ✓
- On acquisition: buyer gains all target assets, buyer gains 1 level ✓
- Returns list of actions as events ✓
- Unit tests: investment with clear deficit ✓, no suitable planet ✓, acquisition ✓, level restrictions ✓
- `npx vue-tsc --noEmit` — zero TypeScript errors ✓
- `npx vitest run` — 608/608 tests pass ✓

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
