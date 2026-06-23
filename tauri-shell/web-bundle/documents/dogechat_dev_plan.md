# DogeChat Engine — Technical Specification
# Development Plan & System Reference

**Document Version**: 1.0 (Beta Candidate)
**Status**: Core systems complete. 4 beta candidate features remaining.
**Target Coding Platform**: Claude Code (Terminal-Based Agentic IDE)

---

# TABLE OF CONTENTS

1. Project Overview
2. Confirmed Design Documents
3. System Architecture
4. Implementation Status
5. Module Specifications
6. API Adapter Specification
7. State Management Specification
8. Data Persistence Specification
9. Input System Specification
10. Memory & Context Management Specification
11. Portrait System Specification
12. UI Design
13. Workshop System Specification
14. Utility Agent Specification
15. Event Agent System Specification
16. Trait & Action Domain System
17. Arcanum System Specification
18. Remaining Work — Beta Candidate Features

---

# 1. PROJECT OVERVIEW

## 1.1 What Is This

A locally-hosted interactive fiction platform. **Release target: Tauri v2 desktop app only.** Browser runtime via the Vite dev server is retained as a development convenience (hot reload, no Rust toolchain required), but is NOT a shipping distribution format — production users get a Tauri-packaged desktop binary.

The engine uses LLM APIs (Claude / Gemini / xAI Grok) as the narrative backbone, with a structured system prompt and modular scenario files to produce a slow-burn, mechanically rich interactive fiction experience in Traditional Chinese.

## 1.2 Core Experience

- Player interacts via text input supporting multi-command sequences (e.g., `SPEAK:[...] DO:[...]`)
- LLM generates narrative responses in Traditional Chinese
- NPC relationships evolve through a Hype → Affection pipeline with bottleneck gates
- Lust tracks physical tension independently
- Up to 3 Major NPCs tracked simultaneously per scene
- **Three-agent architecture**: Main Session (narrative), Utility Agent (mechanical evaluation), Event Agent (combat/encounter resolution)
- Cross-session NPC memory via Critical Events system
- **Workshop system**: Create characters, scenarios, and world-building rules through guided AI conversations
- **Module system**: Self-contained game subsystems (combat, erotic content) with manifest-driven auto-discovery
- **Arcanum system**: Two-layer world-building knowledge (framework + lore entries) with keyword-triggered injection
- **Event system**: Generic UA → EA → Client pipeline for combat and encounters
- **Trait system**: Unified 4-type trait model replacing legacy abilities
- Mature/erotic content is a first-class feature, not an afterthought

## 1.3 Key Design Principles

- **Token Efficiency**: 15-reply conversation memory cap. Automatic background context compression. Three-block prompt caching. Pre-computed status rendering.
- **Mechanical Consistency**: Utility Agent is authoritative for Hype/Lust values. Client owns turn counter and dice resolution. LLM reads state, doesn't compute it.
- **Narrative Immersion**: Main LLM session focuses purely on storytelling. Mechanical tracking is external. No player-facing system commands for memory management.
- **API Agnosticism**: Content documents are shared. Only the transport layer differs between Claude, Gemini, and xAI/Grok.
- **Persistent Characters**: NPC identities and critical memories persist across sessions and scenarios. NPC Profiles auto-update every 5 Critical Events.
- **Creative Tools**: Character Workshop, Scenario Workshop, and Arcanum Workshop let players build content through conversational AI interfaces.
- **Module Decoupling**: Core engine compiles and runs without any module folder present. Modules enhance but never gate core functionality.
- **Client-Authoritative Mechanics**: Turn counter, dice rolls, damage distribution, action selection — all computed client-side, never by LLM.

---

# 2. CONFIRMED DESIGN DOCUMENTS

## 2.1 System Prompt (split into modular files)

- **`documents/core.md`**: IDENTITY, SETUP, NARRATIVE FORMAT, INPUT TYPES, ACTION RESOLUTION, TRAITS, PROGRESSION, HYPE (5-tier), LUST (5-tier), AFFECTION (8-tier, 4 bottlenecks), SCENE CONTEXT, CORE RULES.
- **`documents/erotic.md`**: MATURE CONTENT (vocabulary, focus, style) + DESCRIPTOR REFERENCE. Conditional: loaded when Lust ≥ 悶燒 or erotic context.
- **`documents/commands.md`**: RECALL command format + NPC PROFILE FORMAT. Conditional: loaded on RECALL input.
- **`documents/first_turn.md`**: First-turn specific narrative rules. Conditional: turn ≤ 1.
- **`documents/multi_npc.md`**: Multi-NPC scene dynamics. Conditional: ≥2 NPCs in scene.

## 2.2 Scenario Overview Template

**Location**: `documents/scenario_overview_template.json`

Schema: title, genre, tone, overall_goal, mission_profile, missions, npc_generation_pool (with optional appearance_guide/outfit_guide, wardrobe_rules), player_setup, world_races, initial_scene, locations, metaphysics_and_costs, legacy pacing_drivers, legacy bottleneck_quest_directions, background_npcs, world_common_sense.

Mission System v2 is the canonical scenario progression model:
- **Ambient Affection Missions**: NPC-first ambience and small player-facing requests. One active chain per major NPC, refreshable options, generous completion, optional +5 affection under the mission-led preset.
- **Bottleneck Breakthrough Missions**: scenario-linked affection gate missions at 30/50/70/90. Player-facing and refreshable, but strict completion because they unlock relationship caps.
- **Story Missions**: fixed, non-refreshable authored scenario beats stored in `missions.story.sequence`. Opt-in by scenario, current beat only, client-authoritative progression.

Legacy `pacing_drivers` remain valid as Ambient Mission generation seeds and as a fallback runtime path when Ambient Missions are disabled.

## 2.3 Bundled Scenarios (5)

