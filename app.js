import {PATTERNS,PROBLEMS,BY_PATTERN,getProblem,getPattern,leetcodeUrl} from './catalog.js';
import {getStudyGuide} from './study-guides.js';
import {attachPersonalContent,createRemix,remixSupported,validatePattern,validateProblem,nextPersonalId} from './personal-content.js';

const STORAGE_KEY='patternlab.v1';
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const day=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const plusDays=(num)=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+num);return day(d);};
const prettyNumber=n=>Number(n||0).toLocaleString();
const testStr=v=>JSON.stringify(v).replace(/"\$(?:list|tree|cycle)"/g,m=>m);
function loadSaved(){try{const data=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');return data&&data.version===1?data:{}}catch{return {}}}
const saved=loadSaved();
const data={version:1,progress:saved.progress||{},drafts:saved.drafts||{},notes:saved.notes||{},hints:saved.hints||{},quizzes:saved.quizzes||{},activity:saved.activity||{},target:saved.target||3,aiModel:typeof saved.aiModel==='string'?saved.aiModel:'',aiEnabled:saved.aiEnabled!==false,personalPatterns:Array.isArray(saved.personalPatterns)?saved.personalPatterns:[],personalProblems:Array.isArray(saved.personalProblems)?saved.personalProblems:[]};
Object.assign(data,attachPersonalContent(data));
const state={page:'overview',lessonPattern:null,problemId:1480,filterPattern:'all',filterDifficulty:'all',query:'',edit:null,runner:null,runnerReady:false,runnerError:'',runRequest:0,runTimer:null,running:false,requestProblemId:null,lastRun:null,chat:{},aiAvailable:false,aiOn:false,coachPendingSet:new Set(),editorProblemId:null,aiModels:[],aiEmail:null,mock:null,statsRange:21,generatePending:false};
const persist=()=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify(data));return true}catch{toast('Storage is full or blocked. Export your progress from Settings.');return false}};
const totalSolved=()=>PROBLEMS.filter(p=>!p.source||p.source==='curated-remix').filter(p=>data.progress[p.id]?.solvedAt).length;
const dueProblems=()=>PROBLEMS.filter(p=>data.progress[p.id]?.solvedAt && data.progress[p.id]?.nextDue<=day());
const mastery=p=>{const qs=(BY_PATTERN[p]||[]).filter(q=>q.source!=='ai-draft');return qs.length?Math.round(qs.filter(q=>data.progress[q.id]?.solvedAt).length*100/qs.length):0};
const isSolved=id=>!!data.progress[id]?.solvedAt;
const streak=()=>{let count=0;let offset=0;const yesterday=plusDays(-1);if(!data.activity[day()]&&data.activity[yesterday])offset=1;for(let i=offset;i<366;i++){if(data.activity[plusDays(-i)]>0)count++;else break}return count};
const nextUnsolved=(pattern=null)=>{const pool=pattern?BY_PATTERN[pattern]||[]:PROBLEMS;return pool.find(p=>!isSolved(p.id))||pool[0]||PROBLEMS[0]};
const todayPicks=()=>{const due=dueProblems().slice(0,1);const unsolved=PROBLEMS.filter(p=>!isSolved(p.id));const current=unsolved[0];const samePattern=current?unsolved.filter(p=>p.pattern===current.pattern):[];const roadmap=[...samePattern,...unsolved];return [...due,...roadmap].filter((p,i,all)=>all.findIndex(x=>x.id===p.id)===i).slice(0,3)};
const toast=message=>{const host=$('#toast-host');const div=document.createElement('div');div.className='toast';div.textContent=message;host.appendChild(div);setTimeout(()=>div.remove(),4800)};
const icon=p=>`<span class="pattern-symbol" style="--symbol:${esc(p.color)}">${esc(p.icon)}</span>`;
const difficulty=p=>`<span class="difficulty ${p.difficulty}">${p.difficulty}</span>`;
const percentage=(n,d)=>d?Math.round(n/d*100):0;
function sidebar(){
  const solved=totalSolved();
  $('#journey-summary').innerHTML=`<div class="journey-top"><span>Overall progress</span><strong>${solved}/${PROBLEMS.length}</strong></div><div class="progress-track"><div class="progress-fill" style="width:${percentage(solved,PROBLEMS.length)}%"></div></div><div class="journey-detail">${percentage(solved,PROBLEMS.length)}% of curated practice completed<br>${PATTERNS.length} patterns · Self-paced journey</div>`;
  $('#review-nav-count').textContent=dueProblems().length;
  $$('.nav-link').forEach(el=>el.classList.toggle('active',el.dataset.nav===state.page || (state.page==='workspace'&&el.dataset.nav==='practice')));
  const breadcrumb={overview:'Dashboard',learn:'Learn patterns',practice:'Problem bank',review:'Review queue',insights:'My progress',workspace:'Practice workspace'}[state.page];
  $('#breadcrumb').innerHTML=`Your workspace <span class="crumb-separator">/</span> ${esc(breadcrumb||'Dashboard')}`;
}
function navigate(page){
  if(state.page==='workspace'&&state.edit)saveDraft();
  state.page=page;
  state.lastRun=null;
  $('#sidebar').classList.remove('open');$('#mobile-overlay').hidden=true;
  render();window.scrollTo({top:0,behavior:'auto'});
}
function render(){if(state.edit){saveDraft();if(typeof state.edit.toTextArea==='function')state.edit.toTextArea();state.edit=null;state.editorProblemId=null;}sidebar();const root=$('#content');
  if(state.page==='overview')root.innerHTML=renderOverview();
  else if(state.page==='learn')root.innerHTML=renderLearn();
  else if(state.page==='practice')root.innerHTML=renderPractice();
  else if(state.page==='review')root.innerHTML=renderReview();
  else if(state.page==='insights')root.innerHTML=renderInsights();
  else if(state.page==='workspace'){root.innerHTML=renderWorkspace();initEditor();renderChat();renderConsole();updateTimer()}
}
function renderOverview(){
  const solved=totalSolved(),due=dueProblems(),current=nextUnsolved();const picks=todayPicks();
  const easy=PROBLEMS.filter(p=>p.difficulty==='Easy'&&isSolved(p.id)).length;
  const medium=PROBLEMS.filter(p=>p.difficulty==='Medium'&&isSolved(p.id)).length;
  return `<div class="eyebrow">YOUR PERSONAL LEARNING SPACE</div>
  <div class="view-header"><div><h1>Build intuition. Not memorization.</h1><p class="view-subtitle">One pattern at a time. Think first, code second, revisit until it sticks.</p></div><span class="muted small">${new Date().toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric',year:'numeric'})}</span></div>
  <div class="hero"><div class="hero-copy"><span class="hero-badge">✦ YOUR NEXT STEP</span><h1>Every great solution<br>starts with a pattern.</h1><p>Develop the instinct to recognize the approach before reaching for code. Your next challenge is ready.</p><button class="btn btn-primary" data-action="open-pattern" data-pattern="${current.pattern}">Study the pattern first <span>↗</span></button></div><div class="hero-art"><div class="hero-orbit"></div><div class="hero-code"><span class="purple">def</span> <span class="blue">solve</span>(problem):<br>&nbsp; <span class="gray"># observe the pattern</span><br>&nbsp; <span class="green">think()</span><br>&nbsp; <span class="green">reason()</span><br>&nbsp; <span class="purple">return</span> clarity</div></div></div>
  <div class="stat-grid">
    ${stat('⌘',prettyNumber(solved),'Problems solved',`${easy} easy · ${medium} medium`)}
    ${stat('▣',`${PATTERNS.filter(p=>mastery(p.id)===100).length}/${PATTERNS.length}`,'Patterns completed','Learn, practice, repeat')}
    ${stat('♨',streak()+' days','Current streak','Keep the momentum')}
    ${stat('↻',String(due.length),'Reviews due',due.length?'Your memory workout':'All caught up')}
  </div>
  <div class="section-heading"><div><h2>Pick up where you left off</h2><p>Small, consistent steps beat random grinding.</p></div><button class="link-button" data-nav="practice">Explore all problems →</button></div>
  <div class="dashboard-grid"><div class="panel focus-panel"><div class="focus-top"><div class="focus-icon">◎</div><div><div class="focus-meta">UP NEXT · ${esc(getPattern(current.pattern).name)}</div><h3>${esc(current.title)}</h3></div></div><p>${esc(current.description)}</p><div class="focus-actions">${difficulty(current)}<button class="btn btn-primary btn-sm" data-action="problem" data-id="${current.id}">Open challenge ↗</button><button class="btn btn-outline btn-sm" data-action="open-pattern" data-pattern="${current.pattern}">Study pattern</button></div></div>
  <div class="panel"><h3>Today's practice plan</h3><p class="muted small" style="margin:7px 0 0">A bite-sized plan that includes spaced reviews.</p><div class="daily-list">${picks.map((p,i)=>`<button class="daily-row" data-action="problem" data-id="${p.id}" style="background:none;border:0;text-align:left;padding:0"><span class="daily-number">${String(i+1).padStart(2,'0')}</span><span style="min-width:0;flex:1">${esc(p.title)}</span><strong>${data.progress[p.id]?.nextDue<=day()?'REVIEW':esc(p.difficulty.toUpperCase())}</strong></button>`).join('')}</div><button data-action="start-mock" class="btn btn-secondary btn-sm" style="margin-top:19px;width:100%">◷ Try a 45-min mock interview</button></div></div>
  <div class="section-heading"><div><h2>The learning roadmap</h2><p>Start simple. Build up to the harder interview patterns.</p></div><button class="link-button" data-nav="learn">View full roadmap →</button></div><div class="pattern-grid">${PATTERNS.slice(0,6).map(patternCard).join('')}</div>`;
}
function stat(symbol,value,label,foot){return `<div class="stat-card"><div class="stat-icon">${symbol}</div><div class="stat-value">${value}</div><div class="stat-label">${label}</div><div class="stat-foot">${foot}</div></div>`}
function patternCard(p){return `<button class="pattern-card" data-action="open-pattern" data-pattern="${p.id}" style="--symbol:${p.color}"><div class="pattern-card-top">${icon(p)}<span class="tier-label">${p.tier}</span></div><div class="pattern-name">${esc(p.name)}</div><p>${esc(p.short)}</p><div class="pattern-footer"><span><i class="legend-dot"></i>${(BY_PATTERN[p.id]||[]).filter(q=>isSolved(q.id)).length}/${BY_PATTERN[p.id].length} complete</span><span>${mastery(p.id)}%</span></div><div class="mini-track"><div style="width:${mastery(p.id)}%"></div></div></button>`}
function renderLearn(){
  if(state.lessonPattern)return renderLesson(getPattern(state.lessonPattern));
  return `<div class="eyebrow">STRUCTURED LEARNING PATH</div><div class="view-header"><div><h1>Master the patterns.</h1><p class="view-subtitle">${PATTERNS.length} foundations, core techniques, and advanced concepts. Start with a complete study guide and recognition check, then practice.</p></div><div class="study-actions"><button class="btn btn-secondary" data-action="generate-pattern" ${state.generatePending?'disabled':''}>✦ Generate new pattern with AI</button><button class="btn btn-secondary" data-action="problem" data-id="${nextUnsolved().id}">Resume practice ↗</button></div></div>
  ${['Foundation','Core','Advanced'].map(t=>`<div class="section-heading"><div><h2>${t}</h2><p>${t==='Foundation'?'Establish the mental models.':t==='Core'?'The techniques that appear again and again.':'Combine fundamentals to handle harder problems.'}</p></div><span class="muted small">${PATTERNS.filter(p=>p.tier===t).length} modules</span></div><div class="pattern-grid">${PATTERNS.filter(p=>p.tier===t).map(patternCard).join('')}</div>`).join('')}`;
}
function renderLesson(p){
  if(!p){state.lessonPattern=null;return renderLearn()}
  const quiz=p.quiz,answer=data.quizzes[p.id];const exercises=BY_PATTERN[p.id]||[];
  return `<button class="lesson-back" data-action="lesson-back">← Back to all patterns</button><div class="view-header"><div><div class="eyebrow">${esc(p.tier)} · PATTERN DEEP DIVE</div><h1>${esc(p.name)}</h1><p class="view-subtitle">${esc(p.short)} · ${exercises.filter(q=>isSolved(q.id)).length}/${exercises.length} exercises solved</p></div>${icon(p)}</div>
  <div class="lesson-shell"><div class="panel lesson-main"><h2>Build the mental model</h2><p class="lesson-lead">${esc(p.idea)}</p>${renderStudyGuide(p)}
  ${lessonBlock('01 · When to recognize it',p.signal)}
  ${lessonBlock('02 · The invariant to defend',p.invariant)}
  ${lessonBlock('03 · A concrete intuition',p.example,true)}
  ${lessonBlock('04 · Classic mistake',p.pitfall)}
  <div class="quiz"><h3>✦ RECOGNITION CHECKPOINT</h3><p>${esc(quiz[0])}</p><div class="quiz-options">${quiz[1].map((option,i)=>`<button class="quiz-option ${answer===i?'chosen':''}" data-action="answer-quiz" data-pattern="${p.id}" data-choice="${i}">${String.fromCharCode(65+i)}. ${esc(option)}</button>`).join('')}</div>${Number.isInteger(answer)?`<div class="quiz-feedback ${answer===quiz[2]?'correct':'wrong'}">${answer===quiz[2]?'✓ Correct.':'Not quite — reconsider the invariant.'} ${esc(quiz[3])}</div>`:''}</div>
  </div><aside class="panel lesson-side"><h3>Practice this pattern</h3><p class="muted small" style="line-height:1.7">Work from simple to challenging. Avoid the hints until you've made a serious attempt.</p>${exercises.map(q=>`<button class="mini-problem" data-action="problem" data-id="${q.id}"><div><strong>${isSolved(q.id)?'✓ ':''}${esc(q.title)}</strong><p>#${q.id} · ${q.difficulty}${q.source==='ai-draft'?' · AI draft':''}</p></div><span>↗</span></button>`).join('')}<button class="btn btn-secondary btn-sm" data-action="generate-exercise" data-pattern="${esc(p.id)}" ${state.generatePending?'disabled':''} style="width:100%;margin-top:14px">✦ Create a related exercise with AI</button><div class="notice" style="margin-top:16px">Learning tip: Before writing a line of code, say the time complexity and the invariant out loud.</div></aside></div>`;
}
function renderStudyGuide(p){
  const g=p.study||getStudyGuide(p.id);
  if(!g)return '<div class="notice">A detailed guide is not yet available for this personal pattern.</div>';
  return `<section class="study-guide" aria-label="Complete study guide"><div class="study-intro"><div class="eyebrow">PRE-PRACTICE STUDY NOTES</div><h2>Understand the concept before you code</h2><p>${esc(g.objective)}</p></div>
    <div class="lesson-block"><h3>01 · The core intuition</h3><p>${esc(g.intuition)}</p></div>
    <div class="lesson-block"><h3>02 · Worked example: ${esc(g.walkthrough.title)}</h3><p><strong>Start with:</strong> ${esc(g.walkthrough.input)}</p><ol class="study-steps">${g.walkthrough.steps.map(t=>`<li>${esc(t)}</li>`).join('')}</ol><p><strong>What this proves:</strong> ${esc(g.walkthrough.conclusion)}</p></div>
    <details class="study-detail"><summary>03 · Reusable Python template (not an exercise solution)</summary><pre class="study-code"><code>${esc(g.template)}</code></pre></details>
    <div class="lesson-block"><h3>04 · Derive time & space complexity</h3><p>${esc(g.complexity)}</p></div>
    <div class="lesson-block"><h3>05 · When to choose another technique</h3><p>${esc(g.compare)}</p></div>
    <div class="lesson-block"><h3>06 · Mistakes to avoid</h3><ul class="study-bullets">${g.mistakes.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>
    <div class="lesson-block"><h3>07 · Check your understanding</h3><ol class="study-steps">${g.recall.map(x=>`<li>${esc(x)}</li>`).join('')}</ol><div class="notice">Try answering aloud or on paper before opening any exercise. You can ask the interview coach for an explanation without seeing an entire solution.</div></div>
  </section>`;
}
function lessonBlock(title,description,code=false){return `<div class="lesson-block"><h3>${esc(title)}</h3>${code?`<div class="lesson-insight">${esc(description)}</div>`:`<p>${esc(description)}</p>`}</div>`}
function renderPractice(){return `<div class="eyebrow">PRACTICE GROUND</div><div class="view-header"><div><h1>Find your next challenge.</h1><p class="view-subtitle">${PROBLEMS.length} curated, executable Python problems. Build your own solution and test it locally — no answer spoilers.</p></div><button class="btn btn-secondary" data-action="start-mock">◷ Start mock interview</button></div>
  <div class="filter-row"><input id="practice-search" class="filter-search" placeholder="Search problems, IDs, or patterns…" value="${esc(state.query)}" aria-label="Filter problems"/><select class="filter-select" id="pattern-filter" aria-label="Pattern filter"><option value="all">All patterns</option>${PATTERNS.map(p=>`<option value="${p.id}" ${state.filterPattern===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select><select class="filter-select" id="difficulty-filter" aria-label="Difficulty filter"><option value="all">All difficulties</option>${['Easy','Medium','Hard'].map(d=>`<option value="${d}" ${state.filterDifficulty===d?'selected':''}>${d}</option>`).join('')}</select></div>
  <div id="problem-results">${problemResults()}</div>`}
function filteredProblems(){return PROBLEMS.filter(p=>{const pattern=getPattern(p.pattern)?.name||'';return (state.filterPattern==='all'||p.pattern===state.filterPattern)&&(state.filterDifficulty==='all'||p.difficulty===state.filterDifficulty)&&(`${p.title} ${p.id} ${pattern}`.toLowerCase().includes(state.query.trim().toLowerCase()))})}
function problemResults(){const ps=filteredProblems();return `<div class="table-wrap"><table class="problem-table"><thead><tr><th style="width:55px">STATUS</th><th>PROBLEM</th><th>PATTERN</th><th>DIFFICULTY</th><th style="width:65px">OPEN</th></tr></thead><tbody>${ps.map(p=>`<tr tabindex="0" role="button" data-action="problem" data-id="${p.id}" aria-label="Open ${esc(p.title)}"><td><span class="status-symbol ${isSolved(p.id)?'solved':data.progress[p.id]?.nextDue<=day()?'due':''}">${isSolved(p.id)?'✓':'○'}</span></td><td><span class="problem-title">${esc(p.title)}</span> <span class="muted small mono">#${p.id}</span></td><td>${esc(getPattern(p.pattern).name)}</td><td>${difficulty(p)}</td><td style="color:#aaa4e5">↗</td></tr>`).join('')}</tbody></table>${!ps.length?'<div class="empty-state">No problems match your filters. Try broadening the search.</div>':''}</div><p class="small muted" style="margin-top:12px">Showing ${ps.length} of ${PROBLEMS.length} problems. Test cases are educational fixtures, not LeetCode’s private judging suite.</p>`}
function renderReview(){const due=dueProblems(),upcoming=PROBLEMS.filter(p=>isSolved(p.id)&&!due.includes(p)).sort((a,b)=>data.progress[a.id].nextDue.localeCompare(data.progress[b.id].nextDue));return `<div class="eyebrow">SPACED REPETITION</div><div class="view-header"><div><h1>Make it stick.</h1><p class="view-subtitle">Solving once creates familiarity. Re-solving after a delay builds recall. Revisit problems without relying on old code.</p></div><span class="muted small">${due.length} due today</span></div>
  <div class="panel" style="margin-bottom:20px"><h3>How reviews work</h3><p class="muted small" style="line-height:1.9;margin:10px 0 0">Once you pass a problem's tests, it becomes due for review the next day. After each successful review, rate your recall as Again, Hard, Good, or Easy. The next interval adapts to your rating. Your original code remains saved, but try solving from scratch first.</p></div>
  <div class="section-heading"><div><h2>Due now</h2><p>Prioritize these before learning something new.</p></div></div><div class="review-items">${due.length?due.map(reviewItem).join(''):`<div class="empty-state panel"><h3>All caught up ✨</h3>Once you solve problems, they'll appear here on their next scheduled review day.<div style="margin-top:14px"><button class="btn btn-primary btn-sm" data-nav="practice">Browse problems ↗</button></div></div>`}</div>
  ${upcoming.length?`<div class="section-heading"><div><h2>Coming up</h2><p>Your next scheduled review sessions.</p></div></div><div class="review-items">${upcoming.slice(0,10).map(reviewItem).join('')}</div>`:''}`}
function reviewItem(p){const entry=data.progress[p.id];return `<div class="review-item"><span class="review-icon">↻</span><div class="review-item-main"><h3>${esc(p.title)}</h3><p>${esc(getPattern(p.pattern).name)} · Next review: ${esc(entry.nextDue||'Tomorrow')} · ${entry.reviews||0} reviews completed</p></div>${difficulty(p)}<button class="btn btn-secondary btn-sm" data-action="review-problem" data-id="${p.id}">Practice again ↗</button></div>`}
function renderInsights(){const solved=totalSolved(),stats=PATTERNS.map(p=>({p,count:(BY_PATTERN[p.id]||[]).filter(q=>isSolved(q.id)).length,total:BY_PATTERN[p.id].length}));return `<div class="eyebrow">YOUR LEARNING SIGNALS</div><div class="view-header"><div><h1>Progress that compounds.</h1><p class="view-subtitle">Track what you've practiced and which patterns deserve more attention. All progress stays in this browser unless you export it.</p></div><button class="btn btn-outline" data-action="export">↓ Export progress</button></div>
  <div class="stat-grid" style="margin-bottom:25px">${stat('⌘',solved,'Problems solved','Local test-suite passes')}${stat('▣',PATTERNS.filter(p=>mastery(p.id)===100).length,'Completed patterns',`${PATTERNS.length} total`)}${stat('♨',streak(),'Practice streak','Consecutive active days')}${stat('↻',dueProblems().length,'Reviews due','Keep recall fresh')}</div>
  <div class="insight-grid"><div class="panel insight-panel"><h3>Pattern completion</h3>${stats.map(({p,count,total})=>`<div class="mastery-row"><span class="mastery-name">${esc(p.name)}</span><div class="mastery-track"><div class="mastery-fill" style="width:${percentage(count,total)}%"></div></div><span class="mastery-value">${count}/${total}</span></div>`).join('')}</div>
  <div><div class="panel insight-panel"><h3>Last 14 days</h3><div class="activity-grid">${Array.from({length:14},(_,i)=>{const d=plusDays(i-13),count=data.activity[d]||0;return `<div class="activity-cell ${count?`l${Math.min(4,count)}`:''}" title="${d}: ${count} solved"></div>`}).join('')}</div><p class="activity-caption">Each square represents one day. Lighter shades mean more solved problems.</p></div><div class="panel insight-panel" style="margin-top:15px"><h3>Build your next habit</h3><p class="muted small" style="line-height:1.9">Prioritize weak patterns, explain edge cases out loud, and revisit problems after a delay. Aim for quality over volume.</p><button class="btn btn-primary btn-sm" data-nav="review">Open review queue ↗</button></div></div></div>`}
function renderWorkspace(){const p=getProblem(state.problemId)||PROBLEMS[0],pat=getPattern(p.pattern),hints=data.hints[p.id]||0,chat=state.chat[p.id]||[];
  return `<div class="workspace-wrap"><div class="workspace-header"><div><button class="lesson-back" data-nav="practice">← Problem bank</button><div class="workspace-title-row"><h1>${esc(p.title)}</h1>${difficulty(p)}<span class="tag">${esc(pat.name)}</span>${isSolved(p.id)?'<span class="tag" style="color:#89e4c0">✓ Solved</span>':''}${p.source==='ai-draft'?'<span class="tag">⚠ AI-generated draft · unverified tests</span>':p.source==='curated-remix'?'<span class="tag">✓ Verified fresh cases</span>':''}</div><p class="muted small" style="margin:8px 0 0">Problem #${p.id} · Python 3 · Think → code → test → reflect</p></div><div class="workspace-tools">${state.mock?.id===p.id?`<span class="timer" id="mock-timer">45:00</span><button class="btn btn-outline btn-sm" data-action="end-mock">End mock</button>`:`<button class="btn btn-outline btn-sm" data-action="start-mock" data-id="${p.id}">◷ Mock mode</button>`}${remixSupported(p.id)||remixSupported(p.variantOf)?`<button class="btn btn-secondary btn-sm" data-action="fresh-remix" data-id="${p.id}">↻ Fresh verified cases</button>`:''}${isSolved(p.id)?`<button class="btn btn-outline btn-sm" data-action="generate-exercise" data-pattern="${esc(p.pattern)}" data-base="${p.id}" ${state.generatePending?'disabled':''}>✦ AI variant</button>`:''}<button class="btn btn-outline btn-sm" data-action="open-pattern" data-pattern="${esc(p.pattern)}">▧ Study notes</button><button class="btn btn-secondary btn-sm" data-action="next-problem">Next challenge →</button></div></div>
  <div class="workspace-layout"><div class="workspace-left"><div class="workspace-card"><div class="card-tabbar"><button class="card-tab active" data-tab="problem">Problem</button><button class="card-tab" data-tab="hints">Hints <span style="color:#8d85be">${hints}/3</span></button><button class="card-tab" data-tab="notes">My notes</button><span class="tab-actions">${p.personal?'<span class="muted small">Personal exercise</span>':`<a class="link-button" href="${leetcodeUrl(p)}" target="_blank" rel="noopener noreferrer" title="View original LeetCode problem">LeetCode ↗</a>`}</span></div><div class="problem-content" id="problem-tab-content">${workspaceTab(p,'problem')}</div></div>
  <div class="workspace-card coach-card"><div class="coach-header"><h3><span class="coach-spark">✳</span> Interview coach</h3><span class="coach-kind" id="coach-kind">${state.aiOn&&state.aiAvailable?'ChatGPT coach':'Built-in coach'}</span></div><div class="coach-chat" id="coach-chat"></div><div class="coach-quick"><button data-action="coach-quick" data-message="Give me a small hint without the solution">I’m stuck</button><button data-action="coach-quick" data-message="Help me reason about time and space complexity">Complexity?</button><button data-action="coach-quick" data-message="What edge cases should I consider?">Edge cases</button><button data-action="coach-quick" data-message="Explain the underlying pattern with a small example unrelated to the full solution">Explain the pattern</button><button data-action="coach-quick" data-message="Review my current code and failing test; where should I investigate first without writing the solution?">Debug my code</button></div><form id="coach-form" class="coach-form"><input id="coach-input" placeholder="Explain your reasoning or ask a question…" maxlength="2500" autocomplete="off" required aria-label="Ask the interview coach"/><button id="coach-submit" class="btn btn-primary btn-sm" type="submit">Ask ↗</button></form></div></div>
  <div class="workspace-right"><div class="workspace-card"><div class="editor-header"><div class="editor-filename"><span class="python-tag">Py</span>solution.py</div><div class="editor-actions"><button class="btn btn-ghost btn-sm" data-action="reset-code">Reset code</button></div></div><div class="editor-shell" id="editor-shell"><textarea id="code-editor" aria-label="Python solution editor" spellcheck="false"></textarea></div><div class="editor-footer"><span class="keycap">Ctrl / ⌘ + Enter to run</span><div class="run-actions"><button class="btn btn-secondary btn-sm" id="run-button" data-action="run" ${!state.runnerReady?'disabled':''}>▷ Run examples</button><button class="btn btn-primary btn-sm" id="submit-button" data-action="submit" ${!state.runnerReady?'disabled':''}>✓ Submit tests</button></div></div></div>
  <div class="workspace-card"><div class="console-header"><span>◉ TEST OUTPUT</span><button class="link-button" data-action="clear-results">Clear</button></div><div class="console-body" id="console-body"><span class="console-empty">Run your code to see test results here.</span></div></div></div></div></div>`;
}
function workspaceTab(p,tab){const hints=data.hints[p.id]||0;
  if(tab==='hints')return `<div class="notice" style="margin-bottom:16px">The goal isn't to finish quickly. Spend 10–15 minutes reasoning first. Each hint reveals a little more, never a complete solution.</div>${p.hints.slice(0,hints).map((hint,i)=>`<div class="hint-card"><div class="hint-step">HINT ${i+1} OF 3 · ${['RECOGNIZE','STRUCTURE','NUDGE'][i]}</div><p>${esc(hint)}</p></div>`).join('')}${hints<3?`<div class="hint-locked">⌁ ${3-hints} hint${3-hints>1?'s':''} still locked</div><div class="hint-actions"><button class="btn btn-secondary btn-sm" data-action="hint">✧ Reveal hint ${hints+1}</button>${state.mock?'<span class="hint-warning">Mock-mode hint usage is recorded.</span>':''}</div>`:`<div class="notice">All hints revealed. Try expressing your approach as an invariant, then write the smallest correct implementation.</div>`}`;
  if(tab==='notes')return `<h3 style="margin-bottom:9px">Your reasoning journal</h3><p>Write the brute-force idea, invariant, edge cases, and time/space complexity. Your notes are saved automatically for this problem.</p><textarea id="problem-notes" class="notes-area" placeholder="My initial approach…\n\nWhy this pattern works…\n\nComplexity…">${esc(data.notes[p.id]||'')}</textarea><div class="notes-help">Saved locally, just like your code. No AI API needed.</div>`;
  return `${p.source==='ai-draft'?'<div class="notice">⚠ This AI-generated exercise is experimental. Its expected outputs have not been independently verified. Use it for exploratory practice, not official mastery or review credit.</div>':''}<div class="problem-description">${esc(p.description)}</div><div class="problem-tags"><span class="tag">${esc(getPattern(p.pattern).name)}</span><span class="tag">${esc(p.difficulty)}</span><span class="tag">${p.tests.length} example tests</span></div><h3 style="font-size:13px;margin:22px 0 11px">Examples</h3>${p.tests.slice(0,2).map((t,i)=>`<div class="example-box"><div class="example-label">EXAMPLE ${i+1}</div><code>Input: ${esc(testStr(t.args))}\nExpected: ${esc(testStr(t.expected))}</code></div>`).join('')}<h3 style="font-size:13px;margin:22px 0 11px">Your challenge</h3><p>Define <code class="mono">${esc(p.fn)}(${esc(p.signature)})</code> and make it pass the tests. Begin by explaining your assumptions. You can run sample checks or submit the full built-in suite.</p><div class="notice"><strong>Interview habit:</strong> ask clarifying questions, describe a baseline, identify the pattern, then optimize. Test empty, boundary, and repeated-value cases where applicable.</div>`;
}
let writeTimer;
function initEditor(){const p=getProblem(state.problemId);state.editorProblemId=p.id;clearTimeout(writeTimer);const textarea=$('#code-editor');textarea.value=data.drafts[p.id]??p.starter;
  if(window.CodeMirror){state.edit=CodeMirror.fromTextArea(textarea,{mode:'python',theme:'material-darker',lineNumbers:true,indentUnit:4,tabSize:4,indentWithTabs:false,lineWrapping:true,matchBrackets:true,extraKeys:{'Ctrl-Enter':()=>runTests('run'),'Cmd-Enter':()=>runTests('run')}});state.edit.on('change',()=>{clearTimeout(writeTimer);const editor=state.edit;writeTimer=setTimeout(()=>saveDraft(p.id,editor),350)})}
  else{state.edit={getValue:()=>textarea.value,setValue:v=>textarea.value=v};textarea.addEventListener('input',()=>{clearTimeout(writeTimer);const editor=state.edit;writeTimer=setTimeout(()=>saveDraft(p.id,editor),350)});toast('CodeMirror could not load; plain-text editor is available.')} }
function saveDraft(id=state.editorProblemId,editor=state.edit){if(editor&&id!=null){const value=editor.getValue();if(data.drafts[id]!==value){data.drafts[id]=value;persist()}}}
function openProblem(id,review=false){if(!getProblem(id))return;
  if(state.page==='workspace')saveDraft();clearTimeout(writeTimer);state.problemId=Number(id);state.reviewMode=review;state.chat[state.problemId]=state.chat[state.problemId]||[];state.mock=state.mock?.id===Number(id)?state.mock:null;navigate('workspace')}
function switchTab(tab){const p=getProblem(state.problemId);$$('.card-tab').forEach(el=>el.classList.toggle('active',el.dataset.tab===tab));$('#problem-tab-content').innerHTML=workspaceTab(p,tab)}
function renderChat(){const p=getProblem(state.problemId);const container=$('#coach-chat');if(!container)return;const history=state.chat[p.id]||[];
  const intro=`Let's work on ${p.title}. Before coding, what inputs or constraints matter, and what brute-force approach comes to mind? I won't hand you the solution.`;
  container.innerHTML='';for(const message of [{role:'assistant',text:intro},...history]){const item=document.createElement('div');item.className='chat-item '+message.role;item.textContent=message.text;container.appendChild(item)}if(state.coachPendingSet.has(p.id)){const item=document.createElement('div');item.className='chat-item assistant pending';item.textContent='Thinking through your approach…';container.appendChild(item)}container.scrollTop=container.scrollHeight;
}
function offlineCoach(question,p){const text=question.toLowerCase(),pattern=getPattern(p.pattern),revealed=data.hints[p.id]||0;
  if(/complex|big.?o|time|space|efficient/.test(text))return `Let's analyze the operations, not the syntax. ${pattern.invariant} Which steps repeat as the input grows, and how much extra memory does your state need?`;
  if(/edge|case|empty|fail|test/.test(text))return `Try an empty or smallest legal input, duplicates, boundaries, and an already-optimal case where relevant. Which of those could violate your invariant: “${pattern.invariant}”?`;
  if(/hint|stuck|approach|clue|help/.test(text))return revealed>0?`You have revealed ${revealed} hint${revealed>1?'s':''}. Use your latest hint to formulate one loop invariant. ${pattern.signal} What can you prove after processing each element?`:`Here's a small nudge: ${pattern.signal} Write down the brute-force method first, and name the work it repeats. You can reveal Hint 1 when ready.`;
  if(/explain|understand|concept|example|why/.test(text))return `Let's build the intuition. ${pattern.idea}\n\nFor a concrete example: ${pattern.example}\n\nThe rule to keep checking is: ${pattern.invariant}\n\nA common trap is ${pattern.pitfall}\n\nCan you describe the state you would update after processing one new element?`;
  if(/debug|review my code|bug/.test(text)){const failures=state.lastRun?.id===p.id?state.lastRun.result?.results?.filter(t=>!t.ok):null;return failures?.length?`Start with your first failing test. Expected ${JSON.stringify(failures[0].expected)}, but got ${JSON.stringify(failures[0].actual)}. ${pattern.pitfall} Try tracing your state right before the incorrect result.`:`Run the local tests first, then compare actual and expected output. ${pattern.pitfall} Focus on the invariant: ${pattern.invariant}`;}
  if(/correct|working|done|review/.test(text))return 'Run the provided checks, then challenge yourself: can you explain correctness, worst-case time/space complexity, and a tricky edge case? Passing the local suite is evidence, not a proof for all inputs.';
  return `Interesting. Focus on this: ${pattern.invariant} Can you explain why that stays true after each operation? Share your thinking, and we can test the reasoning together.`;
}
async function coachSend(text){saveDraft();const p=getProblem(state.problemId);if(state.coachPendingSet.has(p.id))return;text=String(text||'').trim();if(!text)return;
  const history=state.chat[p.id]||[];const preceding=history.slice(-10).map(x=>({role:x.role,text:x.text}));history.push({role:'user',text});state.chat[p.id]=history;renderChat();const input=$('#coach-input');if(input)input.value='';state.coachPendingSet.add(p.id);renderChat();const button=$('#coach-submit');if(button){button.disabled=true;button.textContent='…'};
  let reply;
  if(state.aiOn&&state.aiAvailable){
    try{
      const run=state.lastRun?.id===p.id?state.lastRun?.result:null;
      const response=await fetch('/api/coach',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        message:text,code:data.drafts[p.id]||p.starter,history:preceding,model:data.aiModel||null,
        hintsRevealed:data.hints[p.id]||0,lastRun:run,
        problem:{title:p.title,pattern:getPattern(p.pattern).name,description:p.description,invariant:getPattern(p.pattern).invariant,signal:getPattern(p.pattern).signal}
      })});
      const obj=await response.json();if(!response.ok)throw Error(obj.error||'AI request failed');reply=obj.reply;
    }catch(error){reply=`The AI coach couldn't respond (${error.message}). You can keep learning without it.

${offlineCoach(text,p)}`}
  }else reply=offlineCoach(text,p);
  history.push({role:'assistant',text:reply});state.coachPendingSet.delete(p.id);
  if(state.problemId===p.id&&state.page==='workspace'){renderChat();const send=$('#coach-submit');if(send){send.disabled=false;send.textContent='Ask ↗'}}
}
function setIndicator(kind,message){const el=$('#runner-indicator');el.innerHTML=`<span class="status-dot ${kind}"></span>${esc(message)}`;
  $$('#run-button,#submit-button').forEach(btn=>btn.disabled=!state.runnerReady||state.running)}
