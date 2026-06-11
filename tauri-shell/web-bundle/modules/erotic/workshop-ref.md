# Erotic Module — Workshop Reference

Machine-readable reference for the Arcanum Workshop AI agent. Use this to validate rules and lore entries that interact with the erotic module.

## Lust Tier System

5 tiers (index 0-4): `休眠`(0) → `萌芽`(1) → `悶燒`(2) → `燃燒`(3) → `貪婪`(4)

- **No decay on idle** (unlike Hype). Lust holds its tier between turns.
- **Afterglow**: after the last romantic/physical interaction, hold current tier for 1 extra turn before cooling.
- **Cool-down triggers** (skip afterglow, drop one tier toward 休眠): open conflict, scene change to unrelated location, time skip, clear emotional disconnect, Hype ≤ 平淡.
- **Max movement**: one tier per turn (up or down).
- **Authority**: Lust is UTILITY AGENT-AUTHORITATIVE. The main LLM never evaluates or sets lust values. Rules that instruct the main LLM to compute lust are invalid.

## Activation

- **Keywords**: 親, 吻, 抱, 摸, 脫, 插入, 口交, 指交, 性交, 肛交, 裸
- **Lust threshold**: module prompt loads when any NPC's lustTier index ≥ `lustThreshold` config value (default: 2 = 悶燒)
- **UA flag**: `eroticScene` (boolean) — UA sets this to true when content is explicitly erotic
- **Prompt loading**: When enabled but inactive → `stub.md` in cacheable Block 1. When active/afterglow → compact `prompt.md` runtime guidance in dynamic context. Long examples stay in `style-bank.md` and are not loaded at runtime.
- **Afterglow**: after deactivation, prompt persists for up to `maxAfterglow` turns (default: 5), then module goes dormant.
- **Load states**: `dormant` → `active` → `afterglow` → `dormant`

## Style Directive

Active style is injected as a compact dynamic capsule when the module is active, keeping cacheable prompt blocks stable.

| Field | Value |
|-------|-------|
| narrationFocus | texture, impact, sound, physicality, body, genitalia, joining, sensation |
| vocabularyTier | raw |
| toneKeywords | degradation, dominance, submission, tenderness, suggestive, sensual, pornographic, vulgar-when-apt |
| descriptionPriorities | physicality, sensation, emotion, attractive-features, body-parts, penetration |

Style fields are individually overridable by Arcanum config patches. For example, an Arcanum can replace `vocabularyTier` with `"euphemistic"` or reorder `narrationFocus`.

## Config Fields (Overridable by Arcanum Rules)

| Field | Type | Range | Default | Effect |
|-------|------|-------|---------|--------|
| `lustThreshold` | number | 0-4 | 2 | Lust tier index at which erotic prompt is injected (0=休眠 loads immediately, 4=貪婪 only) |
| `escalationThreshold` | number | 0-4 | 3 | Lust tier index at which intensity scoring increases (higher → slower buildup) |
| `maxAfterglow` | number | 1-10 | 5 | Turns the erotic prompt persists after deactivation |
| `intensityThreshold` | number | 3-12 | 7 | eroticIntensity score at or above which model escalation triggers |
| `cooldownOnConflict` | boolean | — | true | Whether lust cools down when emotional conflict is detected |

### Config Patch Rule Format

```
type: config
target: erotic.lustThreshold
value: 0
```

```
type: config
target: erotic.style.vocabularyTier
value: "euphemistic"
```

```
type: config
target: erotic.cooldownOnConflict
value: false
```

## State Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `sceneActive` | boolean | false | Whether an erotic scene is currently in progress. Set by UA via `eroticScene` flag. Reset on scene change. |
| `npcLustTiers` | object | {} | Map of npcId → lust tier string. Set by UA via `lustTier` per-NPC eval. |

State is read-only from the Arcanum perspective. Rules cannot directly set state values — they can only influence config thresholds that affect when state transitions occur.

## UA Eval Fields

These fields are evaluated by the Utility Agent each turn when the module is enabled:

| Field | Type | Per-NPC | Description |
|-------|------|---------|-------------|
| `eroticScene` | boolean | no | Is current content explicitly erotic? Maps to `sceneActive`. |
| `lustTier` | string | yes | NPC physical/sexual tension tier. One of: 休眠, 萌芽, 悶燒, 燃燒, 貪婪. Maps to `npcLustTiers`. |
| `eroticIntensity` | number | yes | Intensity score 0-4. Formula: lustTierIndex (燃燒=1, 貪婪=2) + contextBonus (flirt=0, makeout/foreplay=1, intercourse=2). Does not map to state. Used for escalation decisions. |

## Character Extension Fields

### Trigger Fields (activation hints)
| Key | Type | Description |
|-----|------|-------------|
| `keywords` | tags | Erotic trigger keywords specific to this character |
| `conditions` | textarea (50 tokens max) | Conditions under which erotic content activates for this character |

