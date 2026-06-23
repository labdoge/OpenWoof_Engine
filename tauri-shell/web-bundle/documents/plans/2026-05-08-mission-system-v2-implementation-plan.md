# Mission System v2 Implementation Plan

Date: 2026-05-08  
Ticket: T-071  
Status: Complete; T-071 closed after Phase 9 verification

## Goal

建立 DogeChat 的 Mission System v2，將現有 pacing events 與 bottleneck quests 重新分工為三層任務架構：

- **Ambient Affection Missions**：取代 pacing events，作為每個主要 NPC 常駐的輕量情感互動任務鏈。
- **Bottleneck Breakthrough Missions**：升級現有瓶頸任務，讓它不只是好感門檻突破，而是「劇本主軸 × 主要 NPC 關係」的重大推進。
- **Story Missions**：可選的 scenario 主線骨架，直接寫在 scenario `.json`，由 client-authoritative state 追蹤進度。

這份文件的目的，是讓任何後續 Codex session 都能依序實作，不需要重新閱讀整段設計討論。

## Core Decisions

1. **Scenario JSON 是任務資料的 single source of truth。**
   `Story Missions`、scenario-linked bottleneck directions、mission profile 都應放進 scenario `.json`。

2. **Ambient Affection Missions 取代 pacing events 的主要 runtime 角色。**
   Legacy `pacing_drivers` 可讀取與轉換，但不再是長期主路徑。

3. **Ambient Affection Missions 與 Bottleneck Breakthrough Missions 都要 player-facing options，且可 refresh/reroll。**
   玩家能選「怎麼接 NPC 的情感小鉤子」與「怎麼突破重大關係門檻」。

4. **Story Missions 固定、不可 refresh。**
   它是 authored major scenario beats，不是玩家可洗掉的選項。

5. **Ambient Missions 常駐每個主要 NPC。**
   每個主要 NPC 同時最多 1 條 active ambient mission；完成後下一條必須在 3 turns 內被 prompt 成 options。

6. **新增 mission-led affection preset。**
   只有 `強烈` hype 給 +1 affection；完成 ambient mission 給 +5；負向變化沿用 slowburn 的 -1/-2 節奏。

7. **Bottleneck completion 維持嚴格。Ambient completion 採寬容判定。**
   Bottleneck 是 gate，false positives 會破壞 pacing；ambient 是情感流動，false negatives 比 false positives 更傷體驗。

## Non-goals

- 不在第一波移除所有 pacing events 程式碼；先 legacy-gate 與遷移，確認 ambient missions 穩定後再清理。
- 不把 Story Missions 強制套用到所有劇本。
- 不讓 LLM 自行計算 Story Mission index 或 turn number。
- 不讓 ambient mission completion 直接繞過 bottleneck caps。
- 不新增 npm dependencies。

## Architecture Summary

| Layer | Runtime role | Player choice | Refresh | Completion style | Reward |
|---|---|---:|---:|---|---|
| Ambient Affection Missions | NPC 日常主動情感鉤子 | Yes | Yes | Generous | +5 affection under mission-led preset |
| Bottleneck Breakthrough Missions | 好感門檻與劇本/NPC 重大交會 | Yes | Yes | Strict | Unlock bottleneck |
| Story Missions | 劇本主線骨架 | No | No | Medium generous | Advance story index |

## Proposed Scenario JSON

Add these fields at top level of scenario JSON. Keep existing `bottleneck_quest_directions` and `pacing_drivers` backward-compatible during migration.

