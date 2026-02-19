# Spacetime — Changelog

## Story 14.3: Schematic Generation (2026-02-19)

### Added
- `src/generators/schematic-generator.ts` — Schematic development engine for shipbuilding corporations
  - `calculateSchematicChance(corpLevel)` — `corp_level × 2` %
  - `getMaxSchematics(corpLevel)` — `floor(corp_level / 2)` cap
  - `getAllUnlockedCategories(scienceDomains)` — Collects unlocked categories across all domains
  - `findDomainForCategory()` / `findDiscoveryForCategory()` — Lookup helpers
  - `generateSchematicName()` — Name from prefix + category + Mk iteration suffix
  - `generateSchematic()` — Creates Schematic with level-based bonus + random modifier
  - `rollForSchematic()` — Full development roll: chance, cap check, category selection, replacement
  - `updateSchematicsOnDomainLevelUp()` — Versioning: recalculates bonus, preserves random modifier, increments iteration
- `src/__tests__/generators/schematic-generator.test.ts` — 29 unit tests covering all acceptance criteria

### Modified
- `src/types/science.ts` — Added `randomModifier` and `iteration` fields to `Schematic` interface

## Story 14.2: Discovery System (2026-02-19)

## Story 14.1: Science Simulation (2026-02-19)
