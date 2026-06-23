# Scene Entity Registry — Design Document

**Date:** 2026-04-08  
**Status:** Design — Not Yet Implemented  
**Purpose:** Overhaul scene entity management. Replace LLM free-roam for extras, objects, and environmental features with a client-authoritative structured registry.  
**Scope:** New subsystem. Touches UA pipeline (eval extension + new Scene Mapper subtask), Block 2 injection, Event Agent combat roster, Exploration module integration, and storage layer.  
**Notes:** This is a **system-level overhaul**. All existing mechanisms that rely on LLM memory for scene entities (combat roster, exploration targets, extra tracking) should migrate to this registry as the single source of truth.

---

## 1. Problem Statement

Currently, the LLM is the sole authority on "what exists in a scene" for everything except vital NPCs and active event participants. This causes:

- **Extras vanish or mutate** — a waitress from turn 3 is forgotten or replaced by turn 7.
- **Object inconsistency** — a desk has drawers one turn, doesn't the next.
- **Combat roster drift** — the most painful case. Combatants appear, disappear, or duplicate across turns despite multiple patches.
- **Exploration gaps** — the Exploration module can't reliably reference objects the LLM previously described.
- **Extra → Vital NPC promotion** is fragile because there's no structured record of the extra to promote.

## 2. Design Principles

- **Client-authoritative for entity existence.** The registry, not the LLM, is the source of truth for what entities are present in a scene.
- **Name-based LLM referencing.** The LLM sees and uses entity names, never IDs. IDs are client-internal. Past experience shows IDs confuse the LLM more than they help.
- **Unique descriptive naming.** Every entity gets a distinguishing prefix (獨眼守衛, not 守衛). Multiple similar entities: 獨眼守衛, 刀疤守衛, 菜鳥守衛.
- **Additive relationship.** The LLM can still introduce new entities organically, but the system biases toward reusing existing registered entities. New registration only when user input or narrative strongly demands it.
- **Minimal registration threshold.** Only entities that interact with the main troupe at least once qualify. A crowd is atmosphere; the waitress who hands over a drink is an entity.
- **Language-adaptive injection.** Block 2 entity injection follows the user's input language first, then falls back to the client's language setting. NOT hardcoded to any language.

## 3. Entity Data Model

```typescript
interface SceneEntity {
  entityId: string;              // Client-generated UUID, never exposed to LLM
  name: string;                  // Unique descriptive name, LLM-facing reference
  category: 'extra' | 'object' | 'feature';
  subcategory?: string;          // 'guard', 'merchant', 'container', 'weapon', 'passage', 'furniture', etc.
  status: string;                // 'alive', 'dead', 'fled', 'unconscious', 'locked', 'open', 'broken', etc.
  discovered: boolean;           // false = exists but not yet revealed in narration
  notes: string;                 // Brief descriptor for Block 2 injection (e.g., "巡邏中", "桌上，點燃")
  locationTag: string;           // Scene/location identifier this entity belongs to
  sessionId: string;             // Owning session
  registeredAtTurn: number;      // Turn when first registered
  lastInteractionTurn: number;   // Last turn this entity was referenced or interacted with
  lastUpdatedTurn: number;       // Last turn status/notes changed
}
```

### 3a. Category Definitions

| Category | What It Covers | Examples |
|----------|---------------|----------|
| `extra` | Non-vital characters in the scene | 獨眼守衛, 紅髮女侍, 醉漢, 流浪貓 |
| `object` | Interactable items and props | 生鏽鐵箱, 破舊公告板, 油燈, 匕首 |
| `feature` | Environmental/structural elements | 裂開的石牆, 吱嘎木樓梯, 暗門, 深井 |

### 3b. Naming Rules

- Every entity **must** have a unique descriptive prefix within its scene. Generic names (守衛, 箱子, 門) are invalid.
- If multiple entities of the same type exist, each gets a distinct descriptor: 獨眼守衛, 刀疤守衛, 菜鳥守衛.
- The Scene Mapper prompt enforces this rule. If the LLM produces a generic name, the prompt retries or the client appends the subcategory as fallback.

## 4. Architecture: Two-Phase Extraction