```json
{
  "mission_profile": "sandbox",
  "missions": {
    "ambient_affection": {
      "enabled": true,
      "majorNpcPolicy": "initial_npcs",
      "optionCount": 3,
      "nextPromptWithinTurns": 3
    },
    "bottleneck_quests": {
      "enabled": true,
      "mode": "scenario_linked",
      "optionCount": 3,
      "directions": [
        {
          "npcSlotId": "main-heroine",
          "affectionGate": 30,
          "storyAxis": "她開始懷疑玩家是否只是利用她接近事件核心",
          "relationshipAxis": "玩家必須證明自己不是旁觀者或操控者",
          "suggestedAction": "GIVE",
          "suggestedHooks": ["VULNERABILITY", "EXCLUSIVITY"]
        }
      ]
    },
    "story": {
      "enabled": false,
      "limit": 5,
      "sequence": [
        {
          "id": "S1",
          "goal": "確認列車上的異常與第一名失蹤者的關聯",
          "fixed": "真正的關鍵不是失蹤，而是失蹤前被換過座位",
          "signal": "玩家注意到座位、時間或目擊證詞之間的矛盾"
        }
      ]
    }
  }
}
```

### mission_profile

Allowed values:

- `sandbox`：預設。Ambient + Bottleneck enabled；Story disabled unless explicitly enabled.
- `story`：Story enabled and expected; Ambient supports NPC attachment.
- `hybrid`：Story enabled but looser; Ambient remains important.

### ACTION × HOOK

Shared by Ambient and Bottleneck generation:

```ts
type MissionAction = 'TELL' | 'DO' | 'GIVE';
type MissionHook =
  | 'VULNERABILITY'
  | 'DEPENDENCE'
  | 'EXCLUSIVITY'
  | 'CONTINUITY';
```

Traditional Chinese labels are player-facing only through generated text, not through raw enum labels.

## Runtime State Proposal

Add a mission state bag to `GameState`, preferably under a new top-level `missions` field to avoid overloading `activeQuests`.

```ts
interface MissionRuntimeState {
  ambient: Record<string, AmbientMissionState>; // keyed by npcId
  story?: StoryMissionRuntimeState;
}

interface AmbientMissionState {
  npcId: string;
  status: 'needs_options' | 'options_ready' | 'active' | 'completed';
  options?: AmbientMissionCard[];
  activeCard?: AmbientMissionCard;
  activatedTurn?: number;
  completedTurn?: number;
  nextPromptDueTurn?: number;
  lastRefreshTurn?: number;
  refreshCount: number;
}

interface AmbientMissionCard {
  id: string;
  title: string;
  request: string;
  objective: string;
  signal: string;
  action: MissionAction;
  hooks: MissionHook[];
}

interface StoryMissionRuntimeState {
  enabled: boolean;
  currentIndex: number;
  completedIds: string[];
  completed: boolean;
}
```

Existing bottleneck quest state can stay in `activeQuests` for the first migration. Add fields to `QuestCard` instead of inventing a second bottleneck state immediately:

```ts
interface QuestCard {
  title: string;
  request: string;
  objective: string;
  theme: QuestTheme;
  conditions?: string[];
  action?: MissionAction;
  hooks?: MissionHook[];
  storyAxis?: string;
  relationshipAxis?: string;
}
```

## Runtime Flow

### Session start / resume

1. Load scenario JSON.
2. Normalize `mission_profile` and `missions`.
3. Build major NPC list:
   - Preferred: `initial_npcs` slot mapping.
   - Fallback: registered in-scene NPCs with required/major role.
4. Initialize missing `state.missions.ambient[npcId]`.
5. Legacy-map:
   - `pacing_drivers` → ambient generation hints.
   - `bottleneck_quest_directions` → `missions.bottleneck_quests.directions` fallback.
6. Initialize Story runtime only if `missions.story.enabled === true`.

### Each turn

1. Client increments turn as today.
2. Ambient scheduler checks each major NPC:
   - If no active mission and no options, mark `needs_options`.
   - If prior mission completed and `turn >= nextPromptDueTurn - 3`, generate or prompt options.
   - If NPC absent, keep state but do not inject active card.
3. Main Session prompt injection:
   - Inject active ambient missions for present NPCs.
   - Inject active bottleneck quests as today, but with scenario-linked text.
   - Inject active Story Mission only if enabled.
4. UA eval:
   - Existing hype/lust/affection.
   - Existing `questCompletion`.
   - Add `ambientMissionCompletion`.
   - Add `storyMissionCompletion` when Story enabled.
