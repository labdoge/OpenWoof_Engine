# Portal Page & Session Overhaul — Implementation Plan

> **Status**: All phases complete (2026-03-29).
> **Scope**: New landing page, session data model change, character-first flow, import expansion

---

## Overview

Replace the current Asset Browser-as-landing-page with a dedicated **Portal Page** featuring six major entry points in a carousel layout. Overhaul the session model to treat sessions as scenario forks (optionally paired with workshop character snapshots). Extract session management into a standalone **Session Browser** with rich filtering.

### What's Done

- **Portal Page** is the default landing view (replaces Asset Browser on startup)
- **Session Browser** accessible via "查看現有遊戲" button on portal page
- **Scenario Browser** overlay opens from Scenario portal card, shows searchable scenario grid
- **Character Browser** overlay opens from Character portal card, shows workshop characters → chains to Scenario Browser
- **Character-first flow**: pick workshop char → pick scenario → collision check → session starts with slot 0 pre-filled
- **Collision check**: `findConflictingSession()` → archive prompt before creating duplicate sessions
- **Asset Browser** is now pure CRUD (no session management — no Continue/New Game/Delete Session buttons)
- **Cancel paths** in session setup all return to Portal page (not Asset Browser)
- **Workshop Portal** sub-menu routes to all 3 workshops (character, scenario, arcanum)
- **Narrator Placeholder** shows "Coming Soon" overlay with WIP badge on portal card
- **SessionRecord** extended with archive status, lastPlayedAt, workshopCharacterId, denormalized metadata
- **Session flow** wired: `onReturnToLanding` / `onLeaveLanding` callbacks manage portal visibility
- Cog menu "New Game" returns to portal page instead of asset browser

### What Remains

All phases complete. No remaining work.

---

## Phase 1: Data Model & Storage Foundation ✅ Complete (2026-03-29)

**Goal**: Extend `SessionRecord` and storage layer to support the new session-as-save model before any UI work.

### Implementation Notes

- `SessionStatus` type alias exported from `src/storage/sessions.ts` — used across storage backends
- All new fields optional except `lastPlayedAt` — migration-safe for existing sessions
- `SessionStore` interface in `src/storage/backends/types.ts` updated with `updateStatus()` method
- `src/ui/asset-browser.ts` and `src/ui/document-browser.ts` updated to handle `'archived'` status
- `src/workshop/workshop-session.ts` populates `lastPlayedAt` in `buildSessionRecord()`

### 1.1 SessionRecord Schema Changes

File: `src/storage/sessions.ts`

```typescript
export type SessionStatus = 'active' | 'in_progress' | 'completed' | 'archived';

export interface SessionRecord {
  sessionId: string;
  type: 'gameplay' | 'character_workshop' | 'scenario_workshop';
  scenarioId: string;
  workshopCharacterId?: string;
  createdAt: number;
  lastPlayedAt: number;
  lastTurn: number;
  gameState: GameState;
  contextRecap: string;
  status: SessionStatus;
  outputId?: string | null;
  characterNames?: string[];
  moduleIds?: string[];
  arcanumId?: string;
  scenarioTitle?: string;
  scenarioGenre?: string;
  scenarioTones?: string[];
}
```

### 1.2 Unique Constraint Enforcement

```typescript
export async function findConflictingSession(
  workshopCharacterId: string,
  scenarioId: string,
): Promise<SessionRecord | undefined>
```

### 1.3 Archive Operation

```typescript
export async function archiveSession(sessionId: string): Promise<void>
```

### 1.4 StatePersistence Updates

- `saveState()` refreshes `lastPlayedAt = Date.now()` on every save

### 1.5 Migration

- Purely additive — no destructive changes. Existing sessions work unchanged.

---

## Phase 2: Portal Page UI ✅ Complete (2026-03-29)

**Goal**: New landing page component with 6-portal carousel, replacing the current entry point.

### Implementation Notes

- File: `src/ui/portal-page.ts` — `PortalPage` class with `PortalPageCallbacks` interface
- Icons served from `public/portal/*.png` (copied from `portal_icons/`)
- Carousel: `navigate(direction)` + `updateCarousel()` with CSS `translateX` percentage
- Responsive: `updateResponsiveCount()` — 4 cards ≥1200px, 3 ≥900px, 2 <900px
- Cycling navigation (wraps around at boundaries) — arrows always visible
- Narrator card has CSS `.portal-card-wip` badge ("WIP" corner ribbon)
- Portal page div added to `index.html`: `<div id="portal-page" class="portal-page hidden"></div>`
- `app.ts` creates portal as default view; `showPortal()` / `hidePortal()` manage visibility
- `sessionFlowDeps.onReturnToLanding` → `showPortal()`, `onLeaveLanding` → `hidePortal()`
- Cog "New Game" calls `showPortal()` instead of `assetBrowser.show()`