| File | Setting |
|------|---------|
| `scenario_massage_parlor.json` | 台北半套店 |
| `scenario_naked_cleaning.json` | 疫情裸體家政 |
| `scenario_pandemic_sex_work.json` | 疫情外送茶 |
| `scenario_strip_club.json` | 脫衣舞俱樂部 |
| `scenario_mecha.json` | 機甲戰鬥 |

## 2.4 Utility Agent Prompts

| Prompt | File | Purpose |
|--------|------|---------|
| Hype/Lust Evaluation | `utility_eval_base.md` + conditional `utility_eval_*.md` sections | Per-turn mechanical eval + Ambient/Bottleneck/Story mission completion + event detection |
| Ambient Mission Generation | `utility_ambient_mission_gen.md` | 3 lightweight NPC-first mission options per major NPC |
| Context Compression | `utility_compress.md` | 800-token recap with 關鍵時刻 section |
| Profile Update | `utility_profile_update.md` | NPC Profile update every 5 CEs + session end |
| Status Extraction | `utility_status_extract.md` | Scene/NPC/player state as compact JSON |
| Quest Generation | `utility_quest_gen.md` | Bottleneck Breakthrough Mission card generation |
| Story Mission Evaluation | `utility_eval_story_mission.md` | Current Story Mission completion evaluation |
| Trait Generation | `utility_trait_gen.md` | LLM-powered player trait option generation |
| Initial Affection | `utility_initial_affection.md` | Starting affection calculation |
| Progression | `utility_progression.md` | Progression state updates |
| Adoption | `utility_adoption.md` | Scenario adoption prompt |

## 2.5 Workshop Prompts

| Prompt | File | Purpose |
|--------|------|---------|
| Character Workshop | `workshop_character.md` | Character creation/revision via AI conversation |
| Scenario Workshop | `workshop_scenario.md` | Scenario creation/revision via AI conversation |
| Arcanum Workshop | `workshop_arcanum.md` | World-building framework creation |

## 2.6 Design Documents

| Document | File | Purpose |
|----------|------|---------|
| Module Design Guide | `module_design_guide.md` | How to create modules (v2.0) |
| Combat System Design | `combat_system_design.md` | Resource pools, enemy templates, combat resolution |
| Event Agent System | `event_agent_system_design.md` | UA → EA → Client pipeline (supersedes Combat Agent) |
| Mechanics System | `mechanics_system_design.md` | Item/ability/trait mechanics via lore entries |
| Dice System | `dice_system_design.md` | Unified 2d6 test resolution |
| Pacing System | `pacing_system_design.md` | Narrative pacing design |
| Consistency Resolution | `consistency_resolution.md` | Multi-NPC consistency rules |
| Rule Resolution | `rule_resolution.md` | Custom rule evaluation |

## 2.7 Runtime-Generated Documents

| Document | Format | Created | Updated |
|----------|--------|---------|---------|
| NPC Profile | JSON | On NPC first appearance | Auto-update every 5 Critical Events + session end |
| Context Recap | Internal text | On first auto-compression (~T8-10) | On each auto-compression cycle |
| Critical Events | JSON | On qualifying Hype event | Per-event append |

---

# 3. SYSTEM ARCHITECTURE

