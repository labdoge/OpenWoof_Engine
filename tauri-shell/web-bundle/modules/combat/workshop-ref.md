# Combat Module Workshop Reference

Module ID: `combat`. Version 2.0.0. Not enabled by default.

Combat v2 is a client-authoritative side-level system. LLM/EA/Scene Ops can suggest roster flavor and narration, but client owns force, threshold, pressure, dice, KO, and endgame.

---

## Runtime Authority

Workshop authors should describe combat tone, enemy style, non-lethal constraints, and scene danger. Do not write custom HP, SP, damage, or dice formulas.

Allowed authoring focus:

- Enemy identity and narrative role.
- Combat narration style.
- Whether fights are lethal, disabling, humiliating, tactical, cinematic, etc.
- Scenario-level endgame mode via `combat.partyKnockout`.

Not allowed:

- Inventing resources such as MP or stamina through combat config.
- Changing force/threshold formulas.
- Letting Scene Ops decide KO or damage.
- Asking Main Session to override client resolution.

---

## Force And Threshold

Client sets `force === threshold`.

| Type | Force/Threshold |
|------|-----------------|
| `player` | `20 + ((level - 1) * 5)` |
| `essential_npc` | `ceil(10 + 10 * (1 + ((affection / 100) * 0.5)))`, affection clamped `-100..100` |
| `boss` | `35` |
| `elite` | `14` |
| `temporary_ally` | `10` |
| `mob` | `8` |
| `minion` | `4` |

Essential NPC examples: `-100 => 15`, `0 => 20`, `50 => 23`, `100 => 25`.

---

## Dice

| Type | Dice |
|------|------|
| `player` | `2d6 + accountable trait dice` |
| `essential_npc` | `2d6 + accountable trait dice` |
| `boss` | `4d6` |
| `elite` | `3d6` |
| `mob` / `temporary_ally` | `2d6` |
| `minion` | `1d6` |

Traits are unlimited and not consumed. EA may propose accountable trait IDs; client validates them.

---

## Scenario JSON

```json
{
  "recommendedModules": ["combat"],
  "combat": {
    "partyKnockout": "rescue_twist"
  }
}
```

`partyKnockout`:

- `rescue_twist`: default. Player-side defeat clears combat and moves narration into a safe rescue transition.
- `game_over`: player-side defeat becomes terminal Game Over.

Player-side defeat only triggers when the player and all present essential NPC combatants are incapacitated. Temporary allies do not count.

---

## Useful Prompt Directives

### Non-lethal combat

```text
Combat should end in incapacitation, surrender, capture, retreat, or rescue. Do not assume death unless narration explicitly supports it.
```

### Cinematic combat

```text
Combat narration should emphasize terrain, momentum, and side-level pressure rather than individual HP exchanges.
```

### Dangerous boss scenes

```text
Boss scenes should feel oppressive and tactical. The boss remains mechanically `boss` type with force 35; do not invent larger numbers.
```

---

## Legacy Notes

Combat v1 HP, SP, per-enemy ability cooldowns, Combat Agent, and Dice Agent are legacy references only. Combat v2 uses `combatV2` module state and the side-level resolver in `src/modules/combat-v2.ts`.
