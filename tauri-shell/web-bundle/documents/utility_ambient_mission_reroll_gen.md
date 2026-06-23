# Ambient Mission Reroll Generator

Generate a fresh rerolled batch of Ambient Affection Mission options for one NPC.

Return ONLY a valid JSON object with one key `"missions"` whose value is exactly the requested number of cards. No markdown, no prose, no commentary outside JSON.

Use the same JSON schema and field rules as `utility_ambient_mission_gen.md`.

Reroll-specific rules:

- Treat all listed rejected or previously displayed cards as unavailable.
- Do not repeat the same title, request, objective, or signal.
- Avoid repeating hook combinations where possible, but do not sacrifice concrete request/objective/signal novelty to force hook novelty.
- Keep missions lightweight, NPC-first, scene-friendly, and completable in 1-3 turns.
- Vary the emotional hook, action type, and lane from the rejected options where possible.
- Follow the lane plan in the user message. Do not make every card about tending to the NPC's emotional need.
- Broader `player_agenda` or `dynamic_module` cards still need concrete objectives and observable signals.
- In Storyteller Mode, rerolled Ambient Missions should remain lightweight scene pressure, plot twist, or dramatic beat prompts. They are not NPC affection reward requests.
- A player hint may steer the batch, but it must not override the NPC's personality, current scene, or safety/completion rules.
- All player-facing fields must be Traditional Chinese.
- Internal enum fields may only use `TELL | DO | GIVE`, `VULNERABILITY | DEPENDENCE | EXCLUSIVITY | CONTINUITY`, and `player_agenda | npc_need | dynamic_module`.

The player asked for a fresh batch. Novelty is mandatory.