5. Client applies:
   - Ambient completion → mark completed, set `nextPromptDueTurn = currentTurn + 3`, apply +5 only under mission-led preset.
   - Bottleneck completion → existing unlock flow.
   - Story completion → `currentIndex += 1`.
6. UI updates:
   - Ambient options / active cards.
   - Bottleneck picker / active quest journal.
   - Story current goal.

## Implementation Order

### Phase 0 — Planning hygiene

Files:

- `documents/tickets.md`
- `documents/plans/2026-05-08-mission-system-v2-implementation-plan.md`

Tasks:

- [x] Record T-071 direction in tickets.
- [x] Prune old Done tickets per SOP.
- [x] Keep this plan updated after each implementation phase.

Verification:

- Manual read of ticket and plan.

### Phase 1 — Scenario schema and type foundation

Purpose: add structured mission data without changing runtime behavior yet.

Files likely affected:

- `documents/scenario_overview_template.json`
- `documents/workshop_scenario.md`
- `documents/workshop_scenario_form.md`
- `documents/dogechat_dev_plan.md`
- `documents/INDEX.md` if adding a new design doc reference
- `src/workshop/validators.ts`
- `src/agents/scenario-workshop-agent.ts`
- `src/ui/scenario-workshop-form.ts`
- `src/storage/bundled-loader.ts`
- `src/importers/json-detector.ts`
- `src/state/types.ts`
- `src/constants.ts`

Tasks:

- [x] Add shared mission enum constants:
  - `MISSION_PROFILES`
  - `MISSION_ACTIONS`
  - `MISSION_HOOKS`
  - `AMBIENT_MISSION_OPTION_COUNT = 3`
  - `AMBIENT_NEXT_PROMPT_WITHIN_TURNS = 3`
- [x] Add TypeScript interfaces for scenario-level missions.
- [x] Extend scenario validator to accept `mission_profile` and `missions`.
- [x] Keep old `pacing_drivers` and `bottleneck_quest_directions` valid.
- [x] Update scenario template and workshop docs.
- [x] Ensure all Chinese UI text goes through `src/locale/zh-TW.ts`.

Tests:

- [x] Add or update validator tests for:
  - valid `missions.story.sequence`
  - invalid `suggestedAction`
  - invalid `suggestedHooks`
  - legacy scenario without `missions`
  - both old and new bottleneck direction formats

Verification:

```powershell
npx vitest run tests/workshop-validators.test.ts
npx tsc --noEmit
```

### Phase 2 — Ambient mission runtime foundation

Purpose: create mission state and option generation substrate before replacing pacing events.

New files likely:

- `src/agents/ambient-mission-generator.ts`
- `documents/utility_ambient_mission_gen.md`
- `documents/utility_eval_ambient_mission.md`
- `src/orchestrator/ambient-mission-scheduler.ts`
- `tests/ambient-mission-generator.test.ts`
- `tests/ambient-mission-scheduler.test.ts`

Files likely affected:

- `src/state/types.ts`
- `src/state/validators.ts`
- `src/state/state-manager.ts`
- `src/orchestrator/orchestrator.ts`
- `src/orchestrator/module-injector.ts`
- `src/agents/hype-lust-evaluator.ts`
- `src/agents/utility-agent.ts`
- `src/constants.ts`
- `src/locale/zh-TW.ts`

Tasks:

- [x] Add `GameState.missions.ambient`.
- [x] Add validators/defaults for existing sessions.
- [x] Add StateManager helpers:
  - `getAmbientMission(npcId)`
  - `setAmbientMissionOptions(npcId, options)`
  - `activateAmbientMission(npcId, card)`
  - `completeAmbientMission(npcId, reason)`
  - `markAmbientNeedsOptions(npcId)`
- [x] Build scheduler:
  - major NPC missing state → `needs_options`
  - completed mission → next options due within 3 turns
  - absent NPC → pause prompt injection, preserve state
- [x] Create ambient mission generator:
  - exactly 3 options
  - each has `title`, `request`, `objective`, `signal`, `action`, `hooks`
  - player-facing text in Traditional Chinese
  - enum labels internal only
  - generated options are light, 1-3 turns, NPC-initiated
