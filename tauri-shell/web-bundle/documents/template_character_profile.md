# Character Profile Template

This file defines the exact output format for NPC Profiles. Profiles are created on NPC debut, updated automatically by the system every 5 critical events and on session end, and displayed on RECALL. The system also exports profiles as `.json` files for cross-session persistence.

## Display Format (RECALL Output)

Used when the LLM outputs a profile in chat (RECALL command).

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

## Field Specifications

<!-- ============================================================
     TUNING: PROFILE FIELD SPECS
     Modify lengths and counts here. Display format structure
     above must remain unchanged — only field CONTENT lengths
     are adjustable.
     ============================================================ -->

| Field | Max Length | Format | Example |
|-------|-----------|--------|---------|
| NPC_ID | ≤8 chars | Lowercase ASCII tag | `xiaoya` |
| 姓名 | ≤10 chars | Full display name | `林小雅` |
| 角色 | ≤15 chars | Role/occupation title | `舒壓技師（新手）` |
| 性格 | 2-4 keywords, ≤20 chars | Comma-separated | `羞澀, 生疏, 順從` |
| 外貌 | 5 keywords, ≤30 chars | Comma-separated | `纖細, 白皙, 無辜大眼, 短髮, 大腿痣` |
| 穿著 | ≤35 chars | Keywords + current state | `緊身護士服, 領口微開, 精油漬` |
| Affection | Fixed format | `[N]% ([Tier])` | `32% (友善)` |
| Lust | Fixed format | Tier name only | `萌芽` |
| 瓶頸 | Fixed format | ✓ = unlocked, ✗ = locked | `30%[✓] 50%[✗] 70%[✗] 90%[✗]` |
| NPC關係 (per entry) | ≤15 chars | `[ID]:[attitude]` | `manager:hostile` |
| NPC關係 (max entries) | 4 entries | Only tracked NPCs | — |
| 事件 (per entry) | ≤35 chars | `T[N]:[description]` | `T12:替她擋住醉客` |
| 事件 (max entries) | 8 entries | Oldest mundane dropped first | — |

### Extended Fields (Optional, Core Identity)

| Field | Constraint | Description |
|-------|-----------|-------------|
| coreBackstory | ≤500 chars | Core background, preserved cross-scenario |
| defaultOutfit | 1-10 items | Default wardrobe, preserved cross-scenario |
| behaviorTendency | ≤40 chars | Social behavior patterns |
| likes | 1-3 keywords | Character preferences |
| dislikes | 1-3 keywords | Character aversions |
| npcTraits | ≤3 items, name ≤6 / desc ≤25 | Narrative hooks |
| dialogueExamples | 6 categories, each 40–120 chars | Voice reference samples |
| milestoneDirectives | Up to 7 keys, each ≤80 chars | Per-affection behavioral directives |

#### dialogueExamples Categories

| Key | Chinese Label | Description |
|-----|--------------|-------------|
| greeting | 打招呼 | How the NPC greets someone |
| excited | 興奮 | NPC in an excited or happy state |
| pleading | 懇求 | NPC begging or making a desperate request |
| angered | 憤怒 | NPC angry or upset |
| working | 工作中 | NPC speaking while doing their job |
| affectionate | 對玩家親暱 | NPC being affectionate toward the player |

Each example must be 40–120 Traditional Chinese characters. These are injected into the system prompt as part of the NPC's static identity, giving the LLM a concrete voice reference for generating personalized dialogue.

#### milestoneDirectives Keys

| Key | Threshold | Description |
|-----|-----------|-------------|
| n90 | ≤ -90% (敵對) | Deep hostility behavior |
| n50 | ≤ -50% (宿敵) | Active antagonism behavior |
| b30 | ≥ 30% | Warmth begins |
| b50 | ≥ 50% | Familiar / comfortable |
| b70 | ≥ 70% | Intimate |
| b90 | ≥ 90% | Devoted |
| b100 | = 100% | Absolute (milestone only, no mechanical gate) |

Each directive is ≤80 Traditional Chinese characters describing how the NPC's behavior/tone shifts at that affection threshold. Only the **most extreme active** directive is injected — e.g., at 75% affection, only the b70 directive appears. These are immutable core identity fields, never modified by the Utility Agent.

<!-- END TUNING: PROFILE FIELD SPECS -->

## Storage Format (JSON)

Used for LLM profile update I/O and cross-session import/export. Note: `affectionTier` and `lust` are computed at runtime — they are included in the LLM exchange format but NOT persisted in IndexedDB's `ProfileRecord`. `events` are stored separately in the `critical_events` IndexedDB store.

