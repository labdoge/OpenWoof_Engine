# Dice System Design Memo

**Date:** 2026-03-17
**Status:** Implemented in `src/modules/dice-engine.ts`, `src/modules/dice-resolver.ts`, `src/modules/dice-formatter.ts`.
**Purpose:** Extend the existing dice engine into a full roll-resolution pipeline for combat and adventure modules.
**Note:** Dice Agent (Sec 4) has been absorbed into the Event Agent system. Client-side dice resolution (Sec 2-3, 5-7) is the active implementation.

---

## 1. Design Principles

1. **No animations.** Dice results are text-only, injected into narrative output in a standard bracketed format.
2. **Dice Agent decides, client resolves, LLM narrates.** A dedicated Dice Agent (conditional, parallel with UA) determines *whether* a roll is needed and names the trigger. The client dice engine handles all mechanical resolution (lore scanning, advantage, modifiers, rolling). The main LLM composes the narrative around the outcome.
3. **Player and vital NPCs roll open, environment is reactive.** Player and vital (in-scene, named) NPCs both roll openly with bracketed results. Hidden rolls are reserved for special module use (e.g., a Challenge Module rolling to determine scene fortune). Minor NPCs, mobs, and environmental hazards do NOT roll — they react to player/vital NPC results. Module `successEffects` tables define how the environment responds to each success level.
4. **Unified test resolution.** All test checks use the same mechanic (2d6) with app-level success thresholds. Modules customize *interpretation* (what success/failure means), not *mechanics* (how dice are rolled).
5. **Module-owned efficacy.** Efficacy dice (damage, healing, etc.) are module/lore-defined and can vary freely — they're not tests, just magnitude.

---

## 2. Roll Taxonomy

### 2a. Who Rolls

| Actor | Rolls? | Visibility | Examples |
|-------|--------|------------|----------|
| **Player** | Yes | `open` — bracketed in narrative | Attack, stealth, persuade |
| **Vital NPC** | Yes | `open` — bracketed in narrative | Named ally's attack, rival's dodge |
| **Environment** | **No** | N/A — purely reactive | Mobs, hazards, weather, traps |
| **Module (special)** | Rare | `hidden` — directive only | Challenge module fortune roll |

- **Open rolls** (player + vital NPCs) produce the standard bracketed format (see Section 3) and are included in the main LLM's Block 3 injection so it can narrate the outcome. The player sees all actor rolls.
- **Hidden rolls** are reserved for special module purposes — e.g., a Challenge Module rolling to determine whether good or bad fortune befalls the scene. The result is injected into Block 3 as a narrative directive (e.g., `[HIDDEN: Scene fortune — fail, unfavorable twist]`). The player never sees the roll math or even that a roll occurred.
- **Environment** does not roll. Its behavior is determined by the player's and vital NPCs' roll results, interpreted through the active module's `successEffects` table. For example, if the player rolls great success on an attack against 3 goblins, the combat module's effect table might say "devastating blow — enemies scattered, morale broken."

**Why no environment rolls:** Eliminates result-conflict resolution (what happens when player succeeds but enemies also succeed?). The narrative always flows outward from actor results. This keeps the system simple and the per-turn roll count bounded.

### 2b. Purpose: Test Check vs Efficacy

| Purpose | What it determines | Has success level? | Output |
|---------|-------------------|--------------------|--------|
| `test` | Pass/fail + success level | Yes (fail / success / great success) | Success level |
| `efficacy` | Numeric effect magnitude | No | Number (total) |

- **Test check**: Roll 2d6 against fixed thresholds (7/10). Produces a `SuccessLevel`. No per-test DC — difficulty is advantage/disadvantage only.
- **Efficacy**: Roll for magnitude (damage, healing, resource gain). Uses module/lore-defined dice. Highest-wins modifier from items/lore.
- **Flat efficacy**: When an item/ability has a fixed effect (e.g., "always deals 2 damage"), no dice are rolled. The flat value is used directly.

---

## 3. Standard Bracketed Format

