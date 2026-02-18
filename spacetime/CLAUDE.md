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

## Context Efficiency

### Subagent Discipline
- Prefer inline work for tasks under ~5 tool calls. Subagents have overhead — don't delegate trivially.
- When using subagents, include output rules: "Final response under 2000 characters. List outcomes, not process."
- Never call TaskOutput twice for the same subagent. If it times out, increase the timeout — don't re-read.

### File Reading
- Read files with purpose. Before reading a file, know what you're looking for.
- Use Grep to locate relevant sections before reading entire large files.
- Never re-read a file you've already read in this session.
- For files over 500 lines, use offset/limit to read only the relevant section.

### Responses
- Don't echo back file contents you just read — the user can see them.
- Don't narrate tool calls ("Let me read the file..." / "Now I'll edit..."). Just do it.
- Keep explanations proportional to complexity. Simple changes need one sentence, not three paragraphs.