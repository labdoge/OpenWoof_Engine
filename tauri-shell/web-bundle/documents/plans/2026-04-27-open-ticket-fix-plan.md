# Open Ticket Fix Plan

Date: 2026-04-27

## Goal

Resolve the current Open tickets in a dependency-aware order, restore a clean verification baseline, and keep the implementation lean and aligned with the Tauri-only release target.

## Ticket Scope

Active tickets to plan:

- T-039: Resume should prefer stored `statusData`
- T-040: Session switch cleanup residual risk
- T-046: Gemini skips bottleneck quest completion checks
- T-055: Codex management layer for Claude-level assets
- T-056: Compression spec/tests drift
- T-057: Real memory-only storage fallback
- T-058: Tauri settings-store abstraction unused
- T-059: `continueTurn()` does not persist refreshed `statusData`
- T-060: Startup model discovery runs before Stronghold init
- T-061: Release bundle/code-splitting optimization

Resolved-but-still-in-Open tickets to verify and close:

- T-041, T-042, T-043, T-044, T-045

## Recommended Execution Order

### Phase 0: Ticket Hygiene

Purpose: make the tracker trustworthy before implementation begins.

Tasks:

- Verify T-041 through T-045 are still covered by current tests or by targeted manual inspection.
- Move verified fixed tickets from Open to Done with `Completed: 2026-04-27`.
- Keep T-040 Open because it explicitly says the fix is partial.

Verification:

- `npx tsc --noEmit`
- Targeted tests around affected areas where available:
  - `tests/orchestrator.test.ts`
  - `tests/module-injector.test.ts`
  - `tests/gemini-adapter.test.ts`
  - `tests/context-manager.test.ts`

### Phase 1: Restore Verification Signal

Tickets: T-056

Recommendation: treat current implementation constants as canonical, then update stale docs/tests.

Rationale:

- `src/constants.ts` already has compression presets and comments describing the lowered rolling-window thresholds.
- `documents/utility_compress.md` is more current than `documents/dogechat_dev_plan.md` for recap format.
- The failing tests are caused by unrealistic manual message/current-turn setup after `COMPRESSION_EXEMPT_TURNS` was added.

Implementation plan:

- Update `documents/dogechat_dev_plan.md` section 10.1 to match active presets:
  - standard: scheduled `6`, immediate `8`, hard cap `10`, keep `5`
  - note that aggressive/generous presets override these values.
- Update section 10.2 to match `documents/utility_compress.md`:
  - current scene/location line
  - never-shrink story arc line
  - key moments list
  - explicitly no NPC/player stats in recap.
- Update `tests/integration-pipeline.test.ts` compression cases so stored messages are old enough relative to `currentTurn`, or move those assertions to a focused `executeCompression()` test seam.
- Update stale comments in `tests/context-manager.test.ts` that still describe 20/25/30-turn thresholds.

Verification:

- `npx vitest run tests/context-manager.test.ts tests/integration-pipeline.test.ts`
- `npx vitest run`

### Phase 2: Status Persistence and Resume Correctness

Tickets: T-039, T-059

Recommendation: implement these together.

Rationale:

- T-039 asks resume rendering to trust stored `statusData`.
- T-059 identifies a path where `statusData` is not kept fresh.
- Fixing only T-039 first may expose stale continuation status in resumed sessions.

Implementation plan:

- Extend `MessageStore.replaceAssistantForTurn()` to accept optional `statusData`.
- Update both backends:
  - `src/storage/backends/indexeddb.ts`
  - `src/storage/backends/file-backend.ts`
- In `continueTurn()`, after recomputing/extracting `statusWindow`, persist both combined content and updated `statusData`.
- In `ChatPanel.loadHistory()`:
  - try `msg.statusData` first;
  - parse JSON defensively;
  - fall back to `parseStatus(msg.content)` for old messages.
- Add tests:
  - resume renders from valid `statusData` even when content status block is malformed;
  - fallback still works for old messages without `statusData`;
  - continuation updates stored `statusData`.

Verification:

- `npx vitest run tests/chat-panel.test.ts`
- storage backend tests, or add focused tests if none exist
- `npx vitest run tests/integration-pipeline.test.ts`

### Phase 3: API Startup and Settings Persistence

Tickets: T-060, T-058

Recommendation: fix T-060 first, then migrate settings incrementally.

T-060 implementation plan:

- Remove the startup discovery IIFE from `src/main.ts`.
- Add post-storage-init discovery in `initApp()` after `await initStorageProvider()`.
- Read provider/key after Stronghold cache is initialized.
- Keep discovery fire-and-forget, preserving fallback model behavior.

T-058 implementation plan:

- Promote `settings-store.ts` into a project-wide settings facade.
- Keep sensitive API keys in `secure-storage.ts`; do not route keys through settings JSON.
- Support synchronous reads from an initialized cache for existing call sites.
- Migrate settings in slices:
  1. provider + model slots + thinking/temperature;
  2. generation/compression/hype presets;
  3. persona/defaults/display settings;
  4. remaining low-risk UI preferences.
- Keep browser-dev fallback to `localStorage`.
- Add migration from old localStorage keys into the Tauri settings file on first launch.

Verification:

- `npx vitest run tests/gemini-adapter.test.ts tests/model-discovery.test.ts`
- settings modal tests if present; otherwise add targeted tests
- manual Tauri smoke test: save provider/model, restart, confirm values persist