### Portal Cards

| # | Key | Icon File | Chinese Label | Current Action |
|---|-----|-----------|---------------|----------------|
| 1 | scenario | `scenario_portal.png` | 劇本冒險 | **Stub** → Asset Browser (Phase 4 replaces) |
| 2 | character | `character_portal.png` | 角色冒險 | **Stub** → Asset Browser (Phase 5 replaces) |
| 3 | asset_browser | `asset_browser_portal.png` | 素材瀏覽 | ✅ Opens Asset Browser |
| 4 | import | `import_portal.png` | 匯入素材 | **Stub** → Asset Browser (Phase 7 replaces) |
| 5 | workshop | `workshop_portal.png` | 創作工坊 | ✅ Opens Workshop Portal overlay |
| 6 | narrator | `narrator_mode_portal.png` | 敘事模式 | ✅ Opens Narrator Placeholder overlay |

---

## Phase 3: Session Browser ✅ Complete (2026-03-29)

**Goal**: Standalone session list component with sorting, filtering, and rich card display.

### Implementation Notes

- File: `src/ui/session-browser.ts` — `SessionBrowser` class with `SessionBrowserCallbacks`
- Opens from portal page "查看現有遊戲" button
- 6 sort options (last played / created date × asc/desc, name A→Z / Z→A)
- 3 status filter chips: "進行中" (active + in_progress merged), "已完成", "已封存"
- Text search with 300ms debounce, filters on scenario title + character names
- Session cards feature: scenario background image, all vital NPC portrait overlays (silhouette placeholders for NPCs without portraits), character name pills, genre/tone pills, relative time (`formatRelativeTime()`), status badge
- Actions: Resume, New Game, Archive (with confirm), Unarchive, Delete (archived only, with confirm)
- Archived cards have reduced opacity (0.7) and "已封存" badge
- `app.ts` wiring: `onResume` calls `sessionFlow.resumeSession()`, `onNewGame` opens asset browser with scenario preselected
- Module/lorebook filter chips planned but not yet populated (need populated session data)

---

## Phase 4: Scenario-First Flow Adaptation ✅ Complete (2026-03-29)

**Goal**: Wire the Scenario Portal to the existing session setup flow with minimal changes.

### 4.1 Scenario Browser Overlay

New file: `src/ui/scenario-browser-overlay.ts`

- Reuses scenario card rendering from Asset Browser (extract shared helpers)
- Grid of scenario cards with search/filter
- Each card: scenario image, title, genre, tone pills, NPC count
- Click → begins session setup flow (existing `startSession()`)
- Close button returns to Portal page

### 4.2 Session Setup Flow Updates

File: `src/ui/session-flow.ts`

- Accept optional `workshopCharacterId` parameter in `startSession()`
- When provided, populate `SessionRecord.workshopCharacterId` on save
- Run collision check (`findConflictingSession`) before proceeding
- If collision found → show archive prompt modal → on confirm, archive old session and continue

### 4.3 Shared Scenario Card Renderer

Extract scenario card HTML generation from `asset-browser.ts` into a shared utility so both Asset Browser and Scenario Browser Overlay can reuse it.

**Files touched**: new `src/ui/scenario-browser-overlay.ts`, `src/ui/session-flow.ts`, `src/ui/asset-browser.ts` (extract shared renderer)

---

## Phase 5: Character-First Flow ✅ Complete (2026-03-29)

**Goal**: New entry flow from Character Portal — pick a workshop character, then pick a scenario, then run normal setup with NPC slot #1 pre-filled.

### 5.1 Character Browser Overlay

New file: `src/ui/character-browser-overlay.ts`

- Grid of workshop character cards (from profiles with `scenarioId === '__workshop__'`)
- Each card: portrait (default expression), name, role, personality pills
- Click → selects character → opens Scenario Browser Overlay (Phase 4.1) as second step
- Close button returns to Portal page

### 5.2 Character-First Session Init

File: `src/ui/session-flow.ts` (extend `startSession`)

