# Spacetime — Economy

> Defines the budget system, BP income and expense formulas, and the debt system.
> For contract costs see `Contracts.md`. For planet/corp tax inputs see `Planet.md` and `Corporations.md`.

---

## Budget Points (BP)

BP (Budget Points) are the single currency of the game — an abstraction of political capital and investment capacity. **All BP values are integers.** There is no stockpiling: unused BP from a turn is wiped at the start of the next turn resolution. BP is earned fresh each turn.

---

## Income

```
BP_income = sum(planet_taxes) + sum(corp_taxes)
```

### Planet Tax

Colonies with population level < 5 pay no tax.

```
habitability_cost = max(0, 10 - habitability) × max(1, floor(pop_level / 3))
planet_tax        = max(0, floor(pop_level² / 4) - habitability_cost)
```

Low habitability increases the cost of maintaining a colony, reducing net tax. High-habitability, high-population colonies are the empire's economic foundation.

### Corporation Tax

Level 1–2 corporations pay 0 BP (startup exemption).

```
corp_tax = floor(corp_level² / 5)
```

---

## Expenses

```
BP_expenses = sum(active_contract_costs) + sum(mission_costs) + player_investments
Net_BP      = BP_income - BP_expenses
```

Expenses are deducted automatically each turn during the Expense phase. If Net BP is negative after expenses, a debt token is issued (see below). Player investments (3 BP per infrastructure level — see `Planet.md`) are deducted immediately when made, not at end of turn.

---

## Debt System

Debt tokens represent lingering economic damage from deficit spending.

### Gaining Tokens

When the player ends a turn in deficit:

```
debt_tokens_gained = max(1, floor(deficit / 3))
```

Minimum 1 token if any deficit exists.

### Token Cap

Maximum 10 debt tokens. The player cannot take actions that would push debt above 10.

### Clearing Tokens

Each turn during the Debt phase (Phase 1), 1 token is automatically cleared at a cost of 1 BP deducted from the turn's income.

### Stability Penalty

While any debt tokens exist, every colony in the empire suffers:

```
stability_malus = floor(debt_tokens / 2)
```

This malus is read directly from game state — it is not a modifier stored on colonies.

### Design Intent

Occasional deficit spending is a viable strategic choice — it trades future stability for present capability. Chronic deficits cause empire-wide instability and compound over time. Debt is a pressure valve, not an immediate game-ender.
