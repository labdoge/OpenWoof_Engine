# Succession System Design

> **Status**: Design — not yet implemented
> **Replaces**: Cross-Scenario Echo system (to be removed)

## Overview

The Succession System enables Workshop characters to carry accumulated experiences and abilities across scenarios. When a Workshop character is imported into a new scenario, the player can choose which past memories (Critical Event sets) and traits to bring forward, creating a sense of continuity and growth.

## Design Principles

- Workshop profile is the **master** record; scenarios get **forks**
- Player controls what carries over — never automatic
- Scenarios can opt out via `allowSuccession: false`
- Same-scenario sessions: **no change** to current flow

---

## 1. Scenario Succession Gate

### New Scenario Field

```json
{
  "allowSuccession": true
}
```

- **Default**: `true` (most scenarios allow succession)
- **When `false`**: blocks CE carry-over, trait carry-over, and affection bonus entirely — character starts fresh
- Editable in Scenario Workshop form
- Stored in scenario JSON, read at session init

### Implementation

- Add `allowSuccession?: boolean` to scenario template (`scenario_overview_template.json`)
- Scenario Workshop form: checkbox toggle under a "Progression" or "Advanced" section
- Session lifecycle reads this field before showing succession UI steps

---

## 2. Critical Event Carry-Over

### Current State

- CEs are stored in IndexedDB keyed by `[npcId, scenarioId]`
- Same-scenario CEs inject into Block 2/3 — **no change here**
- Cross-scenario CEs currently feed the Echo system (to be removed)

### New Flow (Cross-Scenario Import)

When importing a Workshop character into a scenario they haven't been in before:

1. Query all CE sets for this `npcId` across all scenarios (excluding current)
2. Group by `scenarioId` → display as selectable sets
3. **CE Selection UI**: show each set as a card:
   - Scenario title + date range (earliest → latest CE `createdAt`)
   - Event count badge
   - "Details" button → expands to show full CE list (scene, hype, description)
4. Player picks **0 to 3** sets
5. Selected CEs are injected into **Block 1** (stable/cached) as `[SYSTEM: Previous Memories]`

### Affection Bonus

- Each selected CE set grants **+10 affection points** to the NPC's starting value
- Base: 20 (default) → max with 3 sets: **50**
- Applied during profile fork creation, before session state init
- Formula: `startingAffection = max(scenarioDefault, 20) + (selectedCESets.length × 10)`
- Cap: 50 (hard limit regardless of scenario default)

### Block 1 Injection Format

```
[SYSTEM: Previous Memories — {npcName}]
The following are emotionally significant events from {npcName}'s past with the player, carried from previous scenarios. They color the NPC's trust, expectations, and emotional baseline.

=== {scenarioTitle1} ===
- {scene}, {time}, {hype}: {description} [persona: {personaName}]
- {scene}, {time}, {hype}: {description} [persona: {personaName}]
...

=== {scenarioTitle2} ===
- {scene}, {time}, {hype}: {description} [persona: {personaName}]
...

[RECALL DIRECTIVE: These memories are alive — not dormant background. {npcName} should actively weave them into conversation when context is fitting:
- During casual talk or downtime: reminisce, compare current situation to past events, express lingering emotions (gratitude, resentment, nostalgia, unresolved feelings).
- At personal milestones or emotionally charged moments: surface deeper memories — a betrayal that still stings, a sacrifice that earned lasting trust, a promise not yet kept.
- Reference memories naturally through dialogue, body language, or inner thought — never recite them as a list. Paraphrase, allude, let emotion color the retelling.
- Frequency: at most once every 3-4 turns when relevant. Not every turn, but never forgotten either. The NPC carries these experiences forward.]
```

### Persona Recognition

Each CE line includes a `[persona: {name}]` tag. When the current player persona matches a persona in the memories, the NPC should show **recognition and continuity** — they remember this specific person. When the persona differs or is absent (legacy records), the NPC treats the memory as involving **a different acquaintance** and does not conflate identities.

---

## 3. Trait System Changes

### NPC Traits

| Property | Old Value | New Value |
|----------|-----------|-----------|
| `MAX_NPC_TRAITS` | 7 | **10** (workshop master cap) |
| Session starting traits | varies | **always 5** |
| Cross-scenario carry-over | none | 3-5 from master, remainder generated |

### Workshop Master Trait Accumulation

- All `gameplayTraits` from any scenario session flow back to the Workshop master profile
- **Flow-back timing**:
  - **Workshop characters** (have a `__workshop__` master): immediate, at the moment a trait is acquired mid-session
  - **Non-workshop NPCs** (generated during setup or mid-session): traits saved when exported to Workshop via Asset Browser