- [x] Add deterministic fallback options when generation fails.
- [x] Add parser/validator for ambient mission cards.

Prompt rules:

- Ambient generation should prefer variety in `HOOKS`.
- Avoid making every NPC constantly dependent or fragile.
- Accept mature/intimate approaches as possible completion when they actually receive the NPC signal.

Tests:

- [x] Generator parse accepts valid cards and rejects enum leaks in player-facing text if practical.
- [x] Fallback produces 3 valid options.
- [x] Scheduler prompts next options within 3 turns after completion.
- [x] Scheduler does not inject absent NPC active missions.
- [x] Existing sessions default mission state safely.

Verification:

```powershell
npx vitest run tests/ambient-mission-generator.test.ts tests/ambient-mission-scheduler.test.ts
npx tsc --noEmit
```

### Phase 3 — Ambient mission UI and refresh

Purpose: make Ambient Missions player-facing options and refreshable.

Files likely affected:

- `src/ui/bottom-strip.ts`
- `src/ui/quest-picker-modal.ts` or new `src/ui/ambient-mission-picker-modal.ts`
- `src/ui/quest-journal-modal.ts`
- `src/ui/state-listeners.ts`
- `src/orchestrator/orchestrator.ts`
- `src/locale/zh-TW.ts`
- `src/locale/en-US.ts`, `ja-JP.ts`, `zh-CN.ts` only if current locale completeness requires it

Tasks:

- [x] Decide UI reuse:
  - Prefer new `ambient-mission-picker-modal.ts` if quest picker semantics become too different.
  - Reuse shared card components only if it stays clean.
- [x] Show ambient options when a major NPC needs a new mission.
- [x] Support refresh/reroll of ambient options.
- [x] Player selection activates one ambient mission for that NPC.
- [x] Show active ambient mission in bottom strip or quest journal.
- [x] Keep ambient UI lightweight; no nested cards.
- [x] Do not expose `ACTION` or `HOOK` enum labels in player-facing UI.

UX rules:

- Ambient mission picker is dismissible only if we explicitly support "later"; if dismissed, prompt again before `nextPromptDueTurn`.
- Keep one active ambient mission per major NPC.
- If multiple NPCs need options, queue prompts to avoid modal spam.

Tests:

- [x] Modal renders 3 options.
- [x] Refresh calls generator/reroll path and preserves rejected titles if implemented.
- [x] Selection activates mission.
- [x] Active mission appears in journal/bottom strip.

Verification:

```powershell
npx vitest run tests/ambient-mission-picker-modal.test.ts tests/state-listeners.test.ts
npx tsc --noEmit
```

Manual:

- Start a sandbox scenario.
- Confirm each major NPC receives ambient options.
- Select one, finish it, confirm next options prompt within 3 turns.

### Phase 4 — Ambient mission completion and mission-led affection preset

Purpose: connect ambient completion to UA eval and affection pacing.

Files likely affected:

- `src/constants.ts`
- `src/state/state-manager.ts`
- `src/agents/hype-lust-evaluator.ts`
- `src/agents/utility-agent.ts`
- `src/orchestrator/orchestrator.ts`
- `documents/utility_eval.md`
- `documents/utility_eval_quest.md`
- new `documents/utility_eval_ambient_mission.md`
- `src/ui/settings/advanced-section.ts`
- `src/ui/settings/settings-modal.ts`
- `src/locale/zh-TW.ts`

Tasks:

- [x] Add `mission-led` to `HypePresetId`.
- [x] Define ranges:
  - `強烈` positive hype: +1
  - normal positive hype: 0
  - neutral: 0
  - negative follows slowburn, e.g. -1/-2 by tier
- [x] Add ambient completion reward constant:
  - `AMBIENT_MISSION_AFFECTION_REWARD = 5`
- [x] Extend UA output contract:
  - For NPCs with active ambient mission, output `ambientMissionCompletion` true/false.
  - Completion should be generous.
  - Reason should reference the `signal`.
