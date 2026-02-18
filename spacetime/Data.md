Spacetime — Game Data Reference

> This document defines all concrete game data: types, tables, spawn rules, costs, and formulas tied to specific entities. This is the implementation reference for `src/data/` files. All numbers are initial values subject to playtesting.

---

## Table of Contents

1. [Resources]
2. [Deposits]
3. [Planet Types]
4. [Planet Sizes]
5. [Planet Features]
6. [Colony Types]
7. [Infrastructure Domains]
8. [Corporation Types]
9. [Corporation Personality Traits]
10. [Contract Types]
11. [Ship Roles]
12. [Schematics]
13. [Science Domains & Discoveries]
14. [Patents]
15. [Mission Types]
16. [Sector Generation]
17. [Start Conditions]

---

## 1. Resources

### Extracted Resources (from deposits via extraction infrastructure)

Food 
Common Materials
Rare Materials
Volatiles

### Manufactured Goods (from industries, require inputs)

Consumer Goods
Heavy Machinery
High-Tech Goods
Ship Parts

### Services (from industries)

Transport Capacity

---

## 2. Deposits

Deposits are natural resources present on planets. There can be several, even of the same type.

### Deposit Types

| Deposit | Produces | Extracted By | Max Infra Bonus | Found On |
|---|---|---|---|---|
| **Fertile Ground** | Food | Agricultural | +6 | Continental, Jungle, Swamp, Water |
| **Rich Ocean** | Food | Agricultural | +4 | Water, Continental, Swamp |
| **Fungal Networks** | Food | Agricultural | +3 | Tundra, Rocky, Barren |
| **Thermal Vent Ecosystem** | Food | Agricultural | +3 | Volcanic, Water |
| **Common Ore Vein** | Common Materials | Mining | +5 | Continental, Rocky, Barren, Volcanic, Tundra |
| **Carbon-Based Land** | Common Materials | Mining | +4 | Continental, Jungle, Swamp |
| **Surface Metal Fields** | Common Materials | Mining | +3 | Arid, Barren, Tundra |
| **Glacial Deposits** | Common Materials | Mining | +3 | Tundra, Water |
| **Rare Ore Vein** | Rare Materials | Deep Mining | +4 | Rocky, Volcanic, Barren, Arid |
| **Crystal Formations** | Rare Materials | Deep Mining | +3 | Rocky, Volcanic, Arid |
| **Tectonic Seams** | Rare Materials | Deep Mining | +5 | Volcanic, Rocky |
| **Ancient Seabed** | Rare Materials | Deep Mining | +3 | Arid, Barren, Continental |
| **Gas Pocket** | Volatiles | Gas Extraction | +4 | Gas Giant, Volcanic, Tundra |
| **Subsurface Ice Reserves** | Volatiles | Gas Extraction | +3 | Tundra, Barren, Rocky |
| **Volcanic Fumaroles** | Volatiles | Gas Extraction | +5 | Volcanic |
| **Atmospheric Layers** | Volatiles | Gas Extraction | +6 | Gas Giant |

---

## 3. Planet Types

### Type Definitions

| Type | Base Habitability | Spawn Weight |
|---|---|---|
| Continental | 8 |  8% |
| Jungle | 6 | 7% |
| Water | 5 | 6% |
| Swamp | 4 | 8% |
| Arid | 4 | 10% |
| Tundra | 3 | 10% |
| Rocky | 2 | 15% |
| Volcanic | 2 | 10% |
| Barren | 1 | 20% |
| Gas Giant | 0 | 6% |

### Deposit Pools by Planet Type