All open roll results use this system-level format. **Not customizable by modules.**

### Test Check Format
```
（{reason}：2d6 = {total}，{success_level_label}）
（{reason}[有利]：3d6→[{all_dice}]取最佳二 = {total}，{success_level_label}）
（{reason}[不利]：3d6→[{all_dice}]取最低二 = {total}，{success_level_label}）
```

Examples:
- `（力量檢定：2d6 = 10，大成功！）`
- `（潛行檢定[不利]：3d6→[4,3,6]取最低二 = 7，成功）`
- `（說服檢定[有利]：3d6→[5,3,2]取最佳二 = 8，成功）`

### Efficacy Format
```
（{reason}：{dice_expression} = {total}）
```

Examples:
- `（劍擊傷害：2d6+2 = 11）`
- `（治癒：1d8+1 = 6）`

### Flat Efficacy Format
```
（{reason}：{value}）
```

Examples:
- `（毒素傷害：3）`
- `（護盾吸收：5）`

### Test Resolution (App-Level, Unified)

All test checks use **2d6** (no numeric modifiers) with fixed thresholds:

| Level | Label | Condition |
|-------|-------|-----------|
| `great_success` | `大成功！` | Total ≥ 10 |
| `success` | `成功` | Total ≥ 7 |
| `fail` | `失敗` | Total < 7 |

No DC per test — the thresholds are universal. No numeric modifiers on tests. Difficulty is expressed **solely through advantage/disadvantage** (see below). This keeps the player's mental model maximally simple: "7+ good, 10+ great, advantage helps, disadvantage hurts."

### Advantage / Disadvantage

Adapted for 2d6: roll **3d6**, keep 2.

| Condition | Dice | Keep | Effect |
|-----------|------|------|--------|
| Normal | 2d6 | all | Standard roll |
| Advantage (有利) | 3d6 | **best 2** | Shifts curve upward |
| Disadvantage (不利) | 3d6 | **worst 2** | Shifts curve downward |

**Cancellation rule:** Binary. Any number of advantage sources + any number of disadvantage sources = they cancel, roll normal 2d6. No stacking — you never roll 4d6.

**Sources of advantage/disadvantage:**
- Traits (buff/debuff)
- Items (equipped gear with advantage on specific triggers)
- Narrative effects (UA assigns based on context — e.g., high ground, fear, surprise)
- Module state (e.g., a combat module might grant advantage on flanking)

**Bracketed format with advantage/disadvantage:**
```
（力量檢定[有利]：3d6→[5,3,2]取最佳二 = 10，大成功！）
（潛行檢定[不利]：3d6→[4,3,6]取最低二 = 9，成功）
```

### Efficacy Success Level Labels (zh-TW)
| Level | Label |
|-------|-------|
| `great_success` | `大成功！` |
| `success` | `成功` |
| `fail` | `失敗` |

These labels are app-level constants. Modules define what each level *means* in their domain via `successEffects`.

---

## 4. Roll Flow (Per Turn)

### Architecture: Dice Agent + Client Resolution

The roll pipeline splits responsibility between an LLM agent (narrative judgment) and the client (mechanical resolution):

```
Player input
    ↓ (parallel calls)
┌──────────────┐  ┌──────────────────────┐
│ UA Eval      │  │ Dice Agent           │
│ (hype/lust/  │  │ (CONDITIONAL —       │
│  status/etc) │  │  only fires if any   │
│              │  │  module has diceRolls │
│              │  │  in manifest)        │
│              │  │                      │
│              │  │ Input:               │
│              │  │  - player action     │
│              │  │  - scene context     │
│              │  │  - active trigger    │
│              │  │    tag list (from    │
│              │  │    lore mechanics)   │
│              │  │  - vital NPC roster  │
│              │  │                      │
│              │  │ Output:              │
│              │  │  - trigger decisions │
│              │  │    (actor + trigger  │
│              │  │     tag + reason)    │
└──────┬───────┘  └──────┬───────────────┘
       ↓                 ↓
       merge results
       ↓
┌──────────────────────────────────────┐
│ Client Dice Resolution (zero LLM)   │
│                                      │
│ For each trigger from Dice Agent:    │
│ 1. Scan active lore for diceRequest  │
│    matching the trigger              │
│ 2. Scan diceAdvantage (incl "*")     │
│    → resolve binary cancel           │
│ 3. Scan diceModifier for efficacy    │
│    → resolve highest-wins            │
│ 4. Build RollRequest                 │
│ 5. Process followUp chains           │
│ 6. Roll dice, compute results        │
│ 7. Format bracketed display text     │
│ 8. Compose narrative directives      │
└──────────────────────────────────────┘
       ↓
    Build Block 3 with roll results
       ↓
    Main LLM call (narrative)
       ↓
    Player sees narrative with inline roll results
```

