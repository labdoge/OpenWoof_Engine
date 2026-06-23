# Localization Caps Registry

> **Purpose**: Single source of truth for every length cap, field limit, and token budget in DogeChat.
> Each entry lists the current zh-TW value, recommended values for en / zh-CN / ja, and where the cap is enforced.
>
> **Scaling Rationale**: Chinese characters are highly information-dense (~1 char = 1 semantic unit).
> English needs 2.5× the character count for equivalent meaning; Japanese 1.4× (kanji + kana mix);
> Simplified Chinese has the same density as Traditional Chinese.
> Token budgets: English 1.5×, Japanese 1.1×.

---

## How to Read This Document

| Column | Meaning |
|--------|---------|
| **Cap ID** | Stable identifier for this cap (matches constant name where applicable) |
| **Where Enforced** | File(s) and mechanism (code constant, validator, prompt template, form attribute) |
| **zh-TW** | Current value (Traditional Chinese — baseline) |
| **zh-CN** | Simplified Chinese (same density as zh-TW unless noted) |
| **ja** | Japanese (kanji + kana mix, 1.4× zh-TW for text fields) |
| **en** | English (2.5× zh-TW for text fields, 1.5× for token budgets) |
| **Unit** | chars / tokens / items / numeric |
| **Rationale** | Why this cap exists and why language values differ |

**Convention**: Where a value is the same across all languages, it is listed once in the zh-TW column and the other columns show `=`.

---

## §1 NPC Profile Field Limits (Text Length — Characters)

These caps control how much text fits in each NPC profile field. They are enforced in validators and form inputs.

| Cap ID | Field | zh-TW | zh-CN | ja | en | Unit | Where Enforced |
|--------|-------|-------|-------|----|----|------|----------------|
| `PROFILE.npcId` | NPC ID | 8 | = | = | = | chars | `validators.ts:49`, `character-workshop-form.ts:264` |
| `PROFILE.name` | 姓名 / 名前 / Name | 10 | = | 14 | 25 | chars | `validators.ts:60`, `character-workshop-form.ts:260` |
| `PROFILE.role` | 角色 / 役割 / Role | 15 | = | 21 | 38 | chars | `validators.ts:67`, `character-workshop-form.ts:268` |
| `PROFILE.personality[]` | 性格 / 性格 / Personality | 20 | = | 28 | 50 | chars each | `validators.ts:82` |
| `PROFILE.personality` | (count) | 2–4 | = | = | = | items | `validators.ts:75` |
| `PROFILE.appearance[]` | 外貌 / 外見 / Appearance | 20 | = | 28 | 50 | chars each | `validators.ts:100` |
| `PROFILE.appearance` | (count) | 5 | = | = | = | items | `validators.ts:93` |
| `PROFILE.outfit[]` | 穿著 / 服装 / Outfit | 20 | = | 28 | 50 | chars each | `validators.ts:118` |
| `PROFILE.outfit` | (count) | 2–4 | = | = | = | items | `validators.ts:111` |
| `PROFILE.npcRelations` | NPC關係 / NPC関係 / Relations | 45 | = | 63 | 113 | chars per entry | `validators.ts:159` |
| `PROFILE.npcRelations` | (count) | 4 | = | = | = | entries | `validators.ts:154` |
| `PROFILE.events[].desc` | 事件 / イベント / Event | 35 | = | 49 | 88 | chars | `validators.ts:190` |
| `PROFILE.events` | (count) | 8 | = | = | = | items | `validators.ts:175` |
| `PROFILE.coreBackstory` | 核心背景 / 背景 / Backstory | 400 | = | 560 | 1000 | chars | `validators.ts:206` (validator: 400), `constants.ts:911` (PROFILE_LIMITS: 500), `character-workshop-form.ts:296` (form: 500) |
| `PROFILE.defaultOutfit[]` | 預設服裝 / デフォルト服 / Default Outfit | 20 | = | 28 | 50 | chars each | `validators.ts:223` |
| `PROFILE.defaultOutfit` | (count) | 10 | = | = | = | items | `validators.ts:216`, `constants.ts:912` |
| `PROFILE.behaviorTendency` | 行為傾向 / 行動傾向 / Behavior | 120 | = | 168 | 300 | chars | `validators.ts:235` (validator: 120), `constants.ts:905` (PROFILE_LIMITS: 40), `character-workshop-form.ts:300` (form: 40) |
| `PROFILE.likes[]` | 喜好 / 好み / Likes | 24 | = | 34 | 60 | chars each | `validators.ts:252` |
| `PROFILE.likes` | (count) | 3 | = | = | = | items | `validators.ts:245`, `constants.ts:906` |
| `PROFILE.dislikes[]` | 厭惡 / 嫌い / Dislikes | 24 | = | 34 | 60 | chars each | `validators.ts:272` |
| `PROFILE.dislikes` | (count) | 3 | = | = | = | items | `validators.ts:265`, `constants.ts:907` |
| `PROFILE.npcTraits` | (count) | 3 | = | = | = | items | `validators.ts:285`, `constants.ts:908` |
| `PROFILE.npcTraits[].name` | 特質名 / 特性名 / Trait Name | 18 | = | 25 | 45 | chars | `validators.ts:296`, `character-workshop-form.ts:338` |
| `PROFILE.npcTraits[].desc` | 特質描述 / 特性説明 / Trait Desc | 75 | = | 105 | 188 | chars | `validators.ts:301`, `character-workshop-form.ts:339` |
| `PROFILE.dialogueEx[]` | 對話範例 / 台詞例 / Dialogue Example | 120 | = | 168 | 300 | chars each | `validators.ts:320` |
| `DIALOGUE_EXAMPLE_MIN` | (minimum) | 40 | = | 56 | 100 | chars | `constants.ts:708` |
| `DIALOGUE_EXAMPLE_MAX` | (maximum) | 120 | = | 168 | 300 | chars | `constants.ts:709` |