| Type | Guaranteed (1)| Common (70%) | Uncommon (30%) | Rare (10%) |
|---|---|---|---|---|
| Continental | — | Fertile Ground, Common Ore Vein | Carbon-Based Land, Rich Ocean, Ancient Seabed | Rare Ore Vein |
| Jungle | Fertile Ground | Carbon-Based Land | Common Ore Vein | Rare Ore Vein |
| Water | Rich Ocean | Fertile Ground, Thermal Vent Ecosystem | Glacial Deposits | Common Ore Vein |
| Swamp | — | Fertile Ground, Carbon-Based Land | Rich Ocean | Common Ore Vein |
| Arid | Surface Metal Fields | Rare Ore Vein | Crystal Formations, Ancient Seabed | Gas Pocket |
| Tundra | — | Common Ore Vein, Gas Pocket | Surface Metal Fields, Subsurface Ice Reserves, Glacial Deposits | Fungal Networks, Rare Ore Vein |
| Rocky | Common Ore Vein | Rare Ore Vein | Crystal Formations, Tectonic Seams, Subsurface Ice Reserves | Fungal Networks |
| Volcanic | — | Rare Ore Vein, Gas Pocket, Volcanic Fumaroles | Common Ore Vein, Tectonic Seams, Crystal Formations | Thermal Vent Ecosystem, Carbon-Based Land |
| Barren | — | Common Ore Vein | Surface Metal Fields, Rare Ore Vein, Subsurface Ice Reserves | Fungal Networks, Ancient Seabed |
| Gas Giant | Atmospheric Layers | Gas Pocket | — | Rare Ore Vein |

---

## 4. Planet Sizes

| Size | Max Population Level | Deposit Slots | Feature Slots | Spawn Weight |
|---|---|---|---|---|
| Tiny | 4 | 1–3 | 1 | 15% |
| Small | 5 | 2–4 | 1–2 | 25% |
| Medium | 8 | 3–5 | 2–3 | 30% |
| Large | 9 | 4–6 | 2–4 | 20% |
| Huge | 10 | 5–8 | 3–5 | 10% |

---

## 5. Planet Features

Features are special traits that modify colony attributes and gameplay. They are generated when a planet is discovered. Some are revealed on orbit scan, others only on ground survey.

### Feature Definitions