Flow:
1. User picks workshop character from Character Browser Overlay
2. Scenario Browser Overlay opens (character selection is remembered)
3. User picks scenario
4. Collision check: `findConflictingSession(workshopCharacterId, scenarioId)`
   - If conflict → archive prompt → on confirm, archive old session
5. Arcanum selection (existing flow)
6. Lorebook integration — scenario level (existing flow)
7. **Character Setup Flow** runs, but with NPC slot #1 **pre-filled**:
   - The chosen workshop character's profile is loaded and used for slot #1
   - User sees the character card but cannot re-pick slot #1 (it's locked)
   - Remaining NPC slots proceed normally (import or generate)
8. Lorebook integration — character level (existing flow)
9. Module setup (existing flow)
10. Game begins

### 5.3 CharacterSetupFlow Changes

File: `src/ui/character-setup-flow.ts`

- `run()` accepts optional `prefilledSlot0?: ProfileRecord`
- When provided, skip the choice UI for slot 0 — directly use the prefilled profile
- Show a brief confirmation card ("Using [character name] as [role]") instead of the pick/generate/import choice
- All subsequent slots proceed normally

**Files touched**: new `src/ui/character-browser-overlay.ts`, `src/ui/session-flow.ts`, `src/ui/character-setup-flow.ts`

---

## Phase 6: Asset Browser Refactor ✅ Complete (2026-03-29)

**Goal**: Strip session management from Asset Browser, making it a pure CRUD browser for characters, scenarios, and worldbooks.

### 6.1 Remove Session Display

File: `src/ui/asset-browser.ts`

- Remove session cards from scenario tab
- Remove "Resume" / "New Game" / "Delete Session" buttons from scenario cards
- Remove session grouping logic
- Keep: character CRUD, scenario CRUD, worldbook CRUD, search, bundled sync

### 6.2 Simplify Callbacks

- Remove `onStartNewSession`, `onResumeSession` callbacks
- Keep `onEditProfile`, `onEditScenario`, `onNewArcanum`, `onEditArcanum`
- Add scenario/character export and import actions if not already present

### 6.3 Asset Browser Portal Integration

- Asset Browser opens from Portal page's "素材瀏覽" card
- Closes back to Portal page (not to session)

**Files touched**: `src/ui/asset-browser.ts`, `src/ui/app.ts` (callback wiring)

---

## Phase 7: Import Portal ✅ Complete (2026-03-29)

**Goal**: Unified import hub for characters, scenarios, lorebooks via JSON or PNG (including TavernCard conversion).

### 7.1 Import Portal Overlay

New file: `src/ui/import-portal.ts`

**Layout**: Modal overlay with:
- Drop zone (drag-and-drop file area)
- "Choose File" button
- File type detection: `.json` or `.png`
- After detection, show import type selector:

**For `.json` files**:
- Auto-detect content type by schema inspection (character profile, scenario, lorebook, lore entry)
- Show preview with detected type badge
- "Import" button → save to appropriate store

**For `.png` files**:
- Check for embedded tEXt metadata (TavernCard detection)
- If TavernCard found → show conversion target selector:
  - Convert to Character (existing flow via `tavern-card-converter.ts`)
  - Convert to Scenario (new — Phase 7.2)
  - Convert to Lorebook + Lore Entries (new — Phase 7.3)
- If no metadata → treat as portrait image, offer to attach to existing character

### 7.2 TavernCard → Scenario Conversion

New file or extend: `src/importers/tavern-card-converter.ts`

- New LLM conversion prompt: extract TavernCard's `scenario`, `world_scenario`, `system_prompt` fields → map to DogeChat ScenarioRecord structure
- Extract `character_book` world entries → scenario's worldbuilding context
- Lower confidence expected (TavernCards are character-centric, scenarios need more structure)
- Review flow similar to character import — show preview, allow edits before save

### 7.3 TavernCard → Lorebook Conversion

New file or extend: `src/importers/tavern-card-converter.ts`

- Extract `character_book` entries from TavernCard V2
- Each entry → DogeChat LoreEntry with keywords, content, type classification
- Auto-create a parent Arcanum record to hold the entries
- Review flow: show all entries in a list, allow individual edit/remove before save

### 7.4 JSON Schema Detection

New helper: `src/importers/json-detector.ts`

```typescript
type DetectedType = 'character' | 'scenario' | 'arcanum' | 'lore_entry' | 'unknown';
function detectJsonType(data: unknown): DetectedType
```

- Inspect field signatures: `npcId` + `personality` → character, `genre` + `locations` → scenario, etc.
- Used by Import Portal to auto-route JSON files