> **Note**: `PROFILE_LIMITS` in `constants.ts` and the actual validator in `validators.ts` have some mismatched values (e.g., behaviorTendency 40 vs 120, coreBackstory 500 vs 400). The validator is authoritative at runtime. These should be reconciled.

---

## §2 Scenario Field Limits (Text Length — Characters)

| Cap ID | Field | zh-TW | zh-CN | ja | en | Unit | Where Enforced |
|--------|-------|-------|-------|----|----|------|----------------|
| `SCENARIO.title` | 劇本標題 / シナリオ名 / Title | 30 | = | 42 | 75 | chars | `validators.ts:365`, `scenario-workshop-form.ts:347` |
| `SCENARIO.genre` | 類型 / ジャンル / Genre | 15 | = | 21 | 38 | chars | `validators.ts:372` |
| `SCENARIO.tone[]` | 基調 / トーン / Tone | 8 | = | 11 | 20 | chars each | `validators.ts:385` |
| `SCENARIO.tone` | (count) | 1–5 | = | = | = | items | `validators.ts:379` |
| `SCENARIO.overall_goal` | 劇本主軸 / 目標 / Goal | 100 | = | 140 | 250 | chars | `validators.ts:394` |
| `SCENARIO.worldview` | 世界設定 / 世界観 / Worldview | 300 | = | 420 | 750 | chars | `validators.ts:402` |
| `SCENARIO.adoption_rule` | 改編規則 / 改変ルール / Adoption Rule | 200 | = | 280 | 500 | chars | `validators.ts:411` |
| `SCENARIO.initial_character_count` | 初始角色數 | 1–5 | = | = | = | count | `validators.ts:418` |
| `SCENARIO.npc_pool` | NPC 生成池 | 1–8 | = | = | = | NPCs | `validators.ts:434–437` |
| `SCENARIO.npc_pool[].role` | 角色 / 役割 / Role | 15 | = | 21 | 38 | chars | `validators.ts:449` |
| `SCENARIO.npc_pool[].personality[]` | 性格 | 20 | = | 28 | 50 | chars each | `validators.ts:458` |
| `SCENARIO.npc_pool[].personality` | (count) | 3 | = | = | = | items | `validators.ts:456` |
| `SCENARIO.npc_pool[].appearance[]` | 外觀 | 20 | = | 28 | 50 | chars each | `validators.ts:469` |
| `SCENARIO.npc_pool[].outfit[]` | 服裝 | 20 | = | 28 | 50 | chars each | `validators.ts:480` |
| `SCENARIO.npc_pool[].wardrobe` | 服裝規則 / 服装ルール / Wardrobe Rules | 100 | = | 140 | 250 | chars | `validators.ts:487` |
| `SCENARIO.npc_pool[].goal` | 個人目標 / 個人目標 / Personal Goal | 30 | = | 42 | 75 | chars | `validators.ts:495` |
| `SCENARIO.player.identity` | 玩家身份 / プレイヤー / Identity | 30 | = | 42 | 75 | chars | `validators.ts:509` |
| `SCENARIO.player.traits[]` | 初始特質 | 8 | = | 11 | 20 | chars each | `validators.ts:518` |
| `SCENARIO.player.outfit[]` | 服裝 | 10 | = | 14 | 25 | chars each | `validators.ts:535` |
| `SCENARIO.player.backstory` | 玩家背景 / プレイヤー背景 / Backstory | 200 | = | 280 | 500 | chars | `validators.ts:544` |
| `SCENARIO.scene.location` | 地點 / ロケーション / Location | 20 | = | 28 | 50 | chars | `validators.ts:557` |
| `SCENARIO.scene.description` | 場景描述 / シーン説明 / Description | 150 | = | 210 | 375 | chars | `validators.ts:562` |
| `SCENARIO.scene.npcs_present` | 在場NPC | 5 | = | = | = | count | `validators.ts:567` |
| `SCENARIO.scene.opening` | 開場敘述 / オープニング / Opening | 300 | = | 420 | 750 | chars | `validators.ts:572` |
| `SCENARIO.locations` | (count) | 1–12 | = | = | = | locations | `validators.ts:581–584` |
| `SCENARIO.locations[].name` | 地點名 / 場所名 / Location Name | 20 | = | 28 | 50 | chars | `validators.ts:596` |
| `SCENARIO.locations[].desc` | 地點描述 / 場所説明 / Location Desc | 100 | = | 140 | 250 | chars | `validators.ts:601` |
| `SCENARIO.locations[].connections` | (count) | 6 | = | = | = | items | `validators.ts:604` |
| `SCENARIO.locations[].parent` | 上層 / 親 / Parent | 20 | = | 28 | 50 | chars | `validators.ts:607` |
| `SCENARIO.playSetting[][]` | 遊玩設定 / プレイ設定 / Play Setting | 50 | = | 70 | 125 | chars each | `validators.ts:627` |
| `SCENARIO.playSetting[]` | (count per category) | 5 | = | = | = | items | `validators.ts:625` |
| `SCENARIO.pacing_drivers` | (count) | 15 | = | = | = | items | `validators.ts:642` |
| `SCENARIO.pacing[].direction` | 節奏方向 / ペーシング / Direction | 80 | = | 112 | 200 | chars | `validators.ts:657` |
| `SCENARIO.bq_directions` | (count) | 12 | = | = | = | items | `validators.ts:669` |
| `SCENARIO.bq[].direction` | 任務方向 / クエスト方向 / Quest Dir | 100 | = | 140 | 250 | chars | `validators.ts:684` |
| `SCENARIO.bg_npcs` | (count) | 8 | = | = | = | NPCs | `validators.ts:696` |
| `SCENARIO.bg_npcs[].name` | 背景NPC名 | 8 | = | 11 | 20 | chars | `validators.ts:705` |
| `SCENARIO.bg_npcs[].role` | 背景NPC角色 | 15 | = | 21 | 38 | chars | `validators.ts:708` |
| `SCENARIO.bg_npcs[].desc` | 背景NPC描述 | 50 | = | 70 | 125 | chars | `validators.ts:711` |

