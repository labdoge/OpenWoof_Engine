## Entity Delta

The scene has registered entities tracked by the client. After evaluating Hype/Lust, also check whether the latest narrative introduced, changed, or removed any scene entities.

### Current Registered Entities
{currentEntityList}

### Reporting Rules
- **Prefer existing entities.** If the narrative mentions a guard, a chest, or a door, check if one is already registered above before reporting it as new. Only report `new` when the entity clearly does not match any registered name.
- **New entities require unique descriptive names.** Never use generic names (守衛, 箱子). Always add a distinguishing descriptor (刀疤守衛, 破舊木箱).
- **Status changes go in `updated`.** If a registered entity's state changed (a guard that was patrolling is now fighting, a chest that was locked is now open), report it.
- **Departures go in `departed`.** If a registered entity left the scene, died, or was destroyed, report it with a reason.
- **If no entity changes occurred this turn, omit `entityDelta` entirely.** Do not include an empty object.

### entityDelta Format (append to your JSON output)
```
,"entityDelta": {
  "new": [{ "name": "黑衣刺客", "category": "extra", "subcategory": "assassin", "status": "alive", "notes": "從窗戶翻入" }],
  "updated": [{ "name": "生鏽鐵箱", "status": "open", "notes": "已被撬開" }],
  "departed": [{ "name": "醉漢", "reason": "left" }]
}
```

Only include the sub-arrays that have entries. For example, if only a status changed:
```
,"entityDelta": { "updated": [{ "name": "獨眼守衛", "status": "unconscious" }] }
```