## 3.1 High-Level Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                Frontend (Browser / Tauri WebView)                    │
│                                                                      │
│  ┌──────────┐ ┌──────────────┐ ┌────────────┐ ┌──────┐ ┌─────────┐│
│  │ Chat     │ │ NPC Sidebar  │ │ Asset      │ │Combat│ │Workshop ││
│  │ Panel    │ │ (portraits,  │ │ Browser    │ │ HUD  │ │ Panel   ││
│  │          │ │  aff bars)   │ │            │ │      │ │         ││
│  └────┬─────┘ └──────▲──────┘ └─────▲──────┘ └──▲───┘ └────▲────┘│
│       │              │               │            │          │      │
│       ▼              │               │            │          │      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                 Orchestrator (TypeScript)                      │  │
│  │                                                                │  │
│  │ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐         │  │
│  │ │ Input    │ │ Module   │ │  State   │ │  Context  │         │  │
│  │ │ Router   │ │ Injector │ │  Manager │ │  Manager  │         │  │
│  │ └──────────┘ └──────────┘ └──────────┘ └───────────┘         │  │
│  │ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐         │  │
│  │ │ Event    │ │ Status   │ │ Session  │ │Pre-Compute│         │  │
│  │ │ Pipeline │ │ Parser   │ │ Lifecycle│ │  Status   │         │  │
│  │ └──────────┘ └──────────┘ └──────────┘ └───────────┘         │  │
│  └─────────┬──────────┬──────────────────────┬──────────────────┘  │
└────────────┼──────────┼──────────────────────┼──────────────────────┘
             │          │                      │
      ┌──────┴──────┐   │               ┌──────┴───────┐
      ▼             ▼   ▼               ▼              ▼
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌──────────┐
│  Main    │ │  Utility │ │  Event   │ │  Local    │ │ Document │
│  Session │ │  Agent   │ │  Agent   │ │  Storage  │ │  Store   │
│          │ │ (Hype/   │ │ (combat  │ │           │ │          │
│ Narrates │ │  Lust    │ │  action  │ │ IndexedDB │ │ *.md     │
│ only     │ │  master) │ │  parser) │ │ or Files  │ │ *.json   │
└──────────┘ └──────────┘ └──────────┘ └───────────┘ └──────────┘
```

## 3.2 Component Responsibilities

### Frontend
- 50+ vanilla DOM components (no framework). Communication via CustomEvent + StateManager listeners
- Chat Panel: streaming narrative display with status tiles
- NPC Sidebar: portrait cards, affection bars, tension icons, quest tracker
- Bottom Strip: player HUD (turn/level/XP), suggestion bar, quest display
- Input Area: textarea, command buttons, provider toggle, model selector
- Settings: split into 5 sections (API, display, presets, modules, advanced)
- Combat HUD: resource bars, enemy status, action log
- Workshop Panel: character/scenario/arcanum creation via AI conversation

### Orchestrator
- Central coordination layer. 21-step processTurn pipeline with 53 labeled substeps (~4670 lines)
- Routes player input by type, supporting multi-command sequences
- Determines which modules to inject into the LLM call
- Runs event pipeline when UA signals active events
- Manages context compression lifecycle
- Pre-computes ~80% of status window before Main LLM starts

### Three Agent Architecture
| Agent | Model Slot | Purpose |
|-------|------------|---------|
| Main Session | Main | Narrative prose generation. Sole narrative voice |
| Utility Agent | Utility | Hype/Lust eval, compression, profile update, status extract, quest/trait gen |
| Event Agent | Utility | Combat action interpretation and review (JSON only, never prose) |

Plus Creative Ops slot for workshop agents and enrichment.

---

# 4. IMPLEMENTATION STATUS

## Completed Systems

### Core Engine
- [x] 21-step processTurn pipeline with PreTurnSnapshot rollback
- [x] Multi-command input parsing (SPEAK/DO/PLOT/RECALL)
- [x] Client-authoritative turn counter
- [x] Three-block prompt caching (immutable/semi-stable/dynamic)
- [x] Automatic context compression (reply-count + token-based thresholds)
- [x] Dynamic model switching based on scene intensity
- [x] Output blacklist (silent mode + prompt mode)
- [x] Auto-continue for truncated responses
- [x] NPC presence control (@ target, 📢 summon)
- [x] NPC muting
- [x] Pre-computed status rendering (~80% client-side)

### Agent System
- [x] Utility Agent: Hype/Lust eval, compression, profile update, status extract
- [x] Event Agent: interpreter mode + review mode (two-phase)
- [x] Character Generator: 3-card NPC generation
- [x] Trait Generator: 3 trait options on level-up
- [x] Quest Generator: 3 quest cards for bottleneck unlock
- [x] Profile Enricher: fill missing profile fields
- [x] Suggestion Agent: contextual SPEAK/DO/PLOT suggestions
- [x] Enrichment Agent: entity enrichment via Creative Ops model
- [x] Shadow Operator: background shadow operations
- [x] Summary Generator: context summary generation

### Game Mechanics
- [x] Hype 5-tier emotional tension with decay
- [x] Lust 5-tier physical tension (module-driven)
- [x] Affection 8-tier with 4 bottleneck gates (30/50/70/90%)
- [x] Mission System v2: Ambient Affection Missions, Bottleneck Breakthrough Missions, and opt-in Story Missions
- [x] Mission-led affection preset (+5 Ambient Mission reward, +1 strong positive hype, slowburn negative ranges)
- [x] Bottleneck Breakthrough Mission system with scenario-linked axes and refreshable 3-option picker
- [x] Critical Events (cross-session per NPC)
- [x] XP/level progression
- [x] Hype change presets (slowburn/standard/dramatic)
- [x] Unified 2d6 dice system (advantage/disadvantage, efficacy)
- [x] Trait system (4 types × 2 ranks × 2 scopes)
- [x] Action domains (7 combat + 4 non-combat)
- [x] Tendency system (weighted action selection)
- [x] Pool-based damage distribution (client-side)
- [x] Guard mechanic (player-only, 2d6 reduction)
- [x] Assist-first resolution (Phase 0 advantage granting)

### Module System
- [x] Manifest-driven auto-discovery via import.meta.glob
- [x] 8 lifecycle hooks with typed merge strategies (MAX, CONCAT, EACH, OR)
- [x] Module config as mod API surface
- [x] Arcanum-based config overrides
- [x] Per-module locale system
- [x] Constants bridge for module-to-core decoupling
- [x] Combat module (enemies, resources, dice, combat HUD)
- [x] Erotic module (lust tracking, activation thresholds, intensity)
- [x] Exploration module (mysteries, notable objects, chain patterns)

### Arcanum System
- [x] Two-layer architecture (Arcanum framework + Lore entries)
- [x] Rule auto-classification (config patches vs prompt directives)
- [x] X-Cards (absolute blacklist)
- [x] Client-side keyword detection for lore injection
- [x] UA contextual lore suggestions
- [x] Afterglow persistence (N turns)
- [x] Consistency resolver (lore ↔ profile contradiction detection)
- [x] Arcanum Workshop with AI assistant

### UI & UX
- [x] Dark theme (no light mode, no toggle)
- [x] First-run setup modal (API key, provider)
- [x] Scenario selector with import
- [x] Character setup flow (import/generate per slot)
- [x] Asset browser (scenarios, characters, portraits)
- [x] Chat export (JSON + Markdown)
- [x] TavernCard V2 import (PNG parser, V1/V2 detection, LLM conversion, question flow)
- [x] Session-to-novel export (multi-pass LLM pipeline, config modal, Markdown output)
- [x] Import portal (unified import hub)
- [x] Analytics panel (affection chart, hype distribution)
- [x] Portrait system (7 emotions, UA-driven selection)
- [x] Location journal
- [x] Ambient Mission picker with refresh/reroll and active mission display
- [x] Memory viewer (recap, CEs, cross-scenario)
- [x] Debug console + dev panel (Ctrl+Shift+D)
- [x] Workshop UI (character, scenario, arcanum, lore)
- [x] Settings split into 5 sections
- [x] Combat HUD with resource bars

### Persistence
- [x] File-based backend (Tauri, release). IndexedDB backend retained for browser dev runtime only.
- [x] StorageBackend interface abstraction
- [x] 12 object stores (sessions, messages, profiles, scenarios, CEs, portraits, etc.)
- [x] Stronghold encrypted vault for API keys (Tauri)
- [x] Bundled asset auto-sync

### Desktop (Tauri v2)
- [x] Tauri v2 scaffolding with Rust backend
- [x] File-based storage backend
- [x] Stronghold API key vault
- [x] HTTP plugin for CORS-free API calls
- [x] Native notifications
- [x] Auto-updater integration
- [x] Session logger (per-turn Markdown logs)

### Testing
- [x] 65 test files, 0 type errors
- [x] Clean production build
- [x] Coverage: orchestrator, state, modules, dice, events, traits, UI components, workshop

---

# 5. MODULE SPECIFICATIONS

## 5.1 Module File Structure

```
modules/{moduleId}/
├── manifest.json          # Module declaration (required)
├── prompt.md              # Full prompt when active (required)
├── stub.md                # Minimal prompt when dormant (required)
├── {moduleId}-data.ts     # Shared constants (optional)
├── locale/
│   └── zh-TW.json         # Traditional Chinese (required)
└── workshop-ref.md        # Workshop mechanics reference (optional)