---

## §3 Prompt Template Caps (LLM Output — Characters)

These caps are embedded in prompt documents sent to the LLM. They tell the LLM how long its output fields should be.

| Cap ID | Field | zh-TW | zh-CN | ja | en | Unit | Where Enforced |
|--------|-------|-------|-------|----|----|------|----------------|
| `PROMPT.story_arc_sentence` | 故事主線 sentence | ≤80 | = | ≤112 | ≤200 | chars | `documents/utility_compress.md` |
| `PROMPT.story_arc` | 故事主線 (count) | 3–4 | = | = | = | sentences | `documents/utility_compress.md` |
| `PROMPT.pivotal_moments` | 關鍵時刻 (count) | 4–6 | = | = | = | items | `documents/utility_compress.md` |
| `PROMPT.critical_event_desc` | 關鍵事件描述 | ≤50 | = | ≤70 | ≤125 | chars | `documents/utility_eval_base.md`, `documents/commands.md` |
| `PROMPT.critical_event_scene` | 事件場景名 | ≤15 | = | ≤21 | ≤38 | chars | `documents/template_character_memory.md` |
| `PROMPT.quest_completion_reason` | 任務完成理由 | ≤30 | = | ≤42 | ≤75 | chars | `documents/utility_eval_base.md` |
| `PROMPT.generation_hint` | 生成提示 | ≤30 | = | ≤42 | ≤75 | chars | `documents/utility_eval_base.md` |
| `PROMPT.quest_title` | 任務標題 | 2–6 | = | 3–8 | 5–15 | chars | `documents/utility_quest_gen.md` |
| `PROMPT.quest_request` | 任務請求 | ≤40 | = | ≤56 | ≤100 | chars | `documents/utility_quest_gen.md` |
| `PROMPT.quest_objective` | 任務目標 | ≤50 | = | ≤70 | ≤125 | chars | `documents/utility_quest_gen.md` |
| `PROMPT.trait_name` | 特質名 | ≤6 | = | ≤8 | ≤15 | chars | `documents/utility_trait_gen.md` |
| `PROMPT.trait_desc` | 特質描述 | ≤25 | = | ≤35 | ≤63 | chars | `documents/utility_trait_gen.md` |
| `PROMPT.status.location` | 場景地點 | ≤15 | = | ≤21 | ≤38 | chars | `documents/utility_status_extract.md` |
| `PROMPT.status.time` | 場景時間 | ≤8 | = | ≤11 | ≤20 | chars | `documents/utility_status_extract.md` |
| `PROMPT.status.locationNote` | 場景備註 | ≤30 | = | ≤42 | ≤75 | chars | `documents/utility_status_extract.md` |
| `PROMPT.status.mood` | NPC心情 | ≤40 | = | ≤56 | ≤100 | chars | `documents/utility_status_extract.md` |
| `PROMPT.status.appearance[]` | NPC外貌 | ≤6 | = | ≤8 | ≤15 | chars each | `documents/utility_status_extract.md` |
| `PROMPT.status.appearance` | (count) | 4 | = | = | = | items | `documents/utility_status_extract.md` |
| `PROMPT.status.outfit[]` | NPC穿著 | ≤6 | = | ≤8 | ≤15 | chars each | `documents/utility_status_extract.md` |
| `PROMPT.status.outfit` | (count) | 5 | = | = | = | items | `documents/utility_status_extract.md` |
| `PROMPT.memory_budget` | 記憶注入 per NPC | ≤500 | = | ≤700 | ≤1250 | chars | `documents/template_character_memory.md` |
| `PROMPT.memory_npcs` | (max NPCs with memory) | 3 | = | = | = | NPCs | `documents/template_character_memory.md` |
| `PROMPT.memory_events` | (max events per NPC) | 10 | = | = | = | events | `documents/template_character_memory.md` |
| `PROMPT.suggestion` | 輸入建議 | ≤40 | = | ≤56 | ≤100 | chars | `constants.ts:801` |

---

## §4 Scene Output Length (Characters)

| Cap ID | Scene Preset | zh-TW | zh-CN | ja | en | Unit | Where Enforced |
|--------|-------------|-------|-------|----|----|------|----------------|
| `SCENE.brief.min` | Brief min | 200 | = | 280 | 500 | chars | `constants.ts:518` |
| `SCENE.brief.max` | Brief max | 600 | = | 840 | 1500 | chars | `constants.ts:518` |
| `SCENE.standard.min` | Standard min | 300 | = | 420 | 750 | chars | `constants.ts:519` |
| `SCENE.standard.max` | Standard max | 1000 | = | 1400 | 2500 | chars | `constants.ts:519` |
| `SCENE.detailed.min` | Detailed min | 500 | = | 700 | 1250 | chars | `constants.ts:520` |
| `SCENE.detailed.max` | Detailed max | 1500 | = | 2100 | 3750 | chars | `constants.ts:520` |

