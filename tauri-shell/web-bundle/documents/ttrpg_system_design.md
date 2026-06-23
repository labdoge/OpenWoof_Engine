# TTRPG System Design Memo

**Date:** 2026-04-08
**Status:** Draft — future project roadmap. No implementation yet.
**Purpose:** Define the mechanical systems needed to elevate DogeChat from a narrative interactive-fiction engine to a Fabula Ultima-level TTRPG simulator, with clear client-vs-LLM responsibility boundaries and a template-driven content pipeline.
**Note:** References `mechanics_system_design.md` (item-as-lore-entry concept) and `event_agent_system_design.md` (UA→EA→Client pipeline). Assumes all existing DogeChat systems (dice, traits, combat, affection, arcanum, exploration) as baseline.

---

## 1. Design Philosophy

**Client owns all numbers. LLM owns all prose.**

1. Every mechanical calculation (damage, HP, type charts, status ticks, initiative) is deterministic client-side code. The LLM never does arithmetic.
2. The LLM's role is strictly: **narration**, **NPC decision-making** (action selection with personality/tactics), and **freeform adjudication** (attempts outside numerical scope).
3. Content generation uses **templates + random tables** for structure, with minimal LLM calls (~60-120 tokens) for flavor/personality only.
4. The Event Agent pipeline (UA→EA→Client) remains the integration backbone — new systems expand the client resolution layer, not the LLM's responsibilities.
5. All new systems must be **module-compatible** — core compiles without them, modules can extend them.

---

## 2. Gap Analysis: DogeChat vs Fabula Ultima

### 2a. Already Covered

| TTRPG Pillar | DogeChat System | Notes |
|---|---|---|
| GM / Narrator | LLM Main Session | Core loop |
| Dice mechanics | Unified 2d6, advantage/disadvantage | `src/modules/dice-engine.ts` |
| Character traits | GameTrait (4 types, 2 ranks, cooldowns) | `src/modules/trait-system.ts` |
| Combat resolution | 7 action domains, pool-based damage | Event Agent pipeline |
| Social mechanics | Hype / Affection / Lust tiers | UA-authoritative |
| NPC AI | Profile system, relationship tracking | Full profile lifecycle |
| World-building | Arcanum + Lore (rules, X-Cards, keyword injection) | `src/arcanum/` |
| Quests | Quest generator, state tracking | `src/agents/quest-generator.ts` |
| Exploration | Mysteries, notable objects, chain patterns | Exploration module |
| Progression | Level-up, trait acquisition/upgrade | Succession system |
| Session persistence | Full save/load, cross-scenario carry-over | Succession system |
| Character creation | Workshop + AI generator | Creative Ops slot |
| Scenario design | Workshop + templates | Creative Ops slot |

### 2b. Systems to Build

| # | System | Complexity | Dependencies |
|---|---|---|---|
| 1 | Resource Pools (HP/MP) | High | Foundation for everything |
| 2 | Equipment with Stats | High | Mechanics System design (existing) |
| 3 | Status Effects Engine | Medium | Resource Pools |
| 4 | Class/Job System | Medium | Traits, Resource Pools |
| 5 | Elemental Affinities | Medium | Equipment, Status Effects |
| 6 | Structured Initiative | Medium | Resource Pools |
| 7 | Meta-Currency | Low-Medium | Independent |
| 8 | Clock / Progress Tracker | Low | Independent |
| 9 | Villain Phases | Low-Medium | Resource Pools, Status Effects |

---

## 3. Client vs LLM Responsibility Matrix

### 3a. Fully Client-Side (zero LLM tokens)

