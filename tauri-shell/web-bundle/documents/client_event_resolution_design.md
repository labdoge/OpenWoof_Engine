# Client-Authoritative Event Resolution System

Version: 1.0 — 2026-03-20
**Status:** Implemented in `src/modules/trait-system.ts`, `src/modules/tendency-system.ts`, `src/modules/action-selector.ts`, `src/modules/event-resolver.ts`, `src/orchestrator/event-pipeline.ts`.
**Note:** Ability types (Sec 2) replaced by GameTrait system. SP removed as designed. Guard/assist/defend mechanics fully implemented.

## Combat v2 Specialization

Combat now has a specialized side-level resolver in `src/modules/combat-v2.ts`. It does not use the generic per-participant HP resolver described below.

Combat v2 authority:

1. Client owns force, threshold, pressure, dice, KO, persistence, HUD, and endgame.
2. UA emits combat phase and severity. EA parses player action, target, and optional accountable trait IDs.
3. Scene Ops may help draft roster or aftermath/rescue digest only.
4. Main Session narrates the injected Combat v2 resolution block and must not invent extra mechanical outcomes.

The generic event resolver below remains active for non-combat events and as legacy fallback state handling.

## 1. Design Principles

1. **Client-first**: All mechanical state (HP, CD, tendencies, dice, entity data) is client-authoritative. LLM never computes numbers.
2. **LLM provides flavor only**: Display names, ability names, narrative hints, dramatic overrides. Never raw stats.
3. **Universal 2d6**: All tests and events use 2d6. No conflicting resolution mechanics.
4. **No SP**: Abilities are gated by cooldown only. SP is removed from the system entirely.
5. **Module-agnostic core**: Ability system, tendency tables, role pools, and CD tracking are core infrastructure. Modules (Combat, Puzzle) register event-specific severity tables and role pools.
6. **Persist everything**: All combat/event state persists in moduleStates (IndexedDB). Sessions resume seamlessly.

---

## 2. Pipeline: UA → EA → Client → Main Session

```
Player input (natural language)
    │
    ▼
┌──────────────────────────────────────────────────────┐
│ UA (Utility Agent) — narrative authority              │
│                                                       │
│ Evaluates: hype, lust, status, pacing                 │
│ Decides:   event phase (init/ongoing/end)              │
│            severity tier (for init)                    │
│            spawns / reinforcements                     │
│            retreats / surrenders                       │
│            "boss enters phase 2"                       │
│ Outputs:   UAEventDirective (event field in eval)      │
└───────────────────────┬──────────────────────────────┘
                        │ UA directive
                        ▼
┌──────────────────────────────────────────────────────┐
│ EA (Event Agent) — bidirectional interpreter          │
│                                                       │
│ Reads:     UA directive + player input + client state  │
│ Parses:    player natural language → action + target   │
│ Suggests:  0-N dramatic overrides for entities         │
│ Updates:   tendency changes for vital NPCs             │
│ Triggers:  ability activations                         │
│ Outputs:   ~100 tokens JSON                            │
└───────────────────────┬──────────────────────────────┘
                        │ EA output
                        ▼
┌──────────────────────────────────────────────────────┐
│ CLIENT — mechanical authority                         │
│                                                       │
│ Applies:   EA overrides to this turn                  │
│ Rolls:     remaining entities from tendency tables     │
│ Resolves:  all 2d6 dice, efficacy, effects             │
│ Updates:   HP, CD, advantage/disadvantage states       │
│ Detects:   defeats, combat end (all HP=0)              │
│ Builds:    resolution block for Main Session           │
│ Persists:  all state to IndexedDB                      │
└───────────────────────┬──────────────────────────────┘
                        │ mechanical results
                        ▼
┌──────────────────────────────────────────────────────┐
│ Main Session — sole narrative voice                   │
│                                                       │
│ Receives: resolution block (dice, outcomes, defeats)   │
│ Narrates: results faithfully                           │
│ MUST NOT: contradict mechanical outcomes               │
└──────────────────────────────────────────────────────┘
```

### Combat End — Dual Authority
- **Client**: all enemies HP ≤ 0 → auto-end (victory). Signal to LLM.
- **UA**: surrender, retreat, negotiation → `phase='end'`. Signal to client.
- **Player**: PLOT override with `eventEnd: true`.

---

## 3. Ability System (Core Infrastructure)

