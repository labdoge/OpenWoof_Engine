# Codex / Claude Management Migration Plan

Date: 2026-04-27

## Goal

Let Codex manage every Claude-level project rule, command, agent, and workflow without moving or deleting existing `.claude` files.

## Principles

- `.claude/` remains in place as the legacy Claude runtime directory.
- `AGENTS.md` is the Codex entrypoint for project rules.
- Codex-facing wrappers may reference `.claude` files, but should avoid duplicating long instructions.
- Any duplicated instruction must have one declared source of truth.
- Traditional Chinese is the default session language, with English remarks for technical precision.

## Current State

- Root `CLAUDE.md` and root `AGENTS.md` are already aligned in broad project identity and engineering rules.
- `.claude/agents/ticket-triager.md` exists, while `AGENTS.md` references a Codex-style `.Codex/agents/ticket-triager.md` path.
- `.claude/commands/` contains project commands that Codex can follow only after manual reading.
- `.claude/settings*.json` contains Claude-specific permissions and hooks that cannot be used directly by Codex.

## Target State

Codex should have:

- A stable project instruction entrypoint in `AGENTS.md`.
- A `.codex/` management directory containing thin references, adapters, or notes that point back to `.claude/`.
- Codex-native agent descriptions for workflows currently living under `.claude/agents/`.
- Codex-readable command recipes for workflows currently living under `.claude/commands/`.
- A migration inventory that marks each Claude asset as `linked`, `mirrored`, `converted`, or `Claude-only`.

## Proposed Directory Layout

```text
.codex/
  README.md
  migration-map.md
  agents/
    ticket-triager.md
  commands/
    build-component.md
    phase1-plan.md
    phase2-plan.md
    phase3-plan.md
    test-parsers.md
  hooks/
    README.md
```

## Migration Phases

1. Inventory

   List every file under `.claude/`, classify it by type, and decide whether Codex needs to read it directly, wrap it, or ignore it.

2. Project Rule Alignment

   Keep project-wide rules in `AGENTS.md`. Treat `CLAUDE.md` as the Claude-facing sibling, not the Codex source.

3. Agent Conversion

   Convert `.claude/agents/*.md` into Codex-compatible workflow notes under `.codex/agents/`. Preserve the original `.claude` file path in each converted file.

4. Command Conversion

   Convert `.claude/commands/*.md` into Codex command recipes under `.codex/commands/`. Each recipe should name its source file and describe how Codex should execute the workflow with available tools.

5. Settings and Hooks Review

   Translate useful `.claude/settings*.json` permissions and hooks into Codex-facing documentation only. Do not blindly recreate Claude permission rules because Codex uses a different approval model.

6. Verification

   Start a fresh Codex session in this repo and confirm:

   - `AGENTS.md` is loaded.
   - The default reply language is Traditional Chinese with English remarks.
   - The ticket workflow points to a valid Codex-facing path.
   - Converted commands can be followed without reading hidden assumptions from `.claude`.

## Open Decisions

- Use lowercase `.codex/` for project-local Codex metadata unless the user explicitly prefers `.Codex/`.
- Decide whether converted agent files should be thin pointers or full mirrors. Thin pointers reduce drift; mirrors are more convenient offline.
- Decide whether `CLAUDE.md` and `AGENTS.md` should stay manually synchronized or gain a small check script.

## Recommended First Implementation Slice

Create `.codex/README.md`, `.codex/migration-map.md`, and `.codex/agents/ticket-triager.md` as thin wrappers around existing `.claude` files. Then update `AGENTS.md` references from `.Codex/agents/...` to `.codex/agents/...` after the wrapper exists.