function startRunner(){clearTimeout(state.runTimer);state.runRequest++;state.running=false;if(state.runner)state.runner.terminate();state.runnerReady=false;state.runnerError='';setIndicator('loading','Python loading');
  try{state.runner=new Worker('./runner.worker.js');state.runner.onmessage=({data:msg})=>{
    if(msg.type==='ready'){state.runnerReady=true;state.runnerError='';setIndicator('','Python ready');}
    if(msg.type==='load-error'){state.runnerError=msg.message;state.runnerReady=false;setIndicator('error','Python unavailable');toast('Python runtime failed to load. Check your connection and try refreshing.');}
    if(msg.type==='result'&&msg.requestId===state.runRequest){clearTimeout(state.runTimer);state.running=false;setIndicator('','Python ready');const problemId=state.requestProblemId;state.lastRun={id:problemId,mode:state.requestMode,result:msg.data};if(state.page==='workspace'&&state.problemId===problemId)renderConsole();if(state.requestMode==='submit'&&msg.data?.ok&&msg.data.results?.length&&msg.data.results.every(r=>r.ok))markSolved(problemId);}
  };state.runner.onerror=(event)=>{state.runnerReady=false;state.running=false;setIndicator('error','Python error');toast('Python worker failed. Refresh to retry.');};}
  catch{setIndicator('error','Worker unsupported');toast('Please launch with the included Node server (npm start).')}
}
function runTests(mode){if(state.running||!state.runnerReady)return;const p=getProblem(state.problemId);saveDraft();const tests=mode==='run'?p.tests.slice(0,2):p.tests;
  state.running=true;state.requestMode=mode;state.requestProblemId=p.id;state.runRequest++;state.lastRun=null;setIndicator('loading','Running tests');
  const out=$('#console-body');if(out)out.innerHTML='<span class="console-empty">Running Python tests…</span>';
  state.runner.postMessage({type:'run',requestId:state.runRequest,payload:{fn:p.fn,code:state.edit.getValue(),tests,comparator:p.comparator||'exact'}});
  clearTimeout(state.runTimer);state.runTimer=setTimeout(()=>{state.running=false;state.runRequest++;state.runnerReady=false;state.lastRun={id:p.id,mode,result:{ok:false,error:'Execution exceeded 10 seconds. The Python worker was stopped. Check for infinite loops and retry.',results:[]}};renderConsole();startRunner()},10000);
}
function renderConsole(){const el=$('#console-body');if(!el)return;const run=state.lastRun;if(!run||run.id!==state.problemId){el.innerHTML='<span class="console-empty">Run your code to see test results here.</span>';return}
  const result=run.result||{};const tests=result.results||[],passed=tests.filter(t=>t.ok).length,all=result.ok&&tests.length&&passed===tests.length;
  el.innerHTML=`<div class="test-feedback ${all?'pass':'fail'}">${all?'✓ All checks passed':'● Tests need attention'} · ${passed}/${tests.length} passed ${run.mode==='run'?'(example run)':'(full local suite)'}</div>${result.error?`<div class="test-detail" style="color:#f2a6b9">${esc(result.error)}</div>`:''}${tests.map(t=>`<div class="test-result ${t.ok?'ok':'failed'}"><div><strong>${t.ok?'✓':'✕'} Test ${t.index+1}</strong>${!t.ok?`<div class="test-detail">${t.error?esc(t.error):`Expected: ${esc(JSON.stringify(t.expected))}\nReceived: ${esc(JSON.stringify(t.actual))}`}</div>`:''}</div><span class="small">${t.ok?'PASS':'FAIL'}</span></div>`).join('')}${result.stdout?`<div class="terminal-output">stdout:\n${esc(result.stdout)}</div>`:''}${all&&run.mode==='submit'?`<div class="review-banner"><h3>✧ Great work. Now strengthen recall.</h3><p>Can you explain the invariant and complexity? Rate how independently you solved this, and we'll schedule your review.</p><div class="review-ratings">${[['again','Again'],['hard','Hard'],['good','Good'],['easy','Easy']].map(([v,label])=>`<button class="rating-btn" data-action="rate" data-rating="${v}">${label}</button>`).join('')}</div></div>`:''}`;
}
function markSolved(problemId=state.problemId){const p=getProblem(problemId);if(p.source==='ai-draft'){toast('AI draft tests passed. This exercise is not counted toward verified mastery.');return;}const entry=data.progress[p.id]||{};const first=!entry.solvedAt;entry.solvedAt=entry.solvedAt||day();entry.lastPassed=day();entry.attempts=(entry.attempts||0)+1;entry.hintsUsed=Math.max(entry.hintsUsed||0,data.hints[p.id]||0);entry.interval=entry.interval||1;entry.nextDue=entry.nextDue||plusDays(1);entry.reviews=entry.reviews||0;data.progress[p.id]=entry;
  if(first){data.activity[day()]=(data.activity[day()]||0)+1;toast(`✓ ${p.title} solved! Review scheduled for tomorrow.`)}else toast('✓ Tests passed again! Rate your recall below.');persist();sidebar();
}
function rate(rating){const p=getProblem(state.problemId);const e=data.progress[p.id];if(!e)return;
  if(rating==='again')e.interval=1;
  else if(rating==='hard')e.interval=Math.max(2,Math.round((e.interval||1)*1.3));
  else if(rating==='good')e.interval=Math.max(3,Math.round((e.interval||1)*2.2));
  else e.interval=Math.max(5,Math.round((e.interval||1)*3));
  e.reviews=(e.reviews||0)+1;e.lastRating=rating;e.nextDue=plusDays(e.interval);persist();toast(`Review scheduled for ${e.nextDue} (${e.interval} days).`);
  const banner=$('.review-banner');if(banner)banner.innerHTML=`<h3>✓ Review scheduled</h3><p>Your next check-in is ${esc(e.nextDue)}. Try the next exercise, or revisit this problem when it's due.</p><button class="btn btn-primary btn-sm" data-action="next-problem">Next problem ↗</button>`;sidebar();
}
function startMock(problemId){const options=PROBLEMS.filter(p=>p.difficulty==='Medium'&&!isSolved(p.id));const p=getProblem(problemId)||options[Math.floor(Math.random()*options.length)]||nextUnsolved();openProblem(p.id);state.mock={id:p.id,endsAt:Date.now()+45*60*1000};render();toast('Mock started: 45 minutes. Explain your reasoning aloud before writing code.');}
function updateTimer(){const clock=$('#mock-timer');if(!clock||!state.mock)return;
  const seconds=Math.max(0,Math.ceil((state.mock.endsAt-Date.now())/1000));clock.textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;clock.classList.toggle('warn',seconds<300);
  if(seconds===0){state.mock=null;toast('Mock interview complete. Reflect on your approach and what you would change.');render()}}
