# Memory Referencing Fix C — Directive State Tracking

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the root cause of the Main Session LLM's "beat replay" symptom by suppressing per-turn dynamic directives (erotic milestone, pacing, module-dynamic) that have already been narratively addressed, so the model sees each directive exactly as many times as it should be acted on — not every turn the underlying state condition persists.

**Architecture:** Introduce a new pure module `src/orchestrator/directive-gate.ts` that keys each candidate directive, records fire history in `GameState.context.directiveFireLog`, and gates subsequent firings. Acknowledgement starts with a simple turn-decay heuristic (directive becomes "cold" N turns after firing) and leaves an extension point for UA-driven acknowledgement in Phase 5. Orchestrator integrates by wrapping gateable directive assemblies with the gate before injecting them into the turn context.

**Tech Stack:** TypeScript strict, Vitest. Affects `src/orchestrator/orchestrator.ts`, `src/state/types.ts`, `src/state/state-manager.ts`, new `src/orchestrator/directive-gate.ts`, new `tests/directive-gate.test.ts`. Optionally affects `src/modules/types.ts` (Phase 4) and `src/agents/hype-lust-evaluator.ts` + eval schema (Phase 5).

**Relationship to Plan A:** Plan A (anti-repetition framing) is a cheap prompt-level test that helps the model deal with symptom. Plan C removes the cause — redundant directive firings stop reaching the model at all. If Plan A is applied and working, Plan C is still valuable as token optimization; if Plan A is ineffective, Plan C is the required fix.

---

## Design decisions — pending user review before Phase 1 executes

Before any code is written, please review and ACK/NAK these decisions. I've picked defaults I can defend, but each has an alternative.

### D1. Which directives are gate-able?

| Directive | Gate? | Rationale |
|---|---|---|
| `eroticMilestoneInjection` | **Yes** (primary target) | Fires while UA marks activation `true` + milestone cached. Designed to fire repeatedly while state holds — the exact re-fire pattern we're fixing. |
| `pacingInjection` (scheduled events) | **Yes** | Once the event is "used" in narrative, re-firing it asks the model to re-introduce it. |
| `pacingInjection` (ambient flavor) | **No** | Ambient flavor is per-turn color; repetition is harmless and inexpensive. |
| `dynamicModulePrompt` | **Opt-in per module** (Phase 4) | Some modules have legitimate per-turn state descriptors; others have imperative directives. Let the module manifest declare which is which. |
| `diceInjections` | **No** | Inherently one-shot per turn; nothing to gate. |
| `sceneRollBlock` | **No** | Per-scene/per-turn; no re-fire concept. |
| `combatEfficacyBlock` | **No** | Per-turn combat stats snapshot. |
| `_combatResolutionBlock` | **No** | Per-combat-action; one-shot. |
| `knockoutHint` | **No** | Single-turn narrative hint, no re-fire. |

**Default: opt-in per directive type (whitelist approach). Alternative: opt-out (blacklist). Whitelist is safer — it's easier to add new gated types later than to accidentally gate a one-shot directive.**

### D2. Acknowledgement mechanism

| Mechanism | Pros | Cons | Verdict |
|---|---|---|---|
| (a) Turn-decay heuristic (fire, then cold for N turns) | Simple, deterministic, testable | May re-fire before narrative has caught up, or stay cold too long and miss escalation | **Start here, default N=3** |
| (b) UA-driven ack (UA reads previous assistant message, marks acknowledged) | Accurate per directive | Requires UA schema change, UA prompt tweak, possible latency | **Phase 5 upgrade** |
| (c) Keyword-match heuristic | No schema change | Fragile against paraphrasing, false positives/negatives | **Rejected** |

**Default: (a) for initial implementation; (b) left as Phase 5 upgrade path with a clean hook.**

### D3. Decay constant

- `DIRECTIVE_COLD_TURNS = 3` (how many turns a fired-but-unacknowledged directive stays suppressed)
- Rationale: most beats resolve within 2–3 turns. Configurable via `src/constants.ts`.
- Alternative: per-directive-type decay (erotic milestone might want 5, pacing might want 2). Start uniform; add per-type only if gameplay feedback requires.