---

## §5 Token Budgets (LLM maxTokens)

Token budgets are less language-sensitive than character counts, but English/Japanese text generates more tokens per semantic unit. Scale 1.5× for en, 1.1× for ja.

| Cap ID | Purpose | zh-TW | zh-CN | ja | en | Unit | Where Enforced |
|--------|---------|-------|-------|----|----|------|----------------|
| `CONTEXT.RECAP_MAX_TOKENS` | Compression output | 800 | = | 880 | 1200 | tokens | `constants.ts:231` |
| `UA.EVAL_MAX_TOKENS` | Hype/Lust eval | 640 | = | 704 | 960 | tokens | `utility-agent.ts:174` |
| `UA.COMPRESS_MAX_TOKENS` | Compression call (2× recap) | 1600 | = | 1760 | 2400 | tokens | `utility-agent.ts:631` |
| `UA.PROFILE_UPDATE_TOKENS` | NPC Profile update | 1024 | = | 1126 | 1536 | tokens | `utility-agent.ts:761` |
| `UA.NPC_INTERACTION_TOKENS` | NPC-to-NPC eval | 384 | = | 422 | 576 | tokens | `utility-agent.ts:971` |
| `UA.INITIAL_AFFECTION_TOKENS` | Initial affection | 200 | = | 220 | 300 | tokens | `utility-agent.ts:1153` |
| `UA.STATUS_BASE_TOKENS` | Status extract base | 400 | = | 440 | 600 | tokens | `constants.ts:539` |
| `UA.STATUS_PER_NPC_TOKENS` | Status per extra NPC | 150 | = | 165 | 225 | tokens | `constants.ts:541` |
| `UA.CONSISTENCY_TOKENS` | Interaction consistency | 512 | = | 563 | 768 | tokens | `utility-agent.ts:1491` |
| `UA.PROGRESSION_TOKENS` | Progression update | 512 | = | 563 | 768 | tokens | `utility-agent.ts:1528` |
| `PRESET.quick` | Quick gameplay | 1024 | = | 1126 | 1536 | tokens | `constants.ts:615` |
| `PRESET.standard` | Standard gameplay | 2048 | = | 2253 | 3072 | tokens | `constants.ts:616` |
| `PRESET.detailed` | Detailed gameplay | 4096 | = | 4506 | 6144 | tokens | `constants.ts:617` |
| `PRESET.immersive` | Immersive gameplay | 8192 | = | 9011 | 12288 | tokens | `constants.ts:618` |
| `PRESET.min` | Custom preset floor | 256 | = | = | = | tokens | `constants.ts:626` |
| `PRESET.max` | Custom preset ceiling | 16384 | = | = | = | tokens | `constants.ts:627` |
| `SCENE.brief.floor` | Brief token floor | 512 | = | 563 | 768 | tokens | `constants.ts:532` |
| `SCENE.standard.floor` | Standard token floor | 768 | = | 845 | 1152 | tokens | `constants.ts:533` |
| `SCENE.detailed.floor` | Detailed token floor | 1280 | = | 1408 | 1920 | tokens | `constants.ts:534` |
| `THINKING_BUDGET` | Extended thinking | 1024 | = | = | = | tokens | `constants.ts:498` |
| `QUEST.MAX_TOKENS` | Quest card generation | 512 | = | 563 | 768 | tokens | `constants.ts:116` |
| `CHARGEN.MAX_TOKENS` | Character gen Phase 1 | 6144 | = | 6758 | 9216 | tokens | `constants.ts:715` |
| `CHARGEN.DIALOGUE_TOKENS` | Character gen Phase 2 | 1024 | = | 1126 | 1536 | tokens | `constants.ts:717` |
| `SUMMON.PRESET_TOKENS` | Summon preset gen | 256 | = | 282 | 384 | tokens | `constants.ts:727` |
| `SUGGESTION.MAX_TOKENS` | Input suggestion gen | 128 | = | 141 | 192 | tokens | `constants.ts:802` |
| `WORKSHOP.MAIN_TOKENS` | Workshop generation | 8192 | = | 9011 | 12288 | tokens | `constants.ts:636` |
| `WORKSHOP.DIRECTIVE_TOKENS` | Workshop directives | 6144 | = | 6758 | 9216 | tokens | `constants.ts:641` |
| `WORKSHOP.LORE_TOKENS` | Workshop lore | 8192 | = | 9011 | 12288 | tokens | `constants.ts:645` |
| `RULE_RESOLVER.TOKENS` | Rule resolution | 1024 | = | 1126 | 1536 | tokens | `constants.ts:969` |
| `CONSISTENCY_RESOLVER.TOKENS` | Consistency resolver | 2048 | = | 2253 | 3072 | tokens | `constants.ts:978` |
| `CROSS_SCENARIO.BUDGET` | Cross-scenario prose | 500 | = | 550 | 750 | tokens | `constants.ts:989` |
| `CROSS_SCENARIO.MIN` | Cross-scenario min | 100 | = | = | = | tokens | `constants.ts:991` |
| `CROSS_SCENARIO.MAX` | Cross-scenario max | 2000 | = | = | = | tokens | `constants.ts:993` |
| `CROSS_SCENARIO.SUMMARY_TOKENS` | Cross-scenario summary | 512 | = | 563 | 768 | tokens | `constants.ts:1000` |
| `LORE.BUDGET_TOKENS` | Lore injection total | 2000 | = | 2200 | 3000 | tokens | `constants.ts:1016` |
| `LORE.RELATIONSHIP_BUDGET` | Lore relationship pull | 1500 | = | 1650 | 2250 | tokens | `constants.ts:1011` |

