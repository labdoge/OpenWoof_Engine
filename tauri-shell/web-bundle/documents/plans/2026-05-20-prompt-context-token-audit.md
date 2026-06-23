# Prompt Context / Token Audit — 2026-05-20

## Goal

清理 Main Session 可見輸出漏出風險與每回合動態 prompt 成本。原則是先移除或壓縮 prompt-only metadata，保留玩法權威與敘事連續性。

## Audit Matrix

| Block / label | Source | Tier | Purpose | Leak risk | Token cost | Action |
|---|---|---:|---|---|---:|---|
| `[OUTPUT GUIDANCE]` | `module-injector.ts` | Block 3 | 每回合長度與輸出格式 | High | High, every turn | 已壓縮重複 no-metadata/no-reasoning wording，保留長度硬限制 |
| `[Scene]` | `formatSceneContextInjection()` | Block 3 | 地點、時間、在場、場景狀態 | High | Medium, every turn | 保留注入；新增 sanitizer；`core.md` 不再明講 literal `[Scene]` |
| `[NPC State]` | `formatNPCState()` | Block 3 | NPC affection、hype/lust、衣著、瓶頸 | High | High with many NPCs | 保留；新增 sanitizer 防漏；後續可評估只注入 in-scene + recently relevant |
| `[Restrictions]` | `formatNarrativeRestrictionMarkers()` | Block 3 | 當前敘事限制層級 | Medium | Low/medium | 保留；尾端從 `[verify compliance]` 壓為 `[verify]` |
| `[UA Tn]` | `formatUAEvalInjection()` | Block 3 | UA-authoritative hype/lust/affection delta | Medium | Low/medium | 保留；尾端壓為 `[authoritative]` |
| `[Quests ...]` | `formatActiveQuestInjection()` | Block 3 | Bottleneck quest hook | Medium | Medium when active | 保留；sanitizer 防漏 |
| `[Active Ambient Missions]` | `ambient-mission-scheduler.ts` | Block 3 | NPC-first ambience hooks | High | Medium when active | 已移除一整行說明，改為 compact header |
| `[Active Story Mission]` | `story-mission-runtime.ts` | Block 3 | 固定主線節點 | High | Medium/high when active | 已壓縮 header、field names、rules wording |
| `[NPC Dynamics]` | `formatNPCInteractionInjection()` | Block 3 | 多 NPC 互動提示 | Medium | Low/medium | 保留；sanitizer 防漏 |
| `[Style ...]` | `buildStyleReminder()` | Block 3 | module style reinforcement | Medium | Low, every enabled styled module | label 從 `STYLE REMINDER` 壓成 `Style` |
| `[Player Inventory]` | `module-injector.ts` | Block 3 | 探索物件提示 | Medium | Low | 保留；sanitizer 防漏 |
| Scene Entities | `scene-entity-formatter.ts` | Block 3 | 場景實體一致性 | Medium | Medium when populated | 保留；sanitizer 防漏；後續可限量/top relevant |
| Event / combat result blocks | `event-pipeline.ts`, `module-injector.ts` | Block 3 | 機械結果必須忠實敘事 | Medium | High during events | 保留；system sanitizer + prompt sanitizer 防漏 |
| Legacy Status Window wording | `core.md`, `commands.md` | Static / conditional | 舊狀態管線殘留 | Medium | Low but confusing | `commands.md` 改為 runtime state；Main prompt已避免要求 Status Window |

## Implemented

- Added `stripLeakedPromptContext()` and `PromptContextStreamFilter`.
- Applied sanitizer to streaming output, final stored output, continuation append/replace, history rendering, and context assembly.
- Reduced dynamic Block 3 wording for output guidance, ambient missions, story missions, UA/restriction tails, and style reminder labels.
- Removed literal `[Scene]` mention from `core.md` scene-header warning.
- Replaced a legacy `Status Window` reference in `commands.md`.

## Expected Impact

- No extra LLM calls.
- Sanitizer has zero prompt-token cost and small local CPU cost.
- Main Session dynamic prompt savings:
  - `[OUTPUT GUIDANCE]`: roughly 35-60 input tokens per turn.
  - Active Ambient Mission block: roughly 20-30 tokens when active.
  - Active Story Mission block: roughly 35-60 tokens when active.
  - Small label/tail savings elsewhere: roughly 5-15 tokens per affected turn.
- Practical target after this pass: around 40-120 fewer uncached input tokens on normal turns, more when story/ambient missions are active.

## Follow-Up Candidates

- Measure real `systemPromptBlocks[2]` char/token length in telemetry before/after several turns.
- Consider limiting `[NPC State]` to in-scene NPCs plus recently referenced absent NPCs if profile injection already covers static identity.
- Cap Scene Entity injection by relevance/recency when entity count grows.
- Normalize all prompt-only dynamic labels to a small registry so sanitizer and injection format cannot drift.