- [x] Parse `ambientMissionCompletion`.
- [x] Apply +5 only when completion is accepted.
- [x] Ensure +5 still respects bottleneck caps.
- [x] Add settings UI copy for the new preset.

Important implementation detail:

The `+5` reward should be applied as a separate mission reward after UA eval, not hidden inside hype ranges. This keeps causality observable:

- Hype says how the scene felt.
- Ambient completion says the player fulfilled the NPC's active request.
- StateManager applies both with bottleneck enforcement.

Tests:

- [x] `mission-led` preset maps positive non-strong hype to 0.
- [x] Strong hype gives +1.
- [x] Negative tiers follow slowburn.
- [x] Ambient completion gives +5.
- [x] Ambient +5 cannot bypass a locked bottleneck.
- [x] UA parser preserves false completion result for active ambient mission.

Verification:

```powershell
npx vitest run tests/utility-agent.test.ts tests/state-manager.test.ts tests/settings-modal.test.ts
npx tsc --noEmit
```

### Phase 5 — Deprecate pacing events as main runtime path

Purpose: after ambient missions work, stop relying on pacing events for ambient feeling.

Files likely affected:

- `src/orchestrator/session-lifecycle.ts`
- `src/orchestrator/orchestrator.ts`
- `src/agents/hype-lust-evaluator.ts`
- `documents/pacing_system_design.md`
- `documents/core.md`
- `documents/workshop_scenario.md`
- `documents/workshop_scenario_form.md`
- `src/ui/settings/advanced-section.ts`
- `src/locale/zh-TW.ts`

Tasks:

- [x] Keep `pacing_drivers` readable as legacy ambient seeds.
- [x] Stop injecting `pacingContext` into UA by default when ambient missions are enabled.
- [x] Add setting migration:
  - old `PACING_EVENTS_ENABLED` maps to ambient mission enabled where reasonable.
  - avoid deleting old setting immediately.
- [x] Update settings label from pacing events toward ambient missions.
- [x] Document pacing events as legacy.
- [x] Preserve module hook compatibility for modules that still contribute pacing drivers.

Tests:

- [x] Legacy scenario with `pacing_drivers` still loads.
- [x] Ambient mission enabled suppresses regular pacing UA context.
- [x] Setting migration does not break old user preferences.

Verification:

```powershell
npx vitest run tests/session-lifecycle.test.ts tests/utility-agent.test.ts tests/settings-modal.test.ts
npx tsc --noEmit
```

### Phase 6 — Upgrade Bottleneck Breakthrough Missions

Purpose: transform existing bottleneck quests into scenario-linked major story/NPC gates.

Files likely affected:

- `src/agents/quest-generator.ts`
- `documents/utility_quest_gen.md`
- `documents/utility_eval_quest.md`
- `src/state/types.ts`
- `src/orchestrator/orchestrator.ts`
- `src/orchestrator/session-lifecycle.ts`
- `src/ui/quest-picker-modal.ts`
- `src/ui/quest-journal-modal.ts`
- `src/workshop/validators.ts`
- `src/ui/scenario-workshop-form.ts`
- `documents/workshop_scenario.md`
- `documents/workshop_scenario_form.md`

Tasks:

- [x] Extend quest direction pool to include:
  - `npcSlotId`
  - `storyAxis`
  - `relationshipAxis`
  - `suggestedAction`
  - `suggestedHooks`
  - legacy `direction`
- [x] Resolve `npcSlotId` to runtime major NPC where possible.
- [x] Extend `QuestGenerationInput`.
- [x] Update `assembleUserMessage()` to include scenario-linked axes.
- [x] Update `documents/utility_quest_gen.md`:
  - Bottleneck quests are major breakthrough missions.
  - They must connect scenario premise and NPC relationship.
  - They should still output exactly 3 options.
  - They include `action` and `hooks`.
- [x] Update parser/validator to accept optional `action/hooks/storyAxis/relationshipAxis`.
- [x] Update fallback quest generation to use scenario axes.
- [x] Keep strict completion rules in `utility_eval_quest.md`.
- [x] Keep refresh/reroll in existing quest picker.

