# DogeChat Design Reference

Look-up reference for theme, mechanics, API adapters, and asset conventions. Read when working on related areas.

---

## Dark Theme (Mandatory — No Light Theme, No Toggle)

### Base Palette
| Token | Hex | Usage |
|-------|-----|-------|
| --bg-deepest | `#0a0a0f` | Root background |
| --bg-mask | `rgba(10,10,18,0.82)` | Chat overlay on background image |
| --bg-surface | `#12121c` | Sidebar, cards, overlays |
| --bg-elevated | `#1a1a28` | Cards, input area, modals |
| --text-primary | `#e8e4dc` | Narrative text, labels |
| --text-secondary | `#8a8694` | Metadata, timestamps |
| --text-accent | `#c9a96e` | NPC names, gold highlights |
| --border-subtle | `#2a2a3a` | Dividers, borders |
| --focus-ring | `#6b5ce733` | Input focus glow |

### Z-Index Scale (CSS custom properties)
`--z-dropdown: 100` · `--z-overlay: 500` · `--z-panel: 900` · `--z-modal: 1000` · `--z-modal-nested: 1100` · `--z-toast: 1200` · `--z-workshop: 9000` · `--z-top: 10000`

### Affection Tier Colors
敵對 `#8b1a1a` · 宿敵 `#a63d3d` · 警戒 `#b87333` · 中立 `#6b7280` · 友善 `#4a9e8e` · 信任 `#5b9bd5` · 摯愛 `#d4789c` · 獻身 `#e8a0b4`

### Command Colors
SPEAK `#4a9e8e` · DO `#c9a96e` · PLOT `#6b5ce7` · RECALL `#8a8694`

### Hype Colors
強烈負面 `#e04040` (pulse) · 輕微負面 `#c47040` · 平淡 `#6b7280` · 輕微正面 `#6bc490` · 強烈正面 `#60c0e8` (pulse)

### Lust Colors
休眠 `#4a4a5a` · 萌芽 `#c47090` · 悶燒 `#d05080` · 燃燒 `#e03060` · 貪婪 `#ff2060` (pulse)

### Typography
- Narrative: `var(--font-narrative)` = `"Noto Serif TC", serif` — 16px, weight 400, line-height 1.8
- NPC dialogue `「」`: same font, weight 500, italic
- Status/Mono: `"JetBrains Mono", monospace` — 13px, line-height 1.4
- UI labels: `"Noto Sans TC", sans-serif` — 13px, weight 500
- Player input: `"Noto Sans TC"` — 15px

### Component Rules
- All backgrounds: `--bg-surface` or `--bg-elevated`. NEVER white or light gray.
- All text: `--text-primary` or `--text-secondary`. NEVER pure black.
- Borders: `--border-subtle` (1px solid). No heavy borders.
- Corners: 8px cards/bubbles, 12px modals, 4px pills/buttons.
- Shadows: `0 2px 8px rgba(0,0,0,0.3)` only. No bright/glowing shadows.
- Buttons: ghost style (transparent bg, border on hover) or filled with accent.
- Scrollbars: thin, dark (`scrollbar-width: thin; scrollbar-color`).
- **Scrollable CSS Grid rule**: any `display: grid` container with `overflow-y: auto` whose items have `overflow: hidden` MUST include `grid-auto-rows: min-content`. Without it, CSS Grid implicitly sets `min-height: 0` on overflow-hidden items, letting rows compress to fit the container instead of overflowing into the scroll area.

### Animations
| Element | Duration | Easing |
|---------|----------|--------|
| Message fade-in | 300ms | ease-out |
| Portrait crossfade | 500ms | ease-in-out |
| Aff bar change | 400ms | ease-out |
| Overlay slide-in | 250ms | ease-out |
| Modal appear | 200ms | ease-out |
| Pulse (強烈 tiers) | 1.5s loop | ease-in-out |

---

## Architecture Details

- **Context compression**: primarily token-budget driven (uncached input tokens × preset multiplier), with turn-count as safety net. Three presets (aggressive/standard/generous) in `constants.ts`. No player-facing SUMMARY command.
- **NPC Profile updates**: triggered every 5 Critical Events via Utility Agent background call. Plus final update on session end.
- **Three model slots**: Main (gameplay narrative), Utility (UA tasks), Creative Ops (workshop, generators). Each independently configurable.
- **Shared utilities**: extracted helpers → `src/utils/` (toast.ts, token-info.ts, secure-storage.ts, native-file-io.ts, dice-format.ts, entity-resolver.ts, etc.)

---

## Game Mechanics Quick Reference

### Hype (5-Tier Emotional Tension, per NPC per turn)
Tiers: 強烈負面 · 輕微負面 · 平淡 · 輕微正面 · 強烈正面
- Decay toward 平淡 if no qualifying interaction. Time skip → reset to 平淡.
- Affection Δ: configurable via `HYPE_CHANGE_PRESETS` (slowburn/standard/dramatic/mission-led). Standard: 強烈正面 +3~+5, 輕微正面 +1~+3, 平淡 0, 輕微負面 -3~-1, 強烈負面 -5~-3. Mission-led keeps ordinary positive hype at 0, strong positive at +1, and uses Ambient Mission completion as the main positive reward.

