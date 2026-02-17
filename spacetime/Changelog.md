# Spacetime — Changelog

---

## Epic 5: Budget System

### Story 5.2 — Budget Store (2026-02-17)

**What changed:**
- Created `src/stores/budget.store.ts` — Pinia store for budget state management
- Updated `src/types/budget.ts` — removed completed TODOs for Stories 5.1 and 5.2

**Store API:**
- **State**: `currentBP`, `incomeSources` (itemized), `expenseEntries` (itemized), `debtTokens`
- **Actions**: `initialize()` sets starting BP (10) and calculates initial income from Terra Nova; `calculateIncome()` iterates all colonies and corps to sum planet/corp taxes; `addExpense(type, sourceId, sourceName, amount)` tracks expense by source; `clearExpenses()` resets expense list; `applyDebt(deficit)` creates debt tokens: `floor(deficit / 3)`, min 1, capped at 10; `clearDebtToken()` removes 1 token, costs 1 BP; `adjustBP(amount)` directly modifies balance
- **Getters**: `totalIncome` (sum of income sources), `totalExpenses` (sum of expense entries), `netBP` (income - expenses), `stabilityMalus` (`floor(debtTokens / 2)`)

**Acceptance criteria met:**
- State: currentBP, income (itemized), expenses (itemized), debtTokens ✓
- Action: `calculateIncome()` sums all planet taxes + corp taxes ✓
- Action: `addExpense(source, amount)` tracks expense by source ✓
- Action: `applyDebt(deficit)` creates debt tokens: `floor(deficit / 3)`, min 1, capped at 10 total ✓
- Action: `clearDebtToken()` removes 1 token, costs 1 BP ✓
- Getter: `netBP` returns income - expenses ✓
- Getter: `stabilityMalus` returns `floor(debtTokens / 2)` ✓
- Initializes with 10 BP, income from Terra Nova ✓
- Corp tax wiring deferred to Story 6.2 (TODO in store) ✓
- `npx vue-tsc --noEmit` — zero TypeScript errors ✓
- `npm run test` — 174/174 tests pass ✓

---

### Story 5.1 — Tax Formulas (2026-02-17)

**What changed:**
- Created `src/engine/formulas/tax.ts` — planet tax and corporation tax calculation functions
- Created `src/__tests__/engine/formulas/tax.test.ts` — 21 unit tests

**Functions implemented:**
- `calculatePlanetTax(popLevel, habitability)`: computes planet tax income using Specs.md § 2 formula. `habitability_cost = max(0, 10 - habitability) × max(1, floor(pop_level / 3))`, then `planet_tax = max(0, floor(pop² / 4) - habitability_cost)`. Returns 0 for popLevel < 5.
- `calculateCorpTax(corpLevel)`: computes corporation tax as `floor(corpLevel² / 5)`. Level 1-2 corps naturally pay 0 (startup exemption).

**Acceptance criteria met:**
- `calculatePlanetTax(popLevel, habitability)` implements the planet tax formula from Specs.md § 2 ✓
- Higher population yields more tax, low habitability reduces it ✓
- Returns 0 for very low population or very low habitability ✓
- Verifies: pop 7 hab 9 = 10 BP, pop 5 hab 2 = 0 BP, pop 7 hab 2 = 0 BP ✓
- Returns 0 if popLevel < 5 ✓
- `npx vue-tsc --noEmit` — zero TypeScript errors ✓
- `npm run test` — 174/174 tests pass ✓

---

## Epic 4: Planets & Colonies — Data Model (Completed 2026-02-17)