- Workshop master `gameplayTraits` cap: **10**
- Excess traits beyond 10: stored on the master (no silent discard), but user must prune to 10 before next import

### Import Trait Selection Flow

When importing a Workshop character into a new scenario (and `allowSuccession: true`):

1. **If master has >10 traits**: show Trait Pruning step first — user reduces to 10
2. **Trait Carry-Over Picker**: user selects **3 to 5** traits from the master's pool
3. **If fewer than 5 selected**: Creative Ops generates the remainder based on scenario context
4. **If master has <3 traits**: all are carried + Creative Ops generates to fill to 5
5. Result: NPC always enters session with exactly **5 traits**

### Trait Generation (Fill Remainder)

- Uses existing `trait-generator.ts` with Creative Ops model slot
- Generation context includes: scenario setting, NPC role/personality, already-selected carry-over traits
- Mode: `'npc-trait'`
- Output: enough `GameTrait` objects to bring total to 5

### Player Persona Traits

| Property | Value |
|----------|-------|
| Cap per persona | **15** (unchanged from `MAX_PLAYER_TRAITS`) |
| Session carry-over | **all traits** — no selection step, all persona traits enter session |
| Cross-session flow-back | existing `saveTraitsToPersona()` mechanism |

---

## 4. Profile Forking

### Current Behavior

When a Workshop character is imported (adopted) into a scenario, the session lifecycle copies fields from the Workshop profile to create a scenario-scoped profile with `scenarioId = actualScenarioId`.

### New Behavior

The fork is made explicit:

1. **Workshop master** (`scenarioId: '__workshop__'`): the canonical record. Accumulates traits from all scenarios. Never modified by session gameplay directly.
2. **Scenario fork** (`scenarioId: actualScenarioId`): created on first import. Session gameplay modifies this copy.
3. **Trait flow-back**: when a scenario fork's NPC acquires a new trait, it is also written to the Workshop master's `gameplayTraits[]` (if the master exists).

### Flow-Back Implementation

```
NPC acquires trait in session
  → save to scenario fork's npcTraitsGained (existing)
  → if Workshop master exists for this npcId:
      → append to master's gameplayTraits[] (deduped by trait name)
      → save master profile
```

Triggered at:
- `stateManager` trait acquisition (for Workshop characters — immediate)
- `exportToWorkshop()` (for non-Workshop NPCs — on user action)

---

## 5. Echo System Removal

### Files to Remove / Modify

| Action | File |
|--------|------|
| Delete | `src/agents/summary-generator.ts` |
| Delete | `src/storage/cross-scenario-summaries.ts` |
| Remove store | `crossScenarioSummaries` from storage backends (IndexedDB, file-backend, types) |
| Remove fields | `_echoesEnabled`, `_crossScenarioProseSummaries`, `_pendingEchoInjection` from orchestrator |
| Remove UI | Echo toggle from settings, echo-related locale strings |
| Remove eval fields | `echoInjection` from UA eval input/output |
| Remove constants | `CROSS_SCENARIO_SUMMARY_LLM_CONFIG` |
| Clean up | Module injector Block 2i reserved comment |

---

## 6. Trait Management UI

### Asset Browser — NPC Trait Section

Add a "Traits" section to the Workshop character detail view in Asset Browser:

- **Display**: each trait as a card/pill showing:
  - Trait name + type badge (narrative/harm/aid/utility)
  - Rank indicator (normal/great)
  - Source scenario label (which scenario it was earned in)
  - Remove button (×)
- **Overflow warning**: if count > 10, show banner: `「特質超過上限（N/10）— 請在匯入前精簡」`
- **Interaction**: remove individual traits, reorder via drag or move-up/down buttons
- **Persistence**: changes save directly to Workshop master profile's `gameplayTraits[]`

### Persona Trait Management Modal

New dedicated modal for managing player persona traits (accessible from persona list or persona edit):

- **Display**: same card layout as NPC traits, showing all persona traits
- **Cap**: 15 per persona (matches `MAX_PLAYER_TRAITS`)
- **Overflow warning**: if count > 15, show banner
- **Actions**: remove individual traits, reorder
- **Access points**:
  - Button in `persona-list-modal.ts` (per-persona "Manage Traits" action)
  - Section in `persona-modal.ts` (edit persona flow)
- **Persistence**: `saveTraitsToPersona(personaId, traits)`

---

## 7. Session Lifecycle Changes

### New Pre-Session Steps (after character selection, before session start)

For each Workshop NPC being imported into a **new scenario** where `allowSuccession: true`:

