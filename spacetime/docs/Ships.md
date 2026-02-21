# Spacetime — Ships & Missions

> Defines ship roles, stats, generation formula, size variants, captain experience,
> ship abilities (Fight/Investigation/Support), missions, and combat resolution.
> For ship commission contracts see `Contracts.md`. For schematics see `Science.md`.

---

## Ships Overview

Ships are rare, named, and precious. Each is a unique entity built by a specific shipbuilding corporation for a specific role, shaped by the empire's technology level and the builder's schematics. Ship loss is permanent.

---

## Ship Properties

| Property | Description |
|---|---|
| Name | Unique procedurally generated name |
| Role | Purpose and base stat profile |
| Primary Stats | Size, Speed, Firepower, Defence, Detection, Evasion |
| Derived Stats | Hull Points, Power Projection, BP/turn, Build Time |
| Abilities | Fight, Investigation, Support (derived from primary stats) |
| Condition | 0–100%, degrades from damage; destroyed at 0% |
| Captain | Assigned officer with experience level |
| Service Record | Missions completed, battles fought |
| Status | Stationed / On Mission / Under Repair / Under Construction |
| Home Sector | Where the ship is currently based |
| Owner | Corporation or Government |
| Schematics Applied | Permanent equipment bonuses from the building corp at construction time |

---

## Ship Roles

| Role | Purpose | Size | Speed | Firepower | Defence | Detection | Evasion | Base Cost | Base Duration |
|---|---|---|---|---|---|---|---|---|---|
| **System Patrol** | Local security, anti-piracy | 3 | 5 | 3 | 3 | 4 | 5 | 2 | 3 |
| **Escort** | Protect convoys and contracts | 4 | 4 | 4 | 5 | 3 | 3 | 2 | 5 |
| **Recon** | Scouting, intel gathering | 2 | 6 | 1 | 2 | 7 | 6 | 2 | 3 |
| **Assault** | Offensive combat operations | 6 | 3 | 7 | 6 | 3 | 2 | 2 | 8 |
| **Carrier** | Launch fighters, fleet support | 7 | 2 | 3 | 5 | 4 | 1 | 3 | 8 |
| **Flagship** | Command ship, power projection | 9 | 2 | 6 | 8 | 5 | 1 | 3 | 15 |
| **Transport** | Cargo and troop transport | — | — | — | — | — | — | — | — |

Roles are not rigid templates — they are expectations. The building corporation interprets the role through its own schematics and capabilities.

---

## Ship Stat Generation

Stats are generated at commission time from four layers applied in sequence:

```
effective_base = role_base_stat + empire_tech_bonus[stat]
corp_modifier  = 0.7 + (corp_level × 0.06)
final_stat     = floor((floor(effective_base × corp_modifier) + schematic_bonuses) × random(0.8, 1.2))
```

- `empire_tech_bonus` comes from `empireBonuses.shipStats` (cumulative from science discoveries)
- `corp_modifier` scales with the building corp's level — a level 10 corp builds significantly better ships than a level 1
- `schematic_bonuses` are summed from all schematics the corp owns targeting this stat
- `random(0.8, 1.2)` represents manufacturing variance — same corp, same role can produce slightly different ships

---

## Size Variants

When commissioning, the player selects a size variant. All multipliers are applied to size, cost, and build duration simultaneously.

| Variant | Size Multiplier | Cost Multiplier | Build Time Multiplier |
|---|---|---|---|
| Light | ×0.75 | ×0.75 | ×0.75 |
| Standard | ×1.0 | ×1.0 | ×1.0 |
| Heavy | ×1.25 | ×1.25 | ×1.25 |

Space industry requirement at the building colony:

```
required_space_infra = base_size × size_multiplier
```

---

## Derived Stats

Calculated from primary stats after generation:

```
hull_points      = size × 5 + defence × 10 + schematic_bonuses + role_bonuses
power_projection = floor(size × 1.5) + schematic_bonuses + role_bonuses
bp_per_turn      = max(1, floor(size / 3)) + schematic_bonuses + role_bonuses
base_build_time  = max(3, floor(size × 1)) + schematic_bonuses + role_bonuses
```

