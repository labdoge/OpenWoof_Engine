# Utility Agent - Ambient Mission Evaluation

When an NPC has `[Active Ambient Mission]`, evaluate whether the player's latest action meaningfully fulfilled it.

Completion is generous:

- Accept direct fulfillment of the objective.
- Accept alternate approaches that clearly answer the NPC's request.
- Accept mature or intimate approaches only when they actually produce the mission signal and fit the NPC's current attitude.
- Do not complete if the player ignored the request, contradicted it, or only produced unrelated affection/hype.

For every NPC with `[Active Ambient Mission]`, include:

```json
"ambientMissionCompletion": {
  "completed": false,
  "reason": "Traditional Chinese reason tied to the request/objective/signal",
  "signalMatched": "matched signal or concise paraphrase"
}
```

This field reports completion evidence only. Do not grant affection rewards here; the client applies the separate mission reward after Utility Agent evaluation.
