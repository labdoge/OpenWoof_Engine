# Prompt Caching Fix — Dynamic Turn Injection Relocation

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop per-turn dynamic injections (dice rolls, pacing events, erotic milestones, combat resolution, etc.) from mutating cacheable system prompt blocks, so Gemini `CachedContent` is reused across turns instead of being recreated every turn.

**Architecture:** Currently `src/orchestrator/orchestrator.ts:2244-2252` appends `combinedDynamicPrompt` to the *last* `SystemPromptBlock`. That last block is sometimes Block 3 (`cacheable: false`) but sometimes Block 2 (`cacheable: true`) when `src/orchestrator/module-injector.ts:1639-1641` skipped creating a Block 3. Either way, the flat `assemblyResult.systemPrompt` also mutates, so Gemini's content fingerprint (`src/adapters/gemini.ts:555-570`) changes every turn and `ensureCache` recreates the cache. Fix: prepend the dynamic content to the user message (same mechanism already used for `_combatResolutionBlock` at line 2256 and `statusDelta` at line 2266). The LLM still reads the same directives; only their position moves from end-of-system-prompt to start-of-user-message. As a side-effect, this eliminates a pre-existing duplicate injection of `_combatResolutionBlock` that previously appeared in BOTH the system prompt AND the user message.

**Tech Stack:** TypeScript strict, Vitest. Affects `src/orchestrator/orchestrator.ts`. Verification requires temporary instrumentation in `src/adapters/gemini.ts`.

**Scope boundaries:**
- Does NOT touch caching audit Fix #2 (utility agents using `systemPromptBlocks`). Separate plan.
- Does NOT add permanent cache-hit metrics. Open a separate ticket if desired.
- Does NOT introduce a processTurn unit test seam. Manual log-based verification is cost-effective here.

---

### Task 1: Baseline — prove the cache-invalidation bug

**Files:**
- Modify (temporary, do NOT commit): `src/adapters/gemini.ts` — around `ensureCache` (~line 283-306)

- [ ] **Step 1: Add a temporary log in `ensureCache`**

Locate `ensureCache` and add a log right at the decision point. Example insertion:

```ts
// Inside ensureCache, at the point where we decide whether to recreate.
// Use the variable names present in the current file — adjust if they differ.
const needsRecreate = !existing || hash !== existing.hash || model !== existing.model;
AppLog.info(
  'GeminiCacheMetric',
  `${needsRecreate ? 'CACHE_RECREATE' : 'CACHE_REUSE'} hash=${hash.slice(0, 8)} model=${model}`,
);
if (needsRecreate) {
  // …existing recreate path unchanged…
}
```

- [ ] **Step 2: Start dev server**

```bash
cd H:/ClaudeCode/dogechat
export PATH="/c/Program Files/nodejs:$PATH"
npm run dev
```

- [ ] **Step 3: Play 5 turns with Gemini provider**

Open the app at `http://localhost:5173`, select Gemini provider, start any scenario, play 5 turns. Watch the browser dev console.

Expected (before fix): `CACHE_RECREATE` on every turn (turn 1 through turn 5).

Record the observed pattern for comparison after the fix.

- [ ] **Step 4: Leave the log in place**

Do NOT commit. Kill the dev server. The log stays local until Task 4.

---

### Task 2: Relocate dynamic prompt to user message

**Files:**
- Modify: `src/orchestrator/orchestrator.ts` lines 2240-2268

- [ ] **Step 1: Read the current block to confirm line numbers**

Before editing, re-read lines 2220-2270 to confirm the code still matches what this plan references. If lines shifted, adjust the Edit inputs accordingly.

Current code at lines 2240-2268 (what this plan targets):