| Feature | Attribute Modifiers | Visibility | Spawn Conditions | Spawn Chance |
|---|---|---|---|---|
| **Temperate Climate** | Habitability +1, +5 max Agricultural | Orbit | Continental, Jungle | 20% |
| **Extreme Seasons** | Habitability -1, Stability -1 | Orbit | Tundra, Arid | 20% |
| **Fertile Plains** | +5 max Agricultural | Ground | Continental, Jungle, Swamp | 20% |
| **Mineral Veins** | +5 max Mining | Ground | Rocky, Volcanic, Arid | 20% |
| **Geothermal Activity** | +5 max Gas Extraction, Dynamism +1 | Ground | Volcanic, Tundra | 20% |
| **Vast Oceans** | +5 max Agricultural, -1 max population size | Orbit | Continental | 20% |
| **Mountain Ranges** | +3 max Deep Mining | Orbit | Continental, Rocky, Tundra | 20% |
| **Dense Atmosphere** | Habitability -1, +3 max Gas Extraction | Orbit | Jungle, Swamp, Gas Giant | 20% |
| **Low Gravity** | Habitability -1, Accessibility +1 | Orbit | Barren, Rocky, Tiny planets | 20% |
| **High Gravity** | Habitability -1, Accessibility -1, +0.5 Deep Mining output | Orbit | Large/Huge planets | 20% |
| **Toxic Environment** | Habitability -2, +3 max Gas Extraction | Orbit | Volcanic, Swamp, Barren | 20% |
| **Strategic Location** | Accessibility +2 | Orbit | Any | 5% |
| **Remote Location** | Accessibility -2 | Orbit | Any | 5% |
| **Rich Biosphere** | Habitability +1, QoL +1 | Ground | Continental, Jungle, Water | 20% |
| **Unstable Tectonics** | Stability -1, Habitability -1 | Ground | Volcanic, Rocky | 20% |
| **Pristine Environment** | QoL +2 | Ground | Continental, Water, Jungle | 10% |
| **Harsh Radiation** | Habitability -2 | Orbit | Barren, Rocky | 20% |
| **Natural Caverns** | Dynamism +1, +3 max Mining | Ground | Rocky, Barren, Tundra | 20% |
| **Rare Crystals** | Dynamism +1, QoL +1 | Ground | Rocky, Volcanic | 5% |
| **Deep Gas Pockets** | +5 max Gas Extraction, +0.5 Gas Extraction output | Ground | Gas Giant, Volcanic, Tundra | 20% |
| **Underground Rivers** | +3 max Agricultural | Ground | Barren, Rocky, Arid | 20% |
| **Metallic Core** | +0.5 Mining output | Ground | Rocky, Volcanic, Barren | 20% |
| **Perpetual Storms** | Habitability -1, Stability -1, +0.5 Gas Extraction output | Orbit | Gas Giant, Water, Jungle | 20% |
| **Frozen Wastes** | Habitability -1, +3 max Mining | Orbit | Tundra, Barren | 20% |
| **Tidal Locked** | Habitability -2, Dynamism +1, +3 max Mining | Orbit | Rocky, Barren | 15% |
| **Ancient Ruins** | Dynamism +2, +5 max Science | Ground | Any | 3% |
| **Subterranean Ocean** | +5 max Agricultural, Habitability +1 | Ground | Tundra, Rocky, Barren | 10% |
| **Magnetic Anomalies** | -3 max Science, +5 max Deep Mining | Ground | Rocky, Volcanic, Arid | 15% |
| **Dense Canopy** | +3 max Agricultural, Accessibility -1 | Ground | Jungle, Swamp | 20% |
| **Shallow Crust** | +3 max Mining, +3 max Deep Mining, Stability -1 | Ground | Volcanic, Arid, Rocky | 15% |
| **Orbital Debris Ring** | Accessibility -1, +3 max Space Industry | Orbit | Any | 5% |
| **Abundant Wildlife** | QoL +1, +3 max Agricultural | Ground | Continental, Jungle, Water, Swamp | 15% |
| **Dust Storms** | Habitability -1, Accessibility -1 | Orbit | Arid, Barren | 20% |
| **Auroral Activity** | QoL +1 | Orbit | Tundra, Gas Giant | 15% |
| **Dormant Supervolcano** | Stability -2, Dynamism +1, +5 max Gas Extraction | Ground | Volcanic, Rocky | 10% |
| **Precious Metals Vein** | +0.5 Deep Mining output, Dynamism +1 | Ground | Arid, Rocky, Continental | 10% |
| **Collapsed Star Fragment** | +0.5 Deep Mining output, +0.5 Mining output, Habitability -1 | Ground | Barren, Rocky | 5% |
| **Breathable Atmosphere** | Habitability +2 | Orbit | Continental, Jungle | 10% |
| **Coral Reefs** | +5 max Agricultural, QoL +1 | Ground | Water, Swamp | 15% |

---

## 6. Colony Types

Colony type is determined by the colonization contract. Each type provides a **starting infrastructure package** and a **permanent passive bonus**. The type label can be renamed by the player after founding (cosmetic only), but the passive bonus persists.

### Colony Type Definitions

| Type | Starting Infrastructure | Starting Population | BP/turn Cost | Duration |
|---|---|---|---|---|
| **Frontier Colony** | Civilian 10, Low Industry 1, Agricultural (if possible) 1 | 5 | 2 | 15 turns |
| **Mining Outpost** | Civilian 8, Mining/Deep Mining/Gas Extraction (if possible) 3 | 4 | 2 | 6 turns |
| **Science Outpost** | Civilian 6, Science 3 | 5 | 3 | 10 turns |
| **Military Outpost** | Civilian 8, Military 3 | 5 | 3 | 8 turns |

---

## 7. Infrastructure Domains

### Domain Definitions

| Domain | Produces | Consumes | Cap Rule | 
|---|---|---|---|
| **Civilian** | — | — | Uncapped |
| **Mining** | Common Materials | — | Max mining |
| **Deep Mining** | Rare Materials | — | Max Deep mining |
| **Gas Extraction** | Volatiles | — | Max Gas Extraction | 
| **Agricultural** | Food | — | Max agricultural | 
| **Low Industry** | Consumer Goods | Common Materials | pop_level × 2 | 
| **Heavy Industry** | Heavy Machinery | Common Materials + Rare Materials | pop_level × 2 |
| **High-Tech Industry** | High-Tech Goods | Rare Materials + Volatiles | pop_level × 2 |
| **Space Industry** | Ship Parts | High-Tech Goods + Heavy Machinery | pop_level × 2 | 
| **Transport** | TC (Transport capacity) | — | pop_level × 2 |
| **Science** | RP (Research points)| — | pop_level × 2 | 
| **Military** | SP (Security points) | — | pop_level × 2 | 

