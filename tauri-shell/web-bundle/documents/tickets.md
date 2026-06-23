# Tickets

> Next ID: T-163

## Open

### T-134: Ambient Missions toggle can still leave background generation/prompt loop active
- **Type**: bug
- **Reported**: 2026-06-08
- **Details**: When Ambient Missions are turned OFF from the cog/settings menu, existing due ambient mission state can still be picked up by the UI prompt scheduler. This can repeatedly call the ambient prompt path and, depending on runtime setting refresh timing, may still enqueue Scene Ops ambient generation requests or spam background generation-failed warnings/errors.
- **Initial triage**: `settings-saved` refreshes orchestrator mission toggles, and `generateAmbientMissionOptions()` guards `_ambientMissionsEnabled`, but `src/ui/state-listeners.ts` schedules `maybePromptAmbientMission()` solely from existing `state.missions.ambient` due state and unconditionally reschedules in `finally`. Verify the fix gates the UI scheduler/prompt candidate on current Ambient Missions enabled state, clears or postpones stale due prompts when disabled, and prevents repeated Scene Ops calls after toggling OFF mid-session.
- **Verification target**: Add/adjust tests around settings toggle + ambient prompt scheduling so OFF prevents calls to `orchestrator.generateAmbientMissionOptions()` and does not repeatedly reschedule the same due mission.

### T-135: Ambient Mission completion reward is skipped on non mission-led affection presets
- **Type**: bug
- **Reported**: 2026-06-08
- **Details**: Completing Ambient Missions should always grant the configured affection reward. Currently, if the player chooses `slowburn`, `standard`, or `dramatic` instead of `mission-led`, Ambient Mission completion applies no affection reward.
- **Initial triage**: `src/orchestrator/orchestrator.ts` `processAmbientMissionCompletions()` only calls `stateManager.applyAmbientMissionCompletionReward()` when `hypePreset.id === 'mission-led'`, and logs reward skipped otherwise. `AMBIENT_MISSION_AFFECTION_REWARD` already exists in `src/constants.ts`; `StateManager.applyAmbientMissionCompletionReward()` applies it through normal bottleneck caps.
- **Verification target**: Update orchestrator/integration tests to confirm Ambient Mission completion applies the reward for every `HypePresetId`, remains bottleneck-capped, and still logs/diagnoses completion clearly.

### T-142: Storyteller mode setup parity and conversion/adoption gaps
- **Type**: improvement
- **Reported**: 2026-06-22
- **Details**: Investigate and align Storyteller Mode game setup with standard scenario setup so standard scenarios/scenes can be converted/adopted into playable storyteller scenarios. Current duplicate-to-storyteller behavior sets `playMode` and `storyteller` defaults but does not rewrite `player_setup`, `initial_scene.opening_context`, `adoption_rule`, or guide protagonist-slot selection.
- **Initial triage**: Storyteller already reuses `CharacterSetupFlow`, scenario adoption, traits, portraits, lorebook/succession/module setup, protagonist slot resolution, third-storyteller prompt injection, actor-prefixed input, and EventAgent storyteller context. Gaps: persona/trait/class setup can still appear, `player_setup` remains required as a mechanical shell, first-turn opening context may stay second-person, narrator portal only filters storyteller scenarios, multi-protagonist input lacks prefix UX, and event mechanics still inject a synthetic `__player__` entity.
- **Partial implementation**: 2026-06-22 added Storyteller conversion wizard, AI-assisted rewrite fallback, Workshop/Portal entry points, deterministic conversion helpers, reviewed copy saving, and setup cleanup that skips persona/trait/class prompts in Storyteller sessions. Combat/event `__player__` remap remains out of scope for this pass.
- **Partial implementation**: 2026-06-23 handled the combat/event player-shell gap for Storyteller runtime paths: new CombatV2 state can omit `__player__`, legacy `__player__` combatants are removed on Storyteller sync, EventAgent participants/resources no longer include hidden player state, combat rewards skip Storyteller XP, resume HUD does not read `__player__` resources, and missing protagonist actors no longer fall back to a hidden player shell. Remaining T-142 conversion/setup UX gaps stay open.
- **Verification target**: Add tests for conversion wizard/defaults, third-person opening context, session-flow storyteller preflight, protagonist slot resolution after imported/generated profiles, actor-prefix input UX, and combat/event pipeline behavior without unintended player-protagonist control.

