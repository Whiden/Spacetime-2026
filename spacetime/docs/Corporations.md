# Spacetime — Corporations

> Defines corporation types, capital system, AI investment behavior, lifecycle, and personality traits.
> For contract eligibility rules see `Contracts.md`. For corp tax formula see `Economy.md`.

---

## Overview

Corporations are autonomous AI-driven entities that perform all economic, scientific, military, and infrastructure activity in the game. The player interacts with them through contracts and investment — never through direct command. Corporations have their own capital, make their own investment decisions, and can grow, merge, or dissolve independently of the player.

---

## Corporation Properties

| Property | Description |
|---|---|
| Name | Procedurally generated |
| Type | Primary specialization (see types table below) |
| Level | 1–10 |
| Capital | Financial reserves, used for corp actions |
| Personality | 1–2 random traits (see traits table below) |
| Home Planet | Planet where it was founded |
| Assets | Infrastructure owned, ships, schematics, patents |

---

## Corporation Types

| Type | Invests In | Special Abilities |
|---|---|---|
| **Exploitation** | Mining, Deep Mining, Gas Extraction | Can commission Mining Outpost |
| **Construction** | Civilian | Can colonize — the only type eligible for Colonization contracts |
| **Industrial** | Low Industry, Heavy Industry, High-Tech Industry | — |
| **Shipbuilding** | Space Industry | Designs blueprints, builds ships, develops schematics |
| **Science** | Science | Achieves discoveries, develops patents, can commission Science Outpost |
| **Transport** | Transport | Can create Trade Routes |
| **Military** | Military | Executes missions, commissions ships, can commission Military Outpost |
| **Exploration** | — | Can explore sectors and conduct ground surveys |
| **Agriculture** | Agricultural | — |

---

## Capital System

Capital represents a corporation's financial reserves. It is distinct from the player's BP — corps accumulate and spend Capital independently.

### Capital Gain Per Turn

```
random_gain          = random(0, 1)
infrastructure_gain  = floor(total_owned_infrastructure / 10)
capital_gain         = random_gain + infrastructure_gain
```

### Contract Completion Bonus (awarded once, on completion)

```
completion_bonus = floor((bp_per_turn × duration) / 5)
```

### Capital Sources Summary

| Source | Capital Gained |
|---|---|
| Each turn (passive) | 0 or 1 (random) |
| Infrastructure holdings | floor(total_infra / 10) per turn |
| Contract completion | floor((bp_per_turn × duration) / 5) |
| Discovery achieved | discovery_level × 2 |

### Corporation Actions and Costs

| Action | Requirement | Capital Cost |
|---|---|---|
| Buy infrastructure | None | 2C |
| Level up | corp.level < 10 | current_level × 3C |
| Acquire corporation | corp.level ≥ 6 | target.level × 5C |
| Commission ship | None | base_bp × base_duration |
| Settle outpost | None | base_bp × base_duration |

### Maximum Infrastructure Owned

```
max_infrastructure = corp_level × 4
```

---

## Level Thresholds

| Level | Unlocks |
|---|---|
| 1 | Execute contracts; invest in own-type infrastructure |
| 3 | Invest in any infrastructure domain (own type gets priority); take cross-type contracts |
| 6 | **Megacorp**: unrestricted investment, can acquire other corporations |

---

## Megacorp Transition

At level 6 a corporation becomes a Megacorp:
- Can invest in **any** infrastructure type, not just its specialty
- Can execute any contract type
- Can acquire other corporations

---

## Lifecycle

### Founding

A corporation can be created two ways:
- **Player-initiated**: The player kickstarts a new startup when creating a contract. The startup is assigned to that contract immediately and begins at level 1.
- **Organic emergence**: Each turn, any colony with dynamism ≥ 6 has a chance to spawn a new corporation autonomously.

### Organic Emergence

```
emergence_chance = (dynamism - 5) × 10%
```

The new corp type is determined by the colony's most prominent infrastructure domain with independent levels. The new corp receives one independent-owned infrastructure level as its first asset (transfers from independent to corporate ownership).

### Leveling Up

Costs `current_level × 3` Capital. Corps accumulate capital through passive income and contract bonuses and spend it when the threshold is met.

### Mergers & Acquisitions

A corp at level 6+ can acquire another corp for `target_level × 5` Capital.

- A target corp **can refuse** acquisition if its level is within 2 of the buyer's level.
- On successful acquisition: buyer gains all target assets and infrastructure, buyer gains 1 level, target ceases to exist.
- **Patent and schematic inheritance**: All patents and schematics transfer to the buyer on acquisition. If a corp dissolves without being acquired, its patents and schematics are lost permanently.

---

## Investment AI

Each turn during the Corp phase, corporations with Capital ≥ 2 evaluate whether to invest. They process in order of level — **highest level first**.

**Decision loop:**

1. Check the sector market for resource deficits
2. Select a deficit randomly, weighted by severity
3. Find the highest-dynamism colony in the sector with:
   - Available infrastructure slots (below corp's max)
   - Not at population cap
   - Required inputs not in deficit (for manufacturing domains)
4. If found: buy one infrastructure level (cost: 2 Capital)
5. If not found: skip investment this turn

**Domain restriction by level:**
- Below level 3: invest only in own-type infrastructure
- Level 3+: invest in any domain (own type gets priority weighting)

---

## Personality Traits

Each corporation has 1–2 traits assigned at generation. Currently flavor — mechanical effects are planned for future stories.

| Trait | Future Mechanical Effect |
|---|---|
| **Cautious** | Avoids risky contracts, retreats earlier in combat |
| **Aggressive** | Targets bigger contracts, holds in combat longer |
| **Innovative** | Creates better schematics, invests in new sectors |
| **Conservative** | Invests in safe, established colonies |
| **Opportunistic** | Diversifies early, settles rejected planets |
| **Ethical** | Avoids exploitation contracts, popular with population |
| **Ruthless** | Triggers corporate conflict events more often |
| **Efficient** | Lower infrastructure maintenance costs |

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