| Operation | Implementation |
|---|---|
| HP/MP arithmetic | `hp -= damage; mp -= cost;` |
| Damage formula | `baseDmg + weaponBonus + traitBonus - defense` |
| Elemental type chart | Lookup: `affinities[npcId][element] → multiplier` |
| Status effect tick/expiry | Decrement per round, remove at 0 |
| Status modifiers on rolls | `if (hasStatus('Slow')) disadvantage = true` |
| Equipment stat bonuses | Slot → stat modifiers → feed into dice |
| Equip/unequip/swap | Pure state mutation |
| Class/job unlock checks | Prereq evaluation |
| MP cost deduction | Budget check + deduct |
| Dice rolls | Already client-side (`dice-engine.ts`) |
| Initiative ordering | Sort by rule |
| Clock segment fill | Increment + threshold check |
| Meta-currency pool | Earn/spend/cap |
| KO/death state | HP threshold check |
| Phase transition trigger | Boss HP threshold → next phase |
| Level-up math | XP check, stat grants, skill points |
| Inventory management | Add/remove/stack, weight/slot budget |

### 3b. LLM-Required (narrative judgment)

| Decision | Why |
|---|---|
| NPC turn action selection | Personality + tactics + narrative context |
| Freeform attempt adjudication | "I swing from the chandelier" — what stat? What DC? |
| Outcome narration | Client says "14 dmg, fire, weakness" → LLM writes the scene |
| Discovery/revelation pacing | When to hint vs reveal (e.g., elemental affinities) |
| Villain phase narrative | The *story* of a phase transition |
| Social encounter judgment | Persuasion attempts beyond dice scope |

### 3c. Data Flow Pattern

```
Client resolves mechanics          LLM narrates results
──────────────────────             ────────────────────
dice roll → 12 (great success)    ← "劍鋒劃破黑暗，精準貫穿敵人甲縫"
damage calc → 36 (fire, weakness) ← "烈焰灼燒冰霜巨人的皮膚"
status applied → Burn(3 turns)    ← "火焰持續在傷口蔓延"
HP drops to 0 → KO               ← "巨人轟然倒地"
phase trigger → boss phase 2      ← "龍褪去鱗片，露出熔岩般的血肉"
clock fills → 6/6 complete        ← "城門終於在撞擊下崩裂"
```

The LLM receives a **structured result summary** (JSON), not a calculation request:

```json
{
  "action": "fire_spell",
  "roll": { "dice": [4, 5], "total": 12, "result": "great_success" },
  "damage": { "base": 18, "element": "fire", "affinity": "weakness", "final": 36 },
  "mpCost": 5,
  "target": { "name": "冰霜巨人", "hpBefore": 80, "hpAfter": 44, "phase": 1 },
  "statusApplied": null
}
```

---

## 4. Resource Pools (HP / MP)

The foundational system — most other systems depend on it.

### 4a. Design

```typescript
interface ResourcePools {
  hp: { current: number; max: number };
  mp: { current: number; max: number };
  ip: { current: number; max: number };  // Inventory Points (abstract carry weight)
}
```

- **HP**: Damage taken reduces HP. At 0 → KO status. Recovery via rest, items, aid skills.
- **MP**: Spent to activate skills/spells. Recovery via rest, items, specific traits.
- **IP**: Abstract inventory weight. Each carried item costs IP. Over-budget → penalties.
- All three are **client-authoritative**. LLM receives current values as context, never computes them.
- Base values derived from level + class/job bonuses. Equipment can modify max.

### 4b. KO and Recovery

- KO is a status effect (see Sec 6). KO'd characters cannot act.
- Recovery options: ally aid action, consumable item, rest scene, meta-currency spend.
- No permanent death by default — can be enabled via Arcanum rule.

---

## 5. Class / Job System

### 5a. Design

Characters choose **multiple jobs** (multi-class). Each job grants a skill tree with level-gated unlocks.

```typescript
interface JobDefinition {
  id: string;
  name_key: string;               // locale key
  description_key: string;
  category: 'martial' | 'magical' | 'support' | 'specialist';
  hpBonus: number;                // added to base HP per job level
  mpBonus: number;                // added to base MP per job level
  skills: JobSkill[];             // unlocked at specific job levels
  passives: JobPassive[];         // always-on effects when job is equipped
}

interface JobSkill {
  id: string;
  name_key: string;
  jobLevelReq: number;            // minimum job level to unlock
  type: 'offensive' | 'defensive' | 'support' | 'utility';
  mpCost: number;
  element?: ElementType;
  target: 'single' | 'group' | 'self' | 'all';
  formula: string;                // e.g., "magic + weaponDmg + 8"
  statusChance?: { effect: StatusId; rate: number };
  tags: string[];
}
```

