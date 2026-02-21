# Spacetime — Infrastructure & Market

> Defines resource types, infrastructure domains, production rules, caps, organic growth,
> sector market resolution, shortages, and cross-sector trade.
> For deposit definitions (what produces what) see `Planet.md`.
> For player investment cost see `Economy.md` (3 BP per level).

---

## Resources

Nine resource types circulate through the empire. There is no stockpiling — each turn is a clean flow calculation. Resources are either extracted from planet deposits, manufactured from other resources, or service-based.

### Extracted Resources *(from deposits via extraction infrastructure)*

| Resource | Extracted By |
|---|---|
| Food | Agricultural |
| Common Materials | Mining |
| Rare Materials | Deep Mining |
| Volatiles | Gas Extraction |

### Manufactured Goods *(from industry, require inputs)*

| Resource | Produced By | Requires |
|---|---|---|
| Consumer Goods | Low Industry | Common Materials |
| Heavy Machinery | Heavy Industry | Common Materials + Rare Materials |
| High-Tech Goods | High-Tech Industry | Rare Materials + Volatiles |
| Ship Parts | Space Industry | High-Tech Goods + Heavy Machinery |

### Services *(consumed locally, not traded between sectors)*

| Resource | Produced By |
|---|---|
| Transport Capacity | Transport |

---

## Infrastructure Domains

Infrastructure represents built capacity across 12 domains. Each domain has levels that are either **public** (player investment or organic growth — permanent) or **corporate-owned** (built by corporations spending Capital).

### Domain Definitions

| Domain | Produces | Consumes | Cap Rule |
|---|---|---|---|
| **Civilian** | — | — | Uncapped |
| **Mining** | Common Materials | — | Best matching deposit's max infra bonus |
| **Deep Mining** | Rare Materials | — | Best matching deposit's max infra bonus |
| **Gas Extraction** | Volatiles | — | Best matching deposit's max infra bonus |
| **Agricultural** | Food | — | Best matching deposit's max infra bonus |
| **Low Industry** | Consumer Goods | Common Materials | pop_level × 2 |
| **Heavy Industry** | Heavy Machinery | Common Materials + Rare Materials | pop_level × 2 |
| **High-Tech Industry** | High-Tech Goods | Rare Materials + Volatiles | pop_level × 2 |
| **Space Industry** | Ship Parts | High-Tech Goods + Heavy Machinery | pop_level × 2 |
| **Transport** | Transport Capacity | — | pop_level × 2 |
| **Science** | Research Points (RP) | — | pop_level × 2 |
| **Military** | Security Points (SP) | — | pop_level × 2 |

---

## Production Rules

### Extraction Domains (Mining, Deep Mining, Gas Extraction, Agricultural)

Per infrastructure level:
```
output = 1 unit of product
```

Extraction requires a matching deposit on the planet. No deposit → no investment allowed, no production.

### Manufacturing Domains (Low/Heavy/High-Tech/Space Industry)

Per infrastructure level:
```
input  = 1 unit of each required input resource
output = 1 unit of product
```

If inputs are in shortage (not enough supply in the sector), output is **halved** — not zeroed. The colony still functions at reduced capacity.

---

## Infrastructure Caps

| Domain | Cap Rule |
|---|---|
| Civilian | `next_population_level × 2` |
| Extraction domains (Mining, DeepMining, GasExtraction, Agricultural) | Best `max infra bonus` among all matching deposits on the planet (0 if no deposit — no investment possible) |
| All industry, Transport, Science, Military | `population_level × 2` |

Empire-wide infra cap bonuses from science discoveries (`empireBonuses.infraCaps`) are added on top of the base cap.

---

## Population Resource Consumption

Each turn, population consumes the following from the sector market:

| Resource | Consumption per Turn |
|---|---|
| Food | population_level |
| Consumer Goods | population_level |
| Transport Capacity | population_level |

These are consumed after internal colony production is accounted for.

---

## Organic Infrastructure Growth

Each turn during the Colony phase, for each colony with at least 1 existing infrastructure level:

```
organic_growth_chance = dynamism × 5 (%)
```

If triggered: +1 public-owned level added to a random eligible domain, weighted by current resource demand in the sector. High-dynamism colonies grow themselves over time.

---

## Player Direct Investment

The player can spend **3 BP** to add +1 public infrastructure level to any domain on any colony.

Validation rules (in order):
1. Colony must exist
2. Player must have ≥ 3 BP
3. For extraction domains: matching deposit must exist on the planet
4. Domain must be below its effective cap

The BP is deducted immediately when the player invests — not at end of turn.

---

## Sector Market Resolution

Each sector has its own isolated internal market. Trade resolves per-sector each turn during the Market phase (Phase 9), in five steps:

**Step 1 — Production**
All colonies in the sector calculate their production output for all resources.

**Step 2 — Internal Consumption**
Each colony consumes from its own production first, before contributing to the shared pool.

**Step 3 — Surplus to Market**
Remaining production (after self-consumption) flows into the sector's shared surplus pool.

**Step 4 — Deficit Purchasing**
Colonies sorted by **dynamism** (highest first) draw from the surplus pool to fill their deficits. High-dynamism colonies get priority access. This is the key mechanic — building up high-dynamism colonies ensures they weather shortages better.

**Step 5 — Shortage Resolution**
Unfilled deficits become shortages. Shortage maluses apply immediately and persist until the next turn's market resolution.

---

## Shortage Maluses

| Shortage | Effect |
|---|---|
| Food | -2 QoL, population decline risk |
| Consumer Goods | -1 QoL |
| Transport Capacity | -1 Accessibility |
| Industrial Inputs (any) | -50% output from the affected manufacturing domain |

Shortage is not binary stoppage — it is a penalty. Colonies under shortage continue to function at reduced effectiveness.

---

## Cross-Sector Trade

Trade between sectors requires a **Trade Route contract**: 2 BP/turn, ongoing, requires a Transport corporation (or Megacorp).

After each sector resolves internally (all 5 steps above), surplus flows between connected sectors:

```
cross_sector_efficiency = 50%
```

Surplus from sector A is available to sector B at 50% of its original volume. Dynamism-priority purchasing still applies across sectors. One trade route per sector pair. The player can cancel a trade route at any time.

**Without a trade route, sectors are economically isolated** — no surplus sharing, no cross-sector deficit filling.

---

## Market Visibility

The market dashboard shows per-sector, per-resource: production, consumption, surplus/deficit, per-colony breakdown, and cross-sector flows. This data is visible to the player and is also used by corporation AI when making investment decisions (corps invest in domains with active deficits).
