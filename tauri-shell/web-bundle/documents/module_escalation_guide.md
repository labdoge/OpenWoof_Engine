# Module Escalation & Dynamic Model Switching Guide

How modules participate in the dynamic model switching system (standard/lite mode).

---

## Architecture Overview

Dynamic model switching routes turns to either a **standard** model (cheaper) or an **escalated** model (more capable, more expensive) based on scene intensity. The decision has two layers:

1. **Core engine** — evaluates `sceneImportance` (from UA eval) and hype tiers
2. **Module hooks** — each enabled module can add its own escalation criteria

Both layers feed into `shouldEscalateForMode()`, which makes the final routing decision.

### Decision Flow

```
UA Eval → sceneImportance (routine/notable/climactic)
       → module fields (per-NPC, per module)
                ↓
   ┌────────────────────────────┐
   │  dispatchShouldEscalate()  │  ← OR merge across all modules
   │  dispatchGetIntensity()    │  ← MAX merge across all modules
   └────────────────────────────┘
                ↓
   ┌────────────────────────────┐
   │  shouldEscalateForMode()   │  ← Core + module results → final decision
   └────────────────────────────┘
                ↓
         Model selection
```

### Mode Behavior

| Mode | Core triggers | Module triggers |
|------|--------------|-----------------|
| **Standard** | 強烈正面/負面 hype, quest completion | `shouldEscalate` returns true |
| **Lite** | `sceneImportance === 'climactic'` only | `shouldEscalate` returns true |

In **lite mode**, the core engine only escalates on genuine dramatic turning points. Modules provide the additional path for domain-specific escalation (e.g., erotic intensity threshold).

---

## The Two Module Hooks

### `shouldEscalate(uaEval, moduleState) → boolean`

**Merge strategy:** OR — any module returning `true` triggers escalation.

**Purpose:** Decide whether the current turn warrants the escalated (premium) model. This is the primary cost lever — returning `true` means this turn uses the more expensive model.

**Guidelines:**
- Be conservative. Every `true` return costs real money.
- Use a **composite score** rather than simple boolean flags. A single condition (e.g., "any combat active") is too broad — it triggers for every turn of a fight, not just the critical moments.
- Design thresholds that can be tuned via manifest `config` (moddable by Arcanum rules).
- The hook fires on every turn, not just when the module is "active" in narrative terms.

**Anti-patterns:**
- ❌ `if (moduleState.sceneActive) return true` — too broad, triggers for entire scene duration
- ❌ `if (anyNPC.hype === '強烈正面') return true` — duplicates core logic
- ❌ Returning true based on a single UA boolean flag

**Good patterns:**
- ✅ Composite score with configurable threshold: `score = metricA + metricB; return score >= threshold`
- ✅ Threshold that requires multiple conditions to align (high state + high context)

### `getIntensity(uaEval, moduleState) → 'intense' | 'escalated' | null`

**Merge strategy:** MAX — highest intensity across all modules wins.

**Purpose:** Control output length and narrative detail level. This affects `maxTokens` and scene length, not model selection.

| Return | Effect |
|--------|--------|
| `null` | No opinion — defer to core/other modules |
| `'escalated'` | Longer output, more detail |
| `'intense'` | Maximum output length, full narrative detail |

**Guidelines:**
- Reserve `'intense'` for genuine peak moments (a subset of escalated turns).
- Use graduated thresholds: escalation threshold for `'escalated'`, higher threshold for `'intense'`.
- `getIntensity` should generally correlate with `shouldEscalate` but can be independent.

---

## Designing a Module's Escalation Score

### The Composite Score Pattern

The recommended approach is a **composite score** that combines persistent state with per-turn context. This prevents premature escalation while ensuring peak moments are captured.

```
score = persistentMetric + contextBonus
```

- **persistentMetric**: A value that builds over multiple turns (e.g., tension level, danger level, ritual progress). Provides the "baseline" that makes escalation possible.
- **contextBonus**: A per-turn bonus based on what's actually happening in the narrative (e.g., attack type, spell tier, intimacy level). Provides the "trigger" that makes escalation happen.

The threshold should be set so that **neither component alone** easily reaches it. This ensures escalation requires both buildup AND a meaningful event.

### Example: Erotic Module

```
eroticIntensity = lustTierIndex + contextBonus

lustTierIndex:  休眠=0, 萌芽=1, 悶燒=2, 燃燒=3, 貪婪=4
contextBonus:   flirting=1, makeout=2, foreplay=3, intercourse=4

Threshold: 7 (configurable)
```

| Scenario | Score | Escalates? |
|----------|-------|------------|
| Flirting at 萌芽 | 1+1=2 | No |
| Makeout at 悶燒 | 2+2=4 | No |
| Makeout at 燃燒 | 3+2=5 | No |
| Foreplay at 燃燒 | 3+3=6 | **Yes** |
| Intercourse at 悶燒 | 2+4=6 | **Yes** |
| Intercourse at 貪婪 | 4+4=8 | **Yes** (intense) |

### Example: Hypothetical Combat Module

```
combatIntensity = threatLevel + actionBonus

threatLevel:   safe=0, cautious=1, dangerous=2, critical=3, lethal=4
actionBonus:   defend=1, standard attack=2, special move=3, finishing blow=4

Threshold: 6
```

| Scenario | Score | Escalates? |
|----------|-------|------------|
| Defend at cautious | 1+1=2 | No |
| Standard attack at dangerous | 2+2=4 | No |
| Special move at critical | 3+3=6 | **Yes** |
| Finishing blow at lethal | 4+4=8 | **Yes** (intense) |