### 3.1 Ability Types

| Type | Base Mechanic | Typical Use |
|------|--------------|-------------|
| `attack` | Deal efficacy damage to target | Combat strikes, spells |
| `defend` | Grant self advantage on next incoming attack | Blocking, dodging, shielding |
| `support` | Heal target efficacy HP, OR grant target advantage next turn | Healing, buffing allies |
| `harass` | Inflict disadvantage on target next turn | Debuffs, crowd control |
| `utility` | 2d6 test against threshold — success/fail | Lockpicking, detection, traversal |
| `narrative` | No mechanical effect — CD tracked, LLM narrates outcome | Transformation, ritual, sacrifice |

### 3.2 Ability Ranks

| Rank | Cooldown | Max Tags | Available To |
|------|----------|----------|-------------|
| `standard` | 1 turn | 1 | All ranks (mob, elite, boss) |
| `epic` | 3 turns | 2 | Elite, boss only |

### 3.3 Modifier Tags (Stackable)

Tags modify HOW an ability's base effect is applied. All numeric effects derive from the existing **efficacy = highest die** system. No separate damage formulas.

| Tag | Effect | Example |
|-----|--------|---------|
| `aoe` | Affects all enemies or all allies instead of single target | 「震地波」hits all enemies |
| `power` | +3 modifier to roll | 「蓄力斬」stronger attack |
| `precise` | Grants advantage on this roll | 「精準射擊」careful aim |
| `drain` | Heal self for efficacy dealt | 「吸血咬」lifesteal |
| `shield` | Reduce incoming damage by efficacy this turn | 「魔法護盾」absorbs |
| `cleanse` | Remove disadvantage from target | 「淨化」clears debuffs |
| `provoke` | Force target to attack self next turn | 「嘲諷」draws aggro |

### 3.4 Tag Allowance by Enemy Rank

| Rank | Abilities | Tags per Ability |
|------|-----------|-----------------|
| mob | 0-1 (standard only) | 0 |
| elite | 1-2 (standard + up to 1 epic) | 1 |
| boss | 2-3 (standard + epic) | 1-2 |
| swarm | 0 | 0 |

### 3.5 Non-Combat Abilities

Abilities are NOT combat-specific. Examples:
- A `utility:detect` ability can reveal hidden traps during exploration.
- A `narrative:transform` ability (e.g., turn water to ice) fires when LLM signals via EA, tracked by CD.
- A `support:heal` ability can be used after combat during rest.
- CD ticks per turn regardless of event type. Client tracks globally.

### 3.6 Ability Hint Field

Each ability carries a `hint` string that tells EA/LLM what it does thematically. The hint is a short tag from a controlled vocabulary:

**attack**: `slash`, `pierce`, `smash`, `ranged`, `aoe`
**defend**: `shield`, `dodge`, `parry`, `fortify`
**support**: `heal`, `buff_advantage`, `buff_modifier`, `cleanse`
**harass**: `debuff`, `slow`, `fear`, `disarm`, `taunt`
**utility**: `detect`, `unlock`, `traverse`, `create`
**narrative**: `transform`, `sacrifice`, `summon`, `ritual`

EA reads hints to know when/how to trigger abilities. Main Session reads hints to narrate. Client reads hints to apply mechanical effects.

---

## 4. Tendency System

### 4.1 Definition

A **tendency** is a probability distribution over actions that determines how an entity behaves by default. Client rolls against the distribution each turn to select an action.

```typescript
interface Tendency {
  [action: string]: number;  // action → percentage (must sum to 100)
}

// Example: aggressive brawler
{ attack: 80, defend: 20 }

// Example: cautious supporter
{ support: 60, defend: 30, attack: 10 }
```

### 4.2 Assignment

- **Enemies**: Client assigns tendency based on role (see §5 Role Pools). Set at spawn time, never changes.
- **Vital NPCs (allies)**: EA assigns tendency when NPC first enters a combat/event scene. Can be updated by EA when narrative demands it (e.g., affection milestone, dramatic moment).
- **Player**: No tendency. Player actions come from natural language input parsed by EA.

### 4.3 Client Action Selection

Each turn, for each entity with a tendency:
1. Roll 1-100.
2. Map to action based on cumulative distribution.
3. Select target: highest-threat for attacks, lowest-HP ally for support, random for harass.
4. Check if selected action requires an ability on CD → fallback to basic attack/defend.

