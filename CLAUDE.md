# Spacetime

## Vision Statement

Spacetime is a turn-based space empire management game where the player shapes the conditions for growth rather than commanding it directly. The player leads humanity's first interstellar civilization — not as a god or a president, but as an omnipotent guiding hand that sets policy, awards contracts, and invests in infrastructure. The empire's real work is done by corporations: autonomous entities with their own ambitions, personalities, and agendas.

The player never builds a mine. They create a contract, and a corporation builds it. The player never commands a fleet. They define a mission, and a military corporation executes it. The player never researches a technology. They invest in science, and discoveries emerge on their own.

This indirection is the heart of Spacetime. The empire is yours, but it is never fully under your control.

## Design Pillars

### 1. Indirection Over Command
The player never performs actions directly. Every action in the game world is mediated through corporations (via contracts) or through investment (via budget allocation). The player's skill lies in creating the right conditions, choosing the right partners, and managing risk — not in micromanagement.

### 2. Corporations Are Alive
Corporations are not tools. They are autonomous actors with their own prosperity, personality traits, ambitions, and lifecycle. They grow, merge, compete, diversify, and sometimes die. They can settle planets the player rejected. They can drag their feet on missions if neglected. Managing the corporate ecosystem is as important as managing the empire itself.

### 3. Ships Are Precious
Fleets are small, named, and irreplaceable in the short term. Building a warship is a multi-turn, multi-system investment. Every ship has a captain, a service record, and a history. Losing a ship is a genuine setback — not a statistic. The player should feel the weight of committing a fleet to a dangerous mission.

### 4. Emergent Narrative
The game does not tell a story. Stories emerge from the intersection of systems: a risky exploration contract that discovers a goldmine, a neglected military corp that performs poorly in a crisis, a mega corporation that grows too powerful to control. Reports, events, and outcomes are the narrative — the player is both author and reader.

### 5. Quick Turns, Deep Consequences
Each turn should take 5–10 minutes. The player reviews a dashboard, checks flagged events, makes a few investment decisions, and ends the turn. But the consequences of those quick decisions unfold over many turns. The game respects the player's time while rewarding long-term thinking.

### 6. Clean UI as Teacher
There is no tutorial. The interface must be self-explanatory. Every screen communicates what the player can do and why they might want to. Information is layered: dashboard overview at a glance, detailed reports on demand. The UI is the onboarding.

---

## Core Concept

### The Player
The player governs a united human empire taking its first steps into interstellar space. They begin with a single planet, no ships, no shipyards — just a breakthrough technology that makes space travel possible. From this starting point, they expand through exploration, colonization, and corporate development.

The player is not a character. There is no role-play persona. The player simply *is* the empire's guiding intelligence. They play alone against an evolving set of challenges — there are no AI rival empires.

### The Corporation Ecosystem
Everything in the game is accomplished by corporations. The player's role is to create the framework — contracts, investments, policies — that incentivizes corporations to do what the empire needs.

Corporations are typed (mining, construction, shipbuilding, science, transport, military, exploration, agriculture), have a prosperity level, a size tier (local, multi-planet, mega), and light personality traits (cautious, aggressive, innovative, etc.) that influence their behavior. They are generated on demand when contracts are posted and the economy needs them. They grow through contract revenue and their own investments. They can merge, acquire each other, diversify into new sectors, settle planets independently, and eventually become mega corporations spanning multiple systems.

Corporations pay automatic taxes based on their prosperity, providing the player's main income stream. They can also fail, shrink, and dissolve if neglected or outcompeted.

### The Contract System
The player's primary interaction with the economy. To get anything done — exploration, construction, colonization, ship building, resource extraction — the player creates a contract, selects a corporation from available candidates, and allocates budget points. Contracts have a BP cost per turn and a duration. The player monitors progress through a progress bar and receives random events during long contracts.

The player can also kickstart a new startup corporation for a contract if no existing corporation is suitable — at greater cost and risk.

### The Mission System
The player's interaction with the military. To deploy fleets, the player creates a mission (patrol, escort, assault, rescue, investigation) and assembles a task force from available ships across any military corporations. The fleet is then unavailable for the mission's duration.

Missions have a travel phase (based on sector distance) and an execution phase. The player receives a short summary report on completion — or, in worst cases, no report at all, just silence. The player never directly controls ships in combat. Combat is semi-abstracted: the player sees phases (approach, engagement, aftermath) but makes no tactical decisions.

### The Budget System
The empire runs on budget points (BP) — an abstract representation of political capital and investment capacity. BP is received as fixed income at the start of each turn (from corporate taxes and planet surpluses minus maintenance and expenditures). The player then spends BP on contracts, direct planetary investments, and missions.

The goal is to end each turn near zero — a small surplus is fine, but hoarding BP causes empire-wide dissatisfaction (the government is sitting on resources), while going into debt causes escalating economic instability. Deep debt is possible but increasingly punishing.

