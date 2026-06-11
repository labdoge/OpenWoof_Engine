# Combat Module — Workshop Reference

Module ID: `combat`. Version 1.0.0. Not enabled by default.
Activation: keyword-based (`$COMBAT_ACTIVATION_KEYWORDS` locale key) + UA flag `combatActive`.
Prompt injection: Block 1, afterglow 3 turns after combat ends.

---

## Available Resources

| ID | Icon | Scope | Default Max | Default Current | Color | Regen Triggers |
|----|------|-------|-------------|-----------------|-------|----------------|
| `hp` | ❤️ | `all` (player + all NPCs) | 20 | 20 | `#e04040` | `rest`, `sleep`, `item_heal`, `combat_end` |
| `sp` | ⚡ | `player_and_vital` (player + vital NPCs only) | 10 | 10 | `#5b9bd5` | `rest`, `item_restore` |

**Scope meanings:**
- `all` — resource pool exists for the player AND every NPC in the scene.
- `player_and_vital` — resource pool exists for the player and vital (named/important) NPCs only. Generic enemies do NOT have this resource.
- `player` — player only (not used by combat, but valid in the system).

Arcanum rules CAN adjust default max values via `resourceBonus` in lore mechanics. They CANNOT invent new resource IDs.

---

## Dice System

**Test rolls:** 2d6 (or 3d6 with advantage/disadvantage, keep best/worst 2). No numeric modifiers on test rolls — difficulty is advantage/disadvantage only.

**Success thresholds (fixed, not configurable):**
- `great_success`: total >= 10 — critical hit, devastating blow, possible follow-up advantage
- `success`: total >= 7 — solid hit, standard damage applies
- `fail`: total < 7 — miss or blocked, enemy may counter-attack

**Recognized triggers:** `attack`, `defend`, `ability_check`, `damage`, `healing`
- `attack`: player or vital NPC attempts an offensive action
- `defend`: defending against an incoming enemy action
- `ability_check`: using a special ability (SP-costing or situational)
- `damage`: efficacy roll following a successful attack
- `healing`: efficacy roll for healing effects

**Efficacy system:**
- Mode: `both` (supports rolled dice AND flat/derived values)
- Default efficacy die: `d6`
- Default derivation: `highest` (take the higher of the 2 kept test dice)
- Critical multiplier: `2x` (efficacy doubled on `great_success`)

**Modifier resolution (highest-wins):**
- Multiple bonuses: only the single highest applies
- Multiple penalties: only the single largest (most negative) applies
- If both exist: net = highest bonus + largest penalty

---

## Config Fields (Overridable by Arcanum Rules)

| Field | Type | Range | Default | Controls |
|-------|------|-------|---------|----------|
| `baseDifficulty` | number | 5–12 | 7 | Baseline difficulty for combat checks. Higher = harder encounters. Does NOT change the 2d6 success threshold (which is fixed at 7); instead influences UA and Combat Agent difficulty assessments. |
| `surroundedThreshold` | number | 2–8 | 4 | Number of enemies that triggers the "surrounded" condition, granting enemies tactical advantage. |
| `surroundedAdvantage` | number | 1–4 | 2 | Bonus value enemies gain when the surrounded condition is active. |
| `bossHPMultiplier` | number | 0.5–3.0 | 1.0 | Multiplier applied to boss-rank enemy HP pools. 1.0 = standard, 2.0 = double HP bosses. |

**Config patch rule format:**
```
type: config_patch
module: combat
field: baseDifficulty
value: 10
```

---

## State Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `combatActive` | boolean | `false` | Whether combat is currently in progress. Set by Combat Agent. Also serves as the module activation flag. |
| `enemyRoster` | object | `{}` | Map of active enemies keyed by enemy ID. Each entry is a `CombatEnemy` with id, name, rank (`mob`/`elite`/`boss`), description, hp, hpCurrent, abilities, aiHint. |
| `combatFlags` | array | `[]` | Tactical situation flags (e.g., "surrounded", "ambush", "retreating"). Set by Combat Agent per turn. |
| `buffs` | object | `{}` | Active buff/debuff effects on combatants. Keyed by target, contains effect name and duration. |
| `defeatedCount` | number | `0` | Running count of enemies defeated this session. Tracked for milestones and narrative escalation. |

**Enemy ranks:** `mob` (simple attacks), `elite` (strategic ability use), `boss` (multi-ability rotation, HP multiplied by `bossHPMultiplier`).

