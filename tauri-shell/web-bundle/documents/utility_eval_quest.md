### Quest Completion Check

If any NPC has an **active Bottleneck Breakthrough Mission** (legacy tag: `[Active Quest]` in the NPC States input), evaluate whether the player's action this turn fulfills the quest objective.

Bottleneck quests are **Bottleneck Breakthrough Missions**: major affection-gate progress checks that connect the scenario premise with the NPC relationship gate. They are intentionally stricter than Ambient Affection Missions. Do not complete them for general warmth, flirtation, ambience, or partial progress.

**Active quest rule:** If an NPC has `[Active Quest]`, always output `questCompletion` for that NPC. When the objective is not met, set `completed: false` and give a concise reason. Do not silently omit the field for active quests.

**Completion requires ALL of these:**
1. The quest must have been active for at least 2 turns before completion is possible. If the quest was just activated this turn or last turn, do NOT flag completion regardless of player action.
2. The player's action this turn DIRECTLY addresses the specific quest objective (not just the general theme).
3. The quest topic is explicitly present in the conversation — the player must be actively engaging with the quest subject matter, not doing something unrelated.
4. The objective is genuinely met, not just partially progressed toward.
5. If the quest provides specific `Conditions`, ALL listed conditions must be met or clearly implied by the current scene.
6. The reason MUST reference the specific quest objective or condition, not just describe general progress. Generic reasons like "互動良好" or "氣氛融洽" are insufficient — cite what concrete objective was fulfilled.

**NOT completion** (`questCompletion.completed: false`):
- Player is being emotionally sincere but about an unrelated topic
- Player's action is thematically similar but doesn't address the specific objective
- The NPC reacts positively but the quest condition hasn't been triggered
- General bonding or rapport that doesn't match the exact quest requirement
- Player is being emotionally supportive but the specific quest scenario has not occurred in this scene
- The scene lacks the situational trigger described in the quest conditions (e.g., no outsider asked, no conflict arose, no vulnerability was shown)
- The quest was activated too recently (fewer than 2 turns ago) — meaningful quests require time to develop
- When in doubt, do NOT flag completion — false positives break game pacing

**When completed:**
- Set `questCompletion.completed` to `true`
- Set `questCompletion.reason` to a brief (≤30 char) Traditional Chinese justification that references the specific objective met
- Cumulative progress over multiple turns counts, but the final turn must still directly engage the quest topic

**When not completed:**
- Set `questCompletion.completed` to `false`
- Set `questCompletion.reason` to a brief Traditional Chinese reason naming the missing objective/condition
- Keep `causation`, `questText`, and `keywords` when helpful, but the boolean and reason are mandatory for active quests
