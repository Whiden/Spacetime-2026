# Spacetime — Contracts & Exploration

> Defines the contract system, all contract types, creation flow, completion rules, and exploration mechanics.
> For corporation eligibility levels see `Corporations.md`. For colony type packages from colonization see `Planet.md`.

---

## Overview

Contracts are the player's primary interaction with the economy. Every non-military action is performed through a contract awarded to a corporation. The player never directly commands a corp — they create a contract and assign a corp to execute it.

---

## Contract Properties

Every contract has:

| Property | Description |
|---|---|
| Type | What the contract does |
| Target | Planet, colony, sector, or sector pair |
| Assigned Corp | The corporation executing it |
| BP/turn | Ongoing cost while active |
| Duration | Fixed turn count (or ongoing for trade routes) |
| Turns Remaining | Counts down each turn |
| Status | Active → Completed (or Failed) |

---

## Contract Creation Flow

1. Player selects contract type
2. Player selects target (depends on type — sector, planet, colony, or sector pair)
3. System calculates BP/turn and duration based on type and corp level
4. Player sees eligible corporations: level, personality, contract quality preview
5. Player selects corp **or** kickstarts a new startup corporation (level 1, assigned immediately)
6. Contract begins next turn (Contract phase starts counting)

---

## Contract Completion

Contract success is guaranteed for the prototype — no failure mechanic exists yet.

### Quality by Corp Level

| Corp Level | Result |
|---|---|
| 1–3 | Base result |
| 4–6 | Improved result (+1 infrastructure level, better scan data, etc.) |
| 7+ | Best result (+2 infrastructure levels, full scan data, etc.) |

### Corp Completion Bonus

On completion, the assigned corporation receives:

```
completion_bonus = floor((bp_per_turn × duration) / 5) Capital
```

---

## Contract Types

| Type | Target | BP/turn | Duration | Corp Types Eligible | What it Does |
|---|---|---|---|---|---|
| **Exploration** | Sector | 2 | 2–3 turns | Exploration | Explores sector %, discovers planets with orbit scan data |
| **Ground Survey** | Planet | 1 | 2 turns | Exploration | Reveals full planet data (all features, exact deposits) |
| **Colonization** | Planet | by colony type | by type | Construction | Establishes a new colony |
| **Ship Commission** | Colony (with space infra) | by size | by size | Shipbuilding | Builds a ship for a selected role and size variant |
| **Trade Route** | Adjacent sector pair | 2 | Ongoing | Transport | 50% surplus sharing between sectors each turn |

### Cross-type eligibility

- Level 3+: Exploration and GroundSurvey contracts can be assigned to non-Exploration corps
- Level 6+ (Megacorp): Eligible for any contract type

---

## Colonization Contracts

Duration: 12–15 turns depending on colony type. During the contract, the colony-in-progress is entirely supported by the contract's BP cost. On completion, the colony is established with the starting infrastructure package defined by its colony type (see `Planet.md` for colony type packages).

**Corp level bonus at completion:**
- Level 4–6: +1 to all starting infrastructure levels
- Level 7+: +2 to all starting infrastructure levels

---

## Ship Commission Contracts

Requires selecting a role, a size variant (Light / Standard / Heavy), and a target colony with sufficient space industry infrastructure.

```
required_space_infra = base_size × size_multiplier
```

See `Ships.md` for full ship stats, role definitions, and size variant multipliers.

---

## Exploration

### Overview

Each sector has an exploration percentage (0–100%). At 100% the sector is fully explored and can't be explored further. Exploration can only target sectors **adjacent to sectors where the player has a colony or military presence**.

### Exploration Contract Mechanics

```
duration          = max(2, 4 - floor(corp_level / 2))
exploration_gain  = random(5, 15)%
```

Higher-level exploration corps do not discover more planets — they provide better **orbit scan quality**.

### Planet Discovery

Every completed exploration contract discovers planets:

```
poi_count = 2 + weighted_random(0: 40%, 1: 40%, 2: 20%)
```

Always 2–4 planets discovered per completed exploration. Each discovered planet is immediately orbit-scanned (partial data — full data requires a Ground Survey contract).

### Two-Step Discovery

**Orbit Scan** (automatic with exploration contract completion):
- Planet type and size revealed
- Orbit-visible features revealed (see `Planet.md` for feature visibility tiers)
- Deposits not revealed; richness not revealed
- Quality of scan data depends on corp level

**Ground Survey** (separate contract, 1 BP/turn, 2 turns):
- All features revealed including ground-visible ones
- Exact deposit types and richness revealed
- Exact habitability confirmed

### Accept or Reject

After orbit scan or ground survey, the player must Accept or Reject the planet:

- **Accept**: Planet becomes available for Ground Survey and Colonization contracts
- **Reject**: Planet hidden from player UI. In a future story, rejected planets may be settled by independent corporations