### Dice Agent Responsibility Split

| Responsibility | Owner | LLM cost |
|---------------|-------|----------|
| "Does this action need a roll?" | **Dice Agent** | ~300-500 input, ~50-100 output |
| "Which trigger tag applies?" | **Dice Agent** | (same call) |
| "Which actor is rolling?" | **Dice Agent** | (same call) |
| Scan lore for matching dice definitions | **Client** | 0 |
| Resolve advantage/disadvantage from lore | **Client** | 0 |
| Resolve efficacy modifiers (highest-wins) | **Client** | 0 |
| Build RollRequest + followUp chains | **Client** | 0 |
| Roll dice, compute results | **Client** | 0 |
| Format bracketed text | **Client** | 0 |
| Compose narrative directives | **Client** | 0 |

### Dice Agent Activation

The Dice Agent is **conditional** — it only fires when at least one active module has `diceRolls` defined in its manifest. No dice modules → no Dice Agent call → zero cost.

| Session state | Dice Agent fires? |
|--------------|-------------------|
| Erotic module only | No |
| Combat module active | Yes |
| Adventure module active | Yes |
| No modules | No |

### Dice Agent Model Slot

Uses the **Utility model slot** (same model as UA). Runs in **parallel** with UA eval — no added latency.

### Dice Agent Output Format

```json
{
  "rolls": [
    { "actor": "player", "trigger": "attack", "reason": "力量檢定" },
    { "actor": "林雪", "trigger": "stealth", "reason": "潛行檢定" }
  ],
  "hidden": [
    { "trigger": "fortune", "reason": "場景命運" }
  ]
}
```

The agent names actors, triggers, and display reasons. **All mechanical resolution happens client-side.** The Dice Agent never specifies die types, modifiers, advantage, or thresholds.

### Roll Cap

Hard cap based on output length setting:
- **Standard output**: max 5 tests per turn
- **Detailed output**: max 7-8 tests per turn