## Done

### T-162: Cog menu session navigation can hang while leaving an active session
- **Type**: bug
- **Reported**: 2026-06-23
- **Completed**: 2026-06-23
- **Resolution**: Added a guarded `leaveActiveSession()` coordinator for active-session navigation and separated completed endings from temporary parking. The cog menu now has an explicit end-current-game action; New Game, Sessions, Session Browser resume, and Session Browser new-game all route through the coordinator before navigating. `orchestrator.parkSession()` saves the current state as `in_progress` without final profile updates, while `orchestrator.endSession()` remains the completed-ending path and bounds final profile/progression LLM calls with a 12s budget. Cache cleanup no longer blocks navigation, and confirmed leave attempts always clear session UI in `finally` even if end/park fails. Added regression coverage for parking, completed-end failure cleanup, concurrent leave guarding, and lifecycle status updates.

### T-161: Storyteller plot/bottleneck quest text still assumes protagonist perspective
- **Type**: bug
- **Reported**: 2026-06-23
- **Completed**: 2026-06-23
- **Resolution**: Reframed Storyteller plot quest generation to god-lens neutral language across runtime prompts, deterministic fallbacks, seeded card adaptation, and quest-generator docs. Storyteller plot cards now use scene, plot, faction, pressure, consequence, witnesses, locations, or threats as subjects instead of assuming a player/protagonist must act. Generated or seeded cards containing `玩家`, second-person, `主角`, `主角方`, or English player/protagonist phrasing are sanitized into neutral scene wording or replaced with lane-specific neutral fallbacks, while standard NPC bottleneck quest behavior remains unchanged.

### T-160: Trivia auto-add pipeline is too sparse and easy to miss
- **Type**: bug
- **Reported**: 2026-06-23
- **Completed**: 2026-06-23
- **Resolution**: Aligned the Scene Ops status extraction document with the runtime schema, including `physicalEvidence` and `triviaUpdates`, and clarified that a turn may return only `triviaUpdates` when no status patch is needed. Strengthened the status prompt to scan each in-scene NPC for at most one stable lightweight fact per turn while preserving the existing 8-60 character, single-sentence, non-tag, non-paragraph quality gate. Parser tolerance now accepts `npcName`, `name`, or resolvable `npcId`, and internal diagnostics record proposed, accepted, and rejected Trivia counts with reasons such as invalid sentence, low confidence, unknown NPC, duplicate, cap reached, or state add rejection. Orchestrator application now logs a compact Trivia summary while keeping the subtle toast behavior for accepted session-local notes.

### T-159: Storyteller mode can leak other chat-mode-only mechanics through player shell, prompts, quests, and persistence
- **Type**: bug
- **Reported**: 2026-06-23
- **Completed**: 2026-06-23
- **Resolution**: Added a broader Storyteller isolation pass across prompts, state, UI flow, quests, combat/event routing, analytics, and profile persistence. Storyteller prompts now omit player traits, player-framed inventory, standard active quests, NPC affection/bottleneck rows, personal/erotic milestone guardrails, succession recognition, and session NPC gameplay trait merges; inventory context is framed as story inventory. Utility/Event agents now treat Storyteller input as director/protagonist action and do not advance affection, bottlenecks, relationship gates, or player-avatar mechanics. Standard quest refresh/skip/display and emotion affection snapshots are disabled in Storyteller, profile updates preserve original affection/bottlenecks while still allowing story progress fields, and legacy `__player__` combat/resource reads are guarded so protagonist NPCs can own Storyteller combat state. Regression coverage was added for prompt omission, profile preservation, suggestion context, state guards, combat without hidden player combatants, and updated tension behavior.