src/modules/builtins/
└── {moduleId}-hooks.ts    # Hook implementations (required if has logic)
```

## 5.2 Manifest Reference (ManifestPromptConfig)

Required fields: `id`, `name`, `version`, `prompt` (with `file` and `stub`).

Key sections:
- **prompt**: file, stub, block (1 or 2), alwaysLoad, maxAfterglow
- **activation**: lustThreshold, keywords[], uaFlag (OR-joined)
- **state**: typed runtime fields with defaults
- **uaEval**: fields UA evaluates each turn (field, type, description, mapsTo, perNPC)
- **tokens**: inputEstimate, outputRecommendation
- **ui**: hudPill, statusItems[]
- **memory**: criticalEventFields, compression, milestones
- **config**: mod API surface for Arcanum overrides
- **conflicts/requires**: module dependency management
- **characterExtension**: additional character profile fields
- **diceRolls**: module-specific dice configurations
- **traitTypes**: controls which trait types appear in selection pool

## 5.3 Hook Lifecycle (6 points)

| Hook | Merge | Purpose |
|------|-------|---------|
| `getIntensity()` | MAX | Highest intensity wins |
| `getDynamicPrompt()` | CONCAT | Combine all dynamic prompt additions |
| `getPacingDrivers()` | CONCAT | Combine pacing suggestions |
| `onSceneChange()` | EACH | Run all scene change handlers |
| `onTurnEnd()` | EACH | Run all turn-end handlers |
| `onSessionStart()` | EACH | Run all session start handlers |
| `isRollWorthy()` | OR | Any module can trigger dice |

## 5.4 Module Lifecycle States

```
dormant ──(activation triggers)──> active
active  ──(deactivation)────────> afterglow
afterglow ──(counter expires)───> dormant
```

## 5.5 Current Modules

### Combat Module (`modules/combat/`)
- Resource pools: HP, SP (player + NPC)
- Enemy ranks: mob (雜兵), elite (精英), boss (頭目)
- Combat HUD: resource bars, action log
- Dice triggers: attack, defend, ability_check, damage, healing
- Character extension: combat style, weapon preference, combat traits
- Config: baseDifficulty, spawnRates, etc.

### Erotic Module (`modules/erotic/`)
- Lust tier tracking and display
- Activation: lustThreshold (default 2 = 悶燒)
- Intensity escalation with narrative hooks
- Character extension: erotic triggers, conditions, preferences, boundaries
- Config: lustThreshold, escalationThreshold, maxAfterglow, cooldownOnConflict

---

# 6. API ADAPTER SPECIFICATION

## 6.1 Unified Interface

```typescript
interface APIAdapter {
  readonly name: string;
  sendRequest(req: LLMRequest): Promise<LLMResponse>;
  sendStreamingRequest(req: LLMRequest): AsyncIterable<string>;
  countTokens?(text: string, systemPrompt?: string): Promise<number>;
  clearCache?(): Promise<void>;
}

interface LLMRequest {
  systemPrompt: string;                    // Combined text fallback
  messages: ChatMessage[];                 // [{role, content: string | ContentBlock[]}]
  config: LLMRequestConfig;               // model, maxTokens, temperature, stream, thinkingBudget?
  systemPromptBlocks?: SystemPromptBlock[]; // For prompt caching
}

interface ContentBlock {
  type: 'text' | 'image';
  text?: string;
  imageData?: string;    // base64
  mediaType?: string;    // 'image/jpeg' | 'image/png'
}
```

## 6.2 Claude Adapter

- Endpoint: `https://api.anthropic.com/v1/messages`
- Auth: `x-api-key` header + `anthropic-version` header
- CORS: `anthropic-dangerous-direct-browser-access` header omitted in Tauri (uses HTTP plugin)
- Prompt caching: `SystemPromptBlock[]` → `cache_control: { type: 'ephemeral' }` on cacheable blocks
- Thinking: `thinking: { type: 'enabled', budget_tokens }` — mutually exclusive with temperature
- Streaming: SSE, events `content_block_delta` + `message_delta`

## 6.3 Gemini Adapter

- Endpoint: `googleapis.com/v1beta/models/{model}:generateContent`
- Auth: `key=` query parameter
- Prompt caching: `CachedContent` lifecycle (create → hash-track → reuse → delete)
- Thinking: `thinking_config: { thinking_budget }` — coexists with temperature (force temp=1.0)
- Role mapping: `assistant` → `model`
- Streaming: `streamGenerateContent` endpoint, SSE

## 6.4 xAI/Grok Adapter

- Endpoint: `https://api.x.ai/v1/chat/completions`
- Auth: `Authorization: Bearer <api_key>` header
- Transport: OpenAI-compatible Chat Completions
- Role mapping: `user` | `assistant`
- Streaming: SSE chat completion deltas
- Phase 1 support is official with DogeChat-local `grok-4.3` preset IDs for Main, Utility, and Creative Ops slots. Live model discovery is disabled until xAI exposes stable model metadata compatible with DogeChat slot tiering.
- Preset IDs such as `grok-4.3:medium` are never sent as API model names. The xAI adapter resolves them to `model: "grok-4.3"` plus `reasoning_effort`.
- Structured-output agents may send `response_format` (`json_schema` or `json_object`); narrative gameplay remains free-form text.

