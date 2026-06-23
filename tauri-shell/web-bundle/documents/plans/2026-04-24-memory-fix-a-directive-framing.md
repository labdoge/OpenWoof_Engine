# Memory Referencing Fix A — Anti-Repetition Framing

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce the frequency at which the Main Session LLM replays emotional beats already narrated in the previous turn, by adding a framing directive that tells the model to treat per-turn dynamic injections as context rather than imperatives.

**Architecture:** Prepend one Traditional Chinese meta-instruction line to `combinedDynamicPrompt` before it is injected into the user message. The instruction frames the dynamic block as "mechanical state update — reference only, continue from previous narrative endpoint". Expected to help 60–70% depending on the model's willingness to honor the framing. **This is a hypothesis test, not a confirmed fix.** If ineffective, Plan C (directive state tracking, separate plan file) is the follow-up.

**Tech Stack:** TypeScript strict, Vitest. Affects `src/orchestrator/orchestrator.ts` only.

**Scope boundaries:**
- Does NOT modify directive content, trigger conditions, or state schema.
- Does NOT add locale entries (hardcoded Chinese string; if the fix sticks, promote to locale in a follow-up).
- Does NOT touch cache architecture (content stays in user message, Block 1/2 stay stable).
- Does NOT add automated tests for behavior (LLM behavior isn't deterministic; manual gameplay protocol covers verification).

**Expected impact:**
- Behavioral: model less likely to replay T-1 beats when dynamic directives re-fire with unchanged content.
- Cost: +1 line (~60 characters) added to every turn's user message. Negligible token overhead (≈20 tokens).
- Cache: unchanged (line is stable across turns, part of the user-message prefix, does not affect `systemPromptBlocks`).

---

### Task 1: Apply the framing prefix

**Files:**
- Modify: `src/orchestrator/orchestrator.ts` (Step 8d / 9b region, around lines 2254-2270 after the `e6c36ce` caching relocation)

- [ ] **Step 1: Re-read current code to confirm line numbers**

Before editing, read lines 2240-2275 to verify the code still matches what this plan targets. If shifted, adjust the Edit inputs.

Current target block (after `e6c36ce`):

```ts
      // ---- Step 8d / 9b: Assemble final user message ----
      // Order (outermost → innermost): statusDelta → combinedDynamicPrompt → formattedUserMsg.
      // ... (comment block) ...
      let llmUserMsg = formattedUserMsg;
      if (combinedDynamicPrompt) {
        llmUserMsg = combinedDynamicPrompt + '\n\n' + llmUserMsg;
      }
      if (statusDelta) {
        llmUserMsg = statusDelta + '\n\n' + llmUserMsg;
        AppLog.info('Orchestrator', `[StatusDelta] injected ${statusDelta.split('\n').length - 1} delta line(s)`);
      }
```

- [ ] **Step 2: Apply the Edit**

Replace the target block with:

```ts
      // ---- Step 8d / 9b: Assemble final user message ----
      // Order (outermost → innermost): statusDelta → [framing prefix + combinedDynamicPrompt] → formattedUserMsg.
      //
      // The framing prefix tells the LLM that dynamic directives are state context
      // (reference material), not imperative beat prompts. Without this, per-turn
      // milestone/pacing directives that keep firing while their state conditions
      // persist cause the model to re-narrate beats already addressed in the prior
      // turn's assistant response.
      //
      // Hypothesis test — if this reduces replay frequency in gameplay, it confirms
      // model-level imperative/context confusion is the exacerbating factor. If not,
      // see Plan C (directive state tracking) for the architectural fix.
      let llmUserMsg = formattedUserMsg;
      if (combinedDynamicPrompt) {
        const dynamicWithGuard = [
          '[本段為本回合機制狀態更新,請作為上下文參考;請從上一回合敘事的結束點繼續推進,不要重複或重新建立已發生的情節或情緒節拍。]',
          combinedDynamicPrompt,
        ].join('\n\n');
        llmUserMsg = dynamicWithGuard + '\n\n' + llmUserMsg;
      }
      if (statusDelta) {
        llmUserMsg = statusDelta + '\n\n' + llmUserMsg;
        AppLog.info('Orchestrator', `[StatusDelta] injected ${statusDelta.split('\n').length - 1} delta line(s)`);
      }
```

Diff summary:
- Added `dynamicWithGuard` assembly with 1 hardcoded Traditional Chinese framing line.
- Swapped `combinedDynamicPrompt` for `dynamicWithGuard` in the user-message prepend.
- Expanded comment block.

- [ ] **Step 3: Run type check**

```bash
cd H:/ClaudeCode/dogechat
export PATH="/c/Program Files/nodejs:$PATH"
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Run full test suite**

```bash
npx vitest run
```

Expected: the 3 pre-existing `tests/integration-pipeline.test.ts > E. Context Compression` failures (documented in commit `e6c36ce`) still fail; everything else passes. Confirm no NEW failures were introduced. If any previously-passing test now fails, stop and investigate — the orchestrator change should not affect test outputs.

---

### Task 2: Commit

- [ ] **Step 1: Review the diff**

```bash
git diff src/orchestrator/orchestrator.ts
```

Expected: changes only in the Step 8d/9b region. No incidental edits.

- [ ] **Step 2: Commit**

```bash
git add src/orchestrator/orchestrator.ts
git commit -m "$(cat <<'EOF'
fix(pre-release): frame dynamic turn directives as context, not imperatives

Hypothesis-test fix for a reported issue: Main Session LLM sometimes
replays emotional beats from the previous turn (e.g. re-establishes a
reveal moment that was already narrated) instead of continuing from the
previous assistant message's endpoint. Investigation ruled out context
compression (the reported occurrences were at turn 3-4, before the
replyCount threshold) and history drop (messages persist before the next
turn reads them).

Most plausible remaining cause: per-turn dynamic directives
(eroticMilestoneInjection, pacingInjection, module dynamicPrompt) keep
firing while their underlying state conditions persist (e.g. NPC stays
at an affection threshold for multiple turns). Each turn the model reads
the same imperative ("narrate revelation moment") and, conflicting with
the conversational history, produces the directive's beat again.

This commit frames combinedDynamicPrompt with a meta-instruction that
tells the model to treat the block as state context and continue from
the prior turn's endpoint. Minimum-viable test of the hypothesis; cheap
to revert if the symptom persists.

Expected success rate: 60-70%. If insufficient, plan for directive
state tracking (once-per-threshold suppression) is in
documents/plans/2026-04-24-memory-fix-c-directive-state-tracking.md.

No locale entry yet — the string is hardcoded in Traditional Chinese.
If this fix sticks, promote to src/locale/* in a follow-up.
EOF
)"
```

---

### Task 3: Manual verification protocol

**Files:** none (gameplay testing)

- [ ] **Step 1: Start the app**

```bash
cd H:/ClaudeCode/dogechat
export PATH="/c/Program Files/nodejs:$PATH"
npm run tauri:dev   # or npm run dev for browser-mode dev
```

- [ ] **Step 2: Run 3-5 gameplay sessions, each ≥6 turns**

Pick scenarios that previously exhibited the replay symptom. For each session:
- Note at each turn: did the LLM's response build on the previous assistant message's endpoint, or did it replay an earlier beat?
- Pay special attention to turns where an erotic milestone or pacing event directive is active (visible as the `[Dynamic→UserMsg]` log line having content related to these).

- [ ] **Step 3: Classify the outcome**

Record one of:
- **(a) Clear improvement** (80%+ of turns advance cleanly, few replays) → fix is working, proceed to Step 4.
- **(b) Partial improvement** (50-80%, some replays remain, especially in intense emotional beats) → A is a partial fix; open a ticket to pursue Plan C.
- **(c) No change** (replays still frequent) → revert A, prioritize Plan C.

- [ ] **Step 4: Report outcome**

Append observations to `documents/tickets.md` under a new ticket, e.g.:
```
## T-NNN: Memory referencing fix A outcome — [status]

Observed behavior across N sessions, ~M turns:
- [specific observations]
- [classification: (a) / (b) / (c)]
- [next step: close / partial follow-up / revert + Plan C]
```

---

### Task 4 (conditional): If classified (c), revert

**Only execute this task if Step 3 classified the outcome as (c) no change.**

- [ ] **Step 1: Revert commit**

```bash
cd H:/ClaudeCode/dogechat
git revert <commit-hash-from-Task-2>
# Use the default revert message or edit to note "Plan A ineffective, proceeding to Plan C"
```

- [ ] **Step 2: Run tests to confirm revert clean**

```bash
npx tsc --noEmit && npx vitest run
```

- [ ] **Step 3: Proceed to Plan C**

See `documents/plans/2026-04-24-memory-fix-c-directive-state-tracking.md`.

---

### Self-review

- Spec coverage: hypothesis from systematic-debugging investigation → Task 1 applies it. Verification → Task 3 gameplay protocol. Rollback → Task 4.
- Placeholders: none — the Chinese string is concrete, commit message is complete.
- Type consistency: variable names (`combinedDynamicPrompt`, `formattedUserMsg`, `llmUserMsg`, `statusDelta`, `dynamicWithGuard`) match existing code or are local to the edit.
- Risk: minimal — single line of added content per turn, fully reversible.
- Known limitation: behavioral verification is subjective (no deterministic test); relies on user observation.