---

## §6 Compression & Context Thresholds (Language-Independent)

These are reply-count or multiplier-based — no language scaling needed.

| Cap ID | Value | Unit | Where Enforced |
|--------|-------|------|----------------|
| `CONTEXT.COMPRESSION_SCHEDULED_MIN` | 6 | replyCount | `constants.ts:227` |
| `CONTEXT.COMPRESSION_IMMEDIATE` | 8 | replyCount | `constants.ts:228` |
| `CONTEXT.HARD_CAP` | 10 | replyCount | `constants.ts:229` |
| `CONTEXT.POST_COMPRESSION_KEEP` | 5 | replyCount | `constants.ts:230` |
| `CONTEXT.TOKEN_SCHEDULED_MULT` | 12× | multiplier | `constants.ts:233` |
| `CONTEXT.TOKEN_IMMEDIATE_MULT` | 16× | multiplier | `constants.ts:234` |
| `CONTEXT.TOKEN_SCHEDULED_FALLBACK` | 18000 | tokens | `constants.ts:236` |
| `CONTEXT.TOKEN_IMMEDIATE_FALLBACK` | 24000 | tokens | `constants.ts:237` |

---

## §7 Game Mechanics (Language-Independent)

| Cap ID | Value | Unit | Where Enforced |
|--------|-------|------|----------------|
| `AFFECTION_RANGE` | -100 to 100 | numeric | `validators.ts` |
| `INITIAL_AFFECTION_CLAMP` | -60 to 60 | numeric | `constants.ts:328` |
| `DEFAULT_NPC_AFFECTION` | 20 | numeric | `constants.ts:241` |
| `BOTTLENECK_GATES` | 30, 50, 70, 90 | % | `validators.ts:95` |
| `XP_RANGE` | 0–29 | numeric | `validators.ts` |
| `XP_PER_LEVEL_BASE` | 10 | XP | `constants.ts:253` |
| `XP_PER_LEVEL_MID` | 20 | XP | `constants.ts:254` |
| `XP_PER_LEVEL_HIGH` | 30 | XP | `constants.ts:255` |
| `CRITICAL_EVENTS.PROFILE_UPDATE_TRIGGER` | 5 | events | `constants.ts:245` |
| `PACING.THRESHOLD` | 10 | counter | `constants.ts:139` |
| `PACING.WINDOW_TURNS` | 3 | turns | `constants.ts:140` |
| `CLIMACTIC_COOLDOWN_TURNS` | 3 | turns | `constants.ts:590` |
| `UNREGISTERED_NPC.THRESHOLD` | 3 | turns | `constants.ts:733` |
| `SUMMON.TIMEOUT_TURNS` | 5 | turns | `constants.ts:726` |
| `MAX_PLAYER_TRAITS` | 15 | traits | `constants.ts:749` |
| `UPGRADE_THRESHOLD` | 12 | traits | `constants.ts:751` |
| `LORE.AFTERGLOW_DURATION` | 4 | turns | `constants.ts:1020` |
| `LORE.UA_CATALOG_MAX` | 20 | entries | `constants.ts:1024` |
| `LORE.UA_MAX_SUGGESTIONS` | 3 | entries | `constants.ts:1026` |
| `LORE.PROMOTE_RATIO` | 0.7 | ratio | `constants.ts:1018` |
| `ARCANUM_ICONIC_FEATURES_MAX` | 20 | items | `constants.ts:961` |
| `ARCANUM_RULES_MAX` | 15 | items | `constants.ts:963` |
| `ARCANUM_METAPHYSICS_MAX` | 10 | items | `constants.ts:965` |
| `AUTO_CONTINUE_MAX_DEFAULT` | 10 | turns | `constants.ts:442` |
| `BLACKLIST_MAX_RERUNS` | 2 | attempts | `constants.ts:436` |
| `API_RETRY.MAX_RETRIES` | 3 | attempts | `constants.ts:664` |
| `QUEST.CARD_COUNT` | 3 | cards | `constants.ts:114` |
| `CHARACTER_GEN.CARD_COUNT` | 3 | cards | `constants.ts:713` |
| `SUMMON.PRESET_COUNT` | 4 | presets | `constants.ts:724` |
| `SUGGESTION.COUNT` | 3 | items | `constants.ts:800` |
| `PRESET_LIMITS.MAX_CUSTOM_PRESETS` | 10 | presets | `constants.ts:629` |

---

## §8 Miscellaneous UI Caps

| Cap ID | Value | zh-TW | zh-CN | ja | en | Unit | Where Enforced |
|--------|-------|-------|-------|----|----|------|----------------|
| `PRESET_LIMITS.NAME_MAX_LENGTH` | Preset name | 20 | = | 28 | 50 | chars | `constants.ts:625` |
| `CHAR_PICKER.CUSTOM_PROMPT` | Custom prompt | 200 | = | 280 | 500 | chars | `character-picker.ts:148` |
| `TRAIT_PICKER.HINT` | Trait gen hint | 80 | = | 112 | 200 | chars | `trait-picker-modal.ts:134` |

