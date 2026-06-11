# Workshop Mechanics Guide

> Reference for workshop AI agents generating Arcanum rules, lore entries, and module-compatible content.
> All game content is in Traditional Chinese. All code/config identifiers are in English.

---

## 1. Arcanum Rule System

### What Rules Are

Arcanum rules are user-authored natural language statements that modify game behavior. They are written as "mods" — analogous to TTRPG house rules. Each rule has a `text` (the rule itself) and a `priority` scope.

### Two Rule Types (Auto-Classified)

At session init, every rule is classified by an LLM pass into exactly one of:

1. **Config Patch** (zero-token cost) — The rule maps to one or more module config fields. Applied as numeric/boolean overrides to `moduleState.__config`. Never injected into the LLM prompt. Example: "Double the lust escalation threshold" → patches `erotic.lustEscalationThreshold = 4`.

2. **Prompt Directive** (injected into Block 1) — The rule is a narrative instruction, behavioral constraint, or anything that cannot be reduced to config values. Injected as text into the LLM system prompt. Example: "All combat encounters should feel desperate and high-stakes".

**Classification fallback**: If a rule is ambiguous, it defaults to `prompt` (safe — the LLM handles it). If the LLM classification call fails entirely, ALL rules become prompt-type.

### Priority Scopes

| Priority | Meaning |
|----------|---------|
| `module` | Overrides a specific module's defaults. Use when the rule targets a known module config field. |
| `scenario` | Overrides scenario-level settings. Applies to scenario-aware systems. |
| `global` | Applies universally across all modules and scenarios. |

### X-Cards (Absolute Blacklist)

X-Cards are a TTRPG safety mechanism. They define content that is **absolutely forbidden** — overriding all modules, scenarios, and rules. X-Cards are injected into the LLM prompt at the highest priority and cannot be overridden by any other rule.

When writing rules, never generate content that contradicts active X-Cards. X-Cards take precedence over everything.

### Rule Resolution Flow

1. Session init loads all rules from the active Arcanum record.
2. Rules are sent (with all module config schemas) to the rule resolver LLM.
3. The resolver classifies each rule as `config` or `prompt`.
4. Config patches are validated against schema (type, min, max) and applied.
5. Prompt rules are collected and injected into Block 1.
6. This happens once at session start — rules do not change mid-session.

### Writing Config Patch Rules

For a rule to be classified as a config patch, it must target an **existing** config field in a registered module's manifest. Config fields have:

- `type`: `number`, `boolean`, or `string`
- `default`: the value used when no override exists
- `min`/`max`: bounds for numeric fields
- `description`: what the config controls

**Good config patch rule**: "Set the combat base intensity to 5" (maps to `combat.baseIntensity`).
**Bad config patch rule**: "Make enemies stronger" (too vague — will become a prompt directive).

### Writing Prompt Directive Rules

These should be clear behavioral instructions for the narrative AI:

- Narrative tone adjustments: "Describe all magic with a sense of wonder and danger"
- Behavioral constraints: "NPCs never reveal their true feelings directly"
- World rules: "Magic always has a physical cost to the caster"
- Pacing guidance: "Keep combat encounters short — resolve in 2-3 turns"

---

## 2. Lore Entry System

### What Lore Entries Are

Lore entries are independent knowledge records injected into the LLM context when relevant. They provide world knowledge, character backgrounds, location descriptions, faction details, and similar reference material.

Lore entries are **not owned by any single Arcanum** — they are linked via `ArcanumRecord.linkedLore` (many-to-many). Multiple Arcana can share the same lore entries.

### Lore Types (Preset Categories)

| Type | Chinese Label | Purpose |
|------|---------------|---------|
| `character` | 角色 | NPC backgrounds, personalities, secrets |
| `location` | 地點 | Places, environments, atmospheres |
| `race` | 種族 | Species, peoples, cultures |
| `item` | 物品 | Objects, artifacts, equipment |
| `ability` | 能力 | Skills, spells, powers |
| `faction` | 勢力 | Organizations, governments, groups |
| `concept` | 概念 | Abstract world rules, philosophies, systems |
| `event` | 事件 | Historical events, prophecies, ongoing conflicts |
| `trait` | 特質 | Character traits, conditions, statuses |

Custom type strings are also allowed beyond these presets.

