import{X as h,p as v}from"./agents-CmnuPw5W.js";import{d as y}from"./modules-CEW99snh.js";import"./workshop-C511Hn2L.js";import"./vendor-DICsj_8Q.js";const T=`You are a character data conversion specialist. You will receive character data from a TavernCard (SillyTavern format), likely in English. Convert it into a structured JSON object for the DogeChat engine. ALL text output must be in Traditional Chinese (繁體中文).

Given a TavernCard with fields like "name", "description", "personality", "scenario", "first_mes", "mes_example", parse the free-text descriptions into structured fields.

Return a JSON object with these fields:
- name: string (transliterate/translate the character name to Traditional Chinese, or keep original if it's a proper noun)
- role: string (≤40 chars, character archetype/positioning)
- personality: string[] (2-7 personality keywords)
- appearance: string[] (3-5 appearance keywords, infer from description)
- outfit: string[] (2-4 outfit keywords, infer from description)
- defaultOutfit: string[] (2-10 default outfit keywords)
- behaviorTendency: string (≤120 chars, behavior pattern summary)
- coreBackstory: string (≤500 chars, essential backstory)
- likes: string[] (1-3 keywords)
- dislikes: string[] (1-3 keywords)
- npcTraits: array of { name: string (≤18 chars), description: string (≤75 chars) } — 1-3 narration hooks
- dialogueExamples: { greeting, excited, pleading, angered, working, affectionate } — each a sample line (40-120 chars, in-character, Traditional Chinese)
- confidence: object mapping each field name to "high", "medium", or "low" — how confident you are in the conversion

If the TavernCard includes a "scenario" field with substantial world-building content, also include:
- scenarioSummary: string (≤200 chars summary of the scenario context)

Return ONLY valid JSON. No explanation.`;async function x(e,i,l){var f,c;const m=[`Name: ${e.data.name}`,e.data.description?`Description: ${e.data.description}`:"",e.data.personality?`Personality: ${e.data.personality}`:"",e.data.scenario?`Scenario: ${e.data.scenario}`:"",e.data.first_mes?`First Message: ${e.data.first_mes.slice(0,500)}`:"",e.data.mes_example?`Example Messages: ${e.data.mes_example.slice(0,500)}`:"",e.data.creator_notes?`Creator Notes: ${e.data.creator_notes.slice(0,300)}`:"",(f=e.data.tags)!=null&&f.length?`Tags: ${e.data.tags.join(", ")}`:""].filter(Boolean).join(`

`);try{const{response:a}=await h(i,{systemPrompt:T,messages:[{role:"user",content:`Convert this TavernCard character:

${m}`}],config:{model:l,maxTokens:1500,temperature:.4,thinkingLevel:"off",stream:!0}}),p=v(a.content);if(!p.ok||!p.value||typeof p.value!="object"||Array.isArray(p.value))return y.warn("TavernConverter","Response is not valid JSON",a.content.slice(0,200)),null;const r=p.value,n={},o=r.confidence??{},s=[];if(typeof r.name=="string"&&(n.name=r.name),typeof r.role=="string"&&(n.role=r.role),typeof r.lifeStage=="string"&&(n.lifeStage=r.lifeStage),Array.isArray(r.personality)&&(n.personality=r.personality.filter(t=>typeof t=="string")),Array.isArray(r.appearance)&&(n.appearance=r.appearance.filter(t=>typeof t=="string")),Array.isArray(r.outfit)&&(n.outfit=r.outfit.filter(t=>typeof t=="string")),Array.isArray(r.defaultOutfit)&&(n.defaultOutfit=r.defaultOutfit.filter(t=>typeof t=="string")),typeof r.behaviorTendency=="string"&&(n.behaviorTendency=r.behaviorTendency),typeof r.coreBackstory=="string"&&(n.coreBackstory=r.coreBackstory),Array.isArray(r.likes)&&(n.likes=r.likes.filter(t=>typeof t=="string")),Array.isArray(r.dislikes)&&(n.dislikes=r.dislikes.filter(t=>typeof t=="string")),Array.isArray(r.npcTraits)&&(n.npcTraits=r.npcTraits.filter(t=>t!==null&&typeof t=="object").map(t=>({name:String(t.name??"").trim(),description:String(t.description??"").trim()})).filter(t=>t.name&&t.description)),r.dialogueExamples&&typeof r.dialogueExamples=="object"&&!Array.isArray(r.dialogueExamples)){const t=r.dialogueExamples,d={};for(const u of["greeting","excited","pleading","angered","working","affectionate"])typeof t[u]=="string"&&t[u].trim()&&(d[u]=t[u].trim());Object.keys(d).length>0&&(n.dialogueExamples=d)}const g=[];if((c=e.data.character_book)!=null&&c.entries)for(const t of e.data.character_book.entries){if(!t.enabled)continue;const d=k(t);d&&g.push(d)}return{profile:n,loreEntries:g,confidence:o,unmappedFields:s,greeting:e.data.first_mes||void 0}}catch(a){return y.warn("TavernConverter","Conversion failed",a),null}}function k(e){var i;return!e.content||e.content.trim().length===0?null:{loreId:`tavern_lore_${crypto.randomUUID().slice(0,8)}`,title:e.name||((i=e.keys)==null?void 0:i[0])||"Untitled",type:"character",category:"",keywords:[...e.keys??[],...e.secondary_keys??[]].filter(Boolean),content:e.content.trim(),priority:e.priority??50,tokenEstimate:Math.ceil(e.content.length/3),promoted:e.constant??!1,relationships:[],source:"user",createdAt:Date.now(),lastModified:Date.now()}}const w=`You are a scenario data conversion specialist. You will receive character/world data from a TavernCard (SillyTavern format), likely in English. Convert it into a structured DogeChat scenario JSON. ALL text output must be in Traditional Chinese (繁體中文).

Extract scenario information from the TavernCard's "scenario", "description", "system_prompt", "world_scenario" (if present), and "character_book" entries.

Return a JSON object with these fields:
- title: string (≤60 chars, scenario title in Traditional Chinese)
- genre: string (single genre keyword, e.g. "奇幻", "科幻", "現代", "恐怖")
- tone: string[] (2-5 tone keywords, e.g. ["黑暗", "冒險", "神秘"])
- overview: string (≤300 chars, scenario premise summary)
- locations: array of { name: string, description: string (≤100 chars) } — 1-5 key locations
- npc_generation_pool: array of { name: string, role: string (≤40 chars), personality: string[] (2-4 keywords) } — extract from character data, max 3
- opening_scene: string (≤200 chars, scene-setting for the first turn)
- confidence: object mapping each field name to "high", "medium", or "low"

Return ONLY valid JSON. No explanation.`;async function A(e,i,l){var a,p,r;const m=[`Name: ${e.data.name}`,e.data.description?`Description: ${e.data.description}`:"",e.data.personality?`Personality: ${e.data.personality}`:"",e.data.scenario?`Scenario: ${e.data.scenario}`:"",e.data.system_prompt?`System Prompt: ${e.data.system_prompt.slice(0,800)}`:"",e.data.first_mes?`First Message: ${e.data.first_mes.slice(0,500)}`:"",e.data.creator_notes?`Creator Notes: ${e.data.creator_notes.slice(0,300)}`:"",(a=e.data.tags)!=null&&a.length?`Tags: ${e.data.tags.join(", ")}`:""].filter(Boolean).join(`

`),f=((r=(p=e.data.character_book)==null?void 0:p.entries)==null?void 0:r.filter(n=>n.enabled&&n.content).slice(0,10).map(n=>{var o;return`[${n.name??((o=n.keys)==null?void 0:o[0])??"?"}]: ${n.content.slice(0,200)}`}).join(`
`))??"",c=`Convert this TavernCard into a scenario:

${m}`+(f?`

World Entries:
${f}`:"");try{const{response:n}=await h(i,{systemPrompt:w,messages:[{role:"user",content:c}],config:{model:l,maxTokens:1500,temperature:.4,thinkingLevel:"off",stream:!0}}),o=v(n.content);if(!o.ok||!o.value||typeof o.value!="object"||Array.isArray(o.value))return y.warn("TavernConverter","Scenario response is not valid JSON",n.content.slice(0,200)),null;const s=o.value,g=s.confidence??{};return{scenario:{title:typeof s.title=="string"?s.title:e.data.name,genre:typeof s.genre=="string"?s.genre:"",tone:Array.isArray(s.tone)?s.tone.filter(d=>typeof d=="string"):[],fullJson:s,source:"imported"},confidence:g}}catch(n){return y.warn("TavernConverter","Scenario conversion failed",n),null}}function O(e){var f;const i=e.data.character_book;if(!((f=i==null?void 0:i.entries)!=null&&f.length))return null;const l=[];for(const c of i.entries){if(!c.enabled)continue;const a=k(c);a&&l.push(a)}return l.length===0?null:{arcanum:{title:i.name||`${e.data.name} 知識庫`,genrePrimary:"",genreSecondary:"",era:"",metaphysicsEnabled:!1,metaphysics:[],iconicFeatures:[],tone:[],xCards:[],rules:[],moduleOverrides:{},linkedLore:l.map(c=>c.loreId),source:"imported"},loreEntries:l}}export{x as convertTavernToDogeChat,A as convertTavernToScenario,O as extractTavernLorebook};
