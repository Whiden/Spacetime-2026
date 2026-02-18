Spacetime — Game Specifications

> This document is the mechanical bible for Spacetime. It defines every system, rule, formula, and interaction. For concrete data values (types, costs, stats, spawn weights), see Data.md. All numbers are initial values — they should be tuned through playtesting.

---

## Table of Contents

1. [Turn Structure](#1-turn-structure)
2. [Budget System](#2-budget-system)
3. [Corporations](#3-corporations)
4. [Contract System](#4-contract-system)
5. [Planets & Colonies](#5-planets--colonies)
6. [Infrastructure](#6-infrastructure)
7. [Trade & Resources](#7-trade--resources)
8. [Science & Technology](#8-science--technology)
9. [Patents & Schematics](#9-patents--schematics)
10. [Ships](#10-ships)
11. [Missions & Combat](#11-missions--combat)
12. [Exploration](#12-exploration)
13. [Threats & Events](#13-threats--events)
14. [Galaxy Structure](#14-galaxy-structure)
15. [Game Start Conditions](#15-game-start-conditions)
16. [UI Structure & Information Architecture](#16-ui-structure--information-architecture)

---

## 1. Turn Structure

Each turn follows a fixed sequence:

### Phase 1: Income & Debt

- One debt token cleared (if any exist), costing 1 BP.
- All income sources calculated and added to the player's BP pool.
- All expenses calculated and deducted.

### Phase 2: Reports & Dashboard

- The dashboard presents the new turn state.
- Flagged events are surfaced (contract completions, mission reports, discoveries, corp events).
- The player can drill into detailed reports on demand.

### Phase 3: Player Actions

- The player may take any number of actions, constrained only by available BP.
- Action types: create contracts, assign missions, invest in planets, accept/reject discovered planets, create trade routes.
- No action limit per turn.

### Phase 4: End Turn

- Player confirms end of turn.
- All simulations resolve in this exact order:
  1. **Debt phase** → Clear one debt token, apply BP cost
  2. **Income phase** → Calculate all income (corp tax + planet tax)
  3. **Expense phase** → Calculate all expenses (contracts + missions + investments)
  4. **Contract phase** → Advance contracts, check completion, spawn events
  5. **Mission phase** → Advance missions, resolve travel/combat
  6. **Science phase** → Advance science sectors, roll discoveries
  7. **Corp phase** → Corporation AI: spend capital, invest, merge
  8. **Colony phase** → Recalculate all colony attributes, growth ticks
  9. **Market phase** → Resolve sector markets (production → consumption → trade)
  10. **Event phase** → Generate events based on current state (placeholder for prototype)
- Autosave triggers.

### Turn Timing

- Target: 5–10 minutes per turn for the player.
- Time is abstract. One turn = one turn. No real-world time mapping.

---

## 2. Budget System

### Overview

Budget Points (BP) are an abstract representation of political capital and investment capacity. They are the single currency of the game. **All BP values are integers.**

### Income & Expenses

```
BP Income = sum(planet_taxes) + sum(corp_taxes)
BP Expenses = sum(active_contract_costs) + sum(mission_costs) + player_investments
Net BP = Income - Expenses
```

### Planet Tax

```
habitability_cost = max(0, 10 - habitability) × max(1, floor(pop_level / 3))
planet_tax = max(0, floor(population_level² / 4) - habitability_cost)
```

### Corporation Tax

```
corp_tax = floor(corp_level² / 5)
```

Level 1-2 corporations pay 0 BP (startups don't pay taxes).

### Debt System

Debt tokens represent lingering economic damage from deficit spending.

**Gaining tokens**: When the player ends a turn in deficit:

```
debt_tokens_gained = floor(deficit / 3)    // Minimum 1 if any deficit
```

**Maximum tokens**: 10. Player cannot overspend beyond what would create more than 10 tokens.

**Clearing tokens**: Each turn, 1 debt token is automatically cleared, costing 1 BP from income.

**Stability penalty**: While debt tokens exist, all colonies suffer:

```
stability_malus = floor(debt_tokens / 2)
```

**Design intent**: Occasional deficit spending is a viable strategy. Chronic deficit spending causes empire-wide instability.

---

## 3. Corporations

### Overview

Corporations are autonomous AI-driven entities that perform all economic, scientific, military, and infrastructure activity in the game. The player interacts with them through contracts and investment, never through direct command.

### Corporation Properties

**name** : Procedurally generated
**type** : Primary specialization
**level** : 1-10
**Capital** : Financials reserves
**personality traits** : 1-2 randoms traits
**home planet** : Planet where it was founded
**planets present** : Planet where it has at least one infrastructure
**assets** : infrastructures owned, ships, schematics, patents

### Capital System

Capital represents a corporation's financial reserves — used to buy infrastructure, level up, buy assets and acquire other corporations. They gain capital through their assets and infrastructure and through contract completion.

**Capital gain per turn:**

```
random_gain = random(0, 1)
infrastructure_profits = floor(total_owned_infrastructure / 10)
capital_gain = random_gain + infrastructure_profits
```

**Contract completion bonus (awarded once on completion):**

```
contract_total_cost = bp_per_turn × duration
completion_bonus = floor(contract_total_cost / 5)
```

**Maximum infrastructure owned:**

```
max_infrastructure = corp_level × 4
```

### Megacorp Transition

When any corporation reaches level 6, it becomes a megacorp

- It can invest in **any** infrastructure type, not just its specialty, and can operate any contracts
- It can acquire other corporations (cost: target_level × 5 Capital)

### Corporation actions

On each turn, corporation has several actions at their disposals (see data.md for details).

### Lifecycle

**Generation**: A corporation can be founded by the player during a contract (startup) or each turn, by a colony with dynamism >= 6.

**Organic Emergence**:

```
emergence_chance = (dynamism - 5) × 10%
```

New corp type is determined by the colony's most prominent infrastructure domain with independant levels. The new corp receives one independant-owned infrastructure level as its first asset (transfers from independant to corporate).

**Level Up**: Costs `current_level × 3` Capital. Corps accumulate capital through passive income and contract bonuses.

**Mergers & Acquisitions**: A corp at level 6+ can acquire another corp for `target_level × 5` Capital. A corp can **refuse** acquisition if its level is within 2 of the buyer's level. On acquisition: buyer gains all target assets and infrastructure, buyer gains 1 level, target ceases to exist.

### Investment AI

Each turn, corporations with Capital ≥ 2 consider investing:

1. Check sector market for resource deficits
2. Select a deficit randomly (weighted by severity)
3. Find the highest-dynamism planet in the sector with available infrastructure slots (under corp's max), not at population cap, and required inputs not in deficit
4. If found: buy infrastructure level (cost: 2 Capital)
5. If not found: check next planet by dynamism, or skip
6. Corps process in order: **highest level first**

Below level 3, corps invest only in their specialty domain. At level 3+, they can invest in any domain.

---

## 4. Contract System

### Overview

Contracts are the player's primary interaction with the economy. Every non-military action is performed through a contract awarded to a corporation. See Data.md for contract type definitions, costs, and durations.

### Contract Properties

Every contract has: a **type**, a **target** (planet, colony, sector, or sector pair), **BP/turn cost**, **duration** in turns, an **assigned corporation**, **turns remaining**, and **status** (Active or Completed).

### Contract Creation Flow

1. Player selects contract type
2. Player selects target (depends on type)
3. System calculates BP/turn and duration based on type and corp level
4. Player sees eligible corporations with level, personality, estimated quality
5. Player selects corp OR kickstarts a new startup corporation
6. Contract begins next turn

### Contract Completion

Contract success is guaranteed for the prototype (no failure mechanic). Quality depends on corporation level:

- **Level 1-3**: Base result
- **Level 4-6**: Improved result (+1 infrastructure level, better scan data, etc.)
- **Level 7+**: Best result (+2 infrastructure levels, full scan data, etc.)

On completion, the assigned corporation receives:

```
completion_bonus = floor((bp_per_turn × duration) / 5) Capital
```

### Colonization Contracts

Colonization contracts are long-term (12-15 turns depending on colony type — see Data.md). During the contract, the colony is entirely supported by the contract's BP cost. On completion, the colony is established with starting infrastructure from its colony type. Corp level bonus: Level 4-6 grants +1 to all starting infrastructure, Level 7+ grants +2.

---

## 5. Planets & Colonies

### Planets

Planets are discovered through exploration and defined by **type** (affects habitability and deposits), **size** (affects population cap and slot counts), **features** (special traits with attribute modifiers), **deposits** (natural resources), and **status** (Undiscovered → Orbit Scanned → Ground Surveyed → Accepted → Colonized, or Rejected).

See Data.md for planet types, sizes, features, and deposit definitions with spawn rules.

### Colonies

A colony is a settled planet defined by its **type** (from colonization contract — see Data.md for types), **population level** (1-10), **infrastructure** per domain, six **core attributes**, **corporations present**, and a permanent **passive bonus** from colony type. The type label can be renamed by the player (cosmetic only) but the passive bonus persists.

### Colony Attributes (All clamped 0–10)

**Habitability** — mostly static, set by planet:

```
habitability = base_from_planet_type + feature_modifiers
```

**Accessibility** — driven by transport infrastructure:

```
accessibility = 3 + floor(transport_infrastructure / 2) + feature_modifiers
```

**Dynamism** — economic energy, driven by access, population, and corporate activity:

```
dynamism = floor((accessibility + population_level) / 2) + min(3, floor(total_corporate_infrastructure / 10)) + feature_modifiers
```

**Quality of Life** — flag-based, starts high and degrades with problems:

```
qol_hab_malus = floor(max(0, 10 - habitability) / 3)
qol_shortage_malus = shortage_count
qol = 10 - qol_hab_malus - qol_shortage_malus + feature_modifiers
```

**Stability** — flag-based, starts high and degrades with problems:

```
stability_qol_malus = max(0, 5 - qol)
stability_debt_malus = floor(empire_debt_tokens / 2)
stability_shortage_malus = shortage_count
stability_military_bonus = min(3,floor(military_infrastructure / 3))
stability = 10 - stability_qol_malus - stability_debt_malus - stability_shortage_malus + stability_military_bonus + feature_modifiers
```

`empire_debt_tokens` is read directly from `gameState.debtTokens`, not from a modifier.

**Growth** — progress toward next population level:

```
growth_hab_malus = floor(max(0, 10 - habitability) / 3)
growth_per_turn = floor((qol + stab + access) / 3) - 3 - growth_hab_malus + feature_modifiers
```

### Population Mechanics

- Growth accumulates each turn from the growth formula.
- At Growth 10 + civilian infrastructure ≥ (next_pop_level) × 2 → population level +1, Growth resets to 0.
- At Growth reaching -1 → population level -1, Growth resets to 9.
- Population capped by planet size (see Data.md for size → max pop mapping).

### Colony Abandonment

Player can abandon a struggling colony: population leaves, planet reverts to Ground Surveyed status, infrastructure is lost, can be recolonized later.

---

## 6. Infrastructure

### Overview

Infrastructure represents built capacity across 10 domains. Each domain has levels that can be **public** (player investment or organic growth — permanent) or **corporate-owned** (built by corporations spending Capital — inherited on acquisition).

See Data.md for domain definitions, production/consumption rules, and cap rules.

### Production Rules

**Extraction** (Mining, Deep Mining, Gas Extraction, Agricultural) — per infrastructure level:

```
output = 1 unit of product
```

**Manufacturing** (Low/Heavy/High-Tech/Space Industry) — per infrastructure level:

```
input = 1 unit of each required input
output = 1 unit of product
```

If inputs are in shortage, output is **halved** (not zero).

### Infrastructure Caps

- **Civilian**: Capped at `next_population_level × 2`
- **Extraction/Agricultural**: Capped by deposits
- **All other industries**: Capped at `population_level × 2`.

### Organic Growth

Each turn, for each colony with at least 1 infrastructure level:

```
organic_growth_chance = dynamism × 5 (%)
```

If triggered: +1 public-owned level to a random eligible domain, weighted by resource demand.

### Player Direct Investment

The player can spend **3 BP** to add +1 public infrastructure level to any domain on any colony, subject to cap limits and deposit requirements.

---

## 7. Trade & Resources

### Overview

Nine resource types circulate through the empire (see Data.md for full definitions). Trade is automatic within sectors, gated by the dynamism attribute. There is no stockpiling: each turn is a clean flow calculation.

### Consumption by Population

| Resource           | Consumption per Turn |
| ------------------ | -------------------- |
| Food               | population_level × 1 |
| Consumer Goods     | population_level × 1 |
| Transport Capacity | population_level x 1 |

### Sector Market Resolution

Each sector has its own internal market. Trade resolves per-sector each turn in five phases:

1. **Production**: All colonies calculate production for all resources.
2. **Internal Consumption**: Each colony consumes from its own production first.
3. **Surplus to Market**: Remaining production goes to sector market pool.
4. **Deficit Purchasing**: Colonies sorted by dynamism (highest first) fill deficits from the pool. High-dynamism colonies get first access.
5. **Shortage Resolution**: Unfilled deficits become soft shortages with maluses.

### Shortage Maluses

| Shortage           | Effect                             |
| ------------------ | ---------------------------------- |
| Food               | -2 QoL, population decline risk    |
| Consumer Goods     | -1 QoL                             |
| Transport Capacity | -1 Accessibility                   |
| Industrial Inputs  | -50% output from affected industry |

Shortage doesn't mean zero — it means penalties rather than complete stoppage.

### Export Bonuses

Colonies that successfully export goods to the sector market receive attribute bonuses (see Data.md for bonus table).

### Cross-Sector Trade

Trade between sectors requires a **Trade Route contract**: 2 BP/turn (ongoing), requires a Transport corporation. After each sector resolves internally, surplus flows between connected sectors at **50% efficiency**. Dynamism-priority purchasing still applies. One trade route per sector pair. Player can cancel at any time.

Without a trade route, sectors are economically isolated.

### Market Visibility

The sector market dashboard shows production, consumption, surplus/deficit per resource, per-colony breakdown, and cross-sector flows. This data is visible to the player AND used by corporation AI for investment decisions.

---

## 8. Science & Technology

### Overview

Science is fully organic. The player does not direct research. Empire science output advances domains levels, which unlock discovery pools, which science corps draw from. See Data.md for science domains definitions and discovery pool structure.

### Focuses and bonuses

The player can focus a domain from the overview. This double the output of the selected domain and increase the chance of discoveries in that domain.

### Science Output

```
empire_science_per_turn = sum of all science infrastructure levels across all colonies
```

Every level of science infrastructure contributes equally regardless of planet.

### Science Distribution

```
per_domain_base = floor(empire_science_per_turn / 9)
per_domain_total = per_domain_base + bonuses_for_that_domain
```

Science distributes evenly across all 9 sectors, with a bonus to domains. If the domain is focused, the value is doubled.

### Domain Advancement

```
threshold_to_next_level = current_level × 15
```

### Discoveries

When a sector reaches a new level, it adds discoveries to the discoveries pool. Each turn, science corps roll:

```
discovery_chance = (corp_level × 5) + (corp_science_infrastructure × 2) %
```

Discoveries are surprises — the player doesn't see possibilities until announced. Once a pool is exhausted, no more discoveries from that level. Discoveries can unlock features, improve empire-wide stats, improve the category level of possible patents, improve the category level of possible schematics.

---

## 9. Patents & Schematics

### Patents

Patents are general-purpose technological advantages owned by corporations of any type. They improve how the corporation operates or give bonus capital per turn. Patents are unlocked by discoveries.

**Patent properties**: name, operational bonus, owning corporation.

**Patent acquisition**: As the game progresses, corporations may develop patents based on available discoveries and their own level.

```
patent_chance = (corp_level × 2) %
max_patents_for_corp = floor(corp_level / 2)
```

If the generation trigger, the game look into the adequate patent category for the corp and check the level of this category. It generate a patent with stats based on the level. This generate a modifier for the corp.

Some patents are specifics to shipbuilding corporation. Indeed, the civil ships patents represent specific models of ships bought than can be build and bought by the civilian market from the corporation (abstracted).

**Patent inheritance**: If a corporation is acquired, the buyer inherits all patents. If a corporation dissolves, its patents are lost permanently.

### Schematics

Schematics are unique equipment blueprints owned by individual shipbuilding corporations. Unlike patents, schematics directly modify the ships built by the owning corp — they represent specific weapons, reactors, armor systems, or other hardware fitted to every ship that corp produces. Schematics are unlocked by discoveries.

**Schematic properties**: name, stat bonuses, owning corporation.

**Schematic acquisition**: Each turn, shipbuilding corporations roll for schematic development:

```
schematic_chance = (corp_level × 2) %
max_schematics_for_corp = floor(corp_level / 2)
```

If the generation trigger, the game look into the available schematics category and their level. It generate a random schematic. This generate a modifier for the corp.

**Schematic inheritance**: If a corporation is acquired, the buyer inherits all schematics. If a corporation dissolves, its schematics are lost permanently.

**Schematic update**: Unlike patent, schematics update with their category. So when the Engine category update to next level, all schematics will have their base stats updated as well (random modifier stay the same). The name will be updated with mkX, X being the iteration of the schematic.

---

## 10. Ships

### Overview

Ships are rare, named, and precious. Each ship is a unique entity built by a specific corporation for a specific role, shaped by the empire's technology and the builder's patents.

### Ship Properties

Every ship has: a unique procedurally generated **name**, a **role**, **main stats**, **derived stat**, **condition** (0-100%), an assigned **captain**, a **service record**, **status**, **home sector**, **owner (corporation or government)** and **schematics applied**.

### Captain Experience

| Level   | Combat Modifier | After       |
| ------- | --------------- | ----------- |
| Green   | ×0.8            | Start       |
| Regular | ×1.0            | 2 missions  |
| Veteran | ×1.1            | 5 missions  |
| Elite   | ×1.2            | 10 missions |

### Ship Construction

Commission contract with a shipbuilding corp. Requires a role selection, a size variant (Light/Standard/Heavy) and a colony with sufficient space infrastructure.

Space infrastructure requirement:

```
required_space_infra = base_size x size_multiplier
```

### Ship Loss

Permanent. Ship removed from game, captain lost (KIA/MIA), service record preserved in memorial.

### Ship Refit (Future Feature)

A refit contract could rebuild a ship's stats using current tech baselines while preserving identity, service record, and captain. Not implemented in prototype.

### Ship Roles

Ships are commissioned by role. Each role defines a purpose, a base stat profile, and a size range. Roles are not rigid templates — they are expectations. The corporation building the ship interprets the role through its own capabilities.

See Data.md for role definitions, base stats, and size ranges.

### Ship Stats

Every ship has: **size**,**speed**,**firepower**,**defence**,**detection**,**evasion**.

When a ship is commissioned, its stats are generated from layers : Baseline and tech bonuses, corporation scaling, schematics, and randomness.

```
effective_base = role_base_stat + empire_tech_bonus[stat]
corp_modifier = 0.7 + (corp_level × 0.06)
final_stat = floor((floor(effective_base × corp_modifier) + schematics_bonuses) * random(0,8 , 1,2))
```

### Size Scaling

The player can request a **Light**, **Standard**, or **Heavy** variant when commissioning:

| Variant  | Size Multiplier | Cost Multiplier | Build Time Multiplier |
| -------- | --------------- | --------------- | --------------------- |
| Light    | ×0.75           | ×0.75           | ×0.75                 |
| Standard | ×1.0            | ×1.0            | ×1.0                  |
| Heavy    | ×1.25           | ×1.25           | ×1.25                 |

### Secondary stats

Derive from the mains stats and can also have bonuses based on the role and schematics.

```
hull_points = size × 5 + defence x 10  + schematics_bonuses + role_bonuses
power_projection = floor(size × 1.5) + schematics_bonuses + role_bonuses
bp_per_turn = max(1, floor(size / 3)) + schematics_bonuses + role_bonuses
base_build_time = max(3, floor(size × 1)) + schematics_bonuses + role_bonuses
```

### Ships abilities

Ships attributes derived into abilities which represent how fit a ship is for a mission.

```
Fight = floor((Firepower + floor(Defence x 0.75) + floor(Evasion x 0.5)) x Size/2)
Investigation = floor((floor(Speed x 0.75) + Detection) x Size/2)
Support =  floor((floor(Firepower x 0.5) + floor(Detection x 0.75)) x Size/2)
```

These abilities are used during mission resolution to evaluate whether a task force is fit for its assigned mission type (Fight → Assault/Defense, Investigation → Investigation/Rescue, Support → Escort).

---

## 11. Missions & Combat

### Overview

Missions are the player's military interaction. See Data.md for mission type definitions, costs, and durations. Patrol missions do not exist — passive security is handled by military infrastructure.

Ship **abilities** (Fight, Investigation, Support — see Section 10) determine how fit a task force is for a given mission type. These scores are displayed during mission planning and used during resolution to assess success likelihood.

### Mission Creation

1. Select mission type and target sector
2. Assemble task force from available governement owned ships
3. View cost and risk assessment
4. Confirm — ships become unavailable for mission duration

### Task Force

Ships from multiple corps can combine. Highest-experience captain becomes commander. Commander personality affects retreat threshold.

### Combat Resolution (Semi-Abstracted)

The player never directly controls combat.

This is a TODO. This feature will be implemented post prototype.

**Phase 1 — Initiative**:

**Phase 2 — Targeting**:

**Phase 3 — Exchange Rounds** (3-5 per battle):

**Phase 4 — Retreat Check** (after round 3):

**Phase 5 — Aftermath**:

### Mission Reports

Short summary: type, target, duration, task force, outcome, losses, damage. Worst case: "Task Force has not returned. Communications lost."

---

## 12. Exploration

### Overview

Each sector has an exploration percentage (0-100%). At 100%, the sector is fully explored and can't be explored anymore.

### Exploration Contracts

See Data.md for cost and duration details.

```
duration = max(2, 4 - floor(corp_level / 2))
exploration_gain = random(5, 15)%
```

### Planet Discovery

Every completed exploration contract discovers planets:

```
poi_count = 2 + weighted_random(0: 40%, 1: 40%, 2: 20%)
```

Always discovers 2-4 planets. Higher-level exploration corps don't find more — they provide better **orbit scan quality** (see Data.md for scan reveal tiers by corp level).

### Two-Step Discovery

**Orbit Scan** (automatic with exploration): Partial data based on corp level. Orbit-visible features only.

**Ground Survey** (separate contract, 1 BP/turn, 2 turns): All features revealed, exact deposit richness, exact habitability.

### Accept or Reject

- **Accept**: Available for ground survey and colonization contracts.
- **Reject**: Hidden from player UI. Corporations may settle independently in the future.

### Exploration Range

Can only explore sectors adjacent to sectors where the player has a colony or military presence.

---

## 13. Threats & Events

> **Deferred from prototype.** The event infrastructure (event store, notification display, priority system) is implemented, but no threats are actively generated.

### Future Threat Categories

Piracy, Corporate Conflict, Colony Unrest, Natural Disasters, Resource Crises, Unknown Encounters, Internal Corruption. See Data.md for trigger definitions.

### Event Priority System (Implemented)

| Priority | Visual | Examples                             |
| -------- | ------ | ------------------------------------ |
| Critical | Red    | Attack, ship destroyed, debt crisis  |
| Warning  | Orange | Shortage, stability drop             |
| Info     | White  | Contract progress, discovery         |
| Positive | Green  | Contract complete, population growth |

Events are generated by all game systems and displayed in the event feed, priority-sorted.

---

## 14. Galaxy Structure

### Sectors

10-15 sectors, procedurally generated. Each has a unique name, 2-4 adjacency connections, exploration percentage, density (affects available exploration contracts — see Data.md), a threat modifier (0.5-1.5, for future use), and its own internal trade market.

### Adjacency Graph Rules

- All sectors reachable from start (connected graph)
- Starting sector has 2-3 connections
- 1-2 bottleneck sectors (exactly 2 connections)
- Maximum 4 connections per sector
- 3-5 hops from start to furthest sector

---

## 15. Game Start Conditions

### Starting Conditions

See Data.md

### First Turn Guidance (No Tutorial)

The UI naturally surfaces: "No active contracts" → Create Contract button. "No ships" → explains prerequisites (need shipbuilding corp and space infrastructure). Dashboard shows Terra Nova with clear investment opportunities. Starting corporations are visible immediately — the player can assign them to contracts from turn 1.

---

## 16. UI Structure & Information Architecture

### Design Principles

- **Clean modern aesthetic**: Minimal, Apple-like. Whitespace, typography, subtle animations.
- **Information hierarchy**: Dashboard → Category → Detail. Max 2 clicks to any information.
- **Self-teaching**: Every screen shows available actions and why they matter. No tutorial.
- **Data density with clarity**: Enough to decide quickly without overwhelming.
- **Flag-based warnings**: Shortages, declining attributes, and debt as clear visual flags.

### Primary Screens

**Dashboard**: Turn number, BP balance, income/expense net, event feed (priority-sorted), empire summary cards (colonies, corps, ships, contracts), quick actions, debt warning.

**Colonies**: List with name, type, population, attribute bars (color-coded), shortage alerts. Detail view: attributes with tooltips, infrastructure panel with invest buttons, resource flow, features, deposits, corps present.

**Corporations**: List sorted by level with name, type, level, capital, traits, home planet. Detail: full stats, infrastructure owned, contract history, capital breakdown. Empty state guides to contracts.

**Contracts**: Active with progress bars, assigned corp, cost, turns remaining. Contract wizard: type → target → cost preview → corp selection → confirm. Completed log.

**Fleet**: Ships by sector with name, class, condition, captain, status. Missions with type, target, phase, cost. Blueprint design interface. Mission wizard. Empty state explains path to ships.

**Science**: 9 sectors with level + progress. Discoveries chronological. Schematics by type with stats. Empty state guides to science infrastructure.

**Market**: Sector selector. Per-resource production/consumption/surplus/deficit. Planet breakdown. Cross-sector flows. Shortage warnings.

**Galaxy**: Sector list with exploration %, density, connections, presence indicators. Discovered planets with status. Explore button. Trade route indicators.

**Settings**: Save slots with turn/timestamp. Save/Load/Export/Import. New Game.