### T-158: Storyteller mode can still award hidden player XP and trigger character trait picker
- **Type**: bug
- **Reported**: 2026-06-23
- **Completed**: 2026-06-23
- **Resolution**: Added Storyteller-mode guards so `awardXP()`, player trait mutations, NPC trait milestone marking, NPC gameplay trait additions, standard quest mutation, combat rewards, and level-up detection no-op under `third-storyteller`. `applyUtilityAgentEval()` still updates hype, lust/module state, mental state, and critical-event signals, but forces affection deltas to zero and skips XP/bottleneck progression in Storyteller. Character trait generation APIs now return `null` in Storyteller, while Storyteller plot trait generation remains available through `state.storyteller.plotTraits`. Regression tests verify Storyteller UA/combat/prompt flows do not mutate hidden player XP/traits or NPC gameplay traits.

### T-157: Status patch recovery can report success while physical/status updates are dropped
- **Type**: bug
- **Reported**: 2026-06-23
- **Completed**: 2026-06-23
- **Resolution**: Hardened schema-recovery fallback so status payloads wrapped under `patch`, `status`, `statusWindow`, or `statusPatch` are unwrapped, and NPC rows/evidence using `npcName` or `npcId` can still resolve to the correct `name`. Missing or misaligned `physicalEvidence` no longer clears physical patches by itself; only explicit low confidence clears immediately, while missing evidence falls through to the narrative cue guard. Added raw/final patch diagnostics plus confidence/cue-cleared field summaries, and Orchestrator now logs material mutation summaries with `status_patch_no_material_mutation` when a Scene Ops patch produces no state-changing status update. Regression tests cover DeepSeek-style fallback shapes, wrapper payloads, missing/low evidence, scene-only patches, and carry-forward material mutation detection.

### T-156: Scene Ops status extraction can miss appearance changes and carry stale physical state forward
- **Type**: bug
- **Reported**: 2026-06-23
- **Completed**: 2026-06-23
- **Resolution**: Confirmed the status extraction prompt/source files are valid UTF-8 and the apparent mojibake was terminal display, then hardened Scene Ops status extraction with recent 3-turn narrative context, explicit physical-change evidence/confidence metadata, and guarded clearing for low-confidence `appearance` / `outfit` patches. `buildStatusDelta()` now reports player/NPC appearance deltas as well as outfit deltas, and regression tests cover current-turn changes, carry-forward safety, and hallucinated physical patch rejection.

### T-155: Storyteller trait additions should never mutate character traits
- **Type**: bug
- **Reported**: 2026-06-23
- **Completed**: 2026-06-23
- **Resolution**: Added Storyteller-mode guards so NPC gameplay trait mutation APIs no-op under `third-storyteller`, profile update merge skips NPC trait writes in Storyteller sessions, and Storyteller trait flow remains limited to `state.storyteller.plotTraits`. Added regression coverage proving Storyteller character traits stay unchanged while normal-mode trait behavior remains intact.

### T-154: Add editable essential-NPC Trivia as lightweight session memory
- **Type**: feature
- **Reported**: 2026-06-23
- **Completed**: 2026-06-23
- **Resolution**: Added session-local NPC Trivia notes with profile-accepted persistence, prompt injection, Scene Ops auto-add, subtle notification, overlay edit/delete/accept controls, import/export preservation, and profile validators. Trivia is capped at 8 notes per NPC, deduped, restricted to one short lean-but-clear sentence of 8-60 Traditional Chinese characters, and rejects single-word tags or paragraph-like entries. Auto-added notes remain temporary until the player accepts them into the permanent profile.

### T-153: Storyteller mode should keep NPC hype, arousal, and inner thought indicators while hiding affection numbers
- **Type**: improvement
- **Reported**: 2026-06-23
- **Completed**: 2026-06-23
- **Resolution**: Adjusted Storyteller status rendering so only affection values/tier/bars are hidden. NPC cards and character status windows now keep hype, lust/arousal module indicators, mental state, current mood, and inner thought where available, with UI regression tests covering the Storyteller gating behavior.

### T-152: Saved session cards should show Chat vs Storyteller mode
- **Type**: improvement
- **Reported**: 2026-06-23
- **Completed**: 2026-06-23
- **Resolution**: Added a persisted-session mode pill to Saved Session cards, derived from `gameState.meta.perspective`, showing `說書人` for `third-storyteller` and `聊天模式` for standard, first-person, or legacy/missing-meta sessions. Added locale strings, styling, and render coverage for Storyteller/chat/legacy cards.