### Lore Entry Structure

Each lore entry has:

- `title`: Display name
- `type`: Category tag (preset or custom)
- `keywords`: Trigger words for client-side detection (array of strings)
- `alias`: Alternative display names that also trigger highlighting
- `content`: The actual text injected into the LLM prompt
- `mechanics`: Optional client-side mechanical data (see Section 3)
- `priority`: 1-100, higher = injected first within budget
- `tokenEstimate`: Rough token count for budget tracking
- `promoted`: Whether in Block 2 (persistent) or Block 3 (dynamic)
- `relationships`: Links to other lore entries for chain-pull injection

### Keyword Activation

Two detection mechanisms work together:

1. **Client-side keyword detection** (zero-token cost): Literal substring matching against player input. Case-insensitive. CJK characters use substring match; ASCII uses word-boundary match.

2. **UA contextual suggestion**: The Utility Agent receives a compact catalog of available lore (up to 20 entries) each turn and can suggest contextually relevant entries even if no keyword matched.

### Afterglow Persistence

When a lore entry triggers, it stays injected for N turns (default 4, configurable). Re-triggering resets the counter. This prevents knowledge from disappearing mid-conversation about a topic.

### Injection Blocks

- **Block 2 (Promoted)**: Persistent entries always in the prompt. Not counted against the dynamic budget. Use for foundational world knowledge.
- **Block 3 (Dynamic)**: Triggered entries with afterglow timers. Subject to token budget (default 2000 tokens).
- **Relationship chain-pull**: When an entry triggers, related entries (via `relationships`) may also be injected if budget allows. Separate budget (1500 tokens).

### What Lore CAN Do

- Provide world knowledge the LLM needs for consistent narrative
- Guide narrative tone for specific locations, factions, or characters
- Describe magic systems, technology, social structures
- Define how specific items, abilities, or traits work narratively
- Carry client-side mechanical data (`mechanics` field) for the dice system

### What Lore CANNOT Do

- Directly modify game state (affection, hype, lust values)
- Change module config values (that is what Arcanum rules do)
- Override module hook behavior
- Execute code or trigger specific engine functions
- Bypass X-Card restrictions

---

## 3. Module Mechanics Overview

### Resources

Modules can define resource pools (HP, SP, MP, etc.). Each resource has:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (e.g., `"hp"`, `"sp"`) |
| `scope` | `'all' \| 'player' \| 'player_and_vital'` | Who has this resource |
| `defaultMax` | number | Starting maximum value |
| `defaultCurrent` | number | Starting current value |
| `regen.triggers` | string[] | What causes regeneration (e.g., `["rest", "potion"]`) |

**Constraint**: Maximum 6 total resource types across ALL enabled modules combined.

Lore entries can provide resource bonuses via `mechanics.resourceBonus`:
```json
{ "resource": "hp", "maxBonus": 10 }
```
This adds to the pool's max when the lore entry is active (equipped/acquired).

### Dice System

The engine uses a **unified 2d6 test resolution** system:

**Test Rolls (success/fail determination)**:
- Roll 2d6, sum the result
- Total >= 7 = success
- Total >= 10 = great success
- Below 7 = fail
- Advantage: roll 3d6, keep best 2
- Disadvantage: roll 3d6, keep worst 2
- No numeric modifiers on test rolls — difficulty is advantage/disadvantage only

**Efficacy Rolls (magnitude determination)**:
- Use module-defined dice (d4 through d100)
- Highest-wins modifier resolution: only the single highest bonus and single largest penalty apply
- Can be a separate roll OR derived from the test result (highest die, lowest die, margin over 7, or total)
- Can be flat values instead of rolled

**Recognized Triggers**: Each module declares a list of `recognizedTriggers` — situation keywords the Dice Agent looks for to initiate rolls (e.g., `"attack"`, `"seduce"`, `"persuade"`).

**Lore entries can influence dice** via the `mechanics` field:
- `diceAdvantage`: Grant advantage/disadvantage on specific triggers
- `diceModifier`: Add numeric bonuses to efficacy rolls
- `diceRequest`: Define active roll actions (items/abilities that initiate their own rolls)

### State Fields

Modules declare runtime state in `manifest.state`. Each field has a type and default value. Types: boolean, number, string, object, array. State is per-module, per-session. Modules cannot read other modules' state.

