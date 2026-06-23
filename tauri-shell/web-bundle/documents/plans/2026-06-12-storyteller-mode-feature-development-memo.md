# Storyteller Mode Feature Development Memo - 2026-06-12

## Goal

Define the implementation-ready scope for `說書人模式` (Storyteller Mode), including scenario conversion, Scenario Workshop mode switching, `StoredPersona` casting as essential NPC/protagonist slots, flavor-only module participation, full provider/module compatibility, and workload allocation across the current DogeChat runtime agents.

This memo is planning material for a future development session. Do not treat it as an implementation commit plan by itself; first re-read current code and ticket state.

Related ticket: `T-140` in `documents/tickets.md`.

## Confirmed Product Decisions

1. Storyteller Mode is accepted as a real mode, not a placeholder.
2. Normal scenarios should be convertible into Storyteller scenarios.
3. Scenario Workshop should show an obvious authoring mode switch, preferably top-level tabs or a segmented control.
4. The "existing player profile" source means `StoredPersona` from the persona system, not only Workshop NPC profiles.
5. Workshop should gain a conversion tool for `StoredPersona -> ProfileRecord` and, where safe, `ProfileRecord -> StoredPersona`.
6. Modules may be enabled for flavor/style only, without activating mechanics such as combat sequencing, dice, resources, UA module fields, or event pipelines.
7. Support should cover all current providers and modules.
8. Use current agents and pipelines. Do not add a new runtime agent unless a critical blocker appears.

## Existing Relevant Design

`documents/post_release_plans.md` already defines the core Storyteller Mode idea:

- Standard mode: player is protagonist; LLM is narrator plus NPCs.
- Storyteller mode: selected NPCs are protagonists; user is storyteller/director; LLM narrates world response.
- Storyteller narration should be third person.
- Proposed viewpoint choices: `npc-lens` and `god-lens`.
- Proposed state additions: `storytellerViewpoint` and `protagonistNpcIds`.
- Required prompt changes include role inversion, UA framing, Event Agent framing, and a protagonist panel.

Current implementation has only a disabled portal entry and placeholder:

- `src/ui/portal-page.ts` has `narrator` portal card disabled.
- `src/ui/workshop-portal.ts` exposes `showNarratorPlaceholder()`.
- `portal_icons/narrator_mode_portal.png` already exists.

## Proposed Feature Shape

### Scenario Schema

Add a scenario-level mode field:

```ts
type ScenarioPlayMode = 'standard' | 'storyteller';
```

Recommended scenario JSON fields:

```json
{
  "playMode": "storyteller",
  "storyteller": {
    "defaultViewpoint": "npc-lens",
    "protagonistSlotIds": ["slot-0"],
    "allowGodLens": true,
    "directorCanControlProtagonistDialogue": true
  }
}
```

Keep existing `initial_npcs`, `npc_generation_pool`, `missions`, `recommendedModules`, `recommendedArcana`, and `scenario_variables`. Avoid duplicating slot definitions in a separate protagonist schema; use `initial_npcs[].slotId` as the source of truth.

Migration rule:

- Missing `playMode` means `standard`.
- Existing scenarios remain valid.
- Conversion should duplicate a scenario before changing mode, unless the user explicitly chooses overwrite.

### Runtime State

Extend existing narrative style/runtime state:

```ts
type NarrativePerspective = 'second' | 'first' | 'third-storyteller';
type StorytellerViewpoint = 'npc-lens' | 'god-lens';

interface MetaState {
  storytellerViewpoint?: StorytellerViewpoint;
  protagonistNpcIds?: string[];
}
```

In Storyteller Mode:

- Perspective is locked to third person.
- User directs protagonist NPCs.
- Non-protagonist NPCs remain world characters controlled by the LLM.
- The player HUD should become hidden or replaced with protagonist-focused display.
- Do not repurpose `PlayerState` for protagonist identity if avoidable; keep `PlayerState` as mechanical shell to reduce blast radius.

### StoredPersona Conversion Tool

Add a Workshop conversion tool that can operate outside session start.

Source types:

- `StoredPersona`: `src/state/types.ts`
- `ProfileRecord`: `src/storage/profiles.ts`
- Workshop profile sentinel: `WORKSHOP_SCENARIO_ID = '__workshop__'`

#### Persona to NPC Profile

Create a `ProfileRecord` in Workshop storage:

- `npcId`: stable generated ID derived from persona name/id.
- `scenarioId`: `__workshop__`.
- `name`: persona name.
- `role`: generated or user-provided role, defaulting to a neutral label such as `主角候選`.
- `personality`: split/normalize from persona personality.
- `appearance`: persona appearance.
- `portraitId`: if persona portrait is data URL, either import to portrait storage or leave unset with clear UI notice.
- `npcTraits`: convert compatible persona traits into NPC narration hooks where possible.
- `gameplayTraits`: copy only if safe and user confirms.
- `coreBackstory`: from persona context if available; otherwise ask user or leave blank.
- `lifeStage`: from persona `ageGroup`, age-masked.

Use existing adoption and trait filling flows after conversion when inserting into a scenario slot.

#### NPC Profile to Persona

Create or update a `StoredPersona`:

- `name`: profile name.
- `gender`: ask user if not inferable.
- `ageGroup`: profile `lifeStage` when available.
- `personality`: compact from profile personality and behavior tendency.
- `appearance`: profile appearance.
- `traits`: copy compatible `gameplayTraits` only after user confirmation.
- `portrait`: only if portrait data can be resolved to data URL.

This direction is lossy. UI should label it as a conversion draft, not a perfect round-trip.

### Scenario Workshop Mode Switch

Add a top-level mode switch inside `ScenarioWorkshopForm`:

- `標準劇本`
- `說書人劇本`

Expected behavior:

- Mode switch changes visible authoring sections and hints.
- Storyteller mode highlights `initial_npcs` as protagonist slots.
- Add protagonist slot markers/checklist inside the Initial NPC Slots section.
- Add tool button near Workshop sidebar or header: `Persona / NPC 轉換`.
- AI assistant receives mode in current form state and uses the correct prompt framing.
- Conversion tool can duplicate current scenario into storyteller mode.

Do not hide core fields too aggressively; this project favors editable JSON-like authoring, and hidden defaults make debugging harder.

### Flavor-Only Modules

This is the highest-risk engineering part. Existing `enabledModules` means mechanics-enabled. It affects:

- UA eval field collection.
- Runtime activation.
- Module prompt loading.
- Resources.
- Event schemas and Event Agent.
- Dice and scene resolution.
- Status UI and module memory.
- Mission option seeds.

Recommended model:

```ts
type ModuleParticipationMode = 'mechanics' | 'flavor';

interface ModulesState {
  enabledModules: string[];
  moduleModes?: Record<string, ModuleParticipationMode>;
  moduleStates: Record<string, Record<string, unknown>>;
}
```

Compatibility rule:

- If `moduleModes[id]` is missing and module is in `enabledModules`, treat it as `mechanics`.
- This preserves existing sessions.

Flavor mode should:

- Inject `manifest.style` and a compact flavor directive.
- Optionally use `manifest.enrichmentFocus`.
- Not collect module UA fields.
- Not run activation gates.
- Not initialize resources.
- Not expose event schemas.
- Not run dice/scene resolution hooks.
- Not add module status items.
- Not write module memory or milestones.
- Not emit module mission option seeds unless explicitly designed as flavor-safe.

Mechanics mode remains current behavior.

Implementation preference:

- Keep `enabledModules` as installed/selected module list for backward compatibility.
- Add helpers such as `isModuleMechanicsEnabled(state, moduleId)` and `isModuleFlavorEnabled(state, moduleId)`.
- Route all mechanics-sensitive call sites through these helpers.

## Current Agent Allocation

No new runtime agent is required for the first complete implementation.

| Agent / pipeline | Use in Storyteller Mode |
|---|---|
| `ScenarioWorkshopAgent` | Generate storyteller scenarios, convert standard scenarios, edit protagonist slots, respect `playMode`. |
| `ScenarioAdopter` | Adapt persona-derived NPC profiles to scenario slots. |
| `CharacterGenerator` | Fill missing NPC profile details and gameplay traits after persona conversion. |
| `Utility Agent` / `hype-lust-evaluator` | Evaluate protagonist-directed action as the active action source; keep Hype/Lust/mission/status JSON structured. |
| `EventAgent` | Only used for mechanics-mode modules; interpret user input as protagonist directive. |
| `Scene Ops Agent` | Continue post-scene digest for missions and context; no new role needed. |
| `Scene Mapper` | Continue location extraction; protagonist framing may be added to prompt context. |
| `ProfileUpdater` / `ProfileEnricher` | Continue profile mutation/enrichment, but preserve persona-origin immutable fields. |
| `Module Injector` | Central prompt role inversion, protagonist identity injection, and flavor-only module injection. |