```ts
      const combinedDynamicPrompt = [dynamicModulePrompt ?? '', diceInjections, sceneRollBlock, combatEfficacyBlock, this._combatResolutionBlock, knockoutHint, pacingInjection, eroticMilestoneInjection]
        .filter((s) => s.length > 0)
        .join('\n\n');

      if (combinedDynamicPrompt) {
        AppLog.info('Orchestrator', `[Block3 Dynamic] ${combinedDynamicPrompt.slice(0, 500)}`);

        const lastBlock = assemblyResult.systemPromptBlocks[assemblyResult.systemPromptBlocks.length - 1];
        if (lastBlock) {
          lastBlock.content += '\n\n' + combinedDynamicPrompt;
        }
        assemblyResult.systemPrompt += '\n\n' + combinedDynamicPrompt;
      }

      // ---- Step 8d: Inject combat resolution into user message for enforcement ----
      if (this._combatResolutionBlock) {
        formattedUserMsg = this._combatResolutionBlock + '\n\n' + formattedUserMsg;
        AppLog.info('Orchestrator', '[Combat→UserMsg] injected combat resolution into user message');
      }

      // ---- Step 9b: Inject status delta for state continuity ----
      // Prepend recent state-change summary to user message so the LLM is aware of
      // location/outfit/mood transitions across recent turns. Ephemeral — injected into
      // the LLM request but NOT stored in message history (would become stale noise).
      let llmUserMsg = formattedUserMsg;
      if (statusDelta) {
        llmUserMsg = statusDelta + '\n\n' + llmUserMsg;
        AppLog.info('Orchestrator', `[StatusDelta] injected ${statusDelta.split('\n').length - 1} delta line(s)`);
      }
```

Observe: `_combatResolutionBlock` appears in both `combinedDynamicPrompt` (line 2240) AND as a separate user-message prefix (line 2256). This is a pre-existing duplicate.

- [ ] **Step 2: Replace with user-message injection**

Apply this edit to `src/orchestrator/orchestrator.ts` (the entire 28-line block above becomes):

```ts
      // ---- Step 8c: Collect per-turn dynamic directives ----
      // NOTE: Dynamic content goes into the USER MESSAGE, not the system prompt.
      // This keeps systemPromptBlocks AND the flat systemPrompt string stable across
      // turns so Gemini CachedContent (content fingerprint) and Claude cache_control
      // breakpoints stay warm. The LLM still sees the directives — position is the
      // only thing that changes.
      const combinedDynamicPrompt = [dynamicModulePrompt ?? '', diceInjections, sceneRollBlock, combatEfficacyBlock, this._combatResolutionBlock, knockoutHint, pacingInjection, eroticMilestoneInjection]
        .filter((s) => s.length > 0)
        .join('\n\n');

      if (combinedDynamicPrompt) {
        AppLog.info('Orchestrator', `[Dynamic→UserMsg] ${combinedDynamicPrompt.slice(0, 500)}`);
      }

      // ---- Step 8d / 9b: Assemble final user message ----
      // Order (outermost → innermost): statusDelta → combinedDynamicPrompt → formattedUserMsg.
      // This matches the pre-existing pattern where statusDelta wraps combat-resolution
      // and combat-resolution wraps the player's action. Combat resolution is already
      // inside combinedDynamicPrompt (source of truth); do NOT re-inject separately.
      let llmUserMsg = formattedUserMsg;
      if (combinedDynamicPrompt) {
        llmUserMsg = combinedDynamicPrompt + '\n\n' + llmUserMsg;
      }
      if (statusDelta) {
        llmUserMsg = statusDelta + '\n\n' + llmUserMsg;
        AppLog.info('Orchestrator', `[StatusDelta] injected ${statusDelta.split('\n').length - 1} delta line(s)`);
      }
```

Summary of diff:
- **Removed** `lastBlock.content += '\n\n' + combinedDynamicPrompt;` (old line 2249)
- **Removed** `assemblyResult.systemPrompt += '\n\n' + combinedDynamicPrompt;` (old line 2251)
- **Removed** the separate Step 8d that re-injected `_combatResolutionBlock` into `formattedUserMsg` (old lines 2254-2258) — subsumed by the new single injection
- **Added** `llmUserMsg = combinedDynamicPrompt + '\n\n' + llmUserMsg;` inside the existing Step 9b block
- **Renamed** the log tag `[Block3 Dynamic]` → `[Dynamic→UserMsg]` for accuracy
- **Kept unchanged**: `statusDelta` injection, the construction of `combinedDynamicPrompt`, the fall-through log

- [ ] **Step 3: Run type check**

```bash
cd H:/ClaudeCode/dogechat
export PATH="/c/Program Files/nodejs:$PATH"
npx tsc --noEmit
```

Expected: 0 errors. If errors appear, they almost certainly refer to removed variables (`lastBlock`) — confirm the edit matches Step 2 exactly.

- [ ] **Step 4: Run full test suite**