### Config Fields (Mod API Surface)

Modules declare overridable config in `manifest.config`. These are the fields Arcanum rules can target:

```json
"config": {
  "lustEscalationThreshold": {
    "type": "number",
    "default": 2,
    "min": 0,
    "max": 4,
    "label": "$CONFIG_LUST_THRESHOLD",
    "description": "Lust tier index at which module activates"
  }
}
```

Only declared config fields can be overridden. Values are validated against type, min, and max.

### Character Extensions

Modules can add fields to NPC profiles:

- `triggerFields`: Additional data on NPC character sheets that influence module activation (e.g., erotic keywords per NPC)
- `profileFields`: Additional profile sections for module-specific NPC data

---

## 4. Orchestrator Hook Lifecycle

The engine dispatches hooks to enabled modules at specific points in the turn pipeline. All hooks are optional. Failed hooks are caught and warned — they never crash the app.

### Hook Points

| # | Hook | Merge Strategy | When It Fires | What Modules Can Do |
|---|------|---------------|---------------|---------------------|
| 1 | `onSessionStart` | EACH | Session initialization | Set up initial module state from scenario data |
| 2 | `getDynamicPrompt` | CONCAT | Before LLM call, every turn | Inject dynamic prompt text based on current state |
| 3 | `getIntensity` | MAX | After UA eval, every turn | Report a numeric intensity score (highest wins across modules) |
| 4 | `modifyRollRequest` | SINGLE | Before dice roll execution | Inject advantage/disadvantage or efficacy modifiers into a roll |
| 5 | `resolveRoll` | SINGLE | After dice roll, owning module only | Interpret dice result into narrative directive and state updates |
| 6 | `onSceneChange` | EACH | When scene/location changes | Reset or adjust module state for new scene |
| 7 | `onTurnEnd` | EACH | After turn completes | Update module state based on turn results and UA eval |

### Merge Strategies

- **EACH**: Every enabled module is called. Each returns updated state independently.
- **CONCAT**: All non-null string results are joined with `\n\n`.
- **MAX**: Highest numeric value wins (used for intensity scoring).
- **SINGLE**: Only the specific owning module is called (dice resolution).

### Additional Hooks (Pacing/Quest)

| Hook | Merge | Purpose |
|------|-------|---------|
| `getPacingDrivers` | CONCAT | Modules contribute legacy pacing directions; Mission System v2 also reads them as Ambient Mission seeds |
| `getBottleneckQuestDirections` | CONCAT | Modules contribute fallback directions for Bottleneck Breakthrough Missions |

---

## 5. Core Game Mechanics (Brief)

### Hype (5-Tier Emotional Tension)

Per NPC, per turn. Drives affection changes.

| Tier | Chinese | Affection Delta (Standard Preset) |
|------|---------|-----------------------------------|
| Strong Negative | 強烈負面 | -5 to -3 |
| Mild Negative | 輕微負面 | -3 to -1 |
| Flat | 平淡 | 0 |
| Mild Positive | 輕微正面 | +1 to +3 |
| Strong Positive | 強烈正面 | +3 to +5 |

- **Decay**: Hype decays toward 平淡 if no qualifying interaction occurs.
- **Time skip / scene change**: Resets to 平淡.
- **Presets**: Three affection-change presets — `slowburn` (small deltas), `standard`, `dramatic` (large deltas).

### Lust (5-Tier Physical Tension)

Per NPC. Does NOT decay on idle.

| Index | Tier | Chinese |
|-------|------|---------|
| 0 | Dormant | 休眠 |
| 1 | Budding | 萌芽 |
| 2 | Smoldering | 悶燒 |
| 3 | Burning | 燃燒 |
| 4 | Ravenous | 貪婪 |

- **Cool-down triggers**: Conflict, scene change, time skip, or Hype <= 平淡.
- **Module activation**: Modules can set `activation.lustThreshold` to activate at a specific lust tier index.

### Affection (8-Tier, -100 to 100)

Per NPC. Changed ONLY by Hype delta — never set directly.

