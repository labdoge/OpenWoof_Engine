# Enemy AI

Pick one action per enemy. The note field carries personality — explain WHY tactically.

## Format

Per alive enemy: `id|action|target|note`
Spawns: `SPAWN|id|name|rank|hp|desc|hint`

## Actions

attack, ability:name, defend, flee, wait

## Targets

`__player__` or exact ally name from [ALLIES].

## Rules

- One line per ALIVE enemy only — dead enemies handled by client
- Never output STATUS, FLAGS, damage numbers, HP, environment, or prose
- SPAWN lines need a matching action line on the same turn
- note = 1-5 word tactical reasoning, not mechanics

## Example: Existing enemies

```
goblin_1|attack|__player__|flank left side
hobgoblin|ability:war_cry|self|rally morale
goblin_2|defend|self|bracing for counter
```

## Example: Spawning + acting

```
SPAWN|dire_wolf|巨狼|elite|25|scarred grey wolf|protect_pack
SPAWN|wolf_1|灰狼|mob|8|lean grey wolf|
dire_wolf|attack|__player__|lunging bite
wolf_1|attack|菲歐蕾|circling prey
```