EA overrides (§6.2) replace the tendency roll for specific entities on specific turns.

---

## 5. Role Pools

### 5.1 Combat Roles

Each role defines a default tendency and which ability types the entity can receive.

| Role | Default Tendency | Ability Types | Description |
|------|-----------------|---------------|-------------|
| `brawler` | attack:80, defend:20 | attack, defend | Frontline damage dealer |
| `skirmisher` | attack:60, harass:30, defend:10 | attack, harass | Mobile harasser |
| `controller` | harass:50, defend:30, attack:20 | harass, defend, utility | Crowd control specialist |
| `commander` | support:40, attack:40, defend:20 | support, attack | Buff/lead from front |
| `supporter` | support:60, defend:30, attack:10 | support, defend | Healer/buffer |

### 5.2 Role Assignment

- Client rolls from the role pool when spawning enemies.
- Role determines both the tendency table AND which ability types the entity can receive.
- Elites/bosses may have multiple roles (e.g., brawler+commander for a war chief).

### 5.3 Non-Combat Roles (Puzzle Module — Future)

To be defined per event type. The core infrastructure (tendency + role → ability mapping) is shared.

---

## 6. EA Specification

### 6.1 Input

```typescript
interface EAInput {
  eventType: string;                    // 'combat', 'puzzle', etc.
  uaDirective: string;                  // UA's scene direction
  playerInput: string;                  // raw SPEAK/DO/PLOT text
  participants: EAParticipantInfo[];    // all entities with current state
  activeAbilities: ActiveAbilityInfo[]; // abilities off CD, with hints
  sceneContext?: string;                // location, terrain, weather
}
```

### 6.2 Output

```typescript
interface EAOutput {
  /** Player's natural language parsed into a mechanical action. */
  playerAction: {
    action: string;       // 'attack', 'defend', 'ability', 'interact', etc.
    target?: string;      // entity ID or scene notable name
    abilityUsed?: string; // ability ID if using an ability
  };

  /** Dramatic overrides — replace tendency roll for specific entities this turn. */
  overrides?: Array<{
    id: string;           // entity ID
    action: string;       // forced action
    target?: string;
    abilityId?: string;   // if forcing an ability
    reason: string;       // brief context for logging (≤20 chars)
  }>;

  /** Tendency updates — change an NPC's combat behavior going forward. */
  tendencyUpdates?: Array<{
    id: string;           // entity ID (vital NPCs only)
    newTendency: Record<string, number>;
    reason: string;
  }>;

  /** Ability triggers — signal that an ability should fire this turn. */
  abilityTriggers?: Array<{
    id: string;           // entity ID
    abilityId: string;
    target?: string;
    context: string;      // narrative context for Main Session
  }>;

  /** Advantage/disadvantage from narrative context (merged with client sources). */
  modifiers?: Array<{
    id: string;           // entity ID
    advantage?: boolean;
    disadvantage?: boolean;
    reason: string;       // ≤15 chars
  }>;

  /** Free-text hint for Main Session narration. */
  narrativeHints?: string;
}
```

### 6.3 Token Budget

EA is designed to be lightweight:
- System prompt: ~300 tokens
- Input context: ~200-400 tokens (participant list + directive)
- Output: ~100-200 tokens (JSON, most fields optional)
- Model: Utility slot, temperature 0.1
- Max tokens: 400 (hard cap — forces brevity)

### 6.4 Advantage/Disadvantage — Dual Source

| Source | Decides | Examples |
|--------|---------|---------|
| **Client** (deterministic) | Active buffs, combat flags, ability effects (`precise` tag, `provoke` forcing attack) | `shield` active → advantage on defend; `surrounded` flag → disadvantage |
| **EA** (contextual) | Terrain, weather, positioning, narrative situation | Rain on stone bridge → disadvantage; high ground → advantage |
| **Merge rule** | If EITHER source says advantage, it fires. If both advantage AND disadvantage, they cancel. | Standard 5e-style resolution |

---

## 7. Enemy Generation (Combat Module)

### 7.1 Severity Tiers

UA signals a severity tier in the event init directive. Client looks up the fixed composition table.

