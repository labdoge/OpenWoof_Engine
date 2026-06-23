# Character Memory (Critical Events) Template

This file defines the format for Critical Events — the cross-session, character-focused persistent memory system. Critical Events record moments of extreme emotional impact between the Player and an NPC, and persist across play sessions.

## Qualifying Criteria

A turn qualifies as a Critical Event when **any Major NPC in the scene has Hype at 強烈正面 or 強烈負面**. Only these two extreme tiers qualify. 輕微正面, 輕微負面, and 平淡 do NOT generate Critical Events.

## Storage Format (JSON)

Each Critical Event is stored as a JSON object in IndexedDB, indexed by `npcId` and `scenarioId`.

```json
{
  "id": "evt_001",
  "npcId": "xiaoya",
  "npcName": "林小雅",
  "scenarioId": "scenario_massage_parlor",
  "scenarioTitle": "台北夜話：溫柔鄉的半套遊戲",
  "turn": 12,
  "scene": "私人包廂",
  "hype": "強烈正面",
  "description": "玩家替小雅擋住醉客，她首次信任客人",
  "createdAt": 1740000000000
}
```

## Field Specifications

<!-- ============================================================
     TUNING: CRITICAL EVENT FIELD SPECS
     Modify lengths here. Storage format keys above must remain
     unchanged — only field CONTENT constraints are adjustable.
     ============================================================ -->

| Field | Max Length | Format | Example |
|-------|-----------|--------|---------|
| id | ≤12 chars | Auto-generated, `evt_[NNN]` | `evt_001` |
| npcId | ≤8 chars | Matches NPC Profile NPC_ID | `xiaoya` |
| npcName | ≤10 chars | Display name | `林小雅` |
| scenarioId | ≤40 chars | Scenario file identifier | `scenario_massage_parlor` |
| scenarioTitle | ≤30 chars | Human-readable scenario name | `台北夜話：溫柔鄉的半套遊戲` |
| turn | Integer | Turn number when event occurred | `12` |
| scene | ≤15 chars | Location name at time of event | `私人包廂` |
| hype | Fixed enum | `強烈正面` or `強烈負面` only | `強烈正面` |
| description | ≤50 chars | One sentence: who + action + outcome | See style guide below |
| createdAt | Timestamp | Unix milliseconds | `1740000000000` |

<!-- END TUNING: CRITICAL EVENT FIELD SPECS -->

## Description Style Guide

<!-- ============================================================
     TUNING: CRITICAL EVENT DESCRIPTION STYLE
     Adjust these rules to change how event descriptions read.
     Keep examples updated if you change the constraints.
     ============================================================ -->

### Rules
- One sentence only
- Structure: **[subject] + [action] + [emotional outcome]**
- Use NPC name, not pronouns
- No dialogue reproduction
- No narrative prose — factual and terse
- Include the emotional significance (why this matters to the NPC)

### Max 50 Characters — Strict

Count carefully. Chinese characters = 1 char each. Punctuation = 1 char each.

### Good Examples

| Turn | Scene | Hype | Description | Char Count |
|------|-------|------|-------------|-----------|
| T12 | 私人包廂 | 強烈正面 | 玩家替小雅擋住醉客，她首次信任客人 | 16 |
| T38 | 淋浴間 | 強烈負面 | 玩家無視拒絕強行觸碰，小雅崩潰按警報 | 17 |
| T55 | 私人包廂 | 強烈正面 | 玩家為被斥責的小雅說話，突破50%瓶頸 | 17 |
| T8 | 全景客廳 | 強烈負面 | 玩家嘲笑她的裸體，女僕羞恥崩潰想逃離 | 17 |
| T22 | 主臥室 | 強烈正面 | 玩家主動借外套給發抖的女僕，她首次感到被尊重 | 21 |
| T15 | VIP套房 | 強烈負面 | 股東威脅開除迫使換最暴露服裝，舞者含淚屈服 | 20 |
| T40 | VIP套房 | 強烈正面 | 玩家撕毀她的債務收據，舞者徹底放下防備 | 18 |

### Bad Examples (and why)