### Phase 4: Real Memory-Only Storage Fallback

Tickets: T-057

Implementation plan:

- Add `src/storage/backends/memory-backend.ts` implementing the full `StorageBackend` interface.
- Add `activateMemoryFallback(reason)` and `isMemoryFallbackActive()` to `storage-provider.ts`.
- On backend initialization failure, switch to memory backend and fire the existing storage warning.
- In `withStorageFallback()`:
  - on write failure, switch to memory backend and retry once when safe;
  - on read failure, switch and return fallback/empty memory state;
  - avoid infinite retry if already in memory fallback.
- Use memory backend in test environments where `indexedDB` is unavailable.
- Ensure failure notification remains one-time.

Verification:

- New tests for fallback activation and retry behavior.
- `npx vitest run tests/integration-pipeline.test.ts`
- `npx vitest run`

### Phase 5: Quest Completion Reliability

Tickets: T-046

Implementation plan:

- Update `documents/utility_eval_quest.md`:
  - replace "skip entirely" gate with "always evaluate active quest";
  - require `completed: false` with a concise reason when not met.
- Update `src/agents/hype-lust-evaluator.ts` output contract:
  - `questCompletion` required for NPCs with `[Active Quest]`;
  - optional only for NPCs without active quest.
- Confirm parser accepts both `completed: true` and `completed: false`.
- Add tests:
  - active quest outputs false result and is retained;
  - active quest true result still completes;
  - absent quest does not require a field.

Verification:

- `npx vitest run tests/utility-agent.test.ts tests/quest-generator.test.ts`
- targeted integration test around active quest evaluation if available

### Phase 6: Session Switching Residual

Tickets: T-040

Implementation plan:

- Audit all direct session switch paths:
  - portal/session browser resume;
  - system cog sessions;
  - dev/test helpers;
  - any `resumeSession()` calls that bypass `endSession()`.
- Ensure switching sessions runs a single teardown path:
  - clear chat panel;
  - clear sidebar/bottom strip;
  - close overlays/modals where appropriate;
  - reset transient orchestrator/UI state;
  - load resumed history/status from storage.
- Avoid double confirmation when the user intentionally resumes another session from Session Browser.
- Add regression test for switching from active session A directly to B.

Verification:

- `npx vitest run tests/session-selector.test.ts tests/chat-panel.test.ts` if available
- otherwise add/extend session-flow tests
- manual browser/Tauri smoke: start A, open B, confirm no stale UI remains

### Phase 7: Codex Management Layer

Tickets: T-055

Implementation plan:

- Create `.codex/README.md`.
- Create `.codex/migration-map.md` listing every `.claude` asset as:
  - `linked`
  - `mirrored`
  - `converted`
  - `Claude-only`
- Create `.codex/agents/ticket-triager.md` as a thin wrapper around `.claude/agents/ticket-triager.md`.
- Convert `.claude/commands/*.md` into `.codex/commands/*.md` recipes.
- Add `.codex/hooks/README.md` documenting why Claude hooks/settings are not directly portable.
- Update `AGENTS.md` ticket-triager path from `.Codex/...` to `.codex/...`.

Verification:

- Fresh Codex session sanity check.
- Confirm `.claude` files remain unmoved and unchanged.

### Phase 8: Lean Build Optimization

Tickets: T-061

Recommendation: do this after correctness work, because import graph changes are easy to overcut.

Implementation plan:

- Capture baseline build output:
  - main chunk size
  - warning list
  - largest modules by manual inspection of Vite output
- Remove ineffective dynamic imports where the same module is statically imported in startup paths.
- Lazy-load heavy UI/workshop/import/export surfaces from `app.ts` only when opened:
  - workshop forms
  - import portal/question flow
  - novel export
  - analytics/memory/lore panels if safe
- After import cleanup, consider `build.rollupOptions.output.manualChunks`.
- Avoid new dependencies unless bundle analysis cannot be done with existing Vite output.

Verification:

- `npm run build`
- compare main chunk size before/after
- smoke test dynamic views that were lazy-loaded

## Optional Optimization Add-ons

These are welcome but should not block the active tickets:

- Reduce expected-test log noise by routing storage fallback warnings through `AppLog` and suppressing expected parser warnings in tests.
- Gate production DevTools opening behind a debug flag before release.
- Add a lightweight "build warnings budget" note so future static/dynamic import regressions are caught during review.
- Add a short storage architecture note once T-057 and T-058 land, because those two change the practical persistence story.

## Final Validation Gate

Before closing the batch:

- `npx tsc --noEmit`
- `npx vitest run`
- `npm run build`
- Tauri smoke:
  - first launch setup
  - save API key
  - restart and confirm model discovery/settings persistence
  - start session, play 2 turns, continue turn, resume session
  - switch sessions directly

## Suggested Implementation Batches

Batch A:

- Phase 0 + Phase 1
- Goal: clean tracker and restore failing test baseline.

Batch B:

- Phase 2 + Phase 3
- Goal: status persistence, Stronghold startup, settings foundation.

Batch C:

- Phase 4 + Phase 5 + Phase 6
- Goal: runtime resilience and gameplay correctness.

Batch D:

- Phase 7 + Phase 8
- Goal: Codex workflow integration and bundle lean-out.
