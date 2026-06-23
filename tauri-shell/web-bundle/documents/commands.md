# COMMANDS

## Input Mode

The user chooses an input mode at session start. This affects how input is parsed:

- **Command mode** (default): Input is parsed for SPEAK/DO/PLOT/RECALL command prefixes. Multi-command syntax (`SPEAK:[...] DO:[...]`) is supported. Unrecognized bare text is treated as SPEAK.
- **Narrative mode**: All input is sent to the LLM as freeform prose without command wrapping. The LLM interprets intent directly. RECALL still works as a system command (detected before LLM dispatch).
- **Storyteller mode note**: In `third-storyteller`, the user is a director/storyteller. Freeform text is director/stage direction or protagonist NPC action/dialogue, not an in-world player action.

## RECALL

Triggered by `RECALL [NPC名]` or `RECALL: ALL`. Output stored Profile(s) — systematic format, no roleplay voice.

# NPC PROFILE FORMAT (External)

Profiles: created on NPC debut, updated automatically by the system every 5 critical events and on session end, recalled via RECALL.

<!-- ============================================================
     TUNING: NPC PROFILE FIELD LENGTHS
     Adjust character counts to control profile size.
     All counts are MAXIMUMS — shorter is always acceptable.
     ============================================================ -->

### Profile Field Length Limits

| Field | Max Length | Style |
|-------|-----------|-------|
| NPC_ID | ≤8 chars | Lowercase tag, e.g., `xiaoya` |
| 姓名 | ≤10 chars | Full name |
| 角色 | ≤15 chars | Role title |
| 性格 | 2-4 keywords, ≤20 chars | Comma-separated |
| 外貌 | 5 keywords, ≤30 chars | Comma-separated |
| 穿著 | ≤35 chars | Keywords + state |
| Affection | Fixed format | `[N]% ([Tier])` |
| Lust | Fixed format | `[Tier]` |
| 瓶頸 | Fixed format | `30%[✓/✗] 50%[✓/✗] 70%[✓/✗] 90%[✓/✗]` |
| NPC關係 | ≤40 chars | `[ID:attitude, ...]` (ally/neutral/hostile) |
| 事件 (per entry) | ≤35 chars | `T[N]:[Event]` |
| 事件 (max entries) | 8 entries | Oldest dropped if exceeded |

<!-- END TUNING: NPC PROFILE FIELD LENGTHS -->

### Profile Output Format

```
===== NPC PROFILE =====
NPC_ID: [tag] | 姓名: [Name] | 角色: [Role]
性格: [keywords] | 外貌: [5 keywords] | 穿著: [keywords + state]
Affection: [N]% ([Tier]) | Lust: [Tier]
瓶頸: 30%[✓/✗] 50%[✓/✗] 70%[✓/✗] 90%[✓/✗]
NPC關係: [ID:attitude, ...]
事件: T[X]:[Event] | T[Y]:[Event] | ...
========================
```

### Profile Rules

- **Safety**: If values uncertain from long context, default to last confirmed Profile. **Never inflate.**
- **Events list**: Keep only the most significant events. When exceeding max entries, drop the oldest mundane events first; always keep bottleneck breakthroughs and critical Hype events.
- **Update discipline**: Profiles are updated automatically by the system. Mid-session changes (outfit damage, affection shifts) are tracked by runtime state and committed to the Profile periodically.

# CRITICAL EVENT FORMAT

Critical Events are flagged when any Major NPC's Hype reaches 強烈正面 or 強烈負面. These are stored externally by the system and may be injected into context for future sessions.

<!-- ============================================================
     TUNING: CRITICAL EVENT DESCRIPTION
     Controls the format and length of critical event records.
     ============================================================ -->

### Critical Event Field Limits

| Field | Max Length | Style |
|-------|-----------|-------|
| Description | ≤50 chars | Single sentence: who did what, outcome |
| Scene | ≤15 chars | Location name |

### Critical Event Description Style

- **Format**: `T[N], [Scene], [Hype Tier]: [Description]`
- **Description**: One sentence. Subject + action + emotional outcome.
- ✅ `T12, 私人包廂, 強烈正面: 玩家替小雅擋住醉客，她首次信任客人`
- ✅ `T38, 淋浴間, 強烈負面: 玩家無視拒絕強行觸碰，小雅崩潰按下警報`
- ❌ `T12, 私人包廂, 強烈正面: 玩家在經理帶著一個喝醉的客人試圖闖入808包廂時，主動站起來用身體擋在小雅和門之間...` (too long, narrative prose)

<!-- END TUNING: CRITICAL EVENT DESCRIPTION -->
