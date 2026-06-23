# Event Agent System Design

**Date:** 2026-03-20
**Status:** Implemented in `src/agents/event-agent.ts`, `src/orchestrator/event-pipeline.ts`, `src/modules/action-selector.ts`.
**Supersedes:** Combat Agent and Dice Agent sections of `combat_system_design.md` (Sections 4, 5, 13)
**Purpose:** Define the Event Agent (EA) — a generic, module-agnostic mid-agent that translates UA scene directives into structured participant actions for client resolution.

---

## 1. Design Principles

1. **UA directs, EA translates, Client resolves.** Three-tier pipeline. UA decides what should happen (plot direction). EA interprets that into structured per-participant actions. Client enforces mechanics (dice, damage, HP, validation) and feeds results to Main Session.
2. **One event type per turn.** Only one event type (combat, social, chase, puzzle, etc.) can be active at any time. No stacking. Conflict resolution rules handle mixed player intent.
3. **EA is a regulated translator, not a strategist.** EA does not decide strategy or plot — UA already did that. EA maps UA's prose direction into a fixed action schema defined by the active module. Like a "status window for actions."
4. **Player is a participant.** EA interprets and maps the player's raw input into a structured action alongside all NPC participants. Client treats everyone uniformly.
5. **Module-agnostic pattern.** Combat is the first consumer, but any module can register an event type with its own action schema. EA adapts to whichever schema is active.
6. **PLOT is god's directive.** PLOT input bypasses event type constraints entirely. UA maps it directly to narrative + numeric consequences. No EA call needed.

---

## 2. Architecture Overview

### 2a. Pipeline

```
Every turn:
  1. Parse player input (SPEAK/DO/PLOT/RECALL)
  2. If PLOT → UA maps to narrative + consequences → Client applies → Main Session narrates
  3. Run UA eval (hype/lust/status/event)
  4. If event.phase === 'init':
       → Client processes spawns/setup from UA directive
       → Main Session narrates the event beginning
       → NO EA call (setup only)
  5. If event.active && phase === 'ongoing':
       → Call EA with { type, participants, direction, playerInput, moduleSchema }
       → EA returns structured actions per participant (player + allies + enemies)
       → Client derives dice triggers from action types (lookup table)
       → Client runs Event Resolver (2d6 mechanics)
       → Client validates, applies effects, updates UI
       → Feeds resolution block to Main Session
  6. If event.phase === 'end':
       → Client clears event state, awards XP, applies hype effects
       → Main Session narrates conclusion
  7. If no event field → normal turn (no EA call, zero cost)
```

### 2b. Agent Topology (During Active Events)

```
Player input
    ↓
┌──────────────┐
│ UA Eval      │  ← Runs every turn
│ (hype/lust/  │
│  status/     │
│  event       │
│  directive)  │
└──────┬───────┘
       ↓ event directive
┌──────────────┐
│ Event Agent  │  ← Runs only when event.active
│ (translate   │
│  directive → │
│  structured  │
│  actions)    │
└──────┬───────┘
       ↓ participant actions
┌──────────────┐
│ Client       │  ← Always runs
│ (dice derive │
│  + resolve   │
│  + apply     │
│  + UI)       │
└──────┬───────┘
       ↓ resolution block
┌──────────────┐
│ Main Session │  ← Narrates everything
└──────────────┘
```

### 2c. What This Replaces

| Removed | Absorbed By |
|---------|------------|
| Combat Agent | UA (direction/strategy) + EA (action translation) |
| Dice Agent | Client (action→trigger lookup table per module) |
| `encounterBrewing` flag | `event.phase: "init"` |
| `combatActive` state field | `event.active` + `event.type` |
| Combat-specific orchestrator branch | Generic event branch |
| Parallel agent race conditions | Sequential UA → EA → Client flow |

### 2d. What Stays Unchanged