**Files touched**: new `src/ui/import-portal.ts`, new `src/importers/json-detector.ts`, extend `src/importers/tavern-card-converter.ts`, `src/locale/zh-TW.ts`

---

## Phase 8: Workshop Portal & Narrator Placeholder ✅ Complete (2026-03-29)

**Goal**: Workshop sub-menu and narrator WIP state.

### Implementation Notes

- File: `src/ui/workshop-portal.ts` — `WorkshopPortal` class + `showNarratorPlaceholder()` function
- Workshop overlay uses `.wp-overlay` / `.wp-panel` / `.wp-grid` / `.wp-card` CSS classes
- 3 workshop cards with emoji icons (🎭📖🌐), labels, and description subtitles
- `app.ts` wiring: workshop cards call existing `charWorkshopForm.show()`, `scenarioWorkshopForm.show()`, `arcanumWorkshop.show()`
- Narrator placeholder: `.wp-panel--narrow` variant with `.np-icon` (grayscale + reduced opacity) and `.np-desc`
- Narrator portal card on main carousel has corner WIP badge via `.portal-card-wip::after`

---

## Phase Dependencies

```
Phase 1 (Data Model)        ✅
  ↓
Phase 2 (Portal Page)       ✅ ──→ Phase 3 (Session Browser)  ✅
  ↓                                        ↓
Phase 4 (Scenario Flow)     ✅ ←──────────┘
  ↓
Phase 5 (Character Flow)    ✅
  ↓
Phase 6 (Asset Browser)     ✅

Phase 7 (Import Portal)     ✅  Complete (2026-03-29)
Phase 8 (Workshop+Narrator) ✅  — independent, complete
```

All phases complete.

---

## Files Created (Phase 1–3, 8)

| File | Phase | Purpose |
|------|-------|---------|
| `src/ui/portal-page.ts` | 2 | ✅ Landing page with 6-portal carousel |
| `src/ui/session-browser.ts` | 3 | ✅ Standalone session list with sort/filter |
| `src/ui/workshop-portal.ts` | 8 | ✅ Workshop sub-menu overlay + narrator placeholder |
| `public/portal/*.png` | 2 | ✅ Portal icon images (6 files) |

## Files Modified (Phase 1–3, 8)

| File | Phase | Changes |
|------|-------|---------|
| `src/storage/sessions.ts` | 1 | ✅ SessionStatus type, schema extension, archive/conflict helpers |
| `src/storage/backends/types.ts` | 1 | ✅ SessionStore uses SessionStatus, added updateStatus() |
| `src/workshop/workshop-session.ts` | 1 | ✅ buildSessionRecord() populates lastPlayedAt |
| `src/ui/app.ts` | 2,3,8 | ✅ Portal as default view, session browser + workshop portal wiring |
| `src/ui/session-flow.ts` | 2,3 | ✅ onReturnToLanding / onLeaveLanding callbacks |
| `src/ui/asset-browser.ts` | 1 | ✅ Skip archived sessions in session map |
| `src/ui/document-browser.ts` | 1 | ✅ Handle archived status display |
| `src/locale/zh-TW.ts` | 2,3,8 | ✅ Portal, session browser, workshop locale strings |
| `styles/main.css` | 2,3,8 | ✅ Portal page, session browser, workshop portal styles |
| `index.html` | 2 | ✅ Added portal-page div |

## Files To Create (Phase 4–7)

| File | Phase | Purpose |
|------|-------|---------|
| `src/ui/scenario-browser-overlay.ts` | 4 | Scenario picker overlay (shared with character-first flow) |
| `src/ui/character-browser-overlay.ts` | 5 | Workshop character picker overlay |
| `src/ui/import-portal.ts` | 7 | Unified import hub |
| `src/importers/json-detector.ts` | 7 | Auto-detect JSON content type |

## Files To Modify (Phase 4–7)

| File | Phase | Changes |
|------|-------|---------|
| `src/ui/session-flow.ts` | 4,5 | workshopCharacterId support, collision check UI, character-first init |
| `src/ui/character-setup-flow.ts` | 5 | Accept prefilled slot 0 |
| `src/ui/asset-browser.ts` | 4,6 | Extract shared renderer, strip session management |
| `src/importers/tavern-card-converter.ts` | 7 | Scenario + lorebook conversion modes |
| `src/ui/app.ts` | 4,5,6,7 | Replace portal stub callbacks with real overlays |