### 5b. Multi-Class Rules

- Characters can hold N jobs simultaneously (default: 2, configurable via Arcanum).
- Job level progresses independently. XP is assigned to active jobs.
- Skill unlocks persist even if job is swapped out (learned = learned).
- Job swap available outside of combat / during rest scenes.

### 5c. Integration with Existing Trait System

Jobs provide **skills** (active abilities with costs). Traits remain as **innate qualities** (narrative, harm, aid, utility). They coexist:

- Skills = job-granted, MP-costed, formula-driven
- Traits = character-innate, cooldown-based, advantage/bonus-driven

A "火焰之劍" attack might be a **Warrior job skill** (MP cost, fire element, damage formula) enhanced by a **"大力士" trait** (advantage on strike rolls).

---

## 6. Status Effects Engine

### 6a. Core Statuses

| Status | Mechanical Effect | Default Duration |
|---|---|---|
| Dazed (恍惚) | Disadvantage on all rolls | 1 turn |
| Enraged (狂怒) | +damage dealt, +damage taken | 2 turns |
| Poisoned (中毒) | Lose HP at turn start | 3 turns |
| Shaken (動搖) | Disadvantage on magic rolls, -MP recovery | 2 turns |
| Slow (遲緩) | Acts last in initiative, no flee | 1 turn |
| Weak (虛弱) | -damage dealt | 2 turns |
| Burn (灼燒) | Lose HP at turn start, fire vulnerability | 2 turns |
| Frozen (凍結) | Skip turn, shatter on physical hit (bonus damage) | 1 turn |
| KO (倒地) | Cannot act, removed from initiative | Until recovered |

### 6b. Data Shape

```typescript
interface StatusEffect {
  id: StatusId;
  name_key: string;
  duration: number;               // turns remaining, -1 = until cured
  stacks: boolean;                // if true, reapply refreshes duration
  modifiers: StatusModifier[];
  onTurnStart?: StatusTick;       // e.g., poison damage
  onTurnEnd?: StatusTick;
  immuneArchetypes?: string[];    // some NPCs immune
}

interface StatusModifier {
  stat: 'attack' | 'defense' | 'mDefense' | 'accuracy' | 'all';
  type: 'advantage' | 'disadvantage' | 'flat';
  value?: number;                 // for flat modifiers
}
```

### 6c. Resolution

- Status effects are **applied by client** when a skill/attack succeeds and the chance roll passes.
- **Ticked by client** at turn start/end (duration--, trigger onTurnStart/onTurnEnd).
- **Removed by client** when duration reaches 0, or via cure skill/item.
- LLM receives status list per character as context. Narrates effects but never manages durations.

---

## 7. Elemental Affinity / Damage Types

### 7a. Elements

8 elements: Physical (物理), Fire (火), Ice (冰), Earth (地), Wind (風), Lightning (雷), Dark (闇), Light (光).

### 7b. Affinity Levels

| Level | Effect | Multiplier |
|---|---|---|
| Weakness (弱點) | Double damage | ×2 |
| Normal (普通) | Standard damage | ×1 |
| Resistance (抗性) | Half damage | ×0.5 |
| Immunity (免疫) | No damage | ×0 |
| Absorption (吸收) | Heals instead | ×-1 |

### 7c. Data Shape

```typescript
type AffinityLevel = 'weakness' | 'normal' | 'resistance' | 'immunity' | 'absorption';

interface AffinityTable {
  [element: string]: AffinityLevel;  // defaults to 'normal' if absent
}

// Per-NPC, stored in NPC data
interface NPCCombatData {
  affinities: AffinityTable;
  // Initially hidden from player — discovered through play
  discoveredAffinities: Set<ElementType>;
}
```

### 7d. Discovery Mechanic

- Affinities start **hidden**. Players discover them by hitting an NPC with that element.
- On hit: client reveals the affinity for that element in the UI.
- UA can also hint narratively ("這生物的皮膚似乎覆蓋著一層冰霜...").
- Discovered affinities persist per NPC across the session.

