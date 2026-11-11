// User-created content is local-only. Validate data before attaching it to the curated bank.
import {PATTERNS,PROBLEMS,BY_PATTERN,getProblem} from './catalog.js';

const text=(v,max=800)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const strictJSON=(v)=>{try{return JSON.stringify(v).length<=8000}catch{return false}};
const fullGuide=g=>obj(g)&&text(g.objective,600)&&text(g.intuition,1800)&&obj(g.walkthrough)&&text(g.walkthrough.title,160)&&text(g.walkthrough.input,500)&&Array.isArray(g.walkthrough.steps)&&g.walkthrough.steps.length>=3&&g.walkthrough.steps.length<=7&&g.walkthrough.steps.every(s=>text(s,500))&&text(g.walkthrough.conclusion,700)&&text(g.template,4500)&&text(g.complexity,900)&&text(g.compare,900)&&Array.isArray(g.mistakes)&&g.mistakes.length>=2&&g.mistakes.length<=6&&g.mistakes.every(s=>text(s,500))&&Array.isArray(g.recall)&&g.recall.length===2&&g.recall.every(s=>text(s,350));
export function validatePattern(p){
  if(!obj(p)||!/^personal-[a-z0-9-]{3,54}$/.test(p.id)||!text(p.name,80)||!text(p.short,180)||!text(p.signal,500)||!text(p.idea,900)||!text(p.invariant,550)||!text(p.pitfall,550)||!text(p.example,700)||p.tier!=='Advanced'||!fullGuide(p.study))return false;
  const q=p.quiz;return Array.isArray(q)&&q.length===4&&text(q[0],280)&&Array.isArray(q[1])&&q[1].length===3&&q[1].every(x=>text(x,150))&&Number.isInteger(q[2])&&q[2]>=0&&q[2]<3&&text(q[3],400);
}
export function validateProblem(p,knownPatternIds=new Set(PATTERNS.map(x=>x.id))){
  return obj(p)&&Number.isSafeInteger(p.id)&&p.id>=9_000_000&&p.id<100_000_000&&knownPatternIds.has(p.pattern)&&text(p.title,120)&&['Easy','Medium','Hard'].includes(p.difficulty)&&/^[A-Za-z_]\w{0,50}$/.test(p.fn||'')&&text(p.signature,500)&&text(p.description,2200)&&text(p.starter,6000)&&p.starter.includes('def '+p.fn+'(')&&Array.isArray(p.hints)&&p.hints.length===3&&p.hints.every(s=>text(s,650))&&Array.isArray(p.tests)&&p.tests.length>=3&&p.tests.length<=15&&p.tests.every(t=>obj(t)&&Array.isArray(t.args)&&Object.hasOwn(t,'expected')&&strictJSON(t)&&t.args.length<=8)&&(!p.comparator||['unordered','points','groups','nestedUnordered','topo'].includes(p.comparator))&&['curated-remix','ai-draft'].includes(p.source)&&(!p.variantOf||Number.isSafeInteger(p.variantOf));
}
export function attachPersonalContent({personalPatterns=[],personalProblems=[]}={}){
  // Reset is idempotent for imports, resets, and recovery from malformed storage.
  for(let i=PATTERNS.length-1;i>=0;i--)if(PATTERNS[i].personal)PATTERNS.splice(i,1);
  for(let i=PROBLEMS.length-1;i>=0;i--)if(PROBLEMS[i].personal)PROBLEMS.splice(i,1);
  for(const key of Object.keys(BY_PATTERN))delete BY_PATTERN[key];
  for(const p of PATTERNS)BY_PATTERN[p.id]=[];
  const customIds=new Set();const cleanPatterns=[];const cleanProblems=[];
  for(const entry of (Array.isArray(personalPatterns)?personalPatterns:[]).slice(0,35)){
    if(!validatePattern(entry)||customIds.has(entry.id)||PATTERNS.some(p=>p.id===entry.id))continue;
    const p={...entry,personal:true,icon:'✦',color:'#a9a5ff'};
    PATTERNS.push(p);BY_PATTERN[p.id]=[];customIds.add(p.id);cleanPatterns.push(p);
  }
  const known=new Set(PATTERNS.map(p=>p.id));const problemIds=new Set(PROBLEMS.map(p=>p.id));
  for(const entry of (Array.isArray(personalProblems)?personalProblems:[]).slice(0,120)){
    if(!validateProblem(entry,known)||problemIds.has(entry.id))continue;
    const p={...entry,personal:true};PROBLEMS.push(p);BY_PATTERN[p.pattern].push(p);problemIds.add(p.id);cleanProblems.push(p);
  }
  for(const p of PROBLEMS)if(!p.personal)BY_PATTERN[p.pattern].push(p);
  return {personalPatterns:cleanPatterns,personalProblems:cleanProblems};
}
export const nextPersonalId = (items=[]) => {
  const ids=new Set(PROBLEMS.map(p=>p.id));let id=9_000_000;
  for(const p of items)if(Number.isSafeInteger(p.id))id=Math.max(id,p.id+1);
  while(ids.has(id))id++;
  if(id>=100_000_000)throw Error('Personal exercise limit reached.');
  return id;
};

