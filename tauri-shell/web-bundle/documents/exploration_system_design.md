# Exploration & Mystery Module Design

**Date:** 2026-03-24
**Status:** Draft
**Purpose:** Define the exploration module for DogeChat Engine — notable objects, player inventory, and a 3-phase mystery system that provides an immersive sense of discovery without demanding real puzzle-solving.
**Note:** This is a **module** (`modules/exploration/`), not core infrastructure. If not selected at session setup, zero overhead. Notable objects and inventory are app-level features available to any module; mysteries are module-gated.

---

## 1. Design Principles

1. **Feeling over challenge.** The goal is narrative immersion — the *sensation* of uncovering secrets, not a logic puzzle. Players should never get stuck. If they're in the right place and vaguely engaging, it counts.
2. **LLM narrates, client bookkeeps.** Same as combat. Mystery phase transitions, object discovery, and inventory changes are client-authoritative. The LLM enriches the moments with prose.
3. **Module-gated mysteries, app-level objects.** Notable objects and player inventory live in core state so any module can reference them. The mystery lifecycle (rumor → puzzle → revelation) is module-owned.
4. **Scenario-authored, not generated.** Mystery chains are defined by scenario authors (or pre-baked in scenario JSON). No mid-session mystery generation. Each mystery has a fixed sequence of locations and objects.
5. **Small and bounded.** Max 3 mysteries per scenario. Max 1-2 notable objects per location. This keeps token overhead trivial and makes each location feel meaningful.


---

## 2. Notable Objects (App-Level)

Notable objects are **sub-locations** in the location journal. They appear as children of their parent location, using the existing `parent` field in `LocationJournalEntry`.

### 2a. Data Shape

```typescript
interface NotableObjectEntry extends LocationJournalEntry {
  // Inherits: name, baseDescription, currentNote, lastVisitedTurn,
  //           lastKnownPresent, visited, parent
  portable: boolean;        // Can player pick this up?
  mysteryStepRef?: string;  // Links to a mystery step (mysteryId:stepIndex)
  hidden: boolean;          // Not yet discoverable (revealed by chain step)
  collected: boolean;       // Portable object picked up by player
}
```

In practice, notable objects are stored as regular `LocationJournalEntry` records in `state.locationJournal`, keyed by their unique name. The extra fields (`portable`, `mysteryStepRef`, `hidden`, `collected`) are stored in a parallel app-level record:

```typescript
// In GameState (app-level, not module state)
notableObjects: Record<string, NotableObjectMeta>;

interface NotableObjectMeta {
  objectId: string;         // Same as the LocationJournalEntry key
  parentLocation: string;   // Parent location name
  portable: boolean;
  hidden: boolean;          // Not yet visible in journal
  collected: boolean;       // In player inventory
  mysteryStepRef?: string;  // "sealed_sword:1" — mysteryId:stepIndex
}
```

### 2b. Discovery Flow

1. Player visits a location (status extract reports `scene.location`).
2. Client checks: does this location have any notable objects that are `hidden: false` and `visited: false`?
3. If yes, client marks them as `visited: true` in the location journal and injects a system tag into the **next** LLM call:
   ```
   [SYSTEM: 玩家在「酒館倉庫」發現了「古老鑰匙」。請在敘事中自然地描述這個發現。]
   ```
4. LLM narrates the discovery. The object appears in the location journal as a sub-entry under its parent.
5. If the object is `portable: true` and the player interacts with it (detected by UA eval, see Section 5), it moves to inventory.

### 2c. Scenario Definition

Notable objects are defined in two places in scenario JSON:

**Standalone objects** (flavor, no mystery tie):
```json
"notableObjects": [
  {
    "name": "老舊的佈告欄",
    "location": "城鎮廣場",
    "description": "釘滿了泛黃告示的木板",
    "portable": false
  },
  {
    "name": "乾涸的噴泉",
    "location": "城鎮廣場",
    "description": "曾經華麗的噴泉，如今只剩碎石",
    "portable": false
  }
]
```

**Mystery-linked objects** are auto-registered from `mysteries[].steps` (see Section 4). No need to duplicate them in `notableObjects`.

### 2d. Location Journal Display

Notable objects render as indented children under their parent location:

```
● 酒館                          已造訪 T3
    ○ 古老鑰匙                  已收集
● 地下墓穴                      已造訪 T8
    ◐ 封印石門                   已發現
    ○ 傳說之劍                   ???
○ 城鎮廣場                      未造訪
    ─ 老舊的佈告欄               (隱藏至造訪)
```

States: `???` = hidden, `已發現` = visited but not interacted, `已收集` = portable + picked up.


---

## 3. Player Inventory (App-Level)

Global player-only storage for portable notable objects. Replaces per-NPC item tracking.

### 3a. Data Shape

```typescript
// In GameState (app-level)
inventory: InventoryItem[];

interface InventoryItem {
  objectId: string;         // References NotableObjectMeta.objectId
  name: string;             // Display name (Traditional Chinese)
  fromLocation: string;     // Where it was picked up
  acquiredTurn: number;
  used: boolean;            // Consumed by a deliver/use interaction
  usedAtLocation?: string;  // Where it was used
  usedTurn?: number;
}
```

### 3b. Inventory Rules

- **Capacity**: No hard limit. Practical max is ~5-6 items given 3 mysteries with 1-2 portable objects each.
- **Acquire**: When UA eval confirms player interacted with a portable object at its location, client adds to inventory and sets `collected: true` on the `NotableObjectMeta`.
- **Use**: When UA eval confirms player used an inventory item at the correct mystery step location, client marks `used: true`. Item stays in inventory (greyed out) as a record.
- **No discard**: Players cannot voluntarily drop items. This avoids soft-locks.
- **Module access**: Any module can read inventory state via `stateManager.getInventory()`. Future modules could add their own portable item types.

### 3c. UI Placement

Inventory button sits on the **bottom strip game button row**, next to SPEAK/DO/PLOT and turn/level/token display. Uses a small bag icon (🎒 or similar). Badge count = number of non-used items.

Opens a compact dropdown or small modal listing items:
- Active items: name + origin location
- Used items: greyed out, "已使用於「location」"
- Empty state: "背包是空的"

### 3d. LLM Context Injection

Inventory contents are injected into Block 3 (dynamic) when non-empty:

```
[Player Inventory: 古老鑰匙 (from 酒館倉庫)]
```

~15 tokens per item. Max ~90 tokens for a full inventory. Trivial budget.


---

## 4. Mystery System (Module-Gated)

Mysteries are the core feature of the Exploration Module. Each mystery is a linear sequence of location visits and object interactions that unfolds across three narrative phases.

### 4a. Three Phases

| Phase | Journal Display | Player Experience | Trigger |
|-------|----------------|-------------------|---------|
| `rumor` | Title + rumor text + `???` steps | Player knows something exists. Vague. | Game start (all mysteries begin here) |
| `puzzle` | Title + puzzle hint + revealed steps | Player found enough to actively engage. Specific. | Completes step at `puzzleStartsAtStep` index |
| `revelation` | Title + resolution summary + ✓ | Mystery solved. Trait rewards granted. | All steps completed |

### 4b. Mystery Data Shape

```typescript
// Module state (stored in moduleStates['exploration'])
interface MysteryState {
  id: string;
  title: string;              // ≤8 chars Traditional Chinese
  phase: 'rumor' | 'puzzle' | 'revelation';
  rumorText: string;          // Shown in journal during rumor phase (≤60 chars)
  puzzleText: string;         // Shown after advancing to puzzle (≤80 chars)
  revelationText?: string;    // Generated on completion (≤100 chars)
  steps: MysteryStep[];
  puzzleStartsAtStep: number; // Step index that transitions rumor → puzzle
  currentStep: number;        // Next step to complete (0-indexed)
  relatedNpcs: string[];      // NPC IDs involved
  traitHints: {               // Guidance for trait generator
    player?: TraitType;       // Suggested trait type for player
    npc?: TraitType;          // Suggested trait type for NPC
  };
  resolvedTurn?: number;
  activatedTurn: number;      // Always turn 0 (game start)
}

interface MysteryStep {
  location: string;           // Parent location name
  objectName: string;         // Notable object at this location
  objectDescription: string;  // Base description for the object
  hint: string;               // Journal hint text (≤40 chars)
  portable: boolean;          // Does this object go to inventory?
  hidden: boolean;            // Hidden until previous step reveals it?
  completed: boolean;
}
```