## 6.5 Error Handling

- 429 rate limit: exponential backoff, max 3 retries
- 401 auth: surface to user, prompt key re-entry
- 5xx/network: retry once, then show error with retry option
- Context overflow: surface to user with guidance

## 6.6 Three Model Slots

| Slot | localStorage Key | Default (Claude) | Default (Gemini) | Default (xAI/Grok) | Used By |
|------|-----------------|-------------------|-------------------|---------------------|---------|
| **Main** | `dogechat_main_model` | Sonnet 4.6 | Flash 2.0 | Grok 4.3 Balanced (`grok-4.3:medium`) | Gameplay, character gen, trait gen, quest gen |
| **Utility** | `dogechat_utility_model` | Haiku 4.5 | Flash Lite | Grok 4.3 Standard (`grok-4.3:low`) | UA eval, compression, profile update, suggestions |
| **Creative Ops** | `dogechat_creative_ops_model` | Sonnet 4.6 | Flash 2.0 | Grok 4.3 Balanced (`grok-4.3:medium`) | Workshop, enrichment, scenario adoption |

---

# 7. STATE MANAGEMENT SPECIFICATION

## 7.1 GameState Schema

```typescript
interface GameState {
  sessionId: string;
  scenarioId: string;
  turn: number;                              // CLIENT-AUTHORITATIVE
  player: PlayerState;
  npcs: Record<string, NPCState>;
  modules: ModulesState;                     // per-module state dicts
  context: ContextState;                     // replyCount, compression tracking
  npcCriticalEventCounters: Record<string, number>;
  activeQuests: Record<string, ActiveQuest>;
  missions: MissionRuntimeState;             // ambient chains + optional story runtime
  scene: SceneContext;                       // location, present[], locationNote
  locationJournal: Record<string, LocationJournalEntry>;
  gameTime: GameTime;                        // { year, month, day, period }
  meta: MetaState;                           // tokens, provider, models
}
```

## 7.2 NPCState

```typescript
interface NPCState {
  npcId: string; name: string;
  affection: number; affectionTier: AffectionTier;
  hype: HypeTier; lust: LustTier;           // UA-AUTHORITATIVE
  bottlenecks: Bottlenecks;                  // { b30, b50, b70, b90: boolean }
  inScene: boolean; lastSeenTurn: number;
  muted: boolean;
  personality: string[]; appearance: string[]; outfit: string[];
  currentMood: string;
  traits: GameTrait[];
  npcRelations: Record<string, 'ally' | 'neutral' | 'hostile'>;
  portraitId: string | null;
  moduleState: Record<string, unknown>;
}
```

## 7.3 PlayerState

```typescript
interface PlayerState {
  level: number; xp: number;
  traits: GameTrait[];
  appearance: string[]; outfit: string[];
  moduleState: Record<string, unknown>;
}
```

## 7.4 GameTrait (Unified Trait System)

```typescript
interface GameTrait {
  id: string;
  name: string;
  description: string;
  traitType: 'narrative' | 'harm' | 'aid' | 'utility';
  rank: 'normal' | 'great';
  scope: 'single' | 'multiple';
  usedThisEncounter: boolean;
}
```

## 7.5 Key StateManager Methods (~50 methods)

- `applyUtilityAgentEval(evalResult, hypePresetRanges)` — apply Hype/Lust/affection with bottleneck enforcement
- `activateQuest(npcId, card, theme, location?)` / `completeQuest(npcId)` / `removeQuest(npcId)` for Bottleneck Breakthrough Missions
- `getAmbientMission(npcId)` / `setAmbientMissionOptions(npcId, options)` / `activateAmbientMission(npcId, card)` / `completeAmbientMission(npcId, reason)`
- `initializeStoryMissionsFromScenario()` / `completeCurrentStoryMission(reason)` for opt-in Story Mission progression
- `updateSceneContext(location, time, present, note)` — triggers presence sync, journal update
- `unlockBottleneck(npcId, key)` — remove affection gate
- `awardXP(amount)` — auto level-up at threshold
- `setModuleState(moduleId, key, value)` / `getModuleState(moduleId, key)`
- `save()` → debounced persist to storage

---

# 8. DATA PERSISTENCE SPECIFICATION

## 8.1 Runtime Environments

Release target is Tauri only; the file-based backend is the canonical persistence path. The browser backend remains in-tree as a dev-time fallback so developers can iterate without the Rust toolchain, but it is not part of any distribution.

- **Tauri (release)**: File-based JSON in app data directory — canonical
- **Browser (dev only)**: IndexedDB via `idb` library — convenience fallback, not shipped
- **Abstraction**: `StorageBackend` interface in `src/storage/backends/`

## 8.2 Database Schema (v8, 12 stores)

| Store | Key | Index | Purpose |
|-------|-----|-------|---------|
| `sessions` | `sessionId` | — | Session metadata + serialized GameState |
| `messages` | auto | sessionId, turn | Chat turns per session |
| `npc_profiles` | `[scenarioId, npcId]` | — | NPC identity + runtime state |
| `scenarios` | `scenarioId` | — | Imported/bundled scenario JSON |
| `critical_events` | auto | npcId, scenarioId, compound | Story milestone records |
| `portraits` | `portraitSetId` | — | Portrait image data per emotion |
| `emotion_snapshots` | auto | sessionId | Per-turn emotion state |
| `saved_memories` | auto | sessionId | Player-saved notes |
| `milestones` | auto | — | Achievement tracking |
| `arcana` | `arcanumId` | — | World-building frameworks |
| `lore` | `loreId` | — | Knowledge entries |
| `cross_scenario_summaries` | `npcId` | — | Echo context between playthroughs |

## 8.3 localStorage Keys

All prefixed `dogechat_`. Stores: model selections, presets, thinking/temperature, user persona, display config (background opacity, blur, etc.), compression preset, generation preset. API keys use Stronghold in Tauri release with a local per-installation passphrase file; browser dev mode keeps the localStorage fallback for iteration only.