---

## §9 Localized Field Name Reference

Below are the recommended translations for field names used in prompts, validators, and UI.

| Key | zh-TW (繁體中文) | zh-CN (简体中文) | ja (日本語) | en (English) |
|-----|---------|---------|------|------|
| npcId | NPC代碼 | NPC代码 | NPC_ID | NPC ID |
| name | 姓名 | 姓名 | 名前 | Name |
| role | 角色 | 角色 | 役割 | Role |
| personality | 性格 | 性格 | 性格 | Personality |
| appearance | 外貌 | 外貌 | 外見 | Appearance |
| outfit | 穿著 | 穿着 | 服装 | Outfit |
| defaultOutfit | 預設服裝 | 预设服装 | デフォルト服装 | Default Outfit |
| coreBackstory | 核心背景 | 核心背景 | コア背景 | Core Backstory |
| behaviorTendency | 行為傾向 | 行为倾向 | 行動傾向 | Behavior Tendency |
| likes | 喜好 | 喜好 | 好み | Likes |
| dislikes | 厭惡 | 厌恶 | 嫌い | Dislikes |
| npcTraits | 敘事特質 | 叙事特质 | ナラティブ特性 | Narrative Traits |
| traitName | 特質名 | 特质名 | 特性名 | Trait Name |
| traitDescription | 特質描述 | 特质描述 | 特性説明 | Trait Description |
| dialogueExamples | 對話範例 | 对话范例 | 台詞例 | Dialogue Examples |
| npcRelations | NPC關係 | NPC关系 | NPC関係 | NPC Relations |
| events | 事件 | 事件 | イベント | Events |
| affection | 好感度 | 好感度 | 好感度 | Affection |
| hype | 情緒張力 | 情绪张力 | 感情テンション | Hype |
| lust | 慾望張力 | 欲望张力 | 欲望テンション | Lust |
| title | 劇本標題 | 剧本标题 | シナリオ名 | Title |
| genre | 類型 | 类型 | ジャンル | Genre |
| tone | 基調 | 基调 | トーン | Tone |
| overall_goal | 劇本主軸 | 剧本主轴 | メインゴール | Overall Goal |
| worldview | 世界設定 | 世界设定 | 世界観 | Worldview |
| adoption_rule | 改編規則 | 改编规则 | 改変ルール | Adoption Rule |
| location | 地點 | 地点 | 場所 | Location |
| description | 描述 | 描述 | 説明 | Description |
| backstory | 背景 | 背景 | 背景 | Backstory |
| identity | 身份 | 身份 | アイデンティティ | Identity |
| wardrobe_rules | 服裝規則 | 服装规则 | 服装ルール | Wardrobe Rules |
| personal_goal | 個人目標 | 个人目标 | 個人目標 | Personal Goal |
| opening_context | 開場敘述 | 开场叙述 | オープニング | Opening Context |
| pacing_direction | 節奏方向 | 节奏方向 | ペーシング方向 | Pacing Direction |
| quest_direction | 任務方向 | 任务方向 | クエスト方向 | Quest Direction |
| critical_event | 關鍵事件 | 关键事件 | クリティカルイベント | Critical Event |
| scene | 場景 | 场景 | シーン | Scene |
| quest_title | 任務標題 | 任务标题 | クエスト名 | Quest Title |
| quest_request | 任務請求 | 任务请求 | クエスト依頼 | Quest Request |
| quest_objective | 任務目標 | 任务目标 | クエスト目標 | Quest Objective |

### Hype Tier Names

| Key | zh-TW | zh-CN | ja | en |
|-----|-------|-------|----|----|
| hype_strong_neg | 強烈負面 | 强烈负面 | 強い否定 | Strongly Negative |
| hype_mild_neg | 輕微負面 | 轻微负面 | やや否定 | Mildly Negative |
| hype_neutral | 平淡 | 平淡 | 平静 | Neutral |
| hype_mild_pos | 輕微正面 | 轻微正面 | やや肯定 | Mildly Positive |
| hype_strong_pos | 強烈正面 | 强烈正面 | 強い肯定 | Strongly Positive |

### Lust Tier Names

| Key | zh-TW | zh-CN | ja | en |
|-----|-------|-------|----|----|
| lust_dormant | 休眠 | 休眠 | 休眠 | Dormant |
| lust_budding | 萌芽 | 萌芽 | 芽生え | Budding |
| lust_smolder | 悶燒 | 闷烧 | くすぶり | Smoldering |
| lust_burning | 燃燒 | 燃烧 | 燃焼 | Burning |
| lust_craving | 貪婪 | 贪婪 | 渇望 | Craving |

### Affection Tier Names

| Key | zh-TW | zh-CN | ja | en |
|-----|-------|-------|----|----|
| aff_hostile | 敵對 | 敌对 | 敵対 | Hostile |
| aff_nemesis | 宿敵 | 宿敌 | 宿敵 | Nemesis |
| aff_wary | 警戒 | 警戒 | 警戒 | Wary |
| aff_neutral | 中立 | 中立 | 中立 | Neutral |
| aff_friendly | 友善 | 友善 | 友好 | Friendly |
| aff_trust | 信任 | 信任 | 信頼 | Trust |
| aff_devoted_love | 摯愛 | 挚爱 | 深愛 | Devoted Love |
| aff_dedication | 獻身 | 献身 | 献身 | Dedication |

### Quest Theme Names