| Component | Role |
|-----------|------|
| Event Resolver (`src/modules/event-resolver.ts`) | Client-side 2d6 mechanics, participant rolling, damage calc |
| Dice Engine (`src/modules/dice-engine.ts`) | Pure dice functions (rollTest, rollEfficacy, resolveContest) |
| Combat HUD (`src/ui/combat-hud.ts`) | Renders from roster when `event.type === 'combat'` |
| Module hooks (intensity, dynamic prompt, etc.) | Fire based on event type via hook dispatcher |
| Resource pool system | Core infra, module-defined, client-authoritative |

---

## 3. UA Event Evaluation

### 3a. New `event` Field in UA Eval Output

UA eval gains an optional `event` field. When absent, no event is active — normal turn.

```typescript
interface UAEventDirective {
  active: boolean;
  phase: 'init' | 'ongoing' | 'end';
  type: string;                        // 'combat' | 'social' | 'chase' | etc.
  direction?: string;                  // prose direction for EA (ongoing phase)
  participants?: string[];             // entity IDs involved (ongoing phase)
  notables?: string[];                 // 0-5 interactable/notable scene elements (plain text)
  endReason?: string;                  // why event ended (end phase)

  // Init phase only:
  spawns?: EventSpawn[];               // new entities to create

  // End phase only:
  plotConsequences?: PlotConsequence;   // for PLOT-triggered endings
}

interface EventSpawn {
  id: string;                          // runtime entity ID
  name: string;                        // display name (zh-TW)
  rank?: string;                       // module-specific (combat: 'mob'|'elite'|'boss')
  hp?: number;                         // if module uses HP
  abilities?: SpawnAbility[];          // if rank supports abilities
  aiHint?: string;                     // behavioral hint
  description?: string;                // narrative description for context
}
```

### 3b. Event Lifecycle

```
No event    →  UA emits event.phase='init'     →  Client sets up roster/state
                                                    Main Session narrates beginning
            →  UA emits event.phase='ongoing'   →  EA called, actions resolved
                                                    (repeats each turn)
            →  UA emits event.phase='end'       →  Client clears state
                                                    Main Session narrates conclusion
            →  No event field                   →  Back to normal turns
```

**UA decides when events start and end.** The client does not activate events — it only processes what UA directs. Exception: client-side combat end detection (all enemies HP ≤ 0) can force `event.phase='end'` independently as a failsafe.

### 3c. UA Event Examples

**Combat starting (init):**
```json
{
  "hype": "強烈正面",
  "status": { "scene": { "location": "森林小徑" } },
  "event": {
    "active": true,
    "phase": "init",
    "type": "combat",
    "spawns": [
      { "id": "goblin_01", "name": "肥胖哥布林", "rank": "mob", "hp": 12, "aiHint": "aggressive" },
      { "id": "goblin_02", "name": "刀疤哥布林", "rank": "mob", "hp": 12, "aiHint": "flanker" },
      { "id": "orc_chief", "name": "獨眼獸人首領", "rank": "boss", "hp": 55, "abilities": [
        { "name": "重擊", "cooldown": 2 },
        { "name": "戰吼", "cooldown": 3 },
        { "name": "狂暴", "cooldown": 4 }
      ], "aiHint": "tactical" }
    ],
    "direction": "ambush from the treeline, orcs block the north path"
  }
}
```

**Combat ongoing:**
```json
{
  "hype": "輕微正面",
  "status": { ... },
  "event": {
    "active": true,
    "phase": "ongoing",
    "type": "combat",
    "participants": ["goblin_01", "goblin_02", "orc_chief"],
    "direction": "goblins regroup after losing flanker, chief becomes aggressive below 50% HP",
    "notables": ["火藥桶", "易燃木地板", "懸掛燈籠"]
  }
}
```

**Combat ending (victory):**
```json
{
  "hype": "強烈正面",
  "status": { ... },
  "event": {
    "active": false,
    "phase": "end",
    "type": "combat",
    "endReason": "victory"
  }
}
```

**Social event starting:**
```json
{
  "event": {
    "active": true,
    "phase": "init",
    "type": "social",
    "spawns": [],
    "direction": "merchant tries to pressure player into unfair deal using guilt"
  }
}
```