### Lust (5-Tier Physical Tension)
Tiers: 休眠 → 萌芽 → 悶燒 → 燃燒 → 貪婪
- No decay on idle. Cools on: conflict, scene change, time skip, Hype ≤ 平淡.

### Affection (8-Tier, -100 to 100)
敵對(<-90) · 宿敵(-90~0) · 警戒(0-20) · 中立(20-40) · 友善(40-60) · 信任(60-80) · 摯愛(80-90) · 獻身(90-100)
- Changed through UA-derived Hype delta plus client-applied mission rewards. Ambient Mission completion grants +5 only under the mission-led preset, and all positive changes remain capped by locked bottlenecks at 30/50/70/90%.

### Mission System v2
- **Ambient Affection Missions**: default ambience path replacing regular pacing events. Each major NPC maintains one lightweight, refreshable, NPC-first mission chain. Completion is generous and can grant +5 affection under the mission-led preset.
- **Bottleneck Breakthrough Missions**: scenario-linked affection gate missions at 30/50/70/90. They connect scenario premise, NPC relationship axis, ACTION (`TELL | DO | GIVE`), and HOOK (`VULNERABILITY | DEPENDENCE | EXCLUSIVITY | CONTINUITY`). Completion is strict because it unlocks bottleneck caps.
- **Story Missions**: opt-in authored mainline beats from `missions.story.sequence`. They are fixed, non-refreshable, and advanced by client-owned runtime state. Only the current beat is injected; future `fixed` facts stay hidden.
- Legacy `pacing_drivers` are ambient seeds and fallback runtime inputs only when Ambient Missions are disabled.

### Dice System (Unified 2d6)
- Test rolls: 2d6 base (3d6 keep-best-2 with advantage, keep-worst-2 with disadvantage)
- Success: 7+ = success, 10+ = great success
- Efficacy: highest-single-die + modifiers
- Pure functions, injectable RNG for testing

### Trait System (replaces legacy Abilities)
- `GameTrait`: { id, name, description, traitType, rank, scope, usedThisEncounter }
- 4 types: narrative (passive, EA-reviewed), harm (strike/disrupt/invoke), aid (assist), utility (maneuver)
- 2 ranks: normal (advantage only), great (advantage + rollBonus +3)
- 2 scopes: single (default), multiple (AoE, rare)
- Cooldown: 1/encounter for active traits, unlimited outside encounters
- Level-up choices: new trait, upgrade normal→great, or replace existing. Available from first level-up (no minimum level gate).

### Action Domains (7 combat + 4 non-combat)
- Combat: strike, guard, defend, assist, maneuver, invoke, disrupt
- Non-combat: interact, wait, flee, item
- Guard: player-faction only, rolls 2d6 (≥10 deflect, ≥7 halve, <7 full damage)
- Assist: resolved BEFORE combat phase, grants advantage, aid trait adds healing

### Critical Events
- Trigger: Hype = 強烈正面 or 強烈負面
- Detected by Utility Agent. Stored cross-session by npcId.
- Every 5 per NPC → auto Profile update.

### Narrative Perspective
- Chosen at session start via Perspective Modal. Stored in session state, injected into system prompt by Module Injector.
- **2nd-person** (default): 你-based narration. Player character referred to as 你 in prose.
- **1st-person**: 我-based narration. Reads as player's internal monologue and actions.

### Input Mode
- Chosen at session start alongside perspective. Stored in session state.
- **Command mode** (default): Structured SPEAK/DO/PLOT/RECALL syntax. Multi-command parsing active.
- **Narrative mode**: Freeform prose input sent to LLM as-is. No command wrapping. RECALL still detected as system command. UA receives extra guidance for event action interpretation in narrative mode.

### Multi-Command Input
Parse: `SPEAK:[...] DO:[...] PLOT:[...]`. Left-to-right = chronological. RECALL standalone only.

### Module-Extension System
- Modules are self-contained extensions (e.g., `modules/erotic/`, `modules/combat/`) with manifest, hooks, locale, data, and prompt files.
- Auto-discovered via `import.meta.glob` at startup. Registered in `src/modules/registry.ts`.
- Hook dispatcher (`src/modules/hook-dispatcher.ts`) fires at 8 orchestrator lifecycle points with typed merge strategies (MAX, CONCAT, EACH, OR).
- `getPacingDrivers()` is legacy-compatible: contributed directions seed Ambient Mission generation and still support fallback pacing events when Ambient Missions are disabled.
- Dice engine (`src/modules/dice-engine.ts`) handles unified 2d6 test + efficacy rolls.
- Module config is moddable via Arcanum rules (see below).
- Core app compiles and runs cleanly with any/all modules removed. Only NEW sessions respect module changes — existing sessions with modules loaded cannot unload mid-session.
- **Module Agent Pattern**: All module agents/subagents (Event Agent, future Puzzle/Social agents) output ONLY structured JSON — never narrative prose. Main Session is the sole narrative voice. Agents are pure mechanics resolvers.
- **Entity naming**: Generated entities (enemies, random NPCs) use descriptive prefixes (刀疤哥布林, 獨眼強盜), never generic suffixes (A/B/1/2) or arbitrary proper names.

