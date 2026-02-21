# Spacetime — Planets & Colonies

> Defines planet generation (types, sizes, features, deposits), planet lifecycle, colony mechanics,
> colony attributes and formulas, and population mechanics.
> For resource definitions and what deposits produce see `Infrastructure.md`.
> For colonization contract rules see `Contracts.md`.

---

## Planet Overview

Planets are discovered through exploration and defined by four properties:
**type** (habitability + deposit pools), **size** (population cap + slots), **features** (special attribute modifiers), and **deposits** (extractable resources). A planet exists before a colony and can exist without one indefinitely.

### Planet Status Lifecycle

```
Undiscovered → OrbitScanned → GroundSurveyed → Accepted → Colonized
                                              ↘ Rejected
```

- **Undiscovered**: Exists in the galaxy but not yet found
- **OrbitScanned**: Found by an exploration contract. Partial data (type, size, orbit-visible features)
- **GroundSurveyed**: Full data (all features, exact deposits, exact habitability)
- **Accepted**: Player has flagged for colonization. Available for Ground Survey and Colonization contracts
- **Rejected**: Hidden from UI. Future: may be settled by independent corps
- **Colonized**: Has an active colony

---

## Planet Types

| Type | Base Habitability | Spawn Weight |
|---|---|---|
| Continental | 8 | 8% |
| Jungle | 6 | 7% |
| Water | 5 | 6% |
| Swamp | 4 | 8% |
| Arid | 4 | 10% |
| Tundra | 3 | 10% |
| Rocky | 2 | 15% |
| Volcanic | 2 | 10% |
| Barren | 1 | 20% |
| Gas Giant | 0 | 6% |

---

## Planet Sizes

| Size | Max Population Level | Deposit Slots | Feature Slots | Spawn Weight |
|---|---|---|---|---|
| Tiny | 4 | 1–3 | 1 | 15% |
| Small | 5 | 2–4 | 1–2 | 25% |
| Medium | 8 | 3–5 | 2–3 | 30% |
| Large | 9 | 4–6 | 2–4 | 20% |
| Huge | 10 | 5–8 | 3–5 | 10% |

---

## Deposits

Deposits are natural resources present on a planet. A planet can have several deposits, including multiple of the same type. Deposits determine which extraction infrastructure domains can be built and their caps.

*What each deposit produces and which infrastructure extracts it — see `Infrastructure.md`.*

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

### Deposit Pools by Planet Type

| Type | Guaranteed | Common (70%) | Uncommon (30%) | Rare (10%) |
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

## Planet Features

Features are special traits that modify colony attributes. Generated when a planet is generated. Some are visible on orbit scan; others require a ground survey.

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

## Colony Types

Colony type is set by the colonization contract and determines the starting infrastructure package and a permanent passive bonus. The type label can be renamed by the player (cosmetic only) — the passive bonus persists.

| Type | Starting Infrastructure | Starting Population | Base BP/turn | Base Duration |
|---|---|---|---|---|
| **Frontier Colony** | Civilian 10, Low Industry 1, Agricultural 1 (if possible) | 5 | 2 | 15 |
| **Mining Outpost** | Civilian 8, Mining/DeepMining/GasExtraction 3 (if deposit available) | 4 | 2 | 6 |
| **Science Outpost** | Civilian 6, Science 3 | 5 | 3 | 10 |
| **Military Outpost** | Civilian 8, Military 3 | 5 | 3 | 8 |

---

## Colony Attributes

A colony has six core attributes, all clamped 0–10 (except Growth, which is unbounded). They are recalculated every turn during the Colony phase.

Feature modifiers are applied through the modifier system: additive modifiers first, then multiplicative, then clamped.

---

### Habitability

Mostly static — set by planet type base and feature modifiers at founding.

```
habitability = base_from_planet_type + feature_modifiers
```

---

### Accessibility

Driven by transport infrastructure.

```
accessibility = 3 + floor(transport_infrastructure / 2) + feature_modifiers
```

---

### Dynamism

Economic energy — driven by accessibility, population, and corporate activity.

```
dynamism = floor((accessibility + population_level) / 2)
         + min(3, floor(total_corporate_infrastructure / 10))
         + feature_modifiers
```

---

### Quality of Life (QoL)

Starts at 10 and degrades with problems.

```
qol_hab_malus      = floor(max(0, 10 - habitability) / 3)
qol_shortage_malus = shortage_count
qol                = 10 - qol_hab_malus - qol_shortage_malus + feature_modifiers
```

---

### Stability

Starts at 10 and degrades with problems.

```
stability_qol_malus      = max(0, 5 - qol)
stability_debt_malus     = floor(empire_debt_tokens / 2)
stability_shortage_malus = shortage_count
stability_military_bonus = min(3, floor(military_infrastructure / 3))
stability                = 10
                         - stability_qol_malus
                         - stability_debt_malus
                         - stability_shortage_malus
                         + stability_military_bonus
                         + feature_modifiers
```

`empire_debt_tokens` is read directly from `gameState.debtTokens` — not from a modifier.

---

### Growth

Progress toward the next population level. Unbounded accumulator — transitions trigger at +10 (up) and -1 (down).

```
growth_hab_malus = floor(max(0, 10 - habitability) / 3)
growth_per_turn  = floor((qol + stability + accessibility) / 3)
                 - 3
                 - growth_hab_malus
                 + feature_modifiers
```

---

## Population Mechanics

- Growth accumulates each turn from the formula above.
- **Level up**: Growth ≥ 10 AND civilian infrastructure ≥ `next_pop_level × 2` → pop level +1, Growth resets to 0.
- **Level down**: Growth reaches -1 → pop level -1, Growth resets to 9.
- Population is capped by planet size (see size table above for max pop per size).

---

## Colony Abandonment

The player can abandon a struggling colony at any time:
- Population departs
- Planet reverts to GroundSurveyed status
- All infrastructure is lost
- Can be recolonized later via a new Colonization contract