---

## 4. Event Agent (EA)

### 4a. Role

EA is a **regulated translator**. It receives:
- UA's `event.direction` (prose, what should happen)
- Participant list with capabilities (roster data from client state)
- Player's raw input (what the player is trying to do)
- Active module's action schema (valid actions, abilities, constraints)

It outputs:
- One structured action per participant (player + allies + enemies)
- Strict JSON array, no prose, no explanation

### 4b. Input Interface

```typescript
interface EventAgentInput {
  eventType: string;                   // from UA: 'combat', 'social', etc.
  direction: string;                   // from UA: prose scene direction
  playerInput: string;                 // raw player SPEAK/DO text
  participants: EAParticipantInfo[];   // all entities with capabilities
  actionSchema: EventActionSchema;     // valid actions for this event type
  context?: string;                    // scene summary if needed
}

interface EAParticipantInfo {
  id: string;
  name: string;                        // display name (zh-TW)
  faction: 'player' | 'ally' | 'enemy';
  rank?: string;                       // combat: mob/elite/boss
  hp?: { current: number; max: number };
  abilities?: { name: string; ready: boolean }[];
  aiHint?: string;
  traits?: string[];                   // personality traits affecting behavior
  affection?: number;                  // ally affection level (affects compliance)
}
```

### 4c. Output Interface

```typescript
interface EAParticipantAction {
  id: string;                          // entity ID
  name: string;                        // display name (zh-TW) — single source of truth
  action: string;                      // from module's valid action set, or 'interact' for scene elements
  target?: string;                     // target entity ID or notable name, if applicable
  note?: string;                       // brief context for Main Session
  abilityUsed?: string;                // if action is ability use
  advantage?: boolean;                 // EA judges from traits + scene context + positioning
  disadvantage?: boolean;              // EA judges from terrain, weather, status effects, etc.
  modifierNote?: string;               // why adv/dis applies (for logging + Main Session flavor)
}

// EA output is always: EAParticipantAction[]
```

**Advantage/Disadvantage:** EA decides ALL advantage/disadvantage per participant per action. EA has full context: participant traits (e.g., "原始本能"), scene environment (dark cave, rain, high ground), positioning (flanked, cornered), and UA's direction. The client does NOT interpret traits — it just reads the boolean flags and passes them to Event Resolver.

This replaces the previous `collectSceneRollModifiers()` approach, which could only do crude category matching on traits and couldn't interpret contextual relevance (e.g., "原始本能" is relevant in a dark forest fight but irrelevant during trade negotiation).

**Example output (combat with modifiers):**
```json
[
  { "id": "__player__", "name": "玩家", "action": "attack", "target": "goblin_01", "note": "sword_slash",
    "advantage": true, "modifierNote": "原始本能 — darkness favors primal instinct" },
  { "id": "lin_xue", "name": "林雪", "action": "ability:heal", "target": "__player__", "note": "protective_instinct" },
  { "id": "goblin_01", "name": "肥胖哥布林", "action": "attack", "target": "lin_xue", "note": "target_healer",
    "disadvantage": true, "modifierNote": "blinded by lantern glare" },
  { "id": "goblin_02", "name": "刀疤哥布林", "action": "defend", "target": null, "note": "guarding_chief" },
  { "id": "orc_chief", "name": "獨眼獸人首領", "action": "ability:warcry", "target": null, "note": "buff_allies" }
]
```

**Example output (player interacting with scene notable):**
```json
[
  { "id": "__player__", "name": "玩家", "action": "interact", "target": "火藥桶", "note": "kick toward goblins" },
  { "id": "goblin_01", "name": "肥胖哥布林", "action": "flee", "target": null, "note": "panics at barrel",
    "disadvantage": true, "modifierNote": "panicking" },
  { "id": "orc_chief", "name": "獨眼獸人首領", "action": "attack", "target": "__player__", "note": "intercept" }
]
```

