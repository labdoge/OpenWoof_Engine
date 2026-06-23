# Mechanics System Design Memo

**Date:** 2026-03-15
**Status:** Partially implemented. Trait system implemented in `src/modules/trait-system.ts` (GameTrait replaces Ability). Item/lore-mechanics integration not yet implemented.
**Purpose:** Preparation for combat and adventure modules — adding mechanical items, abilities, and trait info cards to the narrative engine.
**Note:** Ability system (Sec 2) has been replaced by the unified Trait system (4 types: narrative/harm/aid/utility, 2 ranks: normal/great). Item-as-lore-entry concept (Sec 1) is designed but not yet implemented.

---

## 1. Design Principle

**LLM narrates, client bookkeeps.**

- The LLM decides what happens narratively; the client tracks the state that results.
- The UA bridges the two: extracts structured data from narrative output.
- The client never decides narrative outcomes; the LLM never does arithmetic.

---

## 2. Lore Entry as Unified Definition Layer

Items, abilities, and mechanically-significant traits are all **lore entries** (`LoreEntry`). No separate item or ability system. Lore IS the definition layer.

### New Field: `mechanics?: LoreMechanics`

A single optional field on `LoreEntry`, purely client-side (never injected into prompts).

```typescript
interface LoreMechanics {
  // ---- Item semantics ----
  stackable?: boolean;       // count > 1 allowed
  maxCount?: number;         // stack cap (default 1 if not stackable)
  equippable?: boolean;      // shows equip toggle
  slot?: string;             // 'weapon' | 'accessory' | custom — one per slot
  consumable?: boolean;      // destroyed on use

  // ---- Ability semantics ----
  cost?: { resource: string; amount: number }[];
    // resource = 'mp' | 'hp' | a loreId (consuming an item) | any module variable key
  cooldown?: number;         // turns between uses (0 = no cooldown)

  // ---- Dice integration ----
  diceModifier?: {
    trigger: string;         // freeform tag: 'attack', 'persuade', 'stealth'
    bonus: number;           // +/- modifier
  }[];

  // ---- Display hint ----
  icon?: string;             // emoji or icon key for status row
}
```

**Why this shape:**
- Flat and declarative — no logic, no conditionals, just data.
- `cost.resource` is a string key — resolution logic lives in the consuming module, not the lore entry.
- `diceModifier.trigger` is freeform — modules define which triggers they recognize.
- No `effect` or `script` field — LLM handles outcomes; mechanics only track resources.

### Two Consumers, One Entry

| Field | Consumer | Purpose |
|-------|----------|---------|
| `content` | LLM (prompt injection) | Narrative description — what the LLM reads |
| `mechanics` | Client (UI + validation) | Structured data — what the client enforces |

These are decoupled. The LLM sees "a healing potion, limited supply." The client sees `{ consumable: true, count: 3 }`.

---

## 3. Traits Link to Lore

Mechanically-significant traits gain a `linkedLoreId` field pointing to a lore entry of type `'trait'` or `'ability'`. The trait system stays simple; the mechanical weight lives in lore.

- Most narrative traits (e.g., "口是心非") have no mechanics and no `linkedLoreId`.
- Only mechanically-significant traits get linked lore entries.
- The lore highlighter renders info cards for linked traits using the lore entry data — no new UI pattern needed.

---

## 4. Three Sources, Same Destination

### Source 1: Scenario-authored
Pre-written lore entries with both `content` and `mechanics`. Exist before the session starts.

### Source 2: User-authored (Arcanum Workshop)
Workshop form gets a `mechanics` section, conditional on `type` being `item` or `ability`. Structured fields, no code.

### Source 3: Mid-session generated (UA bridge)
LLM narrates acquisition → UA detects in existing eval call → UA returns structured `newItems[]` → client creates `LoreEntry` with `content` + `mechanics`.

The UA generates the `mechanics` field, not the main session LLM.

For scenario-defined items that appear mid-session: scenario can include dormant lore entries with initial hidden state. UA detects acquisition → activates the entry.

---

## 5. Info Cards for Traits, Items, and Abilities

Extend the existing lore highlighter pattern:
- Lore highlighter already wraps lore titles in `<span class="lore-highlight">` with hover cards.
- Extend to also match trait names and item-type lore entries in narrative output.
- Same hover card pattern, different data sources.
- Mechanically-tracked entries show additional info: equipped state, count, dice bonus, cost, etc.

### Export Button