### Profile Fields (character detail)
| Key | Type | Description |
|-----|------|-------------|
| `preferences` | textarea | Character's erotic preferences and inclinations |
| `boundaries` | textarea | Character's erotic boundaries and limits |
| `physicalTraits` | textarea | Character's physical/erotic traits |

Injected via labels `[Erotic Triggers]` and `[Erotic Profile]` into the character profile block.

## Memory Integration

- **Critical event fields**: `lustTier`, `sceneActive` — included in critical event snapshots.
- **Compression**: when `sceneActive` is true, erotic context has `high` priority during compression (preserved over non-erotic content).
- **Milestones**: tracked for `lustTier` field — `firstReach` events at 悶燒, 燃燒, 貪婪; `peak` event for highest tier reached.

## Pacing Drivers

The module injects these pacing drivers at session start:
- `npc_initiative`: NPC initiates physical language/contact escalation to test player response
- `environmental`: Environment forces physical proximity (narrow space, falling, hiding)
- `opportunity`: Private moment appears; NPC attitude varies by affection level

## Bottleneck Quest Directions

Intimacy-themed quest directions injected at affection gates:
- **50%**: Trust test in a private/vulnerable situation involving physical boundaries
- **70%** (A): Joint decision involving intimacy and desire — character's inner conflict needs understanding
- **70%** (B): Player must actively approach and express genuine desire — character needs to feel real want, not ambiguous probing
- **90%**: Player asks about character's ideal climactic experience and helps achieve it — deepest physical trust

## Valid Rule Examples

### Config patches
```
type: config
target: erotic.lustThreshold
value: 0
reason: "Erotic content available from session start regardless of lust tier"
```

```
type: config
target: erotic.maxAfterglow
value: 10
reason: "Erotic tone lingers longer in this setting"
```

```
type: config
target: erotic.style.vocabularyTier
value: "euphemistic"
reason: "Setting uses poetic language for intimacy"
```

```
type: config
target: erotic.style.narrationFocus
value: ["emotion", "sensation", "sound"]
reason: "Emphasize emotional intimacy over raw physicality"
```

```
type: config
target: erotic.cooldownOnConflict
value: false
reason: "In this world, conflict and desire are intertwined"
```

### Prompt directives
```
type: directive
priority: module
text: "During erotic scenes, always describe environmental ambiance (lighting, temperature, scent) before physical action."
```

```
type: directive
priority: module
text: "NPC erotic dialogue should reflect their personality archetype — dominant NPCs command, shy NPCs whisper fragments."
```

## Invalid Rule Examples

```
# INVALID — directly sets lust tier (UA-authoritative, not rule-settable)
type: config
target: erotic.state.npcLustTiers.npc_mei
value: "貪婪"
reason: "Lust tiers are set by the Utility Agent, not by rules"
```

```
# INVALID — references non-existent config field
type: config
target: erotic.fadeToBlack
value: true
reason: "No such config field exists in the erotic module"
```

```
# INVALID — instructs main LLM to evaluate lust
type: directive
text: "The narrator should decide the lust tier based on scene content."
reason: "Lust is UA-authoritative. Main LLM must not evaluate lust."
```

```
# INVALID — bypasses tier movement limit
type: directive
text: "Lust can jump from 休眠 directly to 貪婪 in a single turn."
reason: "Max lust movement is one tier per turn. This is hardcoded behavior."
```

```
# INVALID — references non-existent mechanics
type: config
target: erotic.resistanceDC
value: 18
reason: "No resistanceDC config field exists"
```

## Valid Lore Examples

### Cultural/social context
```
title: "紅燈街的規矩"
keywords: ["紅燈街", "風俗"]
content: "紅燈街有嚴格的行規：交易前必須談妥價格，未經同意觸碰工作中的人會被打斷腿。但暗巷裡的規矩就不同了。"
```

### Location with erotic implications
```
title: "溫泉旅館的混浴"
keywords: ["溫泉", "混浴", "旅館"]
content: "這間旅館的露天溫泉不分男女。蒸氣朦朧中，裸身的距離感會自然消失。深夜時分幾乎沒有其他客人。"
```

### Relationship dynamic
```
title: "師徒之間的禁忌"
keywords: ["師父", "徒弟", "禁忌"]
content: "門派嚴禁師徒之間發展情感關係。被發現者逐出師門。但密室修煉時，長時間獨處讓這條規矩變得格外難守。"
```

### Character-specific erotic context
```
title: "月影的弱點"
keywords: ["月影", "耳朵", "敏感"]
content: "月影的耳廓異常敏感，輕輕吹氣就會讓她全身發軟。她極力隱藏這個弱點，但親密時根本無法掩飾。"
```