**Example output (social):**
```json
[
  { "id": "__player__", "name": "玩家", "action": "persuade", "target": "merchant_wang", "note": "appeal_to_fairness",
    "advantage": true, "modifierNote": "口若懸河 trait — silver tongue" },
  { "id": "lin_xue", "name": "林雪", "action": "support", "target": "__player__", "note": "vouch_for_player" },
  { "id": "merchant_wang", "name": "王掌櫃", "action": "resist", "target": "__player__", "note": "emotional_pressure" }
]
```

### 4d. EA Prompt Design

EA's system prompt is minimal and generic (~200-250 tokens):

```
You receive a scene directive, participant list, and scene notables.
Translate the directive into one action per participant using ONLY the provided action schema.
Include the player's action based on their input.

Rules:
- Output: JSON array only. No prose. No explanation. No markdown.
- Every participant must have exactly one action.
- Actions must be from the valid action list provided, OR 'interact' for scene notable interactions.
- Target must be a valid participant ID, a scene notable name, or null if untargeted.
- Ally behavior follows the directive — allies are NOT player-controlled.
  Player requests to allies are requests, not commands.
  Compliance depends on affection, personality, and situation.

Advantage/Disadvantage:
- For each participant, judge whether advantage or disadvantage applies.
- Consider: participant traits and how they relate to THIS specific action,
  environmental factors (terrain, weather, lighting, positioning),
  and status effects (fear, injury, morale).
- A trait is only relevant if it meaningfully helps/hinders the specific action
  in the current scene context. Do not grant advantage for irrelevant traits.
- Set advantage/disadvantage booleans. Include modifierNote explaining why.

Interact:
- When a participant attempts something not in the action list (kick a barrel,
  cut a rope, swing from chandelier), use action: 'interact'.
- Target should be the scene notable name from the notables list.
- Client will roll a simple 2d6 test. Main Session narrates the outcome.
```

Module-specific behavioral rules (mob/elite/boss archetypes, social pressure tactics, etc.) are injected as structured data in the user message, not baked into the system prompt.

### 4e. EA Configuration

- **Model slot:** Utility (same as UA)
- **Temperature:** 0.1 (deterministic translation, not creative)
- **Max tokens:** 300 (structured JSON, bounded by participant count)
- **Fires:** Only when `event.active === true && event.phase === 'ongoing'`
- **Latency:** Sequential after UA (~1-2s added on event turns). Acceptable tradeoff for clean flow.

---

## 5. Module Action Schema Registration

### 5a. Schema Definition

Each module that supports events registers an action schema in its manifest:

```typescript
interface EventActionSchema {
  eventType: string;                    // 'combat', 'social', etc.
  validActions: ActionDefinition[];
  diceMappings: Record<string, DiceTriggerMapping>;
}

interface ActionDefinition {
  action: string;                       // 'attack', 'defend', 'flee', 'persuade', etc.
  label: string;                        // locale key for display
  requiresTarget: boolean;
  availableTo?: ('player' | 'ally' | 'enemy')[];  // who can use this action
  rankRestriction?: string[];           // e.g., only elite/boss can use abilities
}

interface DiceTriggerMapping {
  actorRoll?: string;                   // dice trigger for the actor (e.g., 'attack')
  actorEfficacy?: string;              // efficacy trigger (e.g., 'damage')
  targetRoll?: string;                 // dice trigger for the target (e.g., 'defend')
  mobsRoll: boolean;                   // whether mobs roll or are reactive
}
```

### 5b. Combat Module Schema