| Key | zh-TW | zh-CN | ja | en |
|-----|-------|-------|----|----|
| theme_trust | 信任考驗 | 信任考验 | 信頼の試練 | Trust Trial |
| theme_emotion | 情感突破 | 情感突破 | 感情の突破 | Emotional Breakthrough |
| theme_adventure | 共同冒險 | 共同冒险 | 共同冒険 | Shared Adventure |
| theme_sacrifice | 犧牲奉獻 | 牺牲奉献 | 犠牲と献身 | Sacrifice |

### Trait Categories

| Key | zh-TW | zh-CN | ja | en |
|-----|-------|-------|----|----|
| cat_social | 社交 | 社交 | 社交 | Social |
| cat_physical | 體能 | 体能 | 体力 | Physical |
| cat_mental | 心智 | 心智 | 知力 | Mental |
| cat_street | 江湖 | 江湖 | 裏社会 | Street |
| cat_special | 特殊 | 特殊 | 特殊 | Special |

### Dialogue Example Categories

| Key | zh-TW | zh-CN | ja | en |
|-----|-------|-------|----|----|
| dial_greeting | 打招呼 | 打招呼 | 挨拶 | Greeting |
| dial_excited | 興奮 | 兴奋 | 興奮 | Excited |
| dial_pleading | 懇求 | 恳求 | 懇願 | Pleading |
| dial_angered | 憤怒 | 愤怒 | 怒り | Angered |
| dial_working | 工作中 | 工作中 | 仕事中 | Working |
| dial_affectionate | 對玩家親暱 | 对玩家亲昵 | 親愛 | Affectionate |

### NPC Stance Names

| Key | zh-TW | zh-CN | ja | en |
|-----|-------|-------|----|----|
| stance_wary | 警戒 | 警戒 | 警戒 | Wary |
| stance_neutral | 中立 | 中立 | 中立 | Neutral |
| stance_curious | 好奇 | 好奇 | 好奇 | Curious |
| stance_hostile | 敵意 | 敌意 | 敵意 | Hostile |

### Dice Result Display

| Key | zh-TW | zh-CN | ja | en |
|-----|-------|-------|----|----|
| dice_success | 成功 | 成功 | 成功 | Success |
| dice_failure | 失敗 | 失败 | 失敗 | Failure |

### Portrait Emotion Labels

| Key | zh-TW | zh-CN | ja | en |
|-----|-------|-------|----|----|
| emo_default | 預設 | 预设 | デフォルト | Default |
| emo_happy | 開心 | 开心 | 嬉しい | Happy |
| emo_embarrassed | 害羞 | 害羞 | 恥ずかしい | Embarrassed |
| emo_angry | 生氣 | 生气 | 怒り | Angry |
| emo_lustful | 情慾 | 情欲 | 色気 | Lustful |
| emo_scared | 害怕 | 害怕 | 怖い | Scared |
| emo_tender | 溫柔 | 温柔 | 優しい | Tender |

---

## §10 Prompt Document Localization Requirements

Each prompt document in `documents/` contains Chinese text that would need a localized variant per language.
Below is the list of prompt files requiring locale-specific versions:

| Prompt File | Contains | Localization Strategy |
|-------------|----------|----------------------|
| `documents/core.md` | Narrative rules, output format instructions | Full translation needed |
| `documents/erotic.md` | Mature content rules and examples | Full translation needed |
| `documents/commands.md` | Player command definitions, profile format | Full translation needed |
| `documents/first_turn.md` | First turn generation rules | Full translation needed |
| `documents/utility_eval_base.md` | UA eval instructions, JSON schema | Full translation; field limits per §3 |
| `documents/utility_compress.md` | Compression prompt, output limits | Full translation; limits per §3 |
| `documents/utility_profile_update.md` | Profile update instructions | Full translation |
| `documents/utility_status_extract.md` | Status JSON schema, field limits | Full translation; limits per §3 |
| `documents/utility_initial_affection.md` | Affection inference prompt | Full translation |
| `documents/utility_quest_gen.md` | Quest card generation prompt | Full translation; limits per §3 |
| `documents/utility_trait_gen.md` | Trait generation prompt | Full translation; limits per §3 |
| `documents/template_character_profile.md` | NPC profile template | Full translation |
| `documents/template_character_memory.md` | Critical event memory template | Full translation |
| `documents/workshop_character.md` | Character workshop AI prompt | Full translation |
| `documents/workshop_scenario.md` | Scenario workshop AI prompt | Full translation |
| `documents/workshop_arcanum.md` | Arcanum workshop AI prompt | Full translation |
| `documents/rule_resolution.md` | Rule resolver prompt | Full translation |
| `documents/consistency_resolution.md` | Consistency resolver prompt | Full translation |

**Recommended structure**: `documents/{lang}/` subfolders (e.g., `documents/en/core.md`, `documents/ja/core.md`).
The current files serve as `zh-TW` baseline and can remain in place or be moved to `documents/zh-TW/`.

---

## Appendix A: Hardcoded Strings Audit (Not in Locale)

The following user-visible strings are hardcoded in source code and NOT managed by `src/locale/zh-TW.ts`.
These must be migrated to the locale system before multi-language support is possible.

### A.1 Workshop Form Labels & Placeholders

