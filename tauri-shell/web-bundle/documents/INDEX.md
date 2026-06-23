# Documents Index — DogeChat

Router for the 55 design/reference/utility-prompt docs in this folder. Read this file first to locate relevant docs; only load the actual .md files you need.

Status tags: `[CURRENT]` authoritative · `[DRAFT]` WIP · `[REFERENCE]` stable supporting · `[LEGACY]` kept for history.

---

## 🧭 Core Specification & Architecture

| File | Status | When to read |
|---|---|---|
| `dogechat_dev_plan.md` | [CURRENT] | Full technical spec — architecture, phases, feature list |
| `design_reference.md` | [CURRENT] | Theme / mechanics / API / assets consolidated reference |
| `../architecture.md` (root) | [CURRENT] | Module layout, directory structure, component map |
| `release_source_workflow.md` | [CURRENT] | Release-source nested repo contract, artifact sync workflow, and GitHub release policy |

## 🎮 Narrative & Commands

| File | Status | When to read |
|---|---|---|
| `core.md` | [CURRENT] | Main Session narrative system — prompts, flow, Tauri adapter |
| `commands.md` | [CURRENT] | User input commands (do / speak / plot / send) semantics |
| `first_turn.md` | [CURRENT] | First-turn bootstrap logic and prompt |
| `consistency_resolution.md` | [CURRENT] | Narrative continuity rules |
| `rule_resolution.md` | [CURRENT] | Rule-vs-flavour conflict adjudication |

## 🤖 Utility Agent Prompts (21 files)

Sub-agent prompts for mechanical evaluation. Read only the one you need.

### Evaluation family (`utility_eval*.md`)
- `utility_eval_base.md` — runtime base eval prompt
- `utility_eval_dynamics.md`, `utility_eval_entity_delta.md`, `utility_eval_event.md`, `utility_eval_hints.md`, `utility_eval_lore.md`, `utility_eval_quest.md`
- `utility_eval_ambient_mission.md` — Ambient Affection Mission completion
- `utility_eval_story_mission.md` — current Story Mission completion
- `utility_eval.md` — [LEGACY] monolithic eval prompt retained for reference only

### State extraction / mutation
- `utility_status_extract.md` — status window parse
- `utility_profile_update.md`, `utility_profile_enrich.md` — NPC profile mutation
- `utility_initial_affection.md` — initial affection seeding
- `utility_adoption.md` — trait/mechanic adoption
- `utility_progression.md` — character progression

### Generators
- `utility_identity_gen.md` — NPC identity
- `utility_trait_gen.md` — trait generation
- `utility_quest_gen.md` — quest generation
- `utility_ambient_mission_gen.md` — Ambient Affection Mission option generation
- `utility_scene_mapper.md` — scene mapping

### Interaction
- `utility_npc_interaction.md` — NPC-to-NPC interactions
- `utility_compress.md` — context compression

### Spec
- `spec_ua_online.md` | [CURRENT] | Utility Agent online/offline behaviour spec

## 🧩 System Designs

| File | Status | When to read |
|---|---|---|
| `combat_system_design.md` | [DRAFT] | Combat mechanics |
| `dice_system_design.md` | [DRAFT] | Dice resolution |
| `event_agent_system_design.md` | [CURRENT] | Event Agent pipeline (UA → EA → Client) |
| `client_event_resolution_design.md` | [CURRENT] | Client-side event resolution |
| `exploration_system_design.md` | [DRAFT] | Exploration mechanics |
| `mechanics_system_design.md` | [DRAFT] | General mechanics framework |
| `pacing_system_design.md` | [LEGACY] | Legacy pacing events and `pacing_drivers`; read for migration/fallback behavior. Mission System v2 Ambient Missions are the current ambience path. |
| `scene_entity_registry_design.md` | [CURRENT] | Scene entity registry |
| `succession_system_design.md` | [DRAFT] | Session succession / handover |
| `ttrpg_system_design.md` | [DRAFT] | TTRPG mode design (NB: TRPGSimChat is the spun-off project for this) |

## 🛠 Workshops (content generation tooling)

| File | Status | When to read |
|---|---|---|
| `workshop_arcanum.md` | [CURRENT] | Arcanum (lore) workshop |
| `workshop_character.md` + `workshop_character_form.md` | [CURRENT] | Character design flow + form |
| `workshop_scenario.md` + `workshop_scenario_form.md` | [CURRENT] | Scenario design flow + form |
| `workshop_mechanics_guide.md` | [CURRENT] | Mechanics workshop guidance |

## 🧱 Module design

| File | Status | When to read |
|---|---|---|
| `module_design_guide.md` | [CURRENT] | How to build a content module |
| `module_escalation_guide.md` | [CURRENT] | Escalation rules for mature content modules |
| `multi_npc.md` | [CURRENT] | Multi-NPC scene handling |

## 📋 Templates

| File | Status | When to read |
|---|---|---|
| `template_character_memory.md` | [CURRENT] | NPC memory blob template |
| `template_character_profile.md` | [CURRENT] | NPC profile template |
| `scenario_overview_template.json` | [CURRENT] | Scenario JSON schema |
| `localization_caps_registry.md` | [CURRENT] | zh-TW caps / truncation rules |

## 📌 Planning & Tickets

| File | Status | When to read |
|---|---|---|
| `tickets.md` | [CURRENT] | Open/Done tickets. Dispatch `ticket-triager` subagent for summaries. |
| `beta_candidate_features.md` | [DRAFT] | Beta-cut feature list |
| `post_release_plans.md` | [DRAFT] | Post-release roadmap |
| `portal_session_overhaul.md` | [DRAFT] | Portal/session UX overhaul |

---

## Reading strategy (Opus 4.7 token-efficient)

1. **For a broad topic** — dispatch `design-doc-reader` pattern via `Agent` tool (subagent style). Let a fresh subagent read relevant docs and return a summary.
2. **For a specific file** — Read tool directly. Cheap.
3. **For bulk utility-prompt review** — always narrow to one family (`eval*`, `generator`, `interaction`). Never read all 21 UA prompts at once.
4. **For ticket triage** — dispatch `ticket-triager` subagent.