### D4. State schema location

- `GameState.context.directiveFireLog: Record<string, DirectiveFireLogEntry>`
- Rationale: scoped per-session (like `lastCompressionTurn`, `replyCount`). Persists to IndexedDB/file backend automatically.
- Alternative: top-level `GameState.directiveFireLog`. Rejected — it's context/turn-related metadata, belongs under `context`.

### D5. Directive key format

- Format: `{category}:{scope}:{subkey}`
- Examples:
  - `erotic_milestone:npc_001:threshold_t2`
  - `pacing:event_042`
  - `module_exploration:mystery_reveal:npc_001_loc_002`
- Rationale: grouping by category lets us audit/clear by prefix; scope prevents cross-NPC collisions.
- When directive text changes but key stays the same → treated as same directive (gated). When escalation creates a new key → fires normally.

### D6. Feature flag / rollout

- **No feature flag.** Single Git revert is the rollback path.
- Rationale: the fix is behavioral and affects all sessions equally; a flag adds complexity without meaningful benefit at this scale. If the fix needs to be tunable, the decay constant or the whitelist is where knobs live.

### D7. Storage migration for existing sessions

- `directiveFireLog` defaults to `{}` when missing (existing sessions, fresh installs).
- No explicit migration step — state validators (`src/state/validators.ts`) will handle the defaulting.

### D8. Scope of v1 (Phase 1 + 2)

- Covers: `eroticMilestoneInjection` (primary), `pacingInjection` scheduled events only.
- Explicitly deferred: module-level opt-in (Phase 4), UA-driven ack (Phase 5).
- Rationale: match the reported symptom (erotic milestone re-fire) with minimum surface area.

**→ Please review D1-D8. If any default is wrong for the project, flag it before I start. If all are acceptable, proceed to Phase 1.**

---

## Phases

Phases 1 + 2 produce a working fix. Phases 3+ are optional extensions — each brings incremental value.

| Phase | Deliverable | Status |
|---|---|---|
| 1 | Schema + gate module + unit tests (no integration) | Required |
| 2 | Wire erotic milestone + scheduled pacing through gate | Required |
| 3 | Manual gameplay verification + commit | Required |
| 4 | Module-level opt-in API for gated dynamic prompts | Optional |
| 5 | UA-driven acknowledgement (replaces turn-decay for gated directives) | Optional |

---

### Phase 1 — Infrastructure

#### Task 1.1: Add directive fire log to state schema

**Files:**
- Modify: `src/state/types.ts` — add `DirectiveFireLogEntry` type, extend `GameContextState` (or equivalent — verify actual type name on read)
- Modify: `src/state/validators.ts` — default `directiveFireLog` to `{}` when missing

- [ ] **Step 1: Read the current GameState/GameContextState type**

```bash
grep -n "replyCount\|lastCompressionTurn" src/state/types.ts
```

Locate the `context` sub-type. Note its exact name (likely `GameContextState` or `ContextState`).

- [ ] **Step 2: Add the type and field**

In `src/state/types.ts`, add near the context-state type:

```ts
/**
 * One entry in the directive fire log. Records when a directive was last
 * emitted to the LLM and (optionally) when it was acknowledged as narratively
 * addressed.
 */
export interface DirectiveFireLogEntry {
  /** Stable key identifying the directive (e.g. "erotic_milestone:npc_001:threshold_t2"). */
  key: string;
  /** Turn number at which the directive was last emitted. */
  firedAtTurn: number;
  /**
   * Turn at which the directive was marked acknowledged (e.g. by turn-decay or UA).
   * Present only after acknowledgement; absent means the directive has fired but
   * not yet been acknowledged.
   */
  ackTurn?: number;
  /** How the directive was acknowledged. Used for observability and future upgrade paths. */
  ackMethod?: 'turn-decay' | 'ua' | 'manual';
}
```