## Recommended Implementation Phases

### Phase 0 - Design Lock and Tests Skeleton

Goal: reduce ambiguity before touching runtime.

Work:

- Update docs/spec references for `playMode`, `storyteller`, `moduleModes`.
- Add failing tests or TODO tests for schema migration, workshop parser, and module mode helpers.
- Confirm exact UX labels in `src/locale/zh-TW.ts`.

Verification:

- `npx vitest run tests/workshop-validators.test.ts tests/scenario-workshop-agent.test.ts`

### Phase 1 - Schema, Validation, and Scenario Workshop Mode

Work:

- Add scenario `playMode` and `storyteller` validation.
- Add migration defaults.
- Add Scenario Workshop mode switch.
- Add protagonist slot checklist/markers.
- Add duplicate-and-convert flow for standard scenarios.
- Update `documents/workshop_scenario_form.md` and `documents/scenario_overview_template.json`.

Likely files:

- `src/workshop/validators.ts`
- `src/storage/scenario-migrator.ts`
- `src/ui/scenario-workshop-form.ts`
- `src/agents/scenario-workshop-agent.ts`
- `src/locale/zh-TW.ts`
- `documents/workshop_scenario_form.md`
- `documents/scenario_overview_template.json`

Verification:

- Scenario Workshop form tests.
- Scenario validator tests.
- Scenario Workshop Agent parser tests.

### Phase 2 - Persona / NPC Conversion Tool

Work:

- Add conversion service functions.
- Add Workshop UI for `StoredPersona -> ProfileRecord` and `ProfileRecord -> StoredPersona`.
- Preserve age masking and immutable identity fields.
- Handle portrait conversion gracefully.
- Save persona-derived NPC profiles under `__workshop__`.
- Allow selecting converted profiles for Storyteller protagonist slots.

Likely files:

- `src/state/persona.ts`
- `src/storage/profiles.ts`
- `src/ui/persona-list-modal.ts`
- `src/ui/persona-picker-modal.ts`
- `src/ui/workshop-profile-picker.ts`
- new utility module under `src/workshop/` or `src/utils/`
- `src/locale/zh-TW.ts`

Verification:

- New conversion tests.
- Character setup/adoption tests.
- Portrait fallback tests if portrait mapping is implemented.

### Phase 3 - Storyteller Runtime

Work:

- Add `third-storyteller` and `StorytellerViewpoint`.
- Extend narrative style modal for Storyteller Mode.
- Add protagonist selector when scenario has multiple slots/profiles.
- Update input router to parse `[NPC名] SPEAK:[...]` and `[NPC名] DO:[...]`.
- Update module injector for role inversion and viewpoint rules.
- Update UA eval prompt framing.
- Update Event Agent prompt framing.
- Update HUD/status display for protagonist mode.

Likely files:

- `src/constants.ts`
- `src/state/types.ts`
- `src/ui/perspective-modal.ts`
- `src/orchestrator/input-router.ts`
- `src/orchestrator/module-injector.ts`
- `src/agents/hype-lust-evaluator.ts`
- `src/agents/event-agent.ts`
- `src/ui/player-hud.ts`
- `src/ui/bottom-strip.ts`
- `src/ui/input-area.ts`
- `src/locale/zh-TW.ts`
- `documents/core.md`
- `documents/commands.md`
- `documents/utility_eval.md`

Verification:

- Input router tests.
- Module injector prompt tests.
- Utility Agent prompt assembly tests.
- Event Agent interpreter tests.
- Session lifecycle tests.

### Phase 4 - Flavor-Only Module Mode

Work:

- Add `moduleModes`.
- Update module setup UI with mechanics/flavor/off controls.
- Add helper gates for mechanics vs flavor.
- Route UA eval, event schema, resources, dice, status, memory, mission seeds, and prompt runtime through helpers.
- Add flavor-only style injection.

Likely files:

- `src/state/types.ts`
- `src/state/state-manager.ts`
- `src/modules/runtime-activation.ts`
- `src/modules/module-memory.ts`
- `src/modules/status-renderer.ts`
- `src/modules/hook-dispatcher.ts`
- `src/orchestrator/session-lifecycle.ts`
- `src/orchestrator/orchestrator.ts`
- `src/orchestrator/event-pipeline.ts`
- `src/orchestrator/module-injector.ts`
- `src/ui/module-setup-modal.ts`
- `src/ui/settings/modules-section.ts`
- `src/locale/zh-TW.ts`

