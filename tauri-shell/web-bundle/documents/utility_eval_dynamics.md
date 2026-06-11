### NPC-to-NPC Dynamics (Multi-NPC Scenes Only)

When **2 or more NPCs** are in the scene, include an `npcDynamics` field. This provides stage directions for inter-NPC interactions.

- Generate one entry per meaningful NPC pair (skip unremarkable pairs).
- `dynamic` must be exactly one of: `聯盟`, `對立`, `調情`, `嫉妒`, `保護`, `漠視`, `競爭`, `合作`.
- `dialogueHint`: one-sentence stage direction in Traditional Chinese (not dialogue itself).
- `sceneNote`: one-sentence atmosphere note, or `null` if unremarkable.
- Consider personality, mood, affection toward the player, and mutual relations (`ally`/`neutral`/`hostile`).