```typescript
const COMBAT_ACTION_SCHEMA: EventActionSchema = {
  eventType: 'combat',
  validActions: [
    { action: 'attack', label: 'ACTION_ATTACK', requiresTarget: true },
    { action: 'defend', label: 'ACTION_DEFEND', requiresTarget: false },
    { action: 'ability', label: 'ACTION_ABILITY', requiresTarget: false, rankRestriction: ['elite', 'boss'] },
    { action: 'flee', label: 'ACTION_FLEE', requiresTarget: false },
    { action: 'wait', label: 'ACTION_WAIT', requiresTarget: false },
    { action: 'item', label: 'ACTION_ITEM', requiresTarget: false, availableTo: ['player', 'ally'] },
    { action: 'interact', label: 'ACTION_INTERACT', requiresTarget: true },
  ],
  diceMappings: {
    'attack':  { actorRoll: 'attack', actorEfficacy: 'damage', targetRoll: 'defend', mobsRoll: false },
    'defend':  { mobsRoll: false },
    'ability': { actorRoll: 'ability_check', actorEfficacy: 'damage', mobsRoll: false },
    'flee':    { actorRoll: 'ability_check', mobsRoll: false },
    'wait':    { mobsRoll: false },
    'item':    { mobsRoll: false },
    'interact': { actorRoll: 'ability_check', mobsRoll: false },
  },
};
```

### 5c. Client Dice Derivation

With EA's structured actions + module dice mappings, the client deterministically derives all dice triggers. EA's `advantage`/`disadvantage` flags are passed through to the Event Resolver:

```typescript
function deriveDiceTriggers(
  actions: EAParticipantAction[],
  schema: EventActionSchema,
  roster: Record<string, EntityInfo>
): DiceRequest[] {
  const requests: DiceRequest[] = [];
  for (const action of actions) {
    const mapping = schema.diceMappings[action.action];
    if (!mapping) continue;
    const entity = roster[action.id];

    // Mobs don't roll unless schema says so
    if (entity?.rank === 'mob' && !mapping.mobsRoll) continue;

    // Actor roll — with EA-determined advantage/disadvantage
    if (mapping.actorRoll) {
      requests.push({
        entityId: action.id,
        trigger: mapping.actorRoll,
        target: action.target,
        advantage: action.advantage ?? false,
        disadvantage: action.disadvantage ?? false,
        modifierNote: action.modifierNote,
      });
    }
    // Target defend roll
    if (mapping.targetRoll && action.target) {
      requests.push({ entityId: action.target, trigger: mapping.targetRoll });
    }
  }
  return requests;
}
```

No LLM needed. Pure lookup. Advantage/disadvantage flows from EA → dice request → Event Resolver (3d6 keep-high or keep-low).

### 5d. INTERACT Resolution

When `action === 'interact'`, the client handles it as a simple 2d6 test:

1. Roll 2d6 (or 3d6 with advantage/disadvantage from EA flags)
2. Apply standard thresholds: 7 = success, 10 = great success
3. Build a remark for Main Session: `"玩家嘗試與火藥桶互動 → 2d6[4,5]=9 成功"`
4. **No damage calc, no effect resolution on client side**
5. Main Session narrates the outcome based on the roll result + `note` field
6. Narrative consequences (AoE damage from explosion, trap immobilizing enemies, etc.) flow through UA → EA on subsequent turns as roster/HP changes

This keeps INTERACT infinitely flexible. The client just rolls dice. The LLM decides what happens narratively. UA picks up consequences next turn.

### 5e. `collectSceneRollModifiers()` — REMOVED

The previous client-side `collectSceneRollModifiers()` in the orchestrator is **removed entirely**. It performed crude category matching on traits (traits in `體能`/`心智` → advantage during combat) but could not interpret contextual relevance.

EA replaces this with full contextual judgment:
- "原始本能" + dark cave fight → advantage (primal instinct helps in darkness)
- "原始本能" + trade negotiation → no advantage (irrelevant)
- "口若懸河" + persuasion attempt → advantage (silver tongue helps)
- "口若懸河" + sword fight → no advantage (irrelevant)

All advantage/disadvantage sources (traits, terrain, weather, positioning, status effects, combat flags like "surrounded") are unified under EA's per-participant judgment.

---

## 6. Single Event Type Rule

### 6a. Core Rule

**One event type active per turn. No stacking.**

UA determines the active event type. If UA says `type: 'combat'`, everything this turn resolves as combat. If UA says `type: 'social'`, everything resolves as social.

### 6b. Player Input Conflict Resolution

When a player's input implies a different event type than the currently active one:

**Case 1: Pure type switch**
> Player during combat: `DO: 我放下武器，試圖說服獸人首領停戰`

UA recognizes the intent to switch. UA emits `event.type: 'social'` for this turn. Combat pauses (roster preserved but dormant). All participants resolve as social. If negotiation fails, UA can switch back to `combat` next turn with the preserved roster.

**Case 2: Mixed actions (two event types in one input)**
> Player during combat: `SPEAK: 我們不必打的 DO: 一邊說一邊偷偷摸向哥布林背後準備暗殺`

UA picks the **type-switching action** as this turn's event type (social). The conflicting action (sneak attack) becomes a **deferred hook**:

```typescript
interface DeferredAction {
  source: string;             // entity ID
  rawInput: string;           // the deferred part of player input
  suggestedType: string;      // what event type it implies
  turn: number;               // when it was deferred
}
```

Client stores the deferred hook. Next turn, UA sees it in context and factors it into direction — the sneak attack may trigger combat resuming, or NPCs may have noticed the movement.

**Case 3: No conflict**
> Player during combat: `DO: 我揮劍砍向哥布林`

Normal. UA keeps `type: 'combat'`, EA maps the action.

### 6c. PLOT Override

`PLOT` input is **god's directive**. It bypasses all event type constraints.

When player uses PLOT:
1. UA maps the PLOT content directly to narrative direction + numeric consequences
2. No EA call — UA's output is the final word
3. Client applies consequences (HP changes, roster removals, event end, etc.)
4. Main Session narrates the PLOT outcome

```json
// Player: PLOT: 天花板突然崩塌，把獸人首領壓在瓦礫下，戰鬥結束
// UA eval:
{
  "event": {
    "active": false,
    "phase": "end",
    "type": "combat",
    "endReason": "plot_override",
    "plotConsequences": {
      "rosterRemove": ["orc_chief"],
      "damage": [{ "target": "orc_chief", "amount": 999, "cause": "ceiling_collapse" }]
    }
  }
}
```

---

## 7. Ally Behavior

### 7a. UA Directs, EA Maps

Vital NPCs (allies) are participants in EA's output, same as enemies and player. **UA decides ally behavior** based on personality, affection, narrative context, and scene direction. EA translates that decision into a structured action.

### 7b. Player Requests to Allies

Player can request ally actions via SPEAK:
> `SPEAK: 林雪，幫我治療！`

This is interpreted as a **request, not a command**. Whether the ally complies depends on:

| Factor | Effect |
|--------|--------|
| High affection (信任/摯愛/獻身) | Likely to comply |
| Low affection (警戒/中立) | May ignore or act independently |
| Ally personality traits | Stubborn allies resist; loyal allies follow |
| Tactical situation | Pinned down ally can't reach player to heal |
| UA's scene direction | UA has final say on ally behavior |

EA receives the ally's compliance/non-compliance as part of UA's direction and maps accordingly.

### 7c. Ally Combat Autonomy

When the player does NOT request specific ally actions, allies act autonomously per UA's direction. Typical patterns:
- Healer allies prioritize injured teammates
- Tank allies intercept attacks on squishier members
- Ranged allies target the most dangerous enemy
- Low-morale allies may flee or freeze

These patterns emerge from UA's narrative direction, not hardcoded AI. EA just translates.

---

## 8. Player Knockout Failsafe

### 8a. Rule (Unchanged from Combat System Design)

**No game-over state.** When the player's HP reaches 0:
1. Combat ends immediately
2. Main Session narrates a rescue/recovery scene
3. Significant consequences applied (1-2, scaled to fight importance)
4. Player resumes at 1 HP

### 8b. Failsafe in EA Architecture

Player knockout is detected by the **client** (not UA or EA) after applying Event Resolver effects:

```
EA actions → Client resolves dice → Apply damage → Player HP ≤ 0 detected
  → Client forces event.phase = 'end', endReason = 'player_knockout'
  → Client requests UA for failsafe consequences (one-shot call)
  → UA returns: rescue location, consequences, narrative hint
  → Main Session narrates rescue
```