### T-151: Dead NPCs should become permanently absent from the current session
- **Type**: improvement
- **Reported**: 2026-06-22
- **Completed**: 2026-06-22
- **Resolution**: Added per-session NPC lifecycle status (`active`, `dead`, `permanentlyAbsent`) plus StateManager marking APIs. Dead/permanently absent NPCs are removed from `scene.present`, blocked from presence rebuild drift, excluded from status rows, prompt/eval context, ambient candidates, and quest generation, while temporary absence can still return normally. Status extraction now accepts only explicit `dead` / `permanentlyAbsent` lifecycle signals, avoiding accidental death from incapacitated/downed wording.

### T-150: Add short chapter character-count preset for 2500-3500 Chinese characters
- **Type**: improvement
- **Reported**: 2026-06-22
- **Completed**: 2026-06-22
- **Resolution**: Added the `short-chapter` scene length preset, Traditional Chinese and English locale labels, preset/token mapping, settings/cog UI support, CSS cost bar support, and prompt output guidance that targets `2500~3500` Chinese characters without changing existing defaults.

### T-149: Storyteller bottleneck missions should focus on whole-plot beats instead of NPC affection gates
- **Type**: feature
- **Reported**: 2026-06-22
- **Completed**: 2026-06-22
- **Resolution**: Added Storyteller plot quest mode separate from NPC `activeQuests`. Plot quests are keyed to global tension bottleneck gates, generated as whole-plot beat choices, completed via top-level `storytellerPlotQuestCompletion`, and unlock tension progression without mutating NPC affection bottleneck state. Storyteller plot quest selection now always presents a 3-option picker, matching traditional bottleneck quest UX.

### T-148: Storyteller tension milestones should grant plot-wide traits instead of NPC-specific affection milestones
- **Type**: feature
- **Reported**: 2026-06-22
- **Completed**: 2026-06-22
- **Resolution**: Added Storyteller plot-wide trait generation and milestone state for tension milestones. Plot traits are stored under `state.storyteller.plotTraits`, rendered in Storyteller UI, injected into Storyteller prompt context, and do not write to NPC/profile trait state. Storyteller plot trait selection now always presents a 3-option picker before applying a chosen global trait.

### T-147: Storyteller Mode should replace affection setting with an overall tension gauge
- **Type**: feature
- **Reported**: 2026-06-22
- **Completed**: 2026-06-22
- **Resolution**: Added persisted `StorytellerPlotState` with tension, milestones, plot traits, tension bottlenecks, and active/completed plot quests. Storyteller sessions initialize this state, render an overall tension gauge and plot trait summary, hide affection-focused settings where appropriate, and inject tension/tier/traits/active plot quest into prompts while preserving standard-mode affection behavior.

### T-146: Ambient Missions should behave more like plot beat twists and affect Storyteller tension instead of affection
- **Type**: improvement
- **Reported**: 2026-06-22
- **Completed**: 2026-06-22
- **Resolution**: Reframed Storyteller Ambient Mission generation as scene pressure, plot twist, and dramatic beat options. Storyteller ambient completion now increases global tension only and does not grant NPC affection, while standard mode retains the existing affection reward path. Storyteller ambient generation is fixed to 3 options and bypasses global ambient auto-pick so it always opens the picker.

### T-145: Negative mood appears to add affection instead of subtracting it
- **Type**: bug
- **Reported**: 2026-06-22
- **Completed**: 2026-06-22
- **Resolution**: Added sign guards to Utility Agent affection application under hype preset ranges: negative hype cannot become positive affection gain, flat hype resolves to zero, and positive hype cannot subtract affection. Updated hype range prompt formatting to state negative-only / zero-only / positive-only constraints and added coverage for negative, flat, and positive hype deltas.