---

## Ship Abilities

Primary stats are combined into three ability scores that determine mission fitness. Abilities are displayed during mission planning and used during mission resolution.

```
Fight         = floor((Firepower + floor(Defence × 0.75) + floor(Evasion × 0.5)) × Size / 2)
Investigation = floor((floor(Speed × 0.75) + Detection) × Size / 2)
Support       = floor((floor(Firepower × 0.5) + floor(Detection × 0.75)) × Size / 2)
```

| Ability | Used For |
|---|---|
| Fight | Assault, Defense missions |
| Investigation | Investigation, Rescue missions |
| Support | Escort missions |

---

## Captain Experience

Every ship has an assigned captain. Captain experience level provides a combat modifier.

| Level | Combat Modifier | Earned After |
|---|---|---|
| Green | ×0.8 | New captains (all start here) |
| Regular | ×1.0 | 2 missions completed |
| Veteran | ×1.1 | 5 missions completed |
| Elite | ×1.2 | 10 missions completed |

Captains are lost permanently when their ship is destroyed (KIA/MIA). Their service record is preserved in a memorial.

---

## Ship Loss & Refit

**Loss is permanent.** When a ship's condition reaches 0%, it is removed from the game. The captain is lost. The service record is preserved.

**Refit** *(future feature, not implemented)*: A refit contract would rebuild a ship's stats using current tech baselines while preserving identity, service record, and captain. This would allow old ships to stay relevant as tech advances.

---

## Missions

Missions are the player's military interaction. Passive security is handled by Military infrastructure — missions are active player-initiated deployments.

### Mission Types

| Type | Purpose | Base BP/turn | Execution Duration | Ability Used |
|---|---|---|---|---|
| **Escort** | Protect a contract | 1 | Matches contract duration | Support |
| **Assault** | Attack a hostile target | 3 | 3–8 turns | Fight |
| **Defense** | Respond to a local threat | 2 | 1–3 turns | Fight |
| **Rescue** | Investigate a lost fleet | 2 | 2–5 turns | Investigation |
| **Investigation** | Explore an anomaly | 1 | 2–4 turns | Investigation |

### Mission Cost

```
total_bp_per_turn = base_bp_per_turn + fleet_surcharge
fleet_surcharge   = number of ships with size ≥ 7
```

### Mission Creation

1. Select mission type and target sector
2. Assemble task force from available government-owned ships (status: Stationed)
3. Review cost and ability score vs. mission difficulty
4. Confirm — ships are set to OnMission status for the duration

### Task Force

- Any number of government-owned ships can be combined
- The highest-experience captain in the task force becomes commander
- Commander's personality will affect retreat threshold *(future mechanic)*
- Travel time = BFS shortest hop count from the task force's home sector to target sector (1 turn per hop)

### Mission Phases

```
Travel (travelTurns) → Execution (executionTurns) → Return (travelTurns) → Completed
```

Ships are unavailable during all three phases.

---

## Combat Resolution *(Semi-Abstracted)*

The player never directly controls combat. Combat is resolved automatically during the Mission phase when a mission enters Execution.

> **Prototype status**: A simplified version is implemented. Full phase-by-phase combat is a future story.

**Current prototype resolution:**
- Task force Fight score vs. threat difficulty
- Captain experience modifier applied
- Condition degrades based on outcome
- Ship destroyed if condition reaches 0%

**Planned full resolution (future):**

| Phase | Description |
|---|---|
| 1 — Initiative | Determine engagement order |
| 2 — Targeting | Assign targets based on role |
| 3 — Exchange Rounds | 3–5 rounds of combat; damage applied per round |
| 4 — Retreat Check | After round 3, evaluate retreat threshold |
| 5 — Aftermath | Condition updates, casualties recorded, report generated |

### Mission Reports

Short summary on completion: mission type, target, duration, task force composition, outcome, losses, damage sustained. Worst case: *"Task Force has not returned. Communications lost."*