The failsafe consequence call is a **special UA invocation** (not EA), since it requires narrative judgment about appropriate consequences.

---

## 9. Prompt Architecture Changes

### Block 3 (Dynamic, Per-Turn) — During Active Events

Previous: Combat Agent output + Dice Agent triggers + raw combat state
New: EA resolution block only

```
[事件結果]
事件類型：戰鬥
參與者行動：
- 玩家 → 攻擊 肥胖哥布林 | 2d6[4,5]=9 成功 | 效力d6=4 → 傷害4
- 林雪 → 治療 玩家 | 2d6[3,6]=9 成功 | 恢復3HP
- 肥胖哥布林 → 被動反應 | 受到4傷害 (8/12 HP)
- 獨眼獸人首領 → 戰吼 | 全場增益
擊敗：無
戰鬥旗標：boss_fight
```

Main Session reads this and narrates. Same narrative quality, cleaner data source.

### Combat Agent Prompt → EA Prompt

Previous: ~200 tokens, combat-specific behavioral archetypes
New: ~150-200 tokens, generic translation instructions (Section 4d)

Module-specific rules injected as structured data in user message, not system prompt.

---

## 10. Deferred Action System

### 10a. Storage

```typescript
interface DeferredAction {
  source: string;             // entity ID ('__player__')
  rawInput: string;           // the deferred part of player input
  suggestedType: string;      // implied event type
  turn: number;               // when deferred
  consumed: boolean;          // whether UA has processed it
}
```

Stored in orchestrator turn state (not persisted to DB — ephemeral within session).

### 10b. Lifecycle

1. Client detects mixed-type input → stores `DeferredAction`
2. Next turn: deferred action injected into UA context as `[DEFERRED: {rawInput}]`
3. UA factors it into scene direction (may trigger event type switch, may cause NPC reaction)
4. Once UA processes it, mark `consumed: true`
5. If not consumed within 2 turns, discard (player moved on)

### 10c. Detection