### Consumption by Population

| Resource | Consumption per Turn |
|---|---|
| Food | population_level |
| Consumer Goods | population_level |
| Transport Capacity | population_level |

---

## 8. Corporation

### Corporation types

| Type | Infrastructures | Special |
|---|---|---|
| **Exploitation** | Mining, Deep Mining, Gas Extraction | can commission mining outpost |
| **Construction** | Civilian | Can build outpost and colonies |
| **Industrial** | Low Industry, Heavy Industry, High-tech Industry| |
| **Shipbuilding** | Space Industry | Designs blueprints, ships models and builds ships |
| **Science** | Science | Can achieves discoveries and own patents, can commission science outpost |
| **Transport** | Transport | Can create trade routes |
| **Military** | Military | Can execute missions, can commission ships, can commission military outpost |
| **Exploration** | — | Can explore and survey |
| **Agriculture** | Agricultural | |

### Corporation Capital

### Corporation Actions
| Action | Requirements | Costs (Capital) |
|---|---|---|
| Buy infrastructure | None | 2C |
| Level up | corp.level < 10 | level × 3C |
| Buy corporation | corp.level >= 6 | target.level × 5C |
| Buy ship | None | varies by ship class |
| Settle outpost | None | varies by outpost type |

**Getting capital:**

| Source | Capital Revenue |
|---|---|
| Each turn | 0 to 1 |
| Discovery achieved | discovery level * 2 |
| Contract finished | contract_duration * contract_cost_per_turn / 5 |
| Infrastructure | total_infra / 10 |


**Level thresholds for abilities:**

| Level | Unlocks |
|---|---|
| 1 | Can execute contracts, invest in own type infrastructure |
| 3 | Can invest in any infrastructure (own type gets priority) |
| 6 | Megacorp: unrestricted investment, can acquire corps |

---

## 9. Corporation Personality Traits

Each corporation has 1-2 personality traits that influence behavior. For now, this is just flavor

| Trait  | Future Effects |
|---|---|---|
| **Cautious** | Avoids risky contracts, retreats earlier in combat |
| **Aggressive** | Targets bigger contracts, holds in combat longer |
| **Innovative** | Creates better schematics, invests in new sectors |
| **Conservative** | Invests in safe, established planets |
| **Opportunistic** | Diversifies early, settles rejected planets |
| **Ethical** | Avoids exploitation, popular with population |
| **Ruthless** | Triggers corporate conflict events more often |
| **Efficient** | Lower infrastructure maintenance |

### Trait Spawn Weights

| Trait | Weight |
|---|---|
| Cautious | 15% |
| Aggressive | 15% |
| Innovative | 10% |
| Conservative | 15% |
| Opportunistic | 15% |
| Ethical | 10% |
| Ruthless | 10% |
| Efficient | 10% |

Corps receive 1 trait (70% chance) or 2 traits (30% chance). Conflicting pairs are excluded: Cautious/Aggressive, Innovative/Conservative, Ethical/Ruthless.

---

## 10. Contract Types

### Contract Definitions

| Type | Target | BP/turn | Base Duration | Corp Types Eligible | Description |
|---|---|---|---|---|---|
| **Exploration** | Sector | 2 | 2-3 turns | Exploration | Explore sector, discover POIs |
| **Ground Survey** | Planet | 1 | 2 turns | Exploration | Reveal full planet data |
| **Colonization** | Planet | by colony type | by type | Construction | Establish new colony |
| **Ship Commission** | Colony (with space infra) | by size | by size | Shipbuilding | Build a ship for a role |
| **Trade Route** | Sector pair (adjacent) | 2 | Ongoing | Transport | 50% surplus sharing between sectors |

