# Beta Candidate Features

Remaining features before beta release. Lorebook, Vision API Character Inference, TavernCard V2 Import, and Session-to-Novel Export are complete. Only Export System (PNG-embedded JSON) remains.

---

## ~~1. Vision API Character Inference~~ ✓ DONE

Implemented in `src/agents/character-inference-agent.ts`, integrated into Character Workshop form.

## ~~2. TavernCard V2 Import~~ ✓ DONE

Implemented in `src/importers/` (tavern-card-parser, json-detector, tavern-card-converter) with import portal (`src/ui/import-portal.ts`) and question flow (`src/ui/import-question-flow.ts`).

## 3. Export System

Export characters, scenarios, and lorebooks as JSON-embedded PNG files.

- **Scope**: JSON payload injection into PNG tEXt chunks, export UI in Asset Browser
- **Files**: new `src/exporters/png-embedder.ts`, Asset Browser export action

## ~~4. Session-to-Novel Export~~ ✓ DONE

Implemented in `src/exporters/novel-exporter.ts` (multi-pass LLM pipeline) with config modal (`src/ui/novel-export-modal.ts`). Chat history export also available via `src/exporters/chat-exporter.ts`.
