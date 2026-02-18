# Spacetime — Development Guide

## What This Is
Turn-based space empire management game. Web app, Vue 3 + TypeScript + Pinia + Tailwind CSS.

## Architecture Rules
- engine/, data/, generators/, types/, utils/ NEVER import from Vue/Pinia
- Stores call engine functions. Views read stores. Views never call engine directly.
- Engine functions are pure: typed inputs → typed outputs, no side effects
- All game values use integer math unless explicitly stated otherwise

## Key Documents
- Specs.md — formulas, rules, mechanics
- Data.md — static tables, spawn weights, costs
- Features.md — epics and stories with acceptance criteria
- Structure.md — file paths, naming conventions, architecture
- Vision.md — Main pillars and vision for the game

## Conventions
- Entity IDs: prefixed strings (col_, corp_, ctr_, ship_, etc.) + nanoid
- Files: kebab-case.ts for engine, PascalCase.vue for components
- Stores: kebab-case.store.ts
- Tests: mirror source path + .test.ts
- Always update Changelog.md after completing a story
- Add TODO comments referencing future stories when partially implementing

## Current Status
See Changelog.md for completed work.