### Event Agent System (UA → EA → Client pipeline)
- **Three-tier pipeline**: UA directs (decides event start/end/direction) → EA translates (parses player intent into mechanical actions) → Client resolves (dice rolls, damage distribution, state updates)
- EA has two modes: **Interpreter** (parse player input → single action, ~50-100 tokens) and **Review** (validate rolls with trait/scene context, ~30-50 tokens)
- Pool-based damage distribution is fully client-side (no LLM targeting)
- Replaces legacy Combat Agent + Dice Agent architecture

### Arcanum System (World-Building Knowledge)
- Two-layer: **Arcanum** (dome/parent, injected Block 1) + **Lore** (bricks/children, keyword-triggered Block 3).
- Rules are auto-classified at session init: config patches (zero-token) vs prompt directives (injected).
- X-Cards: absolute blacklist, overrides all modules and scenario.
- Lore injection: client-side keyword detection + UA contextual suggestions, afterglow persistence (N turns).
- Workshop: structured form + AI assistant for freeform→structured conversion.
- Key files: `src/arcanum/`, `src/storage/arcana.ts`, `src/storage/lore.ts`, `src/ui/arcanum-workshop.ts`

### Status Extraction Format (UA JSON-based)
Utility Agent extracts scene/NPC/player state as compact JSON via `utility_status_extract.md`:
```json
{"scene":{"location":"","time":"","present":[],"locationNote":""},"npcs":[{"name":"","mood":"","appearance":[],"outfit":[]}],"player":{"appearance":[],"outfit":[]}}
```
Turn, level, XP, affection, hype, and lust are client-authoritative and NOT extracted from LLM output.

---

## API Adapter Reference

### Unified Internal Format
```
LLMRequest: { systemPrompt, messages[{role,content}], config{model,maxTokens,temperature,stream} }
LLMResponse: { content, usage{inputTokens,outputTokens}, stopReason }
```

### Claude
- system → `request.system` field (with `SystemPromptBlock[]` for prompt caching)
- roles: `user` | `assistant`
- response: `content[0].text`
- Endpoint: `https://api.anthropic.com/v1/messages`
- Auth: `x-api-key` header + `anthropic-version` header (CORS header conditionally omitted in Tauri)
- Streaming: SSE, event `content_block_delta`

### Gemini
- system → `system_instruction.parts[0].text`
- roles: `user` | `model` (NOT assistant)
- response: `candidates[0].content.parts[0].text`
- Endpoint: `googleapis.com/v1beta/models/{model}:generateContent`
- Auth: `key=` query param
- Streaming: `streamGenerateContent` endpoint, SSE
- CachedContent lifecycle for prompt caching

### xAI/Grok
- Transport: OpenAI-compatible Chat Completions
- roles: `user` | `assistant`
- response: `choices[0].message.content`
- Endpoint: `https://api.x.ai/v1/chat/completions`
- Auth: `Authorization: Bearer <api_key>` header
- Streaming: SSE chat completion deltas
- Phase 1 support is official with static `grok-4.3` model IDs for Main, Utility, and Creative Ops. Live xAI model discovery is disabled until provider metadata can support DogeChat slot tiering.

### Error Handling
- 429 rate limit: exponential backoff, max 3 retries
- 401 auth: surface to user, prompt for key re-entry
- Network error: retry once, then show reconnect option
- 500 server: retry once, then show "try different model" option
- API keys: Stronghold vault in Tauri release with a local per-installation passphrase file; localStorage only in browser dev mode. Keys are NEVER logged and are masked in UI (last 4 chars). This protects against casual plaintext exposure, not a compromised local user account.

---

## Bundled Assets (Auto-Detection)
- `scenarios/` and `characters/` are the default folders for scenario and character JSON files.
- `portraits/` contains portrait expression images in subfolders per character.
- Valid JSON files in `scenarios/` and `characters/` auto-appear in the Asset Browser via Vite's `import.meta.glob`.
- `syncBundledAssets()` runs on each Asset Browser open, writing to IndexedDB with deterministic IDs (prefix `bundled_`).
- Bundled scenarios use `source: 'bundled'` — they show an "內建" badge and cannot be deleted from UI.
- Bundled characters sync to Workshop scope (`__workshop__`) — skip if npcId already exists.
- Bundled portraits auto-link to NPC profiles with matching npcId (prefix `bundled_portrait_`).
- Adding a new file to any bundled folder makes it appear automatically (dev: page reload; prod: next build).

### Portrait File Convention
- Folder: `portraits/{charName}/` — subfolder name must match the NPC's `npcId`.
- Files: `{charName}_{N}.{png|jpg|webp}` where N is the emotion suffix:
  - `_0` = default, `_1` = happy, `_2` = embarrassed, `_3` = angry, `_4` = lustful, `_5` = scared, `_6` = tender
- Only `_0` (default) is required. Missing variants fall back to default.
- Expression selection is driven by UA eval (`portraitHint` field, mandatory per NPC per turn). No client-side hardcoded mapping.