### Planets & Colonies
Planets are discovered through exploration and are defined by type (continental, barren, frozen, gas giant, etc.), size, features (canyons, geothermal activity, etc.), and resources (fertility, ore deposits, etc.). Planets are never pre-generated — they are created as exploration contracts discover them.

A colony is established through a contract and is defined by its type (determined by its first contract: mining outpost, science station, hub, etc.), population level, infrastructure domains (civilian, industrial, science, space, etc.), and seven core attributes: dynamism, security, habitability, quality of life, accessibility, stability, and education.

Infrastructure can be public (from player investment or natural growth) or corporate-owned (built by corporations operating on the planet). This dual ownership creates a core strategic tension: corporate infrastructure is free but fragile (if the corp leaves or dies, it's lost), while public infrastructure costs BP but is permanent.

### Trade & Resources
Nine resource types circulate through the empire: common ore, rare ore, volatiles, food, consumer goods, ship parts, high-tech components, heavy machinery, and luxury goods. Trade is automatic — surplus flows to colonies in need, gated by the accessibility attribute. Transport is instant (abstracted). There is no stockpiling: each turn is a clean flow calculation. If a colony can't import what it needs, it suffers immediate penalties to quality of life, stability, and budget contribution.

### Science & Technology
Science is divided into nine sectors (Society, Energy, Applied Sciences, Weaponry, Propulsion, Drones, Life Sciences, Materials, Computing), each with severals levels. Sector levels advance organically based on the empire's total science output — driven by science infrastructure, science-focused colonies, and education levels. The player does not direct research into specific sectors.

When a sector reaches a new level, it unlocks a discovery pool. Science corporations draw discoveries from these pools over time, based on their specialty and prosperity. Discoveries are surprises — the player does not see what's possible until a corp presents a breakthrough.

Discoveries improve empire-wide technology baselines and unlock schematic tiers for shipbuilding corporations. Schematics are unique equipment (weapons, reactors, armor systems) that a shipbuilding corp fits to every ship it builds, making each corp's ships distinct.

### Ships & Roles
Ships are commissioned by role (System Patrol, Escort, Recon, Assault, Carrier, Flagship, Transport), not by class. The player defines a need — "I need a ship to patrol this sector" — and a shipbuilding corporation builds one. Each ship is unique, shaped by the empire's technology level, the building corp's quality, and the corp's proprietary schematics.

Ships have a primary size stat that drives derived stats like hull points and power projection. The player can request a Light, Standard, or Heavy variant to control cost and capability. Building a ship is a contract with a shipbuilding corporation. Build time depends on ship size, shipyard infrastructure, and corporation level. Ships are rare, named, and carry a service record (missions completed, battles fought, captain assigned). Losing a ship is a genuine setback — not a statistic.

### Exploration
The galaxy contains procedurally generated sectors connected in a network graph (adjacency-based, no visual map). The player can explore sectors adjacent to ones where they have a presence. Exploration is a long-term process: each sector supports several possible exploration contracts, each of which may discover points of interest (planets or asteroid belts).

Discovery is two-step: an orbit scan reveals basics (type, size, obvious features), and a follow-up ground survey contract reveals full resource and feature data. The player can accept or reject discovered planets. Rejected planets remain in the game database and can be settled independently by corporations. Accepted planet will need ground expedition to fully reveal their features and statistic.

### Threats & Challenges
The game presents seven categories of challenges with escalating probability over time: piracy, corporate conflict, colony unrest, natural disasters, resource crises, unknown encounters, and internal corruption. There is no win condition — Spacetime is an endless sandbox. The empire endures, grows, struggles, and evolves for as long as the player wants to guide it.

---

## Technical Direction

- **Platform**: Web application
- **Framework**: Vue or Svelte
- **UI Aesthetic**: Clean modern — minimal, high-clarity, Apple-like design sensibility. Data-dense but readable. Whitespace, clear typography, subtle animations. Information hierarchy that guides the eye.
- **Graphics**: None. Purely UI and data driven. No 3D, no spatial rendering, no map. Sectors are text entries in a network. Planets are data cards. Ships are named entries with stats.
- **Game Loop**: Turn-based. Fixed income → player actions (contracts, investments, missions) → end turn → simulation resolves → next turn.
- **Save System**: Autosave every turn + manual saves
- **Time Model**: Abstract. One turn is one turn — no real-world time mapping. All durations are measured in turns.

---

## Project Workflow

Development is structured around the following documents:

| Document | Purpose |
|---|---|
| **Claude.md** | Core concept, vision, and design pillars (this document) |
| **Specs.md** | Detailed mechanical specifications, rules, formulas, and system interactions |
| **Features.md** | Feature scope broken into epics and user stories for incremental development |
| **Changelog.md** | Short summaries of each development update |
| **Structure.md** | Technical project structure, architecture overview, and file organization |