Implemented planet generation and colony data structures (Stories 4.1-4.5). Built planet generator (`generatePlanet` — type/size by spawn weight, features from eligible pool with spawn chance, deposits from type's deposit pool with tiered chances and random richness). Built colony generator (`generateColony` — initializes colony from planet + colony type, applies starting infrastructure, registers planet feature modifiers and colony type passive bonus onto `colony.modifiers`, calculates initial attributes via `resolveModifiers()`). Created Pinia stores for planets (`planet.store.ts` — CRUD by ID/status/sector) and colonies (`colony.store.ts` — CRUD with Terra Nova initialization from start-conditions data). Wired colony presence into galaxy store's `explorableSectors` getter. Built Colony List View (`ColoniesView.vue` + `ColonyCard.vue` — clickable cards with attribute bars, growth progress, auto-initialization) and Colony Detail View (`ColonyDetailView.vue` + `AttributePanel.vue`, `InfraPanel.vue`, `ResourceFlow.vue` — two-column layout with modifier breakdown tooltips, infrastructure ownership, deposit/feature display, disabled Invest button).

**Key architecture decisions:**
- Colony generator supports `overrideInfrastructure` for Terra Nova's custom starting state
- Deposit-dependent starting infra only applied if planet has a matching deposit
- Attribute tooltips use `getModifierBreakdown()` for full source attribution
- Invest button disabled until budget system (Story 8.4)
- Shortage alerts deferred to Story 9.2

**Tests:** 153 passing (planet-generator: 25, colony-generator: 27, prior: 101)

---

## Epic 3: Galaxy Generation & Sectors (Completed 2026-02-17)

Implemented galaxy generation and display (Stories 3.1-3.4). Built sector generator (`generateSector` — unique name from pool, density by spawn weight, threat modifier 0.5-1.5) and galaxy generator (`generateGalaxy` — 10-15 sectors, adjacency graph with 2-4 connections per sector, 1-2 bottlenecks, max 5 hops, all reachable). Created Pinia galaxy store with `sectors`, `adjacency`, `startingSectorId`, and getters for adjacent/explorable sectors. Built Galaxy View with sector list (expandable cards showing density, exploration %, adjacency connections, presence indicators), adjacency graph visualization, and summary bar.

**Key architecture decisions:**
- Galaxy generator uses layered approach: spanning tree → bottleneck designation → edge augmentation → constraint validation with retry
- `explorableSectors` getter initially used starting sector as only presence source (colony store wired in Story 4.3, fleet store deferred to Story 15.4)
- Sector cards show green/indigo/gray dots for presence/explorable/unreachable status

**Tests:** 101 passing (sector-generator: 11, galaxy-generator: 16, prior: 74)

---

## Epic 2: Game Shell & Navigation (Completed 2026-02-17)

Built the application shell (Stories 2.1-2.4). Configured Vue Router with 11 lazy-loaded routes (default `/` → Dashboard). Created collapsible sidebar (AppSidebar.vue) with active route highlighting and top header bar (AppHeader.vue) with placeholder turn/BP/End Turn button. All 11 view scaffolds have styled titles and contextual empty-state messages. Built 9 shared UI components: ProgressBar, AttributeBar, StatCard, ResourceBadge, EventCard, ConfirmDialog, Tooltip, DataTable, EmptyState.

**Key architecture decisions:**
- Dark theme: zinc-950 background, zinc-900 sidebar/header, zinc-800 borders
- Sidebar: 224px expanded / 64px collapsed, indigo accent for active route
- Header values are hardcoded placeholders — wired to stores in Stories 5.3 and 12.5
- All components use Tailwind CSS only, TypeScript typed props

---

## Epic 1: Project Foundation (Completed 2026-02-17)

Scaffolded the Vue 3 + TypeScript + Pinia + Tailwind CSS project (Stories 1.1-1.5). Established full folder structure matching Structure.md, TypeScript strict mode, and Vitest. Created all type definitions in `src/types/` (15 files: branded IDs, all entity interfaces, `GameState`, `Modifier`, `EmpireBonuses`). Implemented modifier resolver (`resolveModifiers`, `getModifierBreakdown` — additive first, then multiplicative, then clamp). Built 4 utility modules (`random.ts` with seeded PRNG, `math.ts`, `format.ts`, `id.ts` with nanoid). Created 20 static data files in `src/data/` covering all game entities from Data.md.

**Key architecture decisions:**
- `Modifier[]` stored on entities for local per-entity variation; `EmpireBonuses` on `GameState` for global cumulative values (never modifiers)
- `PhaseResult = { updatedState: GameState; events: GameEvent[] }` is the standard return type for all turn phases
- `ColonyInfrastructure` is `Record<InfraDomain, InfraState>` with public/corporate ownership tracked separately
- Engine/data/generators/types/utils never import Vue or Pinia

**Tests:** 74 passing (modifiers: 19, utils: 55)

---