Design rule:

Bottleneck missions should answer:

> 這個 NPC 與這個劇本主軸的關係，在此好感門檻發生什麼不可忽略的進展？

Tests:

- [x] Quest generator user message includes scenario axes.
- [x] Parser accepts valid `action/hooks`.
- [x] Invalid action/hook falls back or strips safely.
- [x] Fallback cards remain valid.
- [x] Completion still requires strict objective/conditions.
- [x] Reroll still avoids previously rejected titles.

Verification:

```powershell
npx vitest run tests/quest-generator.test.ts tests/utility-agent.test.ts tests/quest-picker-modal.test.ts
npx tsc --noEmit
```

### Phase 7 — Story Missions structured JSON and progression

Purpose: add fixed scenario mainline missions after ambient substrate is stable.

New files likely:

- `src/orchestrator/story-mission-runtime.ts`
- `documents/utility_eval_story_mission.md`
- `tests/story-mission-runtime.test.ts`

Files likely affected:

- `src/state/types.ts`
- `src/state/validators.ts`
- `src/state/state-manager.ts`
- `src/orchestrator/module-injector.ts`
- `src/orchestrator/orchestrator.ts`
- `src/agents/hype-lust-evaluator.ts`
- `src/workshop/validators.ts`
- `src/ui/quest-journal-modal.ts`
- `src/ui/bottom-strip.ts`
- `documents/workshop_scenario.md`
- `documents/workshop_scenario_form.md`
- `src/locale/zh-TW.ts`

Tasks:

- [x] Add story runtime state:
  - `currentIndex`
  - `completedIds`
  - `completed`
- [x] Initialize only when `missions.story.enabled === true`.
- [x] Inject only current active Story Mission.
- [x] Do not inject future Story Mission `fixed` facts.
- [x] Add UA completion field:
  - `storyMissionCompletion.completed`
  - `reason`
  - optional `signalMatched`
- [x] Completion should be medium-generous:
  - Accept reasonable partial/alternative progress.
  - Do not require exact wording.
  - But do not complete if unrelated.
- [x] Client advances index.
- [x] Mark story complete when index reaches `limit` or sequence end.
- [x] UI displays current Story Mission, no refresh button.

Prompt handling:

- `goal` may be visible.
- `fixed` is internal and must not be revealed directly.
- `signal` is evaluation guidance.

Tests:

- [x] Story disabled → no runtime state/injection.
- [x] Story enabled → current mission injected.
- [x] Future fixed facts are not injected.
- [x] Completion advances exactly one index.
- [x] Completed story stops injecting.
- [x] UI has no reroll/refresh for story.

Verification:

```powershell
npx vitest run tests/story-mission-runtime.test.ts tests/module-injector.test.ts tests/utility-agent.test.ts
npx tsc --noEmit
```

### Phase 8 — Scenario Workshop authoring

Purpose: make the new system authorable, not just hand-editable.

Files likely affected:

- `documents/workshop_scenario.md`
- `documents/workshop_scenario_form.md`
- `src/agents/scenario-workshop-agent.ts`
- `src/ui/scenario-workshop-form.ts`
- `src/workshop/validators.ts`
- `src/locale/zh-TW.ts`

Tasks:

- [x] Add form controls for `mission_profile`.
- [x] Add ambient settings section:
  - enabled
  - option count locked to 3 initially
  - next prompt within turns locked to 3 initially
- [x] Replace or supplement old bottleneck direction fields with scenario-linked fields:
  - NPC slot
  - gate
  - story axis
  - relationship axis
  - suggested action
  - suggested hooks
- [x] Add Story Mission section:
  - enabled
  - sequence editor
  - goal/fixed/signal fields
- [x] Update AI assistant prompt to generate mission fields.
- [x] Preserve legacy export compatibility.

UX:

- Story Mission editor should feel deliberate and heavier.
- Ambient configuration should stay light; most users should not need to hand-author each ambient mission.
- Bottleneck directions need enough structure to be meaningful, but should not become a screenplay.