## 8.4 API Key Security

- **Tauri (release)**: Stronghold encrypted vault (`@tauri-apps/plugin-stronghold`) with a local `vault.key` passphrase file — protects against casual plaintext exposure, not a compromised local user account
- **Browser (dev only)**: localStorage with UI masking (show last 4 chars only) — plaintext at rest; never ship this mode
- Never logged, never included in error reports

---

# 9. INPUT SYSTEM SPECIFICATION

## 9.1 Multi-Command Parsing

Format: `SPEAK:[text] DO:[action] PLOT:[direction]`
- Left-to-right = chronological order
- RECALL is standalone only (cannot combine)
- Plain text = implicit SPEAK

## 9.2 Special Inputs

- `[@NPC]` prefix → directed action at specific NPC
- `[📢NPC]` prefix → summon absent NPC into scene
- `RECALL [NPC名]` → display NPC profile
- `RECALL: ALL` → display all NPC profiles
- `PLOT:[direction]` → meta-command, guaranteed success, bypasses dice

## 9.3 System Commands (Ctrl+Shift+D dev panel)

- `SYSTEM:RESTORE_ALL` — restore all resources
- `SYSTEM:SET_AFF [NPC] [value]` — set affection directly
- `SYSTEM:UNLOCK_ALL` — unlock all bottlenecks

---

# 10. MEMORY & CONTEXT MANAGEMENT

## 10.1 Compression Thresholds

| Trigger | Condition | Action |
|---------|-----------|--------|
| Scheduled | replyCount 6 | Flag `compressionPending` |
| Immediate | replyCount ≥ 8 | Compress now |
| Hard cap | replyCount ≥ 10 | Mandatory, keep last 5 |
| Token-based (scheduled) | 12× model maxTokens uncached input | Flag pending |
| Token-based (immediate) | 16× model maxTokens uncached input | Compress now |

## 10.2 Compression Output Format

Budget: ≤800 tokens (`CONTEXT_RECAP_MAX_TOKENS`)

Sections:
1. **當前場景** — Current location/time/situation anchor
2. **故事主線** — Never-shrink arc summary extended from prior recap
3. **關鍵時刻** — Up to 6 pivotal moments retained across compressions

Compression recaps do not include NPC/player stats; structured state remains in stored `statusData` and client state.

## 10.3 Three-Block Prompt Caching

See `architecture.md` for full block contents. Summary:
- **Block 1** (immutable, ~99% cache): core rules, arcanum, persona, scenario
- **Block 2** (semi-stable, ~70-80% cache): NPC profiles, module prompts, compression recap
- **Block 3** (dynamic, 0% cache): runtime state, lore injection, event resolution

---

# 11. PORTRAIT SYSTEM SPECIFICATION

## 11.1 File Convention

Folder: `portraits/{charName}/` — subfolder name = npcId

Files: `{charName}_{N}.{png|jpg|webp}`
- `_0` = default (required)
- `_1` = happy, `_2` = embarrassed, `_3` = angry
- `_4` = lustful, `_5` = scared, `_6` = tender

## 11.2 Expression Selection

UA eval outputs `portraitHint` per NPC per turn. Emotion mapper (`src/portraits/emotion-mapper.ts`) maps game state → portrait tag. Missing variants fall back to `_0` (default).

## 11.3 Portrait Upload

`PortraitUploadModal` supports batch upload per emotion slot. Images validated and converted. Portraits stored in IndexedDB/file backend.

---

# 12. UI DESIGN

## 12.1 Layout Structure

```
┌──────────────────────────────────────────────────┐
│ ⚙ (System Cog)                                   │
├───────────────────────────┬──────────────────────┤
│                           │                       │
│     Chat Panel            │   NPC Sidebar         │
│   (streaming narrative,   │  (portrait cards,     │
│    status tiles)          │   aff bars,           │
│                           │   tension icons)      │
│                           │                       │
├───────────────────────────┴──────────────────────┤
│  Bottom Strip                                     │
│  [Player HUD] [Suggestion Bar] [Quest Display]    │
├──────────────────────────────────────────────────┤
│  Input Area                                       │
│  [textarea] [@ summon] [provider toggle] [⚡] [model] │
└──────────────────────────────────────────────────┘
```

## 12.2 Key UI Components (50+)

All vanilla DOM manipulation — no framework. Components are classes receiving container elements, wiring event listeners. Communication via CustomEvent dispatch and StateManager listener subscriptions.

Core: ChatPanel, InputArea, NpcSidebar, BottomStrip, PlayerHud, SuggestionBar, SystemCog

Modals: SetupModal, ScenarioSelector, CharacterSetupFlow, AdoptionModal, SettingsModal (5 sections), PersonaModal, TraitPickerModal, QuestJournalModal, ConfirmModal, PortraitUploadModal, AnalyticsPanel

Overlays: NpcOverlay, LocationJournal, MemoryViewer, SummonOverlay, CombatHud, InfoOverlay, LorePanel

Workshop: CharacterWorkshopForm, ScenarioWorkshopForm, ArcanumWorkshop, ArcanumAiAssistant, LoreWorkshop

Dev: DebugConsole, DevPanel (Ctrl+Shift+D)

---

# 13. WORKSHOP SYSTEM SPECIFICATION

## 13.1 Architecture

Fully isolated from gameplay (different session type, no shared state).

**Flow**: User ↔ LLM conversation → AI produces JSON → validate → auto-correct (max 3 attempts) → save to storage.

## 13.2 Workshops

### Character Workshop
- Prompt: `workshop_character.md`
- Creates/revises NPC profiles via AI conversation
- `[存檔]` marker triggers JSON extraction
- Manual editor fallback
- Workshop profiles stored with `scenarioId='__workshop__'`
- Exported to gameplay via scenario adoption