| Tier | Composition | When To Use |
|------|------------|-------------|
| `trivial` | 3 mobs | Random encounter, patrol, wildlife |
| `standard` | 4 mobs + 1 elite, OR 5 mobs | Planned encounter, ambush |
| `tough` | 2 mobs + 2 elites, OR 3 mobs + 1 elite + 1 swarm | Significant battle |
| `boss` | 1-2 mobs + 1 elite + 1 boss | Major story battle |

**Hard cap**: Maximum 5 enemy entities after composition (post-swarm merge).

### 7.2 Tier Availability

Scenario or arcanum rules can restrict which tiers are available. For example:
- A dangerous dungeon: `trivial` is never an option.
- A peaceful village: only `trivial` available.
- Default: all tiers available, UA chooses based on pacing.

Configuration via arcanum rule (config-patch type):
```json
{ "combat": { "availableSeverities": ["standard", "tough", "boss"] } }
```

### 7.3 Client Generation Flow

On `event.phase = 'init'`:

1. **UA** emits: `{ severity: "standard", context: "goblin patrol in dungeon corridor" }`
2. **Client** looks up composition table → e.g., 4 mobs + 1 elite
3. **Client** rolls role pool for each entity:
   - mob_01: brawler → tendency {attack:80, defend:20}, 0 abilities
   - mob_02: skirmisher → tendency {attack:60, harass:30, defend:10}, 0 abilities
   - mob_03: brawler → ...
   - mob_04: brawler → ...
   - elite_01: controller → tendency {harass:50, defend:30, attack:20}, 1 standard ability (type: harass, hint: fear, tags: [])
4. **Client** assigns HP from rank defaults:
   - mob: 5-15 (random within range)
   - elite: 20-40
   - boss: 50-100
   - swarm: 10 (fixed)
5. **Client** registers all entities in roster + resource pools.
6. **Client** calls Creative Ops for enrichment (§8).

### 7.4 Mid-Combat Spawns (Reinforcements)

UA can signal reinforcements during `phase='ongoing'`:
```json
{ "reinforce": { "severity": "trivial", "context": "goblin reinforcements from tunnel" } }
```
Client generates new entities using the same flow, adds to roster, calls enrichment for new entities only. Hard cap (5 total) still enforced — excess discarded.

### 7.5 Enemy Data Structure

```typescript
interface GeneratedEnemy {
  id: string;              // client-generated: "mob_01", "elite_01", "boss_01"
  rank: EnemyRank;         // 'mob' | 'elite' | 'boss' | 'swarm'
  role: CombatRole;        // 'brawler' | 'skirmisher' | 'controller' | 'commander' | 'supporter'
  hp: number;              // max HP (rolled from rank range)
  hpCurrent: number;       // current HP
  tendency: Tendency;       // action probability distribution
  abilities: GeneratedAbility[];
  // --- Enriched by Creative Ops (null until enrichment) ---
  displayName?: string;    // e.g., "刀疤哥布林"
  aiHint?: string;         // e.g., "持短刀,低姿衝鋒"
}

interface GeneratedAbility {
  id: string;              // "standard_0", "epic_0"
  type: AbilityType;       // 'attack' | 'defend' | 'support' | 'harass' | 'utility' | 'narrative'
  rank: AbilityRank;       // 'standard' | 'epic'
  hint: string;            // e.g., 'fear', 'slash', 'heal'
  tags: ModifierTag[];     // e.g., ['aoe'], ['power', 'precise']
  cooldown: number;        // 1 for standard, 3 for epic
  cooldownRemaining: number;
  // --- Enriched by Creative Ops ---
  displayName?: string;    // e.g., "恐懼嚎叫"
}
```

---

## 8. Enrichment Protocol (Creative Ops)

### 8.1 When It Fires

- Once per batch of newly spawned entities (init or reinforcement).
- Also once when a vital NPC first enters an event scene (for tendency + ability flavor).

### 8.2 Input

```
Event context: "goblin patrol in dungeon corridor"
Entities to enrich:
  mob_01 | rank:mob | role:brawler | abilities: none
  mob_02 | rank:mob | role:skirmisher | abilities: none
  elite_01 | rank:elite | role:controller | abilities: [harass:fear(standard)]
```

### 8.3 Output

```json
[
  { "id": "mob_01", "displayName": "刀疤哥布林", "aiHint": "持短刀,低姿衝鋒" },
  { "id": "mob_02", "displayName": "綠皮哥布林斥候", "aiHint": "輕裝,投擲石頭騷擾" },
  {
    "id": "elite_01",
    "displayName": "獨眼哥布林祭司",
    "aiHint": "持骨杖,指揮群體",
    "abilities": [{ "id": "standard_0", "displayName": "恐懼嚎叫" }]
  }
]
```