Efficacy rolls chained via `followUp` do not count against the cap (they're automatic consequences of tests).

### Block 3 Injection Format

```
[骰子結果]
- （力量檢定[有利]：3d6→[6,4,2]取最佳二 = 10，大成功！）→ 玩家的攻擊命中，請描述強力命中的效果
- （劍擊傷害：1d8+2 = 9）→ 造成9點傷害
- （林雪 潛行檢定：2d6 = 9，成功）→ 林雪成功潛入，未被發現
```

The main LLM embeds open roll brackets directly in its output text. Hidden roll directives guide the narrative without exposing the math.

---

## 5. Type Definitions (Changes)

### New Types

```typescript
/** Three-tier success system for narrative games. */
type SuccessLevel = 'fail' | 'success' | 'great_success';

/** Who sees the roll result. */
type RollVisibility = 'open' | 'hidden';

/** What the roll determines. */
type RollPurpose = 'test' | 'efficacy';
```

### TestRollRequest (App-Level)

```typescript
/** Test checks are always 2d6 (or 3d6 with adv/disadv). No numeric modifiers. */
interface TestRollRequest {
  purpose: 'test';
  visibility: RollVisibility;
  reason: string;              // zh-TW label for bracketed format
  advantage?: boolean;         // any source grants advantage
  disadvantage?: boolean;      // any source grants disadvantage
  // Die type (2d6), thresholds (7/10), and keep rules are engine constants.
  // No modifiers field — difficulty is expressed ONLY via advantage/disadvantage.
}
```

### EfficacyRollRequest (Module/Lore-Defined)

```typescript
/**
 * How to derive efficacy from a parent test roll (instead of rolling separately).
 * - 'highest': higher of the 2 kept dice (range 1–6)
 * - 'lowest': lower of the 2 kept dice (range 1–6)
 * - 'margin': total minus success threshold (7), clamped to 0 (range 0–5)
 * - 'total': the full 2d6 sum (range 2–12)
 * - 'roll': standard separate roll (default)
 */
type EfficacyDerivation = 'highest' | 'lowest' | 'margin' | 'total' | 'roll';

/** Efficacy rolls use module/lore-defined dice. Freely variable. */
interface EfficacyRollRequest {
  purpose: 'efficacy';
  visibility: RollVisibility;
  reason: string;
  die: DieType;
  count?: number;              // default 1
  flatValue?: number;          // flat efficacy (no dice)
  derivation?: EfficacyDerivation; // derive from parent test result
  modifiers?: RollModifier[];
}
```

When `derivation` is set on a followUp, the system skips rolling separate dice and extracts the value from the parent test result. This is configured per lore entry `diceRequest`.


### Unified RollRequest (Discriminated Union)

```typescript
type RollRequest = TestRollRequest | EfficacyRollRequest;
```

### TestResult

```typescript
interface TestResult {
  purpose: 'test';
  visibility: RollVisibility;
  allRolls: number[];          // 2 dice normally, 3 with adv/disadv
  keptRolls: number[];         // always 2 (best 2 or worst 2)
  total: number;               // sum of keptRolls (no modifiers)
  successLevel: SuccessLevel;  // determined by fixed thresholds (7/10)
  hadAdvantage: boolean;
  hadDisadvantage: boolean;
}
```

### EfficacyResult

```typescript
interface EfficacyResult {
  purpose: 'efficacy';
  visibility: RollVisibility;
  rolls: number[];
  modifier: number;
  modifierSources: RollModifier[];
  total: number;               // sum of rolls + modifier
}
```

### Unified DiceResult (Discriminated Union)

```typescript
type DiceResult = TestResult | EfficacyResult;
```
```

### Efficacy Modifier Resolution (Highest-Wins)

```typescript
interface RollModifier {
  source: string;    // loreId, traitId, or freeform label
  label: string;     // display name: "寒霜古劍", "力量加成"
  bonus: number;     // +/- value
}
```

Efficacy modifiers do **NOT** stack. When multiple sources provide bonuses for the same trigger, **only the highest bonus applies**. Similarly, when multiple sources provide penalties, **only the largest penalty applies**. If both bonuses and penalties exist, the single highest bonus and single largest penalty are each selected, then summed.

**Examples:**
- Sword +2, ring +1 → only +2 applies (highest bonus wins)
- Sword +2, curse -1 → +2 and -1 both apply → net +1 (one bonus + one penalty)
- Sword +2, ring +1, curse -3, poison -1 → +2 (highest bonus) + -3 (largest penalty) → net -1

**Why highest-wins:** Prevents modifier inflation from stacking many small bonuses. Items feel distinct — a +3 sword is meaningfully better than a +2 sword, not just "+1 more on top of everything else." Keeps numbers small and predictable in a narrative game.

### Flat Efficacy

```typescript
interface FlatEfficacy {
  purpose: 'efficacy';
  visibility: RollVisibility;
  reason: string;
  flatValue: number;          // no dice, just this number
  modifiers?: RollModifier[]; // can still have modifiers that add to flatValue
}
```

When a lore entry has `flatDamage: 2` instead of a die, the system skips the dice engine and produces a `FlatEfficacyResult` directly.

### Updated RollResolution

```typescript
interface RollResolution {
  /** Bracketed text for open rolls, directive for hidden rolls. */
  promptInjection: string;
  /** Formatted bracketed text shown to player (empty for hidden rolls). */
  displayText: string;
  /** Narrative instruction for main LLM. */
  narrativeDirective: string;
  /** Optional state mutations. */
  stateUpdates?: Record<string, unknown>;
}
```

---

## 6. Lore-Triggered Rolls

Lore entries (items, abilities, locations, traits) can define dice that trigger contextually.

### New Field on LoreMechanics

```typescript
interface LoreMechanics {
  // ... existing fields ...

  // ---- Passive: advantage/disadvantage source ----
  diceAdvantage?: {
    trigger: string;       // 'attack', 'persuade', 'stealth'
    type: 'advantage' | 'disadvantage';
  }[];

  // ---- Passive: efficacy modifier (numeric, efficacy rolls only) ----
  diceModifier?: {
    trigger: string;       // 'damage', 'healing'
    bonus: number;         // +/- to efficacy total
  }[];

  // ---- Active: roll definition ----
  diceRequest?: {
    trigger: string;       // 'damage', 'fear_check', 'poison_tick'
    purpose: RollPurpose;
    die?: DieType;         // efficacy only; if omitted, use module default
    count?: number;        // efficacy only
    flatValue?: number;    // alternative to die — flat efficacy
    derivation?: EfficacyDerivation; // derive from test result instead of rolling
    reason?: string;       // override for bracketed format label
  }[];
}
```

### Examples

**Sword with damage die + efficacy modifier:**
```json
{
  "content": "一把散發寒氣的古劍，劍身上刻有符文。",
  "mechanics": {
    "equippable": true,
    "slot": "weapon",
    "diceModifier": [{ "trigger": "damage", "bonus": 2 }],
    "diceRequest": [{ "trigger": "damage", "purpose": "efficacy", "die": "d8", "count": 1 }]
  }
}
```
Note: `diceModifier` adds +2 to the efficacy (damage) roll, NOT to the test. Test difficulty is controlled only by advantage/disadvantage.

**Fist weapon with derived efficacy (highest die = damage):**
```json
{
  "content": "鐵拳護手，以打擊力道決定傷害。",
  "mechanics": {
    "equippable": true,
    "slot": "weapon",
    "diceRequest": [{ "trigger": "damage", "purpose": "efficacy", "derivation": "highest", "reason": "拳擊傷害" }]
  }
}
```
Note: With `derivation: "highest"`, the efficacy is the higher of the two kept test dice — no separate roll. A test of `[5,3]` produces efficacy `5`. Output: `（拳擊傷害[取最高骰]：5）`

**Dagger with flat damage:**
```json
{
  "mechanics": {
    "equippable": true,
    "slot": "weapon",
    "diceRequest": [{ "trigger": "damage", "purpose": "efficacy", "flatValue": 2 }]
  }
}
```

**Haunted location with fear check (disadvantage):**
```json
{
  "mechanics": {
    "diceAdvantage": [{ "trigger": "fear_check", "type": "disadvantage" }],
    "diceRequest": [{ "trigger": "fear_check", "purpose": "test", "reason": "恐懼抵抗" }]
  }
}
```

Test-purpose lore entries trigger a standard 2d6 test. Difficulty is expressed via `diceAdvantage` entries — here the haunted location imposes disadvantage on fear checks.

**Blessed amulet (advantage on all tests):**
```json
{
  "mechanics": {
    "diceAdvantage": [{ "trigger": "*", "type": "advantage" }]
  }
}
```

Wildcard trigger `"*"` applies to all test checks while the item is active/equipped.

### Trigger Resolution (Client-Side)

1. **Dice Agent** returns trigger decisions: `{ actor: "player", trigger: "attack", reason: "力量檢定" }`.
2. **Client** scans active lore entries for `diceRequest[].trigger` matching `"attack"`.
3. **Client** scans `diceAdvantage[].trigger` matches (including `"*"` wildcards) from all active lore. Resolves to advantage, disadvantage, or normal (binary cancel).
4. **Client** builds `TestRollRequest` — no modifiers, only adv/disadv flag.
5. **Client** checks for `followUp` chains: does the matching lore entry also have a `damage` trigger? If so, queue efficacy roll on success.
6. **Client** scans `diceModifier[].trigger` for efficacy rolls → resolve highest-wins.
7. **Client** rolls dice, formats results. Module `resolveRoll` hook produces narrative directives.

---

## 7. Module Dice Configuration (Expanded ManifestDiceConfig)

```typescript
interface ManifestDiceConfig {
  /** Instructions injected into Dice Agent prompt when module is active. */
  diceAgentInstruction: string;

  // ---- Test checks: modules DON'T configure the mechanic (always 2d6, thresholds 7/10). ----
  // ---- Modules only configure what success levels MEAN in their domain. ----

  /**
   * Effect table: what happens at each success level for this module's domain.
   * Injected into UA instructions so it can compose narrative directives.
   */
  successEffects: {
    great_success: string;  // e.g., "Critical hit — double damage, enemy staggers"
    success: string;        // e.g., "Normal hit — standard damage applies"
    fail: string;           // e.g., "Miss — enemy may counter-attack"
  };

  // ---- Efficacy: modules configure their own dice/flat values. ----

  /** Whether this module uses rolled efficacy, flat efficacy, or both. */
  efficacyMode: 'rolled' | 'flat' | 'both';

  /** Default die for efficacy rolls if lore entry doesn't specify. */
  defaultEfficacyDie?: DieType;

  /** Default flat efficacy value when mode is 'flat' and lore doesn't specify. */
  defaultFlatEfficacy?: number;

  /** Module-defined triggers this module recognizes. */
  recognizedTriggers: string[];
}
```

### Module Hook Expansion

```typescript
interface ModuleHooks {
  // ... existing hooks ...

  /**
   * SINGLE — called before client builds RollRequest.
   * Module can inject advantage/disadvantage or efficacy modifiers based on game state.
   * E.g., combat module grants advantage on flanking, applies armor DR to efficacy.
   */
  modifyRollRequest?: (
    request: RollRequest,
    context: RollContext,
    moduleState: Record<string, unknown>,
  ) => RollRequest;

  /**
   * SINGLE — called after dice engine produces result.
   * Module interprets the result and produces narrative + state changes.
   * Existing hook, but now receives expanded DiceResult with successLevel.
   */
  resolveRoll?: (
    diceResult: DiceResult,
    rollRequest: RollRequest,
    moduleState: Record<string, unknown>,
  ) => RollResolution;
}

/** Context passed to modifyRollRequest. */
interface RollContext {
  activeLore: LoreEntry[];       // all active lore entries
  playerState: PlayerState;       // player's current state
  sceneContext: SceneContext;      // current scene
  triggerSource: string;          // which lore entry initiated the roll
}
```

---

## 8. Formatter (System-Level)

A pure function that produces the bracketed display text. Lives in the dice engine, not in modules.

```typescript
function formatRollDisplay(result: DiceResult, request: RollRequest): string;
function formatFlatDisplay(flat: FlatEfficacyResult): string;
```

Output examples:
- Test (normal): `（力量檢定：2d6 = 9，成功）`
- Test (advantage): `（力量檢定[有利]：3d6→[5,3,2]取最佳二 = 8，成功）`
- Test (disadvantage): `（潛行檢定[不利]：3d6→[4,3,6]取最低二 = 7，成功）`
- Efficacy (rolled): `（劍擊傷害：1d8+2 = 9）`
- Efficacy (flat): `（毒素傷害：3）`

Note: Test format never shows `+N` — tests have no numeric modifiers. Efficacy format can show `+N` from lore/item bonuses.

The formatter is the **single source of truth** for how rolls appear in text. Modules cannot override this format.

---

## 9. Interaction with Existing Systems

### Context Manager (Block 3)
- New `[骰子結果]` section in Block 3, between status and scene context.
- Open rolls: bracketed format + narrative directive.
- Hidden rolls: directive only.
- Only present when rolls occurred this turn. Zero tokens when no rolls.

### Dice Agent (New, Conditional)
- Separate agent from UA. Uses Utility model slot, runs in **parallel** with UA eval.
- Only fires when any active module has `diceRolls` in manifest. Zero cost otherwise.
- Prompt includes: `ManifestDiceConfig.diceAgentInstruction` from active modules, active trigger tag list (extracted from lore mechanics), vital NPC roster, scene context.
- UA eval is **unchanged** — no dice-related fields added to UA.

### Dice Agent Output
```json
{
  "rolls": [
    { "actor": "player", "trigger": "attack", "reason": "力量檢定" },
    { "actor": "林雪", "trigger": "stealth", "reason": "潛行檢定" }
  ],
  "hidden": [
    { "trigger": "fortune", "reason": "場景命運" }
  ]
}
```

The Dice Agent only names actors, triggers, and display reasons. It does NOT specify die types, modifiers, advantage/disadvantage, thresholds, or followUp chains — all mechanical resolution is client-side.

### Orchestrator Pipeline
Insert dice resolution between parallel agent calls and main LLM call:

```
Step N:   UA eval + Dice Agent (parallel)
Step N+1: Client dice resolution (lore scan → advantage → modifiers → roll → format)
Step N+2: Build Block 3 with roll results + UA eval results
Step N+3: Main LLM call (sees roll results in Block 3)
```

---

## 10. Token Impact

| Area | Delta | Notes |
|------|-------|-------|
| Dice Agent input | +300-500 fixed | Only when dice modules active |
| Dice Agent output | +50-100/turn | Trigger decisions only |
| Block 3 dice section | +30-80/turn | Only when rolls occur |
| UA eval | **+0** | UA is unchanged — no dice fields |
| Client dice resolution | 0 | Client-side only |
| Formatter | 0 | Client-side only |

---

## 11. Resolved Decisions

1. **Test mechanic**: Unified 2d6, thresholds 7 (success) / 10 (great success). App-level, not module-customizable.
2. **Advantage/disadvantage**: 3d6 keep best/worst 2. Binary cancel, no stacking. **Test-only** — does not apply to efficacy rolls.
3. **No numeric modifiers on tests.** Difficulty is expressed solely through advantage/disadvantage. Lore entries and Dice Agent can only grant adv/disadv, not +/-N.
4. **Efficacy modifiers: highest-wins, not stacking.** Multiple bonuses → only highest applies. Multiple penalties → only largest applies. One bonus + one penalty selected, then summed.
5. **Success levels**: Three tiers only — fail / success / great success. App-level labels.
6. **Efficacy**: Module/lore-owned. Die type, count, and flat values are freely defined per item/ability.
7. **Chained rolls**: `followUp` pattern — client-side, based on lore entry trigger definitions. Automatic efficacy after successful test.
8. **Roll scope**: Player and vital NPCs both roll **open** (bracketed, visible to player). Hidden rolls are reserved for special module purposes (e.g., fortune/challenge rolls). Environment is purely reactive (no rolls).
9. **Efficacy affected by test result level**, not by advantage/disadvantage. Modules define what great success means for efficacy in their `successEffects` table (e.g., "double damage on great success").
10. **Dedicated Dice Agent**: Separate from UA. Conditional — only fires when dice modules are active. Runs parallel with UA on Utility model slot. Handles narrative judgment only (trigger decisions). All mechanical resolution is client-side.
11. **Max roll cap**: Hard cap per output length setting — 5 tests (standard), 7-8 tests (detailed). Efficacy followUps don't count.
12. **Vital NPC definition**: NPCs with profiles on the sidebar AND present in current scene. Dice Agent receives this roster as input.
13. **Wildcard `"*"` trigger**: Engine-level feature. Client always recognizes `"*"` in `diceAdvantage` entries as matching all test triggers. No module opt-in needed.