**`src/ui/scenario-workshop-form.ts`** (~25 strings):
- Form labels: `角色`, `性格`, `外觀`, `服裝`, `態度`, `個人目標`, `名稱`, `描述`, `威脅等級`, `連接地點`, `觸發類型`, `名字`, `角色`, `描述`
- Card headers: `NPC ${index+1}`, `地點 ${index+1}`, `節奏 ${index+1}`, `背景NPC ${index+1}`
- Select options: `— 選擇類型 —`, `自訂`, placeholders (`自訂類型`, `劇本主軸`, `世界設定`, `角色改編規則`, `玩家身份`, `圖片路徑或 URL`, `卡片圖片路徑`)
- Buttons: `選擇`
- Badge: `內建`
- AI summary: `+${n} 地點`, `+${n} 節奏`, `+${n} 任務方向`

**`src/ui/character-workshop-form.ts`** (~15 strings):
- Emotion labels: `預設`, `開心`, `害羞`, `生氣`, `情慾`, `害怕`, `溫柔`
- Dialogue labels: `打招呼`, `興奮`, `懇求`, `憤怒`, `工作中`, `親暱`
- Placeholders: `2-4 字`, `≤8 ASCII`, `≤15 字`, `輸入性格關鍵詞`, `身材、髮型、髮色、膚色、特徵`, `跨劇本預設服裝`, `當前服裝`, `≤500 字`, `≤40 字`, `喜好`, `厭惡`, `特質名 ≤18字`, `描述 ≤75字`, `40-120 字`
- Fallbacks: `(unnamed)`

**`src/ui/workshop-shared.ts`** (~9 strings):
- `AI 助手`, `送出`, `移除` (tooltip), `世界觀參考 (Arcanum)`, `— 不使用 —`, `不使用世界觀`, `批次匯入圖片`

**`src/ui/arcanum-workshop.ts`** (~8 strings):
- `新增分類...`, prompt() dialogs (`輸入自訂類型：`, `輸入新分類名稱：`, `輸入自訂次要類型：`, `輸入自訂時代：`)
- Fallbacks: `(untitled)`, `No modules registered`

### A.2 Workshop Validator Error Messages

**`src/workshop/validators.ts`** (~80 strings):
All validation error messages (e.g., `'缺少 npcId'`, `'name 超過 10 字'`, `'JSON 不是有效的物件'`) are hardcoded Chinese.
These are shown to users in the workshop system info panel.

### A.3 Workshop Error Suffixes

**`src/workshop/character-workshop.ts`** & **`scenario-workshop.ts`**:
- `'無效的 JSON 格式'`, `'JSON 解析失敗'`, `'回應中未找到 JSON 代碼塊'`
- `[SYSTEM: Profile/Scenario JSON 驗證失敗。請修正以下問題...]`
- `Error: ${msg}` prefix

### A.4 LLM Prompt Strings Hardcoded in TypeScript

**`src/orchestrator/module-injector.ts`** (~20 strings):
- NPC identity labels: `姓名:`, `角色:`, `性格:`, `外貌:`, `行為傾向:`, `喜好:`, `厭惡:`, `對話範例:`, `打招呼`, `興奮`, `懇求`, `憤怒`, `工作中`, `對玩家親暱`
- State labels: `不在場`, `關係:`, `氛圍:`, `在場:`, `狀態:`
- Player labels: `姓名:`, `性別:`, `年齡:`, `外貌:`, `性格:`, `身份:`, `背景:`
- Muted NPC instruction: `在場但不說話不行動，可被簡短提及`

**`src/agents/utility-agent.ts`**:
- Eval labels: `喜好:`, `厭惡:`, `傾向:`
- Compression labels: `姓名:`, `身份:`, `背景:`
- Full inline system prompt: `mergeProgressionIntoBackstory()` (lines 1515–1522)

**`src/agents/character-generator.ts`**:
- Stance definitions: `警戒`, `中立`, `好奇`, `敵意`
- Dialogue categories: `打招呼`, `興奮`, `懇求`, `憤怒`, `工作中`, `對玩家親暱`
- Example values in prompt: `表面冷淡但會默默照顧人`, `口是心非`, etc.

**`src/orchestrator/orchestrator.ts`**:
- Dice display: `成功` / `失敗`
- Ghost summon: `PLOT:以沉浸式的方式、在合適的時機引入「${name}」`

**`src/modules/builtins/erotic-hooks.ts`**:
- 3 pacing driver direction strings (full Chinese sentences)
- 4 bottleneck quest direction strings (full Chinese sentences)

### A.5 English Strings Visible to Users

| File | Strings |
|------|---------|
| `src/ui/debug-console.ts` | `Debug Console`, `Copy`, `Clear`, `Copied!` |
| `src/ui/analytics-panel.ts` | `Hype`, `Lust` (section headings) |
| `src/ui/memory-viewer.ts` | `title="Delete"` |
| `src/ui/location-journal.ts` | `aria-label="Close"` |
| `src/ui/scenario-workshop-form.ts` | `safe`, `low`, `medium`, `high` (threat level options) |

---

## Appendix B: Known Value Mismatches

During the audit, the following discrepancies between `constants.ts` PROFILE_LIMITS and the actual validator in `validators.ts` were found:

| Field | `constants.ts` PROFILE_LIMITS | `validators.ts` actual | Resolution |
|-------|------------------------------|----------------------|------------|
| `behaviorTendency` | 40 chars | 120 chars | Validator is authoritative — reconcile constants |
| `coreBackstory` | 500 chars | 400 chars | Validator is authoritative — reconcile constants |
| `npcTraits[].name` | 6 chars | 18 chars | Validator is authoritative — form uses 18 |
| `npcTraits[].desc` | 25 chars | 75 chars | Validator is authoritative — form uses 75 |

These should be unified before implementing locale-aware cap loading.
