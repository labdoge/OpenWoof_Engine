const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./modules-C8sEp_Z0.js","./vendor-DICsj_8Q.js"])))=>i.map(i=>d[i]);
import{dx as y,e as o,_ as S,d as P}from"./modules-C8sEp_Z0.js";import{av as M,x as k,g as G,e as c,c as C,a5 as D,aI as Y,B as A,a as X}from"./workshop-B5eptfZD.js";import{W as w,p as F}from"./agents-BCQ-f8tj.js";import"./vendor-DICsj_8Q.js";const R={literary:"文學小說風格——優美的散文、豐富的內心描寫、意象化的場景刻畫。避免直白的情節推進，注重氛圍營造與角色心理描繪。",light_novel:"輕小說風格——流暢明快的敘事節奏、活潑的對話、適度的場景描寫。使用輕鬆的語氣，保留角色的可愛特質。",web_novel:"網路小說風格——緊湊的情節推進、直接的敘事、短段落。以劇情衝突和角色互動為主，節奏快速。",screenplay:"劇本風格——以對話和動作描述為主，極簡的場景敘述。使用分鏡式的場景切換。"},$={short:{minChars:2e3,maxChars:4e3,label:"短篇（~2000字）"},medium:{minChars:5e3,maxChars:8e3,label:"中篇（~5000字）"},long:{minChars:1e4,maxChars:15e3,label:"長篇（~10000字）"}},H=`You are a fiction editor creating a chapter outline from gameplay session transcript.

Given a transcript of turns (player actions + narrative responses), produce a JSON array of chapter objects:
[
  {
    "title": "chapter title in Traditional Chinese (繁體中文)",
    "coversTurns": [startTurn, endTurn],
    "summary": "1-2 sentence summary of this chapter's content"
  }
]

Guidelines:
- Each chapter should cover a natural narrative arc or scene transition
- Chapter titles should be evocative and thematic, not generic
- For short transcripts (< 10 turns), use 2-3 chapters
- For medium transcripts (10-30 turns), use 3-6 chapters
- For long transcripts (> 30 turns), use 5-10 chapters
- Turn ranges must not overlap and must cover all turns

Return ONLY valid JSON array. No explanation.`;function U(i,t,n){const r=$[n];return`You are a fiction writer expanding a chapter outline into polished prose.

Style: ${R[i]}
Perspective: ${t}
Target length: ${r.label}

Given the chapter outline and the original game transcript for those turns, write the chapter as polished fiction in Traditional Chinese (繁體中文).

Rules:
- Transform game mechanics and STATUS blocks into natural narrative
- Player actions become character actions described in ${t}
- NPC dialogue should feel natural and in-character
- Add sensory details, internal thoughts, and scene-setting
- Maintain consistent tone and style throughout
- Do NOT include any game mechanics, turn numbers, or STATUS blocks

Output the chapter text directly. No JSON, no metadata.`}const B=`You are a fiction editor doing a final polish pass.

Review the chapter text and improve:
- Consistency of character names and descriptions
- Smooth transitions between paragraphs
- Fix any awkward phrasing or repetition
- Ensure natural dialogue flow
- Add paragraph breaks for readability

Keep the same style and length. Output the polished text directly in Traditional Chinese (繁體中文). No explanation.`;async function K(i,t,n,r,e,a,l){const p=await M(i),u=await k(t),v=(u==null?void 0:u.title)??"無題劇本";if(p.length===0)throw new Error("No messages found for this session");const s=V(p),m=Math.max(...p.map(d=>d.turn),0);if(a({stage:"outline",current:0,total:1}),l!=null&&l.aborted)throw new Error("Aborted");const h=await W(r,e,s,m,n);a({stage:"outline",current:1,total:1});const E=[];for(let d=0;d<h.length;d++){if(l!=null&&l.aborted)throw new Error("Aborted");a({stage:"expand",current:d,total:h.length});const T=h[d],L=q(p,T.coversTurns[0],T.coversTurns[1]),N=await J(r,e,T,L,n);E.push(N)}a({stage:"expand",current:h.length,total:h.length});const g=[];for(let d=0;d<E.length;d++){if(l!=null&&l.aborted)throw new Error("Aborted");a({stage:"polish",current:d,total:E.length});const T=await j(r,e,E[d]);g.push(T)}return a({stage:"polish",current:E.length,total:E.length}),z(v,h,g,n)}function V(i){const t=[];let n=-1;for(const r of i)if(r.turn!==n&&(t.push(`
--- Turn ${r.turn} ---`),n=r.turn),r.role==="user")t.push(`[Player]: ${r.content}`);else{const e=r.content.replace(/\[STATUS\][\s\S]*?\[\/STATUS\]/g,"").trim();e&&t.push(`[Narrative]: ${e.slice(0,y.MAX_CHARS_PER_TURN)}`)}return t.join(`
`)}function q(i,t,n){const r=i.filter(e=>e.turn>=t&&e.turn<=n);return V(r)}async function W(i,t,n,r,e){const a=y.MAX_TRANSCRIPT_TOKENS*4,l=n.length>a?n.slice(0,a)+`

[... transcript truncated ...]`:n,{response:p}=await w(i,{systemPrompt:H,messages:[{role:"user",content:`Create a chapter outline for this ${r}-turn session.

Target: ${$[e.targetLength].label}
Style: ${R[e.style].slice(0,60)}

Transcript:
${l}`}],config:{model:t,maxTokens:y.OUTLINE_MAX_TOKENS,temperature:.5,thinkingLevel:"off",stream:!0}}),u=F(p.content);if(!u.ok||!Array.isArray(u.value))throw new Error("Failed to parse chapter outline");const v=u.value;if(!Array.isArray(v)||v.length===0)throw new Error("Invalid chapter outline");return v.filter(s=>typeof s.title=="string"&&Array.isArray(s.coversTurns)&&s.coversTurns.length===2&&typeof s.summary=="string")}async function J(i,t,n,r,e){const a=U(e.style,e.perspective,e.targetLength),{response:l}=await w(i,{systemPrompt:a,messages:[{role:"user",content:`Chapter: ${n.title}
Summary: ${n.summary}

Transcript:
${r}`}],config:{model:t,maxTokens:y.EXPAND_MAX_TOKENS,temperature:.7,thinkingLevel:"off",stream:!0}});return l.content.trim()}async function j(i,t,n){const{response:r}=await w(i,{systemPrompt:B,messages:[{role:"user",content:n}],config:{model:t,maxTokens:y.POLISH_MAX_TOKENS,temperature:.3,thinkingLevel:"off",stream:!0}});return r.content.trim()}function z(i,t,n,r){const e=[];e.push(`# ${i}`),e.push(""),e.push(`*Exported from WoofyChatty — ${new Date().toLocaleString("zh-TW")}*`),e.push("");for(let a=0;a<t.length;a++)r.chapterBreaks&&(e.push("---"),e.push("")),e.push(`## ${t[a].title}`),e.push(""),e.push(n[a]??""),e.push("");return e.join(`
`)}async function re(i){const t=G("NovelExport");if(!t)return;const n=await Q(t,i);n&&await Z(t,i,n)}function Q(i,t){return new Promise(n=>{const r=`<div class="modal-panel novel-export-config"><div class="modal-title">${c(o.NOVEL_EXPORT_TITLE)}</div><div class="novel-export-subtitle">${c(t.scenarioTitle)}</div><div class="novel-export-form"><div class="novel-field"><label class="novel-field-label">${c(o.NOVEL_STYLE_LABEL)}</label><select class="novel-field-select" data-field="style"><option value="literary">${c(o.NOVEL_STYLE_LITERARY)}</option><option value="light_novel">${c(o.NOVEL_STYLE_LIGHT_NOVEL)}</option><option value="web_novel">${c(o.NOVEL_STYLE_WEB_NOVEL)}</option><option value="screenplay">${c(o.NOVEL_STYLE_SCREENPLAY)}</option></select></div><div class="novel-field"><label class="novel-field-label">${c(o.NOVEL_LENGTH_LABEL)}</label><select class="novel-field-select" data-field="length"><option value="short">${c(o.NOVEL_LENGTH_SHORT)}</option><option value="medium" selected>${c(o.NOVEL_LENGTH_MEDIUM)}</option><option value="long">${c(o.NOVEL_LENGTH_LONG)}</option></select></div><div class="novel-field novel-field-row"><label class="novel-field-label">${c(o.NOVEL_CHAPTER_BREAKS)}</label><input type="checkbox" data-field="chapters" checked /></div><div class="novel-field"><label class="novel-field-label">${c(o.NOVEL_PERSPECTIVE_LABEL)}</label><input type="text" class="novel-field-input" data-field="perspective" value="${c(t.perspective||o.NOVEL_DEFAULT_PERSPECTIVE)}" /></div></div><div class="modal-actions"><button class="modal-btn" data-action="cancel">${c(o.CONFIRM_CANCEL)}</button><button class="modal-btn primary" data-action="start">${c(o.NOVEL_START_EXPORT)}</button></div></div>`,e=C(r),a=X(e,n),l=D(a,null);e.addEventListener("click",p=>{const u=p.target.dataset.action;if(u){if(u==="cancel"){l(),a(null);return}if(u==="start"){const v=e.querySelector('[data-field="style"]').value,s=e.querySelector('[data-field="length"]').value,m=e.querySelector('[data-field="chapters"]').checked,h=e.querySelector('[data-field="perspective"]').value.trim()||o.NOVEL_DEFAULT_PERSPECTIVE;l(),a({style:v,targetLength:s,chapterBreaks:m,perspective:h})}}}),e.addEventListener("mousedown",p=>{p.target===e&&(l(),a(null))}),i.appendChild(e)})}const O={outline:"",expand:"",polish:""};async function Z(i,t,n){O.outline=o.NOVEL_STAGE_OUTLINE,O.expand=o.NOVEL_STAGE_EXPAND,O.polish=o.NOVEL_STAGE_POLISH;const r=new AbortController,e=`<div class="modal-panel novel-export-progress"><div class="modal-title">${c(o.NOVEL_EXPORT_TITLE)}</div><div class="novel-progress-stage" data-role="stage">${c(O.outline)}</div><div class="novel-progress-bar-container"><div class="novel-progress-bar" data-role="bar" style="width: 0%"></div></div><div class="novel-progress-detail" data-role="detail">0%</div><div class="modal-actions"><button class="modal-btn danger" data-action="cancel">${c(o.CONFIRM_CANCEL)}</button></div></div>`,a=C(e);i.appendChild(a);const l=a.querySelector('[data-role="stage"]'),p=a.querySelector('[data-role="bar"]'),u=a.querySelector('[data-role="detail"]');a.addEventListener("click",s=>{s.target.dataset.action==="cancel"&&r.abort()});const v=s=>{const m=O[s.stage]??s.stage;l.textContent=m;const h={outline:.1,expand:.6,polish:.3},E={outline:0,expand:.1,polish:.7},g=h[s.stage]??.33,d=E[s.stage]??0,T=s.total>0?s.current/s.total:0,L=d+g*T;p.style.width=`${Math.round(L*100)}%`,u.textContent=`${Math.round(L*100)}%`};try{const{STORAGE_KEYS:s}=await S(async()=>{const{STORAGE_KEYS:f}=await import("./modules-C8sEp_Z0.js").then(_=>_.dS);return{STORAGE_KEYS:f}},__vite__mapDeps([0,1]),import.meta.url),{getSettingSync:m}=await S(async()=>{const{getSettingSync:f}=await import("./modules-C8sEp_Z0.js").then(_=>_.dO);return{getSettingSync:f}},__vite__mapDeps([0,1]),import.meta.url),{resolveModel:h}=await S(async()=>{const{resolveModel:f}=await import("./modules-C8sEp_Z0.js").then(_=>_.dR);return{resolveModel:f}},__vite__mapDeps([0,1]),import.meta.url),{createAdapter:E,normalizeModelProvider:g}=await S(async()=>{const{createAdapter:f,normalizeModelProvider:_}=await import("./modules-C8sEp_Z0.js").then(I=>I.dQ);return{createAdapter:f,normalizeModelProvider:_}},__vite__mapDeps([0,1]),import.meta.url),d=g(m(s.API_PROVIDER)),T=E(d),L=h(d,"creativeOps",m(s.CREATIVE_OPS_MODEL)??m(s.MAIN_MODEL)),N=await K(t.sessionId,t.scenarioId,n,T,L,v,r.signal);a.remove();const b=N.length,x=`${t.scenarioTitle}_novel.md`;await Y(N,x,[{name:"Markdown",extensions:["md"]}]),A(o.NOVEL_EXPORT_SUCCESS(b),!1),P.info("NovelExport",`Export complete: ${b} chars, file: ${x}`)}catch(s){a.remove(),s instanceof Error&&s.message==="Aborted"?A(o.NOVEL_EXPORT_CANCELLED,!1):(P.warn("NovelExport","Export failed",s),A(o.NOVEL_EXPORT_FAILED,!0))}}export{re as showNovelExportModal};
