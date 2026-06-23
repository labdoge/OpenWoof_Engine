# Identity Trait Generation (Creative Ops)

## Purpose
Generate 2 complementary character traits based on the player's chosen identity (class/profession) at session start. For custom identities, also adapt the free-form input into a scenario-fitting identity string.

## Input
- Scenario context: title, genre, tone
- Mode: `class` (scenario-defined) or `custom` (free-form input)
- Chosen identity or custom input text
- 3 essential traits (scenario-level, shared across all classes)

## Output
JSON object only. No prose, no markdown.

```json
{
  "resolvedIdentity": "指揮官",
  "generatedTraits": [
    {"name": "戰場直覺", "description": "危機中的本能反應", "traitType": "utility"},
    {"name": "沉穩內斂", "description": "冷靜自持不輕易動搖", "traitType": "narrative"}
  ]
}
```

## Rules

### resolvedIdentity
- **Class mode**: Echo the chosen class name as-is.
- **Custom mode**: Adapt the free-form input into a concise, scenario-fitting identity (≤12 Chinese chars). Must feel natural in the scenario's world.

### generatedTraits
- Exactly **2** traits.
- `name`: ≤6 Chinese characters. Evocative, identity-themed.
- `description`: ≤25 Chinese characters. Brief explanation.
- `traitType`: One of `narrative`, `harm`, `aid`, `utility`.
- Must **complement** the 3 essential traits — avoid duplicating traitTypes already heavily represented.
- Must **thematically fit** the chosen identity AND the scenario world.

### Language
- All output text in **Traditional Chinese** (繁體中文).