---

## Character Extension Fields

**Trigger fields** (injected as `[Combat Triggers]` when combat activates):
- `combatStyle` (tags): fighting style descriptors, e.g. "aggressive", "defensive", "acrobatic"
- `weaponPreference` (textarea, max 50 tokens): preferred weapon or fighting method

**Profile fields** (injected as `[Combat Profile]` in NPC profiles):
- `combatTraits` (textarea): how this character fights — strengths, weaknesses, signature moves
- `tactics` (textarea): preferred tactical approach and decision-making in combat

These fields influence narrative descriptions only. They do NOT grant mechanical bonuses unless paired with lore entries that have `diceAdvantage` or `diceModifier` mechanics.

---

## Valid Rule Examples

### Config patch — harder encounters
```
type: config_patch
module: combat
field: baseDifficulty
value: 10
reason: "This is a high-lethality dark fantasy world"
```

### Config patch — tougher bosses
```
type: config_patch
module: combat
field: bossHPMultiplier
value: 2.0
reason: "Bosses should be grueling multi-phase fights"
```

### Prompt directive — combat narration style
```
type: prompt_directive
module: combat
priority: module
directive: "All combat descriptions should emphasize environmental destruction. Attacks shatter pillars, crack floors, and send debris flying. Property damage is always dramatic."
```

### Prompt directive — non-lethal constraint
```
type: prompt_directive
module: combat
priority: module
directive: "Player character never kills opponents. Combat always ends with incapacitation, surrender, or retreat. Describe finishing blows as disabling rather than fatal."
```

---

## Invalid Rule Examples

### Inventing a resource that doesn't exist
```
type: config_patch
module: combat
field: mp
value: 30
```
INVALID: `mp` is not a config field. Resources are defined in the manifest `resources` array. Arcanum rules cannot create new resource types — only modify existing ones via `resourceBonus` in lore mechanics.

### Adding unrecognized dice triggers
```
type: lore_mechanic
diceRequest:
  trigger: "parry"
  purpose: test
```
INVALID: `parry` is not in `recognizedTriggers`. Only `attack`, `defend`, `ability_check`, `damage`, `healing` are recognized. Use `defend` for parry-like actions or `ability_check` for special defensive moves.

### Assuming mechanics that don't exist
```
type: prompt_directive
module: combat
directive: "Apply armor class reduction to incoming damage rolls"
```
INVALID: There is no armor class system. Damage mitigation is narrative only. The dice system has advantage/disadvantage and efficacy modifiers — there are no subtraction-based defense calculations.

---

## Valid Lore Examples

### Magic system lore with dice integration
```json
{
  "title": "Fire Magic",
  "category": "ability",
  "keywords": ["fire", "flame", "burn", "incinerate"],
  "description": "Destructive elemental magic that channels flames through the caster's will.",
  "mechanics": {
    "cost": [{ "resource": "sp", "amount": 3 }],
    "diceRequest": [{
      "trigger": "attack",
      "purpose": "efficacy",
      "die": "d8",
      "count": 2,
      "reason": "Fire magic damage"
    }]
  }
}
```
Uses existing trigger `attack`, references existing resource `sp`, specifies valid dice (`d8`).

### Weapon lore with passive modifier
```json
{
  "title": "Ancestral Greatsword",
  "category": "item",
  "keywords": ["greatsword", "ancestral blade"],
  "description": "A massive two-handed blade passed down through generations of warriors.",
  "mechanics": {
    "equippable": true,
    "slot": "weapon",
    "diceModifier": [{
      "trigger": "damage",
      "bonus": 2
    }],
    "diceAdvantage": [{
      "trigger": "attack",
      "type": "advantage"
    }]
  }
}
```
Grants advantage on `attack` test rolls and +2 efficacy modifier on `damage` rolls. Both use recognized triggers.

### Faction lore with combat implications
```json
{
  "title": "Shadow Guild Assassins",
  "category": "faction",
  "keywords": ["shadow guild", "assassin", "shadow assassin"],
  "description": "An elite organization of killers who strike from darkness. Their agents favor poison and ambush tactics.",
  "mechanics": {
    "diceAdvantage": [{
      "trigger": "attack",
      "type": "advantage"
    }]
  }
}
```
When this lore is active (keyword-triggered in scene), Shadow Guild members gain advantage on attacks. The faction's narrative flavor (poison, ambush) is handled by the description text and prompt directives, not by inventing custom mechanics.