---

## 8. Meta-Currency (Fabula Points Equivalent)

### 8a. Earn Triggers (client-detected)

| Trigger | Points |
|---|---|
| Failed roll (< 7 on 2d6) | +1 |
| KO'd | +1 |
| Invoke a Bond (spend to activate relationship-based bonus) | +1 |
| UA awards (great roleplay, creative solution) | +1 |

### 8b. Spend Options

| Spend | Cost | Effect |
|---|---|---|
| Reroll | 1 | Reroll any single check |
| Narrative intervention | 2 | Declare a minor story element ("there's a chandelier I can swing from") |
| Activate ultimate skill | 3 | Trigger a character-specific ultimate ability |
| Avoid KO | 1 | Survive at 1 HP instead of going to 0 |

### 8c. Rules

- Pool cap: 5 (configurable via Arcanum).
- Starts at 3 at session begin.
- Client tracks pool. LLM informed of current value.
- Narrative interventions require LLM adjudication (is the declaration reasonable?).

---

## 9. Clock / Progress Tracker System

### 9a. Design

Clocks represent multi-step challenges that progress over time.

```typescript
interface ProgressClock {
  id: string;
  name: string;                    // "城門突破" — can be LLM-generated or preset
  segments: number;                // total segments (4, 6, or 8 typical)
  filled: number;                  // current progress
  visible: boolean;                // shown in UI or hidden (GM clock)
  fillTrigger: ClockTrigger;       // what advances it
  onComplete: ClockEffect;         // what happens when full
}

type ClockTrigger =
  | { type: 'roll_success'; context: string }      // successful check in context
  | { type: 'turn_count'; every: number }           // auto-fill every N turns
  | { type: 'event'; eventTag: string }             // specific event occurs
  | { type: 'manual' };                             // UA/client decides

type ClockEffect =
  | { type: 'scene_transition'; target: string }
  | { type: 'unlock'; what: string }
  | { type: 'spawn'; entity: string }
  | { type: 'status'; target: string; status: StatusId };
```

### 9b. Usage Examples

- **Infiltration**: 6-segment clock. Each successful stealth check fills 1. Full = reach the vault.
- **Ritual interruption**: 4-segment clock (enemy side). Fills each enemy turn. Full = ritual completes. Players must stop it.
- **Pursuit**: Dual clocks. Player clock (escape) vs enemy clock (capture). First to fill wins.

### 9c. UI

- Segmented circle or bar, shown in status area.
- Multiple concurrent clocks supported.
- Hidden clocks revealed when contextually appropriate (UA decision).

---

## 10. Structured Initiative / Turn Order

### 10a. FU-Style Initiative

Fabula Ultima uses a player-choice system rather than rolled initiative:

1. At round start, one side picks who acts first (alternating which side picks each round).
2. After each character acts, the opposing side chooses their next actor.
3. This creates tactical depth without initiative rolls.

### 10b. Alternative: Rolled Initiative

For a more traditional feel (configurable via Arcanum rule):

- Roll 2d6 + speed modifier per character at encounter start.
- Sort descending. Ties broken by player > NPC.
- Re-roll each round or fixed for encounter (configurable).

### 10c. Turn Structure

```
Round Start
  → Status effects tick (turn-start effects)
  → Clock auto-fill (if turn-count trigger)
  → Active character chooses action
  → Client resolves action (dice, damage, status application)
  → LLM narrates result
  → Status effects tick (turn-end effects)
  → Next character
Round End
  → Check phase transitions
  → Check clock completions
  → Check KO / encounter end conditions
```

### 10d. NPC Action Selection

- **Extras**: purely archetype-driven (e.g., `combatBehavior: 'aggressive'` → always attacks nearest).
- **Notable**: archetype + agenda bias (e.g., "protect the merchant" → prioritize guard actions).
- **Vital**: LLM decides based on full personality/tactics context. EA interprets into mechanical action.

---

## 11. Equipment with Stats