```
Step 1: Trait Overflow Pruning (conditional)
  ├─ Only if master.gameplayTraits.length > 10
  ├─ Show pruning UI → user reduces to 10
  └─ Save pruned list to master

Step 2: Trait Carry-Over Selection
  ├─ Show master's traits (up to 10)
  ├─ User picks 3-5 to carry
  ├─ If picked < 5 → queue Creative Ops generation for remainder
  └─ If master has < 3 traits → carry all + queue generation to fill to 5

Step 3: CE Set Selection
  ├─ Load all CE sets for this npcId (excluding current scenario)
  ├─ Group by scenarioId → show as selectable cards
  ├─ User picks 0-3 sets
  └─ Calculate affection bonus: +10 per set

Step 4: Generate Remaining Traits (if needed)
  ├─ Creative Ops call with scenario context + carried traits
  └─ Fill to exactly 5 total
```

For NPCs in same-scenario sessions: **no change** — existing memory prompt modal flow applies.

### Modified Session State Init

```typescript
// Pseudo-code for succession-aware NPC init
const startingAffection = Math.min(
  50,
  Math.max(scenarioDefault, 20) + selectedCESets.length * 10
);

const npc = stateManager.addNPC(npcId, name, {
  affection: startingAffection,
  // ... other fields from fork
});

// Set session traits (always 5)
npc.npcTraitsGained = [...carriedTraits, ...generatedTraits]; // exactly 5
```

---

## 8. Data Model Changes

### ProfileRecord Additions

```typescript
interface ProfileRecord {
  // ... existing fields ...

  /** Source scenarios for each gameplay trait (for UI display). Keyed by trait name. */
  traitSources?: Record<string, string>; // traitName → scenarioTitle
}
```

### Scenario JSON Addition

```json
{
  "allowSuccession": true
}
```

### Constants Changes

```typescript
export const MAX_NPC_TRAITS = 10;           // was 7
export const NPC_SESSION_TRAIT_COUNT = 5;    // new: always start with 5
export const MAX_SUCCESSION_CE_SETS = 3;    // new: max CE sets to carry
export const SUCCESSION_AFFECTION_PER_SET = 10; // new: +10 per CE set
export const SUCCESSION_AFFECTION_CAP = 50;     // new: hard cap
export const MIN_CARRY_TRAITS = 3;          // new: minimum traits to carry if available
export const MAX_CARRY_TRAITS = 5;          // new: max traits to carry (= session count)
```

### Storage Changes

- Remove `crossScenarioSummaries` store from all backends
- No new stores needed — existing `npc_profiles` and `critical_events` stores suffice

---

## 9. UI Flow Summary

### Happy Path: Workshop NPC → New Scenario

```
Character Setup Flow
  → User picks Workshop character for a slot
  → Scenario has allowSuccession: true
  → System detects: first time in this scenario
  ┌─────────────────────────────────────┐
  │  Succession Modal                   │
  │                                     │
  │  ┌── Trait Selection ────────────┐  │
  │  │ ☑ 鐵壁防禦 (harm/great)      │  │
  │  │   from: 按摩院奇遇            │  │
  │  │ ☑ 察言觀色 (narrative/normal) │  │
  │  │   from: 機甲戰場              │  │
  │  │ ☐ 急救術 (aid/normal)         │  │
  │  │   from: 機甲戰場              │  │
  │  │ ...                           │  │
  │  │ Selected: 3/5                 │  │
  │  │ (2 will be generated)         │  │
  │  └──────────────────────────────┘  │
  │                                     │
  │  ┌── Memory Selection ───────────┐  │
  │  │ ☑ 按摩院奇遇 (6 events)      │  │
  │  │   2026-01-15 ~ 2026-02-03    │  │
  │  │   [Details]                   │  │
  │  │ ☐ 機甲戰場 (3 events)        │  │
  │  │   2026-02-10 ~ 2026-02-28    │  │
  │  │   [Details]                   │  │
  │  │ Selected: 1/3                 │  │
  │  │ Affection bonus: +10         │  │
  │  └──────────────────────────────┘  │
  │                                     │
  │         [Confirm]  [Skip All]       │
  └─────────────────────────────────────┘
  → Creative Ops generates 2 remaining traits
  → Fork profile created with affection 30
  → Session starts
```

---

## 10. Migration Notes

- Existing `gameplayTraits` on Workshop profiles remain valid — they become the master pool
- Existing `gameplayTraits` on scenario profiles remain valid — no migration needed
- Echo system removal is a clean delete — no data migration (summaries can be dropped)
- `MAX_NPC_TRAITS` increase from 7 → 10: backward compatible (existing NPCs just have headroom)
- Scenarios without `allowSuccession` field default to `true`