| Tier | Chinese | Range |
|------|---------|-------|
| Hostile | 敵對 | < -90 |
| Nemesis | 宿敵 | -90 to 0 |
| Wary | 警戒 | 0 to 20 |
| Neutral | 中立 | 20 to 40 |
| Friendly | 友善 | 40 to 60 |
| Trust | 信任 | 60 to 80 |
| Beloved | 摯愛 | 80 to 90 |
| Devoted | 獻身 | 90 to 100 |

- **Bottleneck thresholds** at 30%, 50%, 70%, 90%: Affection cannot pass these values without completing a Bottleneck Breakthrough Mission.
- **Default starting affection**: 20 (中立 tier).
- **Initial affection**: Clamped to [-60, 60] range — extreme tiers must be earned through gameplay.

### Critical Events

- **Trigger**: Any turn where Hype = 強烈正面 or 強烈負面 for an NPC.
- **Detection**: By the Utility Agent during eval.
- **Storage**: Persisted cross-session per NPC.
- **Profile update**: Every 5 critical events per NPC triggers an automatic NPC Profile update via the Utility Agent.

### Turn System

- **Client-authoritative**: The orchestrator increments and injects `[SYSTEM: Current Turn = T{N}]`. The LLM never computes turn numbers.
- **XP**: Awarded based on hype intensity per turn (mild hype = 1 XP, strong hype = 2 XP).
- **Leveling**: XP per level scales with level (10/20/30 for low/mid/high).

---

## 6. Writing Guidelines for Workshop AI

### When Writing Arcanum Rules

- **Use config patch format** for numeric/boolean overrides: Write rules that clearly target a specific value. Example: "Set the lust activation threshold to tier 3 (燃燒)" rather than "Make lust harder to trigger".
- **Use prompt directives** for narrative guidance: Tone, behavioral instructions, world physics, pacing preferences.
- **Check available config schemas**: Only reference config fields that exist in registered modules. The rule resolver cannot invent new config keys.
- **Respect min/max bounds**: Numeric config fields have defined ranges. Rules that exceed bounds will be clamped.
- **Keep rules atomic**: One rule = one intent. Avoid compound rules that mix config and narrative concerns.

### When Writing Lore Entries

- **Focus on world knowledge**: Lore provides context the LLM needs for consistent storytelling.
- **Stay mechanically neutral** unless the lore entry has a `mechanics` field: Lore content (the `content` text) should describe things narratively, not prescribe game state changes.
- **Choose keywords carefully**: Keywords trigger injection. Use the most distinctive terms — avoid common words that would trigger too often.
- **Mind the token budget**: Default dynamic budget is 2000 tokens. High-priority, concise entries are more valuable than long, detailed ones.
- **Use relationships**: Link related entries (a faction member to their faction, an item to its origin location) for contextual chain-pull.
- **Set priority wisely**: 1-100 scale. Core world facts should be high priority (70-100). Flavor details can be lower (10-30).

### When Paired with a Module

- Reference the module's `workshop-ref.md` (if it exists) for available mechanics, config fields, and recognized triggers.
- Lore `mechanics` fields can interact with the module's dice system: advantage/disadvantage sources, efficacy modifiers, active roll definitions.
- Resource bonuses (`mechanics.resourceBonus`) must reference resources defined by the module (e.g., `"hp"`, `"sp"`).
- Dice triggers (`mechanics.diceRequest`, `mechanics.diceAdvantage`, `mechanics.diceModifier`) must use triggers recognized by the module's `diceRolls.recognizedTriggers`.

### Avoid These Mistakes

- **Inventing mechanics that do not exist**: Do not reference resources, dice types, config fields, or triggers that no module defines. The engine validates everything against registered schemas.
- **Assuming specific dice**: The engine uses 2d6 for tests. Do not write rules assuming d20 or other test dice.
- **Conflating lore content with config**: Lore `content` is injected into the LLM prompt as text. It cannot change numeric config values. Use Arcanum rules for config overrides.
- **Bypassing bottleneck thresholds**: Affection bottlenecks at 30/50/70/90 are enforced by the engine. Rules cannot remove them.
- **Setting affection directly**: Affection changes only through UA-derived Hype delta and client-applied mission rewards. No rule or lore entry can set affection to a specific value.
- **Modifying turn counter or XP**: These are client-authoritative. The LLM and rules have no control over them.
- **Creating lore entries that act as rules**: If you want to change game behavior, write an Arcanum rule. If you want to provide narrative context, write a lore entry. Do not mix the two.