Ties into the existing Mechanics System design (`mechanics_system_design.md`, Sec 2: Lore-as-definition-layer).

### 11a. Equipment Slots

| Slot | Limit | Stat Contributions |
|---|---|---|
| Main Hand | 1 | Accuracy, damage, element |
| Off Hand | 1 | Defense or secondary weapon |
| Armor | 1 | Defense, magic defense |
| Accessory | 2 | Passive effects, stat bonuses |

### 11b. Weapon Template

```typescript
interface WeaponData {
  accuracy: number;         // bonus to hit rolls
  damage: number;           // base damage bonus
  element: ElementType;     // damage element (default: 'physical')
  category: 'melee' | 'ranged';
  properties: WeaponProperty[];  // 'multi_target', 'piercing', 'magical', etc.
}
```

### 11c. Integration

- Equipment stat bonuses feed into dice resolution automatically.
- Equip/unequip is a client state operation. No LLM involvement.
- Equipment can be generated from **item templates + random tables** (see Sec 13).
- The `LoreMechanics` interface from `mechanics_system_design.md` already has the hooks (`equippable`, `slot`, `diceModifier`). This section defines the combat-integration layer on top.

---

## 12. Villain Phase / Boss Mechanics

### 12a. Phase Definitions

```typescript
interface VillainDefinition {
  id: string;
  phases: VillainPhase[];
}

interface VillainPhase {
  phaseNumber: number;
  hpThreshold: number;        // transition when HP drops below this %
  statBlock: StatBlock;        // may change between phases
  affinities: AffinityTable;   // may change between phases
  abilities: string[];         // skill IDs available in this phase
  behavior: 'aggressive' | 'defensive' | 'berserk' | 'tactical';
  onEnter?: PhaseEffect;       // status cleanse, heal, summon adds, etc.
}

interface PhaseEffect {
  healPercent?: number;         // heal to X% of phase max HP
  statusCleanse?: boolean;      // remove all debuffs
  summon?: string[];            // spawn additional enemies
  statusApply?: { target: 'all_players'; status: StatusId }[];
  clockStart?: string;          // start a progress clock
}
```

### 12b. Resolution

- Phase transitions are client-detected (HP threshold check after damage).
- Client fires `onEnter` effects immediately (heal, cleanse, summon).
- LLM receives phase transition data and narrates the transformation.
- Each phase is mechanically a different stat block — the boss effectively becomes a new entity.

---

## 13. Template Architecture

### 13a. Principle

**Templates provide structure. Random tables provide variety. LLM provides flavor.**

```
┌──────────────────────────────────────────────────┐
│              Content Template Library             │
│  Location types, NPC archetypes, item tables,    │
│  skill defs, encounter formulas — all JSON/TS    │
└────────────────────────┬─────────────────────────┘
                         │
           Client picks template + rolls from tables
                         │
                         ▼
┌──────────────────────────────────────────────────┐
│          Creative Ops LLM (minimal call)          │
│  Input:  skeleton + constraints (~200 tokens in)  │
│  Output: name + flavor (~60-120 tokens out)       │
│  NO mechanics, NO stats, NO connections           │
└────────────────────────┬─────────────────────────┘
                         │
           Client merges template data + LLM flavor
                         │
                         ▼
┌──────────────────────────────────────────────────┐
│            Complete Entity in State               │
│  Mechanically complete from template              │
│  Narratively unique from LLM                      │
│  Ready to use — no further generation needed      │
└──────────────────────────────────────────────────┘
```

### 13b. Location Templates

```typescript
interface LocationTemplate {
  type: LocationType;             // 'tavern' | 'shop' | 'dungeon_room' | 'wilderness' | ...
  tags: string[];                 // ['urban', 'social', 'rest']
  featureTable: WeightedEntry<FeatureDefinition>[];
  ambianceTable: {
    lighting: string[];
    noise: string[];
    mood: string[];
    scent: string[];
  };
  eventTable: WeightedEntry<EventDefinition>[];
  extraPool: WeightedEntry<ExtraRoll>[];
  notableSlots: { min: number; max: number; archetypePool: string[] };
  connectionRules: ConnectionRule[];   // what location types can connect
  availableActions: ActionType[];
}
```