---

## UA Eval Field Design

The composite score should be computed by the UA (Utility Agent), not the client. The UA has narrative context to assess both the persistent state and the per-turn context.

### Declaring Fields in `manifest.json`

```json
"uaEval": [
  {
    "field": "myModuleIntensity",
    "type": "number",
    "description": "$MY_MODULE_UA_INTENSITY_DESC",
    "mapsTo": null,
    "readWhen": "enabled",
    "perNPC": true
  }
]
```

- `mapsTo: null` — escalation scores are read directly from `ev.moduleFields` by hooks, not auto-mapped to module state.
- `perNPC: true` — each NPC gets their own score (recommended for most modules).
- `readWhen: "enabled"` — field is only requested when the module is enabled.

### Writing the Field Description

The description string becomes part of the UA eval prompt. It must be self-contained and unambiguous — the UA has no other documentation about your module's scoring. Include:

1. What the score represents
2. The exact formula with all possible values
3. The valid output range
4. What to output when the module's domain isn't active this turn

```json
"$MY_MODULE_UA_INTENSITY_DESC": "Combat intensity score for this NPC. Formula: threatLevelIndex (safe=0, cautious=1, dangerous=2, critical=3, lethal=4) + actionBonus (defend=1, standard=2, special=3, finishing=4). Output integer 0-8. If no combat context this turn, output 0."
```

---

## Manifest Config for Thresholds

Always expose escalation thresholds as moddable config:

```json
"config": {
  "intensityThreshold": {
    "type": "number",
    "default": 6,
    "min": 3,
    "max": 10,
    "label": "MODULE_CONFIG_MY_MODULE_INTENSITY_THRESHOLD",
    "description": "MODULE_CONFIG_MY_MODULE_INTENSITY_THRESHOLD_DESC"
  }
}
```

This allows Arcanum rules to adjust sensitivity per-world (e.g., a gritty world might lower the threshold, a casual world might raise it).

---

## Hook Implementation Template

```typescript
const DEFAULT_INTENSITY_THRESHOLD = 6;

function readConfig<T>(moduleState: Record<string, unknown>, key: string, fallback: T): T {
  const config = moduleState.__config as Record<string, unknown> | undefined;
  if (config && key in config) return config[key] as T;
  return fallback;
}

export const myModuleHooks: ModuleHooks = {
  shouldEscalate: (uaEval, moduleState) => {
    const threshold = readConfig(moduleState, 'intensityThreshold', DEFAULT_INTENSITY_THRESHOLD);
    for (const ev of uaEval.evaluations) {
      const intensity = typeof ev.moduleFields?.myModuleIntensity === 'number'
        ? ev.moduleFields.myModuleIntensity : 0;
      if (intensity >= threshold) return true;
    }
    return false;
  },

  getIntensity: (uaEval, moduleState) => {
    const threshold = readConfig(moduleState, 'intensityThreshold', DEFAULT_INTENSITY_THRESHOLD);
    let maxIntensity = 0;
    for (const ev of uaEval.evaluations) {
      const intensity = typeof ev.moduleFields?.myModuleIntensity === 'number'
        ? ev.moduleFields.myModuleIntensity : 0;
      if (intensity > maxIntensity) maxIntensity = intensity;
    }
    // 2+ above threshold → intense; at/above threshold → escalated
    if (maxIntensity >= threshold + 2) return 'intense';
    if (maxIntensity >= threshold) return 'escalated';
    return null;
  },
};
```

---

## Core `sceneImportance` Rules (Do NOT Duplicate)

The core engine handles `sceneImportance` evaluation in the UA eval prompt. Modules should **not** attempt to influence `sceneImportance` directly. Instead:

- `climactic` requires BOTH 強烈 hype AND an essential story beat (revelation, betrayal, quest completion, relationship-altering moment). Strong emotion during routine interaction is `notable`.
- Cooldown is UA-prompt-level: after a climactic beat resolves, the UA naturally returns to `notable` or `routine`.
- Modules add escalation criteria **alongside** core rules, not overriding them.

### What Modules Should NOT Do

- ❌ Add module-specific criteria to the `sceneImportance` definition
- ❌ Try to force `sceneImportance` to `climactic` via module fields
- ❌ Duplicate hype-based escalation (core already handles 強烈 hype)

### What Modules SHOULD Do

- ✅ Define their own composite intensity score via UA eval fields
- ✅ Use `shouldEscalate` hook to add domain-specific escalation path
- ✅ Use `getIntensity` hook to control output length independently
- ✅ Expose thresholds as moddable config

---

## Checklist for New Module Escalation

- [ ] Define a composite score formula (`persistentMetric + contextBonus`)
- [ ] Set threshold so neither component alone triggers escalation
- [ ] Add UA eval field with `mapsTo: null`, `perNPC: true`
- [ ] Write clear, self-contained field description with formula and range
- [ ] Add `intensityThreshold` to manifest `config` (moddable)
- [ ] Implement `shouldEscalate` hook using threshold from config
- [ ] Implement `getIntensity` hook with graduated levels (escalated/intense)
- [ ] Add locale keys for config labels and descriptions
- [ ] Test: routine scenario → no escalation
- [ ] Test: moderate scenario → no escalation (score below threshold)
- [ ] Test: peak scenario → escalation (score at/above threshold)