In the context-state type, add:
```ts
  /**
   * Map of directive key → fire log entry. Used by the directive gate
   * (src/orchestrator/directive-gate.ts) to suppress re-firing of directives
   * that have already been addressed. Scoped per-session.
   */
  directiveFireLog: Record<string, DirectiveFireLogEntry>;
```

- [ ] **Step 3: Default the field in validators**

In `src/state/validators.ts`, locate the function that normalizes/defaults `context`. Add:

```ts
  // Default directive fire log for existing sessions and fresh installs
  if (!context.directiveFireLog || typeof context.directiveFireLog !== 'object') {
    context.directiveFireLog = {};
  }
```

Exact placement depends on the validator's current structure — follow the pattern used for other defaulted context fields (e.g. `replyCount`).

- [ ] **Step 4: Type-check**

```bash
cd H:/ClaudeCode/dogechat
export PATH="/c/Program Files/nodejs:$PATH"
npx tsc --noEmit
```

Expected: 0 errors. If there are compile errors in files that access `context.directiveFireLog`, they're Phase 2 integration points — add minimal stubs (`context.directiveFireLog ?? {}`) and continue.

- [ ] **Step 5: Commit (schema-only)**

```bash
git add src/state/types.ts src/state/validators.ts
git commit -m "feat(pre-release): add directiveFireLog to GameContextState (Plan C Phase 1.1)

Schema addition for the directive gate (src/orchestrator/directive-gate.ts,
added in subsequent task). Empty map by default; no migration needed.
Part of Plan C — see documents/plans/2026-04-24-memory-fix-c-directive-state-tracking.md"
```

---

#### Task 1.2: Build the gate module (pure functions)

**Files:**
- Create: `src/orchestrator/directive-gate.ts`
- Create: `tests/directive-gate.test.ts`
- Modify: `src/constants.ts` — add `DIRECTIVE_COLD_TURNS`

- [ ] **Step 1: Add the constant**

In `src/constants.ts`, add near other orchestrator constants:

```ts
/**
 * How many turns a fired-but-unacknowledged directive stays suppressed before
 * it is eligible to re-fire. Used by the directive gate (src/orchestrator/
 * directive-gate.ts) to prevent the Main Session LLM from replaying beats
 * already narrated in the prior turn.
 */
export const DIRECTIVE_COLD_TURNS = 3;
```

- [ ] **Step 2: Write the failing test**