### Scenario Workshop
- Prompt: `workshop_scenario.md`
- Creates/revises scenario JSON via AI conversation
- Injects existing Workshop profiles so AI knows available characters
- Validates against `scenario_overview_template.json`

### Arcanum Workshop
- Structured form for genre, era, metaphysics, X-Cards, rules
- AI assistant converts freeform descriptions to structured entries
- Lore Workshop for individual knowledge entries

## 13.3 Validators

`validateProfileJSON()` and `validateScenarioJSON()` check all required fields, types, and constraints. Auto-correction attempts up to 3 times before surfacing error.

---

# 14. UTILITY AGENT SPECIFICATION

## 14.1 Overview

Facade pattern (`utility-agent.ts`) re-exporting specialized sub-agents. All use Utility model slot.

## 14.2 Hype/Lust Evaluation

- Prompt: `utility_eval_base.md` + conditional sub-files (quest, ambient mission, story mission, dynamics, event, lore, hints)
- Input: player action, NPC states, recent context, active Ambient Missions, active Bottleneck Breakthrough Missions, current Story Mission, scene, module eval fields
- Output per NPC: hype, lust, affectionDelta, criticalEvent, portraitHint, ambientMissionCompletion, questCompletion
- Plus: storyMissionCompletion, eroticScene flag, npcDynamics, event directive, lore suggestions
- `{AFFECTION_DELTA_RANGES}` placeholder filled from active hype preset
- maxTokens: 640

## 14.3 Context Compression

- Prompt: `utility_compress.md`
- Input: existing recap + old messages + NPC snapshots
- Output: structured recap ≤800 tokens
- Rule: existing recap is "foundation to extend" — 故事主線 never shortened

## 14.4 NPC Profile Update

- Prompt: `utility_profile_update.md`
- Input: current profile + new CEs + NPC state
- Output: updated ProfileRecord JSON
- Trigger: every 5 CEs per NPC + session end

## 14.5 Status Extraction

- Prompt: `utility_status_extract.md`
- Extracts scene/NPC/player cosmetic state as compact JSON
- Client-authoritative values (turn, level, XP, affection, hype, lust) NOT extracted

## 14.6 Other UA Tasks

- **Ambient Mission Generation**: 3 lightweight NPC-first options per major NPC
- **Quest Generation**: 3 Bottleneck Breakthrough Mission cards per locked affection gate
- **Story Mission Evaluation**: current opt-in Story Mission beat completion
- **Trait Generation**: 3 trait options on level-up
- **Initial Affection**: Calculate starting affection for NPC
- **Progression**: Update progression state
- **Adoption**: Adapt Workshop character to scenario

---

# 15. EVENT AGENT SYSTEM SPECIFICATION

## 15.1 Architecture (UA → EA → Client)

Three-tier pipeline replacing legacy Combat Agent + Dice Agent:

| Component | Role | Model |
|-----------|------|-------|
| Utility Agent | Decides event start/end, provides direction | Utility |
| Event Agent | Translates player input to mechanical action | Utility |
| Client | Rolls dice, distributes damage, updates state | N/A |
| Main Session | Narrates everything based on resolution block | Main |

## 15.2 Event Lifecycle

```
No event → UA: event.phase='init' → Client: generate enemies
  → UA: event.phase='ongoing' → EA + Client resolve → Main narrates
  → ... (repeats) ...
  → UA: event.phase='end' → Client: clear state, award XP
  → No event (back to normal)
```

## 15.3 EA Two-Phase Operation

**Phase 1 — Interpreter** (~50-100 tokens):
- Parses player input into single mechanical action
- Output: `{action, target?, trait?, plotDirective?}`

**Phase 2 — Review** (~30-50 tokens):
- Reviews roll results with entity traits + scene context
- Usually returns `{approved: true}`
- Can grant narrative modifiers for terrain, surprise, trait-context fit

## 15.4 Combat Resolution (Client-Side)

- **Assist-first**: assists resolve in Phase 0, granting advantage before combat rolls
- **Pool-based damage distribution**:
  - Player→enemy: random with spread, player-specified target priority, elite magnet
  - Enemy→player: guard absorbs ALL (split among guards), else highest-HP first
- **Guard**: 2d6 roll (≥10 full deflect, ≥7 halve, <7 full damage)
- **Default fallback**: entities without tendency → defend (never guard)
- **Combat end**: hybrid — client hard rules + UA soft suggestion with endConfidence (1-3)

## 15.5 Resolution Block

Authoritative dice results injected as `[戰鬥解析]` block into Main Session prompt. Main Session narrates based on these results but cannot override mechanical outcomes.

---

# 16. TRAIT & ACTION DOMAIN SYSTEM

## 16.1 Trait Types

| Type | Purpose | Domains |
|------|---------|---------|
| narrative | Passive, EA-reviewed for advantage | Any |
| harm | Offensive active traits | strike, disrupt, invoke |
| aid | Support active traits | assist |
| utility | Tactical active traits | maneuver |

### 16.1.1 Trait Ranks

| Rank | Dice Benefit | Description |
|------|-------------|-------------|
| normal | Advantage only (3d6 keep-best-2) | Standard trait |
| great | Advantage + rollBonus +3 to efficacy | Exceptional mastery |

### 16.1.2 Trait Acquisition on Level-Up

On each level-up (10 XP → level + 1, XP reset to 0), the player chooses one of three options:
1. **New trait**: Pick from 3 LLM-generated options (context-aware, diverse traitTypes)
2. **Upgrade existing**: Promote a normal-rank trait to great rank
3. **Replace existing**: Swap an existing trait for a new one

Trait upgrades and acquisition are available from the first level-up — there is no minimum level gate. The Trait Picker Modal (`src/ui/trait-picker-modal.ts`) presents all three options.

## 16.2 Action Domains

**Combat (7)**: strike, guard, defend, assist, maneuver, invoke, disrupt
**Non-combat (4)**: interact, wait, flee, item

Legacy names auto-resolve: mend→assist, bolster→assist, craft→maneuver

