# Combat v2 System Design

**Date:** 2026-06-11  
**Status:** Active authority. Supersedes Combat v1 HP/SP/Combat Agent/Dice Agent design.  
**Runtime scope:** Local client and Tauri desktop app. No backend. No new dependency.

Combat v2 is a client-authoritative side-level resolver. LLM agents may suggest roster, target intent, trait relevance, and narration, but the client owns force, threshold, pressure, dice, incapacitation, persistence, HUD state, and endgame trigger.

---

## 1. Design Goals

1. **Faster scenes.** Combat should resolve in a few turns without individual HP bookkeeping.
2. **Zero LLM/client drift.** Main Session narrates the client result block. It never invents HP, extra knockouts, force changes, or end states.
3. **Side-level narration.** Narration follows side force and pressure changes, not a private per-actor damage timeline.
4. **Targeting remains meaningful.** If the player clearly attacks a specific enemy, targeted flow pauses default KO routing for that player-side damage.
5. **No fatality assumption.** Client marks `incapacitated` only. Death, surrender, capture, retreat, or rescue is narration.

---

## 2. Core State

```ts
type CombatV2Side = 'player' | 'enemy';
type CombatV2EndgameMode = 'rescue_twist' | 'game_over';

interface CombatantV2 {
  id: string;
  name: string;
  side: CombatV2Side;
  type: 'player' | 'essential_npc' | 'temporary_ally' | 'boss' | 'elite' | 'mob' | 'minion';
  force: number;
  threshold: number;
  diceBase: number;
  status: 'active' | 'incapacitated' | 'fled' | 'surrendered';
  tags: string[];
  sourceEntityId?: string;
}

interface CombatV2State {
  active: boolean;
  round: number;
  combatants: Record<string, CombatantV2>;
  sidePressure: Record<CombatV2Side, number>;
  targetPressure: Record<string, number>;
  lastResolution?: CombatV2LastResolution;
  endgameMode: CombatV2EndgameMode;
}
```

Invariant: **`force === threshold` for every combatant.** This avoids the old edge case where side force reaches zero while a final character is not knocked out.

---

## 3. Force And Threshold

The client ignores LLM-provided stats. All stats come from type formulas.

| Type | Force and Threshold |
|------|---------------------|
| `player` | `20 + ((level - 1) * 5)`, level minimum 1 |
| `essential_npc` | `ceil(10 + 10 * (1 + ((clamp(affection, -100, 100) / 100) * 0.5)))` |
| `boss` | `35` |
| `elite` | `14` |
| `temporary_ally` | `10` |
| `mob` | `8` |
| `minion` | `4` |

Essential NPC examples:

| Affection | Force |
|-----------|-------|
| `-100` | `15` |
| `0` | `20` |
| `50` | `23` |
| `100` | `25` |

---

## 4. Dice

Damage is the sum of all rolled d6.

| Type | Dice |
|------|------|
| `player` | `2d6 + accountableTraitCount d6` |
| `essential_npc` | `2d6 + accountableTraitCount d6` |
| `boss` | `4d6` |
| `elite` | `3d6` |
| `mob` | `2d6` |
| `temporary_ally` | `2d6` |
| `minion` | `1d6` |

Traits are unlimited and not consumed. EA may propose any number of `accountedTraitIds`; client validates the IDs against existing player and active essential NPC traits. Invalid IDs are ignored with a warning.

Enemies and non-essential NPCs do not use trait dice.

---

## 5. Default KO Flow

When player-side damage does not specify a valid target, damage goes to enemy `sidePressure`. When enemy-side damage resolves, damage goes to player `sidePressure`.

Default knockout order:

1. Lowest force first.
2. Non-essential before player or essential NPC on the same side.
3. Deterministic `id` tie-breaker.

Resolution:

1. Add damage to the victim side pressure.
2. Find the default KO target.
3. If pressure is at least target threshold, mark that combatant `incapacitated`.
4. Subtract the target threshold from side pressure.
5. Continue checking. One high roll can cause consecutive knockouts.

Overflow remains as side pressure. This makes near-misses carry forward without tracking individual HP.

---

## 6. Targeted KO Flow

If player input clearly names a valid active enemy target, targeted flow activates for player-side damage only.

Rules:

1. Player-side damage goes to `targetPressure[targetId]`.
2. Default enemy-side KO routing is paused for that damage.
3. If target pressure reaches target threshold, only that target is incapacitated.
4. Overflow does not spill into side pressure or other combatants.
5. Enemy-side damage still resolves against player side pressure by default.

This preserves the player fantasy of focusing the boss, while preventing one named-target hit from accidentally wiping nearby minions.

---

## 7. Runtime Flow

### Init

1. UA emits `combat:init` with severity and context.
2. Scene Ops may support roster drafting with names, side hints, type hints, and temporary ally suggestions.
3. Client generates or normalizes combatants.
4. Client builds `CombatV2State` under module state key `combatV2`.
5. Client ignores LLM-provided HP, force, threshold, dice, or endgame decisions.

### Ongoing

1. EA parses player action, optional target, and optional accountable trait IDs.
2. Client validates target and trait IDs.
3. Client rolls both sides.
4. Client applies cheat/mode modifiers.
5. Client resolves targeted or default KO.
6. Client recalculates side force, persists state, updates HUD.
7. Client injects `[SYSTEM: Event Resolution -- combat v2]` for Main Session narration.

### End

Combat ends when:

1. Enemy side has no active combatants.
2. Player team defeat triggers endgame.
3. UA emits a high-confidence surrender, retreat, or negotiated end accepted by client validation.
4. PLOT override explicitly ends combat.

---

## 8. Endgame

Endgame only runs when the combat module is enabled and combat is active.

Player team defeat means:

1. The player combatant is incapacitated.
2. All present essential NPC combatants are incapacitated.
3. Temporary allies do not count.

Scenario JSON:

```json
{
  "combat": {
    "partyKnockout": "rescue_twist"
  }
}
```

Modes:

| Mode | Behavior |
|------|----------|
| `rescue_twist` | Default for old or missing scenarios. Clear combat and inject a safe rescue transition. |
| `game_over` | Set terminal combat outcome state and show Game Over UI. |

Scene Ops may provide a rescue or aftermath digest, but never decides whether endgame triggers.

---

## 9. Cheat Setting

Cog menu setting:

```ts
STORAGE_KEYS.COMBAT_ENEMY_HALF_DAMAGE
```

When enabled, enemy outgoing damage to player side is `floor(damage / 2)`.

Rules:

1. Persistent local setting.
2. Affects enemy outgoing damage only.
3. Player and allied damage is unchanged.
4. Combat HUD and resolution block show the cheat indicator when active.

---

## 10. HUD

Combat HUD v2 shows:

1. Two side lanes: player side and enemy side.
2. `forceCurrent / forceMax`.
3. Side pressure.
4. Last roll damage.
5. Combatant chips with type, force, status, target marker, and KO state.
6. Turn result strip with round, dice pool, trait dice count, KO list, and cheat indicator.

The HUD reads `combatV2` state. Old enemy HP strip remains a fallback for legacy state.

---

## 11. Scene Ops Boundary

Scene Ops is supportive only:

1. Draft roster names and descriptive hooks at init.
2. Provide rescue or safe-location digest after `rescue_twist`.
3. Provide optional post-combat aftermath digest.

Scene Ops never decides:

1. Damage.
2. Dice.
3. KO.
4. Force or threshold.
5. Endgame trigger.

---

## 12. Legacy Notes

Combat v1 used per-entity HP, SP, Combat Agent, Dice Agent, ability cooldowns, and individual damage allocation. Those concepts are legacy-only for Combat v2.

Still reusable:

1. Combat module activation and pacing countdown.
2. Enemy roster naming and rank hints.
3. Resource renderer fallback for old saves.
4. Generic event resolver for non-combat events.

Do not use v1 HP/SP as the active combat authority.

---

## 13. Verification

Required tests:

1. Formula tests: player level, essential NPC affection with ceil, boss 35, `force === threshold`.
2. Default KO: lowest force, consecutive KOs, overflow pressure, deterministic ties.
3. Targeted flow: default KO suppressed, target pressure persists, overflow does not spill.
4. Trait dice: unlimited valid traits add dice, invalid IDs ignored, no consumption.
5. Cheat: enemy damage halved and persisted locally; player damage unaffected.
6. Endgame: player plus present essential NPCs required; `rescue_twist` and `game_over`.
7. Scene Ops fallback: digest failure does not block combat.
8. UI: force bars, pressure, chips, target marker, KO state, dice summary, cheat indicator.