Create `tests/directive-gate.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { gateDirectives, recordFiredDirectives, decayFireLog } from '../src/orchestrator/directive-gate';
import type { DirectiveFireLogEntry } from '../src/state/types';

type Candidate = { key: string; content: string };

describe('directive-gate — gateDirectives', () => {
  it('emits all candidates when log is empty', () => {
    const candidates: Candidate[] = [
      { key: 'erotic_milestone:npc_001:t2', content: 'A' },
      { key: 'pacing:event_042', content: 'B' },
    ];
    const { emit, gated } = gateDirectives(candidates, {}, 5, 3);
    expect(emit).toHaveLength(2);
    expect(gated).toHaveLength(0);
  });

  it('suppresses a candidate whose key fired within cold window', () => {
    const fireLog: Record<string, DirectiveFireLogEntry> = {
      'erotic_milestone:npc_001:t2': { key: 'erotic_milestone:npc_001:t2', firedAtTurn: 4 },
    };
    const candidates: Candidate[] = [
      { key: 'erotic_milestone:npc_001:t2', content: 'A' },
    ];
    // current turn 5, cold 3 → fired 1 turn ago, still cold
    const { emit, gated } = gateDirectives(candidates, fireLog, 5, 3);
    expect(emit).toHaveLength(0);
    expect(gated).toEqual(['erotic_milestone:npc_001:t2']);
  });

  it('re-emits after cold window expires (turn-decay)', () => {
    const fireLog: Record<string, DirectiveFireLogEntry> = {
      'erotic_milestone:npc_001:t2': { key: 'erotic_milestone:npc_001:t2', firedAtTurn: 1 },
    };
    const candidates: Candidate[] = [
      { key: 'erotic_milestone:npc_001:t2', content: 'A' },
    ];
    // current turn 5, cold 3 → fired 4 turns ago, past cold window
    const { emit, gated } = gateDirectives(candidates, fireLog, 5, 3);
    expect(emit).toHaveLength(1);
    expect(gated).toHaveLength(0);
  });

  it('treats acknowledged entries as out-of-cold immediately', () => {
    const fireLog: Record<string, DirectiveFireLogEntry> = {
      'erotic_milestone:npc_001:t2': {
        key: 'erotic_milestone:npc_001:t2',
        firedAtTurn: 4,
        ackTurn: 4,
        ackMethod: 'turn-decay',
      },
    };
    const candidates: Candidate[] = [
      { key: 'erotic_milestone:npc_001:t2', content: 'A' },
    ];
    // Fired and acknowledged already → next candidate re-emits
    const { emit, gated } = gateDirectives(candidates, fireLog, 5, 3);
    expect(emit).toHaveLength(1);
  });

  it('different keys are independent', () => {
    const fireLog: Record<string, DirectiveFireLogEntry> = {
      'erotic_milestone:npc_001:t2': { key: 'erotic_milestone:npc_001:t2', firedAtTurn: 4 },
    };
    const candidates: Candidate[] = [
      { key: 'erotic_milestone:npc_001:t2', content: 'A' },   // gated
      { key: 'erotic_milestone:npc_002:t1', content: 'B' },   // new key, emits
    ];
    const { emit, gated } = gateDirectives(candidates, fireLog, 5, 3);
    expect(emit).toHaveLength(1);
    expect(emit[0].key).toBe('erotic_milestone:npc_002:t1');
    expect(gated).toEqual(['erotic_milestone:npc_001:t2']);
  });
});

describe('directive-gate — recordFiredDirectives', () => {
  it('adds a new entry for each emitted directive', () => {
    const emitted: Candidate[] = [
      { key: 'erotic_milestone:npc_001:t2', content: 'A' },
    ];
    const next = recordFiredDirectives(emitted, {}, 5);
    expect(next['erotic_milestone:npc_001:t2']).toEqual({
      key: 'erotic_milestone:npc_001:t2',
      firedAtTurn: 5,
    });
  });

  it('overwrites firedAtTurn for re-fired keys (clears any stale ack)', () => {
    const existing: Record<string, DirectiveFireLogEntry> = {
      'erotic_milestone:npc_001:t2': {
        key: 'erotic_milestone:npc_001:t2',
        firedAtTurn: 1,
        ackTurn: 1,
        ackMethod: 'turn-decay',
      },
    };
    const next = recordFiredDirectives(
      [{ key: 'erotic_milestone:npc_001:t2', content: 'A' }],
      existing,
      5,
    );
    expect(next['erotic_milestone:npc_001:t2'].firedAtTurn).toBe(5);
    expect(next['erotic_milestone:npc_001:t2'].ackTurn).toBeUndefined();
    expect(next['erotic_milestone:npc_001:t2'].ackMethod).toBeUndefined();
  });
});

describe('directive-gate — decayFireLog', () => {
  it('marks entries acknowledged once past the cold window', () => {
    const log: Record<string, DirectiveFireLogEntry> = {
      'a': { key: 'a', firedAtTurn: 1 },
      'b': { key: 'b', firedAtTurn: 4 },
    };
    // current turn 5, cold 3 → 'a' past (1+3 < 5), 'b' within (4+3 >= 5)
    const next = decayFireLog(log, 5, 3);
    expect(next['a'].ackTurn).toBe(5);
    expect(next['a'].ackMethod).toBe('turn-decay');
    expect(next['b'].ackTurn).toBeUndefined();
  });

  it('is idempotent — decaying an already-ack entry does nothing', () => {
    const log: Record<string, DirectiveFireLogEntry> = {
      'a': { key: 'a', firedAtTurn: 1, ackTurn: 4, ackMethod: 'turn-decay' },
    };
    const next = decayFireLog(log, 5, 3);
    expect(next['a']).toEqual(log['a']);
  });
});
```

