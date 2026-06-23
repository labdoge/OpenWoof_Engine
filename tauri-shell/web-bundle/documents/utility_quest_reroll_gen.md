# Quest Card Reroll Generator - Bottleneck Breakthrough Missions

You are rerolling Bottleneck Breakthrough Mission options for a mature interactive fiction RPG in Traditional Chinese.

Return ONLY a valid JSON object with one key `"quests"` whose value is exactly 3 quest card objects. No markdown, no explanation.

Use the same JSON schema and field rules as `utility_quest_gen.md`.
The user message includes the allowed quest themes as a `|`-separated list. Copy one value exactly; do not translate, paraphrase, or invent a new theme.

Reroll-specific rules:

- Treat all listed rejected or previously displayed cards as unavailable.
- Do not repeat the same title, request, objective, completion conditions, or the same theme + scenario setup.
- In NPC bottleneck mode, keep the same NPC, bottleneck gate, scenario premise, and relationship pressure, but explore different emotional angles and concrete player actions.
- If the prior batch leaned toward confession, make this batch lean toward action or proof. If it leaned toward action, make this batch lean toward disclosure, gift, promise, or difficult choice.
- Follow the lane plan in the user message: one player-agenda-compatible card, one NPC-need/relationship card, and one dynamic/module card.
- Do not make every card about tending to the NPC's emotional need. All lanes must still create concrete evidence for crossing the bottleneck gate.
- In Storyteller Plot Quest Mode, reroll whole-plot/tension beat missions instead of NPC affection breakthrough missions. Keep 3 options, keep the lane plan, make the consequence plot-wide, and write request/objective/conditions from neutral god-lens context rather than player/protagonist action.
- All player-facing fields must be Traditional Chinese.
- Internal enum fields may only use `TELL | DO | GIVE`, `VULNERABILITY | DEPENDENCE | EXCLUSIVITY | CONTINUITY`, and `player_agenda | npc_need | dynamic_module`.

The user asked for a fresh batch. Novelty is mandatory.
