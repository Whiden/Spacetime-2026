# Spacetime — Game Cycle

> Defines the game loop, turn structure, phase resolution order, and event feedback system.
> For budget formulas see `Economy.md`. For individual system mechanics see their dedicated spec files.

---

## Gameplay Loop

Each turn follows a three-stage rhythm from the player's perspective:

**1. Review** — The dashboard surfaces what happened last turn: events, contract completions, discoveries, corp activity, market results. The player drills into detail as needed.

**2. Act** — The player takes any number of actions constrained only by available BP: create contracts, assign missions, invest in planets, accept/reject discovered planets, create trade routes. No action limit per turn. Target pace is 5–10 minutes.

**3. End Turn** — The player confirms. The simulation resolves all 10 phases automatically, then the next turn's Review begins.

Time is abstract. One turn = one turn. No real-world time mapping.

---

## Turn Resolution — 10 Phases

When the player clicks End Turn, phases resolve in this exact order. **Order matters** — later phases see results from earlier ones.

| # | Phase | What happens |
|---|---|---|
| 1 | **Debt** | One debt token cleared (if any), 1 BP deducted |
| 2 | **Income** | Planet tax + corp tax calculated, BP credited |
| 3 | **Expense** | Contract + mission costs deducted; deficit triggers new debt token |
| 4 | **Contract** | All active contracts advance one turn; completed contracts fire their effects (new colony, new ship, etc.) |
| 5 | **Mission** | Missions advance through travel → execution → return; combat resolves on execution |
| 6 | **Science** | Science domains accumulate output; discovery rolls; schematic and patent generation |
| 7 | **Corp** | Corp AI runs: capital gain, infrastructure investment decisions, organic corp emergence, mergers |
| 8 | **Colony** | Infra caps recalculated; all six colony attributes recalculated; growth ticks; organic infra growth |
| 9 | **Market** | Sector markets resolve: production → internal consumption → surplus pool → deficit purchasing → shortage maluses |
| 10 | **Event** | Events generated from current state; threat escalation *(placeholder — not active in prototype)* |

After all phases: turn number increments, autosave triggers, dashboard updates.

---

## Game State Phases (Technical)

From the code's perspective, the game is always in one of three states:

| State | When | Meaning |
|---|---|---|
| `player_action` | Between turns | Player can take actions, BP is live |
| `resolving` | During end turn | Engine is running; UI is locked |
| `player_action` | After resolution | Returns directly; events display non-blocking on dashboard |

There is no hard "review" gate — events are shown on the dashboard passively, not as a mandatory modal.

---

## Event Feedback System

Every turn phase generates `GameEvent` entries. These are displayed in the event feed on the dashboard, priority-sorted.

| Priority | Color | Examples |
|---|---|---|
| Critical | Red | Ship destroyed, debt crisis, colony stability collapse |
| Warning | Orange | Resource shortage, stability drop |
| Info | White | Contract progress, corp investment, discovery |
| Positive | Green | Contract complete, population growth, corp level-up |

Events are stored in the event store. History is capped at the last 50 turns. Events are not interactive — they are a log, not a blocking notification.

---

## Threats & Events *(Deferred)*

> The event infrastructure (store, feed, priority system) is fully implemented. Active threat generation is deferred from the prototype.

Planned threat categories: Piracy, Corporate Conflict, Colony Unrest, Natural Disasters, Resource Crises, Unknown Encounters, Internal Corruption.

When implemented, threats will be generated during the Event phase (Phase 10) based on current game state — low stability, resource shortages, unprotected sectors, etc.