- [ ] **Step 3: Run test to confirm it fails**

```bash
npx vitest run tests/directive-gate.test.ts
```

Expected: FAIL with module not found (implementation doesn't exist yet).

- [ ] **Step 4: Implement the gate module**

Create `src/orchestrator/directive-gate.ts`:

```ts
// ============================================================
// DogeChat Engine — Directive Gate
// Decides which per-turn dynamic directives should be emitted to the
// Main Session LLM. Suppresses directives that have already fired
// recently, to prevent the model from re-narrating beats that the
// prior turn's assistant message already addressed.
//
// Plan C — documents/plans/2026-04-24-memory-fix-c-directive-state-tracking.md
// ============================================================

import type { DirectiveFireLogEntry } from '../state/types';

/**
 * A candidate directive that may or may not be emitted to the LLM this turn.
 * Keys are stable identifiers — same key across turns means the same directive.
 * Re-escalation (new milestone, new event) should produce a different key.
 */
export interface DirectiveCandidate<Content = string> {
  key: string;
  content: Content;
}

export interface GateResult<Content = string> {
  /** Directives that should be emitted this turn. */
  emit: DirectiveCandidate<Content>[];
  /** Keys of directives that were suppressed (for logging). */
  gated: string[];
}

/**
 * Decide which candidates to emit vs. gate based on the current fire log.
 *
 * A candidate is gated iff:
 *   - Its key is in the fire log
 *   - AND the entry has no ackTurn (unacknowledged)
 *   - AND firedAtTurn + coldTurns > currentTurn (still within cold window)
 *
 * Otherwise it emits.
 */
export function gateDirectives<Content = string>(
  candidates: DirectiveCandidate<Content>[],
  fireLog: Record<string, DirectiveFireLogEntry>,
  currentTurn: number,
  coldTurns: number,
): GateResult<Content> {
  const emit: DirectiveCandidate<Content>[] = [];
  const gated: string[] = [];
  for (const candidate of candidates) {
    const entry = fireLog[candidate.key];
    if (!entry) {
      emit.push(candidate);
      continue;
    }
    if (entry.ackTurn !== undefined) {
      // Acknowledged — eligible to re-emit
      emit.push(candidate);
      continue;
    }
    if (entry.firedAtTurn + coldTurns <= currentTurn) {
      // Past the cold window even without explicit ack
      emit.push(candidate);
      continue;
    }
    gated.push(candidate.key);
  }
  return { emit, gated };
}

/**
 * Record that directives were emitted this turn. Returns an updated fire log
 * (does not mutate the input).
 *
 * For re-fired keys, clears any stale ackTurn/ackMethod — the entry becomes
 * "just fired, not yet acknowledged" again.
 */
export function recordFiredDirectives<Content = string>(
  emitted: DirectiveCandidate<Content>[],
  fireLog: Record<string, DirectiveFireLogEntry>,
  currentTurn: number,
): Record<string, DirectiveFireLogEntry> {
  const next = { ...fireLog };
  for (const candidate of emitted) {
    next[candidate.key] = {
      key: candidate.key,
      firedAtTurn: currentTurn,
      // Explicitly do not carry over ackTurn/ackMethod from a prior cycle
    };
  }
  return next;
}

/**
 * Apply turn-decay acknowledgement: for any entry fired more than coldTurns
 * ago that isn't already acknowledged, mark it as acknowledged via turn-decay.
 * Returns an updated fire log (does not mutate the input). Idempotent.
 */
export function decayFireLog(
  fireLog: Record<string, DirectiveFireLogEntry>,
  currentTurn: number,
  coldTurns: number,
): Record<string, DirectiveFireLogEntry> {
  const next: Record<string, DirectiveFireLogEntry> = {};
  for (const [key, entry] of Object.entries(fireLog)) {
    if (entry.ackTurn !== undefined) {
      next[key] = entry;
      continue;
    }
    if (entry.firedAtTurn + coldTurns <= currentTurn) {
      next[key] = { ...entry, ackTurn: currentTurn, ackMethod: 'turn-decay' };
    } else {
      next[key] = entry;
    }
  }
  return next;
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run tests/directive-gate.test.ts
```

Expected: all 9 tests pass.

- [ ] **Step 6: Run full suite to ensure no regressions**

```bash
npx tsc --noEmit && npx vitest run
```

Expected: 0 tsc errors; all tests pass (modulo the 3 pre-existing compression failures).

- [ ] **Step 7: Commit**

```bash
git add src/orchestrator/directive-gate.ts tests/directive-gate.test.ts src/constants.ts
git commit -m "feat(pre-release): add directive gate module (Plan C Phase 1.2)

Pure functions gateDirectives / recordFiredDirectives / decayFireLog
implementing turn-decay based suppression of per-turn dynamic directives.
Not yet integrated — Phase 2 wires erotic milestone and scheduled pacing
through it. Unit tests cover: empty log, cold-window suppression, decay
re-emission, ack-gated emission, key independence, re-fire clearing
stale ack.

DIRECTIVE_COLD_TURNS = 3 added to src/constants.ts.

Part of Plan C — see documents/plans/2026-04-24-memory-fix-c-directive-state-tracking.md"
```

---

#### Task 1.3: Add state-manager accessors

**Files:**
- Modify: `src/state/state-manager.ts` — add `getDirectiveFireLog`, `applyDirectiveFireLog` methods

- [ ] **Step 1: Locate similar accessor patterns**

Look at how `replyCount` or `lastCompressionTurn` are exposed by the state manager — read 10-20 lines surrounding them to copy the pattern.

- [ ] **Step 2: Add accessors**

In `src/state/state-manager.ts`, add methods near the other context accessors:

```ts
  getDirectiveFireLog(): Record<string, DirectiveFireLogEntry> {
    return this.requireState().context.directiveFireLog ?? {};
  }

  /**
   * Apply an updated directive fire log (from directive-gate). Called after
   * emitting directives to record the fire event, and at turn-end decay to
   * apply turn-based acknowledgements.
   */
  applyDirectiveFireLog(next: Record<string, DirectiveFireLogEntry>): void {
    this.requireState().context.directiveFireLog = next;
  }
```

Import `DirectiveFireLogEntry` from `./types` at top of file.

- [ ] **Step 3: Type-check and test**

```bash
npx tsc --noEmit && npx vitest run
```

- [ ] **Step 4: Commit**

```bash
git add src/state/state-manager.ts
git commit -m "feat(pre-release): expose directiveFireLog via StateManager (Plan C Phase 1.3)

getDirectiveFireLog / applyDirectiveFireLog accessors for the orchestrator
to read and update the log around each turn. Part of Plan C."
```

---

### Phase 2 — Integrate erotic milestone and scheduled pacing

#### Task 2.1: Wrap erotic milestone injection through the gate

**Files:**
- Modify: `src/orchestrator/orchestrator.ts` — the `eroticMilestoneInjection` build (around line 2226-2238 per today's baseline)

- [ ] **Step 1: Read the current erotic milestone assembly**

Read 15 lines around the current assembly to refresh on variable names.

- [ ] **Step 2: Replace the assembly with a gated version**

Transform the current block:

```ts
      let eroticMilestoneInjection = '';
      if (result.uaEval?.eroticActivation && this._eroticMilestoneCache.length > 0) {
        const activeIds = new Set(
          result.uaEval.eroticActivation.filter(a => a.active).map(a => a.npcId),
        );
        const activeMilestones = this._eroticMilestoneCache.filter(m => activeIds.has(m.npcId));
        if (activeMilestones.length > 0) {
          eroticMilestoneInjection = activeMilestones
            .map(m => `[${L.PROMPT_LABEL_EROTIC_MILESTONE} — ${m.npcName}(${m.thresholdLabel}): ${m.directive}]`)
            .join('\n');
        }
      }
```

Into:

```ts
      // ---- Step 8c-ii: Erotic milestone injection (gated) ----
      // Directives are gated by src/orchestrator/directive-gate.ts to prevent
      // re-narration of beats the prior turn's assistant message already addressed.
      let eroticMilestoneInjection = '';
      let emittedEroticKeys: string[] = [];
      if (result.uaEval?.eroticActivation && this._eroticMilestoneCache.length > 0) {
        const activeIds = new Set(
          result.uaEval.eroticActivation.filter(a => a.active).map(a => a.npcId),
        );
        const activeMilestones = this._eroticMilestoneCache.filter(m => activeIds.has(m.npcId));

        // Build candidates — stable key per (npc, threshold) pair.
        const candidates = activeMilestones.map(m => ({
          key: `erotic_milestone:${m.npcId}:${m.thresholdLabel}`,
          content: `[${L.PROMPT_LABEL_EROTIC_MILESTONE} — ${m.npcName}(${m.thresholdLabel}): ${m.directive}]`,
        }));

        const fireLog = this.stateManager.getDirectiveFireLog();
        const { emit, gated } = gateDirectives(candidates, fireLog, turn, DIRECTIVE_COLD_TURNS);
        if (gated.length > 0) {
          AppLog.info('Orchestrator', `[DirectiveGate] suppressed erotic milestone keys: ${gated.join(', ')}`);
        }
        if (emit.length > 0) {
          eroticMilestoneInjection = emit.map(c => c.content).join('\n');
          emittedEroticKeys = emit.map(c => c.key);
        }
      }
```

Add imports at top of file:
```ts
import { gateDirectives, recordFiredDirectives } from './directive-gate';
import { DIRECTIVE_COLD_TURNS } from '../constants';
```

- [ ] **Step 3: Record the fire event after the LLM responds**

Find the post-LLM-response block (the new Step 13 area around line 2535 where messages are stored, or immediately after). Add:

```ts
      // ---- Step 13b-ii: Record gated directive fires ----
      // After emission, log that these directives fired so that subsequent
      // turns can suppress them until acknowledged (turn-decay or UA).
      if (emittedEroticKeys.length > 0) {
        const candidates = emittedEroticKeys.map(key => ({ key, content: '' }));
        const fireLog = this.stateManager.getDirectiveFireLog();
        this.stateManager.applyDirectiveFireLog(
          recordFiredDirectives(candidates, fireLog, turn),
        );
      }
```

- [ ] **Step 4: Decay at turn end**

Just before `processTurn` returns (or at the start of next turn — pick one and document), apply turn-decay:

```ts
      // ---- Step 18b: Decay directive fire log ----
      // Mark any fire-log entries past the cold window as acknowledged via
      // turn-decay, so subsequent turns can re-emit them.
      {
        const fireLog = this.stateManager.getDirectiveFireLog();
        this.stateManager.applyDirectiveFireLog(
          decayFireLog(fireLog, turn, DIRECTIVE_COLD_TURNS),
        );
      }
```

Also import `decayFireLog`.

- [ ] **Step 5: Type-check and test**

```bash
npx tsc --noEmit && npx vitest run
```

Expected: 0 tsc errors; 25+ new directive-gate tests pass; pre-existing tests still pass (modulo the 3 compression failures).

- [ ] **Step 6: Commit**

```bash
git add src/orchestrator/orchestrator.ts
git commit -m "feat(pre-release): gate erotic milestone directives (Plan C Phase 2.1)

Wire eroticMilestoneInjection through src/orchestrator/directive-gate so
milestones already narrated in a prior turn stop re-firing until turn-
decay acknowledgement (DIRECTIVE_COLD_TURNS=3). Records fire events
after emission and applies decay at turn end.

Directives not yet gated: pacing scheduled events (Phase 2.2), module
dynamic prompts (Phase 4). Part of Plan C."
```

---

#### Task 2.2: Wrap scheduled pacing injection through the gate

**Files:**
- Modify: `src/orchestrator/orchestrator.ts` — the `pacingInjection` build (locate the block that handles `this._pendingPacingEvent`)

- [ ] **Step 1: Read current pacing-injection assembly**

Read the block around `_pendingPacingEvent`. There are two paths: ambient flavor (pass through unchanged) and scheduled event (wrap in gate).

- [ ] **Step 2: Split the assembly**

Wrap only the scheduled-event path with the gate pattern (same shape as Task 2.1). The ambient-flavor path should pass through unchanged.

- [ ] **Step 3: Key format**

Use `pacing:event_${eventId}` as the directive key. If the pacing system doesn't expose a stable event id, derive one from (event name + trigger turn). Document in a code comment.

- [ ] **Step 4: Type-check, test, commit**

Same as Task 2.1. Commit with:

```
feat(pre-release): gate scheduled pacing directives (Plan C Phase 2.2)

Extends Plan C directive gating to scheduled pacing events; ambient
flavor pacing passes through unchanged. Part of Plan C.
```

---

### Phase 3 — Verify & integrate

#### Task 3.1: Manual gameplay verification

**Files:** none (gameplay testing)

- [ ] **Step 1: Re-run the same sessions as Plan A manual verification**

Same protocol as Plan A Task 3. Log observations.

- [ ] **Step 2: Classify outcome**

Expected: behavior improvement should now be 80%+ clean continuation (higher than Plan A). If not, the turn-decay heuristic is either too aggressive (suppressing legitimate re-fires) or too loose (not suppressing enough).

- [ ] **Step 3: Tune DIRECTIVE_COLD_TURNS if needed**

If over-suppressing (legitimate re-fires missed): reduce to 2.
If under-suppressing (replays still frequent): increase to 5 and re-test.
Document the tuning decision in `src/constants.ts` comment.

- [ ] **Step 4: Record outcome in tickets.md**

Follow the same pattern as Plan A Task 3.

---

### Phase 4 (optional) — Module-level opt-in

#### Task 4.1: Extend module manifest with a directive-gating declaration

**Files:**
- Modify: `src/modules/types.ts` — add `directiveGating?: { key: string }` to relevant module hook return types
- Modify: `src/modules/hook-dispatcher.ts` — honor the declaration when collecting `dynamicModulePrompt`

Defer design detail until after Phase 3 shows how gameplay responds to Phases 1-2. If Phases 1-2 solve the problem, Phase 4 may not be needed.

---

### Phase 5 (optional) — UA-driven acknowledgement

#### Task 5.1: Extend UA output schema with `acknowledgedDirectives`

**Files:**
- Modify: `src/agents/hype-lust-evaluator.ts` — add field to output schema
- Modify: UA system prompt — instruct it to scan previous assistant message and list directive keys already addressed
- Modify: orchestrator — apply UA acks to fire log before turn-decay

Defer design until after Phase 3. This is a sizable prompt-engineering project on its own.

---

## Self-review

- Design decisions (D1-D8) surfaced at top, pending user ACK before Phase 1.
- Spec coverage: root cause from systematic-debugging (directive re-fire) → Phases 1-2 build the fix. Rollback = git revert each commit.
- Placeholders: none — all code snippets are concrete; only Phase 4/5 are deferred by design.
- Type consistency: `DirectiveFireLogEntry`, `DirectiveCandidate`, `gateDirectives` / `recordFiredDirectives` / `decayFireLog`, `DIRECTIVE_COLD_TURNS`, `directiveFireLog` used consistently across tasks.
- Scope: Phases 1-2 are the minimum viable fix (~500 new lines counting tests, comments, assembly wiring). Phases 4-5 are explicit extension hooks.
- Risk: schema change is forward-compatible (default to `{}`); gate module is pure and unit-tested; orchestrator integration is additive.
- Known limitation: turn-decay is a heuristic — may occasionally suppress a directive that should re-fire (if narrative stalled) or re-emit one that was already acknowledged (if narrative was fast). Phase 5 addresses this precisely via UA feedback.