### T-144: Storyteller conversion drops the original player character premise instead of converting it into an NPC
- **Type**: bug
- **Reported**: 2026-06-22
- **Completed**: 2026-06-22
- **Resolution**: Added deterministic Storyteller conversion shaping that snapshots the original `player_setup` before the hidden director shell is applied, preserves it as a normal former-player NPC slot plus matching `npc_generation_pool` seed, defaults converted Storyteller protagonists to that slot, and keeps no-NPC/equivalent-slot conversions idempotent under the 5-slot and 8-seed validator limits. The conversion wizard now offers the former-player NPC slot by default, while AI rewrite remains limited to title/opening/adoption/director-shell fields. Added conversion, wizard-adjacent resolve, runtime/status extraction, precomputed status, and status-window rendering tests proving the former-player protagonist resolves through NPC profiles, updates under `status.npcs`, and never reappears as `status.player` or `■ 你`. Verified targeted Storyteller tests, full Vitest, `npm run build`, and Tauri release binary build via `npm run tauri:build -- --no-bundle`; full installer bundling still fails at the existing WiX `light.exe` MSI step after `woofychatty.exe` is produced.

### T-143: Storyteller gameplay pipeline still behaves like player-centric chat mode
- **Type**: bug
- **Reported**: 2026-06-22
- **Completed**: 2026-06-22
- **Resolution**: Implemented adapter-first Storyteller runtime fixes. Storyteller conversion now creates only a hidden director/mechanical shell and session lifecycle skips player persona/trait/outfit application. Status precompute and merge suppress the `player` row for `third-storyteller`, while protagonist entities remain NPC rows. Main prompt, first-turn rules, narrative input injection, opening scene handling, status extraction, Utility Agent context, Event Agent, combat/action selection, ambient mission generation, and quest generation now receive Storyteller/director/protagonist semantics while keeping legacy internal compatibility fields. Novel export perspective labeling now displays Storyteller wording instead of second-person, and Storyteller bottom-strip/input UI uses director/protagonist wording instead of player shell stats. Verified targeted Storyteller tests, full Vitest, `npm run build`, and Tauri release binary build via `npm run tauri:build -- --no-bundle`; full installer bundling still fails at the existing WiX `light.exe` MSI step after `woofychatty.exe` is produced.

### T-141: Update Claude and Gemini provider defaults to latest tier models
- **Type**: improvement
- **Reported**: 2026-06-22
- **Completed**: 2026-06-22
- **Resolution**: Updated Claude defaults and dynamic escalation to `claude-sonnet-4-6`, `claude-opus-4-8`, and `claude-haiku-4-5-20251001`; updated Gemini defaults and dynamic standard tier to `gemini-3.5-flash`, `gemini-3.1-pro-preview`, and `gemini-3.1-flash-lite`. Added stale-model migrations for older Claude 4 / Gemini 2.5 / Gemini 3 preview IDs, tightened allow-lists to the latest chat tiers, and mapped Claude Opus 4.8 thinking to adaptive thinking plus `output_config.effort` instead of legacy `budget_tokens`. Verified provider/model tests, TypeScript, and the full Vitest suite.

(Pruned: T-136-T-140 completed 2026-06-08 through 2026-06-12, archived)
(Pruned: T-123-T-133 completed 2026-06-02 through 2026-06-03, archived)
(Pruned: T-117-T-121 completed 2026-05-27 through 2026-05-28, archived)
(Pruned: T-111-T-116 completed 2026-05-21 through 2026-05-24, archived)
(Pruned: T-102-T-110 completed 2026-05-20, archived)
(Pruned: T-092-T-101 completed 2026-05-18 through 2026-05-19, archived)
(Pruned: T-082-T-091 completed 2026-05-11, archived)
(Pruned: T-062-T-081 completed 2026-05-04 through 2026-05-10, archived)
(Pruned: T-039???046, T-055???061 ??completed 2026-04-27, archived)
(Pruned: T-022, T-038 ??completed >7 days ago)
(Pruned: T-036, T-037 ??completed 2026-03-25, archived)

(Pruned: T-047, T-048, T-049, T-050, T-051, T-052, T-053, T-054 completed 2026-04-08, archived)

*(Pruned: T-018???035 completed 2026-03-22, archived)*
*(Pruned: T-001???017 completed 2026-03-21, archived)*
