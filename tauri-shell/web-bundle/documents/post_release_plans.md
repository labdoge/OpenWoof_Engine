# DogeChat Post-Release Plans

Features and improvements planned after v1.0 release.

---

## P-001: OpenAI-Compatible API Adapter (Local Models + OpenRouter)

**Priority**: High
**Effort**: ~1 day

### Summary
Single adapter (`openai-compatible.ts`) supporting any OpenAI-compatible endpoint — covers local inference tools (Ollama, LM Studio, llama.cpp, KoboldCpp) and cloud proxies (OpenRouter) with one implementation.

### Design
- **Adapter**: Maps `LLMRequest` → OpenAI `/v1/chat/completions` format. System prompt as `role: "system"`. SSE streaming with `data: [DONE]` termination.
- **No CORS issue**: localhost servers set permissive CORS; Tauri bypasses CORS entirely.
- **No changes to orchestrator/agents**: they only see `LLMRequest`/`LLMResponse`.

### Settings UI
New provider option per model slot:
```
Provider: [Claude] [Gemini] [自訂 / OpenAI 相容]
```
When selected, show preset dropdown + manual fields:
- **Preset dropdown**: `自訂...` | `OpenRouter` | `Ollama (本機)` | `LM Studio (本機)` — pre-fills URL, always editable.
- **Base URL**: e.g. `http://localhost:11434/v1` or `https://openrouter.ai/api/v1`
- **API Key**: optional (required for OpenRouter, not for most local tools)
- **Model name**: free text input (no dropdown — can't enumerate remote/local models reliably)

### Caveats to Surface
- No prompt caching (Anthropic/Gemini cache features are provider-specific).
- Utility Agent slot needs capable models — suggest 7B+ for structured JSON output.
- Optional "max context" field so users can declare the model's context window for compression tuning.

### Scope
- 1 adapter file: `src/adapters/openai-compatible.ts`
- Settings UI additions to existing model config panel
- Locale strings for new UI elements
- No orchestrator/agent/module changes required

---

## P-002: Storyteller Mode (NPC-Protagonist Play Mode)

**Priority**: Medium
**Effort**: ~3-5 days

### Summary
A new play mode that inverts the player/NPC relationship. Imported NPC(s) become the story's protagonists; the user takes the role of storyteller/director. User input represents what the NPCs say or do, or plot-level directives that shape the narrative. The LLM narrates the consequences and the world's response from the NPCs' point of view.

### Core Concept
- **Standard mode**: Player = protagonist, LLM = narrator + NPCs.
- **Storyteller mode**: NPC(s) = protagonist(s), LLM = narrator + world. User = director who controls NPC speech, actions, and plot beats.

### Perspective: Always 3rd Person
Storyteller mode locks to 3rd-person narration (new perspective value, never 你 or 我). Two viewpoint lenses selectable at session start and switchable mid-session:

| Viewpoint | Description | Prompt Behavior |
|-----------|-------------|-----------------|
| **NPC Lens** (角色視角) | Narration filtered through the protagonist NPC(s)' senses, thoughts, and emotions. The reader sees what they see, feels what they feel — but in 3rd person (e.g., 「她感覺到…」「他注意到…」). Unknown information stays unknown. | LLM instructed: limit narration to protagonist(s)' perceptual scope. Use sensory/emotional interiority. |
| **God Lens** (全知視角) | Omniscient narrator. The reader sees all characters' thoughts, offscreen events, dramatic irony. Nothing is hidden. | LLM instructed: narrate without perceptual limits. May reveal any character's inner state or offscreen events. |

### Input Handling
Storyteller mode introduces a new input grammar alongside the existing command/narrative modes:

- **NPC directives** — Tell NPC(s) what to say or do:
  - `[NPC名] SPEAK:[…]` / `[NPC名] DO:[…]` — direct an NPC's words or actions.
  - If only one protagonist NPC, the name prefix is optional.
  - Multiple NPC directives in one input = multi-character choreography (left-to-right = chronological).
- **PLOT directives** — Shape the world without acting through an NPC:
  - `PLOT:[…]` — works the same as standard mode. Tells the LLM what happens in the world.
- **Narrative mode compatible** — If input mode is `narrative`, freeform text is interpreted as a mix of NPC direction and plot beats (same as standard narrative mode interprets player intent).
- **RECALL** — Still functions as a system command (query memory/lore).

### Session Start Flow
1. Perspective Modal gains a third top-level choice: **說書人模式 (Storyteller Mode)**.
2. When selected, perspective cards (2nd/1st person) are hidden — perspective is locked to 3rd person.
3. A new **viewpoint selector** appears: NPC Lens (角色視角) vs God Lens (全知視角). Default: NPC Lens.
4. Input mode selector remains (command vs narrative) — both work in storyteller mode.
5. **Protagonist selector**: If the scenario has multiple NPCs, a checklist lets the user mark which NPC(s) are protagonists. At least one required. Non-protagonist NPCs become world characters (LLM-controlled, like NPCs in standard mode).

### State & Types
```typescript
// New perspective value
export const NARRATIVE_PERSPECTIVES = ['second', 'first', 'third-storyteller'] as const;

// New viewpoint type (only meaningful when perspective = 'third-storyteller')
export const STORYTELLER_VIEWPOINTS = ['npc-lens', 'god-lens'] as const;
export type StorytellerViewpoint = (typeof STORYTELLER_VIEWPOINTS)[number];

// MetaState additions
interface MetaState {
  // ... existing fields ...
  storytellerViewpoint?: StorytellerViewpoint;    // only set in storyteller mode
  protagonistNpcIds?: string[];                    // NPC(s) the user directs
}
```

### Prompt Injection (Block 1)
When `perspective === 'third-storyteller'`, module-injector replaces the standard perspective block with:

- **Narration rule**: 3rd-person narration in Traditional Chinese. Never use 你 for any character. Use character names or pronouns (她/他/他們).
- **Role inversion**: "The user is the storyteller directing [protagonist name(s)]. Narrate the world's response to their directives. Do NOT generate dialogue or actions for protagonist NPC(s) unless the user's input is ambiguous and a small bridging action is natural."
- **Viewpoint rule** (NPC Lens): "Limit narration to what [protagonist(s)] can perceive. Use their sensory experience and emotional interiority. Do not reveal information they couldn't know."
- **Viewpoint rule** (God Lens): "Narrate from an omniscient perspective. You may reveal any character's thoughts, offscreen events, and dramatic irony."

### Hype / Lust / Affection in Storyteller Mode
- Mechanics still function — UA evaluates NPC emotional state as usual.
- **Key difference**: Affection tracks the protagonist NPC(s)' feelings toward *other NPCs* (world characters), not toward a player character. The "player" slot in state is repurposed or hidden.
- Hype/Lust between protagonist NPCs and world NPCs works identically to standard mode.

### UA / Event Agent Interaction
- UA eval prompt receives a flag indicating storyteller mode. The "player action" field in eval becomes "protagonist action" — semantically the same, sourced from user directives rather than player commands.
- Event Agent interprets user directives as protagonist actions (same pipeline, different framing in EA interpreter prompt).
- Critical Events still fire and accumulate per NPC.

### Status Window
- Player panel is hidden or replaced with a **Protagonist Panel** showing the directed NPC(s)' stats.
- If multiple protagonists, a tab or compact stack shows each.
- Viewpoint toggle (NPC Lens ↔ God Lens) accessible from status bar for mid-session switching.

### Scope
- New perspective value + viewpoint type in `constants.ts` and `state/types.ts`
- Perspective Modal UI: third mode card, viewpoint selector, protagonist checklist
- Input Router: parse `[NPCName] SPEAK/DO` prefix syntax
- Module Injector: storyteller-mode Block 1 prompt assembly
- UA eval prompt: storyteller flag + protagonist-action framing
- EA interpreter prompt: same adaptation
- Status Window: protagonist panel variant
- Locale strings for all new UI elements
- No new adapter or storage changes required