## 16.3 Tendency System

- Each entity has weighted domain distributions (must sum to 100)
- Cumulative probability rolling selects domain
- Client picks matching trait type via `getTraitsByDomain()`
- Faction-aware targeting: offensive→enemy, support→ally

---

# 17. ARCANUM SYSTEM SPECIFICATION

## 17.1 Two-Layer Architecture

**Layer 1 — Arcanum (Dome)**: World framework + mod loader
- Genre (primary/secondary), era, metaphysics, iconic features, tone
- X-Cards: absolute blacklist (TTRPG safety mechanism)
- Rules: natural language modifications, auto-routed to config patches or prompt directives
- Module config overrides

**Layer 2 — Lore (Bricks)**: Independent knowledge entries
- Types: character, location, race, item, custom
- Keywords for client-side detection
- Relationships (chain-pull for related context)
- Priority-based token budgeting
- Source: user, bundled, character-link, generated

## 17.2 Injection Flow

1. Player submits input
2. Client-side keyword detector scans for lore matches
3. UA suggests contextually relevant lore (independent of keywords)
4. Matched lore entries injected into Block 3 (dynamic, token-budgeted)
5. Afterglow: lore persists N turns after last trigger (configurable per module)
6. Promoted lore entries persist in Block 2 (semi-stable)

## 17.3 Rule Resolution

Rules are parsed at session init:
- **Config patches** (zero-token): `"set baseDifficulty to 8"` → applied as module config override
- **Prompt directives** (injected): `"NPCs never break character"` → injected into system prompt

## 17.4 Key Files

- `src/arcanum/types.ts` — ArcanumRecord, LoreEntry, ArcanumRule
- `src/arcanum/keyword-detector.ts` — Fast literal substring matching
- `src/arcanum/lore-formatter.ts` — Prompt injection formatting (Blocks 1-3)
- `src/arcanum/rule-resolver.ts` — Rule auto-classification
- `src/arcanum/consistency-resolver.ts` — Lore ↔ profile contradiction detection
- `src/storage/arcana.ts` — Arcanum CRUD
- `src/storage/lore.ts` — Lore entry CRUD

---

# 18. REMAINING WORK — BETA CANDIDATE FEATURES

4 features remain before beta release:

## 18.1 Vision API Character Inference

Use Vision API during character creation to infer traits, appearance, personality from uploaded portrait image.

- Scope: Character Workshop integration, image-to-profile extraction
- Key files: `src/agents/character-inference-agent.ts` (exists), workshop integration

## 18.2 TavernCard V2 Import ✓

Import TavernCard V2 PNG files with embedded JSON character data.

- PNG tEXt chunk parser for embedded JSON extraction (`src/importers/tavern-card-parser.ts`)
- V1/V2 format detection (`src/importers/json-detector.ts`)
- LLM conversion agent for format normalization (`src/importers/tavern-card-converter.ts`)
- Question flow for ambiguous field mapping (`src/ui/import-question-flow.ts`)
- Unified import portal (`src/ui/import-portal.ts`)

## 18.3 Export System

Export characters, scenarios, lorebooks as JSON-embedded PNG files.

- JSON payload injection into PNG tEXt chunks
- Export UI in Asset Browser
- Supports: characters, scenarios, arcanum + lore bundles

## 18.4 Session-to-Novel Export ✓

Chunked LLM pipeline to convert gameplay session into polished prose.

- Multi-pass pipeline: outline → expand → polish (`src/exporters/novel-exporter.ts`)
- Export config modal (style, tone, chapter breaks) (`src/ui/novel-export-modal.ts`)
- Markdown output with chapter structure
- Chat history export (JSON + Markdown) (`src/exporters/chat-exporter.ts`)

---

# APPENDIX A — BUILD & TEST

## Build Commands

```bash
# Dev server (Vite, localhost:5173)
npm run dev

# Vite bundle (internal — Tauri packages this into the desktop binary;
# no standalone web distribution)
npm run build       # tsc && vite build

# Tauri desktop dev — the primary dev flow
npm run tauri:dev

# Tauri desktop build — the release build
npm run tauri:build

# Test suite
npx vitest run      # full Vitest suite

# Type check only
npx tsc --noEmit
```

## Dependencies

**Runtime**: `idb` (IndexedDB wrapper), `@tauri-apps/api`, `@tauri-apps/plugin-*` (dialog, fs, http, notification, shell, stronghold, updater)

**Dev**: `typescript`, `vite`, `vitest`, `@tauri-apps/cli`

No CSS frameworks. No UI libraries. No backend server.

---

# APPENDIX B — ARCHITECTURE INVARIANTS

1. **Turn counter is CLIENT-AUTHORITATIVE** — Orchestrator increments, LLM receives as injection
2. **Hype/Lust are UTILITY AGENT-AUTHORITATIVE** — Set only via `applyUtilityAgentEval()`
3. **Affection changes only through UA-derived deltas and client-applied mission rewards** — Ambient Mission rewards remain client-side, bottleneck-capped, and never bypass locked gates
4. **NPC profiles are scenario-scoped** — Keyed by `[scenarioId, npcId]`
5. **Compression is automatic and silent** — No player-facing command
6. **All Chinese UI strings in `src/locale/zh-TW.ts`** — Never hardcoded
7. **All game constants in `src/constants.ts`** — Module constants via registry bridge
8. **Workshop and gameplay are fully isolated** — No cross-contamination
9. **Provider is switchable mid-session** — `setAdapter()` swaps adapter reference immediately, clears old cache in background. The inline provider toggle and Settings modal dispatch `provider-changed` event
10. **Never crash the app** — All errors degrade gracefully
11. **Module decoupling** — Core compiles without modules
12. **Module agents output JSON only** — Main Session is sole narrative voice
13. **Pre-computed status** — ~80% built client-side before Main LLM starts
14. **No assistant prefill** — All agents use user-message JSON instructions