```json
{
  "npcId": "xiaoya",
  "name": "林小雅",
  "role": "舒壓技師（新手）",
  "personality": ["羞澀", "生疏", "順從"],
  "appearance": ["纖細", "白皙", "無辜大眼", "短髮", "大腿痣"],
  "outfit": ["緊身護士服", "領口微開", "精油漬"],
  "affection": 32,
  "affectionTier": "友善",
  "lust": "萌芽",
  "bottlenecks": {
    "b30": true,
    "b50": false,
    "b70": false,
    "b90": false
  },
  "npcRelations": {
    "manager": "hostile"
  },
  "events": [
    { "turn": 1, "description": "初次登場，職業微笑迎接" },
    { "turn": 12, "description": "替她擋住醉客，信任萌芽" },
    { "turn": 30, "description": "突破30%瓶頸，分享背景" }
  ],
  "dialogueExamples": {
    "greeting": "歡迎光臨～請問是第一次來嗎？我是小雅，今天由我為您服務，有什麼需要請儘管說喔。",
    "excited": "真的嗎！？太好了太好了！我就知道你一定會答應的，嘿嘿，那我們快走吧，我已經等不及了！",
    "pleading": "拜託……就這一次好不好？我真的不是故意的，你相信我嘛……如果你不幫我，我真的不知道該怎麼辦了……",
    "angered": "你到底在說什麼！？我哪裡做錯了？每次都是這樣，明明不是我的問題，為什麼總要我來承受！",
    "working": "好的，請您先趴下放鬆……肩膀這邊很僵硬呢，我加一點力道，如果太痛的話請告訴我。",
    "affectionate": "欸……你今天怎麼這麼早來？是不是想我了？騙人……才沒有開心呢。不過……謝謝你來看我。"
  },
  "milestoneDirectives": {
    "n50": "冷漠疏離，用敬語保持距離，對話簡短不帶感情",
    "b30": "偶爾露出真實表情，不再全程職業微笑，會小聲抱怨工作",
    "b50": "主動找話題聊天，會記住玩家的喜好，偶爾撒嬌",
    "b70": "私下用暱稱稱呼，分享不為人知的煩惱，吃醋反應明顯",
    "b90": "完全信任不設防，會為玩家做出超出職責的事，依賴感強烈"
  },
  "portraitId": "xiaoya",
  "lastUpdatedTurn": 42,
  "sourceScenario": "scenario_massage_parlor"
}
```

## Field Style Rules

### 性格 (Personality)
- 2-4 descriptive keywords, NOT sentences
- Focus on behavioral tendencies visible in interaction
- ✅ `羞澀, 生疏, 順從`
- ❌ `她是一個很害羞的女生` (sentence, not keywords)

### 外貌 (Appearance)
- Exactly 5 keywords
- Distinctive features first (scars, marks, unique traits)
- ✅ `大腿痣, 纖細, 白皙, 無辜大眼, 短髮`
- ❌ `漂亮, 可愛, 好看, 年輕, 女性` (generic, no distinguishing features)

### 穿著 (Outfit)
- Garment name(s) + current state
- Update only when changed (damage, undressing, wardrobe change)
- ✅ `緊身護士服, 領口微開, 精油漬`
- ❌ `穿著一件很緊的護士制服看起來很性感` (sentence, subjective)

### 事件 (Events)
- Terse: `T[N]:[subject + verb + outcome]`
- No dialogue, no long descriptions
- Keep the most significant events when at capacity (8 max)
- Drop priority: routine interactions < plot events < Hype events < bottleneck breakthroughs
- ✅ `T12:替她擋住醉客`
- ✅ `T30:突破30%瓶頸，分享背景`
- ❌ `T12:玩家勇敢地站起來擋在小雅和那個喝醉的客人之間` (too long)

### NPC關係 (Relations)
- Only list NPCs with meaningful attitude tags
- Valid attitudes: `ally` / `neutral` / `hostile`
- ✅ `manager:hostile, wolf:ally`
- ❌ `經理陳先生:她很討厭他因為他總是欺負她` (sentence, use ID not full name)

## Profile Lifecycle

| Event | Action |
|-------|--------|
| Pre-session Character Pick | Player picks from 3 LLM-generated character cards (or imports a Workshop profile). Profile saved to IndexedDB before session starts. Affection starts at 20% (中立), all bottlenecks locked. |
| NPC first appears in scene (no pre-created profile) | LLM creates profile with initial values from scenario context. Affection starts at scenario default (usually 10-15%). |
| Each turn during gameplay | Profile is NOT updated. Status Window tracks live state. |
| Every 5 Critical Events (auto) | System auto-updates profile: sync Affection/Lust, update 穿著 if changed, append events, update 瓶頸 status. |
| Session end (auto) | System auto-updates all profiles with pending Critical Events. |
| RECALL command | Display current stored profile. No modifications. |
| Player clicks 💾 Save | Export current profile as `.json` file using Storage Format. |
| New session with imported profile | Load profile, overlay onto newly generated NPC if matching. |

## Complete Display Example

```
===== NPC PROFILE =====
NPC_ID: xiaoya | 姓名: 林小雅 | 角色: 舒壓技師（新手）
性格: 羞澀, 生疏, 順從 | 外貌: 纖細, 白皙, 無辜大眼, 短髮, 大腿痣 | 穿著: 緊身護士服, 領口微開, 精油漬
Affection: 32% (友善) | Lust: 萌芽
瓶頸: 30%[✓] 50%[✗] 70%[✗] 90%[✗]
NPC關係: manager:hostile
事件: T1:初次登場迎接 | T12:替她擋住醉客 | T22:接受高額小費態度軟化 | T25:觸碰紅線被拒 | T28:玩家道歉她接受 | T30:突破30%瓶頸 | T38:主動靠近Lust升悶燒
========================
```