function openSettings(){renderSettingsModal();if(state.aiAvailable)loadAIModels();}
function renderSettingsModal(){const root=$('#modal-root');root.innerHTML=`<div class="settings-modal-backdrop" id="modal-backdrop"><div class="settings-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div style="display:flex;justify-content:space-between;align-items:start"><div><div class="eyebrow">PERSONAL WORKSPACE</div><h2 id="modal-title">Settings</h2></div><button class="icon-button" data-action="close-modal" aria-label="Close settings">×</button></div>
  <div class="setting-row"><h3>ChatGPT interview coach</h3><p>${state.aiAvailable?'Your ChatGPT account is connected. Ask for intuitive explanations, targeted debugging, or a step-by-step nudge. Requests use your ChatGPT plan allowance, subject to limits.':'Continue with ChatGPT to use your eligible plan allowance for private AI coaching. You can always use the built-in coach and staged hints offline.'}</p>
  ${state.aiAvailable?`<div class="notice">✓ Connected${state.aiEmail?' as '+esc(state.aiEmail):''} · ChatGPT plan usage enabled</div><label class="small ai-option"><input type="checkbox" id="ai-toggle" ${state.aiOn?'checked':''}/> Use ChatGPT for coaching</label><label class="small ai-option" for="ai-model">ChatGPT model <select id="ai-model" class="filter-select"><option value="">Automatically select available model</option>${state.aiModels.map(m=>`<option value="${esc(m.slug)}" ${data.aiModel===m.slug?'selected':''}>${esc(m.name)}</option>`).join('')}</select></label><div class="data-actions"><button class="btn btn-secondary btn-sm" data-action="refresh-models">↻ Refresh models</button><button class="btn btn-outline btn-sm" data-action="disconnect-chatgpt">Disconnect</button><a class="link-button" href="https://chatgpt.com/#settings/Usage" target="_blank" rel="noopener noreferrer">Manage usage ↗</a></div>`:`<button class="btn btn-primary btn-sm" data-action="connect-chatgpt">Continue with ChatGPT ↗</button><p class="muted small" style="margin-top:8px">No API key or separate API billing needed. You'll authorize the connection in your browser.</p>`}
  </div>
  <div class="setting-row"><h3>Progress and privacy</h3><p>Notes, solutions, hints, quizzes, and review schedules live in this browser's localStorage. No account, analytics, or cloud synchronization is included.</p><div class="data-actions"><button class="btn btn-secondary btn-sm" data-action="export">↓ Export JSON</button><button class="btn btn-secondary btn-sm" data-action="import">↑ Import JSON</button><button class="btn btn-outline btn-sm" data-action="reset-all">Reset progress</button><input type="file" id="import-file" accept="application/json,.json" hidden/></div></div><div class="setting-row"><h3>Python runtime</h3><p>Code executes in your browser via Pyodide in a Web Worker with a 10-second test-run timeout. This is a personal learning environment, not a hardened multi-user sandbox.</p><button class="btn btn-secondary btn-sm" data-action="restart-python">↻ Restart Python runtime</button></div><div class="settings-modal-actions"><button class="btn btn-primary btn-sm" data-action="close-modal">Done</button></div></div></div>`;
}
function closeSettings(){$('#modal-root').innerHTML=''}
function exportData(){if(state.page==='workspace')saveDraft();const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`patternlab-progress-${day()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Progress exported.')}
async function importData(file){try{
  if(!file||file.size>2_000_000)throw Error('Choose a JSON file under 2 MB.');
  const obj=JSON.parse(await file.text());if(obj.version!==1||!obj.progress||!obj.drafts||Array.isArray(obj.progress)||Array.isArray(obj.drafts)||typeof obj.progress!=='object'||typeof obj.drafts!=='object')throw Error('Not a valid PatternLab export.');
  const cleanedContent=attachPersonalContent({personalPatterns:obj.personalPatterns,personalProblems:obj.personalProblems});
  const known=new Set(PROBLEMS.map(p=>String(p.id))),patterns=new Set(PATTERNS.map(p=>p.id));
  const clean={progress:{},drafts:{},notes:{},hints:{},quizzes:{},activity:{}};
  for(const [k,v] of Object.entries(obj.progress)){if(!known.has(k)||!v||typeof v!=='object'||Array.isArray(v))continue;clean.progress[k]={solvedAt:typeof v.solvedAt==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v.solvedAt)?v.solvedAt:null,lastPassed:typeof v.lastPassed==='string'?v.lastPassed.slice(0,10):null,nextDue:typeof v.nextDue==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v.nextDue)?v.nextDue:day(),attempts:Math.max(0,Math.min(9999,Number(v.attempts)||0)),reviews:Math.max(0,Math.min(9999,Number(v.reviews)||0)),interval:Math.max(1,Math.min(3650,Number(v.interval)||1)),hintsUsed:Math.max(0,Math.min(3,Number(v.hintsUsed)||0))};}
  for(const [k,v] of Object.entries(obj.drafts)){if(known.has(k)&&typeof v==='string')clean.drafts[k]=v.slice(0,18000)}
  for(const [k,v] of Object.entries(obj.notes||{})){if(known.has(k)&&typeof v==='string')clean.notes[k]=v.slice(0,12000)}
  for(const [k,v] of Object.entries(obj.hints||{})){if(known.has(k))clean.hints[k]=Math.max(0,Math.min(3,Number(v)||0))}
  for(const [k,v] of Object.entries(obj.quizzes||{})){if(patterns.has(k))clean.quizzes[k]=Math.max(0,Math.min(5,Number(v)||0))}
  for(const [k,v] of Object.entries(obj.activity||{})){if(/^\d{4}-\d{2}-\d{2}$/.test(k))clean.activity[k]=Math.max(0,Math.min(999,Number(v)||0))}
  if(state.edit&&typeof state.edit.toTextArea==='function')state.edit.toTextArea();state.edit=null;state.editorProblemId=null;
  for(const field of Object.keys(clean))data[field]=clean[field];Object.assign(data,cleanedContent);if(!getProblem(state.problemId))state.problemId=PROBLEMS[0].id;if(state.lessonPattern&&!getPattern(state.lessonPattern))state.lessonPattern=null;persist();closeSettings();render();toast('Progress imported successfully.');
}catch(e){toast(`Import failed: ${e.message}`)}}
function addPersonal(item,type){
  const existing=type==='pattern'?data.personalPatterns:data.personalProblems;
  const candidate=[...existing,item];
  const attached=attachPersonalContent({personalPatterns:type==='pattern'?candidate:data.personalPatterns,personalProblems:type==='exercise'?candidate:data.personalProblems});
  const stored=type==='pattern'?attached.personalPatterns:attached.personalProblems;
  if(stored.length!==candidate.length)throw Error('Generated content did not pass the format and safety checks. Try again.');
  Object.assign(data,attached);persist();
}
function freshRemix(id){
  const selected=getProblem(Number(id));const base=getProblem(selected?.variantOf)||selected;
  if(!base||!remixSupported(base.id)){toast('Fresh test cases are not available for this problem.');return}
  try{
    const seed=Math.floor(Math.random()*0x7fffffff)+1;
    const p=createRemix(base,seed,nextPersonalId(data.personalProblems));addPersonal(p,'exercise');openProblem(p.id);toast('Fresh verified test cases created. Solve without looking at your old answer.');
  }catch(e){toast('Could not create fresh cases: '+e.message)}
}
async function generateContent(kind,patternId=null,baseId=null){
  if(state.generatePending)return;
  if(!state.aiAvailable||!state.aiOn){toast('Connect and enable ChatGPT in Settings to generate new content.');openSettings();return}
  const topic=kind==='pattern'?prompt('Which new algorithmic pattern should the study guide cover? (For example: digit DP, meet in the middle, segment trees)'):(baseId?`Create a related but genuinely different interview exercise inspired by ${getProblem(Number(baseId))?.title}.`:'Create a useful new exercise for this algorithmic pattern.');
  if(topic===null||!topic.trim())return;
  const pattern=kind==='exercise'?getPattern(patternId):null;
  if(kind==='exercise'&&!pattern){toast('The selected pattern is unavailable.');return}
  state.generatePending=true;render();toast('Generating content with ChatGPT. AI-created exercises require manual verification.');
  try{
    const response=await fetch('/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,topic:topic.slice(0,170),pattern:pattern?{id:pattern.id,name:pattern.name,idea:pattern.idea,invariant:pattern.invariant}:undefined,base:baseId?{title:getProblem(Number(baseId))?.title,description:getProblem(Number(baseId))?.description}:undefined,model:data.aiModel||null})});
    const payload=await response.json();if(!response.ok)throw Error(payload.error||'Generation failed');
    const item=payload.content;
    if(kind==='pattern'){
      const slug=String(item.name||topic).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,30)||'pattern';
      item.id='personal-'+slug+'-'+Date.now().toString(36).slice(-7);item.tier='Advanced';
      if(!validatePattern(item))throw Error('The AI-generated pattern had an invalid structure. Please retry.');
      addPersonal(item,'pattern');state.lessonPattern=item.id;navigate('learn');toast('Your new study guide has been added. Review it for accuracy.');
    }else{
      Object.assign(item,{id:nextPersonalId(data.personalProblems),pattern:pattern.id,source:'ai-draft',variantOf:baseId?Number(baseId):null});
      if(!validateProblem(item,new Set(PATTERNS.map(x=>x.id))))throw Error('The AI-generated exercise had an invalid structure. Please retry.');
      addPersonal(item,'exercise');openProblem(item.id);toast('AI exercise draft created. Review its requirements and test cases before relying on them.');
    }
  }catch(e){toast('Could not generate content: '+e.message);render()}
  finally{state.generatePending=false;render()}
}
function handleAction(el){const action=el.dataset.action;
  if(action==='problem')openProblem(el.dataset.id);
  else if(action==='open-pattern'){state.lessonPattern=el.dataset.pattern;navigate('learn')}
  else if(action==='lesson-back'){state.lessonPattern=null;render()}
  else if(action==='fresh-remix')freshRemix(el.dataset.id);
  else if(action==='generate-pattern')generateContent('pattern');
  else if(action==='generate-exercise')generateContent('exercise',el.dataset.pattern,el.dataset.base);
  else if(action==='answer-quiz'){data.quizzes[el.dataset.pattern]=Number(el.dataset.choice);persist();render()}
  else if(action==='next-problem'){const p=getProblem(state.problemId),arr=BY_PATTERN[p.pattern],i=arr.findIndex(x=>x.id===p.id);openProblem((arr.slice(i+1).find(x=>!isSolved(x.id))||nextUnsolved()).id)}
  else if(action==='review-problem')openProblem(el.dataset.id,true);
  else if(action==='hint'){const p=getProblem(state.problemId);data.hints[p.id]=Math.min(3,(data.hints[p.id]||0)+1);persist();switchTab('hints');toast('Hint revealed. Try to reason from it before asking for more.')}
  else if(action==='run')runTests('run');else if(action==='submit')runTests('submit');
  else if(action==='clear-results'){state.lastRun=null;renderConsole()}
  else if(action==='reset-code'){if(confirm('Restore the starter code? Your current draft will be replaced.')){const p=getProblem(state.problemId);state.edit.setValue(p.starter);saveDraft();toast('Starter code restored.')}}
  else if(action==='coach-quick')coachSend(el.dataset.message);
  else if(action==='rate')rate(el.dataset.rating);
  else if(action==='start-mock')startMock(el.dataset.id);
  else if(action==='end-mock'){state.mock=null;render();toast('Mock ended. Make a note of your learnings.');}
  else if(action==='export')exportData();
  else if(action==='import')$('#import-file')?.click();
  else if(action==='reset-all'){if(confirm('Delete ALL locally saved progress, notes, and code? Export a backup first if needed.')){if(state.edit&&typeof state.edit.toTextArea==='function')state.edit.toTextArea();state.edit=null;state.editorProblemId=null;for(const field of ['progress','drafts','notes','hints','quizzes','activity'])data[field]={};data.personalPatterns=[];data.personalProblems=[];attachPersonalContent(data);if(!getProblem(state.problemId))state.problemId=PROBLEMS[0].id;state.lessonPattern=null;persist();closeSettings();state.chat={};render();toast('Local progress reset.')}}
  else if(action==='restart-python'){startRunner();toast('Restarting Python runtime…');}
  else if(action==='connect-chatgpt')connectChatGPT();
  else if(action==='disconnect-chatgpt')disconnectChatGPT();
  else if(action==='refresh-models')loadAIModels(true);
  else if(action==='close-modal')closeSettings();
}
function bindEvents(){
  document.addEventListener('click',e=>{
    const nav=e.target.closest('[data-nav]');if(nav){if(nav.dataset.nav==='learn')state.lessonPattern=null;navigate(nav.dataset.nav);return}
    const action=e.target.closest('[data-action]');if(action){handleAction(action);return}
    if(e.target.id==='mobile-overlay'){ $('#sidebar').classList.remove('open');e.target.hidden=true}
    if(e.target.id==='modal-backdrop')closeSettings();
  });
  $('#settings-open').addEventListener('click',openSettings);$('#settings-header').addEventListener('click',openSettings);
  $('#menu-button').addEventListener('click',()=>{const open=$('#sidebar').classList.toggle('open');$('#mobile-overlay').hidden=!open});
  const search=$('#global-search');search.addEventListener('input',e=>{state.query=e.target.value;if(state.page!=='practice')navigate('practice');else{$('#practice-search').value=state.query;$('#problem-results').innerHTML=problemResults()}});
  document.addEventListener('input',e=>{
    if(e.target.id==='practice-search'){state.query=e.target.value;$('#problem-results').innerHTML=problemResults()}
    if(e.target.id==='problem-notes'){data.notes[state.problemId]=e.target.value;clearTimeout(writeTimer);writeTimer=setTimeout(persist,400)}
  });
  document.addEventListener('change',e=>{
    if(e.target.id==='pattern-filter'){state.filterPattern=e.target.value;$('#problem-results').innerHTML=problemResults()}
    if(e.target.id==='difficulty-filter'){state.filterDifficulty=e.target.value;$('#problem-results').innerHTML=problemResults()}
    if(e.target.id==='ai-toggle'){state.aiOn=e.target.checked;data.aiEnabled=state.aiOn;persist();toast(state.aiOn?'ChatGPT coaching enabled.':'Built-in coaching enabled.');if(state.page==='workspace'){const tag=$('#coach-kind');if(tag)tag.textContent=state.aiOn?'ChatGPT coach':'Built-in coach';}}
    if(e.target.id==='ai-model'){data.aiModel=e.target.value;persist();toast('AI model preference saved.');}
    if(e.target.id==='import-file')importData(e.target.files?.[0]);
  });
  document.addEventListener('submit',e=>{if(e.target.id==='coach-form'){e.preventDefault();coachSend($('#coach-input').value)}});
  document.addEventListener('click',e=>{const tab=e.target.closest('[data-tab]');if(tab)switchTab(tab.dataset.tab)});
  document.addEventListener('keydown',e=>{
    if((e.key==='/'||((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'))&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)&&!document.activeElement.classList.contains('CodeMirror-code')){e.preventDefault();$('#global-search').focus()}
    if(e.key==='Escape'){closeSettings();$('#sidebar').classList.remove('open');$('#mobile-overlay').hidden=true}
    if((e.key==='Enter'||e.key===' ')&&e.target.matches('tr[role="button"][data-action="problem"]')){e.preventDefault();openProblem(e.target.dataset.id)}
  });
}
async function checkAI(){
  try{
    const response=await fetch('/api/status',{signal:AbortSignal.timeout(3000)});
    if(!response.ok)throw Error('Could not check AI connection');
    const status=await response.json();state.aiAvailable=!!status.sharing;state.aiEmail=status.email||null;
    state.aiOn=state.aiAvailable&&data.aiEnabled!==false;
    if(state.page==='workspace'){const tag=$('#coach-kind');if(tag)tag.textContent=state.aiOn?'ChatGPT coach':'Built-in coach';}
  }catch{state.aiAvailable=false;state.aiOn=false}
  const banner=new URL(location.href).searchParams.get('chatgpt');
  if(banner){history.replaceState({},'',location.pathname);toast(banner==='connected'?'✓ ChatGPT connected! Open Settings to choose your model.':'ChatGPT sign-in was not completed. Retry from Settings.');}
}
async function loadAIModels(force=false){
  if(!state.aiAvailable||(!force&&state.aiModels.length))return;
  try{
    const res=await fetch('/api/models');const json=await res.json();
    if(!res.ok)throw Error(json.error||'Unable to load models');
    state.aiModels=json.models||[];
    if($('#modal-root').children.length)openSettingsWithoutFetch();
    if(force)toast(`Found ${state.aiModels.length} models available to your account.`);
  }catch(e){if(force)toast('Could not fetch models: '+e.message)}
}
function openSettingsWithoutFetch(){if($('#modal-root').children.length)renderSettingsModal();}
async function connectChatGPT(){
  const btn=$('[data-action="connect-chatgpt"]');if(btn){btn.disabled=true;btn.textContent='Opening ChatGPT…';}
  try{const res=await fetch('/api/auth/start',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});const json=await res.json();if(!res.ok)throw Error(json.error||'Could not start sign-in');location.assign(json.url)}
  catch(e){toast(e.message);if(btn){btn.disabled=false;btn.textContent='Continue with ChatGPT ↗';}}
}
async function disconnectChatGPT(){
  if(!confirm('Disconnect ChatGPT? The offline coach will keep working.'))return;
  try{const res=await fetch('/api/auth/disconnect',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});if(!res.ok)throw Error('Disconnect request failed');state.aiAvailable=false;state.aiOn=false;state.aiEmail=null;state.aiModels=[];data.aiModel='';persist();openSettingsWithoutFetch();toast('ChatGPT disconnected.');}
  catch(e){toast(e.message)}
}
bindEvents();render();startRunner();checkAI();setInterval(()=>{if(state.page==='workspace'&&state.mock)updateTimer()},1000);
window.addEventListener('pagehide',()=>{if(state.edit)saveDraft();try{localStorage.setItem(STORAGE_KEY,JSON.stringify(data))}catch{}});