**Example: Tavern tables**

```typescript
const TAVERN: LocationTemplate = {
  type: 'tavern',
  tags: ['urban', 'social', 'rest'],
  featureTable: [
    { item: { id: 'bar_counter', interactable: true, type: 'furniture' }, weight: 100 },
    { item: { id: 'notice_board', interactable: true, type: 'quest_source' }, weight: 70 },
    { item: { id: 'gambling_table', interactable: true, type: 'minigame' }, weight: 40 },
    { item: { id: 'stage_area', interactable: true, type: 'performance' }, weight: 25 },
    { item: { id: 'back_room', interactable: true, type: 'hidden', check: { dc: 8 } }, weight: 35 },
    { item: { id: 'cellar_entrance', interactable: true, type: 'hidden', check: { dc: 10 } }, weight: 15 },
  ],
  ambianceTable: {
    lighting: ['dim', 'warm_firelight', 'smoky', 'bright_lanterns'],
    noise: ['quiet', 'moderate', 'loud', 'deafening'],
    mood: ['tense', 'rowdy', 'melancholy', 'festive'],
    scent: ['ale_and_smoke', 'roast_meat', 'damp_wood', 'incense'],
  },
  eventTable: [
    { item: { id: 'bar_fight', chance: 0.3, trigger: 'provocation' }, weight: 50 },
    { item: { id: 'rumor_drop', chance: 0.6, trigger: 'eavesdrop_or_interact' }, weight: 80 },
    { item: { id: 'pickpocket', chance: 0.15, trigger: 'passive_check' }, weight: 30 },
    { item: { id: 'bounty_hunter_enters', chance: 0.1, trigger: 'timed' }, weight: 20 },
  ],
  extraPool: [
    { item: { archetype: 'patron_drunk', countRange: [1, 4] }, weight: 80 },
    { item: { archetype: 'patron_quiet', countRange: [0, 2] }, weight: 60 },
    { item: { archetype: 'bard', countRange: [0, 1] }, weight: 30 },
    { item: { archetype: 'gambler', countRange: [0, 3] }, weight: 40 },
  ],
  notableSlots: { min: 0, max: 2, archetypePool: ['merchant', 'quest_giver', 'informant', 'retired_adventurer'] },
  connectionRules: [{ allowedTypes: ['street', 'alley', 'market', 'inn_room'] }],
  availableActions: ['interact', 'rest', 'shop', 'eavesdrop'],
};
```

The LLM generates **only the location name** (~10 tokens). Everything else is rolled from tables.

### 13c. Item Templates

```typescript
interface ItemTemplate {
  type: 'weapon' | 'armor' | 'accessory' | 'consumable';
  subtype: string;               // 'sword', 'staff', 'potion', 'ring', ...
  rarityWeights: { common: number; uncommon: number; rare: number; legendary: number };
  statRanges: {                  // rolled within range based on rarity
    [stat: string]: { min: number; max: number };
  };
  elementPool?: ElementType[];   // possible elements (if applicable)
  propertyPool?: WeightedEntry<string>[];  // possible special properties
  costFormula: string;           // e.g., "baseCost * rarityMultiplier"
}
```

Items are **fully template-generated** with zero LLM. Flavor text comes from locale keys keyed by subtype + rarity.

### 13d. Encounter Templates

```typescript
interface EncounterTemplate {
  type: 'combat' | 'social' | 'puzzle' | 'chase' | 'stealth';
  difficultyBudget: number;      // point budget for enemy composition
  enemyPool: WeightedEntry<{ archetype: string; cost: number }>[];
  environmentFeatures: WeightedEntry<string>[];  // cover, hazards, interactive objects
  clockChance: number;           // chance of an active clock in this encounter
  villainChance: number;         // chance of a phase-boss instead of normal enemies
  lootTable: string;             // reference to loot table ID
}
```

---

## 14. Three-Tier NPC System

### 14a. Tiers

