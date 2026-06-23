# DogeChat Engine -- Module Design Guide

> Single source of truth for module authors, workshop agents, and rule resolvers.
> Version: 2.0 | Engine: DogeChat v0.4+

---

## Table of Contents

1. [Overview & Philosophy](#1-overview--philosophy)
2. [File Structure Template](#2-file-structure-template)
3. [Manifest Reference](#3-manifest-reference)
4. [Config Section (Mod API Surface)](#4-config-section-mod-api-surface)
5. [Hooks Reference](#5-hooks-reference)
6. [State Management](#6-state-management)
7. [Storage APIs](#7-storage-apis)
8. [Locale System](#8-locale-system)
9. [Prompt Architecture](#9-prompt-architecture)
10. [Character Extension](#10-character-extension)
11. [Dice System](#11-dice-system)
12. [Module Agent Design Pattern](#12-module-agent-design-pattern)
13. [Arcanum Integration Standard](#13-arcanum-integration-standard)
14. [Complete Template](#14-complete-template)

---

## 1. Overview & Philosophy

A **module** is a self-contained game subsystem -- analogous to a TTRPG supplement book. It declares its own state, evaluation fields, prompts, UI elements, dice mechanics, and character extensions through a single `manifest.json` file plus supporting assets.

**Arcanum** is the mod loader and world-building layer. It reads module config schemas, resolves user-authored rules into config patches, injects world-building context, and applies x-card safety overrides. Modules do not interact with Arcanum directly; the engine mediates all integration.

### Core Principles

- **Declarative** -- Modules describe *what* they need in `manifest.json`; the engine handles *when* and *how*. No imperative registration code.
- **Isolated** -- Each module owns its folder. Modules cannot directly read or mutate another module's state. Cross-module interaction happens only through shared hooks and the engine's dispatch layer.
- **Locale-independent** -- All user-visible strings live in per-module locale JSON files, referenced via `$KEY` tokens in the manifest. The manifest itself contains no hardcoded language-specific content.
- **Arcanum-ready** -- Every module exposes a `config` section that serves as its mod API surface. Arcanum rules override config values without touching module code.
- **Gracefully degrading** -- Invalid manifests are logged and skipped. Hook failures are caught and warned. The app never crashes from a module error.
- **Engine-authoritative** -- The orchestrator owns the turn pipeline. Modules influence behavior through hooks but never control flow directly.
- **Structured output, narrative separation** -- Module agents and subagents (Combat Agent, Dice Agent, future Puzzle Agent, etc.) output ONLY structured/mechanical JSON results. They never produce narrative prose. The Main Session LLM is the sole narrative voice — it receives structured results as `[SYSTEM]` injections and weaves them into the story. This separation ensures consistent voice, prevents token waste in agent calls, and makes agent output reliably parseable.

### Module Lifecycle States

Every module has a `ModuleLoadState` (defined in `src/modules/types.ts`):

| State | Prompt Loaded | Description |
|-------|---------------|-------------|
| `'dormant'` | `stub.md` | Module is enabled but activation conditions are not met. |
| `'active'` | `prompt.md` | Activation conditions are met (keyword, lustThreshold, or uaFlag). |
| `'afterglow'` | `prompt.md` | Recently deactivated. Full prompt persists for `maxAfterglow` turns, then transitions to dormant. |

```
dormant --(activation triggers)--> active
active  --(deactivation)--------> afterglow
afterglow --(counter expires)---> dormant
```

---

## 2. File Structure Template

```
modules/{moduleId}/
+-- manifest.json          # Module declaration (required)
+-- prompt.md              # Full prompt injected when active (required)
+-- stub.md                # Minimal prompt injected when dormant (required)
+-- {moduleId}-data.ts     # Shared constants: tier arrays, keywords, thresholds (optional)
+-- locale/
    +-- zh-TW.json         # Traditional Chinese locale data (required)
    +-- en.json            # English locale (optional, for future i18n)

src/modules/builtins/
+-- {moduleId}-hooks.ts    # Hook implementations (ModuleHooks) (required if module has logic)
```

### Naming Conventions

| Item | Convention | Example |
|------|-----------|---------|
| Module ID | Lowercase, single word or kebab-case | `erotic`, `combat`, `social-bonds` |
| Manifest file | Always `manifest.json` | -- |
| Hooks file | `{moduleId}-hooks.ts` | `erotic-hooks.ts` |
| Hooks export | `{moduleId}Hooks` (camelCase) | `eroticHooks` |
| Data file | `{moduleId}-data.ts` in module folder | `erotic-data.ts` |
| Locale file | `{langCode}.json` | `zh-TW.json` |

### Auto-Discovery via Vite Globs

The registry uses three Vite glob imports at build time (no manual registration needed):

```typescript
// Manifest discovery — src/modules/registry.ts
import.meta.glob('../../modules/*/manifest.json', { eager: true, import: 'default' });

// Hook discovery — src/modules/registry.ts
import.meta.glob('./builtins/*-hooks.ts', { eager: true });

// Locale discovery — src/modules/module-locale.ts
import.meta.glob('../../modules/*/locale/*.json', { eager: true, import: 'default' });
```

Drop files in the correct folders and rebuild. The registry logs each discovered module at startup:
```
[ModuleRegistry] Registered built-in module: erotic
[ModuleRegistry] Registered hooks for module: erotic
```

### Hook File Matching

The registry extracts the module ID from the hook filename (`erotic-hooks.ts` -> `erotic`) and looks for an exported object named `{moduleId}Hooks` (e.g., `eroticHooks`). If the export name does not match or no matching manifest exists, the hook file is skipped with a warning.

---

## 3. Manifest Reference

The full manifest type is `ModuleManifest` (defined in `src/modules/types.ts`). The registry validates required fields at load time via `validateManifest()`. Required fields: `id`, `name`, `version`, and `prompt` (with `file` and `stub` sub-fields).

### 3.1 Core Metadata

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `id` | `string` | Yes | Unique module identifier. Must match folder name. |
| `name` | `string` | Yes | Display name (use locale `$KEY`). |
| `description` | `string` | Yes | Short description (use locale `$KEY`). |
| `version` | `string` | Yes | Semver string (e.g., `"1.0.0"`). |
| `enabledByDefault` | `boolean` | No | If `true`, module auto-enables on new sessions. Queried by `getDefaultEnabledModules()`. |
| `conflicts` | `string[]` | Yes | Module IDs that cannot coexist. Empty array `[]` if none. |
| `requires` | `string[]` | Yes | Module IDs this module depends on. Empty array `[]` if none. |

### 3.2 Prompt Config -- `prompt: ManifestPromptConfig`

Controls how and when the module's prompt document is loaded into the system prompt.

| Field | Type | Required | Default | Purpose |
|-------|------|----------|---------|---------|
| `file` | `string` | Yes | -- | Filename of full prompt, relative to module folder (e.g., `"prompt.md"`). |
| `stub` | `string` | Yes | -- | Filename of stub prompt, relative to module folder (e.g., `"stub.md"`). |
| `block` | `number` | No | -- | Injection block: `1` (immutable/cached) or `2` (semi-stable). Block 3 injection uses the `getDynamicPrompt` hook instead. |
| `alwaysLoad` | `boolean` | No | `false` | If `true`, full prompt is always loaded regardless of activation state. |
| `maxAfterglow` | `number` | No | `0` | Turns the full prompt persists after deactivation before reverting to stub. |

**Erotic module example:**
```json
"prompt": {
  "file": "prompt.md",
  "stub": "stub.md",
  "block": 1,
  "alwaysLoad": false,
  "maxAfterglow": 5
}
```

Registry helper functions resolve prompt paths:
- `getModulePromptPath(id)` -- returns absolute path like `"/modules/erotic/prompt.md"`
- `getModuleStubPath(id)` -- returns absolute path like `"/modules/erotic/stub.md"`

### 3.3 Activation -- `activation: ManifestActivation`

Conditions that transition the module from `dormant` to `active`. All conditions are **OR-joined**: any single match triggers activation.

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `lustThreshold` | `number` | No | Lust tier index (0=rest, 1=bud, 2=smolder, 3=burn, 4=greed) at or above which module activates. |
| `keywords` | `string[]` | No | Player input keywords that trigger activation. Use `$KEY` for locale arrays. |
| `uaFlag` | `string` | No | UA eval field name. Module activates when this field is truthy in the eval result. |

**Erotic module example:**
```json
"activation": {
  "lustThreshold": 2,
  "keywords": "$EROTIC_ACTIVATION_KEYWORDS",
  "uaFlag": "eroticScene"
}
```

The registry function `getActivationKeywords(id, npcTriggerKeywords?)` merges manifest keywords with optional NPC-specific trigger keywords from character extension data, deduplicating the result.

### 3.4 State Schema -- `state: Record<string, ManifestStateField>`

Declares the module's runtime state fields with types and defaults. Used for initialization and documentation. State bags are created lazily in `StateManager.setModuleState()`.

```typescript
interface ManifestStateField {
  type: string;     // e.g., "boolean", "string", "number", "object"
  default: unknown;  // Initial value for new sessions
}
```

**Example:**
```json
"state": {
  "sceneActive": { "type": "boolean", "default": false }
}
```

### 3.5 UA Eval Fields -- `uaEval: ManifestUAEvalField[]`

Declares fields the Utility Agent must evaluate each turn and include in its JSON output.

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `field` | `string` | Yes | JSON key name in UA output. |
| `type` | `string` | Yes | Expected type (`"boolean"`, `"string"`, `"number"`). |
| `description` | `string` | Yes | Instruction to the UA explaining what to evaluate. Use `$KEY`. This is the actual prompt text the UA sees. |
| `mapsTo` | `string \| null` | Yes | Module state key this value is written to. `null` = read-only (not stored in state). |
| `readWhen` | `'enabled' \| 'active'` | No | `'enabled'` (default): always included when module is enabled. `'active'`: only included when module's activation gate is currently firing. |
| `perNPC` | `boolean` | No | If `true`, field appears inside each per-NPC evaluation entry. If `false`/absent, field is top-level (alongside `evaluations`, `sceneImportance`). |

**Erotic module example:**
```json
"uaEval": [
  {
    "field": "eroticScene",
    "type": "boolean",
    "description": "$EROTIC_UA_EROTIC_SCENE_DESC",
    "mapsTo": "sceneActive",
    "readWhen": "enabled"
  },
  {
    "field": "lustTier",
    "type": "string",
    "description": "$EROTIC_UA_LUST_TIER_DESC",
    "mapsTo": "npcLustTiers",
    "readWhen": "enabled",
    "perNPC": true
  }
]
```

The engine calls `collectEvalFields()` and `buildEvalPromptFieldSection()` (from `src/modules/module-memory.ts`) to generate the UA prompt injection. The generated markdown tells the UA:
```
### Module Fields
Include these additional fields in your JSON output:

**Top-level fields** (alongside `evaluations`, `sceneImportance`):
- `eroticScene` (boolean): Is current content explicitly erotic?

**Per-NPC fields** (inside each evaluation entry):
- `lustTier` (string): NPC physical/sexual tension tier...
```

### 3.6 Token Budget -- `tokens: ManifestTokens`

Token estimates for capacity planning.

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `inputEstimate` | `number` | Yes | Approximate input tokens for the full prompt. |
| `outputRecommendation` | `number` | Yes | Additional output tokens recommended. `0` = no extra budget needed. |
| `statusExtractPerNPC` | `number` | No | Extra status extraction tokens per NPC (for `perNPC` eval fields). |
| `statusExtractBase` | `number` | No | Base status extraction tokens (for top-level eval fields). |

### 3.7 UI Declarations -- `ui: ManifestUI`

#### `ui.hudPill: HudPillDeclaration`

Small indicator pill in the HUD bar.

| Field | Type | Purpose |
|-------|------|---------|
| `label` | `string` | Locale key for pill text. |
| `activeClass` | `string` | CSS class applied when active (e.g., `"active-erotic"`). |
| `activeWhen` | `string` | Module state key -- pill lights up when this key is truthy. |

#### `ui.statusItems: StatusItemDeclaration[]`

Items rendered in the status window.

| Field | Type | Purpose |
|-------|------|---------|
| `target` | `'npcRow' \| 'sceneRow' \| 'playerRow'` | Where in the status window this item appears. |
| `key` | `string` | Unique identifier for this status item. |
| `label` | `string` | Locale key for display label. |
| `display` | `'tier' \| 'bar' \| 'number' \| 'icon'` | Visual rendering mode. |
| `source` | `string` | Module eval field or state key to read the display value from. |
| `colors` | `Record<string, string>` | Value-to-hex-color map. Use `$KEY` for locale objects. |
| `pulseAt` | `string[]` | Values at which CSS pulse animation plays. Use `$KEY` for locale arrays. |
| `order` | `number` | Sort order within target row. Lower numbers appear first. |

**Erotic module example:**
```json
"ui": {
  "hudPill": {
    "label": "HUD_MODULE_EROTIC",
    "activeClass": "active-erotic",
    "activeWhen": "sceneActive"
  },
  "statusItems": [
    {
      "target": "npcRow",
      "key": "lust",
      "label": "STATUS_LUST",
      "display": "tier",
      "source": "lustTier",
      "colors": "$EROTIC_LUST_TIER_COLORS",
      "pulseAt": "$EROTIC_LUST_PULSE_AT",
      "order": 10
    }
  ]
}
```

### 3.8 Memory Config -- `memory: ModuleMemoryConfig` (optional)

Configures how the module participates in persistent memory systems.

| Field | Type | Purpose |
|-------|------|---------|
| `criticalEventFields` | `string[]` | Eval field names to snapshot when a Critical Event fires. |
| `compression` | `CompressionConfig` | Controls inclusion in context compression summaries. |
| `milestones` | `MilestoneDeclaration[]` | Cross-session milestone tracking declarations. |

#### `CompressionConfig`

| Field | Type | Purpose |
|-------|------|---------|
| `includeWhen` | `string` | Module state key. Compression includes this module only when this key is truthy. |
| `priority` | `'high' \| 'low'` | Compression priority. `'high'` modules are summarized before `'low'`. |

#### `MilestoneDeclaration`

| Field | Type | Purpose |
|-------|------|---------|
| `field` | `string` | Eval field to track (must match a `uaEval` field name). |
| `event` | `'firstReach' \| 'peak'` | `'firstReach'`: records the first time each value is seen. `'peak'`: tracks the highest value ever achieved. |
| `values` | `string[]` | (`firstReach` only) Specific values to track. Use `$KEY` for locale arrays. |

**Erotic module example:**
```json
"memory": {
  "criticalEventFields": ["lustTier", "sceneActive"],
  "compression": { "includeWhen": "sceneActive", "priority": "high" },
  "milestones": [
    { "field": "lustTier", "event": "firstReach", "values": "$EROTIC_LUST_MILESTONE_VALUES" },
    { "field": "lustTier", "event": "peak" }
  ]
}
```

### 3.9 Character Extension -- `characterExtension: ManifestCharacterExtension` (optional)

See [Section 10](#10-character-extension).

### 3.10 Dice Config -- `diceRolls: ManifestDiceConfig` (optional)

See [Section 11](#11-dice-system).

### 3.11 Config Section -- `config: Record<string, ModuleConfigField>` (optional)

See [Section 4](#4-config-section-mod-api-surface).

---

## 4. Config Section (Mod API Surface)

The `config` section is the module's **public API for Arcanum overrides**. Each key declares a tunable parameter that scenario authors can adjust through Arcanum rules without touching code.

### 4.1 Design Question

> "What would a homebrew DM want to change about this module?"

Thresholds, DC values, toggle behaviors, decay rates, afterglow durations -- anything a scenario author might reasonably tweak belongs in config. Internal implementation details, buffer sizes, and structural identifiers do not.

### 4.2 `ModuleConfigField` Type

Defined in `src/modules/types.ts`:

```typescript
interface ModuleConfigField {
  /** Value type for validation. */
  type: 'number' | 'boolean' | 'string';
  /** Default value used when no Arcanum override exists. */
  default: unknown;
  /** Locale key for display in Arcanum workshop and rule resolver. */
  label: string;
  /** Minimum value (numbers only). */
  min?: number;
  /** Maximum value (numbers only). */
  max?: number;
  /** Human/LLM-readable description of what this config controls. */
  description?: string;
}
```

### 4.3 Example: Erotic Module Config (5 Fields)

```json
"config": {
  "lustThreshold": {
    "type": "number",
    "default": 2,
    "min": 0,
    "max": 4,
    "label": "MODULE_CONFIG_EROTIC_LUST_THRESHOLD",
    "description": "MODULE_CONFIG_EROTIC_LUST_THRESHOLD_DESC"
  },
  "escalationThreshold": {
    "type": "number",
    "default": 3,
    "min": 0,
    "max": 4,
    "label": "MODULE_CONFIG_EROTIC_ESCALATION_THRESHOLD",
    "description": "MODULE_CONFIG_EROTIC_ESCALATION_THRESHOLD_DESC"
  },
  "defaultDC": {
    "type": "number",
    "default": 12,
    "min": 1,
    "max": 20,
    "label": "MODULE_CONFIG_EROTIC_DEFAULT_DC",
    "description": "MODULE_CONFIG_EROTIC_DEFAULT_DC_DESC"
  },
  "maxAfterglow": {
    "type": "number",
    "default": 5,
    "min": 1,
    "max": 10,
    "label": "MODULE_CONFIG_EROTIC_MAX_AFTERGLOW",
    "description": "MODULE_CONFIG_EROTIC_MAX_AFTERGLOW_DESC"
  },
  "cooldownOnConflict": {
    "type": "boolean",
    "default": true,
    "label": "MODULE_CONFIG_EROTIC_COOLDOWN_ON_CONFLICT",
    "description": "MODULE_CONFIG_EROTIC_COOLDOWN_ON_CONFLICT_DESC"
  }
}
```

### 4.4 Resolution Flow

At session start, `buildModuleConfig()` (in `src/modules/registry.ts`) resolves each config key:

1. Check `overrides[moduleId][key]` (from `ArcanumRecord.moduleOverrides`)
2. If override exists, validate type and clamp to `min`/`max` via `validateConfigValue()`
3. If validation fails or no override exists, use manifest `default`
4. Store the resolved config map at `moduleState.__config`

The validation function (`validateConfigValue`) handles:
- **Numbers**: type-checks, then clamps with `Math.max(min, Math.min(max, value))`
- **Booleans**: returns `undefined` (falls back to default) if value is not boolean
- **Strings**: returns `undefined` if value is not string

### 4.5 Reading Config at Runtime

**In hook code** -- read from `moduleState.__config` with a fallback pattern:

```typescript
function readConfig<T>(moduleState: Record<string, unknown>, key: string, fallback: T): T {
  const config = moduleState.__config as Record<string, unknown> | undefined;
  if (config && key in config) return config[key] as T;
  return fallback;
}

// Usage in a hook:
const threshold = readConfig(moduleState, 'escalationThreshold', 3);
```

**In non-hook engine code** -- use the registry's standalone lookup:

```typescript
import { getModuleConfig } from '../modules/registry';

const threshold = getModuleConfig<number>('erotic', 'lustThreshold', arcanumOverrides);
```

### 4.6 Registry Config API Functions

| Function | Signature | Purpose |
|----------|-----------|---------|
| `getModuleConfig<T>` | `(moduleId, key, overrides?) => T \| undefined` | Get a single resolved config value. Override -> validate -> default. |
| `getModuleConfigSchema` | `(moduleId) => Record<string, ModuleConfigField> \| undefined` | Get the config schema for one module. Returns `undefined` if no config. |
| `getAllConfigSchemas` | `() => Record<string, Record<string, ModuleConfigField>>` | Get all config schemas across all registered modules. Used by rule resolver. |
| `buildModuleConfig` | `(moduleId, overrides?) => Record<string, unknown> \| undefined` | Build the full resolved `__config` object for session start. |

### 4.7 Guidelines

**DO make configurable:**
- Numeric thresholds and DCs
- Toggle behaviors (booleans)
- Decay/cooldown rates
- Afterglow durations
- Any gameplay-tuning parameter

**DO NOT make configurable:**
- Internal implementation details (buffer sizes, retry counts)
- Values that would break invariants if changed
- Structural identifiers (field names, state keys, module IDs)

**Always provide:**
- Clear `description` strings -- they guide both users and the AI workshop assistant
- Reasonable `min`/`max` bounds on numbers to prevent game-breaking overrides
- Descriptive `label` locale keys for the workshop UI

---

## 5. Hooks Reference

Modules implement behavior through hooks -- typed functions called by the engine's **hook dispatcher** (`src/modules/hook-dispatcher.ts`). All hooks are defined in the `ModuleHooks` interface (`src/modules/types.ts`). Every hook is optional.

### 5.1 Merge Strategies

| Strategy | Behavior | Used By |
|----------|----------|---------|
| **OR** | Any module returning `true` wins. Short-circuits on first `true`. | `shouldEscalate` |
| **MAX** | Highest-ranked result wins (by `INTENSITY_RANK`). | `getIntensity` |
| **CONCAT** | All non-null strings joined with `\n\n`. Returns `null` if none. | `getDynamicPrompt` |
| **SINGLE** | Only the owning module (identified by `moduleId`) is called. | `resolveRoll` |
| **EACH** | Every enabled module with the hook is called. Returns `Map<moduleId, updatedState>`. | `onSceneChange`, `onTurnEnd`, `onSessionStart` |

Intensity ranking used by MAX merge:
```typescript
const INTENSITY_RANK: Record<string, number> = {
  regular: 0,
  escalated: 1,
  intense: 2,
};
```

### 5.2 Error Handling

All hook dispatch calls are wrapped in try/catch. A failing hook:
- Logs a warning: `[HookDispatcher] {hookName} failed for module "{id}": {error}`
- Returns the neutral value (`false` for OR, `null` for MAX, skipped for EACH)
- Never crashes the pipeline

### 5.3 `shouldEscalate` -- OR Merge

```typescript
shouldEscalate?: (uaEval: UAEvalResult, moduleState: Record<string, unknown>) => boolean;
```

**Dispatch function:** `dispatchShouldEscalate(enabledIds, uaEval, getHooks, getState)`

**When called:** After UA eval completes, before prompt assembly. Determines whether the narrative intensity should escalate for the current turn.

**Parameters:**
- `uaEval` -- Full UA evaluation result, including `evaluations[]` (per-NPC) and `moduleFields` (top-level module data)
- `moduleState` -- This module's state bag (includes `__config`)

**Returns:** `true` to request escalation, `false` for no opinion.

**Erotic module implementation:**
```typescript
shouldEscalate: (uaEval, moduleState) => {
  // Top-level flag: UA detected an erotic scene
  if (uaEval.moduleFields?.eroticScene) return true;
  // Per-NPC check: any NPC's lust >= escalation threshold
  const threshold = readConfig(moduleState, 'escalationThreshold', DEFAULT_ESCALATION_THRESHOLD);
  for (const ev of uaEval.evaluations) {
    if (lustIndex(ev.moduleFields?.lustTier) >= threshold) return true;
  }
  return false;
},
```

### 5.4 `getIntensity` -- MAX Merge

```typescript
getIntensity?: (uaEval: UAEvalResult, moduleState: Record<string, unknown>) => string | null;
```

**Dispatch function:** `dispatchGetIntensity(enabledIds, uaEval, getHooks, getState)`

**When called:** After `shouldEscalate`, during intensity resolution for prompt assembly.

**Returns:** One of `'regular'`, `'escalated'`, `'intense'`, or `null` (no opinion). The dispatcher selects the highest rank across all modules.

**Erotic module implementation:**
```typescript
getIntensity: (uaEval, moduleState) => {
  if (uaEval.moduleFields?.eroticScene) return 'intense';
  const threshold = readConfig(moduleState, 'escalationThreshold', DEFAULT_ESCALATION_THRESHOLD);
  let maxIdx = -1;
  for (const ev of uaEval.evaluations) {
    const idx = lustIndex(ev.moduleFields?.lustTier);
    if (idx > maxIdx) maxIdx = idx;
  }
  if (maxIdx >= LUST_TIERS.indexOf('\u8caa\u5a6a')) return 'intense';  // Greed tier
  if (maxIdx >= threshold) return 'escalated';
  return null;
},
```

### 5.5 `getDynamicPrompt` -- CONCAT Merge

```typescript
getDynamicPrompt?: (moduleState: Record<string, unknown>, gameState: GameState) => string | null;
```

**Dispatch function:** `dispatchGetDynamicPrompt(enabledIds, gameState, getHooks, getState)`

**When called:** During Block 3 system prompt assembly. All non-null results are concatenated with `\n\n` and injected into the dynamic section.

**Returns:** A prompt string to inject, or `null` for no injection this turn.

**Erotic module implementation:**
```typescript
getDynamicPrompt: (moduleState, _gameState) => {
  if (moduleState.sceneActive === true) {
    return '[Module: Erotic -- Active. Maintain erotic tone continuity with the established scene intensity.]';
  }
  return null;
},
```

### 5.6 `resolveRoll` -- SINGLE Dispatch

```typescript
resolveRoll?: (
  diceResult: DiceResult,
  rollRequest: RollRequest,
  moduleState: Record<string, unknown>,
) => RollResolution;
```

**Dispatch function:** `dispatchResolveRoll(moduleId, diceResult, rollRequest, getHooks, getState)`

**When called:** After the dice engine produces a `DiceResult`. Only the module identified by `moduleId` on the roll request is called.

**Returns:** A `RollResolution` containing:
- `promptInjection` -- text injected into Block 3 of the next turn's system prompt
- `displayText` -- user-visible roll result string shown in chat UI
- `stateUpdates` -- optional `Record<string, unknown>` of state changes to apply

**Erotic module implementation:**
```typescript
resolveRoll: (diceResult, rollRequest, _moduleState) => {
  const success = diceResult.success;
  const outcomeLabel = success ? L.DICE_ROLL_SUCCESS : L.DICE_ROLL_FAILURE;
  const displayText = `\ud83c\udfb2 ${rollRequest.die} \u2192 ${diceResult.total} vs DC${diceResult.dc} [${outcomeLabel}] \u2014 ${rollRequest.reason}`;
  const promptInjection = success
    ? `[Dice: ${rollRequest.reason} \u2014 SUCCESS (${diceResult.total} vs DC${diceResult.dc}). The attempt succeeds. Narrate the positive outcome naturally.]`
    : `[Dice: ${rollRequest.reason} \u2014 FAILURE (${diceResult.total} vs DC${diceResult.dc}). The attempt fails or is complicated. Narrate a setback or partial outcome.]`;
  return { promptInjection, displayText, stateUpdates: {} };
},
```

### 5.7 `onSceneChange` -- EACH

```typescript
onSceneChange?: (
  moduleState: Record<string, unknown>,
  prevScene: SceneContext,
  newScene: SceneContext,
) => Record<string, unknown>;
```

**Dispatch function:** `dispatchOnSceneChange(enabledIds, prevScene, newScene, getHooks, getState)`

**When called:** When the UA detects a scene transition (location change, time skip, etc.). Every enabled module with this hook is called.

**Returns:** Updated module state. The engine writes each result back to `moduleStates[moduleId]`.

**Erotic module implementation:**
```typescript
onSceneChange: (moduleState, _prevScene, _newScene) => {
  return { ...moduleState, sceneActive: false };
},
```

### 5.8 `onTurnEnd` -- EACH

```typescript
onTurnEnd?: (
  moduleState: Record<string, unknown>,
  gameState: GameState,
  uaEval: UAEvalResult,
) => Record<string, unknown>;
```

**Dispatch function:** `dispatchOnTurnEnd(enabledIds, gameState, uaEval, getHooks, getState)`

**When called:** At the end of each turn, after all other processing. Every enabled module with this hook is called.

**Returns:** Updated module state. Use for per-turn decay, cooldowns, stat adjustments, or state transitions.

**Erotic module implementation** (pass-through; UA writes `sceneActive` in step 6):
```typescript
onTurnEnd: (moduleState, _gameState, _uaEval) => {
  return moduleState;
},
```

### 5.9 `onSessionStart` -- EACH

```typescript
onSessionStart?: (
  moduleState: Record<string, unknown>,
  scenarioData: Record<string, unknown>,
) => Record<string, unknown>;
```

**Dispatch function:** `dispatchOnSessionStart(allModuleIds, scenarioData, getHooks, getState)`

**When called:** At session initialization. Called on **ALL registered modules** (not just enabled ones) so every module can set up defaults.

**Returns:** Initial module state for the new session.

**Erotic module implementation:**
```typescript
onSessionStart: (_moduleState, _scenarioData) => {
  return { sceneActive: false, npcLustTiers: {} };
},
```

### 5.10 Dispatcher Callback Types

The dispatch functions accept two callback parameters for dependency injection:

```typescript
type HookGetter = (id: string) => ModuleHooks | undefined;
type StateGetter = (id: string) => Record<string, unknown>;
```

This keeps the dispatcher pure and testable -- it never directly accesses the registry or state manager.

---

## 6. State Management

Module state is managed through `StateManager` methods (in `src/state/state-manager.ts`). All module state lives inside `GameState.modules`:

```typescript
interface ModulesState {
  enabledModules: string[];
  moduleStates: Record<string, Record<string, unknown>>;
}
```

### 6.1 Core Methods

#### `setModuleEnabled(moduleId: string, enabled: boolean): void`

Adds or removes a module ID from `enabledModules`. Triggers save notification.

#### `isModuleEnabled(moduleId: string): boolean`

Returns `true` if `moduleId` is in the `enabledModules` array.

#### `setModuleState(moduleId: string, key: string, value: unknown): void`

Sets a key in a module's state bag. Creates the bag lazily if it does not exist. Does **not** trigger save notification -- callers are expected to batch (e.g., `applyUtilityAgentEval` sets multiple keys then saves once).

#### `getModuleState<T = unknown>(moduleId: string, key: string): T | undefined`

Reads a value from a module's state bag. Returns `undefined` if the module or key does not exist.

#### `setModuleNPCState(moduleId: string, mapKey: string, npcId: string, value: unknown): void`

Sets a per-NPC value within a map-type state key. Creates nested objects lazily. The storage pattern is: `moduleStates[moduleId][mapKey][npcId] = value`.

#### `getModuleNPCState<T = unknown>(moduleId: string, mapKey: string, npcId: string): T | undefined`

Reads a per-NPC value. Returns `undefined` if any part of the path does not exist.

#### `getLustTier(npcId: string): LustTier`

Convenience method specifically for the erotic module. Calls `getModuleNPCState('erotic', 'npcLustTiers', npcId)` with a fallback to the dormant tier.

### 6.2 Per-NPC State Pattern

For fields that vary by NPC (e.g., lust tier), use a map-type state key. The `uaEval` declaration with `perNPC: true` and `mapsTo: "npcLustTiers"` makes the engine automatically route UA per-NPC evaluations into the correct map key.

```
moduleStates["erotic"] = {
  sceneActive: false,          // scalar state
  npcLustTiers: {              // map-type state (one value per NPC)
    "npc_mei": "\u840c\u82bd",
    "npc_kai": "\u4f11\u7720"
  },
  __config: { ... }            // reserved, engine-managed
}
```

### 6.3 Reserved Key: `__config`

The key `__config` within a module's state bag is **reserved** for Arcanum-resolved config values. It is populated automatically at session start by `buildModuleConfig()`. Do NOT write to `__config` from hook code.

### 6.4 UA Eval to State Routing

When the UA eval result arrives, `StateManager.applyUtilityAgentEval()` routes module fields to state automatically based on manifest `uaEval` declarations:

- **Top-level fields** (`perNPC: false`): `uaEval.moduleFields[field]` -> `setModuleState(moduleId, mapsTo, value)`
- **Per-NPC fields** (`perNPC: true`): `evaluation.moduleFields[field]` -> `setModuleNPCState(moduleId, mapsTo, npcId, value)`

### 6.5 Snapshot and Rollback

The orchestrator captures state before each turn for error recovery:

#### `captureModuleStatesSnapshot(): Record<string, Record<string, unknown>>`

Deep-copies all `moduleStates` via `JSON.parse(JSON.stringify(...))`. Called as part of `PreTurnSnapshot` creation before processing a turn.

#### `restoreModuleStatesSnapshot(snapshot: Record<string, Record<string, unknown>>): void`

Restores `moduleStates` from a previously captured snapshot via deep-copy. Called on turn failure to roll back all module state changes atomically.

Both methods guarantee deep copies with no shared references, so mutations during a failed turn are safely reversible.

---

## 7. Storage APIs

### 7.1 Milestone Tracking

Milestones are persistent cross-session records that track significant module events per NPC per scenario. Implemented in `src/storage/milestones.ts`.

#### `MilestoneRecord` Type

```typescript
interface MilestoneRecord {
  moduleId: string;      // Owning module
  npcId: string;         // NPC this milestone is about
  scenarioId: string;    // Scenario context
  type: 'firstReach' | 'peak';  // Tracking mode
  field: string;         // Eval field being tracked
  value: unknown;        // The milestone value
  turn: number;          // Turn when this milestone was reached
  sessionId: string;     // Session where this occurred
  timestamp: number;     // Unix timestamp
}
```

#### CRUD Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `addMilestone` | `(record: MilestoneRecord) => Promise<void>` | Persist a new milestone record. |
| `getMilestonesForNPC` | `(moduleId, npcId, scenarioId) => Promise<MilestoneRecord[]>` | Get all milestones for a specific module + NPC + scenario. |
| `hasMilestone` | `(moduleId, npcId, scenarioId, field, type, value?) => Promise<boolean>` | Check existence. For `firstReach`, checks specific value. For `peak`, checks field + type only. |
| `updatePeakMilestone` | `(moduleId, npcId, scenarioId, field, newValue, turn, sessionId, compareTier) => Promise<boolean>` | Update peak if `newValue` is higher. Returns `true` if updated or created. The `compareTier` callback provides ordering logic. |
| `deleteMilestonesByScenario` | `(scenarioId) => Promise<void>` | Delete all milestones for a scenario (cleanup on scenario deletion). |

All functions catch errors internally and call `notifyStorageFailure()` on failure. They never throw -- storage failures degrade gracefully.

### 7.2 Milestone Detection

The `detectMilestones()` function in `src/modules/module-memory.ts` automatically checks for new milestones each turn:

```typescript
function detectMilestones(
  moduleId: string,
  manifest: ModuleManifest,
  npcId: string,
  scenarioId: string,
  currentValue: unknown,
  field: string,
  turn: number,
  sessionId: string,
  existingMilestones: MilestoneRecord[],
): MilestoneRecord[]
```

- **firstReach**: Checks if `currentValue` matches any value in `declaration.values` that has not been previously reached for this NPC + scenario. Each value is recorded at most once.
- **peak**: Creates a new peak record if no peak exists yet and the value is non-default. Peak *updates* (comparing new vs existing) are handled by `updatePeakMilestone()` in storage, which requires an async DB operation.

#### `compareTierValues(field, a, b): number`

Compares two tier values for ordering. Returns positive if `a > b`. Currently supports lust tiers via `LUST_TIERS` array index comparison. Falls back to `String.localeCompare()` for unknown fields. Module authors with custom tier orderings should extend this function by registering their tier arrays.

### 7.3 Critical Event Module Data

When a Critical Event fires, `collectCriticalEventModuleData()` snapshots the fields listed in `memory.criticalEventFields`:

```typescript
function collectCriticalEventModuleData(
  enabledModuleIds: readonly string[],
  npcId: string,
  getModuleState: (moduleId: string, key: string) => unknown,
  getModuleNPCState: (moduleId: string, mapKey: string, npcId: string) => unknown,
): Record<string, Record<string, unknown>>
```

For each enabled module with `criticalEventFields`, it reads each field from state -- respecting `perNPC` declarations -- and returns a map of `moduleId -> { fieldName: value }`. This data is stored alongside the CE record for cross-session reference.

### 7.4 Compression Module Memory

During context compression, `buildCompressionModuleMemory()` collects module state for inclusion in the compression summary:

```typescript
function buildCompressionModuleMemory(
  enabledModuleIds: readonly string[],
  getModuleState: (moduleId: string, key: string) => unknown,
): Record<string, CompressionModuleMemory>
```

Only includes modules whose `compression.includeWhen` state key is truthy. Returns:

```typescript
interface CompressionModuleMemory {
  label: string;                   // Module display name
  data: Record<string, unknown>;   // All declared state field values
  priority: 'high' | 'low';       // Compression priority
}
```

### 7.5 NPC Module Context for UA Input

`buildNPCModuleContext()` gathers current per-NPC module field values for injection into the UA eval input:

```typescript
function buildNPCModuleContext(
  enabledModuleIds: readonly string[],
  npcIds: readonly string[],
  getModuleNPCState: (moduleId: string, mapKey: string, npcId: string) => unknown,
): Record<string, Record<string, unknown>>
```

Returns `{ npcId: { fieldName: currentValue } }`. This tells the UA the current state of each NPC's module fields so it can evaluate changes accurately.

---

## 8. Locale System

Modules use per-module locale files to externalize all user-facing strings. The system is implemented in `src/modules/module-locale.ts` (loader) and `src/modules/manifest-resolver.ts` ($KEY resolver).

### 8.1 `$KEY` Resolution Rules

Any string value in `manifest.json` starting with `$` is a locale reference. During registry initialization (`loadBuiltinManifests()` in `src/modules/registry.ts`):

1. The engine loads `modules/{moduleId}/locale/zh-TW.json` via `getModuleLocaleData(moduleId, 'zh-TW')`
2. `resolveManifest(rawObj, localeData)` deep-walks the entire manifest object
3. Each `$KEY` string is replaced with `localeData[KEY]` (the `$` prefix is stripped)
4. Resolution is recursive -- works through arrays and nested objects at any depth
5. Unresolved keys log a warning (`Unresolved locale key: $KEY_NAME`) and remain as-is

The resolver (`src/modules/manifest-resolver.ts`) handles three value types:
- **Strings starting with `$`** -- replaced with locale value
- **Arrays** -- each element is recursively resolved
- **Objects** -- each value is recursively resolved
- **Other primitives** -- passed through unchanged

### 8.2 Locale File Format

Location: `modules/{moduleId}/locale/{langCode}.json`

The file is a flat JSON object. Values can be:

| Value Type | Purpose | Example |
|-----------|---------|---------|
| **String** | UI labels, descriptions. Merged into global locale provider. | `"HUD_MODULE_EROTIC": "Erotic"` |
| **Array** | Keyword lists, tier names, milestone values. Used for `$KEY` resolution only. | `"EROTIC_ACTIVATION_KEYWORDS": ["\u89aa", "\u543b"]` |
| **Object** | Color maps, tier lookups. Used for `$KEY` resolution only. | `"EROTIC_LUST_TIER_COLORS": { "\u4f11\u7720": "#4a4a5a" }` |

### 8.3 String Merging into UI

At app startup, `loadModuleLocaleStrings(langCode)` extracts only **string-type** values from all module locale files and merges them into the app's locale provider. This makes module-defined labels available via `L.KEY_NAME` throughout the UI code.

Arrays and objects are NOT merged into the locale provider. They are only accessible through `getModuleLocaleData()` for manifest `$KEY` resolution.

### 8.4 Key Naming Convention

Prefix all locale keys with your module ID to avoid collisions across modules:

| Pattern | Purpose | Example |
|---------|---------|---------|
| `HUD_MODULE_{ID}` | HUD pill label | `HUD_MODULE_EROTIC` |
| `MODULE_DESC_{ID}` | Module description | `MODULE_DESC_EROTIC` |
| `STATUS_{ITEM}` | Status window labels | `STATUS_LUST` |
| `{ID}_ACTIVATION_KEYWORDS` | Activation keyword array | `EROTIC_ACTIVATION_KEYWORDS` |
| `{ID}_UA_{FIELD}_DESC` | UA eval field description | `EROTIC_UA_LUST_TIER_DESC` |
| `MODULE_CONFIG_{ID}_{KEY}` | Config field labels | `MODULE_CONFIG_EROTIC_LUST_THRESHOLD` |
| `MODULE_CONFIG_{ID}_{KEY}_DESC` | Config field descriptions | `MODULE_CONFIG_EROTIC_LUST_THRESHOLD_DESC` |
| `CHAR_EXT_{ID}_{FIELD}` | Character extension labels | `CHAR_EXT_EROTIC_TRIGGERS` |
| `{ID}_DICE_UA_INSTRUCTION` | Dice UA instruction | `EROTIC_DICE_UA_INSTRUCTION` |

### 8.5 Adding a New Language

Create `modules/{moduleId}/locale/{langCode}.json` with the same keys. The Vite glob `'../../modules/*/locale/*.json'` discovers it automatically from `src/modules/module-locale.ts`. Use `getAvailableModuleLanguages()` to enumerate all discovered language codes.

---

## 9. Prompt Architecture

The system prompt is assembled by `assembleSystemPrompt()` in `src/orchestrator/module-injector.ts`. It uses a **three-block architecture** optimized for API prompt caching.

### 9.1 Block Overview

| Block | Cache Behavior | Content Stability | Claude Cost | Gemini Behavior |
|-------|---------------|-------------------|-------------|-----------------|
| **Block 1** (Immutable) | Always cache-hit | Never changes within a session | 10% (cached) | Part of `CachedContent` |
| **Block 2** (Semi-stable) | Usually cache-hit | Changes on compression, level-up, CE, profile update | 10% when cached | Combined with Block 1 in `CachedContent` |
| **Block 3** (Dynamic) | Never cached | Changes every turn | 100% (full price) | Always full price |

### 9.2 Block 1 -- Immutable (Session-Locked)

Contents (assembled in order):
1. `core.md` -- narrative engine rules (always loaded)
2. Player character -- persona + scenario identity/backstory
3. Scenario JSON -- the scenario overview
4. Arcanum world framework -- pre-formatted text from active Arcanum
5. **Module prompts with `block: 1`** -- e.g., `erotic.md`

**Design note:** The erotic module prompt is always loaded in Block 1 even though `alwaysLoad: false`. The engine always loads it because the prompt contains internal LLM-side gating conditions (e.g., "only activate when Lust >= threshold"). Always-loading at 10% cached cost eliminates erotic toggle as a Block 1/2 cache buster entirely.

### 9.3 Block 2 -- Semi-Stable

Changes infrequently (every 5-25 turns). Contents:
- `first_turn.md` (T1 only, removed after T1 -- one-time cache invalidation)
- Player traits (change on level-up, ~every 5-10 turns)
- NPC identities, backstories, and NPC traits (change on profile update, ~every 15-25 turns)
- **Module character extensions** -- trigger fields, profile fields (step 2g2)
- Absent NPC minimal references
- Cross-scenario CEs
- Context recap (compression output, every 8-10+ turns)
- Promoted lore entries (persistent world facts)
- Narrative restriction rules (from scenario)

### 9.4 Block 3 -- Dynamic (Per-Turn)

Changes every turn. Contents:
- Output guidance (length + intensity, varies by UA eval)
- Critical Events (tiered injection: essential always, supplementary for in-scene NPCs)
- `commands.md` (conditional: only when input starts with RECALL)
- NPC state blocks (affection tier, hype, module status items)
- NPC-to-NPC interaction hints
- Dice roll results (from `resolveRoll` hook output)
- Active quests
- Scene context
- Module dynamic prompts (from `getDynamicPrompt` hook, CONCAT merged)
- Dynamic lore entries (keyword-triggered, budget-constrained)
- Turn injection (`[SYSTEM: Current Turn = T{N}]`)

### 9.5 `prompt.md` vs `stub.md` Interaction

| Module State | File Loaded | Purpose |
|-------------|-------------|---------|
| `active` | `prompt.md` | Full instructions -- complete rules, tier definitions, narrative guidance |
| `afterglow` | `prompt.md` | Full prompt persists for continuity during deactivation wind-down |
| `dormant` | `stub.md` | Minimal placeholder -- acknowledges module exists without spending tokens |

For Block 1 modules, the prompt is session-locked and always present. Activation gating is embedded in the prompt text itself (the LLM reads internal conditions).

### 9.6 Afterglow

When a module deactivates, it enters `afterglow` state for up to `maxAfterglow` turns. During afterglow, the full `prompt.md` remains loaded to maintain narrative continuity (e.g., a scene's erotic tone should fade naturally, not cut abruptly). After the counter expires, the module reverts to `stub.md`.

### 9.7 Caching Guidelines for Module Authors

- **Block 1** (`block: 1`): Best for content that is truly session-locked. The prompt should contain internal gating conditions so it can be always-loaded without side effects. Maximum caching benefit.
- **Block 2** (`block: 2`): For content that depends on NPC profiles or compression state but not per-turn data. Changes invalidate this block's cache, so minimize dependencies on frequently-changing data.
- **Block 3**: Not assigned via manifest `block` field. Instead, inject per-turn content through the `getDynamicPrompt` hook. Every token in Block 3 is full-price every turn -- keep injections concise.

---

## 10. Character Extension

Modules can add NPC-specific data fields that appear in the character editor UI and inject into the system prompt alongside NPC identity.

### 10.1 `ManifestCharacterExtension` Type

```typescript
interface ManifestCharacterExtension {
  triggerFields: CharacterExtensionField[];    // Activation-related NPC data
  profileFields: CharacterExtensionField[];    // Narrative/profile NPC data
  triggerInjectionLabel: string;               // Prompt label for trigger data
  profileInjectionLabel: string;               // Prompt label for profile data
}
```

### 10.2 `CharacterExtensionField` Type

```typescript
interface CharacterExtensionField {
  key: string;                              // Storage key within extension data
  type: 'tags' | 'textarea' | 'text';      // Form field type in UI
  label: string;                            // Locale key for field label
  hint?: string;                            // Locale key for placeholder/hint
  maxTokens?: number;                       // Token budget for textarea content
}
```

### 10.3 Form Field Types

| Type | UI Element | Use Case |
|------|-----------|----------|
| `tags` | Tag input (comma-separated tokens) | Keywords, triggers, short identifiers |
| `textarea` | Multi-line text area | Descriptions, preferences, boundaries |
| `text` | Single-line text input | Short values, names |

### 10.4 Trigger Fields vs Profile Fields

| Category | Purpose | Prompt Injection | Additional Behavior |
|----------|---------|------------------|---------------------|
| **Trigger fields** | Per-NPC activation conditions | Wrapped in `triggerInjectionLabel` (e.g., `[Erotic Triggers]`) | `tags`-type trigger keywords merge with manifest `activation.keywords` via `getActivationKeywords()` |
| **Profile fields** | Per-NPC narrative data | Wrapped in `profileInjectionLabel` (e.g., `[Erotic Profile]`) | Injected into Block 2 alongside NPC identity |

### 10.5 Storage and Injection Flow

Character extension data is stored on the NPC profile record. During Block 2 assembly (step 2g2), the module injector:

1. Iterates enabled modules with `characterExtension` declarations
2. For each NPC profile, reads stored extension data
3. Formats trigger and profile fields under their respective injection labels
4. Appends the formatted blocks to the NPC's Block 2 section

### 10.6 Erotic Module Example

```json
"characterExtension": {
  "triggerFields": [
    { "key": "keywords", "type": "tags", "label": "CHAR_EXT_EROTIC_TRIGGERS" },
    { "key": "conditions", "type": "textarea", "label": "CHAR_EXT_EROTIC_CONDITIONS", "maxTokens": 50 }
  ],
  "profileFields": [
    { "key": "preferences", "type": "textarea", "label": "CHAR_EXT_EROTIC_PREF" },
    { "key": "boundaries", "type": "textarea", "label": "CHAR_EXT_EROTIC_BOUNDS" },
    { "key": "physicalTraits", "type": "textarea", "label": "CHAR_EXT_EROTIC_PHYS" }
  ],
  "triggerInjectionLabel": "[Erotic Triggers]",
  "profileInjectionLabel": "[Erotic Profile]"
}
```

This produces prompt output like:
```
[Erotic Triggers]
keywords: ..., ...
conditions: ...

[Erotic Profile]
preferences: ...
boundaries: ...
physicalTraits: ...
```

---

## 11. Dice System

Modules can integrate dice mechanics through a four-stage pipeline: UA request -> dice engine -> module hook -> prompt injection.

### 11.1 Types

#### `DieType` and `CompareOp`

```typescript
type DieType = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100';
type CompareOp = 'gte' | 'lte' | 'eq' | 'gt' | 'lt';
```

#### `RollRequest` -- What the UA Returns

```typescript
interface RollRequest {
  die: DieType;            // Which die to roll
  count?: number;          // Number of dice (default 1)
  stat?: string;           // Optional stat modifier name
  dc: number;              // Difficulty class (target number)
  compare?: CompareOp;     // How total is compared to DC (default 'gte')
  advantage?: boolean;     // Roll twice, take higher
  disadvantage?: boolean;  // Roll twice, take lower
  reason: string;          // Why this roll is happening (narrative context)
}
```

#### `DiceResult` -- What the Dice Engine Produces

```typescript
interface DiceResult {
  rolls: number[];         // Raw individual die values
  chosen: number;          // Selected value (after advantage/disadvantage)
  modifier: number;        // Stat modifier applied
  total: number;           // chosen + modifier
  dc: number;              // Target DC
  compare: CompareOp;      // Comparison operator used
  success: boolean;        // Whether total meets DC via compare
}
```

#### `RollResolution` -- What the Module's `resolveRoll` Hook Returns

```typescript
interface RollResolution {
  promptInjection: string;                   // Text injected into next system prompt (Block 3)
  displayText: string;                       // Text shown in chat UI to player
  stateUpdates?: Record<string, unknown>;    // Optional module state changes
}
```

#### `DiceDisplayItem` -- Full Pipeline Transport

```typescript
interface DiceDisplayItem {
  moduleId: string;          // Which module owns this roll
  request: RollRequest;      // Original UA request
  result: DiceResult;        // Engine roll output
  resolution: RollResolution; // Module's interpretation
}
```

### 11.2 `ManifestDiceConfig`

```typescript
interface ManifestDiceConfig {
  /** Instruction injected into UA eval prompt when module is enabled. Use $KEY. */
  uaInstruction: string;
  /** Default die type for this module's rolls. */
  defaultDie: DieType;
  /** Default DC if UA doesn't specify. */
  defaultDC: number;
}
```

**Erotic module example:**
```json
"diceRolls": {
  "uaInstruction": "$EROTIC_DICE_UA_INSTRUCTION",
  "defaultDie": "d20",
  "defaultDC": 12
}
```

The `uaInstruction` locale value tells the UA when and how to request rolls:
> "When an erotic encounter involves uncertainty (seduction attempt, resistance, escalation), request a d20 roll with DC based on difficulty (easy=8, medium=12, hard=16)."

### 11.3 Pipeline Flow

1. **UA requests a roll** -- The UA includes roll parameters in its eval output, guided by the module's `diceRolls.uaInstruction`.
2. **Dice engine rolls** -- The app's dice engine generates random values, applies advantage/disadvantage, computes total, and checks against DC.
3. **Module resolves** -- `dispatchResolveRoll(moduleId, diceResult, rollRequest, getHooks, getState)` calls the owning module's `resolveRoll` hook (SINGLE dispatch).
4. **Prompt injection** -- `RollResolution.promptInjection` is added to Block 3 of the next turn's system prompt.
5. **UI display** -- `RollResolution.displayText` is shown in the chat panel as a dice result message.
6. **State updates** -- Optional `stateUpdates` are applied to the module's state bag.

---

## 12. Module Agent Design Pattern

When a module requires LLM-driven decision-making (e.g., combat resolution, puzzle evaluation, social negotiation), it uses a **module agent** -- a specialized LLM call separate from the Main Session. All module agents follow one strict architectural rule:

### 12.1 The Cardinal Rule: Structured Output Only

> **Module agents output ONLY structured/mechanical JSON. They NEVER produce narrative prose. The Main Session LLM is the sole narrative voice.**

This is a non-negotiable design principle that applies to ALL module agents and subagents:

| Agent Type | Outputs | Does NOT Output |
|-----------|---------|----------------|
| Combat Agent | Enemy actions, damage numbers, HP changes, flags | Battle narration, dialogue, descriptions |
| Utility Agent | Hype/Lust tiers, affection deltas, status JSON | Story commentary, scene prose |
| Dice Agent | Roll triggers, modifier sources, advantage/disadvantage | Roll drama, narrative tension |
| Future Puzzle Agent | Progress %, hint flags, success/failure state | Puzzle narration, reveal descriptions |
| Future Social Agent | Persuasion score, NPC disposition shift, outcome flag | Conversation prose, NPC dialogue |

### 12.2 Why This Separation Matters

1. **Reliable parsing** -- JSON is deterministically parseable. Narrative prose mixed with data causes truncation, format drift, and parse failures.
2. **Token efficiency** -- Agent calls use small/fast models with low maxTokens (1000-2000). Narrative would bloat token usage for no mechanical gain.
3. **Consistent voice** -- One narrative voice (Main Session) ensures tonal consistency. Multiple agents writing prose creates jarring style shifts.
4. **Testability** -- Structured output can be unit-tested against schemas. Prose cannot.

### 12.3 How Results Reach the Narrative

The orchestrator injects agent results into Main Session context as `[SYSTEM]` blocks:

```
[SYSTEM: Combat Resolution]
Scene roll: 8 (success). Player faction efficacy: 5-8.
Enemy: goblin_1 (mob, HP 3/8) — slash → player, 4 dmg
Enemy: goblin_2 (mob, HP 8/8) — missed
Player faction dealt 6 total damage. goblin_1 defeated.
[/SYSTEM]
```

Main Session reads this structured summary and weaves it into narrative prose with the scenario's tone, the NPCs' voices, and the player's actions.

### 12.4 Agent Prompt Template

Every module agent prompt MUST:

1. Open with role declaration: "You are a pure mechanics resolver for [domain]."
2. Specify JSON schema with examples
3. State that descriptions/notes are short mechanical labels, not prose
4. End with: **"CRITICAL: Output ONLY raw JSON. No markdown, no headers, no prose, no explanation. Start with `{` and end with `}`."**

### 12.5 Naming Convention for Generated Entities

When agents generate temporary entities (enemies, random NPCs, environmental objects), use **descriptive prefixes** based on visual or behavioral traits — never generic suffixes or arbitrary proper names.

| ✅ Good | ❌ Bad |
|--------|-------|
| 刀疤哥布林 (scarred goblin) | 哥布林A (goblin A) |
| 肥哥布林 (fat goblin) | 哥布林1 (goblin 1) |
| 獨眼強盜 (one-eyed bandit) | 強盜乙 (bandit B) |
| 跛腳狼 (limping wolf) | 狼約翰 (wolf John) |

This ensures entities are immediately distinguishable in both structured data and narrative prose without requiring the Main Session to invent names.

### 12.6 Agent Parser Requirements

Every agent response parser MUST:

1. Call `stripCodeFences()` first
2. Use brace-depth tracking to extract the outermost `{...}` JSON object
3. Implement truncation salvage (close unclosed brackets) for token-budget edge cases
4. Log warnings with first 300 chars on parse failure
5. Return `null` on failure -- never crash
6. The orchestrator handles `null` gracefully (skip module updates, preserve previous state)

---

## 13. Arcanum Integration Standard

Arcanum is the world-building and mod-loading layer. Modules interact with it through well-defined interfaces. The engine mediates all Arcanum-module integration -- modules never reference Arcanum types directly.

### 12.1 Config Schema = Mod API Surface

Every module's `config` section is its public API for Arcanum overrides. The Arcanum workshop UI reads `getAllConfigSchemas()` to present all available tuning parameters across all modules. Each field's `label` and `description` (both locale keys) are displayed to help scenario authors understand what they can adjust.

### 12.2 Rule Resolver

Arcanum rules (`ArcanumRule[]`) are natural-language statements authored by users. Each rule has a `text` (the rule content) and a `priority` (`'module'`, `'scenario'`, or `'global'`). The rule resolution pass:

1. Calls `getAllConfigSchemas()` to get every module's config fields
2. For **config-patch rules**: matches rule text against config field descriptions, produces concrete overrides stored in `ArcanumRecord.moduleOverrides: Record<string, Record<string, unknown>>`
3. For **prompt-type rules**: injects rule text directly into Block 1 as part of the Arcanum world framework text
4. The `description` field on `ModuleConfigField` helps the LLM-assisted resolver understand what each parameter controls

### 12.3 X-Card Overrides

X-cards (`ArcanumRecord.xCards: string[]`) are absolute blacklist items functioning as a TTRPG safety tool:

- X-card content is never generated regardless of module state or config
- X-cards override ALL modules, ALL scenarios, and ALL rules
- They take absolute priority in the prompt hierarchy
- No Arcanum rule or module config can override an x-card

### 12.4 Module Override Flow

```
ArcanumRecord.moduleOverrides
       |
       v
buildModuleConfig(moduleId, overrides)    <-- src/modules/registry.ts
       |
       v
validateConfigValue(field, value)         <-- type check + min/max clamp
       |
       v
moduleState.__config                      <-- written at session start
       |
       v
readConfig() in hook code                 <-- read at runtime
```

At session start:
1. The active Arcanum's `moduleOverrides` are loaded
2. `buildModuleConfig()` resolves each config key: override (validated + clamped) or manifest default
3. The resolved config object is written to `moduleState.__config` via `setModuleState(moduleId, '__config', configObj)`
4. Hook code reads from `__config` with fallbacks for the entire session

### 12.5 Workshop Agent Integration

The Arcanum workshop AI assistant receives all module config schemas. When a user writes a natural-language rule, the assistant can:
- Suggest which config parameters to modify
- Validate that proposed values fall within `min`/`max` bounds
- Distinguish between config-patch rules and prompt-type rules
- Present available parameters with their `description` text

### 12.6 Prompt-Type Rules in Block 1

Arcanum rules that do not map to config patches are injected as prompt directives. These go into Block 1 as part of the Arcanum world framework text, making them session-locked and cached. Module `config` is strictly for **behavioral tuning** (numbers, booleans, strings). Narrative directives go through prompt-type rules.

### 12.7 Guidelines for Arcanum-Friendly Modules

1. Write clear `description` strings for every config field -- they guide both users and the AI workshop assistant in understanding what can be tuned
2. Set reasonable `min`/`max` bounds on numeric configs to prevent game-breaking overrides
3. Use descriptive `label` locale keys that make sense in the workshop UI context
4. Keep config fields focused on gameplay tuning parameters, not structural values
5. Ensure the module functions correctly at all valid config values within the declared bounds
6. Document expected behavior at boundary values (min and max) in the description

---

## 14. Complete Template

Copy these files to create a new module. Replace `mymodule` with your module ID (lowercase, no spaces). Replace `MyModule` with your display name. Replace `MYMODULE` with your locale key prefix.

### 13.1 `modules/mymodule/manifest.json`

```json
{
  "id": "mymodule",
  "name": "$MYMODULE_NAME",
  "description": "$MYMODULE_DESC",
  "version": "1.0.0",
  "enabledByDefault": false,

  "prompt": {
    "file": "prompt.md",
    "stub": "stub.md",
    "block": 1,
    "alwaysLoad": false,
    "maxAfterglow": 3
  },

  "activation": {
    "keywords": "$MYMODULE_ACTIVATION_KEYWORDS",
    "uaFlag": "mymoduleActive"
  },

  "state": {
    "mymoduleActive": { "type": "boolean", "default": false }
  },

  "uaEval": [
    {
      "field": "mymoduleActive",
      "type": "boolean",
      "description": "$MYMODULE_UA_ACTIVE_DESC",
      "mapsTo": "mymoduleActive",
      "readWhen": "enabled"
    }
  ],

  "tokens": {
    "inputEstimate": 500,
    "outputRecommendation": 0,
    "statusExtractPerNPC": 0,
    "statusExtractBase": 0
  },

  "ui": {
    "hudPill": {
      "label": "MYMODULE_NAME",
      "activeClass": "active-mymodule",
      "activeWhen": "mymoduleActive"
    },
    "statusItems": []
  },

  "memory": {
    "criticalEventFields": [],
    "compression": {
      "includeWhen": "mymoduleActive",
      "priority": "low"
    },
    "milestones": []
  },

  "config": {
    "exampleThreshold": {
      "type": "number",
      "default": 5,
      "min": 1,
      "max": 10,
      "label": "MYMODULE_CONFIG_THRESHOLD",
      "description": "MYMODULE_CONFIG_THRESHOLD_DESC"
    }
  },

  "conflicts": [],
  "requires": []
}
```

### 13.2 `src/modules/builtins/mymodule-hooks.ts`

```typescript
// ============================================================
// DogeChat Engine -- MyModule Hooks
// ============================================================

import type { ModuleHooks } from '../types';

/** Read a config value from moduleState.__config with fallback. */
function readConfig<T>(moduleState: Record<string, unknown>, key: string, fallback: T): T {
  const config = moduleState.__config as Record<string, unknown> | undefined;
  if (config && key in config) return config[key] as T;
  return fallback;
}

export const mymoduleHooks: ModuleHooks = {
  shouldEscalate: (_uaEval, moduleState) => {
    return moduleState.mymoduleActive === true;
  },

  getIntensity: (_uaEval, moduleState) => {
    if (moduleState.mymoduleActive) return 'escalated';
    return null;
  },

  getDynamicPrompt: (moduleState, _gameState) => {
    if (moduleState.mymoduleActive === true) {
      return '[Module: MyModule -- Active. Apply module-specific narrative guidance.]';
    }
    return null;
  },

  resolveRoll: (diceResult, rollRequest, _moduleState) => {
    const success = diceResult.success;
    return {
      promptInjection: `[Dice: ${rollRequest.reason} -- ${success ? 'SUCCESS' : 'FAILURE'} (${diceResult.total} vs DC${diceResult.dc})]`,
      displayText: `${rollRequest.die} -> ${diceResult.total} vs DC${diceResult.dc} -- ${rollRequest.reason}`,
      stateUpdates: {},
    };
  },

  onSceneChange: (moduleState, _prevScene, _newScene) => {
    return { ...moduleState, mymoduleActive: false };
  },

  onTurnEnd: (moduleState, _gameState, _uaEval) => {
    return moduleState;
  },

  onSessionStart: (_moduleState, _scenarioData) => {
    return { mymoduleActive: false };
  },
};
```

### 13.3 `modules/mymodule/locale/zh-TW.json`

```json
{
  "MYMODULE_NAME": "MyModule",
  "MYMODULE_DESC": "Module description in Traditional Chinese.",

  "MYMODULE_ACTIVATION_KEYWORDS": [],

  "MYMODULE_UA_ACTIVE_DESC": "Is the MyModule subsystem currently active? Output true/false.",

  "MYMODULE_CONFIG_THRESHOLD": "Example Threshold Label",
  "MYMODULE_CONFIG_THRESHOLD_DESC": "Description of what this threshold controls."
}
```

### 13.4 `modules/mymodule/prompt.md`

```markdown
## MyModule Rules

[Full module instructions for the LLM. Describe mechanics, tone guidance,
and narrative rules. This content is loaded when the module is active or
in afterglow state.]

[If using Block 1 with alwaysLoad:false, include internal gating conditions
so the LLM knows when to apply these rules vs. ignore them.]
```

### 13.5 `modules/mymodule/stub.md`

```markdown
[MyModule is dormant. No special rules apply.]
```

---

## Appendix: Type Import Paths

| Type / Function | Import Path |
|----------------|-------------|
| `ModuleManifest`, `ModuleHooks`, `ModuleConfigField`, `ModuleLoadState`, `RollRequest`, `DiceResult`, `RollResolution`, `DiceDisplayItem`, `MilestoneRecord`, `MilestoneDeclaration`, `ManifestPromptConfig`, `ManifestActivation`, `ManifestStateField`, `ManifestUAEvalField`, `ManifestTokens`, `ManifestUI`, `HudPillDeclaration`, `StatusItemDeclaration`, `ModuleMemoryConfig`, `CompressionConfig`, `ManifestCharacterExtension`, `CharacterExtensionField`, `ManifestDiceConfig`, `ModuleRuntimeState` | `src/modules/types` |
| `GameState`, `UAEvalResult`, `SceneContext`, `ModulesState` | `src/state/types` |
| `getModule`, `getAllModules`, `getModuleHooks`, `registerModule`, `unregisterModule`, `clearRegistry`, `getActivationKeywords`, `getDefaultEnabledModules`, `getModulePromptPath`, `getModuleStubPath`, `getModuleConfig`, `getModuleConfigSchema`, `getAllConfigSchemas`, `buildModuleConfig`, `validateManifest`, `loadBuiltinManifests`, `initRegistry` | `src/modules/registry` |
| `dispatchShouldEscalate`, `dispatchGetIntensity`, `dispatchGetDynamicPrompt`, `dispatchResolveRoll`, `dispatchOnSceneChange`, `dispatchOnTurnEnd`, `dispatchOnSessionStart` | `src/modules/hook-dispatcher` |
| `collectEvalFields`, `buildEvalPromptFieldSection`, `buildNPCModuleContext`, `collectCriticalEventModuleData`, `buildCompressionModuleMemory`, `detectMilestones`, `compareTierValues`, `CollectedEvalField`, `CompressionModuleMemory` | `src/modules/module-memory` |
| `resolveManifest` | `src/modules/manifest-resolver` |
| `loadModuleLocaleStrings`, `getModuleLocaleData`, `getAvailableModuleLanguages` | `src/modules/module-locale` |
| `addMilestone`, `getMilestonesForNPC`, `hasMilestone`, `updatePeakMilestone`, `deleteMilestonesByScenario` | `src/storage/milestones` |
| `ArcanumRecord`, `ArcanumRule`, `ArcanumRulePriority`, `LoreEntry`, `ArcanumSettings` | `src/arcanum/types` |
| `assembleSystemPrompt`, `AssemblyParams`, `AssemblyResult`, `loadModuleFile` | `src/orchestrator/module-injector` |