Verification:

- Module registry/setup tests.
- Module injector tests.
- Module memory/status renderer tests.
- Combat/exploration/erotic hook tests.
- Integration pipeline tests.

### Phase 5 - Provider and End-to-End Regression

Work:

- Verify structured JSON behavior across Claude, Gemini, xAI, and DeepSeek.
- Run no-network unit tests first.
- Run live provider smoke tests only when API keys are available.
- Confirm Tauri build path and browser dev path both degrade gracefully.

Verification:

- `npx vitest run`
- Focused live smoke where available:
  - Scenario Workshop storyteller conversion.
  - Persona to NPC profile conversion.
  - Start storyteller session with one protagonist.
  - Flavor-only combat module does not start combat mechanics.
  - Mechanics combat module still starts combat normally.

## Workload Estimate

| Scope | Estimate |
|---|---:|
| MVP: schema + workshop mode + basic storyteller runtime + persona-to-NPC one-way conversion | 6-8 engineering days |
| Full requested scope including two-way conversion, flavor-only module mode, UI polish, and broad tests | 12-18 engineering days |
| Provider live verification across all configured providers | +1-3 days |

The biggest hidden cost is not provider support. It is safely separating module flavor from module mechanics without breaking existing module behavior.

## Risk Map

High risk:

- Flavor-only module mode touching too many call sites.
- Storyteller protagonist framing conflicting with existing "player" assumptions.
- Event Agent combat interpreting director directives as ordinary player action.
- Persona portrait conversion if portrait storage needs data URL to portrait set migration.

Medium risk:

- Scenario conversion creating invalid `initial_npcs` / `npc_generation_pool` mappings.
- AI assistant producing storyteller fields in standard mode or vice versa.
- Legacy sessions missing new `meta` fields.
- UI text overflow in new workshop mode controls.

Low risk:

- Provider adapter compatibility for JSON calls, because current adapters already expose a shared `responseFormat` abstraction.
- Adding scenario default migration for missing `playMode`.

## Non-Goals for First Implementation

- Do not build a brand-new Storyteller-specific agent.
- Do not rewrite the whole session state model around protagonist NPCs.
- Do not remove standard first/second-person modes.
- Do not make browser runtime a release target.
- Do not make flavor-only modules silently influence mechanics.

## Suggested New-Session Kickoff

Use this in the next session:

```text
Read AGENTS.md, documents/tickets.md T-140, and documents/plans/2026-06-12-storyteller-mode-feature-development-memo.md. Implement Storyteller Mode in phases. Start with Phase 0 and Phase 1 only unless I explicitly authorize later phases. Preserve existing sessions and standard gameplay behavior. Do not add new runtime agents unless a blocker proves it is necessary.
```

## Final Recommendation

Start with Phase 1 plus a minimal one-way `StoredPersona -> ProfileRecord` converter. That gives Scenario Workshop a real Storyteller authoring surface and lets users cast their personas into protagonist slots before the runtime inversion lands. Then implement runtime Storyteller Mode, then flavor-only modules. Doing flavor-only modules first would create a wide mechanical refactor before the user-visible mode exists.

## Implementation Notes - 2026-06-12

T-140 was implemented as a bundled run across Phases 0-5 after user authorization.

Locked decisions:

- Scenario JSON schema version is `0.6`.
- Missing `playMode` migrates to `"standard"`.
- Storyteller scenarios use `storyteller.defaultViewpoint`, `storyteller.protagonistSlotIds`, `storyteller.allowGodLens`, and `storyteller.directorCanControlProtagonistDialogue`.
- Runtime uses `NarrativePerspective = "third-storyteller"` plus optional `MetaState.storytellerViewpoint` and `MetaState.protagonistNpcIds`.
- `StoredPersona` remains the player profile source. Conversion creates Workshop `ProfileRecord` drafts under `WORKSHOP_SCENARIO_ID`; scenario JSON does not store persona IDs.
- Flavor-only modules are represented by `ModulesState.moduleModes`; missing entries remain mechanics for backward compatibility.
- No new runtime agent was added.

Review focus:

- Workshop mode switching, duplicate-and-convert, export/import migration, and protagonist slot validation.
- Storyteller runtime prompt framing across Main Session, UA, Event Agent, input router, HUD, and session lifecycle.
- Mechanics-vs-flavor module gating for prompts, hooks, resources, event schemas, status items, CE/module memory, and resume behavior.
- Standard scenario/session regression.