### 4c. Scenario Template

```json
"mysteries": [
  {
    "title": "封印之劍",
    "rumorText": "據說地下墓穴藏著一把傳說之劍",
    "puzzleText": "古老鑰匙上的紋路與墓穴石門完全吻合",
    "steps": [
      {
        "location": "酒館倉庫",
        "objectName": "古老鑰匙",
        "objectDescription": "被灰塵覆蓋的銅製鑰匙，刻有奇異紋路",
        "hint": "酒館深處似乎藏著線索",
        "portable": true,
        "hidden": false
      },
      {
        "location": "地下墓穴",
        "objectName": "封印石門",
        "objectDescription": "一扇沉重的石門，中央有一個鑰匙孔",
        "hint": "某樣東西也許能打開它",
        "portable": false,
        "hidden": false
      },
      {
        "location": "地下墓穴",
        "objectName": "傳說之劍",
        "objectDescription": "散發微光的古劍，嵌在祭壇之上",
        "hint": "石門之後的真相",
        "portable": true,
        "hidden": true
      }
    ],
    "puzzleStartsAtStep": 1,
    "relatedNpcs": ["innkeeper"],
    "traitHints": { "player": "utility", "npc": "narrative" }
  }
]
```

**Auto-registration**: Each mystery step's `objectName` + `location` is automatically registered as a notable object during session init. Hidden steps register as `hidden: true`. No need to also list them in `notableObjects`.

### 4d. Step Completion Flow

```
Turn starts → Orchestrator processes
    ↓
Status extract: player is at location X
    ↓
Client checks: any mystery has a pending step at location X?
    ↓ yes
Object discovery: if step's object is hidden=false and not yet visited,
  mark visited, inject discovery narration hint
    ↓
UA eval receives mystery context (see Section 5)
    ↓
UA returns: mysteryProgress: { mysteryId, stepped: true }
    ↓
Client processes step completion:
  1. Mark step.completed = true
  2. Advance mystery.currentStep
  3. If portable: add to inventory, mark collected
  4. If next step has hidden=true: set hidden=false (reveal it)
  5. Check phase transition:
     - currentStep reached puzzleStartsAtStep? → phase = 'puzzle'
     - All steps completed? → phase = 'revelation'
  6. Inject narration hint for next LLM call:
     [SYSTEM: 「封印之劍」之謎有了進展 — 玩家發現了「封印石門」。
      謎團進入「解謎」階段。請自然地融入敘事。]
    ↓
If phase = 'revelation':
  7. Generate revelation text via UA (one-line summary)
  8. Trigger trait reward flow (Section 6)
  9. Inject final narration hint:
     [SYSTEM: 「封印之劍」之謎已解開！玩家取得「傳說之劍」。
      請以有意義的方式描述這一刻的揭示與成就感。]
```

### 4e. Phase Transition Summary

```
rumor ──[step at puzzleStartsAtStep completed]──→ puzzle ──[all steps completed]──→ revelation
```

Rumor → puzzle: Journal updates with puzzle text, hints become more specific.
Puzzle → revelation: Trait reward modal shown, journal marks mystery as resolved.


---

## 5. UA Eval Integration

No dedicated agent. Mystery detection piggybacks on existing UA eval with a small extension.

### 5a. UA Eval Fields (Module Manifest)

```json
"uaEval": [
  {
    "field": "mysteryProgress",
    "type": "object",
    "description": "$EXPLORATION_UA_MYSTERY_PROGRESS_DESC",
    "mapsTo": null,
    "readWhen": "enabled",
    "perNPC": false
  },
  {
    "field": "objectInteraction",
    "type": "object",
    "description": "$EXPLORATION_UA_OBJECT_INTERACTION_DESC",
    "mapsTo": null,
    "readWhen": "enabled",
    "perNPC": false
  }
]
```

### 5b. UA Eval Prompt Injection

When there are active mysteries with pending steps at the player's current location, the module injects context into the UA eval prompt via `getDynamicPrompt` hook:

```
[Exploration Module — Mystery Check]
Mystery "封印之劍" (phase: rumor, step 1/3 pending).
  Current step: interact with 「封印石門」 at 「地下墓穴」.
  Player is currently at 「地下墓穴」.

  Did the player interact with, acknowledge, or attempt anything
  related to 「封印石門」? Be LENIENT — any vague intent counts.

  Output: { "mysteryProgress": { "mysteryId": "sealed_sword", "stepped": true/false } }

  If player also picked up a portable object:
  Output: { "objectInteraction": { "objectId": "ancient_key", "collected": true } }
```

### 5c. Token Budget

| Component | Tokens | When |
|-----------|--------|------|
| Mystery context per active mystery | ~40-50 | Every turn while mystery has pending step at current location |
| Object interaction check | ~20-30 | When portable object present and not yet collected |
| Mystery progress output | ~15-20 | UA response field |
| **Worst case (3 mysteries, all at current location)** | **~200** | Rare — usually 0-1 mysteries active at player's location |

Generous budget, simple boolean-ish output, low parsing failure risk.

### 5d. Lenient Matching Guidelines

The UA eval description emphasizes leniency:

- Player says `DO:[看看那扇石門]` → stepped: true
- Player says `DO:[在墓穴裡四處探索]` → stepped: true (they're at the right location, engaging)
- Player says `SPEAK:[跟酒保聊天]` at the right location with a related NPC → stepped: true
- Player says `DO:[離開墓穴]` → stepped: false (leaving, not engaging)
- Player is at the wrong location entirely → no mystery check injected at all

The goal: if the player is at the right place and not actively leaving, almost anything counts.


---

## 6. Trait Rewards on Revelation

When a mystery reaches `revelation` phase, the trait reward flow triggers. This mirrors the existing affection milestone trait flow but grants to **both** the player and in-scene vital NPCs.

### 6a. Reward Flow

1. Mystery phase becomes `revelation`.
2. Client identifies reward recipients:
   - **Player**: always.
   - **Vital NPCs**: any NPC in `mystery.relatedNpcs` that is currently `inScene: true`.
3. Trait Generator Agent is called with context:
   - Mystery title, rumor text, puzzle text, revelation context
   - `traitHints.player` / `traitHints.npc` for type guidance
   - Current player traits and NPC traits (to avoid duplicates)
   - Recent narrative context (last 3-5 messages)
4. Modal shown to player (same as level-up trait picker):
   - Player trait options (3 choices, pick 1)
   - Each qualifying NPC's trait options (3 choices, pick 1 per NPC)
5. Selected traits added to `state.player.traits` and `state.npcs[npcId].npcTraitsGained`.
6. Existing trait cap rules apply (max traits per entity).

### 6b. Trait Generation Prompt Hints

The `traitHints` field in mystery definition guides the trait generator:

| Hint | Meaning |
|------|---------|
| `"narrative"` | Passive trait reflecting lore knowledge or personal growth |
| `"utility"` | Practical skill gained from the discovery |
| `"harm"` | Combat-relevant ability tied to the mystery's theme |
| `"aid"` | Supportive ability reflecting cooperation during the mystery |

These are suggestions, not hard constraints. The trait generator can deviate if context demands it.


---

## 7. Quest Journal UI (Shared, Promoted to Bottom Strip)

The current quest journal modal (`quest-journal-modal.ts`) is promoted to a **persistent button on the bottom strip game button row** and expanded to include mysteries.

### 7a. Button Placement

Bottom strip game button row, after the existing turn/level/token/trait display area:

```
[SPEAK] [DO] [PLOT]   T112 Lv15 ██ 2,756,462 tok  🎒(2)  📜(3)  特質: ...
                                                     ↑       ↑
                                                  Inventory  Journal
```

Badge counts:
- 🎒 Inventory: number of non-used items (0 = hidden)
- 📜 Journal: active quests + unsolved mysteries (0 = shows as dim, no badge)

### 7b. Journal Panel Content

Opens as a modal (same style as current quest journal). Two sections:

**Bottleneck Quests** (existing functionality, moved here):
- Active quests with NPC name, objective, activation turn
- Completed quests with completion reason and turn range

**Mysteries** (new):
- Grouped by phase: active (rumor/puzzle) first, then revealed
- Each mystery card shows:
  - Title with phase icon: 💬 rumor, 🔍 puzzle, ✨ revelation
  - Phase-appropriate text (rumor text, puzzle text, or revelation summary)
  - Step progress: `○○●` (completed/total, no spoilers for future steps)
  - Hint for current step (puzzle phase only)
  - Related NPCs
  - Trait rewards (revelation phase only)

### 7c. Mystery Card Layout

```
🔍 封印之劍                              解謎中
─────────────────────────────────────────
古老鑰匙上的紋路與墓穴石門完全吻合

進度：●●○  (2/3)
下一步：石門之後的真相 — 地下墓穴

相關人物：酒館老闆
```

```
✨ 失落的寶藏                            已揭示
─────────────────────────────────────────
廢棄礦坑深處的寶箱原來藏著古代地圖

進度：●●●  (3/3)  完成回合：T45

獲得特質：
  玩家 — 礦脈直覺 (utility)
  酒館老闆 — 尋寶老手 (narrative)
```

### 7d. Welcome Message Rumor Seeding

All mysteries begin as `rumor` phase at turn 0. The session welcome message includes a flavor line:

```
[SYSTEM: 本場景包含 {N} 個待解之謎。請在開場敘事中自然地暗示以下傳聞：
{mystery1.rumorText}、{mystery2.rumorText}、{mystery3.rumorText}。
不要直接透露細節，只需營造「這裡似乎藏著秘密」的氛圍。]
```

This gives the LLM creative freedom to weave rumors into the opening narration without spoiling the chain.


---

## 8. Module Manifest

```json
{
  "id": "exploration",
  "name": "MODULE_EXPLORATION",
  "description": "MODULE_EXPLORATION_DESC",
  "version": "1.0.0",
  "enabledByDefault": false,

  "style": {
    "narrationFocus": ["discovery", "atmosphere", "detail", "wonder", "curiosity"],
    "vocabularyTier": "evocative",
    "toneKeywords": ["mysterious", "layered", "rewarding", "immersive"],
    "descriptionPriorities": ["environment", "object-detail", "revelation", "mood"]
  },

  "prompt": {
    "file": "prompt.md",
    "stub": "stub.md",
    "block": 1,
    "alwaysLoad": true,
    "maxAfterglow": 0
  },

  "activation": {
    "uaFlag": "explorationActive"
  },

  "state": {
    "mysteries": { "type": "object", "default": {} },
    "explorationActive": { "type": "boolean", "default": true }
  },

  "uaEval": [
    {
      "field": "mysteryProgress",
      "type": "object",
      "description": "$EXPLORATION_UA_MYSTERY_PROGRESS_DESC",
      "mapsTo": null,
      "readWhen": "enabled",
      "perNPC": false
    },
    {
      "field": "objectInteraction",
      "type": "object",
      "description": "$EXPLORATION_UA_OBJECT_INTERACTION_DESC",
      "mapsTo": null,
      "readWhen": "enabled",
      "perNPC": false
    }
  ],

  "tokens": {
    "inputEstimate": 300,
    "outputRecommendation": 0,
    "statusExtractPerNPC": 0,
    "statusExtractBase": 0
  },

  "ui": {
    "hudPill": {
      "label": "MODULE_EXPLORATION_PILL",
      "activeClass": "active-exploration",
      "activeWhen": "explorationActive"
    },
    "statusItems": []
  },

  "memory": {
    "criticalEventFields": ["mysteryProgress"],
    "compression": {
      "includeWhen": "explorationActive",
      "priority": "low"
    },
    "milestones": [
      { "field": "mysteryProgress", "event": "firstReach", "values": ["revelation"] }
    ]
  },

  "config": {
    "mysteryCount": {
      "type": "number",
      "default": 3,
      "min": 1,
      "max": 3,
      "label": "CONFIG_MYSTERY_COUNT",
      "description": "CONFIG_MYSTERY_COUNT_DESC"
    }
  },

  "enrichmentFocus": "著重描述環境細節、物品外觀、發現時的氛圍感，名稱需符合場景世界觀",

  "conflicts": [],
  "requires": []
}
```

### 8a. Manifest Notes

- `alwaysLoad: true` because the module needs to check mystery progress every turn, not only when activated by a keyword or flag. The `explorationActive` state is always true when the module is enabled.
- `tokens.inputEstimate: 300` — conservative. Prompt.md (~150 tokens) + dynamic mystery context (~150 tokens worst case).
- No resources defined. Exploration doesn't need HP/SP-style pools.
- No dice rolls. No mechanical challenge.
- No `sceneResolution`. Discovery is not roll-worthy.


---

## 9. Module File Structure

```
modules/exploration/
  ├─ manifest.json              (see Section 8)
  ├─ prompt.md                  (LLM narration guidance for exploration scenes)
  ├─ stub.md                    (minimal: "world has explorable elements")
  ├─ exploration-data.ts        (phase display names, icon mappings, constants)
  └─ locale/
      └─ zh-TW.json            (UI strings, UA eval descriptions)

src/modules/builtins/
  └─ exploration-hooks.ts       (hook implementations)
```

### 9a. Hook Implementations

```typescript
// exploration-hooks.ts
export const explorationHooks: ModuleHooks = {
  onSessionStart(moduleState, scenarioData) {
    // Initialize mysteries from scenario JSON
    // Register mystery-linked objects as notable objects
    // Set all mysteries to phase: 'rumor', currentStep: 0
    return { ...moduleState, mysteries: initializedMysteries };
  },

  getDynamicPrompt(moduleState, gameState) {
    // Build mystery check prompt for UA eval
    // Only include mysteries with pending steps at current location
    // Return null if no mysteries need checking this turn
  },

  onTurnEnd(moduleState, gameState, uaEval) {
    // Process UA eval results:
    //   - mysteryProgress.stepped → advance chain
    //   - objectInteraction.collected → update inventory
    // Check phase transitions
    // Return updated moduleState
  },

  onSceneChange(moduleState, prevScene, newScene) {
    // When player moves to new location:
    //   - Check for discoverable objects at new location
    //   - Prepare discovery injection hints
    return moduleState;
  },

  getPacingDrivers(moduleState) {
    // Exploration module can contribute pacing drivers
    // e.g., "NPC drops a hint about a mystery" when player seems stuck
    return [];
  },
};
```


---

## 10. App-Level Changes Required

These changes are in core code, not the module:

### 10a. State Types (`src/state/types.ts`)

```typescript
// New app-level state fields
interface GameState {
  // ... existing fields ...
  notableObjects: Record<string, NotableObjectMeta>;
  inventory: InventoryItem[];
}
```

### 10b. State Manager (`src/state/state-manager.ts`)

New methods:
- `registerNotableObject(meta: NotableObjectMeta): void`
- `discoverObject(objectId: string): void` — sets `hidden: false`
- `collectObject(objectId: string): InventoryItem` — adds to inventory
- `useInventoryItem(objectId: string, location: string): void` — marks used
- `getInventory(): InventoryItem[]`
- `getObjectsAtLocation(location: string): NotableObjectMeta[]`
- `getVisibleObjectsAtLocation(location: string): NotableObjectMeta[]`

### 10c. Location Journal (`src/ui/location-journal.ts`)

- Render notable objects as indented children under parent locations
- Show state icons: `???` (hidden), object name (discovered), `已收集` (collected)

### 10d. Bottom Strip (`src/ui/bottom-strip.ts`)

- Add inventory button (🎒) with badge count
- Move quest journal button to bottom strip game row (📜) with badge count
- Badge logic: inventory = non-used items; journal = active quests + unsolved mysteries

### 10e. New UI Files

- `src/ui/inventory-panel.ts` — inventory dropdown/modal
- Modify `src/ui/quest-journal-modal.ts` → add mystery section alongside existing quest display

### 10f. Scenario Template (`documents/scenario_overview_template.json`)

Add `mysteries` and `notableObjects` fields (see Sections 2c and 4c).

### 10g. Orchestrator Integration (`src/orchestrator/orchestrator.ts`)

- On location change: check for discoverable objects, inject discovery hints
- On UA eval result: process `mysteryProgress` and `objectInteraction` fields
- On mystery revelation: trigger trait reward flow
- On session start: inject rumor seeding prompt into welcome message


---

## 11. Interaction with Other Systems

### 11a. Pacing System

- Exploration module can register pacing drivers via `getPacingDrivers()` hook
- Example: "An NPC casually mentions a rumor about a nearby mystery" when pacing counter fires and player hasn't progressed any mystery recently
- Pacing events can nudge players toward mystery locations without solving for them

### 11b. Combat Module

- Notable objects can exist in combat-relevant locations. No conflict — combat state is ephemeral, objects persist.
- A mystery step could be at a location where combat also occurs. Both systems process independently.
- Future: a mystery could require defeating an enemy to progress (combat module sets a flag, exploration module reads it). Not in scope for beta.

### 11c. Erotic Module

- No direct interaction. Mysteries are thematic/adventure-focused.
- A scenario could theoretically define a mystery with erotic elements via its narrative framing, but the mechanical system doesn't care.

### 11d. Bottleneck Quests

- Bottleneck quests and mysteries share the journal UI but are independent systems.
- A bottleneck quest can fire at the same time as a mystery step completes. Both are tracked and displayed separately.
- No priority conflict — quests gate affection, mysteries gate trait rewards.

### 11e. Trait System

- Mystery revelation is a **third trait granting path** alongside level-up and affection milestones.
- Uses the same `GameTrait` type, same trait generator agent, same picker modal.
- Grants to both player AND NPC (unique to mysteries — milestones only grant to one NPC).
- Same trait cap rules apply.

### 11f. Lore System

- A new lore entry type `mystery` could be added for the Arcanum workshop to reference when building scenarios. Not required for beta — scenario JSON is sufficient.


---

## 12. Mystery-Less Scenarios

- If `mysteries` array is empty or absent in scenario JSON, no mysteries are initialized.
- If the Exploration Module is not selected at session setup, mysteries are ignored even if defined in scenario JSON.
- The journal button still appears (for bottleneck quests) but the mystery section shows "本場景無謎團" or is hidden entirely.
- Notable objects defined in `notableObjects` still register if the scenario defines them, even without the module. They appear in the location journal as flavor entries.


---

## 13. Scenario Workshop Integration

The scenario workshop form gets a new optional section: **Mysteries**.

### 13a. Workshop Fields

| Field | Type | Constraints |
|-------|------|-------------|
| Mystery title | text | ≤8 chars Traditional Chinese |
| Rumor text | text | ≤60 chars |
| Puzzle text | text | ≤80 chars |
| Steps | repeater (1-4) | location (dropdown from defined locations) + object name + description + hint + portable toggle + hidden toggle |
| Puzzle starts at step | number | 0 to (step count - 1) |
| Related NPCs | multi-select | from defined NPCs |
| Trait hints | dropdowns | player: trait type, npc: trait type |

### 13b. AI Assistant Support

The scenario workshop AI assistant can help authors design mysteries:
- Input: scenario theme, locations, NPCs, worldview
- Output: suggested mystery chains that use existing locations and involve defined NPCs
- Validation: ensures all referenced locations and NPCs exist in the scenario


---

## 14. Resolved Design Decisions

1. **Notable objects are app-level, mysteries are module-level.** Objects enrich the location journal for any scenario. Mysteries are a gameplay layer that requires the module.
2. **No real puzzle difficulty.** Lenient UA detection means players basically auto-solve by exploring. The challenge is finding and going to the right places, not logic.
3. **No mid-session mystery generation.** All mysteries defined at scenario authoring time, initialized at session start. Keeps scope bounded and author-controlled.
4. **Player inventory is global and simple.** No per-NPC items. No crafting. No weight limits. Just a list of picked-up objects.
5. **Trait rewards generated at resolution time.** Context-aware generation using the existing trait generator agent, not pre-baked. More narratively satisfying.
6. **Journal UI shared between quests and mysteries.** Single button, single panel, two sections. Reduces UI clutter.
7. **Max 3 mysteries, 1-2 objects per location.** Keeps token budget trivial and makes each location meaningful.
8. **DO commands for all interactions.** No new command syntax. UA eval infers intent leniently from DO (command mode) or freeform prose (narrative mode).
9. **All mysteries start as rumors at turn 0.** Welcome message seeds them narratively. Player opens journal and sees them immediately.
10. **Objects discovered on location visit.** Client reveals, LLM narrates. One-turn flow, no player action needed for discovery (only for collection/interaction).


---

## 15. Open Questions

None at this time. Design is complete pending implementation.