### 4a. Phase 1 — Scene Mapper (New UA Subtask)

**Trigger:** Scene transition detected (new location, or first turn of session).

**Actor:** A new UA subtask, similar in structure to status-extractor or hype-lust-evaluator. Called through the existing UA facade.

**Input:**
- The LLM's narrative response (post-narration text)
- Scenario context (location, setting, genre)
- Vital NPC list (to exclude — they're already tracked)
- User's input language / client language setting

**Output:** Structured JSON array of entities.

```json
{
  "entities": [
    { "name": "獨眼守衛", "category": "extra", "subcategory": "guard", "status": "alive", "discovered": true, "notes": "巡邏中，配劍" },
    { "name": "紅髮女侍", "category": "extra", "subcategory": "server", "status": "alive", "discovered": true, "notes": "吧台後方" },
    { "name": "生鏽鐵箱", "category": "object", "subcategory": "container", "status": "locked", "discovered": true, "notes": "角落，上鎖" },
    { "name": "暗門", "category": "feature", "subcategory": "passage", "status": "closed", "discovered": false, "notes": "書架後方，需要觸發才顯現" }
  ]
}
```

**Token budget:** ~300-500 output tokens for a typical scene (5-10 entities). One-time cost per scene transition.

**Key prompt instructions:**
- Include entities that are visible AND potential hidden interactables.
- Hidden entities (`discovered: false`) are things the scenario implies exist but haven't been narrated yet (a trap door, a hidden stash, a lurking figure).
- Every entity name must have a unique distinguishing descriptor.
- Do NOT include vital NPCs (they are managed separately).
- Output language follows user's input language, with client language setting as fallback.

### 4b. Phase 2 — Entity Delta (Hype/Lust Eval Extension) ★ Primary Approach

**Trigger:** Every turn, as part of the existing `evaluateHypeLust` UA call.

**Rationale:** The Hype/Lust evaluator already reads the full narrative output and recent context — it has everything needed to detect entity changes. Folding entityDelta into this call adds ~50-150 output tokens without introducing a second per-turn LLM call. This keeps per-turn UA calls at **exactly one**, same as before the registry existed.

**Change:** Add an `entityDelta` field to the eval output schema. The eval prompt gains one additional conditional section (assembled alongside quest/dynamics/event/lore sections) that provides the current entity list and requests delta reporting.

**Output addition (appended to existing eval JSON):**

```json
{
  "hpiEval": [ ... ],
  "entityDelta": {
    "new": [
      { "name": "黑衣刺客", "category": "extra", "subcategory": "assassin", "status": "alive", "notes": "從窗戶翻入" }
    ],
    "updated": [
      { "name": "生鏽鐵箱", "status": "open", "notes": "已被撬開" }
    ],
    "departed": [
      { "name": "醉漢", "reason": "left" }
    ]
  }
}
```

**Token cost:** ~50-150 additional output tokens per turn (most turns: `entityDelta` is empty or has 1-2 updates). Input cost: the current entity list injected as eval context (~80-150 tokens).

**Key prompt instructions:**
- Check the existing entity list (injected as context) before reporting anything as `new`. Only add truly new entities.
- Bias toward interpreting narration references as existing entities. Only report `new` when the entity clearly doesn't match any registered name.
- Report status changes in `updated` (status field changes, notes changes).
- Report departures in `departed` (entity left the scene, died, was destroyed).
- If no entity changes occurred, omit the `entityDelta` field entirely (zero token overhead on quiet turns).

### 4c. Fallback — Entity Delta via Status Extract (Option B)

> **Status:** Backup approach. Use if Option A (eval extension) proves insufficient — e.g., if the eval prompt becomes too overloaded, or if entity delta accuracy degrades when combined with hype/lust evaluation.

If the eval-integrated approach underperforms, entity delta extraction can be moved to a **separate per-turn Status Extract call**:

- Promote Status Extract from Turn-1-fallback to every-turn execution.
- Add `entityDelta` to the Status Extract output schema (alongside scene/npcs/player).
- This adds a second per-turn UA LLM call but provides cleaner separation of concerns.

**Trade-off:** Better extraction accuracy (dedicated focus) vs. doubled UA latency per turn. Only switch to this if Option A shows consistent quality issues.

## 5. Block 2 Injection

### 5a. Injection Format

Compact, name-based, grouped by category. Language follows user input language, fallback to client language setting.

**Example (Traditional Chinese):**

```
【場景實體】
人物：獨眼守衛（巡邏中）、紅髮女侍（吧台後方）、醉漢（角落昏睡）
物件：生鏽鐵箱（鎖住）、破舊公告板（可互動）、油燈（桌上，點燃）
環境：裂開的石牆（通往地下）、吱嘎木樓梯
```

**Example (English):**

```
[Scene Entities]
Characters: One-Eyed Guard (patrolling), Red-Haired Waitress (behind bar), Drunk (sleeping in corner)
Objects: Rusty Iron Chest (locked), Old Notice Board (interactable), Oil Lamp (on table, lit)
Features: Cracked Stone Wall (leads underground), Creaking Wooden Stairs
```

### 5b. Injection Rules

- **Only `discovered: true` entities** appear in Block 2. Hidden entities are omitted so the LLM doesn't spoil them.
- Injection is rebuilt each turn from the current SceneEntityStore state.
- Token cost: ~80-150 tokens for a typical scene. Negligible.
- Vital NPCs are NOT included here (they have their own Block 2 section via NPC Profiles).

### 5c. LLM Guidance (System Prompt Addition)

Added to the Main Session system prompt (or Module Injector output):

> The 【場景實體】 section lists all known characters, objects, and features in the current scene. Reference them by name when relevant. You may introduce new entities when the narrative demands it, but prefer using existing ones. Do not contradict the status of registered entities (e.g., if a chest is marked "locked", don't narrate it as open unless the player acts to open it).

## 6. Scene Lifecycle

### 6a. Scene Introduction

```
1. Main Session narrates scene entry (turn N)
2. Orchestrator detects scene transition (new locationTag vs. previous)
3. Check archived entities for this locationTag:
   a. If archive exists → load archived entities, pass to Scene Mapper for refresh
   b. If no archive → Scene Mapper does fresh extraction
4. Scene Mapper returns entity list
5. Client registers all entities in SceneEntityStore
6. Block 2 injection updated with discovered entities
7. Next turn: LLM sees the entity list and respects it
```

### 6b. Regular Turns (Same Scene)

```
1. Main Session narrates turn
2. evaluateHypeLust UA call runs (existing flow, now with entityDelta section)
3. entityDelta field parsed from eval result:
   a. New entities → register in SceneEntityStore (discovered: true)
   b. Updated entities → update status/notes in store
   c. Departed entities → mark status accordingly (left/dead/destroyed)
4. Block 2 injection refreshed
```

### 6c. Hidden Entity Discovery

Hidden entities (`discovered: false`) can be revealed through:

- **Exploration module:** Player inspects location or specific topic → Exploration module checks for hidden entities matching the context → flips `discovered: true` → inject discovery hint to LLM.
- **Natural narration:** The LLM introduces a hidden entity because the scenario encourages it or the player's actions trigger it. Status Extract delta catches this as an `updated` entity with `discovered` now `true` (or as a `new` entity if the Scene Mapper didn't pre-register it).
- **PLOT command / UA directive:** UA decides a hidden entity should be revealed based on narrative pacing.

### 6d. Scene Transition

```
1. Orchestrator detects scene transition (locationTag changed)
2. Archive all current entities with final status for the departing locationTag
3. Clear Block 2 entity injection
4. Proceed to 6a for the new scene
```

### 6e. Location Revisit

```
1. Orchestrator detects transition to a previously visited locationTag
2. Load archived entities for this location
3. Scene Mapper evaluates: which entities are still present, which have changed
   - Input: archived entity list + new narrative context
   - Output: updated entity list (some may have departed, new ones may have appeared)
4. Update SceneEntityStore, refresh Block 2 injection
```

## 7. Storage

### 7a. SceneEntityStore (New IndexedDB Store)

```typescript
// New store in src/storage/scene-entities.ts
interface SceneEntityRecord extends SceneEntity {
  // SceneEntity fields + storage metadata
  archivedAt?: number;         // Timestamp when archived (on scene transition)
}

// Store: 'scene-entities'
// Key path: entityId
// Indexes:
//   [sessionId, locationTag]  — for location-based queries
//   [sessionId, discovered]   — for injection filtering
//   [sessionId]               — for session-level cleanup
```

### 7b. Persistence Rules

- **Active session:** All entities for the current session live in SceneEntityStore.
- **Scene transition:** Entities for the departing location get `archivedAt` timestamp. They remain in the store but are not injected into Block 2.
- **Session idle > 14 days:** Archived entities are pruned from the store. (Same cleanup cadence as other session data.)
- **Session deletion:** All entities for that session are deleted.

## 8. Integration with Existing Systems

### 8a. Combat / Event Agent

**Current problem:** Combat roster is reconstructed each turn from LLM output, leading to phantom combatants.

**With registry:**
- When UA detects event start, the combatant roster is derived from SceneEntityStore:
  - Filter: `category === 'extra'`, `status === 'alive'`, `discovered === true`, matching `locationTag`
  - Plus vital NPCs (already tracked separately)
- During combat, entity status changes (wounded, dead, fled) update the store in real-time via entityDelta.
- EA receives the registered roster, not a reconstructed one. No more drift.

### 8b. Exploration Module

**Current:** Notable objects are defined in mystery/scenario data and tracked in a parallel `notableObjects` record.

**With registry:**
- Scenario-defined notable objects are pre-registered as `SceneEntity` records with `discovered: false` on scene entry.
- The Exploration module's discovery flow flips `discovered: true` on the SceneEntity record instead of (or in addition to) its own `notableObjects` tracking.
- **Portable objects** that move to player inventory still use the existing inventory system, but the SceneEntity record is updated (`status: 'collected'`).
- Ad-hoc discoverable objects (not in scenario data) are handled by the Scene Mapper's hidden entity detection.

### 8c. Extra → Vital NPC Promotion

**Flow unchanged.** When a registered extra is promoted to a vital NPC:
1. The extra's SceneEntity record provides the base data (name, subcategory, current status).
2. A full NPC Profile is created through the existing promotion workflow (profile-updater agent).
3. The SceneEntity record is marked with a flag or removed (since the entity is now tracked as a vital NPC).

### 8d. Context Compression

- On compression, the entity list does NOT need to be included in the compressed summary — it's injected fresh from the store each turn via Block 2.
- This means entity continuity survives compression perfectly, solving a major source of "forgotten extras" post-compression.

## 9. Scene Mapper Prompt (Skeleton)

```
You are a Scene Entity Mapper. Given a narrative passage, extract all entities present in the scene.

## Rules
- Only include entities that interact with or are directly relevant to the player's troupe.
  Minimum threshold: at least one interaction (a waitress offering a drink, a passerby bumping into the player).
  Background atmosphere (a crowd, distant birds) does NOT qualify unless an individual is singled out.
- Every entity name MUST include a unique descriptive prefix. Never use generic names.
  ✓ 獨眼守衛, 刀疤守衛, 菜鳥守衛
  ✗ 守衛A, 守衛B, 守衛
- Mark entities as discovered:false if they are implied by the setting but not yet narrated
  (a hidden trap, a figure watching from the shadows, a locked compartment).
- Do NOT include vital NPCs: {vitalNpcNames}
- Output language: {injectionLanguage}

## Categories
- extra: Non-vital characters (guards, merchants, animals, bystanders who interact)
- object: Items and props that can be interacted with (containers, weapons, tools, furniture with function)
- feature: Environmental/structural elements (passages, walls, doors, terrain features)

## Output Format
{entitySchemaExample}
```

## 10. Entity Delta Prompt Section (Eval Extension)

Added as a conditional section to the `evaluateHypeLust` system prompt (assembled alongside quest/dynamics/event/lore sections). Only included when entity registry is active for the current scene.

```
## Entity Delta
Current registered entities in scene:
{currentEntityList}

After evaluating Hype/Lust, also check whether the narrative introduced, changed, or removed any scene entities.

Report in an "entityDelta" field:
- "new": Entities that appeared in this turn and do NOT match any name above.
  IMPORTANT: Prefer matching existing entities. Only report truly new ones.
  Each new entity needs: name (unique descriptive prefix required), category (extra/object/feature), subcategory, status, notes.
- "updated": Entities whose status or notes changed (e.g., a guard that was patrolling is now fighting, a chest that was locked is now open).
- "departed": Entities that left the scene, died, or were destroyed. Include reason.

If no entity changes occurred, omit entityDelta entirely.
```

### 10a. Fallback Prompt (Option B — Status Extract)

> If Option A is retired in favor of Option B (§4c), move the entity delta prompt section to the Status Extract prompt instead. The schema and instructions are identical; only the host prompt changes.

## 11. Implementation Phases

### Phase 1: Core Registry
- [ ] Define `SceneEntity` type in `src/types/` or `src/modules/`
- [ ] Create `src/storage/scene-entities.ts` (CRUD, indexes, archive, prune)
- [ ] Add store to `db.ts` schema

### Phase 2: Scene Mapper UA Subtask
- [ ] Create `src/agents/scene-mapper.ts` (prompt, parser, token budget)
- [ ] Register in UA facade (`utility-agent.ts`)
- [ ] Wire into Orchestrator: detect scene transition → call Scene Mapper
- [ ] Handle location revisit: load archive → pass to Scene Mapper for refresh

### Phase 3: Entity Delta (Eval Extension — Option A)
- [ ] Add entityDelta conditional section to `evaluateHypeLust` system prompt assembly
- [ ] Inject current entity list as eval context (conditional, only when registry is active)
- [ ] Extend eval response parser to handle `entityDelta` field
- [ ] Wire delta results into SceneEntityStore updates
- [ ] If Option A proves insufficient → switch to Option B (§4c): promote Status Extract to per-turn, move delta there

### Phase 4: Block 2 Injection
- [ ] Create injection formatter (language-adaptive, category-grouped)
- [ ] Wire into Module Injector or Orchestrator context-building step
- [ ] Add Main Session system prompt guidance for entity respect

### Phase 5: Combat Integration
- [ ] Refactor combat roster derivation to use SceneEntityStore
- [ ] EA receives registered roster instead of reconstructed one
- [ ] Combat status changes (damage, death, flee) update SceneEntity records

### Phase 6: Exploration Integration
- [ ] Bridge scenario-defined notable objects to SceneEntity records
- [ ] Discovery flow updates SceneEntity `discovered` flag
- [ ] Portable object collection updates SceneEntity `status`

### Phase 7: Compression Resilience
- [ ] Verify entity injection survives context compression (no entity data in compressed summary needed)
- [ ] Test: compress mid-scene, verify entities persist in Block 2

---

## Appendix A: Token Budget Estimates

| Component | When | Estimated Cost |
|-----------|------|---------------|
| Scene Mapper (output) | Scene transition only | 300-500 tokens |
| Entity Delta in eval (output) | Every turn (most empty, Option A) | 0-150 tokens |
| Entity list in eval (input) | Every turn (Option A) | 80-150 tokens |
| Block 2 Injection (input) | Every turn | 80-150 tokens |
| Scene Mapper (input context) | Scene transition only | ~200 tokens (vital NPC list + scene context) |

**Net per-turn cost for typical gameplay (Option A):** ~160-300 additional input tokens (Block 2 injection + entity list in eval context) + 0-150 output tokens (delta in eval, most turns zero). No additional LLM calls. Minimal impact.

**If switching to Option B:** Same input/output token costs, but adds a second per-turn UA LLM call (Status Extract promoted from Turn-1-fallback to every-turn).

## Appendix B: Scene Transition Detection

Scene transitions are detected by comparing the current `locationTag` (from Status Extract's `scene.location`) against the previous turn's value. A change triggers the Scene Mapper.

Edge cases:
- **Sub-location movement** (moving from tavern main hall to tavern cellar): Treat as scene transition. Entities from the main hall are archived; cellar gets its own mapping.
- **Time skip in same location**: NOT a scene transition. Entities persist but UA may update statuses (guard shift change, etc.) via delta.
- **Return to previous location**: Load archive, Scene Mapper refreshes. See §6e.