Info cards for mid-session generated items/abilities include a **"📖 加入知識庫"** button:
- Saves the entry permanently to the active Arcanum's lorebook.
- Sets `entry.source = 'user'` (was `'generated'`).
- Links to `activeArcanumId`.
- Button changes to "✓ 已加入" (disabled, confirmed state).
- Entry now appears in future sessions using the same Arcanum.
- Once exported, the entry is **permanent** — same as user-written lore.

---

## 6. New Source Type: `'generated'`

`LoreEntry.source` gains a new value: `'generated'`.
- Created by UA mid-session.
- Lives in session runtime state only (not written to lore DB).
- Active for the duration of the session, injected into Block 2/3 as needed.
- Vanishes when the session ends (no DB cleanup needed).
- Export button flips to `'user'` and persists to DB + links to Arcanum.

---

## 7. Prompt Architecture: Block Placement

### Definitions → Block 2 (semi-stable, cached)
Item/ability/trait descriptions (`content` field). Stable once acquired. Cache busts only on acquisition or loss events (infrequent).

### State Summary → Block 3 (dynamic, never cached)
Compact inventory + ability status line. Changes every turn. ~40-60 tokens.

```
[持有物品] 寒霜古劍(裝備中)、靈力回復藥×3、解鎖鑰匙
[技能狀態] 火焰箭(就緒)、治癒術(冷卻1回合)
```

### Cache Lifecycle Example

```
Turn 12: Player finds sword
  → UA detects → LoreEntry created → auto-promote to Block 2
  → Block 2 cache busts once, re-caches
  → Block 3 inventory summary adds entry

Turn 13: Player equips sword
  → Client updates mechanics state (equipped: true)
  → Block 3 summary changes → Block 2 unchanged, cache holds ✓

Turn 20: Player uses potion
  → Client decrements count 3→2
  → Block 3 summary changes → Block 2 unchanged, cache holds ✓

Turn 35: Player loses sword
  → UA detects → demote from Block 2, deactivate entry
  → Block 2 cache busts once
```

---

## 8. Token and Latency Impact

### Token Cost

| Area | Delta | Notes |
|------|-------|-------|
| `mechanics` field | **+0** | Client-only, never injected |
| UA eval system prompt | **+200-300 fixed** | Item/ability extraction instructions |
| UA eval output | **+50-100/turn** | Only when changes occur |
| Block 3 inventory summary | **+40-60/turn** | Compact state line |
| Block 2 item definitions | Within existing 2000 budget | Items compete within lore budget |

### Latency

| Operation | Impact |
|-----------|--------|
| Main session response | None — no extra LLM calls |
| UA eval (background) | +50-100ms — slightly larger output, non-blocking |
| Mid-session item creation | None — part of existing UA eval call |
| Keyword detection | Negligible — client-side string matching |
| Status window render | Negligible — a few more DOM elements |
| Dice resolution | Negligible — client-side arithmetic |

---

## 9. Status Window Integration

### Items: New Row
- Items display in a dedicated row in the status window.
- States: equipped, count (for consumables/stackables), linked mechanics (dice bonuses).
- Uses existing `StatusItemDeclaration` system with module manifests.

### Abilities: Part of Trait Row
- Abilities display alongside traits in the status window.
- Some abilities consume resources (items, MP, etc.).
- Grayed out when resources insufficient.
- Cooldown display when on cooldown.

### Module Extensibility
- Combat module reads `diceModifier` from mechanics.
- Adventure module reads `cost` from mechanics.
- Lore entries don't know which module consumes their data.

---

## 10. Session Runtime State for Un-exported Items

Un-exported `'generated'` entries live in session runtime state only:
- Stored in session memory (e.g., within `LoreRuntimeState` or a dedicated `sessionItems` list).
- Never written to the lore DB.
- Injected into Block 2/3 during the session.
- Vanish on session end — no orphaned DB records.

Exported entries (`source: 'user'`) are written to lore DB via `saveLoreEntry()` and linked to the active Arcanum. They are permanent.

---

## 11. Open Questions for Implementation

1. **Separate item/ability token budget?** Currently items share the 2000-token lore budget. May want a dedicated ~500-token sub-budget if inventory grows large.
2. **Equipment slot system:** How many slots? Fixed list or freeform? Module-defined?
3. **MP/resource variables:** Where do non-item resources (MP, HP) live? Module state? Player state extension?
4. **Combat/adventure module scope:** How much mechanical depth? Lightweight narrative aid vs. full RPG subsystem?
5. **Workshop form UX:** How does the `mechanics` section in Arcanum Workshop look? Conditional fields based on lore type?
