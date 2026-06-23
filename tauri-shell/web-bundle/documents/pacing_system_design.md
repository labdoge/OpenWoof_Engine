# Pacing System Design - Legacy Scene-Importance Injection

**Status: Legacy compatibility path** (implemented 2026-04; deprecated by Mission System v2 Phase 5 on 2026-05-09)

Mission System v2 makes **Ambient Affection Missions** the default ambience / NPC-first hook runtime. The legacy pacing event system remains readable and runnable for backward compatibility, especially when `missions.ambient_affection.enabled === false` or Ambient Missions are globally disabled.

## Overview

Pacing events inject background flavor or optional skippable events into the narrative. In the legacy path the system is **UA-driven**: the Utility Agent evaluates every turn whether any pacing driver fits the current scene, gated by `sceneImportance`.

By default, when Ambient Missions are enabled, the orchestrator does **not** send regular `pacingContext` to the Utility Agent. Existing `pacing_drivers` are instead passed into Ambient Mission generation as **legacy ambient seeds**.

No counter, no threshold, no window. UA decides per-turn.

## Injection Formats

| Format | Description | When Allowed |
|--------|-------------|-------------|
| `background_flavor` | Ambient detail (weather, crowd noise, background NPC activity). Player never needs to react. | routine, notable |
| `optional_event` | Noticeable but skippable occurrence (stranger approaches, sound from another room). Player can engage or ignore. | routine only |

**Climactic scenes** receive no pacing injection — the story is already dramatic enough.

## UA Decision Process (per turn)

1. **CONTEXT FIT**: Is any driver's trigger object/condition/character present or naturally introducible? → NO = skip
2. **VITAL NPC GUARD**: Would injection interrupt a meaningful interaction with a vital NPC? → YES = skip
3. **FORMAT**: Pick format allowed by current `sceneImportance`
4. **NARRATE**: 1-2 sentence Traditional Chinese narration seed

UA outputs `pacingEvent` only if all checks pass. Omits the field entirely to skip.

## Orchestrator Safety Net

After receiving UA's `pacingEvent`, the orchestrator validates `format` against `PACING_ALLOWED_FORMATS[sceneImportance]`. If the UA returns a format not allowed for the current importance level, the event is silently dropped.

## Block 3 Injection Tags

- `background_flavor` → `[AMBIENT — {triggerType}] Weave into scene atmosphere: {narration}`
- `optional_event` → `[PACING EVENT — {triggerType}] {direction}\nNarration seed: {narration}\n(Player may engage or ignore.)`

## Pacing Driver Pool (Reusable Directions, Legacy Seeds)

Pacing drivers are **thematic directions**, not one-shot scripts. They form a reusable pool:

- UA picks the best-fit driver based on current scene context + trigger type conditions
- The **same driver can fire multiple times** across a session with different narration each time
- No "fired/unfired" tracking — they are perpetual options
- Mission System v2 also reads this pool as Ambient Mission generation hints, preserving scenario and module hook compatibility.

### Trigger Types

| Type | Nature |
|------|--------|
| `npc_initiative` | NPC-driven dramatic moment |
| `opportunity` | Relationship milestone opportunity |
| `environmental` | Neutral world event, scene shift |

### Data Shape

```typescript
interface PacingDriver {
  triggerType: 'environmental' | 'opportunity' | 'npc_initiative';
  direction: string;        // thematic direction, ≤80 chars
  minAffection?: number;    // optional: only available after this %
}
```

### Sources

1. **Scenario**: `scenarioJson.pacing_drivers[]`
2. **Modules**: contributed via `dispatchGetPacingDrivers()` hook

Scenario `pacing_drivers[]` may include an optional `affectionGate: 30 | 50 | 70 | 90`. For Ambient Mission generation this is a minimum unlock gate against the target NPC's current affection. Missing or `null` remains legacy unrestricted behavior. Legacy pacing UA fallback keeps using the full driver pool; gate filtering is only applied before targeted Ambient Mission option generation.

## Bottleneck Quest Directions

At affection gates (30/50/70/90%), Mission System v2 generates **Bottleneck Breakthrough Mission** options:

- The picker presents the scenario-configured number of player-facing options (`missions.ambient_affection.optionCount`, default 3).
- Directions should come primarily from `missions.bottleneck_quests.directions[]`.
- Legacy `bottleneck_quest_directions[]` and module `getBottleneckQuestDirections()` contributions remain fallback/compatibility inputs.
- Scenario-linked directions may include `npcSlotId`, `affectionGate`, `storyAxis`, `relationshipAxis`, `suggestedAction`, and `suggestedHooks`.
- Completion is strict and evaluated separately from Ambient Affection Missions.

Bottleneck Breakthrough Missions are **separate from pacing**. They always fire when the affection gate needs a breakthrough, regardless of the Ambient Mission or legacy pacing toggle.

## Global Toggle and Migration

- New setting: `ambientMissionsEnabled: boolean` (default: migrated from `PACING_EVENTS_ENABLED`, otherwise `true`)
- Legacy setting: `PACING_EVENTS_ENABLED` is retained and mirrored during the migration window.
- When Ambient Missions are enabled: no regular pacing context is sent to UA.
- When Ambient Missions are disabled and legacy pacing remains enabled: pacing context is sent to UA as before.
- Bottleneck quests still fire (core progression)

## Constants

```typescript
PACING_FORMATS = ['background_flavor', 'optional_event'] as const;
PACING_ALLOWED_FORMATS: Record<SceneImportance, readonly PacingFormat[]> = {
  routine: ['background_flavor', 'optional_event'],
  notable: ['background_flavor'],
  climactic: [],
};
```

## Implementation Notes

- Pacing drivers: stored in scenario JSON + module hooks, built at session start, also used as Ambient Mission seeds
- Toggle: stored via settings store (global), with old localStorage/Tauri setting migration preserved
- No per-turn state accumulation — each turn is a fresh UA evaluation
- Token cost: ~150-300 input tokens (driver list) + ~80 output tokens (pacingEvent JSON) per turn when enabled