### Contract Success
Contract success is guaranteed (no failure for prototype). 

---

## 11. Ship Roles

### Role Definitions

| Role | Purpose | Base Size | Base Speed | Base Firepower | Base Armor | Base Sensors | Base Evasion |
|---|---|---|---|---|---|---|---|
| **System Patrol** | Local security, anti-piracy | 3 | 5 | 3 | 3 | 4 | 5 |
| **Escort** | Protect convoys and contracts | 4 | 4 | 4 | 5 | 3 | 3 |
| **Recon** | Scouting, intel gathering | 2 | 6 | 1 | 2 | 7 | 6 |
| **Assault** | Offensive combat operations | 6 | 3 | 7 | 6 | 3 | 2 |
| **Carrier** | Launch fighters, fleet support | 7 | 2 | 3 | 5 | 4 | 1 |
| **Flagship** | Command ship, power projection | 9 | 2 | 6 | 8 | 5 | 1 |

### Ship Properties

| Property | Description |
|---|---|
| Name | Unique, procedurally generated or player-named |
| Role | Ship role |
| Schematics applied | Unique schematics |
| Captain | Assigned captain with experience level |
| Condition | 0-100%, degrades from damage and age |
| Service Record | Missions completed, battles fought, kills |
| Status | Stationed, On Mission, Under Repair, Under Construction |
| Home Sector | Current stationed sector |
| Owner | Corporation or government |

### Captain Experience Levels

| Level | Combat Modifier | Acquisition |
|---|---|---|
| Green | ×0.8 | New captains |
| Regular | ×1.0 | After 2 missions |
| Veteran | ×1.1 | After 5 missions |
| Elite | ×1.2 | After 10 missions |

---

## 12. Schematics

Schematics are unique equipment blueprints developed by shipbuilding corporations from available discoveries.

### Schematic Properties

| Property | Description |
|---|---|
| Name | Procedurally generated (e.g., "Hydra Missile", "Typhoon Reactor") |
| Stat| stat affected |
| Bonus| value |
| Level | Level of the schematics |
| Owner | Corporation that developed it |

### Schematic domains

| Schematic Domain | Bonus per level |
|---|---|
| Hull | +1 Defence |
| Sensor | +1 Detection |
| Armor | +1 Defence |
| Shield | +1 Defence |
| Turret | +1 Firepower |
| Missile | +1 Firepower |
| Reactor | +1 Speed |
| Engine | +1 Speed |
| Targetting systems | +1 Firepower |
| Fighter | +1 Firepower |
| Bomber | +1 Firepower |
| Gunship | +1 Firepower |
| Electronic systems | +1 Detection |

TODO : Add more, add more variety to bonuses

---

## 13. Science Domains & Discoveries

### Science Domains

| Domain | Affects |
|---|---|
| **Society** | Colony management, stability, population |
| **Energy** | Power generation, shields |
| **Applied Sciences** | Infrastructure, construction |
| **Weaponry** | Weapons, combat |
| **Propulsion** | Thrusters, FTL, travel |
| **Construction** | Automation, Better isolation and habitability improvements, Drones |
| **Life Sciences** | Habitability, food, medicine |
| **Materials** | Armor, construction materials |
| **Computing** | Sensors, targeting, AI |

All domains start at level 0. Level 1 requires 10 accumulated science. Level 5 requires 50.

Level 0 : SpaceAge predation tech - Technology of today
Level 1 : New age tech - How to adapt to this new frontier that is space
Level 2 : Traveller age tech - How to travel faster, safer and explore
Level 3 : Settler age tech - How to adapt to life on new worlds
TODO : level 4+

### Discovery Pools

Each domain level unlocks several possible discoveries. Science corps draw from these pools.

```
discovery_chance_per_turn = (corp_level × 5) + (corp_science_infrastructure × 2) %
```

Discoveries will be defined in detail during implementation.