| | Extras | Notable | Vital |
|---|---|---|---|
| **Identity** | Generic label ("醉漢", "守衛") | Generated name + title | Full authored name |
| **Stats** | Archetype defaults | Basic stat block | Full stat block |
| **Agenda** | None | 1-line goal | Multi-layered goals |
| **Personality** | Archetype tag only | 1-line personality | Full behavior directives, speech patterns, dialogue examples |
| **Dialogue** | LLM improvises from tag | LLM improvises from agenda + personality | Full profile with examples |
| **Affection tracking** | No | No | Full Hype/Affection/Lust |
| **Profile updates** | Never | Never | Every 5 CEs |
| **Persistence** | Scene-scoped, disposable | Session-scoped, recyclable | Cross-session, saveable |
| **Token cost to create** | 0 | ~40-60 (name + agenda + personality) | 200+ (full profile) |
| **Context injection size** | ~5 tokens (label in scene list) | ~20-30 tokens (one-liner) | 200+ tokens (full profile block) |

### 14b. Data Shapes

```typescript
// Extras — pure template, zero LLM
interface ExtraNPC {
  label: string;                 // "酒館常客", "巡邏守衛"
  archetype: NPCArchetype;       // → stat defaults, combat behavior, service list
  tags: string[];                // ["drunk", "gossip", "cowardly"]
  scope: 'scene';
}

// Notable — template + minimal LLM seasoning
interface NotableNPC {
  id: string;
  name: string;                  // LLM-generated: "鐵砧婆婆"
  archetype: NPCArchetype;
  statBlock: BasicStatBlock;      // hp, defense, mDefense, 1-2 skills
  agenda: string;                // "想找人護送貨物到北門"
  personality: string;           // "急躁但慷慨" — ONE line, no more
  appearance: string[];          // 2-3 tags: ["白髮", "皮圍裙"]
  scope: 'session';
}

// Vital — full profile (existing DogeChat NPC system)
interface VitalNPC {
  // Full NPC profile as currently defined:
  // name, background, personality, behavior directives,
  // dialogue examples, speech patterns, appearance,
  // affection/hype/lust tracking, CE history, etc.
  scope: 'persistent';
}
```

### 14c. NPC Archetypes

Archetypes define the **mechanical skeleton** shared across tiers:

```typescript
interface NPCArchetype {
  id: string;                     // 'merchant', 'guard', 'quest_giver', 'bandit', ...
  category: 'civilian' | 'combatant' | 'specialist';
  defaultStats: BasicStatBlock;
  combatBehavior: 'aggressive' | 'defensive' | 'flee' | 'surrender' | 'support';
  services?: ServiceType[];       // ['buy', 'sell', 'appraise', 'repair']
  dialogueTags: string[];         // ['haggle', 'gossip', 'quest_hook', 'threaten']
  inventoryPool?: string;         // reference to item table for merchants
  extraLabels: string[];          // possible generic labels: ["商人", "小販", "行商"]
}
```

### 14d. Promotion / Demotion

**Notable → Vital promotion:**
1. Client detects 3+ meaningful interactions with a Notable NPC (UA flags significance).
2. Creative Ops call: generate full profile using existing Notable data as seed (~150 tokens out).
3. Upgrade data shape to VitalNPC. Start affection tracking. Persist to storage.

**Vital → Notable demotion:**
1. Vital NPC leaves the active narrative (location change, arc completion).
2. Retain name, agenda summary, and final affection state.
3. Drop heavy profile data (dialogue examples, behavior directives) from active context.
4. Full profile remains in storage — re-promoted if NPC returns.

### 14e. Context Injection

What the Main Session LLM sees per tier:

```
[Extras — scene dressing, near-zero token cost]
場景臨演：醉漢×2、吟遊詩人、賭徒×3

[Notable — one line each]
鐵砧婆婆（武器商人）— 急躁但慷慨，想找人護送貨物到北門

[Vital — full profile block, as today]
薇拉（酒館老闆娘）— [behavior directives, dialogue examples, ...]
```

---

## 15. Token Budget Impact

### 15a. Content Generation Costs