```bash
npx vitest run
```

Expected: all 65 test files pass. If an orchestrator-adjacent test fails asserting on system-prompt content containing dynamic directives, that test is now obsolete — update its assertion to look at the user message instead. Report any such updates in the commit message.

---

### Task 3: Verify Gemini cache reuse

**Files:** (no source changes — runtime verification only)

- [ ] **Step 1: Play 5 turns with the Task 1 diagnostic log still active**

```bash
npm run dev
```

Select Gemini provider, same scenario as Task 1 baseline, play 5 turns.

Expected (after fix): `CACHE_RECREATE` on turn 1 only; `CACHE_REUSE` on turns 2, 3, 4, 5.

If still seeing `CACHE_RECREATE` every turn:
- Inspect `src/orchestrator/module-injector.ts:1594-1623` — is any Block-2 semi-stable section still receiving per-turn state (inventory changes, exploration narration hints, module style reminders)?
- The fix does not cover Block 2 churn. File a new ticket rather than expanding this PR.

- [ ] **Step 2: Smoke-test Claude provider**

Switch to Claude provider. Play 2 turns. Expected: no errors, no regression in narrative quality. Claude's cache is less sensitive to this bug (Block 3 was uncached anyway), so the main check is "no regression".

- [ ] **Step 3: Record observation in the commit trailer**

Note the CACHE_RECREATE → CACHE_REUSE pattern you observed. It goes in the commit message body in Task 5.

---

### Task 4: Remove temporary instrumentation

**Files:**
- Modify: `src/adapters/gemini.ts` — revert the Task 1 log

- [ ] **Step 1: Remove the diagnostic log**

Delete the `AppLog.info('GeminiCacheMetric', ...)` line added in Task 1 Step 1. Existing production logs in `ensureCache` (if any) stay.

- [ ] **Step 2: Confirm clean revert**

```bash
git diff src/adapters/gemini.ts
```

Expected: empty output (no diff on gemini.ts). If diff appears, the Task 1 log wasn't fully removed.

- [ ] **Step 3: Re-run type check and tests**

```bash
npx tsc --noEmit && npx vitest run
```

Expected: all green.

---

### Task 5: Commit

- [ ] **Step 1: Review the diff**

```bash
git diff src/orchestrator/orchestrator.ts
```

Expected: changes only in the Step 8c/8d region. No incidental edits to other parts of the file.

- [ ] **Step 2: Stage and commit**

```bash
git add src/orchestrator/orchestrator.ts
git commit -m "$(cat <<'EOF'
fix(pre-release): relocate dynamic turn injections to user message

Dynamic per-turn content (dynamicModulePrompt, diceInjections,
sceneRollBlock, combatEfficacyBlock, combatResolutionBlock, knockoutHint,
pacingInjection, eroticMilestoneInjection) was being appended to the last
SystemPromptBlock every turn. Because this block is sometimes cacheable
(Block 2 when module-injector produced no Block 3) and because the flat
assemblyResult.systemPrompt was also mutated, Gemini CachedContent's
content fingerprint changed every turn and the cache was recreated on
every request.

Move the dynamic content into the user message prefix (same mechanism
already used for statusDelta and the previously-duplicate combat
resolution injection). systemPromptBlocks and assemblyResult.systemPrompt
are now stable across turns, so Gemini CachedContent is reused after the
first turn. Claude cache_control breakpoints also benefit marginally
because Block 3 no longer fluctuates.

Side-effect: removes a pre-existing duplicate injection of
_combatResolutionBlock (previously appeared in both the system prompt and
the user message).

Verified: CACHE_RECREATE on turn 1, CACHE_REUSE on turns 2-5.
EOF
)"
```

---

### Self-review

- Spec coverage: audit Fix #1 → Task 2. Baseline reproduction → Task 1. Verification → Task 3.
- Placeholders: none — every code step shows the real code.
- Type consistency: variable names (`combinedDynamicPrompt`, `formattedUserMsg`, `llmUserMsg`, `statusDelta`, `_combatResolutionBlock`, `assemblyResult`) match existing code verbatim.
- Edge case: `_combatResolutionBlock` duplicate injection identified and resolved as a side-effect of the refactor.
- Risk: none to LLM-visible content (same directives, only position moves). Risk to tests: low (no test currently asserts on system-prompt dynamic content per audit).