| Domain | Level | Discovery | Effects |
|---|---|---|---|
| Society | 1 | New Age Administration | |
| Energy | 1 | Fusion technology | |
| Applied Sciences | 1 | Prefab systems |  |
| Weaponry | 1 | Space compatible railgun |  |
| Propulsion | 1 | Ion drives |  |
| Construction | 1 | Autonomous systems |  |
| Life Sciences | 1 | Space treatments |  |
| Materials | 1 | Composite armor |  |
| Computing | 1 | Basic AI |  |

This part is placeholder, a better extensive table must be made

Each discovery enables one or more schematic types to be designed by corps.

---

## 14. Patents

Patents are unique production technique owned by corporations from available discoveries.

### Patent Properties

| Property | Description |
|---|---|
| Name | Procedurally generated |
| Stat| stat affected |
| Bonus| value |
| Level | Level of the patent |
| Owner | Corporation that developed it |

### Patent domains

| Patent Domain | Bonus per level |
|---|---|
| Construction | +1 capital per turn |
| Exploration |  +1 capital per turn |
| Production |  +1 capital per turn |
| Combat |  +1 bonus to fight |
| Logistics |  +1 capital per turn |
| Extraction | +1 capital per turn |
| Research | +1 capital per turn |
| Sociology | +1 capital per turn |
| Automation | +1 capital per turn |
| Security | +1 capital per turn |
| Marketing | +1 capital per turn |
| Civil transport |  +1 capital per turn |
| Civil cargo | +1 capital per turn |
| Civil personal ship | +1 capital per turn |


TODO : Add more, define naming rules, add more variety to bonuses

---

## 15. Mission Types

### Mission Definitions

| Type | Purpose | Base BP/turn | Duration |
|---|---|---|---|---|
| **Escort** | Protect a contract | 1 | Matches contract duration |
| **Assault** | Attack hostile target | 3 | 3-8 turns | 
| **Defense** | Respond to local threat | 2 | 1-3 turns |
| **Rescue** | Investigate lost fleet | 2 | 2-5 turns | 
| **Investigation** | Explore anomaly | 1 | 2-4 turns | 

---

## 16. Sector Generation

### Sector Properties

| Property | Range | Notes |
|---|---|---|
| Name | Procedural | From name pool |
| Adjacency | 2-4 connections | All sectors reachable |
| Exploration | 0-100% | Starts at 0% (except home sector) |
| Threat Modifier | 0.5 - 1.5 | Multiplier on threat events |

### Galaxy Generation Rules
- 10-15 sectors total
- Starting sector has 2-3 adjacent sectors
- 1-2 bottleneck sectors (only 2 connections)
- Max 4 connections per sector
- 3-5 hops to furthest sector from start
- All sectors reachable from start (connected graph)
- Starting sector starts at 10% explored with Terra Nova

---

## 17. Start Conditions

### Starting Planet: Terra Nova

| Property | Value |
|---|---|
| Name | Terra Nova |
| Type | Continental |
| Size | Large |
| Features | Temperate Climate, Fertile Plains, Strategic Location |
| Deposits | Fertile Ground (Rich), Common Ore (Moderate), Rare Ore (Poor) |

### Starting Colony

| Property | Value |
|---|---|
| Population Level | 7 |
| Colony Type | Frontier Colony |

### Starting Infrastructure

| Domain | Level | Ownership |
|---|---|---|
| Civilian | 14 | Indep |
| Exploitation | 2 | Indep |
| Agricultural | 3 | Indep |
| Low Industry | 2 | Indep |
| Transport | 2 | Indep |
| Science | 1 | Indep |
| Heavy Industry | 1 | Indep |
| High-Tech Industry | 1 | Indep |
| Space Industry | 1 | Indep |
| Military | 2 | Indep |

### Starting Galaxy
- 10-15 sectors procedurally generated
- Starting sector: 10% explored, contains Terra Nova
- Adjacent sectors: 0% explored, explorable immediately
- All other sectors: visible by name only, not yet explorable
- No corporations exist
- No ships exist
- All science domains at level 0

### Starting corporations
- One level 1 exploration
- One level 1 construction
- Two level 1 science (each owning one science level on Terra Nova)
---