| Task | Narrative-heavy approach | Templated approach |
|---|---|---|
| Generate a location | ~300-500 tokens out | ~10-20 (name only) |
| Instantiate NPC (Extra) | ~150-300 tokens out | 0 (pure template) |
| Instantiate NPC (Notable) | ~200-400 tokens out | ~40-60 (name + personality) |
| Create an item | ~150-250 tokens out | 0 (pure template) or ~30 for unique flavor |
| Resolve a skill | ~100-200 tokens out | 0 (client math) |
| Populate a full scene | ~800-1500 tokens out | ~60-120 total |
| Narrate a turn | ~200-400 tokens out | Same (this IS the LLM's core job) |

### 15b. Context Window Savings

| Content | Before (all LLM-managed) | After (template-driven) |
|---|---|---|
| 8 Extras in scene | ~80 tokens each = 640 | ~5 tokens each = 40 |
| 2 Notables in scene | ~200 tokens each = 400 | ~25 tokens each = 50 |
| 1 Vital in scene | ~300 tokens | ~300 tokens (unchanged) |
| Location description | ~150 tokens in context | ~50 tokens (features as data, not prose) |
| **Scene total** | ~1490 tokens | ~440 tokens |

Estimated **60-70% reduction** in generation costs and **50-70% reduction** in per-turn context usage for scene population.

---

## 16. Implementation Priority

```
Phase 1 — Foundation (tightly coupled, build together)
  1. Resource Pools (HP/MP/IP)
  2. Equipment Stats (build on mechanics_system_design.md)
  3. Status Effects Engine

Phase 2 — Structure (independent, can ship incrementally)
  4. Class/Job System
  5. Elemental Affinities
  6. Structured Initiative / Turn Order

Phase 3 — Enrichment (independent, polish layer)
  7. Meta-Currency
  8. Clock / Progress Tracker
  9. Villain Phases / Boss Mechanics

Phase 4 — Content Pipeline (can start in parallel with Phase 2)
  10. Template Library (location types, NPC archetypes, item tables)
  11. Random Table Engine (weighted rolls, constraint filtering)
  12. Three-Tier NPC System (Extras / Notable / Vital + promotion)
  13. Creative Ops integration (minimal LLM calls for flavor)
```

### 16a. Dependency Graph

```
                    Resource Pools (HP/MP)
                   /        |         \
          Equipment    Status Effects   Initiative
              |            |
         Elemental     Villain Phases
         Affinities
                               
         Class/Job ──── (uses Traits + Resource Pools)
         
         Meta-Currency ──── (independent)
         Clocks ──── (independent)
         
         Template Library ──── (independent, parallel track)
              |
         Random Tables + NPC Tiers
              |
         Creative Ops Integration
```

### 16b. What Can Be Built on Current DogeChat

All of these systems slot into the existing architecture:

- **Resource Pools** → new fields on character state, displayed in Status Window
- **Equipment** → extends `LoreMechanics` from `mechanics_system_design.md`
- **Status Effects** → new state array, processed in Event Agent pipeline client resolution
- **Class/Job** → new data layer referencing existing Trait system
- **Initiative** → new phase in orchestrator turn processing
- **Templates** → new `src/templates/` directory, pure data files
- **NPC Tiers** → extends existing NPC profile system with lighter-weight variants

No architectural rewrites required. The Event Agent pipeline and client-authoritative pattern already enforce the right boundaries.

---

## 17. Open Questions

1. **Attribute system**: FU uses 4 attributes (Might/Dexterity/Insight/Willpower) with variable die sizes. DogeChat uses flat 2d6. Adopt variable dice or keep 2d6 with modifier-based differentiation?
2. **Party size**: Single PC (current) or multi-PC support? Multi-PC is a significant scope expansion (shared initiative, per-PC actions, party formation).
3. **Death/permadeath**: KO-only (FU default) or optional permadeath? Arcanum-configurable?
4. **Crafting**: Item templates cover loot and shops. Is a crafting system (combine materials → new items) in scope?
5. **Module boundaries**: Which of these systems are core vs module? Resource Pools and Status Effects feel core. Elemental affinities and Villain Phases might be module-scoped.