// Deterministic, independently calculated test cases for frequent canonical problems.
// These are new inputs for the SAME contract, not a claim that they are new LeetCode questions.
function rng(seed){let x=(seed|0)>>>0;return ()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296}}
const randint=(r,lo,hi)=>lo+Math.floor(r()*(hi-lo+1));
const shuffle=(a,r)=>{for(let i=a.length-1;i>0;i--){const j=randint(r,0,i);[a[i],a[j]]=[a[j],a[i]]}return a};
const T=(args,expected)=>({args,expected});
const oracles={
  1:r=>{let values,target,answer;for(let n=0;n<250;n++){values=Array.from({length:randint(r,4,9)},()=>randint(r,-35,35));const sums=new Map();for(let i=0;i<values.length;i++)for(let j=i+1;j<values.length;j++){const sum=values[i]+values[j];const pairs=sums.get(sum)||[];pairs.push([i,j]);sums.set(sum,pairs)}const unique=[...sums].filter(([,pairs])=>pairs.length===1);if(unique.length){const choice=unique[randint(r,0,unique.length-1)];target=choice[0];answer=choice[1][0];break}}if(!answer)throw Error('Could not construct two-sum case');return T([values,target],answer)},
  217:r=>{const nums=Array.from({length:randint(r,3,13)},()=>randint(r,-12,12));if(r()<.45){const values=shuffle(Array.from({length:nums.length},(_,i)=>i*3+randint(r,0,2)),r);return T([values],new Set(values).size<values.length)}return T([nums],new Set(nums).size<nums.length)},
  242:r=>{const letters='aabbccddeeffgh';const s=Array.from({length:randint(r,3,12)},()=>letters[randint(r,0,letters.length-1)]).join('');let t=shuffle([...s],r).join('');if(r()<.5){const pos=randint(r,0,t.length-1);t=t.slice(0,pos)+'z'+t.slice(pos+1)}return T([s,t],[...s].sort().join('')===[...t].sort().join(''))},
  121:r=>{const prices=Array.from({length:randint(r,2,15)},()=>randint(r,1,40));let low=Infinity,best=0;for(const x of prices){best=Math.max(best,x-low);low=Math.min(low,x)}return T([prices],best)},
  704:r=>{const nums=[...new Set(Array.from({length:randint(r,4,15)},()=>randint(r,-60,60)))].sort((a,b)=>a-b);const target=r()<.5?nums[randint(r,0,nums.length-1)]:randint(r,-70,70);return T([nums,target],nums.indexOf(target))},
  35:r=>{const nums=[...new Set(Array.from({length:randint(r,4,15)},()=>randint(r,-40,40)))].sort((a,b)=>a-b);const target=randint(r,-45,45);return T([nums,target],nums.filter(x=>x<target).length)},
  20:r=>{const pairs={')':'(',']':'[','}':'{'};const closers={'(':')','[':']','{':'}'};let s='';const stack=[];const n=randint(r,3,14);for(let i=0;i<n;i++){const open=r()<.55||!stack.length;if(open){const ch='([{'[randint(r,0,2)];stack.push(ch);s+=ch}else{const top=stack.pop();s+=r()<.8?closers[top]:')'}}let remaining=[];let valid=true;for(const ch of s){if('([{'.includes(ch))remaining.push(ch);else if(remaining.pop()!==pairs[ch]){valid=false;break}}return T([s],valid&&remaining.length===0)},
  70:r=>{const n=randint(r,1,30);let a=1,b=1;for(let i=2;i<=n;i++){[a,b]=[b,a+b]}return T([n],b)},
  739:r=>{const temps=Array.from({length:randint(r,4,14)},()=>randint(r,20,110));const out=temps.map((t,i)=>{let j=i+1;while(j<temps.length&&temps[j]<=t)j++;return j<temps.length?j-i:0});return T([temps],out)},
  560:r=>{const nums=Array.from({length:randint(r,3,12)},()=>randint(r,-5,5));const k=randint(r,-6,6);let count=0;for(let i=0;i<nums.length;i++){let sum=0;for(let j=i;j<nums.length;j++){sum+=nums[j];if(sum===k)count++}}return T([nums,k],count)},
  56:r=>{const intervals=Array.from({length:randint(r,3,10)},()=>{const a=randint(r,-20,20);return [a,a+randint(r,0,12)]});const sorted=intervals.map(x=>[...x]).sort((a,b)=>a[0]-b[0]);const merged=[];for(const [a,b] of sorted){if(merged.length&&a<=merged.at(-1)[1])merged.at(-1)[1]=Math.max(merged.at(-1)[1],b);else merged.push([a,b])}return T([intervals],merged)},
  200:r=>{const rows=randint(r,2,6),cols=randint(r,2,6),grid=Array.from({length:rows},()=>Array.from({length:cols},()=>r()<.5?'1':'0'));const seen=new Set();let islands=0;for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){if(grid[y][x]!=='1'||seen.has(y+','+x))continue;islands++;const stack=[[y,x]];seen.add(y+','+x);while(stack.length){const [i,j]=stack.pop();for(const [di,dj] of [[0,1],[0,-1],[1,0],[-1,0]]){const a=i+di,b=j+dj,k=a+','+b;if(a>=0&&a<rows&&b>=0&&b<cols&&grid[a][b]==='1'&&!seen.has(k)){seen.add(k);stack.push([a,b])}}}}return T([grid],islands)}
};
export const remixSupported=id=>Object.hasOwn(oracles,Number(id));
export function createRemix(base,seed,id){
  if(!base||!remixSupported(base.id))throw Error('A verified remix is not available for this exercise.');
  const r=rng(seed);const tests=Array.from({length:7},()=>oracles[base.id](r));
  const remix={id,title:`${base.title} · Fresh case lab ${seed}`,pattern:base.pattern,difficulty:base.difficulty,fn:base.fn,signature:base.signature,description:`${base.description}\n\nFresh case lab: solve this problem from scratch against seven independently generated test cases. The contract and algorithmic pattern are unchanged; inputs and edge cases are refreshed.`,starter:base.starter,hints:[...base.hints],tests,comparator:base.comparator,source:'curated-remix',variantOf:base.id,seed};
  if(!validateProblem(remix))throw Error('Generated invalid remix.');
  return remix;
}
