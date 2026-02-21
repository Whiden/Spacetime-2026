# Spacetime — Science, Discoveries, Patents & Schematics

> Defines the science system, domain advancement, discovery mechanics, patents, and schematics.
> For science infrastructure production see `Infrastructure.md`. For corp schematic effects on ships see `Ships.md`.

---

## Overview

Science is fully organic — the player does not direct research. Empire science output accumulates across domains, which unlock discovery pools, which science corporations draw from. Discoveries then feed into patents and schematics that make corporations and ships more capable over time.

---

## Science Output

```
empire_science_per_turn = sum of all Science infrastructure levels across all colonies
```

Every level of Science infrastructure contributes equally regardless of which colony it's on.

---

## Science Distribution

Science output is distributed evenly across all 9 domains each turn:

```
per_domain_base  = floor(empire_science_per_turn / 9)
per_domain_total = per_domain_base + focus_bonus_for_that_domain
```

### Focus

The player can focus one domain from the Science overview. Focused domains receive **double** science output that turn. Focus does not cost BP — it is a strategic allocation choice.

---

## Domain Advancement

Each domain accumulates science points independently. Level-up threshold:

```
threshold_to_next_level = current_level × 15
```

All domains start at level 0. Level 1 requires 10 accumulated science points. Level 5 requires 50.

### Science Domain Definitions

| Domain | Affects |
|---|---|
| **Society** | Colony management, stability, population |
| **Energy** | Power generation, shields |
| **Applied Sciences** | Infrastructure, construction |
| **Weaponry** | Weapons, combat |
| **Propulsion** | Thrusters, FTL, travel |
| **Construction** | Automation, habitability improvements, drones |
| **Life Sciences** | Habitability, food, medicine |
| **Materials** | Armor, construction materials |
| **Computing** | Sensors, targeting, AI |

### Technology Era Reference

| Level | Era |
|---|---|
| 0 | Space Age — Technology of today |
| 1 | New Age — Adapting to the new space frontier |
| 2 | Traveller Age — Faster, safer travel and exploration |
| 3 | Settler Age — Adapting to life on new worlds |
| 4+ | *To be defined* |

---

## Discoveries

When a domain reaches a new level, it adds a pool of possible discoveries. Each turn, science corporations roll:

```
discovery_chance = (corp_level × 5) + (corp_science_infrastructure × 2) %
```

Discoveries are surprises — the player does not see what is in the pool before a discovery is announced. Once a pool is exhausted, no more discoveries from that level until the next level is reached.

### What Discoveries Unlock

A discovery can:
- Improve empire-wide stats (applied to `empireBonuses` — affects all ships and infra caps uniformly)
- Increase the category level of possible patents
- Increase the category level of possible schematics
- Unlock specific new contract types or abilities (future stories)

### Discovery Pools *(Placeholder — full table to be defined during implementation)*

| Domain | Level | Discovery | Effects |
|---|---|---|---|
| Society | 1 | New Age Administration | TBD |
| Energy | 1 | Fusion Technology | TBD |
| Applied Sciences | 1 | Prefab Systems | TBD |
| Weaponry | 1 | Space-Compatible Railgun | TBD |
| Propulsion | 1 | Ion Drives | TBD |
| Construction | 1 | Autonomous Systems | TBD |
| Life Sciences | 1 | Space Treatments | TBD |
| Materials | 1 | Composite Armor | TBD |
| Computing | 1 | Basic AI | TBD |

---

## Patents

Patents are general-purpose technological advantages owned by corporations of any type. They improve how a corporation operates — increasing capital gain, combat effectiveness, or operational output.

### Patent Properties

| Property | Description |
|---|---|
| Name | Procedurally generated |
| Domain | Patent category (see table below) |
| Bonus | Stat effect (capital per turn, fight bonus, etc.) |
| Level | Tied to discovery category level when generated |
| Owner | The corporation that developed it |

### Patent Acquisition

Each turn, any corporation rolls for patent development:

```
patent_chance       = (corp_level × 2) %
max_patents_for_corp = floor(corp_level / 2)
```

When triggered, the game selects an appropriate patent category for the corp type, checks the current level of that category (set by discoveries), and generates a patent with stats scaled to that level.

### Patent Domains

| Patent Domain | Bonus per Level |
|---|---|
| Construction | +1 capital per turn |
| Exploration | +1 capital per turn |
| Production | +1 capital per turn |
| Combat | +1 bonus to fight score |
| Logistics | +1 capital per turn |
| Extraction | +1 capital per turn |
| Research | +1 capital per turn |
| Sociology | +1 capital per turn |
| Automation | +1 capital per turn |
| Security | +1 capital per turn |
| Marketing | +1 capital per turn |
| Civil Transport | +1 capital per turn |
| Civil Cargo | +1 capital per turn |
| Civil Personal Ship | +1 capital per turn |

*TODO: Add more variety to bonuses beyond capital per turn.*

### Patent Inheritance

- Corp acquired → buyer inherits all patents
- Corp dissolves → patents are lost permanently

---

## Schematics

Schematics are unique equipment blueprints owned exclusively by **shipbuilding corporations**. Unlike patents, schematics directly modify every ship that corp builds — they represent specific weapons, reactors, armor systems, or other hardware.

### Schematic Properties

| Property | Description |
|---|---|
| Name | Procedurally generated (e.g., "Hydra Missile", "Typhoon Reactor") |
| Category | Schematic domain (see table below) |
| Stat Bonus | Which ship stat is affected and by how much |
| Level | Tied to discovery category level when generated |
| Owner | The shipbuilding corporation that developed it |

### Schematic Acquisition

Each turn, shipbuilding corporations roll:

```
schematic_chance       = (corp_level × 2) %
max_schematics_for_corp = floor(corp_level / 2)
```

When triggered, the game selects a schematic category, checks the available category level (set by discoveries), and generates a schematic with stats scaled to that level.

### Schematic Domains

| Schematic Category | Ship Stat Bonus |
|---|---|
| Hull | +1 Defence |
| Sensor | +1 Detection |
| Armor | +1 Defence |
| Shield | +1 Defence |
| Turret | +1 Firepower |
| Missile | +1 Firepower |
| Reactor | +1 Speed |
| Engine | +1 Speed |
| Targeting Systems | +1 Firepower |
| Fighter | +1 Firepower |
| Bomber | +1 Firepower |
| Gunship | +1 Firepower |
| Electronic Systems | +1 Detection |

*TODO: Add more categories and more variety to stat bonuses.*

### Schematic Leveling

Unlike patents, schematics **update** when their category advances to the next level (from a new discovery). All existing schematics in that category have their base stats updated. The schematic is renamed with a mark suffix (MkII, MkIII, etc.) to indicate the iteration. Random variation bonuses applied at generation are preserved.

### Schematic Inheritance

- Corp acquired → buyer inherits all schematics
- Corp dissolves → schematics lost permanently

### Application to Ships

When a ship is built, the building corp's current schematics are applied to it as permanent modifiers (snapshotted at build time). The ship retains those schematic bonuses for its entire lifespan, even if the corp later acquires better schematics or is dissolved.