### 8.4 Token Budget

- System prompt: ~150 tokens
- Input: ~100-200 tokens (entity list + context)
- Output: ~100-200 tokens (names + hints)
- Total: ~500 tokens per enrichment call
- Model: Creative Ops slot

### 8.5 Vital NPC Enrichment

When a vital NPC enters an event scene for the first time:
- Client sends NPC personality traits to Creative Ops
- Creative Ops returns: combat role, tendency, ability flavor names (if NPC has abilities)
- OR: EA assigns tendency on first combat turn (simpler, one fewer call)

Recommendation: Let EA assign vital NPC tendencies (§6.2 `tendencyUpdates`) on the first combat turn. Saves an extra API call and EA already has narrative context.

---

## 9. Dice & Resolution (Universal)

### 9.1 Standard Test: 2d6

All tests use 2d6 with the following tier thresholds:

| Total | Tier | Label |
|-------|------|-------|
| 2 | `critical_failure` | 大失敗 |
| 3-6 | `failure` | 失敗 |
| 7-9 | `success` | 成功 |
| 10-12 | `great_success` | 大成功 |

### 9.2 Advantage / Disadvantage

- **Advantage**: Roll 3d6, keep highest 2.
- **Disadvantage**: Roll 3d6, keep lowest 2.
- If both apply, they cancel → standard 2d6.

### 9.3 Modifiers

- Applied as flat bonus/penalty to the roll total.
- Source: ability tags (`power` = +3), terrain, equipment.
- Applied AFTER keeping dice, BEFORE tier evaluation.

### 9.4 Efficacy

- On success: efficacy = highest kept die.
- On failure: efficacy = 0.
- Efficacy determines: damage dealt, HP healed, debuff strength.

### 9.5 Effect Application by Ability Type

| Type + Result | Effect |
|---------------|--------|
| attack + success | Target takes efficacy damage |
| attack + fail | Miss, no effect |
| defend + success | Self gains advantage on next incoming attack |
| defend + fail | No defensive benefit |
| support + success | Target healed efficacy HP, OR target gains advantage next turn |
| support + fail | Support attempt fails |
| harass + success | Target gains disadvantage next turn |
| harass + fail | Harass fails |
| utility + success | Contextual success (unlock door, detect trap, etc.) |
| utility + fail | Contextual failure |
| narrative | No roll. CD tracked. LLM narrates freely. |

### 9.6 Tag Effects (Applied on Success)

| Tag | Additional Effect |
|-----|-------------------|
| `aoe` | Effect applies to all valid targets instead of one |
| `power` | +3 modifier to roll |
| `precise` | This roll has advantage |
| `drain` | Attacker heals self for efficacy dealt |
| `shield` | Reduce all incoming damage by efficacy this turn |
| `cleanse` | Remove disadvantage from target |
| `provoke` | Target must attack self next turn (override tendency) |

---

## 10. UA Event Directive (Revised)

### 10.1 Init Phase

```typescript
interface UAEventDirective_Init {
  active: true;
  phase: 'init';
  type: string;                // 'combat', 'puzzle', etc.
  severity: SeverityTier;      // 'trivial' | 'standard' | 'tough' | 'boss'
  context?: string;            // scene flavor for enrichment
}
```

Note: `spawns[]` is REMOVED. Client generates entities from severity table.

### 10.2 Ongoing Phase

```typescript
interface UAEventDirective_Ongoing {
  active: true;
  phase: 'ongoing';
  type: string;
  direction?: string;          // prose for EA context
  reinforce?: {                // mid-combat spawns
    severity: SeverityTier;
    context?: string;
  };
}
```

### 10.3 End Phase

```typescript
interface UAEventDirective_End {
  active: false;
  phase: 'end';
  type: string;
  endReason: string;           // 'victory' | 'retreat' | 'surrender' | 'negotiated' | 'player_knockout'
}
```

---

## 11. Persistence Model

### 11.1 What Is Persisted (IndexedDB via moduleStates)