| Description | Problem | Char Count |
|-------------|---------|-----------|
| 玩家在經理帶著一個喝醉的客人試圖闖入808包廂的時候主動站起來用身體擋在小雅和門之間保護了她 | Way too long, narrative prose | 40 |
| 擋住醉客 | Too vague, no emotional outcome, no subject names | 4 |
| 她哭了 | No subject name, no cause, no context | 3 |
| 「你給我滾！」玩家吼道 | Dialogue reproduction, no outcome | 10 |
| 玩家做了壞事讓NPC很難過 | Generic, no specifics, uses "NPC" not name | 14 |

<!-- END TUNING: CRITICAL EVENT DESCRIPTION STYLE -->

## Context Injection Format

When the Orchestrator detects that an NPC in the current scene has existing Critical Events for this scenario, they are injected into the LLM context using this format:

```
[SYSTEM: Critical Event Memory — [NPC Name] in [Scenario Title]]
- T[N], [Scene], [Hype]: [Description]
- T[N], [Scene], [Hype]: [Description]
- ...
[NPC should be aware of these past experiences. They color her trust, fears, and expectations.]
```

<!-- ============================================================
     TUNING: CONTEXT INJECTION LIMITS
     Controls how many events are injected and the instruction
     given to the LLM about how to use them.
     ============================================================ -->

### Injection Limits

| Constraint | Value | Notes |
|-----------|-------|-------|
| Max events injected per NPC | 10 | Most recent if exceeded |
| Max NPCs with memory per scene | 3 | Matches Major NPC scene limit |
| Total injection budget | ≤500 chars per NPC | Including header and footer |

### Injection Instruction

The footer line tells the LLM how to use the memories. Adjust tone as needed:

**Default (neutral)**: `[NPC should be aware of these past experiences. They color her trust, fears, and expectations.]`

**Warm variant**: `[NPC carries these memories. Positive ones make her more open; negative ones make her guarded. Reference them naturally in her reactions.]`

**Cold variant**: `[NPC remembers these events. They inform her behavior but she does not explicitly reference them unless triggered by similar situations.]`

<!-- END TUNING: CONTEXT INJECTION LIMITS -->

## Complete Injection Example

```
[SYSTEM: Critical Event Memory — 林小雅 in 台北夜話：溫柔鄉的半套遊戲]
- T12, 私人包廂, 強烈正面: 玩家替小雅擋住醉客，她首次信任客人
- T25, 淋浴間, 強烈負面: 玩家觸碰禁區被嚴厲拒絕，信任回落
- T38, 私人包廂, 強烈正面: 玩家為被斥責的小雅說話，突破50%瓶頸
- T55, 私人包廂, 強烈正面: 小雅主動分享離婚原因，深度情感連結
[NPC should be aware of these past experiences. They color her trust, fears, and expectations.]
```

## Session Start Flow

When a player starts a scenario and the system detects existing Critical Events:

```
1. Query IndexedDB: any records where scenarioId matches current scenario?
2. If yes → show Memory Prompt Modal:
   ┌────────────────────────────────────────┐
   │  偵測到角色記憶                          │
   │                                        │
   │  [NPC Name] 在此劇本中有 [N] 筆關鍵記憶  │
   │                                        │
   │  ○ 覆蓋舊記憶                           │
   │    清除此NPC在此劇本的舊記錄，             │
   │    本次遊玩重新記錄關鍵事件               │
   │                                        │
   │  ○ 跳過記錄                             │
   │    保留舊記憶供參考，                     │
   │    本次遊玩不記錄新的關鍵事件             │
   │                                        │
   │  [確認]                                 │
   └────────────────────────────────────────┘
3. "Replace" → DELETE existing events for this npcId+scenarioId, enable recording
4. "Skip" → KEEP existing events, DISABLE recording for this session
5. Either way: existing events are still INJECTED into context for narrative reference
```

## Detection Logic

Critical Events are detected by the **Utility Agent** on every turn. When the UA evaluates Hype for each NPC and determines a qualifying tier (強烈正面 or 強烈負面), it generates a `criticalEvent` object in its JSON output containing:
- `description`: ≤50 characters, Traditional Chinese, format: who + action + outcome
- `scene`: current location name

The Orchestrator extracts this from the UA response and stores it in the `critical_events` IndexedDB store, indexed by `npcId` and `scenarioId`.