Mixed-type detection is done by the **client input router** before UA eval:
- Parse player input into SPEAK/DO/PLOT/RECALL segments
- If current event type is X, and a segment implies type Y → flag as deferred
- Type implication heuristics: combat keywords (攻擊/砍/射) vs social keywords (說服/談判/威脅) vs movement keywords (逃/跑/躲)
- If ambiguous, let UA decide (don't defer — send everything to UA)

---

## 11. Integration with Existing Systems

### 11a. Hype Interaction (Unchanged)

Hype effects are evaluated by UA as before. Combat outcomes feed hype:
- Enemy defeated → 輕微正面 (global)
- Flawless victory → 強烈正面 (global)
- Retreat/defeat → UA evaluates narratively

### 11b. Critical Events (Unchanged)

Combat-specific critical events still trigger per `combat_system_design.md` Section 8. Detection moves from Combat Agent to client (based on Event Resolver output + roster state).

### 11c. XP (Unchanged)

+1 XP per enemy defeated. Client tallies from Event Resolver's `defeatedIds[]`.

### 11d. Module Hooks

Existing hooks continue to work:
- `getIntensity()` — reads event state instead of combat-specific state
- `getDynamicPrompt()` — injects narrative cues based on event type + intensity
- `onTurnEnd()` — tick cooldowns, tally XP, update module state
- `isRollWorthy()` — replaced by event system (if event active → dice derived from actions)

### 11e. Combat HUD

Renders when `event.type === 'combat'` and `event.active === true`. Reads roster from module state. Unchanged rendering logic.

---

## 12. Token & Latency Impact

### vs. Previous Architecture (4 parallel LLM calls)

| Metric | Before (CA+DA parallel) | After (UA→EA sequential) |
|--------|------------------------|-------------------------|
| LLM calls per event turn | 4 (UA + DA + CA + Main) | 3 (UA + EA + Main) |
| LLM calls per normal turn | 2-3 (UA + DA? + Main) | 2 (UA + Main) |
| Total latency (event turn) | UA‖DA‖CA parallel + Main | UA + EA sequential + Main |
| Net latency change | — | +1-2s on event turns (EA waits for UA) |
| Token cost per event turn | UA ~600 + DA ~400 + CA ~400 | UA ~700 + EA ~300 |
| Pipeline complexity | Parallel coordination + race conditions | Simple sequential |

**Tradeoff:** Slightly higher latency on event turns, but simpler flow, fewer bugs, fewer total tokens.

---

## 13. File Structure Changes

### New Files
```
src/agents/event-agent.ts              # EA: translate directive → actions
src/modules/event-schemas.ts           # Module action schema registry
```

### Modified Files
```
src/agents/utility-agent.ts            # Add event directive to UA eval
src/state/types.ts                     # UAEventDirective, EAParticipantAction types
src/orchestrator/orchestrator.ts       # Replace combat branch with generic event branch
src/modules/types.ts                   # EventActionSchema in manifest type
modules/combat/manifest.json           # Add eventSchema section
```

### Files to Remove (After Migration)
```
src/agents/combat-agent.ts             # Replaced by EA
src/agents/dice-agent.ts               # Replaced by client dice derivation
```

### Files Unchanged
```
src/modules/event-resolver.ts          # Client-side 2d6 mechanics (unchanged)
src/modules/dice-engine.ts             # Pure dice functions (unchanged)
src/ui/combat-hud.ts                   # Renders from roster (unchanged)
src/modules/builtins/combat-hooks.ts   # Hook implementations (minor updates)
```

---

## 14. Resolved Decisions

1. **UA is the sole gatekeeper.** Only UA determines if an event is active and what type it is. Client does not activate events.
2. **One event type per turn.** No stacking. Mixed player intent → resolve primary type, defer the rest.
3. **PLOT overrides everything.** God directive. UA maps to consequences. No EA call.
4. **EA is a translator, not a strategist.** Minimal prompt, regulated output. Module schemas define valid actions.
5. **Player is a participant.** EA maps player input alongside NPCs. Client resolves uniformly.
6. **Allies are UA-directed.** Player requests to allies are requests, not commands. Compliance depends on affection, personality, situation.
7. **Dice Agent eliminated.** Client derives dice triggers from EA action types + module schema lookup table. Deterministic, no LLM needed.
8. **Combat Agent eliminated.** Strategy moved to UA (direction). Translation moved to EA (actions). Mechanics stay in client.
9. **`event_init` is universal.** Not combat-specific. Any module can define spawns/setup in init phase.
10. **Init and ongoing are separate turns.** No EA call on init turn. Eliminates spawn/validate race condition.
11. **EA outputs both ID and display name.** Single source of truth for both narrative and combat report UI.
12. **Sequential flow is acceptable.** UA → EA adds ~1-2s latency on event turns. Clean flow is worth the tradeoff.
13. **Deferred actions expire in 2 turns.** If UA doesn't consume them, they're discarded.
14. **Client-side knockout detection.** Player HP ≤ 0 forces event end. Failsafe consequences come from a special UA call, not EA.
15. **Module action schemas registered in manifest.** Each module defines valid actions + dice mappings. EA adapts to active schema.
16. **EA handles ALL advantage/disadvantage.** Replaces `collectSceneRollModifiers()`. EA judges contextual relevance of traits, terrain, weather, positioning, and status effects per participant per action. Client just reads boolean flags.
17. **Scene notables are UA-authored.** UA lists 0-5 notable/interactable elements as plain text in `event.notables`. Represents things participants can interact with: explosive barrels, hanging lanterns, rope traps, etc.
18. **INTERACT is the catch-all action.** Any action outside the module's standard schema uses `action: 'interact'`. Client rolls simple 2d6 test with EA's adv/dis flags. Main Session narrates the outcome. Consequences flow through UA next turn.
19. **No client-side trait interpretation.** Client never parses trait names or guesses relevance. EA receives traits as input and makes the contextual judgment.

---

## 15. Open Questions

None. All design decisions resolved.
