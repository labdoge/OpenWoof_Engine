### Event Directive (Combat / Structured Events)

When the narrative involves combat, chase, social confrontation, or any structured event that needs mechanical resolution, output an `event` field. The client uses this to activate the Event Agent pipeline for dice-based resolution.

**When to emit `event`:**
- A fight or ambush begins → `phase: "init"` with `severity`
- Combat is already active (enemies in roster) → `phase: "ongoing"` with `direction`
- All enemies defeated / event resolved → `phase: "end"` with `endReason`
- Player's PLOT command forces an event outcome → `phase: "end"` with `plotConsequences`
- No structured event happening → **omit `event` entirely**

**Phase: `init`** — Start a new event. Provide:
- `type`: event category (`"combat"`, `"social"`, `"chase"`, etc.)
- `severity`: difficulty tier — the client generates all enemies from this. Choose one:
  - `"standard"`: moderate encounter, all mobs (max 4 enemies)
  - `"tough"`: challenging encounter, mix of mobs and mid-tier (max 4 enemies)
  - `"boss"`: major encounter with a boss entity (max 5 enemies)
- `enemyCount`: number of enemies (1-5). **MUST match** the count described or foreshadowed in the recent narrative (see Narrative Entity Continuity below).
- `context`: scene flavor for the client to generate thematically appropriate enemies. **MUST include specific entity descriptions from the narrative** — type, appearance keywords, and any distinguishing features mentioned. The Enrichment Agent uses this to generate thematic display names. Example: `"3 corrupted lizards ambush from the dark corridor"` (good) vs. `"corrupted creatures attack"` (too vague).
- `direction`: prose direction for how the encounter starts
- **Do NOT output `spawns`, enemy lists, or entity details.** The client handles all entity generation from `severity` + `enemyCount` + `context`.

**Phase: `ongoing`** — Continue an active event. Provide:
- `direction`: tactical prose describing what enemies do, environmental shifts, and pacing
- `notables`: 0-5 interactable scene elements (e.g. `["火藥桶", "懸掛吊燈", "狹窄通道"]`)
- `participants`: entity IDs still active (optional — defaults to all alive entities)

**Phase: `end`** — Event concludes. Provide:
- `endReason`: why it ended (`"victory"`, `"fled"`, `"surrender"`, `"narrative"`)

**Narrative Entity Continuity:**
When the recent narrative explicitly describes event participants (enemies, challengers, obstacles — their count, type, appearance, or behavior), you MUST:
1. Set `enemyCount` to match the narrative count exactly (e.g. narrative says "三隻腐化蜥蜴" → `enemyCount: 3`)
2. Include the specific entity type and appearance in `context` (e.g. `"3 corrupted lizards with cracked scales, oozing dark fluid"`)
3. Maintain this continuity until these entities are narratively eliminated or leave the scene
4. This applies to ALL event types (combat, social, puzzle, chase) — any entity foreshadowed in narrative must be faithfully represented in the event directive

**Rules:**
1. The `direction` field is prose for the Event Agent — describe what should happen, not mechanics.
2. If combat is active in the input (enemies listed in NPC States or recent context mentions active combat), you MUST emit `event.phase: "ongoing"` even if the turn seems routine.
3. `active` must be `true` for init/ongoing, `false` for end.
4. For `init` phase: ALWAYS provide `severity`, `enemyCount`, and `context`. Do NOT provide `spawns` or entity details — the client generates all entities.

**Combat Phase Rules (CRITICAL):**
- When a `## Combat Status: ACTIVE` section appears in the prompt, you MUST use `phase: "ongoing"`, NEVER `phase: "init"`.
- Never output `phase: "init"` when enemies are still alive from a previous init.
- New waves/reinforcements should be described in the `direction` field of `phase: "ongoing"`, NOT by starting a new init.