| Data | Location | Notes |
|------|----------|-------|
| Enemy roster | `moduleStates[moduleId].enemyRoster` | Full GeneratedEnemy objects including enriched names |
| Scene active flag | `moduleStates[moduleId].sceneActive` | Boolean |
| Combat flags | `moduleStates[moduleId].combatFlags` | Array of strings |
| Resource pools (HP) | `moduleStates[moduleId].resources[entityId]` | Per-entity HP pools |
| NPC tendencies | `moduleStates[moduleId].npcTendencies` | Per-NPC tendency tables |
| Ability cooldowns | Stored on each entity's ability objects | `cooldownRemaining` field |

### 11.2 Transient State (Restored on Resume)

| Data | Restoration Method |
|------|-------------------|
| `_activeEventType` | Check `sceneActive` flag on resume |
| `_lastEAActions` | Not needed — rebuilt each turn |

### 11.3 Session Resume Flow

1. `loadState()` restores all moduleStates from IndexedDB.
2. Check `sceneActive` → restore `_activeEventType`.
3. Enemy roster, HP, abilities, tendencies, CDs all intact.
4. Next turn proceeds normally — no re-enrichment needed.

---

## 12. Module Landscape

| Module | Event Types | Severity Tables | Roles | Status |
|--------|------------|----------------|-------|--------|
| **Combat** | `combat` | trivial/standard/tough/boss | brawler/skirmisher/controller/commander/supporter | Core |
| **Puzzle** | `puzzle`, `exploration`, `social` | Mystery difficulty tiers (TBD) | TBD per puzzle type | Planned |
| **Erotic** | (hooks only, no event types) | — | — | Existing |
| **Challenge** | `survival`, `endurance` | TBD | TBD | Future/optional |

### 12.1 Shared Core Infrastructure

All modules share:
- Ability system (6 types, 2 ranks, CD tracking, modifier tags)
- Tendency tables (action probability distributions)
- Role pools (archetype → ability/tendency mapping)
- 2d6 universal resolution
- EA interpreter (schema varies by event type)
- Enrichment protocol (Creative Ops)
- Persistence model

### 12.2 Module-Specific Registration

Each module registers:
- Severity table (composition mapping)
- Role pool (archetypes for that event type)
- Action vocabulary (valid actions for the event type)
- Hook implementations (intensity, dynamic prompt, onTurnEnd, etc.)

---

## 13. Puzzle Module (Structure — Details TBD)

### 13.1 Mystery Tracker

A puzzle defines N **mysteries**, each with:
- Description (what needs to be solved)
- Requirements (conditions to resolve — similar to bottleneck quests)
- Blocked resources (locations, information gated behind this mystery)
- Status: `locked` | `unlocked` | `resolved`

### 13.2 Puzzle Resolution

- Player uses `utility` or `narrative` abilities to investigate.
- 2d6 test against mystery difficulty threshold.
- Success → progress toward resolution. Failure → no progress (no punishment).
- All mysteries resolved → puzzle complete, blocked resources unlocked.

### 13.3 Non-Combat Social Encounters

Social encounters (negotiation, interrogation) handled by Puzzle module:
- NPC disposition as "social HP" (can be shifted by persuasion/intimidation).
- `support` abilities map to vouching/persuasion.
- `harass` abilities map to intimidation/threats.
- Tendency tables for NPC social behavior (e.g., `{ resist: 50, concede: 20, counter: 30 }`).

---

## 14. Migration Notes

### 14.1 What Changes From Current System

| Current | New |
|---------|-----|
| UA generates `spawns[]` with enemy details | UA sends `severity` tier only; client generates |
| EA translates UA direction into per-participant actions | EA interprets player input + suggests overrides |
| EA decides ALL participant actions | Client decides via tendency tables; EA overrides |
| SP resource for abilities | Removed — CD only |
| EA outputs action for every participant | EA outputs player action + 0-N overrides |
| `CombatDecisionResult` from old Combat Agent | Removed — replaced by tendency system |
| Per-participant HP in resolution block | Removed from Block 3 — shown by HUD only |

### 14.2 What Stays The Same

- 2d6 dice system, advantage/disadvantage, efficacy = highest die
- Enemy ranks: mob, elite, boss, swarm
- Combat intensity scoring (for dynamic narration prompts)
- Combat HUD rendering (enemy groups, rank badges)
- Player knockout failsafe (never game-over)
- PLOT override (god directive, bypasses mechanics)
- Module hook system (isRollWorthy, getIntensity, getDynamicPrompt, etc.)
- XP per defeat, critical events
