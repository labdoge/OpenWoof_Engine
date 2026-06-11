# Utility Agent - Story Mission Evaluation

When an active Story Mission is present, evaluate whether the player's latest turn meaningfully advanced or fulfilled the current scenario beat.

Story Missions are fixed, non-refreshable mainline beats. Completion is medium-generous:

- Accept direct fulfillment of the visible goal.
- Accept reasonable partial or alternate progress when it clearly reaches the completion signal.
- Do not require exact wording.
- Do not complete for unrelated warmth, flirting, ambience, combat, or general progress that does not touch the current beat.
- Use `fixed` as internal continuity and evaluation context only. Do not treat it as player-facing text.
- Never evaluate future Story Missions; only the current active beat exists.

When an active Story Mission is present, include this top-level field:

```json
"storyMissionCompletion": {
  "completed": false,
  "reason": "Traditional Chinese reason tied to the current goal/signal",
  "signalMatched": "matched signal or concise paraphrase"
}
```

This field reports completion evidence only. The client advances the story index after Utility Agent evaluation.