Tests:

- [x] Form loads existing legacy scenarios.
- [x] Form exports new `missions` structure.
- [x] AI workshop response accepts and merges new fields.
- [x] Validation errors are localized.

Verification:

```powershell
npx vitest run tests/scenario-workshop-agent.test.ts tests/scenario-workshop-form.test.ts tests/workshop-validators.test.ts
npx tsc --noEmit
```

### Phase 9 — Documentation and migration cleanup

Purpose: align docs and clean old mental models.

Files:

- `documents/dogechat_dev_plan.md`
- `documents/design_reference.md`
- `documents/pacing_system_design.md`
- `documents/workshop_scenario.md`
- `documents/workshop_scenario_form.md`
- `architecture.md`
- `documents/INDEX.md`
- `documents/tickets.md`

Tasks:

- [x] Document Mission System v2.
- [x] Mark pacing events as legacy or replaced.
- [x] Update architecture quest/pacing references.
- [x] Update full technical spec.
- [x] Move T-071 to Done after verified implementation.

Verification:

- Manual doc review.
- `rg "pacing events|bottleneck quest|Story Mission|Ambient Mission" documents architecture.md`

## Suggested Implementation Batches

Batch A: Foundation

- Phase 1
- Phase 2 without UI
- Goal: schema, state, generator, scheduler.

Batch B: Ambient replaces pacing

- Phase 3
- Phase 4
- Phase 5
- Goal: player-facing ambient options, refresh, completion, mission-led preset, pacing legacy.

Batch C: Breakthrough gates

- Phase 6
- Goal: bottleneck quests become scenario-linked breakthrough missions while preserving existing picker/reroll UX.

Batch D: Story mainline

- Phase 7
- Phase 8
- Goal: opt-in structured Story Missions and Workshop authoring.

Batch E: Docs and cleanup

- Phase 9
- Goal: align project docs, close T-071.

## Verification Gate Before Closing T-071

Run:

```powershell
npx tsc --noEmit
npx vitest run
npm run build
npm run tauri:build
```

Manual Tauri smoke:

- Start a sandbox scenario.
- Confirm major NPCs receive ambient mission options.
- Refresh ambient options.
- Select ambient mission, complete it, confirm +5 under mission-led preset and next prompt within 3 turns.
- Hit a bottleneck, confirm 3 scenario-linked breakthrough options and reroll.
- Complete bottleneck, confirm unlock remains strict.
- Start a story-enabled scenario, confirm Story Mission appears fixed and cannot refresh.
- Complete Story Mission, confirm client advances index.
- Resume session, confirm all mission state persists.

## Open Implementation Questions

These should be answered during Phase 1 or before UI work:

1. Should ambient options be generated for all major NPCs immediately on session start, or lazily when the NPC first appears?
   - Recommended: lazily on first appearance to reduce upfront calls.

2. Should ambient mission option refresh have a hard limit?
   - Recommended: no hard limit initially, but track `refreshCount` for future tuning.

3. Should mission-led preset become default?
   - Recommended: no. Add it as selectable first; make default only after gameplay testing.

4. Should bottleneck quest completion grant affection in addition to unlock?
   - Recommended: no extra large affection reward initially. Unlock is the reward; any current-turn affection delta can flow through after unlock as existing code already handles.

5. How to identify major NPCs robustly?
   - Recommended: `initial_npcs.required === true` and slot mapping first; fallback to vital/registered scenario NPCs.

## Risk Notes

- Ambient missions can make NPCs feel needy if `DEPENDENCE` and `VULNERABILITY` dominate. Generator prompts should force hook variety.
- Story Missions can reduce sandbox freedom if enabled by default. Keep opt-in.
- Bottleneck quests can become too rigid if scenario axes are over-specific. Keep player solution flexible but completion evidence strict.
- Replacing pacing events touches UA eval, settings, docs, and module hooks. Keep legacy compatibility until ambient missions pass manual smoke tests.
- All player-facing text must remain in `src/locale/zh-TW.ts`; generated narrative content remains Traditional Chinese by prompt.
