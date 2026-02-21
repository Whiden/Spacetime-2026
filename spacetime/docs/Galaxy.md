# Spacetime — Galaxy & Start Conditions

> Defines sector structure, adjacency rules, galaxy generation parameters, and starting game state.
> For exploration contracts see `Contracts.md`. For market isolation between sectors see `Infrastructure.md`.

---

## Sectors

The galaxy is composed of 10–15 procedurally generated sectors. Each sector is a named region of space with its own internal economy, exploration state, and threat modifier.

### Sector Properties

| Property | Range | Notes |
|---|---|---|
| Name | Procedural | From sector name pool |
| Adjacency | 2–4 connections | All sectors always reachable from start |
| Exploration % | 0–100% | Starts at 0% except home sector |
| Density | Sparse / Moderate / Dense | Affects available exploration contracts |
| Threat Modifier | 0.5–1.5 | Multiplier on threat events *(for future use)* |
| Market | Per-sector | Isolated unless connected by trade route |

---

## Adjacency Graph Rules

The galaxy is a connected graph. Navigation and trade routes follow sector adjacency.

- All sectors reachable from the starting sector (connected graph — guaranteed)
- Starting sector has 2–3 adjacency connections
- 1–2 bottleneck sectors exist (exactly 2 connections)
- Maximum 4 connections per sector
- 3–5 hops from start to the furthest sector

Travel time between sectors uses BFS shortest-path hop count (1 turn per hop).

---

## Galaxy Generation

- 10–15 sectors total, procedurally generated from a seed
- Starting sector: 10% explored, contains Terra Nova
- Adjacent sectors: 0% explored, explorable immediately via contracts
- All other sectors: visible by name only, not yet explorable
- Sectors not adjacent to a player colony or military presence cannot be explored

---

## Starting Conditions

### Starting Planet: Terra Nova

| Property | Value |
|---|---|
| Name | Terra Nova |
| Type | Continental |
| Size | Large |
| Features | Temperate Climate, Fertile Plains, Strategic Location |
| Deposits | Common Ore Vein, Carbon-Based Land, Rare Ore Vein, Fertile Ground ×2, Rich Ocean, Gas Pocket |

### Starting Colony

| Property | Value |
|---|---|
| Population Level | 7 |
| Colony Type | Frontier Colony |

### Starting Infrastructure

| Domain | Level | Ownership |
|---|---|---|
| Civilian | 14 | Public |
| Agricultural | 10 | Public |
| Low Industry | 8 | Public |
| Mining | 5 | Public |
| Military | 2 | Public |
| Transport | 2 | Public |
| Science | 2 | Corporate (1 per starting Science corp) |
| Deep Mining | 3 | Public |
| Gas Extraction | 2 | Public |
| Heavy Industry | 1 | Public |
| High-Tech Industry | 1 | Public |
| Space Industry | 1 | Public |

### Starting Corporations

| Type | Level | Notes |
|---|---|---|
| Exploration | 1 | Ready to execute exploration contracts from turn 1 |
| Construction | 1 | Ready to execute colonization contracts from turn 1 |
| Science | 1 | Owns 1 Science infrastructure level on Terra Nova |
| Science | 1 | Owns 1 Science infrastructure level on Terra Nova |

### Starting Budget

- **10 BP** at game start
- Science infrastructure (2 levels) generates Research Points from turn 1
- No active contracts, no ships, no missions

### All Science Domains at Level 0

No discoveries have been made. Science output begins accumulating from turn 1 based on the 2 starting Science infrastructure levels.

---

## First Turn Guidance *(No Tutorial)*

The UI surfaces natural entry points without a formal tutorial:

- Dashboard shows "No active contracts" → Create Contract button is visible
- Terra Nova's colony detail shows clear investment opportunities in infrastructure
- Starting corps appear in the Corporations view, ready to be assigned contracts
- "No ships" state in Fleet view explains the prerequisites (need a Shipbuilding corp + Space Industry infrastructure)
